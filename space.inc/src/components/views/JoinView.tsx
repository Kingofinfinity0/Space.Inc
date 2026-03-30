import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { apiService } from '../../services/apiService';
import '../../styles/JoinView.css';

type PageStatus = 'loading' | 'valid' | 'invalid' | 'authing' | 'done' | 'error';

interface InviteContext {
    valid: boolean;
    status?: string;
    org_name?: string;
    inviter_name?: string;
    invited_email?: string;
    role?: string;
}

// ─── Utility ────────────────────────────────────────────────────────────────

async function waitForSession(maxMs = 5000): Promise<string | null> {
    const interval = 300;
    const attempts = Math.ceil(maxMs / interval);
    for (let i = 0; i < attempts; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) return data.session.access_token;
        await new Promise(r => setTimeout(r, interval));
    }
    return null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function JoinView() {
    // ✅ 1. Reads token from URL
    const token = new URLSearchParams(window.location.search).get('token') ?? '';

    const [context, setContext]       = useState<InviteContext | null>(null);
    const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
    const [mode, setMode]             = useState<'signup' | 'login'>('signup');
    const [email, setEmail]           = useState('');
    const [password, setPassword]     = useState('');
    const [fullName, setFullName]     = useState('');
    const [statusMsg, setStatusMsg]   = useState('');
    const [errorMsg, setErrorMsg]     = useState('');

    // ✅ 2. Calls validate_invitation_context on mount — shows org name, inviter, role
    useEffect(() => {
        if (!token) { setPageStatus('invalid'); setErrorMsg('No invitation token in URL.'); return; }

        apiService.validateInvitationContext(token)
            .then((data: InviteContext) => {
                setContext(data);
                if (data.valid) {
                    // ✅ 3. Pre-fill email from invite context (read-only)
                    setEmail(data.invited_email ?? '');
                    setPageStatus('valid');
                } else {
                    setPageStatus('invalid');
                }
            })
            .catch(() => {
                setPageStatus('invalid');
            });
    }, [token]);

    // ✅ 4–7. On submit: auth first → poll session → accept_invitation → redirect
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setPageStatus('authing');

        try {
            // Step 1: Authenticate
            if (mode === 'signup') {
                setStatusMsg('Creating your account…');
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: fullName, invite_token: token } }
                });
                if (signUpError) throw signUpError;

                // ✅ If signUp returned no session, email already exists — fall back to signIn
                if (!signUpData.session) {
                    setStatusMsg('Account exists. Signing in…');
                    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                    if (signInError) {
                        throw new Error('An account with this email already exists. Use the "Sign In" tab or check your password.');
                    }
                }
            } else {
                setStatusMsg('Signing in…');
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            }

            // ✅ 5. Poll getSession() until access_token confirmed
            setStatusMsg('Confirming session…');
            const accessToken = await waitForSession(8000);
            if (!accessToken) throw new Error('Session did not initialise. Please try signing in manually.');

            // ✅ 6. AFTER session confirmed: call accept_invitation
            setStatusMsg('Joining workspace…');
            const result = await apiService.acceptInvitation(token);

            // ✅ 7. Navigate to redirect_path from RPC response
            setPageStatus('done');
            const path = result?.redirect_path || (result?.role === 'client' ? '/client/portal' : '/dashboard');
            window.location.href = path;

        } catch (err: any) {
            setErrorMsg(err.message || 'Something went wrong. Please try again.');
            setPageStatus('valid'); // reset to form
        }
    };

    // ─── Render ─────────────────────────────────────────────────────────────

    // Loading state
    if (pageStatus === 'loading') return (
        <div className="join-view-page">
            <div className="join-view-center">
                <div className="join-view-spinner" />
                <p className="join-view-verify-text">Verifying invitation…</p>
            </div>
        </div>
    );

    // Invalid state
    if (pageStatus === 'invalid') {
        const msg =
            context?.status === 'expired'  ? 'This invitation link has expired.' :
            context?.status === 'revoked'  ? 'This invitation has been revoked.' :
            context?.status === 'accepted' ? 'This invitation has already been accepted.' :
            errorMsg || 'This invitation link is invalid or does not exist.';
        return (
            <div className="join-view-page">
                <div className="join-view-card join-view-center">
                    <div className="join-view-logo"><div className="join-view-logo-box">S</div>Space.inc</div>
                    <div className="join-view-invalid-icon">❌</div>
                    <h2 className="join-view-title">Invitation Invalid</h2>
                    <p className="join-view-subtitle join-view-spacing-b24">{msg}</p>
                    <p className="join-view-footer-info">
                        Contact the person who invited you for a fresh link.
                    </p>
                </div>
            </div>
        );
    }

    // In-progress state
    if (pageStatus === 'authing' || pageStatus === 'done') return (
        <div className="join-view-page">
            <div className="join-view-card join-view-center">
                <div className="join-view-logo"><div className="join-view-logo-box">S</div>Space.inc</div>
                <div className="join-view-spinner" />
                <p className="join-view-verify-text">{statusMsg || 'Please wait…'}</p>
            </div>
        </div>
    );

    // Valid state — ✅ email/password form with pre-filled read-only email
    return (
        <div className="join-view-page">
            <div className="join-view-card">
                <div className="join-view-logo"><div className="join-view-logo-box">S</div>Space.inc</div>

                <div className="join-view-center join-view-spacing-b28">
                    <div className="join-view-rocket-icon">🚀</div>
                    <h2 className="join-view-title">You're invited</h2>
                    <p className="join-view-subtitle">
                        <strong className="join-view-text-bold">{context?.inviter_name}</strong> invited you to join{' '}
                        <strong className="join-view-text-bold">{context?.org_name}</strong>
                    </p>
                    <span className="join-view-badge">{context?.role}</span>
                </div>

                {/* Mode tabs */}
                <div className="join-view-tabs">
                    <button 
                        className={`join-view-tab ${mode === 'signup' ? 'active' : ''}`} 
                        onClick={() => setMode('signup')}
                    >
                        Create Account
                    </button>
                    <button 
                        className={`join-view-tab ${mode === 'login' ? 'active' : ''}`} 
                        onClick={() => setMode('login')}
                    >
                        Sign In
                    </button>
                </div>

                {errorMsg && <div className="join-view-err">{errorMsg}</div>}

                <form onSubmit={handleSubmit}>
                    {mode === 'signup' && (
                        <input
                            className="join-view-input"
                            type="text"
                            placeholder="Full name"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            required
                        />
                    )}

                    {/* ✅ Email pre-filled, read-only */}
                    <input
                        className="join-view-input readonly"
                        type="email"
                        value={email}
                        readOnly
                        placeholder="Email"
                    />

                    <input
                        className="join-view-input"
                        type="password"
                        placeholder={mode === 'signup' ? 'Choose a password (min 6 chars)' : 'Password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={6}
                    />

                    <button className="join-view-btn" type="submit">
                        {mode === 'signup' ? 'Create Account & Join →' : 'Sign In & Join →'}
                    </button>
                </form>

                <p className="join-view-footer">
                    Secure invitation · One-time use
                </p>
            </div>
        </div>
    );
}