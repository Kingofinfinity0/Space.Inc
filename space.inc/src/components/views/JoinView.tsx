import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { inviteService, SpaceInviteTokenResponse, AcceptSpaceInviteResponse } from '../../services/inviteService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import '../../styles/JoinView.css';

type PageStatus = 'loading' | 'valid' | 'invalid' | 'authing' | 'done' | 'error';

export default function JoinView() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { user, session } = useAuth();
    const { showToast } = useToast();

    const [inviteData, setInviteData] = useState<SpaceInviteTokenResponse | null>(null);
    const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Check authentication status on mount
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsAuthenticated(!!session);
        };
        checkAuth();
    }, []);

    // Store token immediately on page load (before any redirect can happen)
    useEffect(() => {
        if (token) {
            localStorage.setItem('pending_space_token', token);
        }
    }, [token]);

    // Resolve the token on mount
    useEffect(() => {
        if (!token) {
            setPageStatus('invalid');
            setErrorMsg('No invitation token in URL.');
            return;
        }

        const resolveToken = async () => {
            try {
                const data = await inviteService.resolveSpaceToken(token);
                setInviteData(data);
                
                if (data.valid) {
                    setPageStatus('valid');
                } else {
                    setPageStatus('invalid');
                    setErrorMsg(getErrorMessage(data.error_code || 'INVALID_TOKEN'));
                }
            } catch (err: any) {
                console.error('Error resolving token:', err);
                setPageStatus('invalid');
                setErrorMsg('Failed to verify invitation. Please try again.');
            }
        };

        resolveToken();
    }, [token]);

    const getErrorMessage = (errorCode: string): string => {
        switch (errorCode) {
            case 'INVALID_TOKEN':
                return 'This invite link is invalid.';
            case 'LINK_EXPIRED':
                return 'This invite link has expired.';
            case 'INVITE_FULL':
                return 'This space is at capacity.';
            default:
                return 'This invitation link is invalid or does not exist.';
        }
    };

    const handleJoinClick = async () => {
        if (!token || !session?.access_token) {
            setErrorMsg('Authentication required to join.');
            return;
        }

        setPageStatus('authing');
        setErrorMsg('');

        try {
            const result = await inviteService.acceptSpaceInvite(token, session.access_token);
            
            if (result.success && result.data) {
                setPageStatus('done');
                showToast('Successfully joined the space!', 'success');
                
                // Navigate to the correct redirect path
                setTimeout(() => {
                    navigate(result.data!.redirect_path);
                }, 1000);
            } else {
                setPageStatus('valid');
                setErrorMsg(getErrorMessage(result.error_code || 'INVALID_TOKEN'));
            }
        } catch (err: any) {
            console.error('Error accepting invite:', err);
            setPageStatus('valid');
            setErrorMsg('Failed to join space. Please try again.');
        }
    };

    const handleAuthClick = () => {
        if (!token) return;
        
        // Store the token for post-auth retrieval
        inviteService.storePendingToken(token);
        
        // Redirect to signup with the join URL as the redirect
        navigate(`/signup?redirect=/join/${token}`);
    };

    // Loading state
    if (pageStatus === 'loading') {
        return (
            <div className="join-view-page">
                <div className="join-view-center">
                    <div className="join-view-spinner" />
                    <p className="join-view-verify-text">Verifying invitation…</p>
                </div>
            </div>
        );
    }

    // Invalid state
    if (pageStatus === 'invalid') {
        return (
            <div className="join-view-page">
                <div className="join-view-card join-view-center">
                    <div className="join-view-logo"><div className="join-view-logo-box">S</div>Space.inc</div>
                    <div className="join-view-invalid-icon">❌</div>
                    <h2 className="join-view-title">Invitation Invalid</h2>
                    <p className="join-view-subtitle join-view-spacing-b24">{errorMsg}</p>
                    <p className="join-view-footer-info">
                        Contact the person who invited you for a fresh link.
                    </p>
                </div>
            </div>
        );
    }

    // In-progress state
    if (pageStatus === 'authing' || pageStatus === 'done') {
        return (
            <div className="join-view-page">
                <div className="join-view-card join-view-center">
                    <div className="join-view-logo"><div className="join-view-logo-box">S</div>Space.inc</div>
                    <div className="join-view-spinner" />
                    <p className="join-view-verify-text">
                        {pageStatus === 'done' ? 'Redirecting...' : 'Joining workspace…'}
                    </p>
                </div>
            </div>
        );
    }

    // Valid state - show preview and action buttons
    if (!inviteData?.valid) {
        return (
            <div className="join-view-page">
                <div className="join-view-card join-view-center">
                    <div className="join-view-logo"><div className="join-view-logo-box">S</div>Space.inc</div>
                    <h2 className="join-view-title">Invalid Invitation</h2>
                    <p className="join-view-subtitle">This invitation is not valid.</p>
                </div>
            </div>
        );
    }

    const { organization_name: organizationName, space_name: spaceName, space_description: spaceDescription, config } = inviteData;
    const isExpiringSoon = config?.expires_at && new Date(config.expires_at) < new Date(Date.now() + 48 * 60 * 60 * 1000);
    const capacityInfo = config?.max_uses ? `${config.use_count || 0} of ${config.max_uses} spots filled` : null;

    return (
        <div className="join-view-page">
            <div className="join-view-card">
                <div className="join-view-logo"><div className="join-view-logo-box">S</div>Space.inc</div>

                <div className="join-view-center join-view-spacing-b28">
                    <div className="join-view-rocket-icon">🚀</div>
                    <h2 className="join-view-title">You're invited to join</h2>
                    <p className="join-view-subtitle">
                        <strong className="join-view-text-bold">{spaceName}</strong>
                        {organizationName && (
                            <>
                                {' at '}
                                <strong className="join-view-text-bold">{organizationName}</strong>
                            </>
                        )}
                    </p>
                    
                    {spaceDescription && (
                        <p className="join-view-description">{spaceDescription}</p>
                    )}

                    {capacityInfo && (
                        <div className="join-view-capacity">
                            <span className="join-view-capacity-text">{capacityInfo}</span>
                        </div>
                    )}

                    {isExpiringSoon && (
                        <div className="join-view-expiry-warning">
                            <span className="join-view-expiry-text">⚠️ This invite expires soon</span>
                        </div>
                    )}
                </div>

                {errorMsg && <div className="join-view-err">{errorMsg}</div>}

                <div className="join-view-action-buttons">
                    {isAuthenticated ? (
                        <button className="join-view-btn" onClick={handleJoinClick}>
                            Join Space →
                        </button>
                    ) : (
                        <button className="join-view-btn" onClick={handleAuthClick}>
                            Sign Up to Join →
                        </button>
                    )}
                </div>

                <p className="join-view-footer">
                    Secure invitation · One-time use
                </p>
            </div>
        </div>
    );
}