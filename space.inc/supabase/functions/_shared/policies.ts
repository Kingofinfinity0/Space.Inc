// @ts-ignore: Deno type definitions 
import { createClient } from '@supabase/supabase-js'

/**
 * Policy Engine - Hierarchical Permission Resolution
 * 
 * Evaluation Order:
 * 1. Space-level override (space_client_permissions)
 * 2. Organization-level policy (organization_policies)
 * 3. Hardcoded default
 */

interface PolicyContext {
    userId: string;
    orgId: string;
    role: string;
}

// Simple in-memory cache (5 minute TTL)
const policyCache = new Map<string, { data: any; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Check if user can upload files to a space
 */
export async function canUpload(
    supabaseAdmin: any,
    context: PolicyContext,
    spaceId: string
): Promise<boolean> {

    // Staff/Admin/Owner always allowed
    if (context.role !== 'client') {
        return true
    }

    // Check space-level override first
    const spacePermission = await getSpacePermission(supabaseAdmin, context.userId, spaceId)
    if (spacePermission && spacePermission.can_upload !== null) {
        return spacePermission.can_upload
    }

    // Check organization policy
    const orgPolicy = await getOrgPolicy(supabaseAdmin, context.orgId)
    if (orgPolicy && orgPolicy.client_can_upload !== null) {
        return orgPolicy.client_can_upload
    }

    // Default: true (clients can upload by default)
    return true
}

/**
 * Check if user can delete a file
 */
export async function canDelete(
    supabaseAdmin: any,
    context: PolicyContext,
    fileId: string
): Promise<boolean> {

    // Fetch file to check ownership
    const { data: file } = await supabaseAdmin
        .from('files')
        .select('uploaded_by, owner_role')
        .eq('id', fileId)
        .single()

    if (!file) {
        return false
    }

    // Admin/Owner can delete anything
    if (context.role === 'admin' || context.role === 'owner') {
        return true
    }

    // Staff can delete staff/client files, but not admin/owner files
    if (context.role === 'staff') {
        return file.owner_role !== 'admin' && file.owner_role !== 'owner'
    }

    // Clients can only delete their own files (if policy allows)
    if (context.role === 'client') {
        if (file.uploaded_by !== context.userId) {
            return false
        }

        // Check space-level override
        const { data: fileWithSpace } = await supabaseAdmin
            .from('files')
            .select('space_id')
            .eq('id', fileId)
            .single()

        if (fileWithSpace) {
            const spacePermission = await getSpacePermission(supabaseAdmin, context.userId, fileWithSpace.space_id)
            if (spacePermission && spacePermission.can_delete !== null) {
                return spacePermission.can_delete
            }
        }

        // Check organization policy
        const orgPolicy = await getOrgPolicy(supabaseAdmin, context.orgId)
        if (orgPolicy && orgPolicy.client_can_delete_own !== null) {
            return orgPolicy.client_can_delete_own
        }

        // Default: true (clients can delete own files)
        return true
    }

    return false
}

/**
 * Check if user can invite others to the organization
 */
export async function canInvite(
    supabaseAdmin: any,
    context: PolicyContext
): Promise<boolean> {

    // Owner/Admin always allowed
    if (context.role === 'owner' || context.role === 'admin') {
        return true
    }

    // Check organization policy for staff
    if (context.role === 'staff') {
        const orgPolicy = await getOrgPolicy(supabaseAdmin, context.orgId)
        if (orgPolicy && orgPolicy.allow_staff_invites !== null) {
            return orgPolicy.allow_staff_invites
        }
        return true // Default: staff can invite
    }

    // Check organization policy for clients
    if (context.role === 'client') {
        const orgPolicy = await getOrgPolicy(supabaseAdmin, context.orgId)
        if (orgPolicy && orgPolicy.allow_client_invites !== null) {
            return orgPolicy.allow_client_invites
        }
        return false // Default: clients cannot invite
    }

    return false
}

/**
 * Check if user can create tasks in a space
 */
export async function canCreateTask(
    supabaseAdmin: any,
    context: PolicyContext,
    spaceId: string
): Promise<boolean> {

    // Staff/Admin/Owner always allowed
    if (context.role !== 'client') {
        return true
    }

    // Check space-level override
    const spacePermission = await getSpacePermission(supabaseAdmin, context.userId, spaceId)
    if (spacePermission && spacePermission.can_create_tasks !== null) {
        return spacePermission.can_create_tasks
    }

    // Check organization policy
    const orgPolicy = await getOrgPolicy(supabaseAdmin, context.orgId)
    if (orgPolicy && orgPolicy.client_can_create_tasks !== null) {
        return orgPolicy.client_can_create_tasks
    }

    // Default: false (clients cannot create tasks by default)
    return false
}

/**
 * Check if user can start meetings
 */
export async function canStartMeeting(
    supabaseAdmin: any,
    context: PolicyContext
): Promise<boolean> {

    // Staff/Admin/Owner always allowed
    if (context.role !== 'client') {
        return true
    }

    // Check organization policy
    const orgPolicy = await getOrgPolicy(supabaseAdmin, context.orgId)
    if (orgPolicy && orgPolicy.client_can_start_meetings !== null) {
        return orgPolicy.client_can_start_meetings
    }

    // Default: false (clients cannot start meetings by default)
    return false
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getSpacePermission(
    supabaseAdmin: any,
    userId: string,
    spaceId: string
): Promise<any> {

    const cacheKey = `space_perm:${userId}:${spaceId}`
    const cached = policyCache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now()) {
        return cached.data
    }

    const { data } = await supabaseAdmin
        .from('space_client_permissions')
        .select('*')
        .eq('user_id', userId)
        .eq('space_id', spaceId)
        .single()

    policyCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + CACHE_TTL_MS
    })

    return data
}

async function getOrgPolicy(
    supabaseAdmin: any,
    orgId: string
): Promise<any> {

    const cacheKey = `org_policy:${orgId}`
    const cached = policyCache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now()) {
        return cached.data
    }

    const { data } = await supabaseAdmin
        .from('organization_policies')
        .select('*')
        .eq('organization_id', orgId)
        .single()

    policyCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + CACHE_TTL_MS
    })

    return data
}
