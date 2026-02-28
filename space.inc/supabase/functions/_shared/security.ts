// Security utilities for Edge Functions

/**
 * Check for brute force login attempts
 * @param supabase - Supabase client
 * @param userId - User ID to check
 * @returns Error message if locked, null if allowed
 */
export async function checkBruteForce(supabase: any, userId: string): Promise<string | null> {
    const { data: failedAttempts } = await supabase
        .from('failed_login_attempts')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (!failedAttempts) return null;

    // Check if account is locked
    if (failedAttempts.locked_until && new Date(failedAttempts.locked_until) > new Date()) {
        const minutesLeft = Math.ceil((new Date(failedAttempts.locked_until).getTime() - Date.now()) / 60000);
        return `Account locked due to too many failed attempts. Try again in ${minutesLeft} minutes.`;
    }

    // Check attempt count
    if (failedAttempts.attempt_count >= 5) {
        // Lock for 15 minutes
        await supabase
            .from('failed_login_attempts')
            .update({
                locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString()
            })
            .eq('user_id', userId);

        return 'Too many failed attempts. Account locked for 15 minutes.';
    }

    return null;
}

/**
 * Record a failed login attempt
 * @param supabase - Supabase client
 * @param userId - User ID
 */
export async function recordFailedAttempt(supabase: any, userId: string): Promise<void> {
    const { data: existing } = await supabase
        .from('failed_login_attempts')
        .select('attempt_count')
        .eq('user_id', userId)
        .single();

    await supabase
        .from('failed_login_attempts')
        .upsert({
            user_id: userId,
            attempt_count: (existing?.attempt_count || 0) + 1,
            last_attempt_at: new Date().toISOString()
        });
}

/**
 * Clear failed login attempts after successful login
 * @param supabase - Supabase client
 * @param userId - User ID
 */
export async function clearFailedAttempts(supabase: any, userId: string): Promise<void> {
    await supabase
        .from('failed_login_attempts')
        .delete()
        .eq('user_id', userId);
}

/**
 * Simple in-memory rate limiter
 * For production, use Redis or similar distributed cache
 */
const rateLimitMap = new Map<string, number[]>();

/**
 * Check rate limit for an identifier
 * @param identifier - IP address or user ID
 * @param maxRequests - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 * @throws Error if rate limit exceeded
 */
export function checkRateLimit(
    identifier: string,
    maxRequests: number = 10,
    windowMs: number = 60000
): void {
    const now = Date.now();
    const userRequests = rateLimitMap.get(identifier) || [];

    // Remove old requests outside the window
    const recentRequests = userRequests.filter((time: number) => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
        throw new Error("Rate limit exceeded. Please try again later.");
    }

    recentRequests.push(now);
    rateLimitMap.set(identifier, recentRequests);
}

/**
 * Get client IP from request headers
 * @param req - Request object
 * @returns IP address
 */
export function getClientIP(req: Request): string {
    return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
        || req.headers.get('x-real-ip')
        || 'unknown';
}

/**
 * Hash a token using SHA-256 for secure storage
 * @param token - Token to hash
 * @returns Hashed token string
 */
export async function hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

