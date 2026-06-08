import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, GlassCard, Heading, Input, Text } from '@/components/UI/index';
import { VeroMark } from '@/components/brand/VeroLogo';
import { getRouteFromReadiness } from '@/lib/contextReadiness';

type AuthMode = 'login' | 'signup';

type InviteAuthSwitcherProps = {
  initialMode: AuthMode;
  redirectTo: string;
};

const AUTH_CONTENT_SWAP_MS = 380;

export default function InviteAuthSwitcher({ initialMode, redirectTo }: InviteAuthSwitcherProps) {
  const navigate = useNavigate();
  const { signIn, signUp, refreshContexts } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [targetMode, setTargetMode] = useState<AuthMode>(initialMode);
  const [isSwapping, setIsSwapping] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setTargetMode(initialMode);
    setIsSwapping(false);
  }, [initialMode]);

  const switchMode = (nextMode: AuthMode) => {
    if (nextMode === targetMode || isSwapping) return;

    setError(null);
    setTargetMode(nextMode);
    setIsSwapping(true);
    window.setTimeout(() => {
      setMode(nextMode);
      setIsSwapping(false);
    }, AUTH_CONTENT_SWAP_MS);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error: signInError } = await signIn(email, password);
        if (signInError) throw signInError;
        navigate(redirectTo, { replace: true });
        return;
      }

      const { error: signUpError } = await signUp(
        email,
        password,
        {
          full_name: fullName,
          organization_name: '',
        },
        {
          emailRedirectTo: `${window.location.origin}${redirectTo}`,
        },
      );

      if (signUpError) throw signUpError;

      const contexts = await refreshContexts();
      const route = getRouteFromReadiness(contexts, redirectTo);
      navigate(route || redirectTo, { replace: true });
    } catch (err: any) {
      setError(err.message || (mode === 'login' ? 'Failed to sign in' : 'Failed to create account'));
    } finally {
      setLoading(false);
    }
  };

  const visibleMode = targetMode;
  const isLogin = mode === 'login';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF] p-6">
      <div className="w-full max-w-[460px]">
        <GlassCard className="min-h-[560px] p-8 transition-[min-height,box-shadow,transform] duration-[920ms] ease-[cubic-bezier(0.2,0.86,0.24,1)] md:p-10">
          <div className="mb-10 flex items-center justify-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-black text-white">
              <VeroMark tone="light" className="h-6 w-6" />
            </div>
            <span className="text-lg font-semibold tracking-[-0.03em] text-[#0D0D0D]">Vero</span>
          </div>

          <div className="mb-8 text-center">
            <Heading level={1} className="text-3xl font-semibold">
              {visibleMode === 'login' ? 'Sign in' : 'Sign up'}
            </Heading>
            <Text variant="secondary" className="mt-2">
              {visibleMode === 'login' ? 'Continue to your invitation.' : 'Create an account to continue to your invitation.'}
            </Text>
          </div>

          <div className="relative mb-6 grid grid-cols-2 overflow-hidden rounded-[14px] bg-[#F2F2F3] p-1">
            <span
              className="absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-[11px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-transform duration-[920ms] ease-[cubic-bezier(0.2,0.86,0.24,1)]"
              style={{ transform: visibleMode === 'signup' ? 'translateX(100%)' : 'translateX(0)' }}
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`relative z-10 rounded-[11px] px-3 py-2 text-sm font-semibold transition-colors duration-500 ease-[cubic-bezier(0.2,0.86,0.24,1)] ${
                visibleMode === 'login' ? 'text-[#0D0D0D]' : 'text-[#6E6E80] hover:text-[#0D0D0D]'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`relative z-10 rounded-[11px] px-3 py-2 text-sm font-semibold transition-colors duration-500 ease-[cubic-bezier(0.2,0.86,0.24,1)] ${
                visibleMode === 'signup' ? 'text-[#0D0D0D]' : 'text-[#6E6E80] hover:text-[#0D0D0D]'
              }`}
            >
              Sign up
            </button>
          </div>

          {error && (
            <div className="mb-6 rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4 text-sm text-[#B42318]">
              {error}
            </div>
          )}

          <form
            key={mode}
            onSubmit={handleSubmit}
            className={`space-y-5 ${
              isSwapping
                ? 'pointer-events-none animate-[auth-content-out_380ms_cubic-bezier(0.2,0.86,0.24,1)_forwards]'
                : 'animate-[auth-content-in_820ms_cubic-bezier(0.2,0.86,0.24,1)]'
            }`}
          >
            <div className="space-y-4">
              {!isLogin ? (
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Full Name</label>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="John Doe"
                    required={!isLogin}
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">
                  {isLogin ? 'Work Email' : 'Email Address'}
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  required
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">Password</label>
                  {isLogin ? (
                    <button type="button" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80] hover:text-[#0D0D0D]">
                      Forgot?
                    </button>
                  ) : null}
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                  required
                />
              </div>
            </div>

            <Button type="submit" variant="primary" className="w-full" disabled={loading || isSwapping}>
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <div className="flex items-center justify-center gap-2">
                  {isLogin ? 'Log In' : 'Sign up'} <ArrowRight size={isLogin ? 16 : 14} />
                </div>
              )}
            </Button>
          </form>

          <div className="mt-8 border-t border-[#E5E5E5] pt-6 text-center">
            <Text variant="secondary" className="text-sm">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => switchMode(isLogin ? 'signup' : 'login')}
                className="inline-flex items-center gap-2 font-medium text-[#0D0D0D] hover:text-[#6E6E80]"
              >
                {isLogin ? <UserPlus size={14} /> : null}
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </Text>
          </div>
        </GlassCard>

        <div className="mt-8 flex items-center justify-center gap-2 text-[#6E6E80]">
          <Shield size={12} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.24em]">Secure invitation</span>
        </div>
      </div>
    </div>
  );
}
