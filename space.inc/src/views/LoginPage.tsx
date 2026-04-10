import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiService } from '@/services/apiService';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Heading, Text, GlassCard } from '@/components/UI/index';
import { Rocket, Shield, ArrowRight, UserPlus } from 'lucide-react';
import { supabase, EDGE_FUNCTION_BASE_URL } from '@/lib/supabase';

export default function LoginPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { signIn } = useAuth();
    
    const inviteToken = searchParams.get('invite_token');
    const invitedEmail = searchParams.get('email');
    
    const [email, setEmail] = useState(invitedEmail || '');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { error: signInError } = await signIn(email, password);
            if (signInError) throw signInError;

            // Check for pending space token from localStorage (from /join/:token flow)
            const pendingSpaceToken = localStorage.getItem('pending_space_token');

            if (inviteToken || pendingSpaceToken) {
                // Ensure session is active before calling the RPC — signIn
                // resolves slightly before the JWT is available to rpc() calls.
                let session = null;
                for (let i = 0; i < 10; i++) {
                    const { data } = await supabase.auth.getSession();
                    if (data.session?.access_token) { session = data.session; break; }
                    await new Promise(r => setTimeout(r, 300));
                }
                if (!session) throw new Error('Session not ready. Please try again.');

                if (pendingSpaceToken) {
                    // Call accept_space_link edge function for space invites
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
                        // Redirect to the space-specific client path
                        navigate(`/spaces/${result.data.data.spaceId}`, { replace: true });
                        return;
                    }
                }

                // Fallback: handle email invite tokens via RPC
                if (inviteToken) {
                    const inviteData = await apiService.acceptInvitation(inviteToken);
                    if (inviteData?.role === 'client') {
                        navigate('/spaces/pending', { replace: true });
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
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6 font-sans selection:bg-indigo-500 selection:text-white">
            <div className="max-w-[450px] w-full relative">
                <div className="absolute -top-24 -left-24 h-64 w-64 bg-indigo-500/10 rounded-full blur-[100px] -z-10" />
                <GlassCard className="p-10 border-white/60 shadow-2xl backdrop-blur-xl rounded-3xl">
                    <div className="text-zinc-900 font-bold text-xl mb-12 tracking-tighter flex items-center justify-center gap-2 group cursor-default">
                        <div className="h-8 w-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white shadow-lg">
                            <Rocket size={18} />
                        </div>
                        <span>Space.inc</span>
                    </div>

                    <div className="text-center mb-10">
                        <Heading level={1} className="text-3xl font-black text-zinc-900 tracking-tight mb-2 uppercase">
                            Sign In
                        </Heading>
                        <Text className="text-zinc-500 text-sm font-medium">
                            {inviteToken ? 'Sign in to accept organizational invitation' : 'Welcome back to your minimal workspace'}
                        </Text>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold uppercase tracking-widest animate-[shake_0.5s_ease-in-out]">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-1">Work Email</label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    required
                                    className="bg-white/50 border-zinc-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl py-3 text-sm font-medium placeholder:text-zinc-300"
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2 ml-1">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400">Password</label>
                                    <button type="button" className="text-[10px] text-zinc-400 hover:text-zinc-900 font-bold uppercase tracking-widest transition-colors">Forgot?</button>
                                </div>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="bg-white/50 border-zinc-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl py-3 text-sm font-medium placeholder:text-zinc-300"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full py-4 mt-2 font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 active:scale-95 transition-all text-sm group"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    Log In <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                            )}
                        </Button>
                    </form>

                    <div className="mt-12 pt-8 border-t border-zinc-50 text-center">
                        <Text className="text-zinc-400 text-xs font-semibold">
                            Don't have an account?{' '}
                            <button 
                                onClick={() => navigate(`/signup${window.location.search}`)} 
                                className="text-zinc-900 font-black uppercase tracking-widest hover:underline flex items-center gap-2 mx-auto mt-2 transition-all hover:gap-3"
                            >
                                <UserPlus size={14} /> Create Account
                            </button>
                        </Text>
                    </div>
                </GlassCard>
                
                <div className="mt-10 flex items-center justify-center gap-6 opacity-30">
                    <div className="flex items-center gap-2">
                        <Shield size={12} className="text-zinc-400" />
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">End-to-End Ledger</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
