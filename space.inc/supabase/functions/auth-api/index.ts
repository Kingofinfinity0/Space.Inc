// @ts-ignore: Deno type definitions 
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from 'shared/auth.ts'
import { hashToken } from 'shared/security.ts'
import { createSessionJWT } from 'shared/auth_utils.ts'
import { Header, Payload } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

interface AuthPayload {
    action: 'EXCHANGE_OAUTH' | 'REFRESH_TOKEN' | 'LOGOUT' | 'LIST_SESSIONS' | 'REVOKE_SESSION';
    provider?: 'google' | 'github' | 'slack' | 'notion';
    idToken?: string;
    refreshToken?: string;
    sessionId?: string;
}


// @ts-ignore: Deno namespace
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            // @ts-ignore: Deno namespace
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore: Deno namespace
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const payload: AuthPayload = await req.json()
        const { action } = payload

        console.log(`[auth-api] Action: ${action}`)

        switch (action) {
            case 'EXCHANGE_OAUTH': {
                return await handleOAuthExchange(supabase, payload)
            }
            case 'REFRESH_TOKEN': {
                return await handleRefreshToken(supabase, payload)
            }
            default:
                throw new Error(`Unknown action: ${action}`)
        }

    } catch (error: any) {
        console.error(`[auth-api] Error:`, error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})

// --- Logic Handlers ---

async function handleOAuthExchange(supabase: any, payload: AuthPayload) {
    const { provider, idToken } = payload
    if (!idToken || !provider) throw new Error("Missing provider or idToken")

    let userInfo;

    // 1. Verify Token with Provider
    try {
        if (idToken.startsWith('{')) {
            // Support JSON mock for testing
            userInfo = JSON.parse(idToken);
        } else if (idToken === 'demo-token') {
            userInfo = { email: 'demo@space.inc', sub: 'demo-user-123', name: 'Demo User', picture: '' }
        } else {
            // Real verification
            switch (provider) {
                case 'google':
                    userInfo = await verifyGoogleToken(idToken);
                    break;
                case 'github':
                    userInfo = await verifyGitHubToken(idToken);
                    break;
                case 'slack':
                    userInfo = await verifySlackToken(idToken);
                    break;
                case 'notion':
                    userInfo = await verifyNotionToken(idToken);
                    break;
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }
        }
    } catch (e: any) {
        console.error(`[auth-api] OAuth Verification failed:`, e.message);
        throw new Error(`OAuth Verification failed: ${e.message}`);
    }

    if (!userInfo?.email) throw new Error("OAuth provider did not return an email");

    // 2. Find or Create User
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', userInfo.email)
        .single()

    let userId = user?.id

    if (!userId) {
        // Create new user
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
                email: userInfo.email,
                full_name: userInfo.name,
                avatar_url: userInfo.picture,
                role: 'client' // Default
            })
            .select()
            .single()

        if (createError) throw createError
        userId = newUser.id
    }

    // 3. Create Session with hashed refresh token
    const platform = "web" // Detect from UA if needed
    const refreshToken = crypto.randomUUID(); // Generate refresh token
    const refreshTokenHash = await hashToken(refreshToken); // Hash it for storage

    const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
            user_id: userId,
            refresh_token_hash: refreshTokenHash,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            ip_address: '0.0.0.0',
            device_info: 'Edge Function'
        })
        .select()
        .single()

    if (sessionError) throw sessionError

    // 4. Fetch Profile for context
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', userId)
        .single();

    const userRole = profile?.role || 'client';
    const orgId = profile?.organization_id;

    // 5. Generate JWTs mit Stateless Claims
    const accessToken = await createSessionJWT(userId, userInfo.email, userRole, session.id, orgId)

    return new Response(
        JSON.stringify({
            data: {
                session: {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    session_id: session.id,
                    user: { id: userId, email: userInfo.email }
                }
            }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}

async function handleRefreshToken(supabase: any, payload: AuthPayload) {
    const { refreshToken, sessionId } = payload;
    if (!refreshToken || !sessionId) throw new Error("Missing refresh token or session ID");

    console.log(`[auth-api] Refreshing session: ${sessionId}`);

    // 1. Verify session exists and is not revoked
    const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('revoked', false)
        .single();

    if (sessionError || !session) {
        console.error('[auth-api] Invalid or revoked session:', sessionError);
        throw new Error("Invalid or revoked session");
    }

    // 2. Verify refresh token hash matches
    const tokenHash = await hashToken(refreshToken);
    if (session.refresh_token_hash !== tokenHash) {
        console.error('[auth-api] Refresh token hash mismatch');
        throw new Error("Invalid refresh token");
    }

    // 3. Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
        console.error('[auth-api] Session expired');
        throw new Error("Session expired");
    }

    // 4. Get user and profile data
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', session.user_id)
        .single();

    if (userError || !user) {
        console.error('[auth-api] User not found:', userError);
        throw new Error("User not found");
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .single();

    const userRole = profile?.role || 'client';
    const orgId = profile?.organization_id;

    // 5. Generate new access token
    const newAccessToken = await createSessionJWT(
        user.id,
        user.email,
        userRole,
        sessionId,
        orgId
    );

    // 6. Rotate refresh token for security
    const newRefreshToken = crypto.randomUUID();
    const newRefreshHash = await hashToken(newRefreshToken);

    // 7. Update session with new refresh token and extended expiry
    const { error: updateError } = await supabase
        .from('sessions')
        .update({
            refresh_token_hash: newRefreshHash,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('id', sessionId);

    if (updateError) {
        console.error('[auth-api] Failed to update session:', updateError);
        throw new Error("Failed to update session");
    }

    console.log('[auth-api] Session refreshed successfully');

    return new Response(
        JSON.stringify({
            data: {
                session: {
                    access_token: newAccessToken,
                    refresh_token: newRefreshToken,
                    session_id: sessionId,
                    user: { id: user.id, email: user.email }
                }
            }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
}

// Helpers removed - using shared utilities

// --- OAuth Provider Verifiers ---

async function verifyGoogleToken(idToken: string) {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!response.ok) throw new Error("Invalid Google token");
    const data = await response.json();
    return {
        email: data.email,
        sub: data.sub,
        name: data.name,
        picture: data.picture
    };
}

async function verifyGitHubToken(accessToken: string) {
    const response = await fetch('https://api.github.com/user', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'Space-Inc-Auth'
        }
    });
    if (!response.ok) throw new Error("Invalid GitHub token");
    const data = await response.json();

    // If email is private, we might need to fetch it separately
    let email = data.email;
    if (!email) {
        const emailRes = await fetch('https://api.github.com/user/emails', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'Space-Inc-Auth'
            }
        });
        if (emailRes.ok) {
            const emails = await emailRes.json();
            const primaryEmail = emails.find((e: any) => e.primary);
            email = primaryEmail?.email;
        }
    }

    return {
        email: email,
        sub: data.id.toString(),
        name: data.name || data.login,
        picture: data.avatar_url
    };
}

async function verifySlackToken(accessToken: string) {
    // Slack 'openid.connect.getCredentials' or 'users.identity'
    const response = await fetch('https://slack.com/api/users.identity', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await response.json();
    if (!data.ok) throw new Error(`Slack error: ${data.error}`);
    return {
        email: data.user.email,
        sub: data.user.id,
        name: data.user.name,
        picture: data.user.image_512
    };
}

async function verifyNotionToken(accessToken: string) {
    // Notion doesn't have a standardized "userinfo" endpoint like Google/Slack
    // We use 'users/me'
    const response = await fetch('https://api.notion.com/v1/users/me', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Notion-Version': '2022-06-28'
        }
    });
    if (!response.ok) throw new Error("Invalid Notion token");
    const data = await response.json();
    return {
        email: data.person?.email,
        sub: data.id,
        name: data.name,
        picture: data.avatar_url
    };
}

