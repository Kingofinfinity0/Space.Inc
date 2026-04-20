import { ContextsResponse } from '../types/context';
import { Upload as TusUpload } from 'tus-js-client';
import { supabase, EDGE_FUNCTION_BASE_URL, ANON_KEY } from '../lib/supabase';
import { StaffMember, ClientLifecycle } from '../types';
import { inviteService } from './inviteService';

const STANDARD_UPLOAD_MAX_BYTES = 6 * 1024 * 1024;
const RESUMABLE_CHUNK_SIZE = 6 * 1024 * 1024;
const STORAGE_BUCKET = 'space-files';

const getDirectStorageUploadEndpoint = () => {
    const parsedUrl = new URL(EDGE_FUNCTION_BASE_URL);
    parsedUrl.hostname = parsedUrl.hostname.replace('.supabase.co', '.storage.supabase.co');
    parsedUrl.pathname = '/storage/v1/upload/resumable';
    parsedUrl.search = '';
    return parsedUrl.toString();
};

const uploadFileStandard = async (
    file: File,
    storagePath: string,
    onProgress?: (progress: number) => void
) => {
    const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false
        });

    if (error) throw error;
    onProgress?.(100);
};

const uploadFileResumable = async (
    file: File,
    storagePath: string,
    onProgress?: (progress: number) => void
) => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error('Not authenticated');
    }

    await new Promise<void>((resolve, reject) => {
        const upload = new TusUpload(file, {
            endpoint: getDirectStorageUploadEndpoint(),
            retryDelays: [0, 3000, 5000, 10000, 20000],
            headers: {
                authorization: `Bearer ${session.access_token}`,
                apikey: ANON_KEY,
                'x-upsert': 'false'
            },
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            chunkSize: RESUMABLE_CHUNK_SIZE,
            metadata: {
                bucketName: STORAGE_BUCKET,
                objectName: storagePath,
                contentType: file.type || 'application/octet-stream',
                cacheControl: '3600'
            },
            onError: (error) => reject(error),
            onProgress: (bytesUploaded, bytesTotal) => {
                if (!bytesTotal) return;
                onProgress?.(Math.round((bytesUploaded / bytesTotal) * 100));
            },
            onSuccess: () => {
                onProgress?.(100);
                resolve();
            }
        });

        upload.findPreviousUploads().then((previousUploads) => {
            if (previousUploads.length > 0) {
                upload.resumeFromPreviousUpload(previousUploads[0]);
            }

            upload.start();
        }).catch(reject);
    });
};

/**
 * apiService.ts - The bridge between Frontend and "Industrial Grade" Edge Functions
 */

export const apiService = {
    // --- Auth & Onboarding (Native Architecture) ---
    async getMyContexts(): Promise<ContextsResponse> {
        const { data, error } = await supabase.rpc("get_my_contexts");
        if (error) throw error;
        return data as ContextsResponse;
    },
    async auth(data: {
        action: 'login' | 'signup';
        email: string;
        password?: string;
        organization_name?: string;
        full_name?: string;
    }) {
        if (!data.password) {
            return { data: null, error: { message: 'Password is required' } };
        }

        if (data.action === 'signup') {
            return await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        full_name: data.full_name,
                        organization_name: data.organization_name
                    }
                }
            });
        } else {
            return await supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password
            });
        }
    },

    async logout() {
        return await supabase.auth.signOut();
    },

    async exchangeOAuth(provider: string) {
        // Redundant in native flow as onAuthStateChange handles it,
        // but keeping it for compatibility if any component calls it.
        return await supabase.auth.getSession();
    },

    // --- Organization Policies ---
    async getOrganizationPolicies(orgId: string) {
        const { data, error } = await supabase
            .from('organization_policies')
            .select('*')
            .eq('organization_id', orgId)
            .single();

        if (error && error.code !== 'PGRST116') {
            return { data: null, error };
        }
        return { data: data || { }, error: null };
    },

    async getSpaceById(spaceId: string, organizationId: string) {
        const { data, error } = await supabase
            .from('spaces')
            .select('*')
            .eq('id', spaceId)
            .eq('organization_id', organizationId)
            .single();
        return { data, error };
    },

    async getSpaceInvitations(spaceId: string, organizationId: string) {
        const { data, error } = await supabase
            .from('invitations')
            .select('id, token, expires_at, email, status, created_at')
            .eq('space_id', spaceId)
            .eq('organization_id', organizationId)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });
        return { data: data || [], error };
    },

    // --- Analytics & Aggregates ---
    async getDashboardMetrics(organizationId: string) {
        const { data, error } = await supabase.rpc('get_dashboard_metrics', {
            p_organization_id: organizationId
        });
        if (error) return { data: null, error };
        return { data, error: null };
    },

    async getSpaceDashboardData(spaceId: string, organizationId: string) {
        const { data, error } = await supabase.rpc('get_space_dashboard_data', {
            p_space_id: spaceId,
            p_organization_id: organizationId
        });
        if (error) return { data: null, error };
        return { data, error: null };
    },

    async getSpaceStats(spaceId: string, organizationId: string) {
        const { data, error } = await supabase
            .from('space_stats')
            .select('message_count, file_count, meeting_count, last_activity_at')
            .eq('space_id', spaceId)
            .eq('organization_id', organizationId)
            .single();
        return { data, error };
    },

    async getDashboardFeed(organizationId: string, limit: number = 10) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('activity_logs')
            .select('id, action_type, space_id, user_id, created_at')
            .eq('organization_id', organizationId)
            .in('action_type', ['meeting_created', 'file_uploaded'])
            .gt('created_at', sevenDaysAgo)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) return { data: null, error };
        return { data: data || [], error: null };
    },

    async getUnifiedNotifications(organizationId: string, userId: string, limit: number = 20) {
        const { data, error } = await supabase
            .from('notifications')
            .select('id, type, message, read, created_at, space_id')
            .eq('organization_id', organizationId)
            .eq('user_id', userId)
            .eq('read', false)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) return { data: null, error };
        return { data: data || [], error: null };
    },


    async updateOrganizationPolicies(orgId: string, policies: any) {
        const { data, error } = await supabase
            .from('organization_policies')
            .upsert({ organization_id: orgId, ...policies })
            .select()
            .single();
        return { data, error };
    },

    async onboard(data: any) {
        return this.auth({ action: 'signup', ...data });
    },

    async getProfile() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { data: null, error: { message: 'Not authenticated' } };

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        return { data, error };
    },

    async updateProfile(updates: { full_name?: string; avatar_url?: string; phone?: string }) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { data: null, error: { message: 'Not authenticated' } };

        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id)
            .select()
            .single();

        return { data, error };
    },

    async getCapabilityLens() {
        const { data, error } = await supabase.rpc('get_capability_lens');
        if (error) return { data: null, error };
        return { data, error: null };
    },

    async getMyPermissions(spaceId: string) {
        const { data, error } = await supabase.rpc("get_my_permissions", { p_space_id: spaceId });
        if (error) return { data: null, error };
        return { data: data as any, error: null };
    },

    // --- Spaces (Hardened Access) ---
    async getSpaces(organizationId: string) {
        if (!organizationId) return { data: [], error: { message: 'organization_id is required' } };
        const { data, error } = await supabase
            .from('spaces')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        return { data: data || [], error: error };
    },

    async getSpaceMembers(spaceId: string, organizationId: string) {
        if (!organizationId) return { data: [], error: { message: 'organization_id is required' } };
        const { data, error } = await supabase
            .from('space_memberships')
            .select(`
                id,
                role,
                status,
                profiles (
                    id,
                    full_name,
                    role,
                    email
                )
            `)
            .eq('space_id', spaceId)
            .eq('organization_id', organizationId);
        
        return { data: data || [], error: error };
    },

    async createSpace(name: string, description?: string, organizationId?: string) {
        const { data, error } = await supabase.functions.invoke('createspace-api', {
            method: 'POST',
            body: { name, description }
        });
        if (error) return { data: null, error: { message: error.message } };
        if (data?.error) return { data: null, error: data.error };
        
        // Edge fn returns: { data: { id: "uuid" } } with 201
        // invoke wraps body into data: invoke.data.data.id
        const result = data?.data ?? data;
        return { data: result, error: null };
    },

    async updateSpace(spaceId: string, updates: any, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('createspace-api', {
            method: 'PATCH',
            body: { action: 'update', space_id: spaceId, data: updates, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to update space' } };
        return { data: data?.data, error: null };
    },

    async archiveSpace(spaceId: string, organizationId: string, reason?: string) {
        const { data, error } = await supabase.functions.invoke('createspace-api', {
            method: 'PATCH',
            body: { action: 'archive', space_id: spaceId, reason, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to archive space' } };
        return { data: data?.data, error: null };
    },

    async deleteSpace(spaceId: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('createspace-api', {
            method: 'DELETE',
            body: { space_id: spaceId, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to delete space' } };
        return { data: data?.data, error: null };
    },

    /**
     * [AGENT 1 — Security Hardened]
     * Sends an invitation via the invite_user_secure() SECURITY DEFINER RPC.
     * Authorization is enforced at the database layer (capability check inside RPC).
     * Raw token is NEVER returned to the frontend — the worker handles email dispatch.
     *
     * @param spaceId - The target space UUID
     * @param email   - Invitee email address
     * @param role    - 'staff' | 'client' (default: 'client')
     */
    async generateClientInviteLink(spaceId: string, organizationId: string, email?: string) {
        const { data, error } = await supabase.rpc('generate_client_invite_link', {
            p_space_id: spaceId,
            p_organization_id: organizationId,
            p_email: email ?? null
        });
        if (error) throw error;
        // The RPC returns { token, invite_id, expires_at, invite_url }
        return data as { token: string; invite_id: string; expires_at: string; invite_url: string };
    },

    async generateStaffInviteLink(email: string, role: string, organizationId: string, spaceAssignments: any[] = [], expiresAt?: string) {
        const { data, error } = await supabase.rpc('generate_staff_invite_link', {
            p_email: email,
            p_role: role,
            p_organization_id: organizationId,
            p_space_assignments: spaceAssignments,
            p_expires_at: expiresAt
        });
        if (error) throw error;
        // Build robust link from current origin
        data.invite_link = `${window.location.origin}/join/${data.token}`;
        return data;
    },

    async resolveSpaceInviteToken(token: string) {
        return await inviteService.resolveSpaceToken(token);
    },

    async acceptSpaceInvite(token: string, clientName: string, clientCompany?: string | null) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Not authenticated');
        return await inviteService.acceptSpaceInvite(token, session.access_token, clientName, clientCompany);
    },

    async validateInvitationContext(token: string) {
        return await inviteService.validateEmailInvite(token);
    },

    async acceptInvitation(token: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Not authenticated');
        const data = await inviteService.acceptEmailInvite(token, session.access_token);
        return { data };
    },

    async regenerateSpaceInviteLink(spaceId: string) {
        const { data, error } = await supabase.rpc('regenerate_space_invite_link', {
            p_space_id: spaceId
        });
        if (error) throw error;
        return data;
    },

    async revokeInvitation(token: string) {
        const { data, error } = await supabase.rpc('revoke_invitation', {
            p_token: token
        });
        if (error) throw error;
        return data;
    },

    async updateInvitationEmail(token: string, newEmail: string) {
        const { data, error } = await supabase.rpc('update_invitation_email', {
            p_token: token,
            p_new_email: newEmail
        });
        if (error) throw error;
        // Build robust link from current origin if a new token was generated
        if (data.token) {
            data.invite_link = `${window.location.origin}/join/${data.token}`;
        }
        return data;
    },

    async listSentInvitations() {
        const { data, error } = await supabase.rpc('list_sent_invitations');
        if (error) throw error;
        return data || [];
    },

    // --- Activity Logs ---
    async getActivityLogs(organizationId: string, spaceId?: string) {
        if (!organizationId) return { data: [], error: { message: 'organization_id is required' } };
        const slug = spaceId ? `activity-logs-api?space_id=${spaceId}&organization_id=${organizationId}` : `activity-logs-api?organization_id=${organizationId}`;
        const { data, error } = await supabase.functions.invoke(slug, {
            method: 'GET'
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to fetch activity logs' } };
        return { data: data?.data || data || [], error: null };
    },

    async getUnifiedInbox(organizationId: string): Promise<any[]> {
        if (!organizationId) return [];
        const { data, error } = await supabase.rpc('get_unified_inbox');
        if (error) throw error;
        return data || [];
    },

    // --- Phase 16: Compliance & CRM ---

    async getOrgClients(): Promise<any[]> {
        const { data, error } = await supabase.rpc('get_org_clients');
        if (error) throw error;
        return data || [];
    },

    async requestDataExport(): Promise<{ export_id: string; message: string }> {
        const { data, error } = await supabase.rpc('request_data_export');
        if (error) throw error;
        return { export_id: data, message: 'Export queued successfully.' };
    },

    async getExportStatus(): Promise<any> {
        const { data, error } = await supabase.functions.invoke('privacy-api', {
            method: 'GET'
        });
        if (error || data?.error) throw data?.error || error;
        return data;
    },

    async getStaffMembers(organizationId: string): Promise<StaffMember[]> {
        if (!organizationId) return [];
        const { data, error } = await supabase.rpc('get_staff_members');
        if (error) throw error;
        return data || [];
    },

    async getClientLifecycle(organizationId: string): Promise<ClientLifecycle[]> {
        if (!organizationId) return [];
        const { data, error } = await supabase
            .from('client_lifecycle_view')
            .select('*')
            .eq('organization_id', organizationId);
        if (error) throw error;
        return data || [];
    },

    async submitClientReview(organizationId: string, spaceId: string, rating: number, comment?: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { data: null, error: { message: 'Not authenticated' } };
        const { data, error } = await supabase
            .from('client_reviews')
            .insert({
                organization_id: organizationId,
                space_id: spaceId,
                client_id: user.id,
                rating,
                comment
            });
        return { data, error };
    },

    async getUnassignedStaffSummary(): Promise<any[]> {
        const { data, error } = await supabase.rpc('get_unassigned_staff_summary');
        if (error) throw error;
        return data || [];
    },

    async updateStaffCapability(staffUserId: string, spaceId: string, enabled: boolean) {
        const { error } = await supabase.rpc('update_staff_capability', {
            p_staff_user_id: staffUserId,
            p_space_id: spaceId,
            p_enabled: enabled
        });
        if (error) throw error;
    },

    // --- Messaging ---
    async getMessages(spaceId: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke(`messaging-api?spaceId=${spaceId}&limit=50`, {
            method: 'GET'
        });
        if (error || data?.error) return { data: [], error: data?.error || error };
        return { data: data?.data || [], error: null };
    },

    async sendMessage(spaceId: string, content: string, extension: string = 'chat', payload: any = {}, channel: 'general' | 'internal' = 'general', organizationId: string) {
        const { data, error } = await supabase.functions.invoke('messaging-api', {
            method: 'POST',
            body: { 
                spaceId, 
                content, 
                extension, 
                payload, 
                channel,
                idempotencyKey: crypto.randomUUID()
            }
        });

        if (error) return { data: null, error: { message: error.message } };
        if (data?.error) return { data: null, error: data.error };
        return { data: data?.data, error: null };
    },

    // --- Tasks ---
    async getTasks(organizationId: string, spaceId?: string) {
        if (!organizationId) return { data: [], error: { message: 'organization_id is required' } };

        if (spaceId) {
            return this.listTasks(spaceId);
        }

        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        if (error) return { data: null, error };
        return { data: data || [], error: null };
    },

    async listTasks(spaceId: string, filters: { priority?: string, search?: string } = {}) {
        const { data, error } = await supabase.rpc('list_tasks', {
            p_space_id: spaceId,
            p_priority: filters.priority,
            p_search: filters.search
        });

        if (error) return { data: null, error };
        return { data: data || [], error: null };
    },

    async createTask(data: any, organizationId: string) {
        const { data: res, error } = await supabase.functions.invoke('tasks-api', {
            method: 'POST',
            body: { ...data, organization_id: organizationId }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to create task' } };
        return { data: res, error: null };
    },

    async updateTask(id: string, updates: any, _organizationId?: string) {
        const { data, error } = await supabase
            .from('tasks')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) return { data: null, error };
        return { data: data || null, error: null };
    },

    async reorderTask(taskId: string, beforeId?: string | null, afterId?: string | null) {
        const { data, error } = await supabase.rpc('reorder_task', {
            p_task_id: taskId,
            p_before_id: beforeId,
            p_after_id: afterId
        });

        if (error) return { data: null, error };
        return { data, error: null };
    },
    async getMeetings(organizationId: string, spaceId?: string) {
        if (!organizationId) return { data: [], error: { message: 'organization_id is required' } };
        try {
            const { data, error } = await supabase.rpc('list_meetings_v2', {
                p_space_id: spaceId || null
            });
            
            if (error) return { data: null, error };
            return { data: data || [], error: null };
        } catch (err) {
            return { data: null, error: { message: err.message } };
        }
    },

    async scheduleMeeting(data: { title: string; starts_at: string; duration_minutes?: number; space_id: string; description?: string; recording_enabled?: boolean; category?: string }) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: {
                action: 'CREATE_SCHEDULED_MEETING',
                space_id: data.space_id,
                title: data.title,
                starts_at: data.starts_at,
                duration_minutes: data.duration_minutes,
                description: data.description,
                recording_enabled: data.recording_enabled,
                category: data.category
            }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to schedule meeting' } };

        // New response: { data: meeting }
        const result = res?.data ?? res;
        return { data: result, error: null };
    },

    async createInstantMeeting(params: { space_id: string; title?: string; description?: string; recording_enabled?: boolean; category?: string }) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { 
                action: 'CREATE_INSTANT_MEETING', 
                space_id: params.space_id,
                title: params.title,
                description: params.description,
                recording_enabled: params.recording_enabled ?? true,
                category: params.category ?? 'general'
            }
        });
        if (error) return { data: null, error: { message: error.message } };
        if (data?.error) return { data: null, error: data.error };
        
        // result.data.data.meeting and result.data.data.roomUrl
        const result = data?.data ?? data;
        return { data: result, error: null };
    },

    async startMeeting(meetingId: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'START_MEETING', meetingId }
        });
        if (error) return { data: null, error: { message: error.message } };
        if (data?.error) return { data: null, error: data.error };
        const result = data?.data ?? data;
        return { data: result, error: null };
    },

    async joinMeeting(meetingId: string) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'JOIN_MEETING', meeting_id: meetingId }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to join meeting' } };

        // New response: { data: { token, roomUrl, meeting } }
        const result = res?.data ?? res;
        return { data: result, error: null };
    },

    async getMeetingToken(meetingId: string) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'GET_TOKEN', meeting_id: meetingId }
        });
        if (error) return { data: null, error: { message: error.message } };
        if (res?.error) return { data: null, error: res.error };

        // New response: { data: { token, roomUrl, meetingId } }
        const result = res?.data ?? res;
        return { data: result, error: null };
    },

    async recordParticipantExit(meetingId: string) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'RECORD_PARTICIPANT_EXIT', meeting_id: meetingId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to record exit' } };
        return { data, error: null };
    },

    async updateMeeting(meetingId: string, updates: any) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'UPDATE_MEETING', meeting_id: meetingId, updates }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to update meeting' } };
        return { data, error: null };
    },

    async stopMeeting(meetingId: string) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            // Task 3C expects meetingId (camelCase). Backend will validate access + end meeting.
            body: { action: 'END_MEETING', meetingId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to stop meeting' } };
        return { data, error: null };
    },

    async cancelMeeting(meetingId: string) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'DELETE_MEETING', meeting_id: meetingId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to cancel meeting' } };
        return { data, error: null };
    },

    async endMeetingByStaff(meetingId: string, outcome: string, outcomeNotes?: string) {
        const { data, error } = await supabase.rpc('end_meeting_by_staff', {
            p_meeting_id: meetingId,
            p_outcome: outcome,
            p_outcome_notes: outcomeNotes ?? null
        });
        if (error) return { data: null, error };
        return { data, error: null };
    },

    async getMeetingDetail(meetingId: string) {
        const { data, error } = await supabase.rpc('get_meeting_detail', {
            p_meeting_id: meetingId
        });
        if (error) return { data: null, error };
        return { data, error: null };
    },


    // --- Files ---
    async getFiles(organizationId: string, spaceId?: string) {
        if (!organizationId) return { data: [], error: { message: 'organization_id is required' } };
        let query = supabase
            .from('files')
            .select('*')
            .eq('organization_id', organizationId)
            // Only fetch latest versions (or unversioned) at the top level
            .order('created_at', { ascending: false });

        if (spaceId) {
            query = query.eq('space_id', spaceId);
        }

        const { data, error } = await query;
        if (error) return { data: null, error };
        
        // In the UI, we only want to list the LATEST version of each file tree
        // If a file has a parent_id, it's part of a version tree.
        return { data: data || [], error: null };
    },

    async getTrashFiles(spaceId?: string) {
        const rpcArgs = spaceId ? { p_space_id: spaceId } : {};
        const { data, error } = await supabase.rpc('get_trash_files', rpcArgs);
        return { data: data || [], error };
    },

    async getFileVersions(fileId: string, parentId?: string) {
        const rootId = parentId || fileId;
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('id', rootId)
            .order('created_at', { ascending: false });
        
        return { data: data || [], error };
    },

    async getSignedUrl(file_id: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'SIGN_URL', file_id, organization_id: organizationId }
        });
        if (error) return { data: null, error: { message: error.message } };
        if (data?.error) return { data: null, error: data.error };
        
        const result = data?.data ?? data;
        const signedUrl = result?.signedUrl || result?.signed_url;
        if (!signedUrl) return { data: null, error: { message: 'No signed URL returned' } };
        return { data: { signedUrl }, error: null };
    },

    async registerFileMetadata(metadata: any, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'REGISTER_METADATA', metadata, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to register metadata' } };
        return { data, error: null };
    },

    async requestUploadVoucher(space_id: string, organizationId: string, file_name: string, content_type: string, checksum?: string, file_size?: number) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: {
                action: 'REQUEST_UPLOAD_VOUCHER',
                space_id,
                file_name,
                content_type,
                file_size: file_size?.toString(),
                checksum,
                organization_id: organizationId
            }
        });

        if (error) return { data: null, error: { message: error.message } };
        if (data?.error) return { data: null, error: data.error };

        const voucher = data?.data ?? data;
        if (!voucher?.upload_url) return { data: null, error: { message: 'No upload URL in response' } };
        return { data: voucher, error: null };
    },

    async requestNewVersion(fileId: string, organizationId: string, filename: string, contentType: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'REQUEST_NEW_VERSION', file_id: fileId, file_name: filename, content_type: contentType, organization_id: organizationId }
        });

        if (error || data?.error) {
            console.error('❌ [requestNewVersion] Error:', error || data?.error);
            return { data: null, error: data?.error || { message: error?.message || 'Failed to request version voucher' } };
        }
        return { data, error: null };
    },

    async getSignedFileUrl(file_id: string, organizationId: string) {
        return this.getSignedUrl(file_id, organizationId);
    },

    async confirmUpload(file_id: string, organizationId: string, storagePath?: string, checksum?: string, fileSize?: number) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'CONFIRM_UPLOAD', file_id, organization_id: organizationId, storage_path: storagePath, checksum, file_size: fileSize }
        });

        if (error || data?.error) {
            console.error('❌ [confirmUpload] Error:', error || data?.error);
            return { data: null, error: data?.error || { message: error?.message || 'Failed to confirm upload' } };
        }
        return { data: data?.data || data, error: null };
    },


    async uploadFile(spaceId: string, organizationId: string, file: File, onProgress?: (progress: number) => void) {
        console.log('🚀 Starting Upload Process for:', file.name);

        // 1. Calculate Checksum
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 2. Get Upload Voucher
        console.log('Step 1: Requesting Voucher...');
        const { data: voucher, error: voucherError } = await this.requestUploadVoucher(spaceId, organizationId, file.name, file.type, checksum, file.size);

        if (voucherError || (!voucher?.upload_url && !voucher?.storage_path)) {
            console.error('❌ Voucher Request Failed:', voucherError);
            throw new Error(voucherError?.message || 'Failed to get upload voucher');
        }

        // 3. Upload directly to storage
        console.log('Step 2: Uploading to Storage...', voucher.upload_url);

        try {
            const canUseResumableUpload = file.size > STANDARD_UPLOAD_MAX_BYTES && !!voucher.storage_path;

            if (canUseResumableUpload) {
                await uploadFileResumable(file, voucher.storage_path, onProgress);
            } else {
                await uploadFileStandard(file, voucher.storage_path || voucher.path || file.name, onProgress);
                /* await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('PUT', voucher.upload_url);
                    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

                    xhr.upload.onprogress = (event) => {
                        if (!event.lengthComputable) return;
                        onProgress?.(Math.round((event.loaded / event.total) * 100));
                    };

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            onProgress?.(100);
                            resolve();
                            return;
                        }

                        console.error('❌ PUT Request Failed:', xhr.status, xhr.statusText);
                        reject(new Error(`Upload failed with status ${xhr.status}`));
                    };

                    xhr.onerror = () => reject(new Error('Upload failed due to a network error'));
                    xhr.send(file);
                }); */
            }
            console.log('✅ Storage Upload Complete');
        } catch (uploadErr) {
            console.error('❌ Storage Network Error:', uploadErr);
            throw uploadErr;
        }

        // 4. Confirm upload with backend
        console.log('Step 3: Confirming Upload...');
        const { data: fileData, error: confirmError } = await this.confirmUpload(
            voucher.file_id,
            organizationId,
            voucher.storage_path,
            checksum,
            file.size
        );

        if (confirmError) {
            console.error('❌ Confirmation Failed:', confirmError);
            throw confirmError;
        }

        console.log('🎉 Upload Workflow Complete!');
        return fileData;
    },

    async uploadFileVersion(fileId: string, organizationId: string, file: File) {
        // 1. Calculate Checksum
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 2. Request version voucher
        const { data: voucher, error: voucherError } = await this.requestNewVersion(fileId, organizationId, file.name, file.type);
        if (voucherError) throw voucherError;

        // 3. Upload to new path
        if (file.size > STANDARD_UPLOAD_MAX_BYTES && voucher.storage_path) {
            await uploadFileResumable(file, voucher.storage_path);
        } else {
            await uploadFileStandard(file, voucher.storage_path || voucher.path || file.name);
            /* const uploadResponse = await fetch(voucher.upload_url, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type || 'application/octet-stream'
                }
            });

            if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.status}`); */
        }

        // 4. Confirm version replacement
        const { data: fileData, error: confirmError } = await this.confirmUpload(voucher.file_id, organizationId, voucher.storage_path, checksum, file.size);
        if (confirmError) throw confirmError;

        return fileData;
    },


    async deleteFile(file_id: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'SOFT_DELETE', file_id, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to delete file' } };
        return { data, error: null };
    },

    async restoreFile(file_id: string, organizationId: string) {
        const { data, error } = await supabase.rpc('restore_file', {
            p_file_id: file_id
        });
        if (error) return { data: null, error: { message: error.message || 'Failed to restore file' } };
        return { data, error: null };
    },

    async hardDeleteFile(file_id: string, organizationId: string) {
        const { data, error } = await supabase.rpc('permanent_delete_file', {
            p_file_id: file_id
        });

        if (error) {
            if (error.message?.includes('FILE_NOT_IN_TRASH')) {
                return { data: null, error: { message: 'This file is not in the trash and cannot be permanently deleted.' } };
            }
            if (error.message?.includes('FILE_LEGAL_HOLD')) {
                return { data: null, error: { message: 'This file is under legal hold and cannot be deleted.' } };
            }
            return { data: null, error: { message: error.message || 'Failed to permanently delete file' } };
        }

        const storagePath = data?.storage_path;
        if (storagePath) {
            const { error: storageError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .remove([storagePath]);

            if (storageError) {
                console.warn('Storage object deletion failed after DB delete:', storageError);
            }
        }

        return { data, error: null };
    }
};

export async function getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession();

    const headers: Record<string, string> = {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${session?.access_token || ANON_KEY}`
    };

    return headers;
}
