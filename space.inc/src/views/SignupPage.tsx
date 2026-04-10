import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiService } from '@/services/apiService';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Heading, Text, GlassCard } from '@/components/UI/index';
import { Rocket, Shield, ArrowRight } from 'lucide-react';
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

    useEffect(() => {
        if (invitedEmail) setEmail(invitedEmail);
    }, [invitedEmail]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const pendingToken = localStorage.getItem('pending_space_token');
            const tokenToUse = inviteToken || pendingToken || undefined;

            const { error: signUpError } = await signUp(email, password, {
                full_name: fullName,
                invite_token: tokenToUse
            });

            if (signUpError) throw signUpError;

            if (tokenToUse) {
                // Poll for session — Supabase can take a tick to propagate
                let session = null;
                for (let i = 0; i < 15; i++) {
                    const { data } = await supabase.auth.getSession();
                    if (data.session?.access_token) { session = data.session; break; }
                    await new Promise(r => setTimeout(r, 400));
                }

                if (!session) {
                    // Should never happen with email confirmation disabled,
                    // but keep the token alive and redirect to login.
                    localStorage.setItem('pending_space_token', tokenToUse);
                    navigate('/login?message=check_email', { replace: true });
                    return;
                }

                // Call accept_space_link — this creates the space_memberships row
                const res = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}` 
                    },
                    body: JSON.stringify({ action: 'accept_space_link', token: tokenToUse })
                });

                const result = await res.json();
                localStorage.removeItem('pending_space_token');

                if (result.data?.success && result.data?.data?.spaceId) {
                    navigate(`/spaces/${result.data.data.spaceId}`, { replace: true });
                    return;
                }

                // Fallback for email-type invitations
                if (inviteToken) {
                    const inviteData = await apiService.acceptInvitation(inviteToken);
                    if (inviteData?.role === 'client') {
                        navigate('/spaces/pending', { replace: true });
                    } else {
                        navigate('/dashboard', { replace: true });
                    }
                    return;
                }

                // If we still couldn't resolve — send to dashboard, AuthContext will route
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
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6 font-sans">
            <div className="max-w-[450px] w-full relative">
                <div className="absolute -top-24 -left-24 h-64 w-64 bg-indigo-500/10 rounded-full blur-[100px] -z-10" />
                <GlassCard className="p-10 border-white/60 shadow-2xl backdrop-blur-xl rounded-3xl">
                    <div className="text-zinc-900 font-bold text-xl mb-10 tracking-tighter flex items-center justify-center gap-2 group cursor-default">
                        <div className="h-8 w-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white shadow-lg">
                            <Rocket size={18} />
                        </div>
                        <span>Space.inc</span>
                    </div>

                    <div className="text-center mb-10">
                        <Heading level={2} className="text-2xl font-black text-zinc-900 tracking-tight mb-2">
                            {inviteToken ? 'Finish Registration' : 'Create Account'}
                        </Heading>
                        <Text className="text-zinc-500 text-sm">
                            {inviteToken ? 'Complete your information to join the workspace' : 'Get started with the most minimalist workspace today'}
                        </Text>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold uppercase tracking-widest animate-[shake_0.5s_ease-in-out]">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-1">Full Name</label>
                                <Input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="John Doe"
                                    required
                                    className="bg-white/50 border-zinc-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl py-3"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-1">Email Address</label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    required
                                    readOnly={!!inviteToken}
                                    className={`bg-white/50 border-zinc-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl py-3 ${inviteToken ? 'bg-zinc-100 cursor-not-allowed opacity-60' : ''}`}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-1">Password</label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="bg-white/50 border-zinc-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl py-3"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full py-4 mt-4 font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 active:scale-95 transition-all text-xs"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    {inviteToken ? 'Join Organization' : 'Create Account'} <ArrowRight size={14} />
                                </div>
                            )}
                        </Button>
                    </form>

                    <div className="mt-10 pt-6 border-t border-zinc-100 text-center">
                        <Text className="text-zinc-400 text-xs">
                            Already have an account?{' '}
                            <button 
                                onClick={() => navigate(`/login${window.location.search}`)} 
                                className="text-zinc-900 font-black uppercase tracking-widest hover:underline"
                            >
                                Sign In
                            </button>
                        </Text>
                    </div>
                </GlassCard>
                
                <div className="mt-8 flex items-center justify-center gap-4 opacity-30">
                    <Shield size={14} className="text-zinc-400" />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">Zero Trust Identity</span>
                </div>
            </div>
        </div>
    );
}
