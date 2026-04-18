import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { apiService } from '../../services/apiService';
import { inviteService, SpaceInviteTokenResponse } from '../../services/inviteService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { GlassCard } from '../UI/GlassCard';
import { Button } from '../UI/Button';
import { Heading } from '../UI/Heading';
import '../../styles/JoinView.css';

type PageStatus = 'loading' | 'valid' | 'invalid' | 'authing' | 'done' | 'error';

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
                const data = await apiService.resolveSpaceInviteToken(token);
                setInviteData(data);
                if (data.valid) {
                    setPageStatus('valid');
                } else {
                    setPageStatus('invalid');
                    setErrorMsg('This invite link is invalid or has expired.');
                }
            } catch (err: any) {
                console.error('Error resolving token:', err);
                setPageStatus('invalid');
                setErrorMsg('Failed to verify invitation.');
            }
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
        if (!token || !onboardingInfo.name) return;

        setPageStatus('authing');
        try {
            const result = await apiService.acceptSpaceInvite(token, onboardingInfo.name, onboardingInfo.company);
            if (result.success) {
                setPageStatus('done');
                showToast('Successfully joined!', 'success');
                sessionStorage.removeItem('pending_invite_token');
                setTimeout(() => {
                    window.location.href = result.redirect_path || '/';
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
                    to join <span className="font-bold text-[#0D0D0D]">{inviteData?.space_name}</span>
                    {inviteData?.org_name && <> at <span className="font-bold text-[#0D0D0D]">{inviteData.org_name}</span></>}
                </p>
                <Button variant="primary" className="w-full py-4 text-xs font-bold uppercase tracking-widest" onClick={handleJoinClick}>
                    Join Space
                </Button>
            </GlassCard>
        </div>
    );
}
