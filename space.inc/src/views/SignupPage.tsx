import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Heading, Text, GlassCard } from '@/components/UI/index';
import { Rocket, Shield, ArrowRight } from 'lucide-react';
import { getRouteFromReadiness } from '@/lib/contextReadiness';
import { getSafeInviteRedirect } from '@/lib/inviteRedirect';
import InviteAuthSwitcher from './InviteAuthSwitcher';

export default function SignupPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { signUp, refreshContexts } = useAuth();
    const redirectParam = searchParams.get('redirectTo');
    const inviteRedirectPath = getSafeInviteRedirect(redirectParam);
    const isInviteFlow = Boolean(inviteRedirectPath);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [organizationName, setOrganizationName] = useState('');
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
            const { error: signUpError } = await signUp(email, password, {
                full_name: fullName,
                organization_name: organizationName,
            }, {
                emailRedirectTo: redirectTo ? `${window.location.origin}${redirectTo}` : undefined,
            });

            if (signUpError) throw signUpError;

            if (redirectTo) {
                navigate(redirectTo, { replace: true });
                return;
            }

            const contexts = await refreshContexts();
            const route = getRouteFromReadiness(contexts, '/dashboard');
            navigate(route || '/spaces/pending', { replace: true });
        } catch (err: any) {
            setError(err.message || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    const goToLogin = () => navigate(redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/login');

    if (isInviteFlow && inviteRedirectPath) {
        return <InviteAuthSwitcher initialMode="signup" redirectTo={inviteRedirectPath} />;
    }

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
                            Sign up
                        </Heading>
                        <Text variant="secondary" className="mt-2">
                            {isInviteFlow ? 'Create an account to continue to your invitation.' : 'Get started with a cleaner client workspace.'}
                        </Text>
                    </div>

                    {isInviteFlow ? (
                        <div className="relative mb-6 grid grid-cols-2 overflow-hidden rounded-[14px] bg-[#F2F2F3] p-1">
                            <span
                                className="absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-[11px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-transform duration-[920ms] ease-[cubic-bezier(0.2,0.86,0.24,1)]"
                                style={{
                                    transform: 'translateX(100%)',
                                    animation: 'auth-tab-slide-right 920ms cubic-bezier(0.2,0.86,0.24,1)',
                                }}
                                aria-hidden="true"
                            />
                            <button
                                type="button"
                                onClick={goToLogin}
                                className="relative z-10 rounded-[11px] px-3 py-2 text-sm font-semibold text-[#6E6E80] transition-colors duration-500 ease-[cubic-bezier(0.2,0.86,0.24,1)] hover:text-[#0D0D0D]"
                            >
                                Sign in
                            </button>
                            <button
                                type="button"
                                className="relative z-10 rounded-[11px] px-3 py-2 text-sm font-semibold text-[#0D0D0D]"
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

                    <form onSubmit={handleSubmit} className="animate-[auth-content-in_760ms_cubic-bezier(0.2,0.86,0.24,1)] space-y-5">
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
                                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Organization Name</label>
                                <Input
                                    type="text"
                                    value={organizationName}
                                    onChange={(e) => setOrganizationName(e.target.value)}
                                    placeholder="Acme Studio"
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
                                    Sign up <ArrowRight size={14} />
                                </div>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 border-t border-[#E5E5E5] pt-6 text-center">
                        <Text variant="secondary" className="text-sm">
                            Already have an account?{' '}
                            <button
                                type="button"
                                onClick={goToLogin}
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
