// _shared/auth.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
}

/**
 * JWT parsing utility (avoids redundant auth calls)
 * Standard Ground Zero Pattern
 */
export function parseJwt(token: string) {
    try {
        const base64Url = token.split('.')[1]
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
        // @ts-ignore: Deno atob
        const jsonPayload = decodeURIComponent(
            atob(base64).split('').map(c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join('')
        )
        return JSON.parse(jsonPayload)
    } catch (e) {
        console.error('JWT Parse Error:', e)
        return null
    }
}

/**
 * Unified Auth Context Extraction
 * Returns { userId, email, supabase }
 */
export async function getAuthContext(req: Request) {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    let token = null
    if (authHeader) {
        const match = authHeader.match(/^Bearer\s+(.+)$/i)
        token = match ? match[1] : authHeader
    }

    if (!token) {
        const err = new Error('AUTH_MISSING_TOKEN');
        (err as any).isStandard = true;
        throw err;
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
            global: {
                headers: { Authorization: `Bearer ${token}` }
            }
        }
    )

    const jwtPayload = parseJwt(token)
    if (!jwtPayload || !jwtPayload.sub) {
        const err = new Error('AUTH_INVALID_TOKEN');
        (err as any).isStandard = true;
        throw err;
    }

    return {
        userId: jwtPayload.sub,
        email: jwtPayload.email,
        supabase
    }
}

/**
 * Hydrate a standard error code into a rich error object
 */
export async function hydrateError(supabase: any, code: string, context?: any) {
    const { data: errorDef } = await supabase
        .from('error_codes')
        .select('http_status, message, remediation')
        .eq('code', code)
        .single();

    if (errorDef) {
        return {
            code,
            status: errorDef.http_status,
            message: errorDef.message,
            remediation: errorDef.remediation,
            context
        };
    }

    // Standard Fallbacks if DB registry misses
    const fallbacks: Record<string, any> = {
        'AUTH_MISSING_TOKEN': { status: 401, message: 'Authentication token is missing.' },
        'AUTH_INVALID_TOKEN': { status: 401, message: 'Invalid token format.' },
        'PERMISSION_DENIED': { status: 403, message: 'Permission denied.' },
    };

    const fallback = fallbacks[code] || { status: 400, message: 'An unspecified error occurred.' };

    return {
        code,
        status: fallback.status,
        message: fallback.message,
        context: { ...context }
    };
}

/**
 * Standardized Error Response formatter
 */
export function errorResponse(error: { code: string; status: number; message: string; remediation?: string; context?: any }) {
    return new Response(JSON.stringify({
        error: {
            code: error.code,
            message: error.message,
            remediation: error.remediation,
            context: error.context
        }
    }), {
        status: error.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
