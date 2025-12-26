import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input } from '../UI';

export const LoginForm: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-gray-900 rounded-2xl border border-gray-800">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Welcome back</h2>
        <p className="text-gray-400">Sign in to your account</p>
      </div>

      {error && (
        <div className="p-4 text-sm text-red-500 bg-red-900/30 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <a href="#" className="text-sm text-emerald-400 hover:text-emerald-300">
              Forgot password?
            </a>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <div className="text-sm text-center text-gray-400">
        Don't have an account?{' '}
        <a href="#" className="text-emerald-400 hover:text-emerald-300">
          Sign up
        </a>
      </div>
    </div>
  );
};
