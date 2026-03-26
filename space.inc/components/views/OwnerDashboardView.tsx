import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errors';
import { GlassCard, Button, Heading, Text, SkeletonLoader, SkeletonCard } from '../UI/index';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Calendar, Users, Video, Activity, ArrowRight, Shield, CheckCircle2, AlertTriangle, FileText, MessageSquare } from 'lucide-react';
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
    const [tasksFeed, setTasksFeed] = useState<any[]>([]);
    const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [engagement, setEngagement] = useState<any[]>([]);
    const [meetingIntel, setMeetingIntel] = useState<any[]>([]);
    const [pipeline, setPipeline] = useState<any>(null);

    const load = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [
                summaryRes,
                engagementRes,
                meetingIntelRes,
                pipelineRes,
                feedRes,
                upcomingMeetingsRes,
                notificationsRes
            ] = await Promise.all([
                supabase.rpc('get_owner_dashboard_summary'),
                supabase.rpc('get_client_engagement_scores'),
                supabase.rpc('get_meeting_intelligence', { p_days: 30 }),
                supabase.rpc('get_acquisition_pipeline'),
                supabase.rpc('get_activity_feed', { p_limit: 15 }),
                supabase.from('meetings')
                    .select('id, title, space_name, starts_at, status')
                    .gt('starts_at', new Date().toISOString())
                    .eq('status', 'scheduled')
                    .order('starts_at')
                    .limit(10),
                supabase.from('notifications')
                    .select('id, type, message, is_read, created_at, space_id')
                    .eq('user_id', user.id)
                    .eq('is_read', false)
                    .order('created_at', { ascending: false })
                    .limit(20)
            ]);

            setSummary(summaryRes.data);
            setEngagement(engagementRes.data || []);
            setMeetingIntel(meetingIntelRes.data || []);
            setPipeline(pipelineRes.data);
            setTasksFeed(feedRes.data || []);
            setUpcomingMeetings(upcomingMeetingsRes.data || []);
            setNotifications(notificationsRes.data || []);

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

    const totalClientsCount = summary?.total_clients ?? 0;
    const newThisMonthCount = summary?.new_this_month ?? 0;
    const activeSpacesVal = summary?.active_spaces ?? 0;
    const planQuota = summary?.plan_quota ?? summary?.quota ?? null;

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

            {/* Zone 1 — Business Health Bar */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Total Clients</Text>
                    <div className="text-2xl font-semibold mt-1">{loading ? <SkeletonLoader width="40px" height="24px" /> : totalClientsCount}</div>
                </GlassCard>
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">New This Month</Text>
                    <div className="text-2xl font-semibold mt-1">{loading ? <SkeletonLoader width="40px" height="24px" /> : newThisMonthCount}</div>
                    {pipeline?.growth_rate !== undefined && (
                        <div className={`text-[10px] mt-1 flex items-center gap-1 ${pipeline.growth_rate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {pipeline.growth_rate >= 0 ? '↑' : '↓'} {Math.abs(pipeline.growth_rate)}% vs last month
                        </div>
                    )}
                </GlassCard>
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Active Spaces</Text>
                    <div className="text-2xl font-semibold mt-1">{loading ? <SkeletonLoader width="40px" height="24px" /> : activeSpacesVal}</div>
                </GlassCard>
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Plan / Quota</Text>
                    <div className="text-2xl font-semibold mt-1">{loading ? <SkeletonLoader width="40px" height="24px" /> : planQuota || 'N/A'}</div>
                </GlassCard>
                <GlassCard className={`p-4 border-2 transition-all ${silentAlert ? 'border-rose-100 bg-rose-50/30' : 'border-transparent'}`}>
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Silent Spaces (14d)</Text>
                    <div className={`text-2xl font-semibold mt-1 ${silentAlert ? 'text-rose-600 animate-pulse' : ''}`}>
                        {loading ? <SkeletonLoader width="40px" height="24px" /> : silentCount}
                    </div>
                </GlassCard>
            </div>

            {/* Zone 2 — Client Engagement Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    [1, 2, 3].map(i => <SkeletonCard key={i} className="h-48" />)
                ) : engagement.length === 0 ? (
                    <div className="col-span-full py-12 text-center bg-zinc-50 rounded-2xl border border-dashed">
                        <Users className="mx-auto text-zinc-300 mb-2" size={40} />
                        <p className="text-zinc-500 italic">No client engagement data available.</p>
                    </div>
                ) : (
                    engagement.map(e => (
                        <GlassCard
                            key={e.space_id}
                            className="p-6 cursor-pointer hover:border-zinc-300 transition-all group"
                            onClick={() => goToSpace(e.space_id)}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="min-w-0">
                                    <h4 className="font-bold text-zinc-900 truncate">{e.space_name}</h4>
                                    <p className="text-xs text-zinc-500 truncate">{e.client_name}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    e.engagement_level === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                    e.engagement_level === 'watching' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                    'bg-rose-50 text-rose-700 border border-rose-100'
                                }`}>
                                    {e.engagement_level}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-4">
                                <div className="text-center p-2 bg-zinc-50 rounded-lg">
                                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Activity</p>
                                    <p className="text-sm font-bold text-zinc-900">{e.days_since_last_activity}d</p>
                                </div>
                                <div className="text-center p-2 bg-zinc-50 rounded-lg">
                                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Msgs</p>
                                    <p className="text-sm font-bold text-zinc-900">{e.messages_this_week}</p>
                                </div>
                                <div className="text-center p-2 bg-zinc-50 rounded-lg">
                                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Meets</p>
                                    <p className="text-sm font-bold text-zinc-900">{e.meetings_this_month}</p>
                                </div>
                            </div>

                            {e.alert_message && (
                                <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg border border-amber-100 mb-2">
                                    <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-amber-800 font-medium leading-tight">{e.alert_message}</p>
                                </div>
                            )}

                            <div className="flex items-center justify-end text-xs font-bold text-zinc-400 group-hover:text-zinc-900 transition-colors">
                                View Space <ArrowRight size={14} className="ml-1" />
                            </div>
                        </GlassCard>
                    ))
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Zone 3 — Meeting Intelligence */}
                    <GlassCard className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <Heading level={3}>Meeting Intelligence (30d)</Heading>
                            <Text variant="secondary" className="text-xs">Success Rate %</Text>
                        </div>
                        {loading ? (
                            <div className="space-y-3"><SkeletonLoader height="150px" borderRadius="12px" /></div>
                        ) : meetingIntel.length === 0 ? (
                            <div className="text-zinc-400 text-sm italic py-8 text-center bg-zinc-50 rounded-xl">No recent meetings data.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                                            <th className="pb-3 pl-2">Space</th>
                                            <th className="pb-3">Held</th>
                                            <th className="pb-3">Success %</th>
                                            <th className="pb-3 text-right pr-2">Breakdown</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-50">
                                        {meetingIntel.map(intel => (
                                            <tr key={intel.space_id} className="group hover:bg-zinc-50/50 transition-colors">
                                                <td className="py-4 pl-2">
                                                    <p className="text-sm font-bold text-zinc-900">{intel.space_name}</p>
                                                </td>
                                                <td className="py-4">
                                                    <p className="text-sm text-zinc-600">{intel.total_meetings}</p>
                                                </td>
                                                <td className="py-4">
                                                    <span className={`px-2 py-1 rounded-md text-xs font-black border ${successRateColor(intel.success_rate)}`}>
                                                        {Math.round(intel.success_rate)}%
                                                    </span>
                                                </td>
                                                <td className="py-4 text-right pr-2">
                                                    <div className="flex justify-end gap-1">
                                                        {Object.entries(intel.category_breakdown || {}).slice(0, 3).map(([cat, count]: any) => (
                                                            <span key={cat} title={`${cat}: ${count}`} className="text-[8px] px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded font-bold uppercase tracking-tighter">
                                                                {cat.split('_')[0]}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </GlassCard>

                    {/* Zone 4 — Activity Feed */}
                    <GlassCard className="p-6">
                        <Heading level={3} className="mb-6">Executive Activity Feed</Heading>
                        {loading ? (
                            <div className="space-y-3"><SkeletonLoader height="60px" borderRadius="12px" /></div>
                        ) : tasksFeed.length === 0 ? (
                            <div className="text-zinc-400 text-sm italic py-4">No recent activity.</div>
                        ) : (
                            <div className="space-y-3">
                                {tasksFeed.map(item => (
                                    <div key={item.id} className="p-4 border border-zinc-100 rounded-xl bg-white flex items-center justify-between group hover:border-zinc-300 transition-all cursor-pointer" onClick={() => item.space_id && goToSpace(item.space_id)}>
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-400 group-hover:bg-zinc-100 transition-colors">
                                                {item.action_type === 'file_uploaded' ? <FileText size={18} /> :
                                                 item.action_type === 'message_sent' ? <MessageSquare size={18} /> :
                                                 <Video size={18} />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-zinc-900">
                                                    <span className="font-bold">{item.actor_name}</span> {ACTION_LABELS[item.action_type] || 'performed an action'}
                                                </p>
                                                <p className="text-xs text-zinc-500">{item.space_name} • {timeAgo(item.created_at)}</p>
                                            </div>
                                        </div>
                                        <ArrowRight size={14} className="text-zinc-200 group-hover:text-zinc-900 transition-colors" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </GlassCard>

                    {/* Widget 2: Calendar / Upcoming Schedule */}
                    <GlassCard className="p-6">
                        <Heading level={3} className="mb-6">Upcoming Schedule</Heading>
                        {loading ? (
                            <div className="space-y-3"><SkeletonLoader height="60px" borderRadius="12px" /></div>
                        ) : upcomingMeetings.length === 0 ? (
                            <div className="text-zinc-400 text-sm italic py-4">No upcoming meetings scheduled.</div>
                        ) : (
                            <div className="space-y-4">
                                {upcomingMeetings.map(m => {
                                    const startTime = new Date(m.starts_at);
                                    const canJoin = (startTime.getTime() - Date.now()) < 30 * 60 * 1000;
                                    return (
                                        <div key={m.id} className="flex items-center justify-between p-4 border border-zinc-100 rounded-xl">
                                            <div className="flex items-center gap-4">
                                                <div className="text-center min-w-[50px]">
                                                    <p className="text-[10px] font-black uppercase text-zinc-400">{startTime.toLocaleString('en-US', { month: 'short' })}</p>
                                                    <p className="text-xl font-bold text-zinc-900">{startTime.getDate()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-zinc-900">{m.title}</p>
                                                    <p className="text-xs text-zinc-500">{m.space_name} • {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                            </div>
                                            {canJoin && (
                                                <Button variant="primary" size="sm" onClick={() => onJoin(m.id)}>Join Now</Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </GlassCard>
                </div>

                <div className="space-y-6">
                    {/* Widget 3: Inbox / Notifications */}
                    <GlassCard className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <Heading level={3}>Inbox</Heading>
                            <Button variant="ghost" size="sm" onClick={async () => {
                                await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id);
                                load();
                            }}>Mark all read</Button>
                        </div>
                        {loading ? (
                            <div className="space-y-3"><SkeletonLoader height="50px" borderRadius="10px" /></div>
                        ) : notifications.length === 0 ? (
                            <div className="text-center py-10">
                                <Activity className="mx-auto text-zinc-200 mb-2" size={32} />
                                <p className="text-zinc-400 text-xs italic">Inbox is clear.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {notifications.map(n => (
                                    <div key={n.id} className="p-3 bg-white border border-zinc-100 rounded-xl cursor-pointer hover:border-zinc-300 transition-colors" onClick={() => n.space_id && goToSpace(n.space_id)}>
                                        <div className="flex items-center gap-3">
                                            <div className="text-zinc-400">
                                                {n.type === 'file_uploaded' ? <FileText size={16} /> : n.type === 'message_received' ? <MessageSquare size={16} /> : <Calendar size={16} />}
                                            </div>
                                            <p className="text-xs text-zinc-800 line-clamp-2">{n.message}</p>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 mt-2">{timeAgo(n.created_at)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </GlassCard>
                </div>
            </div>
        </div>
    );
}

