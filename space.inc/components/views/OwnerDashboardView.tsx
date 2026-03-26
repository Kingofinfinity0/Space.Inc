import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errors';
import { GlassCard, Button, Heading, Text, SkeletonLoader } from '../UI/index';
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
    const [analytics, setAnalytics] = useState<any>({
        activeSpaces: 0,
        activeClients: 0,
        totalMessagesWeek: 0,
        meetingsMonth: 0,
        filesMonth: 0
    });

    const load = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const now = new Date().toISOString();
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

            const [tasksRes, meetingsRes, notificationsRes, analyticsRes] = await Promise.all([
                // Widget 1: Task Management (activity_logs as tasks)
                supabase.from('activity_logs')
                    .select('id, action_type, space_name, created_at, actor_name')
                    .in('action_type', ['meeting_created', 'file_uploaded'])
                    .gt('created_at', sevenDaysAgo)
                    .order('created_at', { ascending: false }),

                // Widget 2: Calendar
                supabase.from('meetings')
                    .select('id, title, space_name, starts_at, status')
                    .gt('starts_at', now)
                    .eq('status', 'scheduled')
                    .order('starts_at')
                    .limit(10),

                // Widget 3: Inbox / Notifications
                supabase.from('notifications')
                    .select('id, type, message, is_read, created_at, space_id')
                    .eq('user_id', user.id)
                    .eq('is_read', false)
                    .order('created_at', { ascending: false })
                    .limit(20),

                // Widget 4: Business Analytics
                Promise.all([
                    supabase.from('spaces').select('id', { count: 'exact' }).eq('status', 'active'),
                    supabase.from('space_memberships')
                        .select('id', { count: 'exact' })
                        .eq('role', 'client')
                        .gt('last_activity_at', sevenDaysAgo),
                    supabase.from('messages').select('id', { count: 'exact' }).gt('created_at', sevenDaysAgo),
                    supabase.from('meetings').select('id', { count: 'exact' }).eq('status', 'ended').gt('ended_at', startOfMonth),
                    supabase.from('files').select('id', { count: 'exact' }).gt('created_at', startOfMonth)
                ])
            ]);

            setTasksFeed(tasksRes.data || []);
            setUpcomingMeetings(meetingsRes.data || []);
            setNotifications(notificationsRes.data || []);
            setAnalytics({
                activeSpaces: analyticsRes[0].count || 0,
                activeClients: analyticsRes[1].count || 0,
                totalMessagesWeek: analyticsRes[2].count || 0,
                meetingsMonth: analyticsRes[3].count || 0,
                filesMonth: analyticsRes[4].count || 0
            });

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

    const summary = useMemo(() => {
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

        const silentCount = clients.filter(c => {
            const lastActivity = c.last_activity_at ? new Date(c.last_activity_at) : new Date(0);
            return lastActivity < fourteenDaysAgo;
        }).length;

        const newThisMonth = clients.filter(c => {
            const createdAt = new Date(c.created_at);
            return createdAt >= startOfMonth;
        }).length;

        return {
            spaces_silent_14d: silentCount,
            total_clients: clients.length,
            new_this_month: newThisMonth,
            active_spaces: analytics.activeSpaces,
            plan_quota: null // Not available in current context
        };
    }, [clients, analytics.activeSpaces]);

    const silentCount = summary?.spaces_silent_14d ?? 0;
    const silentAlert = typeof silentCount === 'number' && silentCount > 0;

    const totalClients = summary?.total_clients ?? 0;
    const newThisMonth = summary?.new_this_month ?? 0;
    const activeSpacesVal = summary?.active_spaces ?? 0;
    const planQuota = summary?.plan_quota ?? null;

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

            {/* Widget 4: Business Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Active Spaces</Text>
                    <div className="text-2xl font-semibold mt-1">{loading ? <SkeletonLoader width="40px" height="24px" /> : activeSpacesVal}</div>
                </GlassCard>
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Active Clients (7d)</Text>
                    <div className="text-2xl font-semibold mt-1">{loading ? <SkeletonLoader width="40px" height="24px" /> : analytics.activeClients}</div>
                </GlassCard>
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Messages (7d)</Text>
                    <div className="text-2xl font-semibold mt-1">{loading ? <SkeletonLoader width="40px" height="24px" /> : analytics.totalMessagesWeek}</div>
                </GlassCard>
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Meetings (Month)</Text>
                    <div className="text-2xl font-semibold mt-1">{loading ? <SkeletonLoader width="40px" height="24px" /> : analytics.meetingsMonth}</div>
                </GlassCard>
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Files Shared (Month)</Text>
                    <div className="text-2xl font-semibold mt-1">{loading ? <SkeletonLoader width="40px" height="24px" /> : analytics.filesMonth}</div>
                </GlassCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Widget 1: Task Management */}
                    <GlassCard className="p-6">
                        <Heading level={3} className="mb-6">Task Management</Heading>
                        {loading ? (
                            <div className="space-y-3"><SkeletonLoader height="60px" borderRadius="12px" /></div>
                        ) : tasksFeed.length === 0 ? (
                            <div className="text-zinc-400 text-sm italic py-4">No recent activity tasks.</div>
                        ) : (
                            <div className="space-y-3">
                                {tasksFeed.map(item => (
                                    <div key={item.id} className="p-4 border border-zinc-100 rounded-xl bg-white flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-400">
                                                {item.action_type === 'file_uploaded' ? <FileText size={18} /> : <Video size={18} />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-zinc-900">{item.actor_name} {ACTION_LABELS[item.action_type]}</p>
                                                <p className="text-xs text-zinc-500">{item.space_name} • {timeAgo(item.created_at)}</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" icon={<ArrowRight size={14} />} />
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

