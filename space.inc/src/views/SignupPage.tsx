import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Heading, Text, GlassCard } from '@/components/UI/index';
import { Rocket, Shield, ArrowRight, Mail } from 'lucide-react';
import { supabase, EDGE_FUNCTION_BASE_URL } from '@/lib/supabase';

export default function SignupPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { signUp } = useAuth();

    const inviteToken = searchParams.get('invite_token');
    const invitedEmail = searchParams.get('email');

    const [email, setEmail] = useState(invitedEmail || '');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
    const [inviteOrgName, setInviteOrgName] = useState<string | null>(null);

    // Storage migration: check all possible token locations to prevent dropping users mid-flow
    const getPendingToken = (): string | null => {
        return (
            sessionStorage.getItem('pending_invite_token') ||
            localStorage.getItem('pending_invite_token') ||
            localStorage.getItem('pending_space_token') // legacy key
        );
    };

    const clearPendingToken = () => {
        sessionStorage.removeItem('pending_invite_token');
        localStorage.removeItem('pending_invite_token');
        localStorage.removeItem('pending_space_token');
    };

    useEffect(() => {
        if (invitedEmail) setEmail(invitedEmail);

        const token = getPendingToken();
        if (token) {
            setPendingInviteToken(token);
            // Use edge function to validate - try personal invite validation
            fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'validate', token })
            })
                .then(res => res.json())
                .then(result => {
                    const data = result.data || result;
                    if (data && data.valid && data.org_name) {
                        setInviteOrgName(data.org_name);
                    }
                })
                .catch(err => {
                    if (process.env.NODE_ENV === 'development') {
                        // eslint-disable-next-line no-console
                        console.error('Error fetching invite details:', err);
                    }
                });
        }
    }, [invitedEmail]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Check for any pending token using the migration strategy
            const pendingToken = getPendingToken();
            const tokenToUse = inviteToken || pendingToken || undefined;

            const { error: signUpError } = await signUp(email, password, {
                full_name: fullName,
                invite_token: tokenToUse
            });

            if (signUpError) throw signUpError;

            if (tokenToUse) {
                let session = null;
                for (let i = 0; i < 15; i++) {
                    const { data } = await supabase.auth.getSession();
                    if (data.session?.access_token) {
                        session = data.session;
                        break;
                    }
                    await new Promise(r => setTimeout(r, 400));
                }

                if (!session) {
                    // Store token for post-login processing
                    sessionStorage.setItem('pending_invite_token', tokenToUse);
                    navigate('/login?message=check_email', { replace: true });
                    return;
                }

                // Clear all token storage variants to prevent reuse
                clearPendingToken();

                // Branching logic: try space link first, then fall back to personal invite
                let result: any = null;
                let isSpaceLink = false;

                try {
                    // Try to resolve as space link
                    const resolveRes = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'resolve_space_link', token: tokenToUse })
                    });
                    const resolveData = await resolveRes.json();
                    const spaceData = resolveData.data || resolveData;

                    if (spaceData.valid) {
                        // It's a valid space link - accept it
                        isSpaceLink = true;
                        const acceptRes = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.access_token}`
                            },
                            body: JSON.stringify({ action: 'accept_space_link', token: tokenToUse })
                        });
                        const acceptData = await acceptRes.json();
                        result = acceptData.data || acceptData;
                    }
                } catch (spaceErr) {
                    if (process.env.NODE_ENV === 'development') {
                        // eslint-disable-next-line no-console
                        console.log('Space link resolution failed, trying personal invite');
                    }
                }

                // If not a space link, try personal invitation
                if (!isSpaceLink) {
                    try {
                        const acceptRes = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.access_token}`
                            },
                            body: JSON.stringify({ action: 'accept', token: tokenToUse })
                        });
                        const acceptData = await acceptRes.json();
                        result = acceptData.data || acceptData;
                    } catch (personalErr) {
                        if (process.env.NODE_ENV === 'development') {
                            // eslint-disable-next-line no-console
                            console.error('Personal invite acceptance failed:', personalErr);
                        }
                        throw personalErr;
                    }
                }

                // Handle result with standardized redirect
                if (result?.redirect_path) {
                    window.location.href = result.redirect_path;
                    return;
                }

                if (result?.error_code) {
                    const errorMessages: Record<string, string> = {
                        LINK_EXPIRED: 'This invite has expired',
                        INVITE_FULL: 'Invite limit reached',
                        EMAIL_NOT_ALLOWED: "Your email isn't on the allowlist",
                        NOT_AUTHENTICATED: 'Please sign in again',
                        INVALID_TOKEN: 'Invalid invite link',
                        INVITATION_EXPIRED: 'This invitation has expired',
                        INVITATION_ALREADY_USED: 'This invitation has already been used',
                        EMAIL_MISMATCH: 'This invitation was sent to a different email',
                    };
                    setError(errorMessages[result.error_code] || 'Failed to accept invitation');
                    return;
                }

                // Fallback redirect
                navigate('/dashboard', { replace: true });
            } else {
                navigate('/onboarding');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF] p-6">
            <div className="w-full max-w-[460px]">
                <GlassCard className="p-8 md:p-10">
                    <div className="mb-10 flex items-center justify-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-black text-white">
                            <Rocket size={18} />
                        </div>
                        <span className="text-lg font-semibold tracking-[-0.03em] text-[#0D0D0D]">Space.inc</span>
                    </div>

                    <div className="mb-8 text-center">
                        <Heading level={2} className="text-3xl font-semibold">
                            {inviteToken ? 'Finish registration' : 'Create account'}
                        </Heading>
                        <Text variant="secondary" className="mt-2">
                            {inviteToken ? 'Complete your information to join the workspace.' : 'Get started with a cleaner client workspace.'}
                        </Text>
                    </div>

                    {error && (
                        <div className="mb-6 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4 text-sm text-[#B42318]">
                            {error}
                        </div>
                    )}

                    {pendingInviteToken && (
                        <div className="mb-6 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4 text-sm text-[#0D0D0D]">
                            <div className="mb-2 flex items-center gap-2 text-[#6E6E80]">
                                <Mail size={16} />
                                <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Organization invite detected</span>
                            </div>
                            {inviteOrgName ? (
                                <p>Create your account to accept your invitation to join <strong>{inviteOrgName}</strong>.</p>
                            ) : (
                                <p>Create your account to accept your organization invitation.</p>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Full Name</label>
                                <Input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="John Doe"
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Email Address</label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    required
                                    readOnly={!!inviteToken}
                                    className={inviteToken ? 'bg-[#F7F7F8]' : ''}
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Password</label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                            {loading ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    {inviteToken ? 'Join organization' : 'Create account'} <ArrowRight size={14} />
                                </div>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 border-t border-[#E5E5E5] pt-6 text-center">
                        <Text variant="secondary" className="text-sm">
                            Already have an account?{' '}
                            <button
                                onClick={() => navigate(`/login${window.location.search}`)}
                                className="font-medium text-[#0D0D0D] hover:text-[#6E6E80]"
                            >
                                Sign in
                            </button>
                        </Text>
                    </div>
                </GlassCard>

                <div className="mt-8 flex items-center justify-center gap-2 text-[#6E6E80]">
                    <Shield size={12} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.24em]">Zero trust identity</span>
                </div>
            </div>
        </div>
    );
}
