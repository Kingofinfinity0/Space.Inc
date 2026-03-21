import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { apiService } from '../../services/apiService'
import { Rocket, Shield, Clock, AlertCircle, XCircle, CheckCircle, ArrowRight } from 'lucide-react'
import { GlassCard, Button, Heading, Text } from '../../components/UI/index'

type JoinStatus = 'loading' | 'pending' | 'accepted' | 'revoked' | 'expired' | 'not_found' | 'error' | 'accepting' | 'success';

export default function JoinPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [context, setContext] = useState<any>(null)
  const [status, setStatus] = useState<JoinStatus>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('not_found')
      return
    }

    const validate = async () => {
      try {
        const data = await apiService.validateInvitationContext(token)
        setContext(data)
        
        // Map backend status to our frontend status
        if (data.status === 'accepted') setStatus('accepted')
        else if (data.status === 'revoked') setStatus('revoked')
        else if (data.status === 'expired') setStatus('expired')
        else setStatus('pending')
        
      } catch (err: any) {
        setStatus('not_found')
        setErrorMsg(err.message || 'Invalid link')
      }
    }

    validate()
  }, [token])

  const handleAccept = async () => {
    if (!token) return
    setStatus('accepting')

    try {
      await apiService.acceptInvitation(token)
      setStatus('success')
      
      // Post-acceptance flow: 
      // In a real app, we might have an auto-login token or session here.
      // For now, redirect to login after a brief delay.
      setTimeout(() => navigate('/login'), 2500)
    } catch (err: any) {
      setStatus('error')
      setErrorMsg(err.message || 'Failed to accept invitation')
    }
  }

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center py-12">
            <div className="h-12 w-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6" />
            <Text className="text-zinc-500">Decrypting invitation payload...</Text>
          </div>
        )

      case 'pending':
        return (
          <div className="text-center animate-[fadeIn_0.5s_ease-out]">
            <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8">
              <Rocket className="text-emerald-500" size={40} />
            </div>
            <Heading level={2} className="mb-4 text-zinc-900">You're invited</Heading>
            {context && (
              <p className="text-zinc-500 text-lg font-light leading-relaxed mb-10">
                <strong>{context.inviter_name}</strong> has invited you to join{' '}
                <span className="text-zinc-900 font-medium">{context.org_name}</span> as a{' '}
                <span className="inline-block px-2 py-0.5 bg-zinc-100 rounded text-xs font-bold uppercase tracking-tight text-zinc-600 border border-zinc-200 ml-1">
                    {context.role}
                </span>
              </p>
            )}
            <Button
              variant="primary"
              className="w-full py-6 text-base font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/20 group hover:scale-[1.02] transition-all"
              onClick={handleAccept}
              icon={<ArrowRight className="group-hover:translate-x-1 transition-transform" />}
            >
              Accept Invitation
            </Button>
            <p className="text-[11px] text-zinc-400 mt-6 font-medium italic">
                By joining, you agree to the organizational terms of service.
            </p>
          </div>
        )

      case 'accepting':
        return (
          <div className="text-center py-12">
            <div className="h-20 w-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-zinc-100">
                <Shield className="text-emerald-500 animate-pulse" size={40} />
            </div>
            <Heading level={3} className="mb-2">Securing your access</Heading>
            <Text className="text-zinc-500">Configuring space permissions and identity keys...</Text>
          </div>
        )

      case 'success':
        return (
          <div className="text-center py-12 animate-[fadeIn_0.5s_ease-out]">
            <div className="h-20 w-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/30">
              <CheckCircle className="text-white" size={40} />
            </div>
            <Heading level={2} className="mb-4 text-zinc-900">Access Granted</Heading>
            <p className="text-zinc-600 mb-8 font-light">
              Your account is ready. You are now a member of <strong>{context?.org_name}</strong>.
            </p>
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 mb-8 flex items-center justify-center gap-3">
                <div className="h-2 w-2 bg-emerald-500 rounded-full animate-ping" />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Redirecting to login dashboard...</span>
            </div>
            <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>Login Now</Button>
          </div>
        )

      case 'accepted':
        return (
          <div className="text-center py-12 animate-[fadeIn_0.5s_ease-out]">
            <div className="h-20 w-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-blue-100">
              <CheckCircle className="text-blue-500" size={40} />
            </div>
            <Heading level={2} className="mb-4 text-zinc-900">Already Joined</Heading>
            <p className="text-zinc-600 mb-8 font-light italic leading-relaxed">
              This invitation has already been processed. You should be able to access the organization from your dashboard.
            </p>
            <Button variant="primary" className="w-full py-4 text-sm font-black uppercase tracking-widest" onClick={() => navigate('/login')}>Go to Dashboard</Button>
          </div>
        )

      case 'revoked':
      case 'expired':
      case 'not_found':
        return (
          <div className="text-center py-12 animate-[fadeIn_0.5s_ease-out]">
            <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-100">
              {status === 'expired' ? <Clock className="text-red-500" size={40} /> : <XCircle className="text-red-500" size={40} />}
            </div>
            <Heading level={2} className="mb-4 text-zinc-900">
                {status === 'expired' ? 'Link Expired' : status === 'revoked' ? 'Link Revoked' : 'Invalid Link'}
            </Heading>
            <Text className="text-zinc-500 mb-10 font-light leading-relaxed">
              {status === 'expired' 
                ? 'This invitation link has passed its expiration threshold and is no longer valid.' 
                : status === 'revoked'
                ? 'The inviter has manually revoked this access link.'
                : 'This invitation token is malformed or does not exist in our secure ledger.'}
            </Text>
            <Button variant="outline" className="w-full py-4 text-sm font-black uppercase tracking-widest border-red-200 text-red-600 hover:bg-red-50" onClick={() => navigate('/')}>Return Home</Button>
            <p className="text-[11px] text-zinc-400 mt-6 font-medium italic">
                Contact the organization administrator to request a new link.
            </p>
          </div>
        )

      case 'error':
        return (
          <div className="text-center py-12">
            <div className="h-20 w-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-8">
              <AlertCircle className="text-amber-500" size={40} />
            </div>
            <Heading level={2} className="mb-4">Transfer Error</Heading>
            <p className="text-zinc-500 mb-8 italic font-light leading-relaxed">{errorMsg}</p>
            <Button variant="primary" className="w-full" onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6 font-sans selection:bg-emerald-500 selection:text-white">
      <div className="max-w-[500px] w-full relative">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -left-24 h-64 w-64 bg-emerald-500/10 rounded-full blur-[100px] -z-10" />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 bg-blue-500/10 rounded-full blur-[100px] -z-10" />
        
        <GlassCard className="p-12 px-10 border-white/60 shadow-2xl shadow-zinc-200/50 backdrop-blur-xl">
          <div className="text-zinc-900 font-bold text-xl mb-12 tracking-tight flex items-center justify-center gap-2 group cursor-default">
            <div className="h-8 w-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white group-hover:rotate-12 transition-transform">
                <Rocket size={18} />
            </div>
            <span>Space.inc</span>
          </div>
          
          {renderContent()}
        </GlassCard>
        
        <div className="mt-8 flex items-center justify-center gap-6 opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-700">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Enterprise Grade Isolation</span>
            <span className="h-1 w-1 bg-zinc-400 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Zero Trust Ledger</span>
        </div>
      </div>
    </div>
  )
}
