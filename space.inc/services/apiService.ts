import { supabase, EDGE_FUNCTION_BASE_URL, ANON_KEY } from '../lib/supabase';
import { StaffMember, ClientLifecycle } from '../types';

/**
 * apiService.ts - The bridge between Frontend and "Industrial Grade" Edge Functions
 */

export const apiService = {
    // --- Auth & Onboarding (Native Architecture) ---
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
        return { data: data || {}, error: null };
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

    // --- Spaces (Direct Supabase Access) ---
    async getSpaces() {
        const { data, error } = await supabase
            .from('spaces')
            .select('*')
            .order('created_at', { ascending: false });
        
        return { data: data || [], error: error };
    },

    async createSpace(data: { name: string; description?: string; modules?: any; metadata?: any; organizationId: string }) {
        const { data: result, error } = await supabase.functions.invoke('createspace-api', {
            method: 'POST',
            body: { ...data, organization_id: data.organizationId }
        });
        if (error || result?.error) return { data: null, error: result?.error || { message: error?.message || 'Failed to create space' } };
        return { data: result?.data, error: null };
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
    async sendInvitation(
        spaceId: string,
        organizationId: string,
        email?: string,
        role: 'staff' | 'client' = 'client'
    ) {
        if (!email) {
            return { data: null, error: { message: 'Email is required' } };
        }

        const { data, error } = await supabase.functions.invoke('invitations-api', {
            method: 'POST',
            body: {
                action: 'send',
                email: email.toLowerCase().trim(),
                role: role,
                space_id: spaceId,
                organization_id: organizationId
            }
        });

        if (error || data?.error) {
            const err = data?.error || error;
            const msg = err.message || '';
            if (msg.includes('Insufficient capability')) {
                return { data: null, error: { message: 'You do not have permission to invite this role.', code: 'CAPABILITY_DENIED' } };
            }
            if (msg.includes('Active invite already exists')) {
                return { data: null, error: { message: 'An active invitation already exists for this email.', code: 'DUPLICATE_INVITE' } };
            }
            return { data: null, error: { message: msg || 'Failed to send invitation.' } };
        }

        return { data: data?.data || data, error: null };
    },

    /**
     * Lists pending invitations for a given space.
     * Subject to RLS: only visible to space members.
     */
    async getInvitations(spaceId: string) {
        const { data, error } = await supabase
            .from('invitations')
            .select('id, email, role, status, expires_at, created_at, invited_by')
            .eq('space_id', spaceId)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) return { data: null, error };
        return { data: data ?? [], error: null };
    },

    async acceptInvitation(token: string, organizationId: string) {
        return await supabase.functions.invoke('invitations-api', {
            method: 'POST',
            body: { action: 'accept', token, organization_id: organizationId }
        });
    },

    // --- Invitation System V3 (Supabase Native) ---
    async sendStaffInvitation(email: string, role: string, spaceAssignments: any[]) {
        const { data, error } = await supabase.rpc('send_staff_invitation', {
            email,
            role,
            space_assignments: spaceAssignments
        });
        return { data, error };
    },

    async sendClientInvitation2(email: string, spaceId: string) {
        const { data, error } = await supabase.rpc('send_client_invitation', {
            email,
            space_id: spaceId
        });
        return { data, error };
    },

    async validateInvitationContext(invitationId: string) {
        const { data, error } = await supabase.rpc('validate_invitation_context', {
            invitation_id: invitationId
        });
        return { data, error };
    },

    async acceptInvitation2(invitationId: string) {
        // accepting_user_id is auth.uid() automatically injected by Supabase, 
        // wait, accept_invitation signature in PG requires accepting_user_id !
        // Let's pass it by calling auth.getUser()
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not logged in");

        const { data, error } = await supabase.rpc('accept_invitation', {
            accepting_user_id: user.id,
            invitation_id: invitationId
        });
        return { data, error };
    },

    // --- Activity Logs ---
    async getActivityLogs(spaceId?: string) {
        const slug = spaceId ? `activity-logs-api?space_id=${spaceId}` : 'activity-logs-api';
        const { data, error } = await supabase.functions.invoke(slug, {
            method: 'GET'
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to fetch activity logs' } };
        return { data: data?.data || data || [], error: null };
    },

    async getUnifiedInbox(): Promise<any[]> {
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

    async getStaffMembers(): Promise<StaffMember[]> {
        const { data, error } = await supabase.rpc('get_staff_members');
        if (error) throw error;
        return data || [];
    },

    async getClientLifecycle(): Promise<ClientLifecycle[]> {
        const { data, error } = await supabase
            .from('client_lifecycle_view')
            .select('*');
        if (error) throw error;
        return data || [];
    },

    async getUnassignedStaffSummary(): Promise<any[]> {
        const { data, error } = await supabase.rpc('get_unassigned_staff_summary');
        if (error) throw error;
        return data || [];
    },

    async updateStaffCapability(staffId: string, spaceId: string, capKey: string, allowed: boolean): Promise<void> {
        const { error } = await supabase
            .from('staff_space_capabilities')
            .upsert({
                staff_id: staffId,
                space_id: spaceId,
                capability_key: capKey,
                allowed: allowed
            }, { onConflict: 'staff_id,space_id,capability_key' });
        if (error) throw error;
    },

    // --- Messaging ---
    async getMessages(spaceId: string) {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('space_id', spaceId)
            .order('created_at', { ascending: true });
        return { data: data || [], error };
    },

    async sendMessage(spaceId: string, content: string, extension: string = 'chat', payload: any = {}, channel: 'general' | 'internal' = 'general', organizationId?: string) {
        const { data, error } = await supabase
            .from('messages')
            .insert({
                space_id: spaceId,
                content,
                extension,
                payload,
                channel
            })
            .select()
            .single();
        return { data, error };
    },

    // --- Tasks ---
    async getTasks(spaceId?: string) {
        let query = supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false });

        if (spaceId) {
            query = query.eq('space_id', spaceId);
        }

        const { data, error } = await query;
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

    async updateTask(id: string, updates: any, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('tasks-api', {
            method: 'PATCH',
            body: { task_id: id, ...updates, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to update task' } };
        return { data, error: null };
    },

    // --- Meetings ---
    async getMeetings(spaceId?: string) {
        let query = supabase
            .from('meetings')
            .select('*')
            .order('starts_at', { ascending: true });

        if (spaceId) {
            query = query.eq('space_id', spaceId);
        }

        const { data, error } = await query;
        if (error) return { data: null, error };
        return { data: data || [], error: null };
    },

    async scheduleMeeting(data: { title: string; starts_at: string; duration_minutes?: number; space_id: string; description?: string; recording_enabled?: boolean; organizationId: string }) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'CREATE_SCHEDULED_MEETING', ...data, organization_id: data.organizationId }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to schedule meeting' } };
        return { data: res?.data || res, error: null };
    },

    async createInstantMeeting(data: { space_id: string; title?: string; description?: string; recording_enabled?: boolean; organizationId: string }) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'CREATE_INSTANT_MEETING', ...data, organization_id: data.organizationId }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to create instant meeting' } };
        return { data: res?.data || res, error: null };
    },

    async startMeeting(meetingId: string, organizationId: string) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'START_MEETING', meeting_id: meetingId, organization_id: organizationId }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to start meeting' } };
        return { data: res?.data || res, error: null };
    },

    async joinMeeting(meetingId: string, organizationId: string) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'JOIN_MEETING', meeting_id: meetingId, organization_id: organizationId }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to join meeting' } };
        return { data: res?.data || res, error: null };
    },

    async getMeetingToken(meetingId: string, organizationId: string) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'GET_TOKEN', meeting_id: meetingId, organization_id: organizationId }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to fetch meeting token' } };
        return { data: res?.data || res, error: null };
    },

    async updateMeeting(meetingId: string, updates: any, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'UPDATE_MEETING', meeting_id: meetingId, updates, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to update meeting' } };
        return { data, error: null };
    },

    async stopMeeting(meetingId: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'END_MEETING', meeting_id: meetingId, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to stop meeting' } };
        return { data, error: null };
    },

    async cancelMeeting(meetingId: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'DELETE_MEETING', meeting_id: meetingId, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to cancel meeting' } };
        return { data, error: null };
    },


    // --- Files ---
    async getFiles(spaceId?: string) {
        let query = supabase
            .from('files')
            .select('*')
            .order('created_at', { ascending: false });

        if (spaceId) {
            query = query.eq('space_id', spaceId);
        }

        const { data, error } = await query;
        if (error) return { data: null, error };
        return { data: data || [], error: null };
    },

    async getSignedUrl(fileId: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'SIGN_URL', file_id: fileId, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to get signed URL' } };
        return { data, error: null };
    },

    async registerFileMetadata(metadata: any, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'REGISTER_METADATA', metadata, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to register metadata' } };
        return { data, error: null };
    },

    async requestUploadVoucher(spaceId: string, organizationId: string, filename: string, contentType: string, checksum?: string, fileSize?: number) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: {
                action: 'REQUEST_UPLOAD_VOUCHER',
                space_id: spaceId,
                organization_id: organizationId,
                file_name: filename,
                content_type: contentType,
                checksum,
                file_size: fileSize
            }
        });

        if (error || data?.error) {
            console.error('❌ [requestUploadVoucher] Error:', error || data?.error);
            return { data: null, error: data?.error || { message: error?.message || 'Failed to request upload voucher' } };
        }
        return { data, error: null };
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

    async getSignedFileUrl(fileId: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'SIGN_URL', file_id: fileId, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to get signed URL' } };
        return { data, error: null };
    },

    async confirmUpload(fileId: string, organizationId: string, storagePath?: string, checksum?: string, fileSize?: number) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'CONFIRM_UPLOAD', file_id: fileId, organization_id: organizationId, storage_path: storagePath, checksum, file_size: fileSize }
        });

        if (error || data?.error) {
            console.error('❌ [confirmUpload] Error:', error || data?.error);
            return { data: null, error: data?.error || { message: error?.message || 'Failed to confirm upload' } };
        }
        return { data: data?.data || data, error: null };
    },


    async uploadFile(spaceId: string, organizationId: string, file: File) {
        console.log('🚀 Starting Upload Process for:', file.name);

        // 1. Calculate Checksum
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 2. Get Upload Voucher
        console.log('Step 1: Requesting Voucher...');
        const { data: voucher, error: voucherError } = await this.requestUploadVoucher(spaceId, organizationId, file.name, file.type, checksum, file.size);

        if (voucherError || !voucher?.upload_url) {
            console.error('❌ Voucher Request Failed:', voucherError);
            throw new Error(voucherError?.message || 'Failed to get upload voucher');
        }

        // 3. Upload directly to storage using signed URL
        console.log('Step 2: Uploading to Storage (PUT)...', voucher.upload_url);

        try {
            const uploadResponse = await fetch(voucher.upload_url, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type || 'application/octet-stream'
                }
            });

            if (!uploadResponse.ok) {
                console.error('❌ PUT Request Failed:', uploadResponse.status, uploadResponse.statusText);
                throw new Error(`Upload failed with status ${uploadResponse.status}`);
            }
            console.log('✅ Storage Upload Complete');
        } catch (uploadErr) {
            console.error('❌ Storage Network Error:', uploadErr);
            throw uploadErr;
        }

        // 4. Confirm upload with backend
        console.log('Step 3: Confirming Upload...');
        const { data: fileData, error: confirmError } = await this.confirmUpload(voucher.file_id, organizationId);

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
        const uploadResponse = await fetch(voucher.upload_url, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type || 'application/octet-stream'
            }
        });

        if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.status}`);

        // 4. Confirm version replacement
        const { data: fileData, error: confirmError } = await this.confirmUpload(voucher.file_id, organizationId, voucher.storage_path, checksum, file.size);
        if (confirmError) throw confirmError;

        return fileData;
    },


    async deleteFile(fileId: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'SOFT_DELETE', file_id: fileId, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to delete file' } };
        return { data, error: null };
    },

    async restoreFile(fileId: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'RESTORE', file_id: fileId, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to restore file' } };
        return { data, error: null };
    },

    async hardDeleteFile(fileId: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'HARD_DELETE', file_id: fileId, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to permanently delete file' } };
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
