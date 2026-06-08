import React, { useEffect, useRef, useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import ClientPortalView from './ClientPortalView';
import SpaceDetailView from './SpaceDetailView';
import { ClientSpace, Meeting } from '../../types';
import { apiService } from '../../services/apiService';
import { LoadingScreen, useLoadingScreenGate } from '../UI';

const SpaceRoute: React.FC = () => {
    const { spaceId } = useParams<{ spaceId: string }>();
    const { user, loading: authLoading, signOut, refreshContexts } = useAuth();
    const navigate = useNavigate();

    const [space, setSpace] = useState<ClientSpace | null>(null);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [membershipRole, setMembershipRole] = useState<string | null>(null);
    const [fetchLoading, setFetchLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const activatedSpaceRef = useRef<string | null>(null);
    const authLoadingGate = useLoadingScreenGate(authLoading);
    const fetchLoadingGate = useLoadingScreenGate(fetchLoading);

    useEffect(() => {
        if (authLoading || !user) return;

        if (!spaceId) {
            setFetchLoading(false);
            setNotFound(true);
            return;
        }

        const load = async () => {
            setFetchLoading(true);
            setNotFound(false);
            try {
                const { data: membership, error: memError } = await supabase
                    .from('space_memberships')
                    .select('role, space_id')
                    .eq('profile_id', user.id)
                    .eq('space_id', spaceId)
                    .eq('status', 'active')
                    .maybeSingle();

                if (memError || !membership) {
                    console.warn('[SpaceRoute] No active membership for spaceId:', spaceId);
                    setNotFound(true);
                    return;
                }

                if (membership.role === 'client' && activatedSpaceRef.current !== spaceId) {
                    activatedSpaceRef.current = spaceId;
                    await apiService
                        .activateMembershipContext('client_space', spaceId)
                        .catch(() => null);
                    await refreshContexts().catch(() => null);
                }

                setMembershipRole(membership.role || null);

                const { data: spaceData, error: spaceError } = await supabase
                    .from('spaces')
                    .select('*')
                    .eq('id', spaceId)
                    .single();

                if (spaceError || !spaceData) {
                    console.warn('[SpaceRoute] Space not found:', spaceId);
                    setNotFound(true);
                    return;
                }

                const { data: meetingsData } = await supabase
                    .from('meetings')
                    .select('*')
                    .eq('space_id', spaceId)
                    .in('status', ['scheduled', 'live'])
                    .order('starts_at', { ascending: true });

                setSpace(spaceData as ClientSpace);
                setMeetings((meetingsData as Meeting[]) || []);
            } catch (err) {
                console.error('[SpaceRoute] Load error:', err);
                setNotFound(true);
            } finally {
                setFetchLoading(false);
            }
        };

        load();
    }, [authLoading, spaceId, user?.id]);

    if (authLoadingGate.isVisible) {
        return (
            <LoadingScreen
                key={authLoadingGate.cycleKey}
                message="Loading Vero..."
                isComplete={authLoadingGate.isComplete}
                onExitComplete={authLoadingGate.handleExitComplete}
            />
        );
    }
    if (!user) return <Navigate to="/login" replace />;
    if (fetchLoadingGate.isVisible) {
        return (
            <LoadingScreen
                key={fetchLoadingGate.cycleKey}
                message="Loading space..."
                isComplete={fetchLoadingGate.isComplete}
                onExitComplete={fetchLoadingGate.handleExitComplete}
            />
        );
    }
    if (notFound || !space) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 font-sans">
                <div className="max-w-md w-full text-center space-y-4">
                    <h1 className="text-2xl font-black tracking-tight text-zinc-900">Space not found</h1>
                    <p className="text-zinc-500 text-sm">
                        You don&apos;t have access to this workspace, or it no longer exists.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate('/dashboard', { replace: true })}
                        className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                    >
                        Go to dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (membershipRole === 'client') {
        return (
            <ClientPortalView
                client={space}
                meetings={meetings}
                onJoin={(meetingId) => {
                    void meetingId;
                }}
                onLogout={signOut}
            />
        );
    }

    return (
        <SpaceDetailView
            spaceId={spaceId!}
            space={space}
            meetings={meetings}
            onBack={() => navigate('/dashboard')}
            onJoin={(meetingId) => {
                void meetingId;
            }}
            onSchedule={() => {}}
            onInstantMeet={() => {}}
            onEndMeeting={() => {}}
            onDeleteMeeting={() => {}}
        />
    );
};

export default SpaceRoute;
