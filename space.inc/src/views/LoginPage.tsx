import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Heading, Text, GlassCard } from '@/components/UI/index';
import { Shield, ArrowRight, UserPlus } from 'lucide-react';
import { VeroMark } from '@/components/brand/VeroLogo';
import { getSafeInviteRedirect } from '@/lib/inviteRedirect';
import InviteAuthSwitcher from './InviteAuthSwitcher';

export default function LoginPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { signIn } = useAuth();

    const message = searchParams.get('message');
    const redirectParam = searchParams.get('redirectTo');
    const inviteRedirectPath = getSafeInviteRedirect(redirectParam);
    const isInviteFlow = Boolean(inviteRedirectPath);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [redirectTo, setRedirectTo] = useState<string | null>(null);

    useEffect(() => {
        setRedirectTo(getSafeInviteRedirect(redirectParam));
    }, [redirectParam]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { error: signInError } = await signIn(email, password);
            if (signInError) throw signInError;
            navigate(redirectTo || '/dashboard', { replace: true });
        } catch (err: any) {
            setError(err.message || 'Failed to sign in');
        } finally {
            setLoading(false);
        }
    };

    const goToSignup = () => navigate(redirectTo ? `/signup?redirectTo=${encodeURIComponent(redirectTo)}` : '/signup');

    if (isInviteFlow && inviteRedirectPath) {
        return <InviteAuthSwitcher initialMode="login" redirectTo={inviteRedirectPath} />;
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF] p-6">
            <div className="w-full max-w-[460px]">
                <GlassCard className="p-8 md:p-10">
                    <div className="mb-10 flex items-center justify-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-black text-white">
                            <VeroMark tone="light" className="h-6 w-6" />
                        </div>
                        <span className="text-lg font-semibold tracking-[-0.03em] text-[#0D0D0D]">Vero</span>
                    </div>

                    <div className="mb-8 text-center">
                        <Heading level={1} className="text-3xl font-semibold">
                            Sign in
                        </Heading>
                        <Text variant="secondary" className="mt-2">
                            {isInviteFlow ? 'Continue to your invitation.' : 'Welcome back to your workspace.'}
                        </Text>
                    </div>

                    {isInviteFlow ? (
                        <div className="relative mb-6 grid grid-cols-2 overflow-hidden rounded-[14px] bg-[#F2F2F3] p-1">
                            <span
                                className="absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-[11px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-transform duration-[920ms] ease-[cubic-bezier(0.2,0.86,0.24,1)]"
                                style={{ animation: 'auth-tab-slide-left 920ms cubic-bezier(0.2,0.86,0.24,1)' }}
                                aria-hidden="true"
                            />
                            <button
                                type="button"
                                className="relative z-10 rounded-[11px] px-3 py-2 text-sm font-semibold text-[#0D0D0D]"
                            >
                                Sign in
                            </button>
                            <button
                                type="button"
                                onClick={goToSignup}
                                className="relative z-10 rounded-[11px] px-3 py-2 text-sm font-semibold text-[#6E6E80] transition-colors duration-500 ease-[cubic-bezier(0.2,0.86,0.24,1)] hover:text-[#0D0D0D]"
                            >
                                Sign up
                            </button>
                        </div>
                    ) : null}

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

                    <form onSubmit={handleSubmit} className="animate-[auth-content-in_760ms_cubic-bezier(0.2,0.86,0.24,1)] space-y-5">
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
                            Don&apos;t have an account?{' '}
                            <button
                                type="button"
                                onClick={goToSignup}
                                className="mt-2 inline-flex items-center gap-2 font-medium text-[#0D0D0D] hover:text-[#6E6E80]"
                            >
                                <UserPlus size={14} /> Sign up
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
