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
    <div style={styles.container}>
      <div style={styles.card}>
        <p style={styles.muted}>Verifying your invitation...</p>
      </div>
    </div>
  )

  if (status === 'invalid' || status === 'error') return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Link Expired</h2>
        <p style={styles.muted}>{errorMsg}</p>
        <p style={styles.muted}>Contact the person who invited you to send a new link.</p>
      </div>
    </div>
  )

  if (status === 'done') return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>You're in.</h2>
        <p style={styles.muted}>Account created. Redirecting to login...</p>
      </div>
    </div>
  )

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>Space.inc</div>
        <h2 style={styles.title}>You're invited</h2>
        {context && (
          <p style={styles.subtitle}>
            <strong>{context.inviter_name}</strong> has invited you to join{' '}
            <strong>{context.org_name}</strong> as a <strong>{context.role}</strong>.
          </p>
        )}
        <button
          style={styles.button}
          onClick={handleAccept}
          disabled={status === 'accepting'}
        >
          {status === 'accepting' ? 'Setting up your account...' : 'Accept Invitation →'}
        </button>
        <p style={styles.fine}>
          By accepting, you agree to Space.inc's terms of service.
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
    fontFamily: 'Inter, sans-serif',
  },
  card: {
    backgroundColor: '#111',
    border: '1px solid #222',
    borderRadius: '12px',
    padding: '48px 40px',
    maxWidth: '460px',
    width: '100%',
    textAlign: 'center',
  },
  logo: {
    color: '#fff',
    fontWeight: 700,
    fontSize: '18px',
    marginBottom: '32px',
    letterSpacing: '-0.5px',
  },
  title: {
    color: '#fff',
    fontSize: '24px',
    fontWeight: 600,
    margin: '0 0 12px',
  },
  subtitle: {
    color: '#aaa',
    fontSize: '15px',
    lineHeight: 1.6,
    margin: '0 0 32px',
  },
  muted: {
    color: '#666',
    fontSize: '14px',
    lineHeight: 1.6,
  },
  button: {
    backgroundColor: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '14px 28px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    marginBottom: '16px',
  },
  fine: {
    color: '#444',
    fontSize: '12px',
  }
}
