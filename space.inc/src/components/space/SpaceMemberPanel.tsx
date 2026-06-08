import React, { useEffect, useMemo, useState } from 'react';
import { User, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { apiService } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingScreen, useLoadingScreenGate } from '../UI';

type PresenceMember = {
    member_id: string;
    user_id: string;
    full_name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
    role: 'owner' | 'admin' | 'staff' | 'client' | string;
    is_online?: boolean;
    last_seen_at?: string | null;
    presence_state?: 'online' | 'away' | 'offline' | string;
};

const ROLE_STYLES: Record<string, string> = {
    owner: 'border-violet-200 bg-violet-50 text-violet-700',
    admin: 'border-violet-200 bg-violet-50 text-violet-700',
    staff: 'border-blue-200 bg-blue-50 text-blue-700',
    client: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const PRESENCE_DOT_STYLES: Record<string, string> = {
    online: 'bg-emerald-500',
    away: 'bg-amber-400',
    offline: 'bg-zinc-300',
};

const ROLE_RANKS: Record<string, number> = {
    owner: 0,
    admin: 0,
    staff: 1,
    client: 2,
};

function initials(member: PresenceMember) {
    const label = member.full_name || member.email || 'Member';
    return label
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

export function SpaceMemberPanel({ spaceId, compact = false, className = '' }: { spaceId: string; compact?: boolean; className?: string }) {
    const { user } = useAuth();
    const [members, setMembers] = useState<PresenceMember[]>([]);
    const [loading, setLoading] = useState(true);
    const loadingGate = useLoadingScreenGate(loading);

    useEffect(() => {
        let cancelled = false;

        const loadMembers = async () => {
            setLoading(true);
            const { data } = await apiService.getSpaceMemberPresence(spaceId);
            if (!cancelled) {
                setMembers(Array.isArray(data) ? data : []);
                setLoading(false);
            }
        };

        void loadMembers();
        void apiService.pingPresence(spaceId);

        const pingTimer = window.setInterval(() => {
            void apiService.pingPresence(spaceId);
        }, 60000);

        const channel = supabase.channel(`space:${spaceId}`, {
            config: { presence: { key: user?.id || crypto.randomUUID() } },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const liveIds = new Set(Object.values(state).flat().map((entry: any) => entry.user_id).filter(Boolean));
                setMembers((current) =>
                    current.map((member) => liveIds.has(member.user_id)
                        ? { ...member, is_online: true, presence_state: 'online', last_seen_at: new Date().toISOString() }
                        : member
                    )
                );
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED' && user?.id) {
                    await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
                }
            });

        return () => {
            cancelled = true;
            window.clearInterval(pingTimer);
            void supabase.removeChannel(channel);
        };
    }, [spaceId, user?.id]);

    const visibleMembers = useMemo(() => {
        return members
            .sort((a, b) => {
                const presenceRank: Record<string, number> = { online: 0, away: 1, offline: 2 };
                const aPresence = a.presence_state || (a.is_online ? 'online' : 'offline');
                const bPresence = b.presence_state || (b.is_online ? 'online' : 'offline');
                const presenceDelta = (presenceRank[aPresence] ?? 3) - (presenceRank[bPresence] ?? 3);
                if (presenceDelta !== 0) return presenceDelta;
                const roleDelta = (ROLE_RANKS[a.role] ?? 3) - (ROLE_RANKS[b.role] ?? 3);
                if (roleDelta !== 0) return roleDelta;
                return (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '');
            });
    }, [members]);

    return (
        <section className={`flex flex-col overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}>
            <div className="space-dashboard-panel-header flex items-center justify-between gap-3 border-b border-[#E5E5E5] px-4 py-3">
                <h2 className="space-dashboard-panel-title truncate text-[#0D0D0D]">Space Members</h2>
                <span className="space-dashboard-meta-pill shrink-0 rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-2 py-0.5 text-[#6E6E80]">
                    {loading ? 'Loading' : `${members.length} member${members.length === 1 ? '' : 's'}`}
                </span>
            </div>

            <div className={`min-h-0 flex-1 px-4 py-1.5 ${compact ? 'overflow-y-auto' : ''}`}>
                {loadingGate.isVisible ? (
                    <LoadingScreen
                        key={loadingGate.cycleKey}
                        message="Loading members..."
                        isComplete={loadingGate.isComplete}
                        onExitComplete={loadingGate.handleExitComplete}
                    />
                ) : visibleMembers.length > 0 ? (
                    <div className="divide-y divide-[#F0F0F1]">
                        {visibleMembers.map((member) => {
                            const roleKey = member.role === 'admin' ? 'owner' : member.role;
                            const presence = member.presence_state || (member.is_online ? 'online' : 'offline');
                            return (
                                <div key={member.user_id} className="space-dashboard-list-row grid grid-cols-[30px_minmax(0,1fr)] items-center gap-2.5 py-2">
                                    <div className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-[7px] border border-[#E5E5E5] bg-[#F7F7F8] text-[10px] font-semibold text-[#0D0D0D]">
                                        {member.avatar_url ? <img src={member.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(member) || <User size={13} />}
                                        <span className={`absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full ring-2 ring-white ${PRESENCE_DOT_STYLES[presence] || PRESENCE_DOT_STYLES.offline}`} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <p className="space-dashboard-list-name truncate text-[#0D0D0D]">{member.full_name || member.email || 'Member'}</p>
                                            <span className={`space-dashboard-meta-pill shrink-0 rounded-full border px-1.5 py-0.5 uppercase tracking-[0.08em] ${ROLE_STYLES[roleKey] || ROLE_STYLES.client}`}>
                                                {member.role === 'admin' ? 'Owner' : member.role}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                        <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-[#6E6E80]">
                            <Users size={16} />
                        </div>
                        <p className="text-sm font-medium text-[#0D0D0D]">No members found</p>
                        <p className="max-w-[220px] text-xs text-[#6E6E80]">Members will appear here as soon as they are attached to this space.</p>
                    </div>
                )}
            </div>
        </section>
    );
}
