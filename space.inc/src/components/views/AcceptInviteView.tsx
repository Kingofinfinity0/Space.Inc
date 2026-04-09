import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle2, XCircle, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import { inviteService, EmailInviteValidationResponse } from '../../services/inviteService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import '../../styles/AcceptInviteView.css';

type PageStatus = 'loading' | 'valid' | 'invalid' | 'accepting' | 'error';

export default function AcceptInviteView() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, session } = useAuth();
    const { showToast } = useToast();
    
    const token = searchParams.get('token');
    
    const [status, setStatus] = useState<PageStatus>('loading');
    const [inviteData, setInviteData] = useState<EmailInviteValidationResponse | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const validateToken = useCallback(async () => {
        if (!token) {
            setStatus('invalid');
            setErrorMsg('No invitation token provided.');
            return;
        }

        try {
            const data = await inviteService.validateEmailInvite(token);
            setInviteData(data);
            
            if (data.valid) {
                setStatus('valid');
            } else {
                setStatus('invalid');
                setErrorMsg(getValidationError(data.status));
            }
        } catch (err: any) {
            console.error('[AcceptInvite] Validation failed:', err);
            setStatus('error');
            setErrorMsg('Failed to verify invitation. Please check your connection.');
        }
    }, [token]);

    useEffect(() => {
        validateToken();
    }, [validateToken]);

    const getValidationError = (status: EmailInviteValidationResponse['status']) => {
        switch (status) {
            case 'expired': return 'This invitation has expired.';
            case 'accepted': return 'This invitation has already been used.';
            case 'revoked': return 'This invitation has been cancelled.';
            case 'not_found': return 'Invalid invitation link.';
            default: return 'This invitation is no longer valid.';
        }
    };

    const handleAccept = async () => {
        if (!token) return;

        if (!user) {
            // Not logged in, store token and redirect
            inviteService.storePendingToken(token, 'email');
            showToast('Please sign up or log in to accept the invite.', 'info');
            navigate(`/signup?redirect=/accept-invite&token=${token}`);
            return;
        }

        // Logged in, call accept
        setStatus('accepting');
        try {
            const res = await inviteService.acceptEmailInvite(token, session.access_token);
            if (res.success && res.data) {
                showToast('Invitation accepted successfully!', 'success');
                // Use window.location for a hard redirect to ensure state refresh if needed
                window.location.href = res.data.redirect_path;
            } else {
                setStatus('invalid');
                setErrorMsg(getAcceptError(res.error_code as string, inviteData?.invited_email));
            }
        } catch (err: any) {
            console.error('[AcceptInvite] Acceptance failed:', err);
            setStatus('valid');
            showToast('Failed to accept invitation. Please try again.', 'error');
        }
    };

    const getAcceptError = (code: string, invitedEmail?: string) => {
        switch (code) {
            case 'INVITATION_EXPIRED': return 'This invite has expired.';
            case 'INVITATION_ALREADY_USED': return 'This invite was already accepted.';
            case 'EMAIL_MISMATCH': return `You're signed in as the wrong email. Please sign in as ${invitedEmail || 'the invited email'}.`;
            case 'NOT_AUTHENTICATED': return 'Session expired. Please log in again.';
            default: return 'An unexpected error occurred.';
        }
    };

    // Calculate time remaining for display
    const getTimeRemaining = () => {
        if (!inviteData?.expires_at) return null;
        const expiry = new Date(inviteData.expires_at).getTime();
        const now = new Date().getTime();
        const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 0) return 'Expires soon';
        return `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
    };

    if (status === 'loading') {
        return (
            <div className="accept-invite-page">
                <div className="accept-invite-card">
                    <div className="accept-invite-spinner" />
                    <p className="accept-invite-footer accept-invite-footer-loading">Verifying Invitation...</p>
                </div>
            </div>
        );
    }

    if (status === 'invalid' || status === 'error') {
        return (
            <div className="accept-invite-page">
                <div className="accept-invite-card">
                    <div className="accept-invite-logo">
                        <div className="accept-invite-logo-box">S</div>
                        <span className="accept-invite-logo-text">Space.inc</span>
                    </div>
                    <div className="accept-invite-icon-wrapper accept-invite-icon-error">
                        <XCircle size={40} className="text-red-500" />
                    </div>
                    <h1 className="accept-invite-title">Invitation Invalid</h1>
                    <p className="accept-invite-subtitle">{errorMsg}</p>
                    <button className="accept-invite-btn" onClick={() => navigate('/')}>
                        Go to Homepage
                    </button>
                </div>
            </div>
        );
    }

    const timeRemaining = getTimeRemaining();

    return (
        <div className="accept-invite-page">
            <div className="accept-invite-card">
                <div className="accept-invite-logo">
                    <div className="accept-invite-logo-box">S</div>
                    <span className="accept-invite-logo-text">Space.inc</span>
                </div>

                <div className="accept-invite-icon-wrapper accept-invite-icon-success">
                    <ShieldCheck size={40} className="text-emerald-500" />
                </div>

                <h1 className="accept-invite-title">You're Invited!</h1>
                <p className="accept-invite-subtitle">
                    <span className="accept-invite-highlight">{inviteData?.inviter_name || 'Someone'}</span> invited you to join <span className="accept-invite-highlight">{inviteData?.org_name || 'their organization'}</span> as a <span className="accept-invite-highlight">{inviteData?.role || 'member'}</span>.
                </p>

                {timeRemaining && (
                    <div className="accept-invite-expiry">
                        <div className="accept-invite-expiry-icon" />
                        {timeRemaining}
                    </div>
                )}

                <button 
                    className="accept-invite-btn" 
                    onClick={handleAccept}
                    disabled={status === 'accepting'}
                >
                    {status === 'accepting' ? (
                        <div className="accept-invite-spinner accept-invite-spinner-white" />
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            Accept Invitation <ArrowRight size={18} />
                        </span>
                    )}
                </button>

                <p className="accept-invite-footer">
                    Secure Invitation • Multi-Tenant Isolated
                </p>
            </div>
        </div>
    );
}
