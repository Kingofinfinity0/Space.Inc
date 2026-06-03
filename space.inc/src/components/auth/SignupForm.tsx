import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input } from '../UI';

export const SignupForm = () => {
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { signUp } = useAuth();
    const navigate = useNavigate();

    const paymentSessionId = searchParams.get('session_id');
    const paymentStatus = searchParams.get('payment_status');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (!paymentSessionId || paymentStatus !== 'success') {
                throw new Error('Invalid payment session. Please complete your purchase first.');
            }

            const { error: signUpError } = await signUp(email, password, {
                payment_session_id: paymentSessionId,
                payment_status: paymentStatus,
            });

            if (signUpError) throw signUpError;
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
                        Create your account
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-500">
                        Complete your registration to get started
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
                            />
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
                            {loading ? 'Creating account...' : 'Create Account'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SignupForm;
