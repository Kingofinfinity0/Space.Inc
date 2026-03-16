import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input } from '../UI';

export const Auth: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let result;
      if (isSignUp) {
        result = await signUp(email, password, { name: email.split('@')[0] });
      } else {
        result = await signIn(email, password);
      }
      
      if (result.error) throw result.error;
      // Success - AuthContext will handle the state change
    } catch (err: any) {
      setError(err.message || `Failed to ${isSignUp ? 'sign up' : 'sign in'}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setEmail('');
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Auth Card */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8 space-y-6">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">
              {isSignUp ? 'Create account' : 'Welcome back'}
            </h2>
            <p className="text-gray-400">
              {isSignUp ? 'Sign up to get started' : 'Sign in to your account'}
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 text-sm text-red-500 bg-red-900/30 rounded-lg">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
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

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Password
                </label>
                {!isSignUp && (
                  <a href="#" className="text-sm text-emerald-400 hover:text-emerald-300">
                    Forgot password?
                  </a>
                )}
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

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? 
                (isSignUp ? 'Creating account...' : 'Signing in...') 
                : 
                (isSignUp ? 'Sign up' : 'Sign in')
              }
            </Button>
          </form>

          {/* Toggle Link */}
          <div className="text-sm text-center text-gray-400">
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <button 
                  type="button" 
                  onClick={toggleMode}
                  className="text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{' '}
                <button 
                  type="button" 
                  onClick={toggleMode}
                  className="text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
