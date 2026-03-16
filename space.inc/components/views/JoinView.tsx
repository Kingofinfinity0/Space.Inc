import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/apiService';
import { Heading, Text, Button, GlassCard, SkeletonLoader } from '../UI';
import { ShieldAlert, Rocket } from 'lucide-react';
import { LoginForm } from '../auth/LoginForm';

const JoinView = () => {
    const { user } = useAuth();
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'accepted'>('loading');
    const [context, setContext] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState('');

    const [invitationId, setInvitationId] = useState<string | null>(null);

    useEffect(() => {
        const getInvitationId = () => {
            const params = new URLSearchParams(window.location.search);
            const idFromUrl = params.get('invitation_id') || params.get('token');
            if (idFromUrl) return idFromUrl;
            
            // Or from session if logged in
            if (user?.app_metadata?.invitation_id) {
                return user.app_metadata.invitation_id;
            }
            return null;
        };

        const id = getInvitationId();
        if (id) {
            setInvitationId(id);
            validateContext(id);
        } else {
            setStatus('invalid');
            setErrorMsg('No invitation link found.');
        }
    }, [user]);

    const validateContext = async (id: string) => {
        try {
            const { data, error } = await apiService.validateInvitationContext(id);
            if (error) throw error;
            if (data.valid) {
                setContext(data);
                setStatus('valid');
                
                // If already logged in when reaching this valid link, trigger accept
                if (user) {
                    handleAccept(id);
                }
            } else {
                setStatus('invalid');
                setErrorMsg(data.error || 'Invalid or expired invitation.');
            }
        } catch (err: any) {
            setStatus('invalid');
            setErrorMsg(err.message || 'Error validating invitation.');
        }
    };

    const handleAccept = async (id: string) => {
        setStatus('loading');
        try {
            const { data, error } = await apiService.acceptInvitation2(id); // Need to create this
            if (error) throw error;
            
            // Redirect based on role
            setStatus('accepted');
            window.location.href = data.redirect_path || '/';
        } catch (err: any) {
            setStatus('invalid');
            setErrorMsg('Failed to accept invitation. ' + (err.message || ''));
        }
    };

    if (status === 'loading') {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-zinc-50 p-4">
                <GlassCard className="max-w-md w-full p-8 text-center border-zinc-200">
                    <Rocket className="text-emerald-500 animate-bounce mx-auto mb-6" size={40} />
                    <Heading level={3} className="mb-2">Preparing your workspace...</Heading>
                    <SkeletonLoader height="20px" borderRadius="4px" />
                </GlassCard>
            </div>
        );
    }

    if (status === 'invalid') {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-zinc-50 p-4">
                <GlassCard className="max-w-md w-full p-8 text-center border-red-100 shadow-xl">
                    <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert className="text-red-500" size={32} />
                    </div>
                    <Heading level={2} className="text-zinc-900 mb-2">Invalid Invitation</Heading>
                    <Text className="text-zinc-500 mb-8">{errorMsg}</Text>
                    <Button variant="primary" className="w-full" onClick={() => window.location.assign('/')}>Go to Homepage</Button>
                </GlassCard>
            </div>
        );
    }

    if (status === 'accepted') {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-zinc-50 p-4">
                <GlassCard className="max-w-md w-full p-8 text-center border-zinc-200">
                    <Rocket className="text-emerald-500 mx-auto mb-6" size={48} />
                    <Heading level={2} className="mb-2 text-zinc-900">Welcome Aboard!</Heading>
                    <Text className="text-zinc-500">Routing you to your workspace...</Text>
                </GlassCard>
            </div>
        );
    }

    // Status is 'valid' but user is NOT logged in (if they were, it would handleAccept)
    return (
        <div className="min-h-screen w-full flex bg-zinc-50">
            {/* Left branding pane */}
            <div className="hidden lg:flex flex-col flex-1 bg-zinc-900 text-white p-12 justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-black pointer-events-none" />
                <div className="relative z-10 max-w-md">
                    <div className="h-12 w-12 bg-emerald-500 rounded-xl flex items-center justify-center mb-8 shadow-lg shadow-emerald-500/20">
                        <Rocket className="text-white" size={28} />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-4">You've been invited!</h1>
                    <p className="text-lg text-zinc-300 leading-relaxed mb-8">
                        <strong>{context?.inviter_name}</strong> invited you to join <strong>{context?.org_name}</strong> as a {context?.role}.
                    </p>
                </div>
            </div>

            {/* Right login/signup pane */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50">
                <div className="w-full max-w-md">
                    <div className="lg:hidden mb-8 text-center">
                        <div className="h-12 w-12 mx-auto bg-emerald-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                            <Rocket className="text-white" size={28} />
                        </div>
                        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Join {context?.org_name}</h1>
                        <p className="text-zinc-500">Invited by {context?.inviter_name}</p>
                    </div>

                    <LoginForm 
                        onSuccess={() => {
                            window.location.reload(); 
                        }} 
                    />
                </div>
            </div>
        </div>
    );
};
export default JoinView;
