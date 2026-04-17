import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiService } from '@/services/apiService';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Heading, Text, GlassCard } from '@/components/UI/index';
import { Rocket, Shield, ArrowRight, UserPlus, Mail } from 'lucide-react';
import { supabase, EDGE_FUNCTION_BASE_URL } from '@/lib/supabase';

export default function LoginPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { signIn } = useAuth();

    const inviteToken = searchParams.get('invite_token');
    const invitedEmail = searchParams.get('email');
    const message = searchParams.get('message');

    const [email, setEmail] = useState(invitedEmail || '');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
    const [inviteOrgName, setInviteOrgName] = useState<string | null>(null);

    useEffect(() => {
        const token = sessionStorage.getItem('pending_invite_token');
        if (token) {
            setPendingInviteToken(token);
            apiService.validateInvitationContext(token)
                .then(data => {
                    if (data && data.valid && data.org_name) {
                        setInviteOrgName(data.org_name);
                    }
                })
                .catch(err => {
                    console.error('Error fetching invite details:', err);
                });
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { error: signInError } = await signIn(email, password);
            if (signInError) throw signInError;

            const pendingSpaceToken = localStorage.getItem('pending_space_token');

            if (inviteToken || pendingSpaceToken) {
                let session = null;
                for (let i = 0; i < 10; i++) {
                    const { data } = await supabase.auth.getSession();
                    if (data.session?.access_token) {
                        session = data.session;
                        break;
                    }
                    await new Promise(r => setTimeout(r, 300));
                }
                if (!session) throw new Error('Session not ready. Please try again.');

                if (pendingSpaceToken) {
                    const res = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({
                            action: 'accept_space_link',
                            token: pendingSpaceToken
                        })
                    });

                    const result = await res.json();
                    localStorage.removeItem('pending_space_token');

                    if (result.data?.success && result.data?.data?.spaceId) {
                        navigate(`/spaces/${result.data.data.spaceId}`, { replace: true });
                        return;
                    }

                    if (result.error) {
                        switch (result.error) {
                            case 'NOT_AUTHENTICATED':
                                navigate('/login', { replace: true });
                                return;
                            case 'INVALID_TOKEN':
                                setError('Invalid invite link');
                                return;
                            case 'LINK_EXPIRED':
                                setError('This invite has expired');
                                return;
                            case 'INVITE_FULL':
                                setError('Invite limit reached');
                                return;
                            case 'EMAIL_NOT_ALLOWED':
                                setError("Your email isn't on the allowlist");
                                return;
                            default:
                                setError(result.error || 'Failed to accept invitation');
                                return;
                        }
                    }
                }

                if (inviteToken) {
                    const inviteData = await apiService.acceptInvitation(inviteToken);
                    if (inviteData?.data?.role === 'client') {
                        navigate('/client/space/' + inviteData?.data?.spaceId, { replace: true });
                    } else {
                        navigate('/dashboard', { replace: true });
                    }
                } else {
                    navigate('/spaces/pending', { replace: true });
                }
            } else {
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to sign in');
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
                        <Heading level={1} className="text-3xl font-semibold">
                            Sign in
                        </Heading>
                        <Text variant="secondary" className="mt-2">
                            {inviteToken ? 'Sign in to accept your invitation.' : 'Welcome back to your workspace.'}
                        </Text>
                    </div>

                    {error && (
                        <div className="mb-6 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4 text-sm text-[#B42318]">
                            {error}
                        </div>
                    )}

                    {message === 'check_email' && (
                        <div className="mb-6 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4 text-sm text-[#0D0D0D]">
                            Check your email, confirm your account, then sign in here.
                        </div>
                    )}

                    {pendingInviteToken && (
                        <div className="mb-6 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4 text-sm text-[#0D0D0D]">
                            <div className="mb-2 flex items-center gap-2 text-[#6E6E80]">
                                <Mail size={16} />
                                <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Organization invite detected</span>
                            </div>
                            {inviteOrgName ? (
                                <p>Sign in to accept your invitation to join <strong>{inviteOrgName}</strong>.</p>
                            ) : (
                                <p>Sign in to accept your organization invitation.</p>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Work Email</label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    required
                                />
                            </div>
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Password</label>
                                    <button type="button" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80] hover:text-[#0D0D0D]">
                                        Forgot?
                                    </button>
                                </div>
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
                                    Log In <ArrowRight size={16} />
                                </div>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 border-t border-[#E5E5E5] pt-6 text-center">
                        <Text variant="secondary" className="text-sm">
                            Don't have an account?{' '}
                            <button
                                onClick={() => navigate(`/signup${window.location.search}`)}
                                className="mt-2 inline-flex items-center gap-2 font-medium text-[#0D0D0D] hover:text-[#6E6E80]"
                            >
                                <UserPlus size={14} /> Create account
                            </button>
                        </Text>
                    </div>
                </GlassCard>

                <div className="mt-8 flex items-center justify-center gap-2 text-[#6E6E80]">
                    <Shield size={12} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.24em]">Secure access</span>
                </div>
            </div>
        </div>
    );
}
