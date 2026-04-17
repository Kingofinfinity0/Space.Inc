import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input } from '../UI';
import { apiService } from '../../services/apiService';

export const SignupForm = () => {
    const [searchParams] = useSearchParams();
    const inviteToken = searchParams.get('invite_token');
    const invitedEmail = searchParams.get('email');
    
    const [email, setEmail] = useState(invitedEmail || '');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { signUp } = useAuth();
    const navigate = useNavigate();

    const paymentSessionId = searchParams.get('session_id');
    const paymentStatus = searchParams.get('payment_status');

    useEffect(() => {
        if (invitedEmail) {
            setEmail(invitedEmail);
        }
    }, [invitedEmail]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Only require payment if NOT an invited user
            if (!inviteToken) {
                if (!paymentSessionId || paymentStatus !== 'success') {
                    throw new Error('Invalid payment session. Please complete your purchase first.');
                }
            }

            const { error: signUpError } = await signUp(email, password, {
                payment_session_id: paymentSessionId || undefined,
                payment_status: paymentStatus || undefined,
                invite_token: inviteToken || undefined
            });

            if (signUpError) throw signUpError;
            
            // If invited, accept the invitation now that we have an account
            if (inviteToken) {
                try {
                    await apiService.acceptInvitation(inviteToken);
                    navigate('/login?message=account_ready');
                    return;
                } catch (acceptErr: any) {
                    console.error('Failed to accept invitation after signup:', acceptErr);
                    // Still navigate to onboarding but maybe with a warning?
                    // Or since the user is signed up, they can try again from the join link
                    navigate('/login?message=check_invitation');
                    return;
                }
            }

            // Standard flow
            navigate('/onboarding');
        } catch (err: any) {
            setError(err.message || 'Failed to create an account');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#FFFFFF] py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-[8px] border border-[#E5E5E5] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
                        {inviteToken ? 'Complete Registration' : 'Create your account'}
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-500">
                        {inviteToken 
                            ? `Joining ${invitedEmail ? invitedEmail : 'the organization'}`
                            : 'Complete your registration to get started'}
                    </p>
                </div>
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg animate-[shake_0.5s_ease-in-out]">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700 font-medium">{error}</p>
                            </div>
                        </div>
                    </div>
                )}
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md -space-y-px">
                        <div className="mb-4">
                            <label htmlFor="email-address" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                                Email Address
                            </label>
                            <Input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email address"
                                readOnly={!!inviteToken}
                                className={inviteToken ? 'bg-gray-100 cursor-not-allowed border-gray-200 text-gray-500' : ''}
                            />
                            {inviteToken && (
                                <p className="text-[10px] text-gray-400 mt-1 italic">Email is fixed for this invitation.</p>
                            )}
                        </div>
                        <div>
                            <label htmlFor="password" id="password-label" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                                Password
                            </label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                value={password}
                                onChange={(passwordVal) => setPassword(passwordVal.target.value)}
                                placeholder="Create a secure password"
                                aria-labelledby="password-label"
                            />
                        </div>
                    </div>

                    <div>
                        <Button
                            type="submit"
                            variant="primary"
                        className="w-full flex justify-center py-4 px-4 border border-transparent rounded-[6px] text-sm font-semibold uppercase tracking-widest text-white bg-black hover:bg-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-all active:scale-95"
                            disabled={loading}
                        >
                            {loading ? (inviteToken ? 'Configuring Access...' : 'Creating account...') : (inviteToken ? 'Accept & Complete' : 'Create Account')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SignupForm;
