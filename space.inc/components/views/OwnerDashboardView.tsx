import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errors';
import { GlassCard, Button, Heading, Text, SkeletonLoader } from '../UI/index';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Calendar, Users, Video, Activity, ArrowRight, Shield, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ClientSpace, Meeting, Message, StaffMember, Task } from '../../types';
import { useNavigate } from 'react-router-dom';

type OwnerDashboardProps = {
    clients: ClientSpace[];
    messages: Message[];
    meetings: Meeting[];
    tasks: Task[];
    profile: any;
    onJoin: (id: string) => void;
    onInstantMeet?: () => void;
    onGoToSpace?: (spaceId: string) => void;
};

function timeAgo(dateStr?: string) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

const ACTION_LABELS: Record<string, string> = {
    message_sent: 'sent a message',
    file_uploaded: 'uploaded a file',
    file_downloaded: 'viewed a file',
    meeting_started: 'started a meeting',
    meeting_ended: 'ended a meeting',
    meeting_outcome_recorded: 'recorded a meeting outcome',
    meeting_created: 'scheduled a meeting',
    space_created: 'created a new space',
    invitation_accepted: 'joined the team',
    task_created: 'created a task',
    task_completed: 'completed a task',
};

export default function OwnerDashboardView({
    clients,
    messages,
    meetings,
    tasks,
    profile,
    onJoin,
    onInstantMeet,
    onGoToSpace
}: OwnerDashboardProps) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>(null);
    const [engagement, setEngagement] = useState<any[]>([]);
    const [meetingIntel, setMeetingIntel] = useState<any[]>([]);
    const [pipeline, setPipeline] = useState<any>(null);
    const [feed, setFeed] = useState<any[]>([]);

    const load = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const results = await Promise.all([
                supabase.rpc('get_owner_dashboard_summary'),
                supabase.rpc('get_client_engagement_scores'),
                supabase.rpc('get_meeting_intelligence', { p_days: 30 }),
                supabase.rpc('get_acquisition_pipeline'),
                supabase.rpc('get_activity_feed', { p_limit: 15 })
            ]);

            // Supabase rpc returns { data, error }
            const s = results[0] as any;
            const e = results[1] as any;
            const mi = results[2] as any;
            const p = results[3] as any;
            const f = results[4] as any;

            if (s.error) throw s.error;
            if (e.error) throw e.error;
            if (mi.error) throw mi.error;
            if (p.error) throw p.error;
            if (f.error) throw f.error;

            setSummary(s.data || {});
            setEngagement(e.data || []);
            setMeetingIntel(mi.data || []);
            setPipeline(p.data || null);
            setFeed(f.data || []);
        } catch (err: any) {
            console.error('[OwnerDashboardView] load failed:', err);
            showToast(friendlyError(err?.message), 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const silentCount = summary?.spaces_silent_14d ?? summary?.spaces_silent ?? 0;
    const silentAlert = typeof silentCount === 'number' && silentCount > 0;

    const totalClients = summary?.total_clients ?? summary?.totalClients ?? 0;
    const newThisMonth = summary?.new_this_month ?? summary?.newThisMonth ?? 0;
    const activeSpaces = summary?.active_spaces ?? summary?.activeSpaces ?? 0;
    const planQuota = summary?.plan_quota ?? summary?.plan ?? summary?.quota ?? null;

    const goToSpace = (spaceId: string) => {
        if (onGoToSpace) return onGoToSpace(spaceId);
        // Fallback: rely on route config only if you have a route; otherwise no-op.
        navigate(`/spaces/${spaceId}`);
    };

    const successRateColor = (rate: number) => {
        if (rate >= 60) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        if (rate >= 40) return 'bg-amber-50 text-amber-700 border-amber-100';
        return 'bg-rose-50 text-rose-700 border-rose-100';
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-end mb-8">
                <div>
                    <Heading level={1}>Executive Analytics</Heading>
                    <Text variant="secondary" className="mt-1">
                        Real engagement, meetings, and activity signals.
                    </Text>
                </div>
            </header>

            {/* Zone 1 — Stat bar */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <GlassCard className="p-4 md:col-span-1">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Total Clients</Text>
                    <div className="text-3xl font-semibold text-[#1D1D1D]">{loading ? <SkeletonLoader width="60px" height="28px" /> : totalClients}</div>
                </GlassCard>
                <GlassCard className="p-4 md:col-span-1">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">New This Month</Text>
                    <div className="text-3xl font-semibold text-[#1D1D1D]">{loading ? <SkeletonLoader width="60px" height="28px" /> : newThisMonth}</div>
                </GlassCard>
                <GlassCard className="p-4 md:col-span-1">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Active Spaces</Text>
                    <div className="text-3xl font-semibold text-[#1D1D1D]">{loading ? <SkeletonLoader width="60px" height="28px" /> : activeSpaces}</div>
                </GlassCard>
                <GlassCard className="p-4 md:col-span-1">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Plan / Quota</Text>
                    <div className="text-sm text-[#1D1D1D] mt-2">
                        {loading ? <SkeletonLoader width="120px" height="14px" /> : planQuota ? String(planQuota) : '—'}
                    </div>
                </GlassCard>
                <GlassCard className={`p-4 md:col-span-1 ${silentAlert ? 'border-rose-200 bg-rose-50/30' : ''}`}>
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Spaces Quiet</Text>
                    <div className="text-sm text-[#1D1D1D] mt-2">
                        {loading ? '—' : silentAlert ? `${silentCount} spaces have gone quiet` : 'No silent spaces'}
                    </div>
                </GlassCard>
            </div>

            {/* Zone 2 — Engagement grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <GlassCard className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <Heading level={3}>Engagement by Space</Heading>
                            <Button variant="ghost" size="sm">View All</Button>
                        </div>
                        {loading ? (
                            <div className="space-y-3">
                                {[0, 1, 2].map(i => (
                                    <SkeletonLoader key={i} height="84px" borderRadius="16px" />
                                ))}
                            </div>
                        ) : engagement.length === 0 ? (
                            <div className="text-zinc-400 text-sm italic">No engagement data yet.</div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {engagement.map((row: any) => {
                                    const risk = row.badge || row.status || row.risk || row.engagement_status;
                                    const isActive = risk === 'active';
                                    const isWatching = risk === 'watching';
                                    const isAtRisk = risk === 'at_risk';
                                    const badgeClass = isActive
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        : isWatching
                                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                                            : isAtRisk
                                                ? 'bg-rose-50 text-rose-700 border-rose-100'
                                                : 'bg-zinc-50 text-zinc-700 border-zinc-100';

                                    const spaceId = row.space_id || row.spaceId;
                                    const spaceName = row.space_name || row.spaceName || 'Space';
                                    const clientName = row.client_name || row.clientName || 'Client';

                                    return (
                                        <button
                                            key={spaceId || spaceName}
                                            onClick={() => spaceId && goToSpace(spaceId)}
                                            className="w-full text-left p-4 border border-zinc-100 rounded-xl hover:border-zinc-300 transition-colors bg-white"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-[#1D1D1D] truncate">{spaceName}</p>
                                                    <p className="text-[12px] text-zinc-500 truncate mt-1">{clientName}</p>
                                                </div>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider border px-2 py-1 rounded-full ${badgeClass}`}>
                                                    {risk || 'active'}
                                                </span>
                                            </div>
                                            <div className="text-[12px] text-zinc-500 mt-3">
                                                Last activity: {row.last_activity_at ? new Date(row.last_activity_at).toLocaleDateString() : '—'}
                                            </div>
                                            <div className="flex items-center gap-3 mt-3 text-[12px] text-zinc-600">
                                                <span>{row.messages_this_week ?? 0} messages</span>
                                                <span>•</span>
                                                <span>{row.meetings_this_month ?? 0} meetings</span>
                                            </div>
                                            {row.alert_message && (
                                                <div className="mt-3 text-[12px] bg-amber-50 border border-amber-100 text-amber-800 px-3 py-2 rounded-lg">
                                                    {row.alert_message}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </GlassCard>

                    {/* Zone 3 — Meeting Intelligence */}
                    <GlassCard className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <Heading level={3}>Meeting Intelligence</Heading>
                            <Button variant="ghost" size="sm">Last 30 Days</Button>
                        </div>
                        {loading ? (
                            <div className="text-sm text-zinc-400">Loading...</div>
                        ) : meetingIntel.length === 0 ? (
                            <div className="text-sm text-zinc-400 italic">No meeting intelligence data.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="text-[10px] uppercase tracking-wider text-zinc-500">
                                            <th className="py-2">Space</th>
                                            <th className="py-2">Meetings held</th>
                                            <th className="py-2">Success %</th>
                                            <th className="py-2">Category breakdown</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {meetingIntel.map((r: any, idx: number) => {
                                            const successRate = Number(r.success_rate ?? r.successRate ?? 0);
                                            return (
                                                <tr key={r.space_id || idx} className="border-t border-zinc-100">
                                                    <td className="py-3 font-medium text-zinc-800">{r.space_name || r.space || '—'}</td>
                                                    <td className="py-3 text-zinc-600">{r.meetings_held ?? r.meetingsHeld ?? 0}</td>
                                                    <td className="py-3">
                                                        <span className={`px-2 py-1 rounded-full text-[12px] border ${successRateColor(successRate)}`}>
                                                            {Number.isFinite(successRate) ? `${successRate}%` : '—'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-zinc-600">
                                                        {typeof r.category_breakdown === 'string'
                                                            ? r.category_breakdown
                                                            : r.category_breakdown
                                                                ? JSON.stringify(r.category_breakdown)
                                                                : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </GlassCard>
                </div>

                {/* Zone 4 — Activity feed */}
                <div className="space-y-6">
                    <GlassCard className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <Heading level={3}>Activity Feed</Heading>
                            <Button variant="ghost" size="sm">Recent</Button>
                        </div>
                        {loading ? (
                            <div className="space-y-3">
                                {[0, 1, 2].map(i => (
                                    <SkeletonLoader key={i} height="56px" borderRadius="14px" />
                                ))}
                            </div>
                        ) : feed.length === 0 ? (
                            <div className="text-sm text-zinc-400 italic">No activity yet.</div>
                        ) : (
                            <div className="space-y-3">
                                {feed.map((item: any) => {
                                    const action = item.action_type || item.actionType;
                                    const actionLabel = ACTION_LABELS[action] || action || 'did something';
                                    const actor = item.actor_name || item.actorName || 'Someone';
                                    const spaceName = item.space_name || item.spaceName || 'space';
                                    const createdAt = item.created_at || item.createdAt;
                                    return (
                                        <div key={item.id || `${actor}-${createdAt}`} className="p-3 rounded-xl border border-zinc-100 bg-white">
                                            <p className="text-sm text-zinc-800">
                                                {actor} {actionLabel} in {spaceName}
                                            </p>
                                            <p className="text-[12px] text-zinc-500 mt-1">
                                                {timeAgo(createdAt)}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </GlassCard>

                    {/* Small pipeline / chart hint (optional visualization) */}
                    <GlassCard className="p-6">
                        <Heading level={3} className="mb-3">Acquisition Signals</Heading>
                        <Text variant="secondary" className="text-sm">
                            {pipeline ? 'Signal snapshot loaded.' : '—'}
                        </Text>
                        <div className="h-[160px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={[{ value: 22 }, { value: 35 }, { value: 30 }, { value: 48 }, { value: 44 }]} >
                                    <defs>
                                        <linearGradient id="owner-gradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#18181b" stopOpacity={0.12} />
                                            <stop offset="95%" stopColor="#18181b" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="value" stroke="#18181b" strokeWidth={2} fill="url(#owner-gradient)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </GlassCard>
                </div>
            </div>
        </div>
    );
}

