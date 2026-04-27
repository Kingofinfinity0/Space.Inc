import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errors';
import { GlassCard, Button, Heading, Text, SkeletonLoader } from '../UI/index';
import { Calendar, Activity, FileText, MessageSquare, Sparkles } from 'lucide-react';
import { ClientSpace, Meeting, Message, Task } from '../../types';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import TaskWorkspace from '../tasks/TaskWorkspace';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

type OwnerDashboardProps = {
    clients: ClientSpace[];
    messages: Message[];
    meetings: Meeting[];
    tasks: Task[];
    profile: any;
    onJoin: (id: string) => void;
    onInstantMeet?: () => void;
    onCreateTask: (task: Partial<Task>) => Promise<void> | void;
    onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void> | void;
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

export default function OwnerDashboardView({
    clients,
    meetings,
    tasks,
    onJoin,
    onCreateTask,
    onUpdateTask,
    onGoToSpace
}: OwnerDashboardProps) {
    const { user, organizationId } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [analytics, setAnalytics] = useState({
        activeSpaces: 0,
        activeClients: 0,
        meetingsMonth: 0,
        filesMonth: 0
    });

    const goToSpace = (spaceId: string) => {
        if (onGoToSpace) return onGoToSpace(spaceId);
        navigate(`/spaces/${spaceId}`);
    };

    const executiveSnapshot = useMemo(() => ([
        {
            label: 'Active Spaces',
            value: analytics.activeSpaces,
            tone: 'blue'
        },
        {
            label: 'Active Clients',
            value: analytics.activeClients,
            tone: 'green'
        },
        {
            label: 'Meetings This Month',
            value: analytics.meetingsMonth,
            tone: 'purple'
        },
        {
            label: 'Files Shared',
            value: analytics.filesMonth,
            tone: 'yellow'
        },
        {
            label: 'Open Tasks',
            value: tasks.filter((task) => task.status !== 'done').length,
            tone: 'rose'
        }
    ]), [analytics.activeClients, analytics.activeSpaces, analytics.filesMonth, analytics.meetingsMonth, tasks]);

    const statusSeries = useMemo(() => ([
        { stage: 'To Do', value: tasks.filter((task) => task.status === 'todo' || task.status === 'pending').length },
        { stage: 'In Progress', value: tasks.filter((task) => task.status === 'in_progress').length },
        { stage: 'Review', value: tasks.filter((task) => task.status === 'review').length },
        { stage: 'Done', value: tasks.filter((task) => task.status === 'done').length }
    ]), [tasks]);

    useEffect(() => {
        const load = async () => {
            if (!user || !organizationId) return;
            setLoading(true);
            try {
                const now = new Date().toISOString();
                const [meetingsRes, notificationsRes, analyticsRes] = await Promise.all([
                    apiService.getMeetings(organizationId),
                    apiService.getUnifiedNotifications(organizationId, user.id),
                    apiService.getDashboardMetrics(organizationId)
                ]);

                setUpcomingMeetings((meetingsRes.data || []).filter((m: any) => m.starts_at > now && m.status === 'scheduled').slice(0, 10));
                setNotifications(notificationsRes.data || []);
                setAnalytics(analyticsRes.data || {
                    activeSpaces: 0,
                    activeClients: 0,
                    meetingsMonth: 0,
                    filesMonth: 0
                });
            } catch (err: any) {
                console.error('[OwnerDashboardView] load failed:', err);
                showToast(friendlyError(err?.message), 'error');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [organizationId, showToast, user]);

    return (
        <div className="space-y-5 page-enter">
            <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="max-w-2xl space-y-2">
                    <div className="surface-chip px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em]">
                        <Sparkles size={12} />
                        Executive overview
                    </div>
                    <Heading level={1}>Overview</Heading>
                    <Text variant="secondary" size="sm" className="max-w-2xl">
                        Your operational surface, task system, and client intelligence live here in one calm, high-density command center.
                    </Text>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {executiveSnapshot.map((metric) => (
                    <GlassCard key={metric.label} className="p-3">
                        <div className="flex items-center justify-between gap-3">
                            <Text variant="secondary" className="text-[9px] font-semibold uppercase tracking-[0.18em]">{metric.label}</Text>
                            <span className="indicator-dot" data-tone={metric.tone} />
                        </div>
                        <div className="mt-2 text-[28px] font-semibold leading-none text-[#0D0D0D]">
                            {loading ? <SkeletonLoader width="40px" height="24px" /> : metric.value}
                        </div>
                    </GlassCard>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
                        <GlassCard className="p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <Heading level={3} className="text-lg">Task Shape Analysis</Heading>
                                    <Text variant="secondary" size="xs">Weekly view of where the work is moving.</Text>
                                </div>
                                <span className="surface-chip px-2.5 py-1 text-[10px] font-medium">
                                    <Activity size={11} />
                                    Weekly View
                                </span>
                            </div>
                            <div className="h-[180px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={statusSeries} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="taskFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#0D0D0D" stopOpacity={0.2} />
                                                <stop offset="100%" stopColor="#0D0D0D" stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="stage" tickLine={false} axisLine={false} tick={{ fill: '#6E6E80', fontSize: 10 }} />
                                        <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: '#6E6E80', fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff' }}
                                            labelStyle={{ color: '#0D0D0D', fontWeight: 600, fontSize: '12px' }}
                                        />
                                        <Area type="monotone" dataKey="value" stroke="#0D0D0D" strokeWidth={2} fill="url(#taskFill)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </GlassCard>

                        <GlassCard className="p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <Heading level={3} className="text-lg">Upcoming Schedule</Heading>
                                <span className="surface-chip px-2.5 py-1 text-[10px] font-medium">
                                    <Calendar size={11} />
                                    Live view
                                </span>
                            </div>
                            {loading ? (
                                <div className="space-y-2"><SkeletonLoader height="52px" borderRadius="10px" /></div>
                            ) : upcomingMeetings.length === 0 ? (
                                <div className="py-4 text-sm italic text-[#6E6E80]">No upcoming meetings scheduled.</div>
                            ) : (
                                <div className="space-y-2">
                                    {upcomingMeetings.slice(0, 3).map((meeting) => {
                                        const startTime = new Date(meeting.starts_at);
                                        const canJoin = (startTime.getTime() - Date.now()) < 30 * 60 * 1000;
                                        return (
                                            <div key={meeting.id} className="database-row flex items-center justify-between p-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="min-w-[44px] text-center">
                                                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#6E6E80]">{startTime.toLocaleString('en-US', { month: 'short' })}</p>
                                                        <p className="text-lg font-semibold text-[#0D0D0D]">{startTime.getDate()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-[#0D0D0D]">{meeting.title}</p>
                                                        <p className="text-xs text-[#6E6E80]">{meeting.space_name} · {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                </div>
                                                {canJoin && <Button variant="primary" size="sm" className="h-8 px-3 text-xs" onClick={() => onJoin(meeting.id)}>Join</Button>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </GlassCard>
                    </div>

                    <TaskWorkspace
                        tasks={tasks}
                        clients={clients}
                        loading={loading}
                        compact
                        showToolbar={false}
                        showSummary={false}
                        title="Task Management"
                        subtitle="Weekly command view for active work."
                        groupOptions={['Design', 'Engineering', 'Marketing']}
                        onCreateTask={onCreateTask}
                        onUpdateTask={onUpdateTask}
                        onOpenSpace={goToSpace}
                        emptyTitle="No tasks in motion"
                        emptyDescription="Create the first task from the overview and it will show up across every connected space."
                    />
                </div>

                <div className="space-y-4">
                    <GlassCard className="p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <Heading level={3} className="text-lg">Inbox</Heading>
                            <Button variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={async () => {
                                await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id);
                                setNotifications([]);
                            }}>
                                Mark all read
                            </Button>
                        </div>
                        {loading ? (
                            <div className="space-y-2"><SkeletonLoader height="48px" borderRadius="10px" /></div>
                        ) : notifications.length === 0 ? (
                            <div className="py-8 text-center">
                                <Activity className="mx-auto mb-2 text-[#D4D4D8]" size={24} />
                                <p className="text-xs italic text-[#6E6E80]">Inbox is clear.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {notifications.slice(0, 3).map((notification) => (
                                    <button key={notification.id} className="database-row w-full cursor-pointer p-3 text-left transition-colors hover:bg-[#F7F7F8]" onClick={() => notification.space_id && goToSpace(notification.space_id)}>
                                        <div className="flex items-center gap-3">
                                            <div className="text-[#6E6E80]">
                                                {notification.type === 'file_uploaded'
                                                    ? <FileText size={14} />
                                                    : notification.type === 'message_received'
                                                        ? <MessageSquare size={14} />
                                                        : <Calendar size={14} />}
                                            </div>
                                            <p className="line-clamp-2 text-xs text-[#0D0D0D]">{notification.message}</p>
                                        </div>
                                        <p className="mt-2 text-[10px] text-[#6E6E80]">{timeAgo(notification.created_at)}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </GlassCard>
                </div>
            </div>
        </div>
    );
}
