import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type InvitationContext = {
  org_name: string
  role: string
  inviter_name: string
  expires_at: string
}

export default function JoinPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [context, setContext] = useState<InvitationContext | null>(null)
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'accepting' | 'done' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      setErrorMsg('No invitation token found.')
      return
    }

    const validate = async () => {
      const { data, error } = await supabase.rpc('validate_invitation_context', {
        p_token: token
      })

      if (error || !data) {
        setStatus('invalid')
        setErrorMsg('This invitation link is invalid or has expired.')
        return
      }

      setContext(data)
      setStatus('valid')
    }

    validate()
  }, [token])

  const handleAccept = async () => {
    if (!token) return
    setStatus('accepting')

    const { error } = await supabase.rpc('accept_invitation', {
      p_token: token
    })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
      return
    }

    setStatus('done')
    // Redirect to login after 2 seconds so they can sign in with their new account
    setTimeout(() => navigate('/login'), 2000)
  }

  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] font-sans">
      <div className="bg-[#111] border border-[#222] rounded-[12px] p-12 px-10 max-w-[460px] w-full text-center">
        <p className="text-[#666] text-[14px] leading-relaxed">Verifying your invitation...</p>
      </div>
    </div>
  )

  if (status === 'invalid' || status === 'error') return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] font-sans">
      <div className="bg-[#111] border border-[#222] rounded-[12px] p-12 px-10 max-w-[460px] w-full text-center">
        <h2 className="text-white text-[24px] font-semibold mb-3">Link Expired</h2>
        <p className="text-[#666] text-[14px] leading-relaxed mb-4">{errorMsg}</p>
        <p className="text-[#666] text-[14px] leading-relaxed">Contact the person who invited you to send a new link.</p>
      </div>
    </div>
  )

  if (status === 'done') return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] font-sans">
      <div className="bg-[#111] border border-[#222] rounded-[12px] p-12 px-10 max-w-[460px] w-full text-center">
        <h2 className="text-white text-[24px] font-semibold mb-3">You're in.</h2>
        <p className="text-[#666] text-[14px] leading-relaxed">Account created. Redirecting to login...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] font-sans">
      <div className="bg-[#111] border border-[#222] rounded-[12px] p-12 px-10 max-w-[460px] w-full text-center">
        <div className="text-white font-bold text-[18px] mb-8 tracking-tight">Space.inc</div>
        <h2 className="text-white text-[24px] font-semibold mb-3">You're invited</h2>
        {context && (
          <p className="text-[#aaa] text-[15px] leading-relaxed mb-8">
            <strong>{context.inviter_name}</strong> has invited you to join{' '}
            <strong>{context.org_name}</strong> as a <strong>{context.role}</strong>.
          </p>
        )}
        <button
          className="bg-[#10b981] text-white border-none rounded-[8px] p-3.5 px-7 text-[15px] font-semibold cursor-pointer w-full mb-4 disabled:opacity-50"
          onClick={handleAccept}
          disabled={status === 'accepting'}
        >
          {status === 'accepting' ? 'Setting up your account...' : 'Accept Invitation →'}
        </button>
        <p className="text-[#444] text-[12px]">
          By accepting, you agree to Space.inc's terms of service.
        </p>
      </div>
    </div>
  )
}
