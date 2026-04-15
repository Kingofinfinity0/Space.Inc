// files-api/index.ts — THIN GATEWAY (Phase 4 Rewrite)
// Pattern: CORS → getAuthContext → validate → RPC → storage (admin only) → respond
// Storage admin client is ONLY used for signed URLs (Supabase Storage requires service role for signing)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, getAuthContext, hydrateError, errorResponse } from '../_shared/auth.ts'

const STORAGE_BUCKET = 'space-files'

serve(async (req: Request) => {
    // 1. CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    let supabaseClient: any

    try {
        // 2. Auth context — validates JWT, scopes all DB calls to caller's org via RLS
        const { supabase } = await getAuthContext(req)
        supabaseClient = supabase

        // Service-role client: ONLY for storage signed URL operations
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // ── GET /files-api?spaceId=X → List files (RLS enforced) ──────────────
        if (req.method === 'GET') {
            const url = new URL(req.url)
            const spaceId = url.searchParams.get('spaceId')

            let query = supabase
                .from('files')
                .select('*')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })

            if (spaceId) query = query.eq('space_id', spaceId)

            const { data, error } = await query
            if (error) throw error

            return new Response(JSON.stringify({ data }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ── POST /files-api → Action-based file operations via SQL RPCs ────────
        if (req.method === 'POST') {
            const payload = await req.json().catch(() => ({}))
            const { action, organization_id, space_id, file_id, file_name, content_type, checksum, file_size } = payload

            // 3. Input validation: action and organization_id are always required for POST ops
            if (!action) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'action' }))
            if (!organization_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'organization_id' }))

            switch (action) {

                // ── REQUEST_UPLOAD_VOUCHER ─────────────────────────────────────
                case 'REQUEST_UPLOAD_VOUCHER': {
                    if (!space_id || !file_name) {
                        return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { fields: ['space_id', 'file_name'] }))
                    }

                    // 4. SQL RPC handles: capability check, org scoping, pending file insert
                    const { data: voucher, error: rpcError } = await supabase.rpc('request_upload_voucher', {
                        p_space_id: space_id,
                        p_filename: file_name,
                        p_content_type: content_type || 'application/octet-stream',
                        p_file_size: file_size ?? null,
                        p_checksum: checksum ?? null
                    })

                    if (rpcError) throw rpcError

                    // 5. External storage op (requires admin client — signed URLs need service role)
                    const { data: uploadData, error: uploadError } = await supabaseAdmin
                        .storage
                        .from(STORAGE_BUCKET)
                        .createSignedUploadUrl(voucher.storage_path)

                    if (uploadError) throw uploadError

                    return new Response(JSON.stringify({
                        data: {
                            upload_url: uploadData.signedUrl,
                            file_id: voucher.file_id,
                            storage_path: voucher.storage_path
                        }
                    }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // ── REQUEST_NEW_VERSION ────────────────────────────────────────
                case 'REQUEST_NEW_VERSION': {
                    if (!file_id || !file_name) {
                        return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { fields: ['file_id', 'file_name'] }))
                    }

                    const { data: voucher, error: rpcError } = await supabase.rpc('request_new_version', {
                        p_file_id: file_id,
                        p_file_name: file_name,
                        p_content_type: content_type || 'application/octet-stream'
                    })

                    if (rpcError) throw rpcError

                    const { data: uploadData, error: uploadError } = await supabaseAdmin
                        .storage
                        .from(STORAGE_BUCKET)
                        .createSignedUploadUrl(voucher.storage_path)

                    if (uploadError) throw uploadError

                    return new Response(JSON.stringify({
                        data: {
                            upload_url: uploadData.signedUrl,
                            file_id: voucher.file_id,
                            storage_path: voucher.storage_path,
                            version_number: voucher.version_number
                        }
                    }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // ── CONFIRM_UPLOAD ─────────────────────────────────────────────
                case 'CONFIRM_UPLOAD': {
                    if (!file_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'file_id' }))

                    // RPC: marks file available + enqueues virus scan job atomically
                    const { data: file, error: rpcError } = await supabase.rpc('confirm_file_upload', {
                        p_file_id: file_id
                    })

                    if (rpcError) throw rpcError

                    return new Response(JSON.stringify({ data: file }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // ── SIGN_URL ───────────────────────────────────────────────────
                case 'SIGN_URL': {
                    if (!file_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'file_id' }))

                    // RLS-scoped read to verify the caller can actually access this file
                    const { data: file, error: fetchErr } = await supabase
                        .from('files')
                        .select('storage_path')
                        .eq('id', file_id)
                        .is('deleted_at', null)
                        .single()

                    if (fetchErr || !file) return errorResponse(await hydrateError(supabase, 'RESOURCE_NOT_FOUND', { resource: 'file' }))

                    // Admin client required for signed download URL
                    const { data: signedData, error: signErr } = await supabaseAdmin
                        .storage
                        .from(STORAGE_BUCKET)
                        .createSignedUrl(file.storage_path, 3600)

                    if (signErr) throw signErr

                    return new Response(JSON.stringify({ data: signedData }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // ── SOFT_DELETE ────────────────────────────────────────────────
                case 'SOFT_DELETE': {
                    if (!file_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'file_id' }))

                    const { data: result, error: rpcError } = await supabase.rpc('soft_delete_file', {
                        p_file_id: file_id
                    })

                    if (rpcError) throw rpcError

                    return new Response(JSON.stringify({ data: result }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // ── RESTORE ────────────────────────────────────────────────────
                case 'RESTORE': {
                    if (!file_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'file_id' }))

                    const { data: file, error: rpcError } = await supabase.rpc('restore_file', {
                        p_file_id: file_id
                    })

                    if (rpcError) throw rpcError

                    return new Response(JSON.stringify({ data: file }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // ── HARD_DELETE ────────────────────────────────────────────────
                case 'HARD_DELETE': {
                    if (!file_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'file_id' }))

                    // RPC: validates role (staff+), legal hold check, deletes DB row, returns storage_path
                    const { data: result, error: rpcError } = await supabase.rpc('hard_delete_file', {
                        p_file_id: file_id
                    })

                    if (rpcError) throw rpcError

                    // Remove from storage AFTER DB confirms deletion
                    const { error: storageErr } = await supabaseAdmin
                        .storage
                        .from(STORAGE_BUCKET)
                        .remove([result.storage_path])

                    if (storageErr) {
                        console.warn('[files-api] Storage remove failed, DB already deleted:', storageErr.message)
                        // Don't throw — DB record is gone, orphaned file is acceptable vs rollback confusion
                    }

                    return new Response(JSON.stringify({ success: true }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                default:
                    return errorResponse(await hydrateError(supabase, 'VAL_INVALID_ACTION', { action }))
            }
        }

        return errorResponse(await hydrateError(supabase, 'METHOD_NOT_ALLOWED', { method: req.method }))

    } catch (error: any) {
        console.error('[files-api] Error:', error)
        const code = error.isStandard ? error.message
            : (error.code && typeof error.code === 'string') ? error.code
                : 'INTERNAL_ERROR'
        const richError = await hydrateError(supabaseClient, code, { original_error: error.message || String(error) })
        return errorResponse(richError)
    }
})
