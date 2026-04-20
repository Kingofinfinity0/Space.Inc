import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, EDGE_FUNCTION_BASE_URL } from '../../lib/supabase';
import { inviteService, SpaceInviteTokenResponse, errorCodeMessages } from '../../services/inviteService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { GlassCard } from '../UI/GlassCard';
import { Button } from '../UI/Button';
import { Heading } from '../UI/Heading';
import '../../styles/JoinView.css';

type PageStatus = 'loading' | 'valid' | 'invalid' | 'authing' | 'done' | 'error';
type InviteType = 'space_link' | 'personal' | null;

export default function JoinView() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [inviteData, setInviteData] = useState<any>(null);
    const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [onboardingInfo, setOnboardingInfo] = useState({ name: '', company: '' });
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [inviteType, setInviteType] = useState<InviteType>(null);

    useEffect(() => {
        if (token) {
            sessionStorage.setItem('pending_invite_token', token);
        }
    }, [token]);

    useEffect(() => {
        if (!token) {
            setPageStatus('invalid');
            setErrorMsg('No invitation token in URL.');
            return;
        }

        const resolveToken = async () => {
            try {
                // Try space link first using edge function
                const spaceData = await inviteService.resolveSpaceToken(token);
                if (spaceData.valid) {
                    setInviteData(spaceData);
                    setInviteType('space_link');
                    setPageStatus('valid');
                    return;
                }
            } catch (err: any) {
                if (process.env.NODE_ENV === 'development') {
                    // eslint-disable-next-line no-console
                    console.log('Space link resolution failed, trying personal invite:', err);
                }
            }

            // Fall back to personal invitation using edge function
            try {
                const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'validate', token })
                });
                const result = await response.json();
                const data = result.data || result;

                if (data.valid) {
                    setInviteData(data);
                    setInviteType('personal');
                    setPageStatus('valid');
                    return;
                }
            } catch (err: any) {
                if (process.env.NODE_ENV === 'development') {
                    // eslint-disable-next-line no-console
                    console.error('Personal invite validation failed:', err);
                }
            }

            // Both failed - invalid token
            setPageStatus('invalid');
            setErrorMsg('This invite link is invalid or has expired.');
        };

        resolveToken();
    }, [token]);

    const handleJoinClick = () => {
        if (!user) {
            inviteService.storePendingToken(token!, 'space');
            navigate(`/signup?redirect=/join/${token}`);
            return;
        }
        setShowOnboarding(true);
    };

    const handleAcceptInvite = async () => {
        if (!token) return;

        // For space links, we need a name; for personal invites, we don't
        if (inviteType === 'space_link' && !onboardingInfo.name) return;

        setPageStatus('authing');
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session?.access_token) {
                throw new Error('Not authenticated');
            }

            let result: any;
            if (inviteType === 'space_link') {
                // Use inviteService which calls edge function accept_space_link
                result = await inviteService.acceptSpaceInvite(token, sessionData.session.access_token);
            } else {
                // Personal invite - call edge function directly
                const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/invitations-api`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionData.session.access_token}`
                    },
                    body: JSON.stringify({ action: 'accept', token })
                });
                const acceptData = await response.json();
                result = acceptData.data || acceptData;
            }

            // Check for redirect_path in the result (edge function returns it directly)
            const redirectPath = result?.redirect_path || result?.data?.redirect_path;
            if (redirectPath) {
                setPageStatus('done');
                showToast('Successfully joined!', 'success');
                sessionStorage.removeItem('pending_invite_token');
                localStorage.removeItem('pending_invite_token');
                localStorage.removeItem('pending_space_token');
                setTimeout(() => {
                    window.location.href = redirectPath;
                }, 1000);
            } else {
                setPageStatus('valid');
                const errCode = result?.error_code;
                const message = errCode && errorCodeMessages[errCode] ? errorCodeMessages[errCode] : 'Failed to join space.';
                showToast(message, 'error');
            }
        } catch (err: any) {
            if (process.env.NODE_ENV === 'development') {
                // eslint-disable-next-line no-console
                console.error('Error accepting invite:', err);
            }
            setPageStatus('valid');
            showToast('Failed to join space.', 'error');
        }
    };

    if (pageStatus === 'loading') return <div className="join-view-page"><div className="join-view-spinner" /></div>;

    if (pageStatus === 'invalid') {
        return (
            <div className="join-view-page">
                <GlassCard className="max-w-md w-full p-8 text-center">
                    <Heading level={2} className="mb-4">Invitation Invalid</Heading>
                    <p className="text-[#6E6E80] mb-6">{errorMsg}</p>
                    <Button onClick={() => navigate('/')}>Go Home</Button>
                </GlassCard>
            </div>
        );
    }

    if (showOnboarding) {
        // Space link invites need name/company info
        if (inviteType === 'space_link') {
            return (
                <div className="join-view-page">
                    <GlassCard className="max-w-md w-full p-8">
                        <Heading level={2} className="mb-2 text-center">Final Step</Heading>
                        <p className="text-[#6E6E80] text-center mb-8">Tell us a bit about yourself</p>

                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#6E6E80] mb-2">Full Name</label>
                                <input
                                    value={onboardingInfo.name}
                                    onChange={e => setOnboardingInfo({...onboardingInfo, name: e.target.value})}
                                    className="w-full rounded-[8px] border border-[#E5E5E5] px-4 py-3 text-sm focus:outline-none focus:border-[#0D0D0D]"
                                    placeholder="Jane Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#6E6E80] mb-2">Company (Optional)</label>
                                <input
                                    value={onboardingInfo.company}
                                    onChange={e => setOnboardingInfo({...onboardingInfo, company: e.target.value})}
                                    className="w-full rounded-[8px] border border-[#E5E5E5] px-4 py-3 text-sm focus:outline-none focus:border-[#0D0D0D]"
                                    placeholder="Acme Inc"
                                />
                            </div>
                        </div>

                        <Button
                            variant="primary"
                            className="w-full"
                            disabled={!onboardingInfo.name || pageStatus === 'authing'}
                            onClick={handleAcceptInvite}
                        >
                            {pageStatus === 'authing' ? 'Joining...' : 'Complete Join'}
                        </Button>
                    </GlassCard>
                </div>
            );
        }

        // Personal invites just need confirmation
        return (
            <div className="join-view-page">
                <GlassCard className="max-w-md w-full p-8 text-center">
                    <Heading level={2} className="mb-4">Accept Invitation</Heading>
                    <p className="text-[#6E6E80] mb-8">
                        You have been invited to join <span className="font-bold text-[#0D0D0D]">{inviteData?.org_name || 'an organization'}</span> as a <span className="font-bold text-[#0D0D0D]">{inviteData?.role || 'member'}</span>.
                    </p>

                    <Button
                        variant="primary"
                        className="w-full"
                        disabled={pageStatus === 'authing'}
                        onClick={handleAcceptInvite}
                    >
                        {pageStatus === 'authing' ? 'Accepting...' : 'Accept Invitation'}
                    </Button>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="join-view-page">
            <GlassCard className="max-w-md w-full p-10 text-center">
                <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[12px] bg-[#F7F7F8] border border-[#E5E5E5]">
                    <span className="text-3xl">🚀</span>
                </div>
                <Heading level={1} className="mb-2">You're invited</Heading>
                <p className="text-[#6E6E80] mb-8">
                    {inviteType === 'space_link' ? (
                        <>
                            to join <span className="font-bold text-[#0D0D0D]">{inviteData?.space_name}</span>
                            {inviteData?.organization_name && <> at <span className="font-bold text-[#0D0D0D]">{inviteData.organization_name}</span></>}
                        </>
                    ) : (
                        <>
                            to join <span className="font-bold text-[#0D0D0D]">{inviteData?.org_name || 'an organization'}</span> as a <span className="font-bold text-[#0D0D0D]">{inviteData?.role || 'member'}</span>
                        </>
                    )}
                </p>
                <Button variant="primary" className="w-full py-4 text-xs font-bold uppercase tracking-widest" onClick={handleJoinClick}>
                    {inviteType === 'space_link' ? 'Join Space' : 'Accept Invitation'}
                </Button>
            </GlassCard>
        </div>
    );
}
