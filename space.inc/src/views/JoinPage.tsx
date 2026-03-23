import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { apiService } from '../../services/apiService'
import { Rocket, Clock, XCircle, LogIn, UserPlus } from 'lucide-react'
import { GlassCard, Button, Heading, Text } from '../../components/UI/index'

type JoinStatus = 'loading' | 'valid' | 'invalid';

interface InviteContext {
  valid: boolean;
  status: 'pending' | 'accepted' | 'revoked' | 'expired' | 'not_found';
  org_name?: string;
  inviter_name?: string;
  invited_email?: string;
  role?: string;
  expires_at?: string;
}

export default function JoinPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [context, setContext] = useState<InviteContext | null>(null)
  const [status, setStatus] = useState<JoinStatus>('loading')

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }

    const validate = async () => {
      try {
        const data: InviteContext = await apiService.validateInvitationContext(token)
        setContext(data)

        if (data.valid) {
          setStatus('valid')
        } else {
          setStatus('invalid')
        }
      } catch {
        setStatus('invalid')
      }
    }

    validate()
  }, [token])

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center py-12">
            <div className="h-12 w-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6" />
            <Text className="text-zinc-500">Verifying invitation...</Text>
          </div>
        )

      case 'valid': {
        const invitedEmail = context?.invited_email ?? ''
        return (
          <div className="text-center animate-[fadeIn_0.5s_ease-out]">
            <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm border border-emerald-100/50">
              <Rocket className="text-emerald-500" size={40} />
            </div>
            <Heading level={2} className="mb-4 text-zinc-900 tracking-tight">You're invited</Heading>
            {context && (
              <div className="mb-10 space-y-3">
                <p className="text-zinc-500 text-lg font-light leading-relaxed">
                  <strong>{context.inviter_name}</strong> has invited you to join{' '}
                  <span className="text-zinc-900 font-medium">{context.org_name}</span>
                </p>
                <div className="flex items-center justify-center gap-2">
                  <span className="px-3 py-1 bg-zinc-100 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-500 border border-zinc-200">
                    {context.role}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <Button
                variant="primary"
                className="w-full py-7 text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 group hover:scale-[1.02] transition-all"
                onClick={() => navigate(`/signup?invite_token=${token}&email=${encodeURIComponent(invitedEmail)}`)}
              >
                <UserPlus size={18} className="mr-3" /> Create Account
              </Button>

              <div className="flex items-center gap-4 py-2">
                <div className="h-px bg-zinc-100 flex-1" />
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">or</span>
                <div className="h-px bg-zinc-100 flex-1" />
              </div>

              <Button
                variant="outline"
                className="w-full py-6 text-xs font-black uppercase tracking-[0.2em] border-zinc-200 hover:bg-zinc-50"
                onClick={() => navigate(`/login?invite_token=${token}`)}
              >
                <LogIn size={18} className="mr-3" /> Sign In
              </Button>
            </div>

            <p className="text-[11px] text-zinc-400 mt-8 font-medium italic">
              Secure organizational invitation. One-time use ledger entry.
            </p>
          </div>
        )
      }

      case 'invalid': {
        const errorStatus = context?.status
        return (
          <div className="text-center py-12 animate-[fadeIn_0.5s_ease-out]">
            <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-100 shadow-inner">
              {errorStatus === 'expired' ? <Clock className="text-red-500" size={40} /> : <XCircle className="text-red-500" size={40} />}
            </div>
            <Heading level={2} className="mb-4 text-zinc-900 tracking-tight">
              {errorStatus === 'expired'
                ? 'Link Expired'
                : errorStatus === 'revoked'
                ? 'Link Revoked'
                : errorStatus === 'accepted'
                ? 'Already Used'
                : 'Invalid Link'}
            </Heading>
            <Text className="text-zinc-500 mb-10 font-light leading-relaxed">
              {errorStatus === 'expired'
                ? 'This invitation link has expired.'
                : errorStatus === 'revoked'
                ? 'The inviter has revoked this invitation.'
                : errorStatus === 'accepted'
                ? 'This invitation has already been accepted.'
                : 'This invitation link is invalid or does not exist.'}
            </Text>
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 text-[11px] text-zinc-500 font-medium italic">
              Contact the person who invited you to request a fresh invitation link.
            </div>
          </div>
        )
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6 font-sans selection:bg-emerald-500 selection:text-white">
      <div className="max-w-[480px] w-full relative">
        <div className="absolute -top-24 -left-24 h-64 w-64 bg-emerald-500/10 rounded-full blur-[100px] -z-10" />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 bg-blue-500/10 rounded-full blur-[100px] -z-10" />

        <GlassCard className="p-12 px-10 border-white/60 shadow-2xl shadow-zinc-200/50 backdrop-blur-xl rounded-3xl">
          <div className="text-zinc-900 font-bold text-xl mb-12 tracking-tighter flex items-center justify-center gap-2 group cursor-default">
            <div className="h-8 w-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white group-hover:rotate-12 transition-transform shadow-lg">
              <Rocket size={18} />
            </div>
            <span>Space.inc</span>
          </div>

          {renderContent()}
        </GlassCard>
      </div>
    </div>
  )
}
