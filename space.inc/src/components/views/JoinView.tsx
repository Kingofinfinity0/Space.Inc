import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inviteService } from '../../services/inviteService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { GlassCard } from '../UI/GlassCard';
import { Button } from '../UI/Button';
import { Heading } from '../UI/Heading';
import { normalizeInviteRedirectPath } from '../../services/inviteService';
import '../../styles/JoinView.css';

type PageStatus = 'loading' | 'valid' | 'invalid' | 'authing' | 'done' | 'error';
type InviteKind = 'space_link' | 'personal';

export default function JoinView() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { user, session } = useAuth();
    const { showToast } = useToast();

    const [inviteData, setInviteData] = useState<any>(null);
    const [inviteKind, setInviteKind] = useState<InviteKind | null>(null);
    const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [onboardingInfo, setOnboardingInfo] = useState({ name: '', company: '' });
    const [showOnboarding, setShowOnboarding] = useState(false);

    useEffect(() => {
        if (token) {
            inviteService.storePendingToken(token);
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
                const spaceInvite = await inviteService.resolveSpaceToken(token);
                if (spaceInvite.valid) {
                    setInviteData(spaceInvite);
                    setInviteKind('space_link');
                    setPageStatus('valid');
                    return;
                }

                const personalInvite = await inviteService.validateEmailInvite(token);
                if (personalInvite.valid) {
                    setInviteData(personalInvite);
                    setInviteKind('personal');
                    setPageStatus('valid');
                    return;
                }

                setPageStatus('invalid');
                setErrorMsg('This invite link is invalid or has expired.');
            } catch (err: any) {
                if (process.env.NODE_ENV === 'development') {
                    console.error('Error resolving token:', err);
                }
                setPageStatus('invalid');
                setErrorMsg('Failed to verify invitation.');
            }
        };

        resolveToken();
    }, [token]);

    const handleJoinClick = () => {
        if (!user) {
            navigate(`/login?message=check_email`);
            return;
        }

        if (inviteKind === 'space_link') {
            setShowOnboarding(true);
            return;
        }

        void handleAcceptInvite();
    };

    const handleAcceptInvite = async () => {
        if (!token) return;
        if (!session?.access_token) {
            navigate('/login');
            return;
        }

        setPageStatus('authing');
        try {
            const tokenToUse = inviteService.getAndClearPendingToken()?.token || token;
            const resolvedInvite = await inviteService.resolveInviteToken(tokenToUse);
            const result = await inviteService.acceptResolvedInvite(
                resolvedInvite,
                session.access_token,
                resolvedInvite.type === 'space_link'
                  ? {
                      clientName: onboardingInfo.name,
                      clientCompany: onboardingInfo.company,
                    }
                  : undefined
            );

            if (result?.redirect_path) {
                setPageStatus('done');
                showToast('Successfully joined!', 'success');
                setTimeout(() => {
                    window.location.href = normalizeInviteRedirectPath(result.redirect_path) || '/';
                }, 1000);
            } else {
                setPageStatus('valid');
                showToast('Failed to join space.', 'error');
            }
        } catch (err: any) {
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

    return (
        <div className="join-view-page">
            <GlassCard className="max-w-md w-full p-10 text-center">
                <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[12px] bg-[#F7F7F8] border border-[#E5E5E5]">
                    <span className="text-3xl">🚀</span>
                </div>
                <Heading level={1} className="mb-2">You're invited</Heading>
                <p className="text-[#6E6E80] mb-8">
                    {inviteKind === 'space_link' ? (
                        <>
                            to join <span className="font-bold text-[#0D0D0D]">{inviteData?.space_name}</span>
                            {inviteData?.organization_name && <> at <span className="font-bold text-[#0D0D0D]">{inviteData.organization_name}</span></>}
                        </>
                    ) : (
                        <>
                            to join <span className="font-bold text-[#0D0D0D]">{inviteData?.org_name}</span>
                        </>
                    )}
                </p>
                <Button variant="primary" className="w-full py-4 text-xs font-bold uppercase tracking-widest" onClick={handleJoinClick}>
                    {inviteKind === 'space_link' ? 'Join Space' : 'Accept Invitation'}
                </Button>
            </GlassCard>
        </div>
    );
}
