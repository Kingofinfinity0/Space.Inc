import { ContextsResponse } from '../types/context';
import { Upload as TusUpload } from 'tus-js-client';
import { supabase, EDGE_FUNCTION_BASE_URL, ANON_KEY } from '../lib/supabase';
import { StaffMember, ClientLifecycle, Message, SpaceTaskMember, TaskStatusDefinition } from '../types';

const STANDARD_UPLOAD_MAX_BYTES = 6 * 1024 * 1024;
const RESUMABLE_CHUNK_SIZE = 6 * 1024 * 1024;
const STORAGE_BUCKET = 'space-files';

const firstRow = <T,>(data: T | T[] | null | undefined): T | null => {
    if (Array.isArray(data)) return (data[0] as T) || null;
    return (data as T) || null;
};

const getDirectStorageUploadEndpoint = () => {
    const parsedUrl = new URL(EDGE_FUNCTION_BASE_URL);
    parsedUrl.hostname = parsedUrl.hostname.replace('.supabase.co', '.storage.supabase.co');
    parsedUrl.pathname = '/storage/v1/upload/resumable';
    parsedUrl.search = '';
    return parsedUrl.toString();
};

const normalizeReactions = (raw: any) => {
    const source = raw?.reactions ?? raw?.reaction_summary ?? [];
    if (Array.isArray(source)) return source;
    if (source && typeof source === 'object') {
        return Object.entries(source).map(([emoji, value]: [string, any]) => ({
            emoji,
            count: typeof value === 'number' ? value : value?.count ?? 0,
            names: value?.names ?? [],
            users: value?.users ?? []
        }));
    }
    return [];
};

const normalizeMessage = (raw: any): Message => ({
    id: raw.id,
    spaceId: raw.spaceId ?? raw.space_id,
    organizationId: raw.organizationId ?? raw.organization_id,
    senderId: raw.senderId ?? raw.sender_id,
    senderType: raw.senderType ?? raw.sender_type ?? 'staff',
    senderName: raw.senderName ?? raw.sender_name ?? raw.full_name,
    senderAvatar: raw.senderAvatar ?? raw.sender_avatar ?? raw.avatar_url,
    content: raw.content ?? '',
    channel: raw.channel ?? 'general',
    channelId: raw.channelId ?? raw.channel_id ?? null,
    extension: raw.extension ?? 'chat',
    payload: raw.payload ?? {},
    parentId: raw.parentId ?? raw.parent_id,
    threadRootId: raw.threadRootId ?? raw.thread_root_id,
    replyCount: raw.replyCount ?? raw.reply_count ?? 0,
    reactions: normalizeReactions(raw),
    readByMe: raw.readByMe ?? raw.read_by_me,
    isMentioned: raw.isMentioned ?? raw.is_mentioned ?? false,
    mentionedUserIds: raw.mentionedUserIds ?? raw.mentioned_user_ids ?? [],
    editedAt: raw.editedAt ?? raw.edited_at ?? null,
    deletedAt: raw.deletedAt ?? raw.deleted_at ?? null,
    createdAt: raw.createdAt ?? raw.created_at,
    updatedAt: raw.updatedAt ?? raw.updated_at ?? null
});

const normalizeTaskDetail = (detail: any) => {
    if (!detail) return null;
    const task = detail.task || detail;
    return {
        ...task,
        labels: detail.labels ?? task.labels ?? [],
        comments: detail.comments ?? task.comments ?? [],
        activity: detail.activity ?? task.activity ?? [],
        relations: detail.relations ?? task.relations ?? [],
        subtasks: detail.subtasks ?? task.subtasks ?? [],
        attachments: detail.attachments ?? task.attachments ?? [],
        watchers: detail.watchers ?? task.watchers ?? [],
        subtask_count: task.subtask_count ?? detail.subtasks?.length ?? 0,
        comment_count: task.comment_count ?? detail.comments?.length ?? 0,
        watcher_count: task.watcher_count ?? detail.watchers?.length ?? 0,
        relation_count: task.relation_count ?? detail.relations?.length ?? 0
    };
};

const hydrateTaskMutation = async (task: any) => {
    if (!task?.id) return task || null;
    const { data, error } = await supabase.rpc('get_task_detail', {
        p_task_id: task.id
    });
    if (error || !data) return task;
    return normalizeTaskDetail(data) || task;
};

const getSupabaseErrorMessage = (error: any): string => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    return [
        error.message,
        error.details,
        error.hint,
        error.code,
        error.context?.original_error,
        error.error?.message,
        error.error?.context?.original_error
    ].filter(Boolean).join(' ');
};

const isMissingRpcError = (error: any, functionName?: string) => {
    const message = getSupabaseErrorMessage(error).toLowerCase();
    if (!message) return false;
    const mentionsFunction = !functionName || message.includes(functionName.toLowerCase());
    return mentionsFunction && (
        message.includes('could not find the function')
        || message.includes('schema cache')
        || message.includes('function public.')
        || message.includes('pgrst202')
    );
};

const fallbackTaskStatuses = (spaceId?: string): TaskStatusDefinition[] => ([
    { id: `${spaceId || 'default'}-in-progress`, space_id: spaceId || '', status_key: 'in_progress', name: 'In Progress', category: 'started', color: '#2563EB', position: 10, is_default: false, is_terminal: false, is_actionable: true },
    { id: `${spaceId || 'default'}-todo`, space_id: spaceId || '', status_key: 'todo', name: 'To Do', category: 'unstarted', color: '#6E6E80', position: 20, is_default: true, is_terminal: false, is_actionable: true },
    { id: `${spaceId || 'default'}-review`, space_id: spaceId || '', status_key: 'review', name: 'Review', category: 'review', color: '#A855F7', position: 30, is_default: false, is_terminal: false, is_actionable: true },
    { id: `${spaceId || 'default'}-done`, space_id: spaceId || '', status_key: 'done', name: 'Done', category: 'completed', color: '#16A34A', position: 40, is_default: false, is_terminal: true, is_actionable: false },
    { id: `${spaceId || 'default'}-canceled`, space_id: spaceId || '', status_key: 'canceled', name: 'Canceled', category: 'canceled', color: '#71717A', position: 50, is_default: false, is_terminal: true, is_actionable: false }
]);

const uploadFileStandard = async (
    file: File,
    storagePath: string,
    signedUploadToken?: string,
    onProgress?: (progress: number) => void
) => {
    if (signedUploadToken) {
        const { error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .uploadToSignedUrl(storagePath, signedUploadToken, file, {
                contentType: file.type || 'application/octet-stream',
                upsert: false
            });

        if (error) throw error;
        onProgress?.(100);
        return;
    }

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

    async getInvitationByToken(rawToken: string) {
        const { data, error } = await supabase.rpc('get_invitation_by_token', {
            p_raw_token: rawToken,
        });
        if (error) throw error;
        return firstRow(data);
    },

    async acceptInvitation(rawToken: string) {
        const { data, error } = await supabase.rpc('accept_invitation', {
            p_raw_token: rawToken,
        });

        if (error) {
            const wrappedError = new Error(error.message || 'Failed to accept invitation') as Error & { code?: string };
            wrappedError.code = (error as any).code || 'ACCEPT_INVITATION_FAILED';
            throw wrappedError;
        }

        const payload = (firstRow(data) || {}) as any;
        if (payload.success === false) {
            const wrappedError = new Error(payload.message || payload.error_code || 'Failed to accept invitation') as Error & { code?: string };
            wrappedError.code = payload.error_code || 'ACCEPT_INVITATION_FAILED';
            throw wrappedError;
        }

        return {
            ...payload,
            success: true,
            space_id: payload.space_id || payload.spaceId,
            member_id: payload.member_id || payload.memberId,
            has_completed_onboarding: Boolean(
                payload.has_completed_onboarding ??
                payload.hasCompletedOnboarding ??
                payload.onboarding_complete ??
                false
            ),
        };
    },

    async getShareLink(spaceId: string) {
        const { data, error } = await supabase.rpc('get_share_link', {
            p_space_id: spaceId,
        });
        if (error) throw error;
        return firstRow(data);
    },

    async rotateShareLink(spaceId: string) {
        const { data, error } = await supabase.rpc('rotate_share_link', {
            p_space_id: spaceId,
        });
        if (error) throw error;
        return firstRow(data);
    },

    async updateShareLinkConfig(
        spaceId: string,
        input: {
            default_member_type?: 'staff' | 'client' | null;
            default_role?: 'owner' | 'admin' | 'manager' | 'member' | 'viewer' | null;
            allowed_email_domain?: string | null;
            max_uses?: number | null;
            expires_at?: string | null;
        }
    ) {
        const { data, error } = await supabase.rpc('update_share_link_config', {
            p_space_id: spaceId,
            p_default_member_type: input.default_member_type ?? null,
            p_default_role: input.default_role ?? null,
            p_allowed_email_domain: input.allowed_email_domain ?? null,
            p_max_uses: input.max_uses ?? null,
            p_expires_at: input.expires_at ?? null,
        });
        if (error) throw error;
        return data;
    },

    async setShareLinkEnabled(spaceId: string, enabled: boolean) {
        const { data, error } = await supabase.rpc(enabled ? 'enable_share_link' : 'disable_share_link', {
            p_space_id: spaceId,
        });
        if (error) throw error;
        return data;
    },

    async getShareLinkByToken(rawToken: string) {
        const { data, error } = await supabase.rpc('get_share_link_by_token', {
            p_raw_token: rawToken,
        });
        if (error) throw error;
        return firstRow(data);
    },

    async joinViaShareLink(rawToken: string) {
        const { data, error } = await supabase.rpc('join_via_share_link', {
            p_raw_token: rawToken,
        });
        if (error) throw error;
        return firstRow(data);
    },

    async activateMembershipContext(
        contextType: 'org' | 'client_space',
        contextId: string
    ) {
        const { data, error } = await supabase.rpc('activate_membership_context', {
            p_context_type: contextType,
            p_context_id: contextId,
        });
        if (error) throw error;
        return (data ?? { success: false }) as {
            success: boolean;
            error_code?: string;
        };
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
            .select('message_count, file_count, meeting_count, member_count, last_activity_at')
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
            .eq('recipient_id', userId)
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

    async pingPresence(spaceId: string) {
        const { error } = await supabase.rpc('ping_presence', { p_space_id: spaceId });
        return { error };
    },

    async getSpaceMemberPresence(spaceId: string) {
        const { data, error } = await supabase.rpc('get_space_member_presence', { p_space_id: spaceId });
        if (error) {
            const fallback = await supabase.rpc('get_space_members', { p_space_id: spaceId });
            if (!fallback.error) {
                const normalized = (fallback.data || []).map((member: any) => ({
                    member_id: member.member_id || member.id || member.user_id,
                    user_id: member.user_id,
                    full_name: member.full_name,
                    email: member.email,
                    avatar_url: member.avatar_url,
                    role: member.role === 'owner' || member.role === 'admin'
                        ? member.role
                        : member.member_type === 'staff'
                            ? 'staff'
                            : 'client',
                    is_online: false,
                    last_seen_at: member.last_seen_at || null,
                    presence_state: 'offline',
                }));
                return { data: normalized, error: null };
            }
        }
        return { data: data || [], error };
    },

    async removeSpaceMember(spaceId: string, userId: string) {
        const { error } = await supabase.rpc('remove_space_member', {
            p_space_id: spaceId,
            p_user_id: userId
        });
        return { error };
    },

    async getEffectiveSpacePermissions(userId: string, spaceId: string) {
        const { data, error } = await supabase.rpc('get_effective_space_permissions', {
            p_user_id: userId,
            p_space_id: spaceId
        });
        return { data: data || {}, error };
    },

    async getSpacePermissionsMatrix(spaceId: string) {
        const { data, error } = await supabase.rpc('get_space_permissions_matrix', { p_space_id: spaceId });
        return { data: Array.isArray(data) ? data : data || [], error };
    },

    async bulkSetSpacePermissions(spaceId: string, userId: string, permissions: Record<string, boolean>) {
        const { data, error } = await supabase.rpc('bulk_set_space_permissions', {
            p_space_id: spaceId,
            p_user_id: userId,
            p_permissions: permissions
        });
        return { data: data || [], error };
    },

    async getOrgTeamPolicies() {
        const { data, error } = await supabase.rpc('get_org_team_policies');
        return { data, error };
    },

    async updateOrgTeamPolicies(updates: Record<string, any>) {
        const { data, error } = await supabase.rpc('update_org_team_policies', {
            p_updates: updates
        });
        return { data, error };
    },

    async createCustomRole(name: string, basePermissions: Record<string, any>) {
        const { data, error } = await supabase.rpc('create_custom_role', {
            p_name: name,
            p_base_permissions: basePermissions
        });
        return { data, error };
    },

    async assignCustomRole(userId: string, roleId: string) {
        const { error } = await supabase.rpc('assign_custom_role', {
            p_user_id: userId,
            p_role_id: roleId
        });
        return { error };
    },

    async getTeamMemberWorkload(userId?: string) {
        const { data, error } = await supabase.rpc('get_team_member_workload', {
            p_user_id: userId ?? null
        });
        return { data, error };
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

    async createSpace(
        name: string,
        description?: string,
        organizationId?: string,
        modules?: Record<string, boolean>,
        metadata?: Record<string, any>
    ) {
        const { data, error } = await supabase.functions.invoke('createspace-api', {
            method: 'POST',
            body: { name, description, organization_id: organizationId, modules, metadata }
        });
        if (error) return { data: null, error: { message: error.message } };
        if (data?.error) return { data: null, error: data.error };
        
        // Edge fn returns: { data: { id: "uuid" } } with 201
        // invoke wraps body into data: invoke.data.data.id
        const result = data?.data ?? data;
        if (result?.id && typeof result.id === 'object') return { data: result.id, error: null };
        if (result && typeof result === 'object' && !Array.isArray(result)) {
            const invitationToken = result.invitation_token ?? result.share_link_token;
            const invitationUrl = result.invitation_url ?? result.share_link_url;
            return {
                data: {
                    ...result,
                    invitation_token: invitationToken,
                    share_link_token: result.share_link_token ?? invitationToken,
                    invitation_url: invitationUrl,
                    share_link_url: result.share_link_url ?? invitationUrl,
                },
                error: null,
            };
        }
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

    async closeSpace(spaceId: string, closureReason: string) {
        const { data, error } = await supabase.rpc('close_space', {
            p_space_id: spaceId,
            p_closure_reason: closureReason
        });
        return { data, error };
    },

    async restoreSpace(spaceId: string) {
        const { data, error } = await supabase.rpc('restore_space', {
            p_space_id: spaceId
        });
        return { data, error };
    },

    async deleteSpace(spaceId: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('createspace-api', {
            method: 'DELETE',
            body: { space_id: spaceId, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to delete space' } };
        return { data: data?.data, error: null };
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
        const { data, error } = await supabase.rpc('get_client_portfolio', {
            p_organization_id: organizationId
        });
        if (error) throw error;
        return data || [];
    },

    async setClientWorkModel(spaceId: string, modelType: string, contractStartedAt?: string): Promise<ClientLifecycle[]> {
        const { data, error } = await supabase.rpc('set_client_work_model', {
            p_space_id: spaceId,
            p_model_type: modelType,
            p_monthly_value: null,
            p_contract_started_at: contractStartedAt ?? null
        });
        if (error) throw error;
        return data || [];
    },

    async archiveClientRelationship(spaceId: string): Promise<ClientLifecycle[]> {
        const { data, error } = await supabase.rpc('archive_client_relationship', {
            p_space_id: spaceId
        });
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

    async createInvitation(
        spaceId: string,
        email: string,
        memberType: 'staff' | 'client',
        role: string
    ) {
        const normalizedEmail = email.toLowerCase().trim();
        const { data, error } = await supabase.rpc('create_invitation', {
            p_space_id: spaceId,
            p_email: normalizedEmail,
            p_member_type: memberType,
            p_role: role,
        });
        if (error) throw error;
        return firstRow(data);
    },

    async createSpaceInvitation(spaceId: string, email: string, role: 'member' | 'admin' = 'member') {
        return this.createInvitation(spaceId, email, 'client', role);
    },

    async listSpaceInvitations(spaceId: string, status?: 'pending' | 'accepted' | 'revoked' | 'expired') {
        const { data, error } = await supabase.rpc('list_space_invitations', {
            p_space_id: spaceId,
            p_status: status ?? null,
        });
        if (error) throw error;
        return data || [];
    },

    async regenerateInvitation(invitationId: string) {
        const { data, error } = await supabase.rpc('regenerate_invitation', {
            p_invitation_id: invitationId,
        });
        if (error) throw error;
        return firstRow(data);
    },

    async revokeInvitation(invitationId: string) {
        const { data, error } = await supabase.rpc('revoke_invitation', {
            p_invitation_id: invitationId,
        });
        if (error) throw error;
        return data;
    },

    async listSpaceMembers(spaceId: string) {
        const { data, error } = await supabase.rpc('get_space_members', {
            p_space_id: spaceId,
        });
        if (error) throw error;
        return data || [];
    },

    async sendStaffInvitation(
        email: string,
        role: 'staff' | 'admin',
        spaceAssignments: Array<{ space_id: string; capabilities: Record<string, boolean> }>
    ) {
        const normalizedEmail = email.toLowerCase().trim();
        if (!spaceAssignments.length) {
            throw new Error('At least one space assignment is required');
        }

        const memberRole = role === 'admin' ? 'admin' : 'member';
        const invitations = await Promise.all(
            spaceAssignments.map((assignment) =>
                this.createInvitation(assignment.space_id, normalizedEmail, 'staff', memberRole)
            )
        );

        return invitations.length === 1 ? invitations[0] : { invitations };
    },

    // --- Messaging ---
    async getMessages(spaceId: string, organizationId: string, limit = 30) {
        const { data, error } = await supabase.rpc('get_space_messages', {
            p_space_id: spaceId,
            p_limit: limit,
            p_before_created_at: null
        });
        if (error) return { data: [], error };
        if (data?.success === false) {
            return { data: [], error: { message: data?.error_code || 'Failed to load messages' } };
        }
        const messages = Array.isArray(data) ? data : data?.data || [];
        return { data: messages.map(normalizeMessage), error: null };
    },

    async sendMessage(spaceId: string, content: string, extension: string = 'chat', payload: any = {}, channel: string = 'general', organizationId: string) {
        const { data, error } = await supabase.rpc('send_message', {
            p_space_id: spaceId,
            p_content: content.trim(),
            p_channel: channel,
            p_extension: extension,
            p_payload: payload,
            p_idempotency_key: crypto.randomUUID()
        });

        if (error) return { data: null, error: { message: error.message } };
        if (!data?.success) return { data: null, error: { message: data?.error_code || 'Failed to send message' } };
        return { data: data?.data ? normalizeMessage(data.data) : null, error: null };
    },

    async createSpaceChannel(spaceId: string, name: string, description?: string) {
        const { data, error } = await supabase.rpc('create_space_channel', {
            p_space_id: spaceId,
            p_name: name,
            p_description: description ?? null
        });
        return { data, error };
    },

    async getSpaceChannels(spaceId: string) {
        const { data, error } = await supabase
            .from('space_channels')
            .select('id, space_id, name, description, is_private, created_by, created_at')
            .eq('space_id', spaceId)
            .order('created_at', { ascending: true });
        return { data: data || [], error };
    },

    async getChannelMessages(channelId: string, limit = 50, before?: string) {
        const { data, error } = await supabase.rpc('get_channel_messages', {
            p_channel_id: channelId,
            p_limit: limit,
            p_before: before ?? null
        });
        return { data: (data || []).map(normalizeMessage), error };
    },

    async replyToMessage(rootMessageId: string, content: string) {
        const { data, error } = await supabase.rpc('reply_to_message', {
            p_root_message_id: rootMessageId,
            p_content: content
        });
        return { data: data ? normalizeMessage(data) : null, error };
    },

    async getThreadReplies(rootMessageId: string) {
        const { data, error } = await supabase.rpc('get_thread_replies', {
            p_root_message_id: rootMessageId
        });
        return { data: (data || []).map(normalizeMessage), error };
    },

    async toggleReaction(messageId: string, emoji: string) {
        const { data, error } = await supabase.rpc('toggle_reaction', {
            p_message_id: messageId,
            p_emoji: emoji
        });
        return { data, error };
    },

    async pinMessage(messageId: string, channelId: string) {
        const { data, error } = await supabase.rpc('pin_message', {
            p_message_id: messageId,
            p_channel_id: channelId
        });
        return { data, error };
    },

    async getPinnedMessages(channelId: string) {
        const { data, error } = await supabase.rpc('get_pinned_messages', {
            p_channel_id: channelId
        });
        return { data: data || [], error };
    },

    async markMessagesRead(channelId: string, upToMessageId: string) {
        const { error } = await supabase.rpc('mark_messages_read', {
            p_channel_id: channelId,
            p_up_to_message_id: upToMessageId
        });
        return { error };
    },

    async markMessageRead(messageId: string) {
        const { error } = await supabase.rpc('mark_message_read', {
            p_message_id: messageId
        });
        return { error };
    },

    async getUnreadCounts(spaceId: string) {
        const { data, error } = await supabase.rpc('get_unread_counts', {
            p_space_id: spaceId
        });
        return { data: data || {}, error };
    },

    async saveDraft(channelId: string, content: string) {
        const { data, error } = await supabase.rpc('save_draft', {
            p_channel_id: channelId,
            p_content: content
        });
        return { data, error };
    },

    async getDraft(channelId: string) {
        const { data, error } = await supabase.rpc('get_draft', {
            p_channel_id: channelId
        });
        return { data, error };
    },

    async searchMessages(query: string, spaceId?: string) {
        const { data, error } = await supabase.rpc('search_messages', {
            p_query: query,
            p_space_id: spaceId ?? null
        });
        return { data: data || [], error };
    },

    async createDmThread(recipientId: string) {
        const { data, error } = await supabase.rpc('create_dm_thread', {
            p_recipient_id: recipientId
        });
        return { data, error };
    },

    async sendDm(threadId: string, content: string) {
        const { data, error } = await supabase.rpc('send_dm', {
            p_thread_id: threadId,
            p_content: content
        });
        return { data, error };
    },

    async getDmThreads() {
        const { data, error } = await supabase.rpc('get_dm_threads');
        return { data: data || [], error };
    },

    // --- Tasks ---
    async getTasks(organizationId: string, spaceId?: string, filters: Record<string, any> = {}) {
        if (!organizationId) return { data: [], error: { message: 'organization_id is required' } };

        return this.listTasks(spaceId, { include_archived: true, ...filters });
    },

    async listTasks(spaceId?: string, filters: { priority?: string, search?: string, [key: string]: any } = {}) {
        const { priority, search, ...rest } = filters;
        const { data, error } = await supabase.rpc('list_tasks', {
            p_space_id: spaceId ?? null,
            p_priority: priority ?? null,
            p_search: search ?? null,
            p_filters: rest
        });

        if (error && isMissingRpcError(error, 'list_tasks')) {
            const { data: legacyData, error: legacyError } = await supabase.rpc('list_tasks', {
                p_space_id: spaceId ?? null,
                p_status: rest.status ?? null,
                p_priority: priority ?? null,
                p_group_id: rest.group_id ?? null,
                p_search: search ?? null
            });

            if (legacyError) return { data: null, error: legacyError };
            return { data: legacyData || [], error: null };
        }

        if (error) return { data: null, error };
        return { data: data || [], error: null };
    },

    async listTaskAssignees(spaceId: string, search?: string) {
        const { data, error } = await supabase.rpc('list_task_assignees', {
            p_space_id: spaceId,
            p_search: search ?? null
        });

        if (error && isMissingRpcError(error, 'list_task_assignees')) {
            const { data: memberships, error: membershipError } = await supabase
                .from('space_memberships')
                .select('id, profile_id, role, context_role, status, is_active, profiles:profile_id(id, full_name, email, avatar_url, role)')
                .eq('space_id', spaceId)
                .eq('is_active', true)
                .or('status.is.null,status.eq.active');

            if (membershipError) return { data: [], error: membershipError };

            const normalized = (memberships || [])
                .map((membership: any) => {
                    const profile = Array.isArray(membership.profiles) ? membership.profiles[0] : membership.profiles;
                    const userId = membership.profile_id || profile?.id;
                    const fullName = profile?.full_name || profile?.email || 'Unknown member';
                    const memberType = membership.context_role === 'staff'
                        || ['owner', 'admin', 'staff'].includes(String(membership.role))
                        || ['owner', 'admin', 'staff'].includes(String(profile?.role))
                        ? 'staff'
                        : 'client';

                    return {
                        user_id: userId,
                        membership_id: membership.id,
                        full_name: fullName,
                        email: profile?.email,
                        avatar_url: profile?.avatar_url,
                        role: membership.role,
                        context_role: membership.context_role,
                        member_type: memberType,
                        status: membership.status,
                        is_active: membership.is_active
                    } as SpaceTaskMember;
                })
                .filter((member: SpaceTaskMember) => {
                    if (!member.user_id) return false;
                    if (!search?.trim()) return true;
                    const text = `${member.full_name || ''} ${member.email || ''}`.toLowerCase();
                    return text.includes(search.trim().toLowerCase());
                });

            return { data: normalized, error: null };
        }

        return { data: (data || []) as SpaceTaskMember[], error };
    },

    async listTaskStatuses(spaceId?: string) {
        const { data, error } = await supabase.rpc('list_task_statuses', {
            p_space_id: spaceId ?? null
        });

        if (error && isMissingRpcError(error, 'list_task_statuses')) {
            return { data: fallbackTaskStatuses(spaceId), error: null };
        }

        return { data: (data || []) as TaskStatusDefinition[], error };
    },

    async createTask(data: any, organizationId: string) {
        const { data: res, error } = await supabase.functions.invoke('tasks-api', {
            method: 'POST',
            body: { ...data, organization_id: organizationId }
        });
        if ((error || res?.error) && isMissingRpcError(res?.error || error, 'create_task')) {
            const { data: legacyTask, error: legacyError } = await supabase.rpc('create_task', {
                p_space_id: data.space_id,
                p_title: data.title,
                p_description: data.description ?? null,
                p_due_date: data.due_date ?? null,
                p_priority: data.priority ?? 'medium',
                p_assignee_id: data.assignee_id ?? null,
                p_status: data.status ?? 'todo'
            });

            if (legacyError) return { data: null, error: legacyError };
            return { data: await hydrateTaskMutation(legacyTask), error: null };
        }
        if (error || res?.error) return { data: null, error: res?.error || { message: error?.message || 'Failed to create task' } };
        return { data: await hydrateTaskMutation(res?.data || res), error: null };
    },

    async updateTask(id: string, updates: any, organizationId?: string) {
        const { data, error } = await supabase.functions.invoke('tasks-api', {
            method: 'PATCH',
            body: {
                task_id: id,
                organization_id: organizationId,
                ...updates
            }
        });

        if (error || data?.error) {
            const serviceError = data?.error || error;
            const message = getSupabaseErrorMessage(serviceError).toLowerCase();
            const shouldUseLegacyUpdate = isMissingRpcError(serviceError, 'update_task')
                || message.includes('reviewer_id')
                || message.includes('organization_id')
                || message.includes('column')
                || message.includes('assigned_group');

            if (shouldUseLegacyUpdate) {
                const legacyUpdates: Record<string, unknown> = {};
                ['title', 'description', 'status', 'priority', 'due_date', 'assignee_id'].forEach((key) => {
                    if (Object.prototype.hasOwnProperty.call(updates, key)) legacyUpdates[key] = updates[key];
                });

                const { data: legacyTask, error: legacyError } = await supabase.rpc('update_task', {
                    p_task_id: id,
                    p_updates: legacyUpdates
                });

                if (legacyError) return { data: null, error: legacyError };
                return { data: await hydrateTaskMutation(legacyTask), error: null };
            }
        }

        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to update task' } };
        return { data: await hydrateTaskMutation(data?.data || data || null), error: null };
    },

    async archiveTask(taskId: string) {
        const { data, error } = await supabase.rpc('archive_task', {
            p_task_id: taskId
        });
        return { data, error };
    },

    async restoreTask(taskId: string) {
        const { data, error } = await supabase.rpc('restore_task', {
            p_task_id: taskId
        });
        return { data, error };
    },

    async deleteTask(taskId: string) {
        const { error } = await supabase.functions.invoke('tasks-api', {
            method: 'DELETE',
            body: { task_id: taskId }
        });
        return { error };
    },

    async reorderTask(taskId: string, beforeId?: string | null, afterId?: string | null) {
        const { data, error } = await supabase.rpc('reorder_task', {
            p_task_id: taskId,
            p_before_id: beforeId,
            p_after_id: afterId
        });

        if (error) return { data: null, error };
        return { data: await hydrateTaskMutation(data), error: null };
    },

    async getTaskDetail(taskId: string) {
        const { data, error } = await supabase.rpc('get_task_detail', {
            p_task_id: taskId
        });
        return { data: normalizeTaskDetail(data), error };
    },

    async createSubtask(parentId: string, title: string, assigneeId?: string) {
        const { data, error } = await supabase.rpc('create_subtask', {
            p_parent_id: parentId,
            p_title: title,
            p_assignee_id: assigneeId ?? null
        });
        if (error) return { data: null, error };
        return { data: await hydrateTaskMutation(data), error: null };
    },

    async addTaskComment(taskId: string, content: string, parentCommentId?: string | null) {
        const { error } = await supabase.rpc('add_task_comment', {
            p_task_id: taskId,
            p_content: content,
            p_parent_comment_id: parentCommentId ?? null
        });
        if (error) return { data: null, error };
        return { data: await hydrateTaskMutation({ id: taskId }), error: null };
    },

    async requestTaskReview(taskId: string, reviewerId: string) {
        const { data, error } = await supabase.rpc('request_task_review', {
            p_task_id: taskId,
            p_reviewer_id: reviewerId
        });

        if (error) return { data: null, error };
        return { data: await hydrateTaskMutation(data), error: null };
    },

    async completeTaskReview(taskId: string, approved: boolean, comment?: string) {
        const { data, error } = await supabase.rpc('complete_task_review', {
            p_task_id: taskId,
            p_approved: approved,
            p_comment: comment ?? null
        });

        if (error) return { data: null, error };
        return { data: await hydrateTaskMutation(data), error: null };
    },

    async editTaskComment(commentId: string, content: string) {
        const { data, error } = await supabase.rpc('edit_task_comment', {
            p_comment_id: commentId,
            p_content: content
        });
        if (error) return { data: null, error };
        return { data: await hydrateTaskMutation({ id: data?.task_id }), error: null };
    },

    async deleteTaskComment(commentId: string) {
        const { error } = await supabase.rpc('delete_task_comment', {
            p_comment_id: commentId
        });
        return { error };
    },

    async setTaskLabels(taskId: string, labelIds: string[]) {
        const { error } = await supabase.rpc('set_task_labels', {
            p_task_id: taskId,
            p_label_ids: labelIds
        });
        if (error) return { data: null, error };
        return { data: await hydrateTaskMutation({ id: taskId }), error: null };
    },

    async createTaskLabel(spaceId: string, name: string, color: string) {
        const { data, error } = await supabase.rpc('create_task_label', {
            p_space_id: spaceId,
            p_name: name,
            p_color: color
        });
        return { data, error };
    },

    async setTaskRelation(taskId: string, relatedId: string, type: 'blocks' | 'blocked_by' | 'related_to' | 'duplicate_of') {
        const { data, error } = await supabase.rpc('set_task_relation', {
            p_task_id: taskId,
            p_related_id: relatedId,
            p_type: type
        });
        if (error) return { data: null, error };
        return { data: await hydrateTaskMutation({ id: data?.task_id || taskId }), error: null };
    },

    async getMyTasks(filters: Record<string, any> = {}) {
        const { data, error } = await supabase.rpc('get_my_tasks', {
            p_filters: filters
        });
        return { data: data || [], error };
    },

    async getMyWork(filters: Record<string, any> = {}) {
        const { data, error } = await supabase.rpc('get_my_work', {
            p_filters: filters
        });
        return { data: data || [], error };
    },

    async getTaskInbox(limit = 50) {
        const { data, error } = await supabase.rpc('get_task_inbox', {
            p_limit: limit
        });
        return { data: data || [], error };
    },

    async watchTask(taskId: string) {
        const { error } = await supabase.rpc('watch_task', {
            p_task_id: taskId
        });
        return { error };
    },

    async unwatchTask(taskId: string) {
        const { error } = await supabase.rpc('unwatch_task', {
            p_task_id: taskId
        });
        return { error };
    },

    async bulkUpdateTasks(taskIds: string[], updates: Record<string, any>) {
        const { data, error } = await supabase.rpc('bulk_update_tasks', {
            p_task_ids: taskIds,
            p_updates: updates
        });
        if (error) return { data: [], error };
        const hydrated = await Promise.all((data || []).map((task: any) => hydrateTaskMutation(task)));
        return { data: hydrated, error: null };
    },

    async createSprint(spaceId: string, name: string, start: string, end: string) {
        const { data, error } = await supabase.rpc('create_sprint', {
            p_space_id: spaceId,
            p_name: name,
            p_start: start,
            p_end: end
        });
        return { data, error };
    },

    async assignTasksToSprint(sprintId: string, taskIds: string[]) {
        const { error } = await supabase.rpc('assign_tasks_to_sprint', {
            p_sprint_id: sprintId,
            p_task_ids: taskIds
        });
        return { error };
    },

    async getSprintBoard(sprintId: string) {
        const { data, error } = await supabase.rpc('get_sprint_board', {
            p_sprint_id: sprintId
        });
        return { data, error };
    },

    async saveTaskFilter(spaceId: string, name: string, filters: Record<string, any>) {
        const { data, error } = await supabase.rpc('save_task_filter', {
            p_space_id: spaceId,
            p_name: name,
            p_filters: filters
        });
        return { data, error };
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
            body: { action: 'START_MEETING', meeting_id: meetingId, organization_id: organizationId }
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
            body: { action: 'END_MEETING', meeting_id: meetingId }
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

    async getMeetingRecordings(meetingId: string) {
        const { data, error } = await supabase.functions.invoke('meetings-api', {
            method: 'POST',
            body: { action: 'GET_RECORDINGS', meeting_id: meetingId }
        });
        if (error || data?.error) return { data: [], error: data?.error || { message: error?.message || 'Failed to load recordings' } };
        return { data: data?.data || [], error: null };
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
        void metadata;
        void organizationId;
        return {
            data: null,
            error: { message: 'registerFileMetadata is deprecated; use requestUploadVoucher and confirmUpload.' }
        };
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
            return { data: null, error: data?.error || { message: error?.message || 'Failed to request version voucher' } };
        }
        return { data: data?.data ?? data, error: null };
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
            return { data: null, error: data?.error || { message: error?.message || 'Failed to confirm upload' } };
        }
        return { data: data?.data || data, error: null };
    },


    async uploadFile(spaceId: string, organizationId: string, file: File, onProgress?: (progress: number) => void) {
        // 1. Calculate Checksum
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 2. Get Upload Voucher
        const { data: voucher, error: voucherError } = await this.requestUploadVoucher(spaceId, organizationId, file.name, file.type, checksum, file.size);

        if (voucherError || (!voucher?.upload_url && !voucher?.storage_path)) {
            throw new Error(voucherError?.message || 'Failed to get upload voucher');
        }

        // 3. Upload directly to storage
        try {
            const canUseResumableUpload = file.size > STANDARD_UPLOAD_MAX_BYTES && !!voucher.storage_path;

            if (canUseResumableUpload) {
                await uploadFileResumable(file, voucher.storage_path, onProgress);
            } else {
                await uploadFileStandard(file, voucher.storage_path || voucher.path || file.name, voucher.upload_token, onProgress);
            }
        } catch (uploadErr) {
            throw uploadErr;
        }

        // 4. Confirm upload with backend
        const { data: fileData, error: confirmError } = await this.confirmUpload(
            voucher.file_id,
            organizationId,
            voucher.storage_path,
            checksum,
            file.size
        );

        if (confirmError) {
            throw confirmError;
        }

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
            await uploadFileStandard(file, voucher.storage_path || voucher.path || file.name, voucher.upload_token);
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
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'RESTORE', file_id, organization_id: organizationId }
        });
        if (error || data?.error) return { data: null, error: data?.error || { message: error?.message || 'Failed to restore file' } };
        return { data: data?.data || data, error: null };
    },

    async hardDeleteFile(file_id: string, organizationId: string) {
        const { data, error } = await supabase.functions.invoke('files-api', {
            method: 'POST',
            body: { action: 'HARD_DELETE', file_id, organization_id: organizationId }
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
