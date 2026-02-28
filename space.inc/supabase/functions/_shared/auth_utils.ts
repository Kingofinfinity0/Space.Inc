// _shared/auth_utils.ts
import { create, getNumericDate, Header, Payload } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

/**
 * Creates a JWT for the custom session system, compatible with Supabase RLS
 */
export async function createSessionJWT(userId: string, email: string, role: string, sessionId: string, orgId?: string) {
    // @ts-ignore: Deno namespace
    const secret = Deno.env.get('SUPABASE_JWT_SECRET')
    if (!secret) throw new Error("SUPABASE_JWT_SECRET not set")

    const key = await getCryptoKey(secret)

    const payload: Payload = {
        sub: userId,
        email: email,
        role: "authenticated", // Standard Supabase role for RLS
        aud: "authenticated",
        exp: getNumericDate(60 * 60), // 1 hour
        app_role: role, // Our custom role (staff, client, admin, owner)
        session_id: sessionId,
        org_id: orgId // Stateless Organization context
    }

    const header: Header = { alg: "HS256", typ: "JWT" }

    return await create(header, payload, key)
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    return await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    )
}
