import { useEffect, useState } from 'react';
import { apiService } from '../../services/apiService';
import { supabase } from '../../lib/supabase';

export default function JoinView() {
    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    const [context, setContext] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'signup' | 'login'>('signup');

    useEffect(() => {
        if (!token) { setError('No invitation token found.'); return; }
        apiService.validateInvitation(token).then(({ data }) => {
            if (!data?.valid) setError(data?.error || 'Invalid invitation');
            else setContext(data);
        });
    }, [token]);

    const handleAuth = async () => {
        setLoading(true);
        try {
            if (mode === 'signup') {
                const { error: e } = await supabase.auth.signUp({ email, password });
                if (e) throw e;
            } else {
                const { error: e } = await supabase.auth.signInWithPassword({ email, password });
                if (e) throw e;
            }
            // Now authenticated — accept the invitation
            const { data, error: acceptErr } = await apiService.acceptInvitation(token);
            if (acceptErr) throw new Error(acceptErr.message);
            window.location.href = data?.redirect_path || '/dashboard';
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (error) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center p-8 max-w-md">
                <p className="text-red-500 text-lg mb-4">{error}</p>
                <a href="/" className="text-blue-500 underline">Go home</a>
            </div>
        </div>
    );

    if (!context) return (
        <div className="min-h-screen flex items-center justify-center">
            <p className="text-gray-500">Validating invitation...</p>
        </div>
    );

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
                <h1 className="text-2xl font-bold mb-1">You're invited</h1>
                <p className="text-gray-500 mb-6">
                    <strong>{context.inviter_name}</strong> invited you to join{' '}
                    <strong>{context.org_name}</strong> as <strong>{context.role}</strong>
                </p>
                <div className="flex gap-2 mb-4">
                    <button onClick={() => setMode('signup')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'signup' ? 'bg-black text-white' : 'bg-gray-100'}`}>
                        Create account
                    </button>
                    <button onClick={() => setMode('login')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'login' ? 'bg-black text-white' : 'bg-gray-100'}`}>
                        I have an account
                    </button>
                </div>
                <input type="email" placeholder="Email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border rounded-lg px-4 py-2 mb-3 text-sm" />
                <input type="password" placeholder="Password" value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full border rounded-lg px-4 py-2 mb-4 text-sm" />
                <button onClick={handleAuth} disabled={loading}
                    className="w-full bg-black text-white py-2 rounded-lg font-medium disabled:opacity-50">
                    {loading ? 'Please wait...' : mode === 'signup' ? 'Create account & join' : 'Sign in & join'}
                </button>
                {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
            </div>
        </div>
    );
}