import React, { useEffect, useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import ClientPortalView from './ClientPortalView';
import SpaceDetailView from './SpaceDetailView';
import { ClientSpace, Meeting } from '../../types';
import { Rocket } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Holding screen — shown when there's no active membership
// ─────────────────────────────────────────────────────────────────────────────
const HoldingScreen = () => (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 font-sans">
        <div className="max-w-md w-full text-center space-y-6">
            <div className="h-20 w-20 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto">
                <Rocket size={36} className="text-zinc-400" />
            </div>
            <div className="space-y-2">
                <h1 className="text-2xl font-black tracking-tight text-zinc-900">
                    Your space isn't ready yet
                </h1>
                <p className="text-zinc-500 text-sm leading-relaxed">
                    Your workspace is being set up. You'll receive a link once
                    everything is ready. No action needed from you right now.
                </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
                <div className="h-2 w-2 bg-amber-400 rounded-full animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                    Pending activation
                </span>
            </div>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton — shown while fetching space data
// ─────────────────────────────────────────────────────────────────────────────
const LoadingScreen = () => (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 animate-pulse">
        <div className="max-w-md w-full space-y-4">
            <div className="h-10 w-10 bg-zinc-100 rounded-xl mx-auto mb-6" />
            <div className="h-6 bg-zinc-100 rounded-lg w-3/4 mx-auto" />
            <div className="h-4 bg-zinc-50 rounded w-1/2 mx-auto" />
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SpaceRoute
// Reads :spaceId from URL → looks up membership role → renders accordingly:
//   client  → ClientPortalView (messages, files, meetings only)
//   staff/admin/owner → SpaceDetailView (full staff view)
// ─────────────────────────────────────────────────────────────────────────────
const SpaceRoute: React.FC = () => {
    const { spaceId } = useParams<{ spaceId: string }>();
    const { user, userRole, loading: authLoading, signOut, session } = useAuth();
    const navigate = useNavigate();

    const [space, setSpace] = useState<ClientSpace | null>(null);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [membershipRole, setMembershipRole] = useState<string | null>(null);
    const [fetchLoading, setFetchLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (authLoading || !user) return;

        if (!spaceId) {
            setFetchLoading(false);
            setNotFound(true);
            return;
        }

        const load = async () => {
            setFetchLoading(true);
            try {
                // 1. Look up membership role for this user + space
                const { data: membership, error: memError } = await supabase
                    .from('space_memberships')
                    .select('role, space_id')
                    .eq('space_id', spaceId)
                    .eq('status', 'active')
                    .single();

                if (memError || !membership) {
                    console.warn('[SpaceRoute] No active membership for spaceId:', spaceId);
                    setNotFound(true);
                    return;
                }

                setMembershipRole(membership.role);

                // 2. Fetch the space record
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

                // 3. Fetch scheduled/live meetings for this space
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
    }, [authLoading, user, spaceId]);

    // ── Auth guard ──────────────────────────────────────────────────────────
    if (authLoading) return <LoadingScreen />;
    if (!user) return <Navigate to="/login" replace />;

    // ── Data loading ────────────────────────────────────────────────────────
    if (fetchLoading) return <LoadingScreen />;
    if (notFound || !space) return <HoldingScreen />;

    // ── Role-based rendering ────────────────────────────────────────────────
    if (membershipRole === 'client') {
        return (
            <ClientPortalView
                client={space}
                meetings={meetings}
                onJoin={(meetingId) => {
                    console.log('[SpaceRoute] Client joining meeting:', meetingId);
                }}
                onLogout={signOut}
            />
        );
    }

    // staff / admin / owner → full staff view
    return (
        <SpaceDetailView
            spaceId={spaceId!}
            space={space}
            meetings={meetings}
            onBack={() => navigate('/dashboard')}
            onJoin={(meetingId) => {
                console.log('[SpaceRoute] Staff joining meeting:', meetingId);
            }}
            onSchedule={() => {}}
            onInstantMeet={() => {}}
            onEndMeeting={() => {}}
            onDeleteMeeting={() => {}}
        />
    );
};

export default SpaceRoute;
