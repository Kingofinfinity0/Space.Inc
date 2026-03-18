import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/apiService';
import { Heading, Text, Button, GlassCard, SkeletonLoader } from '../UI';
import { ShieldAlert, Rocket, CheckCircle } from 'lucide-react';
import { LoginForm } from '../auth/LoginForm';

const JoinView = () => {
    const { user, refreshCapabilities } = useAuth();
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'accepting' | 'accepted'>('loading');
    const [context, setContext] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [token, setToken] = useState<string | null>(null);

    // Step 1: extract token from URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('token');
        if (!t) {
            setStatus('invalid');
            setErrorMsg('No invitation token found in this link.');
            return;
        }
        setToken(t);
    }, []);

    // Step 2: validate token whenever we have it
    useEffect(() => {
        if (!token) return;
        validateToken(token);
    }, [token]);

    // Step 3: if user logs in while we have a valid token, auto-accept
    useEffect(() => {
        if (user && token && status === 'valid') {
            acceptInvitation(token);
        }
    }, [user, token, status]);

    const validateToken = async (t: string) => {
        setStatus('loading');
        try {
            const { data, error } = await apiService.validateInvitationContext(t);
            if (error) throw new Error(error.message || 'Failed to validate invitation');
            if (data?.valid) {
                setContext(data);
                setStatus('valid');
                // If already logged in, go straight to accept
                if (user) acceptInvitation(t);
            } else {
                setStatus('invalid');
                setErrorMsg(data?.error || 'This invitation link is invalid or has expired.');
            }
        } catch (err: any) {
            setStatus('invalid');
            setErrorMsg(err.message || 'Error validating invitation.');
        }
    };

    const acceptInvitation = async (t: string) => {
        setStatus('accepting');
        try {
            const { data, error } = await apiService.acceptInvitation2(t);
            if (error) throw new Error(error.message || 'Failed to accept invitation');

            // Refresh capabilities so the app immediately knows the new role
            await refreshCapabilities();

            setStatus('accepted');

            // Clean the URL then redirect
            window.history.replaceState({}, document.title, '/');
            setTimeout(() => {
                window.location.href = data?.redirect_path || '/';
            }, 1500);
        } catch (err: any) {
            setStatus('invalid');
            setErrorMsg('Failed to accept invitation: ' + (err.message || ''));
        }
    };

    // ── Loading ────────────────────────────────────────────────────────────
    if (status === 'loading' || status === 'accepting') {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-zinc-50 p-4">
                <GlassCard className="max-w-md w-full p-8 text-center border-zinc-200">
                    <Rocket className="text-emerald-500 animate-bounce mx-auto mb-6" size={40} />
                    <Heading level={3} className="mb-3 text-zinc-900">
                        {status === 'accepting' ? 'Setting up your workspace...' : 'Validating invitation...'}
                    </Heading>
                    <SkeletonLoader height="12px" borderRadius="4px" className="w-3/4 mx-auto" />
                </GlassCard>
            </div>
        );
    }

    // ── Invalid ────────────────────────────────────────────────────────────
    if (status === 'invalid') {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-zinc-50 p-4">
                <GlassCard className="max-w-md w-full p-8 text-center border-red-100 shadow-xl">
                    <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert className="text-red-500" size={32} />
                    </div>
                    <Heading level={2} className="text-zinc-900 mb-2">Invalid Invitation</Heading>
                    <Text className="text-zinc-500 mb-8">{errorMsg}</Text>
                    <Button variant="primary" className="w-full" onClick={() => window.location.assign('/')}>
                        Go to Homepage
                    </Button>
                </GlassCard>
            </div>
        );
    }

    // ── Accepted ───────────────────────────────────────────────────────────
    if (status === 'accepted') {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-zinc-50 p-4">
                <GlassCard className="max-w-md w-full p-8 text-center border-emerald-100 shadow-xl">
                    <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="text-emerald-500" size={32} />
                    </div>
                    <Heading level={2} className="text-zinc-900 mb-2">Welcome Aboard!</Heading>
                    <Text className="text-zinc-500">Redirecting you to your workspace...</Text>
                </GlassCard>
            </div>
        );
    }

    // ── Valid but not logged in — show login/signup ────────────────────────
    return (
        <div className="min-h-screen w-full flex bg-zinc-50">
            {/* Left branding pane */}
            <div className="hidden lg:flex flex-col flex-1 bg-zinc-900 text-white p-12 justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-black pointer-events-none" />
                <div className="relative z-10 max-w-md">
                    <div className="h-12 w-12 bg-emerald-500 rounded-xl flex items-center justify-center mb-8 shadow-lg shadow-emerald-500/20">
                        <Rocket className="text-white" size={28} />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-4">
                        You've been invited!
                    </h1>
                    {context && (
                        <p className="text-lg text-zinc-300 leading-relaxed mb-8">
                            <strong className="text-white">{context.inviter_name}</strong> has invited you to join{' '}
                            <strong className="text-white">{context.org_name}</strong> as a{' '}
                            <span className="text-emerald-400 font-semibold">{context.role}</span>.
                        </p>
                    )}
                    <div className="flex items-center gap-2 text-zinc-400 text-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Link expires in 72 hours
                    </div>
                </div>
            </div>

            {/* Right login/signup pane */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50">
                <div className="w-full max-w-md">
                    {/* Mobile header */}
                    <div className="lg:hidden mb-8 text-center">
                        <div className="h-12 w-12 mx-auto bg-emerald-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                            <Rocket className="text-white" size={28} />
                        </div>
                        {context && (
                            <>
                                <h1 className="text-2xl font-bold text-zinc-900 mb-1">
                                    Join {context.org_name}
                                </h1>
                                <p className="text-zinc-500 text-sm">
                                    Invited by {context.inviter_name} as {context.role}
                                </p>
                            </>
                        )}
                    </div>

                    <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <p className="text-sm text-emerald-800 text-center">
                            Sign in or create an account to accept your invitation
                        </p>
                    </div>

                    <LoginForm
                        onSuccess={() => {
                            // Auth state change will trigger the useEffect above
                            // which calls acceptInvitation automatically
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default JoinView;