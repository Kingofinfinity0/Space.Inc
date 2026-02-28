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
        payment_session_id?: string;
    }) {
        if (!data.password) {
            return { data: null, error: { message: 'Password is required' } };
        }

        let resultData = null;
        let resultError = null;

        if (data.action === 'signup') {
            const { data: authData, error } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        full_name: data.full_name,
                        organization_name: data.organization_name
                    }
                }
            });
            resultData = authData;
            resultError = error;
        } else {
            const { data: authData, error } = await supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password
            });
            resultData = authData;
            resultError = error;
        }

        if (resultError) {
            console.error('Native Auth Error:', resultError);
            return { data: null, error: { message: resultError.message } };
        }

        // Return shape matching the previous expected format for AuthContext
        return {
            data: {
                success: true,
                session: resultData?.session,
                user: resultData?.user,
                data: { session: resultData?.session } // Compatibility
            },
            error: null
        };
    },

    async logout() {
        const { error } = await supabase.auth.signOut();
        return { error };
    },

    async exchangeOAuth(provider: string, token: string) {
        // This traditionally would call an auth-api to exchange a provider token for a system session.
        // For now, we sync with Supabase and return the session.
        const { data, error } = await supabase.auth.getSession();
        if (error) return { data: null, error };

        return {
            data: {
                session: data.session,
                user: data.session?.user
            },
            error: null
        };
    },

    async refreshToken(sessionId: string, refreshToken: string) {
        const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
        if (error) return { data: null, error };

        return {
            data: {
                session: data.session,
                user: data.session?.user
            },
            error: null
        };
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
        const { data, error } = await supabase.functions.invoke('profile-api', {
            method: 'GET'
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to fetch profile' } };
        return { data: data?.data || data, error: null };
    },

    async updateProfile(updates: { full_name?: string; avatar_url?: string; phone?: string }) {
        const { data, error } = await supabase.functions.invoke('profile-api', {
            method: 'PATCH',
            body: updates
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to update profile' } };
        return { data, error: null };
    },

    async getCapabilityLens() {
        const { data, error } = await supabase.rpc('get_capability_lens');
        if (error) return { data: null, error };
        return { data, error: null };
    },

    // --- Spaces (SaaS Hardening V2 — RPC Backed) ---
    async getSpaces() {
        const { data, error } = await supabase.functions.invoke('createspace-api', {
            method: 'GET'
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to fetch spaces' } };
        return { data: data?.data || [], error: null };
    },

    async createSpace(data: { name: string; description?: string; modules?: any }) {
        const { data: result, error } = await supabase.functions.invoke('createspace-api', {
            method: 'POST',
            body: data
        });
        if (error || result?.error) return { data: null, error: result?.error || { message: error?.message || 'Failed to create space' } };
        return { data: result?.data, error: null };
    },

    async updateSpace(spaceId: string, updates: any) {
        const { data, error } = await supabase.functions.invoke('createspace-api', {
            method: 'PATCH',
            body: { action: 'update', space_id: spaceId, data: updates }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to update space' } };
        return { data: data?.data, error: null };
    },

    async archiveSpace(spaceId: string, reason?: string) {
        const { data, error } = await supabase.functions.invoke('createspace-api', {
            method: 'PATCH',
            body: { action: 'archive', space_id: spaceId, reason }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to archive space' } };
        return { data: data?.data, error: null };
    },

    async deleteSpace(spaceId: string) {
        const { data, error } = await supabase.functions.invoke('createspace-api', {
            method: 'DELETE',
            body: { space_id: spaceId }
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
        email?: string,
        role: 'staff' | 'client' = 'client'
    ) {
        if (!email) {
            return { data: null, error: { message: 'Email is required' } };
        }

        const { data, error } = await supabase.rpc('invite_user_secure', {
            p_email: email.toLowerCase().trim(),
            p_role: role,
            p_space_id: spaceId
        });

        if (error) {
            // Classify database-level errors for UI consumption
            const msg = error.message || '';
            if (msg.includes('Insufficient capability')) {
                return { data: null, error: { message: 'You do not have permission to invite this role.', code: 'CAPABILITY_DENIED' } };
            }
            if (msg.includes('Active invite already exists')) {
                return { data: null, error: { message: 'An active invitation already exists for this email.', code: 'DUPLICATE_INVITE' } };
            }
            if (msg.includes('Rate limit exceeded')) {
                return { data: null, error: { message: 'Too many invites sent recently. Please try again later.', code: 'RATE_LIMITED' } };
            }
            if (msg.includes('Not authenticated')) {
                return { data: null, error: { message: 'You must be logged in to send invitations.', code: 'UNAUTHENTICATED' } };
            }
            return { data: null, error: { message: msg || 'Failed to send invitation.' } };
        }

        // Returns: { invite_id, email, status: 'pending' }
        // Email is dispatched asynchronously by the process-notifications worker via Resend
        return { data, error: null };
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

    async acceptInvitation(token: string) {
        return await supabase.functions.invoke('invitations-api', {
            method: 'POST',
            body: { action: 'accept', token }
        });
    },

    // --- Activity Logs ---
    async getActivityLogs(spaceId?: string) {
        const slug = spaceId ? `activity-logs-api?spaceId=${spaceId}` : 'activity-logs-api';
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
        // We'll call the Edge Function for this as it might need to generate signed URLs
        const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/privacy-api`, {
            method: 'GET',
            headers: await this.getAuthHeader()
        });
        if (!response.ok) throw new Error('Failed to fetch export status');
        return response.json();
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
        const { data, error } = await supabase.functions.invoke(`messaging-api?spaceId=${spaceId}`, {
            method: 'GET'
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to fetch messages' } };
        return { data: data?.data || data, error: null };
    },

    async sendMessage(spaceId: string, orgId: string, content: string, extension: string = 'chat', payload: any = {}, channel: 'general' | 'internal' = 'general') {
        const { data, error } = await supabase.functions.invoke('messaging-api', {
            method: 'POST',
            body: { space_id: spaceId, org_id: orgId, content, extension, payload, channel }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to send message' } };
        return { data: data?.data || data, error: null };
    },

    // --- Tasks ---
    async getTasks(spaceId?: string) {
        const slug = spaceId ? `tasks-api?spaceId=${spaceId}` : 'tasks-api';
        const { data, error } = await supabase.functions.invoke(slug, {
            method: 'GET'
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to fetch tasks' } };
        return { data: data?.data || data || [], error: null };
    },

    async createTask(data: any) {
        const { data: res, error } = await supabase.functions.invoke('tasks-api', {
            method: 'POST',
            body: data
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to create task' } };
        return { data: res, error: null };
    },

    async updateTask(id: string, updates: any) {
        const { data, error } = await supabase.functions.invoke('tasks-api', {
            method: 'PATCH',
            body: { id, ...updates }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to update task' } };
        return { data, error: null };
    },

    // --- Meetings ---
    async getMeetings(spaceId?: string) {
        const slug = spaceId ? `meetings-api?spaceId=${spaceId}` : 'meetings-api';
        const { data, error } = await supabase.functions.invoke(slug, {
            method: 'GET'
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to fetch meetings' } };
        return { data: data?.data || data || [], error: null };
    },

    async scheduleMeeting(data: { title: string; starts_at: string; duration_minutes?: number; space_id: string; description?: string; recording_enabled?: boolean }) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'CREATE_SCHEDULED_MEETING', ...data }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to schedule meeting' } };
        return { data: res?.data || res, error: null };
    },

    async createInstantMeeting(data: { space_id: string; title?: string; description?: string; recording_enabled?: boolean }) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'CREATE_INSTANT_MEETING', ...data }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to create instant meeting' } };
        return { data: res?.data || res, error: null };
    },

    async startMeeting(meetingId: string) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'START_MEETING', meetingId }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to start meeting' } };
        return { data: res?.data || res, error: null };
    },

    async joinMeeting(meetingId: string) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'JOIN_MEETING', meetingId }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to join meeting' } };
        return { data: res?.data || res, error: null };
    },

    async getMeetingToken(meetingId: string) {
        const { data: res, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'GET_TOKEN', meetingId }
        });
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to fetch meeting token' } };
        return { data: res?.data || res, error: null };
    },

    async updateMeeting(meetingId: string, updates: any) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'UPDATE_MEETING', meetingId, updates }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to update meeting' } };
        return { data, error: null };
    },

    async stopMeeting(meetingId: string) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'END_MEETING', meetingId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to stop meeting' } };
        return { data, error: null };
    },

    async cancelMeeting(meetingId: string) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'DELETE_MEETING', meetingId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to cancel meeting' } };
        return { data, error: null };
    },


    // --- Files ---
    async getFiles(spaceId?: string) {
        const slug = spaceId ? `files-api?spaceId=${spaceId}` : 'files-api';
        const { data, error } = await supabase.functions.invoke(slug, {
            method: 'GET'
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to fetch files' } };
        return { data: data?.data || data || [], error: null };
    },

    async getSignedUrl(fileId: string, orgId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'SIGN_URL', fileId, orgId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to get signed URL' } };
        return { data, error: null };
    },

    async registerFileMetadata(metadata: any) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'REGISTER_METADATA', metadata }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to register metadata' } };
        return { data, error: null };
    },

    async requestUploadVoucher(spaceId: string, orgId: string, filename: string, contentType: string, checksum?: string, fileSize?: number) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: {
                action: 'REQUEST_UPLOAD_VOUCHER',
                spaceId,
                orgId,
                filename,
                contentType,
                checksum,
                fileSize
            }
        });

        if (error || data?.error) {
            console.error('❌ [requestUploadVoucher] Error:', error || data?.error);
            return { data: null, error: data?.error || { message: error?.message || 'Failed to request upload voucher' } };
        }
        return { data, error: null };
    },

    async requestNewVersion(fileId: string, filename: string, contentType: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'REQUEST_NEW_VERSION', fileId, filename, contentType }
        });

        if (error || data?.error) {
            console.error('❌ [requestNewVersion] Error:', error || data?.error);
            return { data: null, error: data?.error || { message: error?.message || 'Failed to request version voucher' } };
        }
        return { data, error: null };
    },

    async getSignedFileUrl(fileId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'SIGN_URL', fileId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to get signed URL' } };
        return { data, error: null };
    },

    async confirmUpload(fileId: string, orgId: string, storagePath?: string, checksum?: string, fileSize?: number) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'CONFIRM_UPLOAD', fileId, orgId, storagePath, checksum, fileSize }
        });

        if (error || data?.error) {
            console.error('❌ [confirmUpload] Error:', error || data?.error);
            return { data: null, error: data?.error || { message: error?.message || 'Failed to confirm upload' } };
        }
        return { data: data?.data || data, error: null };
    },


    async uploadFile(spaceId: string, orgId: string, file: File) {
        console.log('🚀 Starting Upload Process for:', file.name);

        // 1. Calculate Checksum
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 2. Get Upload Voucher
        console.log('Step 1: Requesting Voucher...');
        const { data: voucher, error: voucherError } = await this.requestUploadVoucher(spaceId, orgId, file.name, file.type, checksum, file.size);

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
        const { data: fileData, error: confirmError } = await this.confirmUpload(voucher.file_id, orgId);

        if (confirmError) {
            console.error('❌ Confirmation Failed:', confirmError);
            throw confirmError;
        }

        console.log('🎉 Upload Workflow Complete!');
        return fileData;
    },

    async uploadFileVersion(fileId: string, orgId: string, file: File) {
        // 1. Calculate Checksum
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 2. Request version voucher
        const { data: voucher, error: voucherError } = await this.requestNewVersion(fileId, file.name, file.type);
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
        const { data: fileData, error: confirmError } = await this.confirmUpload(voucher.file_id, orgId, voucher.storage_path, checksum, file.size);
        if (confirmError) throw confirmError;

        return fileData;
    },


    async deleteFile(fileId: string, orgId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'SOFT_DELETE', fileId, orgId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to delete file' } };
        return { data, error: null };
    },

    async restoreFile(fileId: string, orgId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'RESTORE', fileId, orgId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to restore file' } };
        return { data, error: null };
    },

    async hardDeleteFile(fileId: string, orgId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'HARD_DELETE', fileId, orgId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to permanently delete file' } };
        return { data, error: null };
    }
};

/**
 * Helper to retrieve current session and format Authorization header.
 * Use ONLY for direct fetch() calls (e.g. file uploads to storage).
 */
export async function getAuthHeader(optional: boolean = false) {
    const defaultHeaders: Record<string, string> = {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
    };

    const isTokenExpired = (token: string) => {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return (payload.exp * 1000) < Date.now();
        } catch (e) {
            return true;
        }
    };

    // 1. Try Native Supabase Session
    let { data: { session } } = await supabase.auth.getSession();

    // If native session exists but is expired, try a quick refresh
    if (session && isTokenExpired(session.access_token)) {
        console.log("[getAuthHeader] Native sync token expired, attempting refresh for fetch...");
        const { data } = await supabase.auth.refreshSession();
        session = data.session;
    }

    if (session?.access_token && !isTokenExpired(session.access_token)) {
        return {
            ...defaultHeaders,
            'Authorization': `Bearer ${session.access_token}`
        };
    }

    // 2. Fallback to LocalStorage (Custom Auth fallback)
    try {
        const stored = localStorage.getItem('space_session');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.access_token) {
                if (!isTokenExpired(parsed.access_token)) {
                    return {
                        ...defaultHeaders,
                        'Authorization': `Bearer ${parsed.access_token}`
                    };
                } else if (parsed.refresh_token && parsed.session_id) {
                    console.log("[getAuthHeader] Local sync token expired, attempting refresh for fetch...");
                    const { data: refreshed } = await supabase.auth.refreshSession({ refresh_token: parsed.refresh_token });
                    if (refreshed.session) {
                        return {
                            ...defaultHeaders,
                            'Authorization': `Bearer ${refreshed.session.access_token}`
                        };
                    }
                }
            }
        }
    } catch (e) { }

    return defaultHeaders;
}
