import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input } from '../UI';

export const LoginForm: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [organizationName, setOrganizationName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { signIn, signUp } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (authMode === 'login') {
                const { error } = await signIn(email, password);
                if (error) throw error;
            } else {
                const { error } = await signUp(email, password, {
                    full_name: fullName,
                    organization_name: organizationName
                });
                if (error) throw error;
            }
            onSuccess?.();
        } catch (err: any) {
            setError(err.message || `Failed to ${authMode === 'login' ? 'sign in' : 'create account'}`);
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setAuthMode(prev => prev === 'login' ? 'signup' : 'login');
        setError(null);
    };

    return (
        <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center p-6 font-sans">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg border border-[#D1D5DB] shadow-sm">
                <div className="text-center">
                    <h2 className="text-2xl font-semibold text-[#1D1D1D] tracking-tight">
                        {authMode === 'login' ? 'Welcome back' : 'Create your account'}
                    </h2>
                    <p className="text-[#565869] mt-2 text-sm">
                        {authMode === 'login' ? 'Sign in to your Space.inc workspace' : 'Join the most minimalist workspace today'}
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-[#ECECF1] rounded-md border border-[#D1D5DB]/30">
                    <button
                        onClick={() => setAuthMode('login')}
                        className={`flex-1 py-2 text-sm font-medium rounded transition-all ${authMode === 'login' ? 'bg-white text-[#1D1D1D] shadow-sm' : 'text-[#565869] hover:text-[#1D1D1D]'
                            }`}
                    >
                        Log In
                    </button>
                    <button
                        onClick={() => setAuthMode('signup')}
                        className={`flex-1 py-2 text-sm font-medium rounded transition-all ${authMode === 'signup' ? 'bg-white text-[#1D1D1D] shadow-sm' : 'text-[#565869] hover:text-[#1D1D1D]'
                            }`}
                    >
                        Sign Up
                    </button>
                </div>

                {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {authMode === 'signup' && (
                        <>
                            <div>
                                <Input
                                    label="Full Name"
                                    id="fullName"
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="John Doe"
                                    required
                                />
                            </div>
                            <div>
                                <Input
                                    label="Organization Name"
                                    id="organizationName"
                                    type="text"
                                    value={organizationName}
                                    onChange={(e) => setOrganizationName(e.target.value)}
                                    placeholder="Acme Space Corp"
                                    required
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <Input
                            label="Email"
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@company.com"
                            required
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-0">
                            {/* Label is handled by Input component */}
                        </div>
                        <Input
                            label="Password"
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                        {authMode === 'login' && (
                            <div className="flex justify-end mt-1">
                                <a href="#" className="text-xs text-[#10A37F] hover:underline transition-colors">
                                    Forgot password?
                                </a>
                            </div>
                        )}
                    </div>

                    <Button
                        variant="primary"
                        type="submit"
                        className="w-full h-10 mt-2 font-semibold"
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : (authMode === 'login' ? 'Continue' : 'Create Account')}
                    </Button>
                </form>

                <div className="text-sm text-center text-[#565869] pt-4 border-t border-[#D1D5DB]">
                    {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                    <button
                        type="button"
                        onClick={toggleMode}
                        className="text-[#10A37F] font-medium hover:underline"
                    >
                        {authMode === 'login' ? 'Sign up' : 'Log in'}
                    </button>
                </div>
            </div>
        </div>
    );
};
