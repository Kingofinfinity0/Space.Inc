import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle2, XCircle, Clock, ShieldCheck, ArrowRight, User, LogIn } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Button, Heading, Text } from '../UI/index';
import '../../styles/AcceptInviteView.css';

type PageStatus = 'loading' | 'valid' | 'invalid' | 'accepting' | 'error';

interface ValidInvitation {
    valid: true;
    status: 'pending' | 'accepted' | 'revoked' | 'expired';
    org_name: string;
    inviter_name: string;
    invited_email: string;
    role: string;
    expires_at: string;
    invite_type: 'staff' | 'client';
}

interface InvalidInvitation {
    valid: false;
    status: 'not_found';
}

type ValidateInvitationContextResult = ValidInvitation | InvalidInvitation;

export default function AcceptInviteView() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, session } = useAuth();
    const { showToast } = useToast();
    
    const token = searchParams.get('token');
    
    const [status, setStatus] = useState<PageStatus>('loading');
    const [inviteData, setInviteData] = useState<ValidateInvitationContextResult | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const validateToken = useCallback(async () => {
        if (!token) {
            setStatus('invalid');
            setErrorMsg('No invitation token provided.');
            return;
        }

        try {
            // Use validate_invitation_context as specified in requirements
            const data = await apiService.validateInvitationContext(token);
            setInviteData(data);
            
            // Check the valid field as specified in the RPC docs
            if (data && data.valid) {
                setStatus('valid');
            } else {
                setStatus('invalid');
                setErrorMsg(getErrorMessage(data));
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

    const getErrorMessage = (data: ValidateInvitationContextResult | null): string => {
        if (!data) return 'This invitation is no longer valid.';
        
        if (!data.valid) {
            switch (data.status) {
                case 'accepted': 
                    return 'This invite has already been used. Try signing in.';
                case 'revoked': 
                    return 'This invite link has been revoked. Contact the person who invited you for a new one.';
                case 'expired': 
                    return `This invite link expired. Ask the person who invited you to resend it.`;
                case 'not_found': 
                    return 'This invite link is invalid or doesn\'t exist.';
                default: 
                    return 'This invitation is no longer valid.';
            }
        }
        
        return 'This invitation is no longer valid.';
    };

    const handleSignIn = () => {
        // Store token in sessionStorage before redirecting
        sessionStorage.setItem('pending_invite_token', token || '');
        navigate('/login');
    };

    const handleSignUp = () => {
        // Store token in sessionStorage before redirecting
        sessionStorage.setItem('pending_invite_token', token || '');
        navigate('/signup');
    };

    const handleAccept = async () => {
        if (!token) return;

        if (!user) {
            // Not logged in - should not reach here with new flow, but handle gracefully
            sessionStorage.setItem('pending_invite_token', token || '');
            showToast('Please sign in or create an account to accept the invite.', 'info');
            return;
        }

        // Logged in, call accept
        setStatus('accepting');
        try {
            const res = await apiService.acceptInvitation(token);
            if (res && res.redirect_path) {
                showToast('Invitation accepted successfully!', 'success');
                // Use window.location for a hard redirect to ensure state refresh if needed
                window.location.href = res.redirect_path;
            } else {
                setStatus('invalid');
                setErrorMsg('Failed to accept invitation. The invitation may no longer be valid.');
            }
        } catch (err: any) {
            console.error('[AcceptInvite] Acceptance failed:', err);
            setStatus('valid');
            showToast('Failed to accept invitation. Please try again.', 'error');
        }
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

    
    // If user is logged in, show accept button
    if (user) {
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
                        {inviteData && inviteData.valid ? (
                            <>
                                <span className="accept-invite-highlight">{inviteData.inviter_name}</span> invited you to join <span className="accept-invite-highlight">{inviteData.org_name}</span> as a <span className="accept-invite-highlight">{inviteData.role}</span>
                            </>
                        ) : (
                            "You've been invited to join an organization"
                        )}
                    </p>

                    
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

    // If user is not logged in, show auth options
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
                    {inviteData && inviteData.valid ? (
                        <>You've been invited to join <span className="accept-invite-highlight">{inviteData.org_name}</span>.</>
                    ) : (
                        "You've been invited to join an organization."
                    )}
                </p>

                
                <div className="accept-invite-auth-options">
                    <div className="accept-invite-auth-divider">
                        <span>Choose how to continue</span>
                    </div>
                    
                    <div className="accept-invite-auth-buttons">
                        <button 
                            className="accept-invite-btn accept-invite-btn-secondary" 
                            onClick={handleSignIn}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <LogIn size={18} />
                                Sign In
                            </span>
                        </button>
                        
                        <button 
                            className="accept-invite-btn" 
                            onClick={handleSignUp}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <User size={18} />
                                Create Account
                            </span>
                        </button>
                    </div>
                </div>

                <p className="accept-invite-footer">
                    Secure Invitation • Multi-Tenant Isolated
                </p>
            </div>
        </div>
    );
}
