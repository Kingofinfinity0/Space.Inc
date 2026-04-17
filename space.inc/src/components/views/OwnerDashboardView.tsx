import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errors';
import { GlassCard, Button, Heading, Text, SkeletonLoader } from '../UI/index';
import { Calendar, Activity, FileText, MessageSquare } from 'lucide-react';
import { ClientSpace, Meeting, Message, Task } from '../../types';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import TaskWorkspace from '../tasks/TaskWorkspace';

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
        totalMessagesWeek: 0,
        meetingsMonth: 0,
        filesMonth: 0
    });

    const goToSpace = (spaceId: string) => {
        if (onGoToSpace) return onGoToSpace(spaceId);
        navigate(`/spaces/${spaceId}`);
    };

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
                    totalMessagesWeek: 0,
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
        <div className="space-y-6">
            <header className="flex justify-between items-end mb-8">
                <div>
                    <Heading level={1}>Overview</Heading>
                    <Text variant="secondary" className="mt-1">
                        Your task system now lives directly inside the executive overview.
                    </Text>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Active Spaces</Text>
                    <div className="mt-1 text-2xl font-semibold">{loading ? <SkeletonLoader width="40px" height="24px" /> : analytics.activeSpaces}</div>
                </GlassCard>
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Active Clients (7d)</Text>
                    <div className="mt-1 text-2xl font-semibold">{loading ? <SkeletonLoader width="40px" height="24px" /> : analytics.activeClients}</div>
                </GlassCard>
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Messages (7d)</Text>
                    <div className="mt-1 text-2xl font-semibold">{loading ? <SkeletonLoader width="40px" height="24px" /> : analytics.totalMessagesWeek}</div>
                </GlassCard>
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Meetings (Month)</Text>
                    <div className="mt-1 text-2xl font-semibold">{loading ? <SkeletonLoader width="40px" height="24px" /> : analytics.meetingsMonth}</div>
                </GlassCard>
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Files Shared (Month)</Text>
                    <div className="mt-1 text-2xl font-semibold">{loading ? <SkeletonLoader width="40px" height="24px" /> : analytics.filesMonth}</div>
                </GlassCard>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <TaskWorkspace
                        tasks={tasks}
                        clients={clients}
                        loading={loading}
                        compact
                        title="Task Management"
                        subtitle="Switch between board, list, timeline, calendar, and space views without leaving the overview."
                        groupOptions={['Design', 'Engineering', 'Marketing']}
                        onCreateTask={onCreateTask}
                        onUpdateTask={onUpdateTask}
                        onOpenSpace={goToSpace}
                        emptyTitle="No tasks in motion"
                        emptyDescription="Create the first task from the overview and it will show up across every connected space."
                    />

                    <GlassCard className="p-6">
                        <Heading level={3} className="mb-6">Upcoming Schedule</Heading>
                        {loading ? (
                            <div className="space-y-3"><SkeletonLoader height="60px" borderRadius="12px" /></div>
                        ) : upcomingMeetings.length === 0 ? (
                            <div className="py-4 text-sm italic text-zinc-400">No upcoming meetings scheduled.</div>
                        ) : (
                            <div className="space-y-4">
                                {upcomingMeetings.map((meeting) => {
                                    const startTime = new Date(meeting.starts_at);
                                    const canJoin = (startTime.getTime() - Date.now()) < 30 * 60 * 1000;
                                    return (
                                        <div key={meeting.id} className="flex items-center justify-between rounded-xl border border-zinc-100 p-4">
                                            <div className="flex items-center gap-4">
                                                <div className="min-w-[50px] text-center">
                                                    <p className="text-[10px] font-black uppercase text-zinc-400">{startTime.toLocaleString('en-US', { month: 'short' })}</p>
                                                    <p className="text-xl font-bold text-zinc-900">{startTime.getDate()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-zinc-900">{meeting.title}</p>
                                                    <p className="text-xs text-zinc-500">{meeting.space_name} · {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                            </div>
                                            {canJoin && <Button variant="primary" size="sm" onClick={() => onJoin(meeting.id)}>Join Now</Button>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </GlassCard>
                </div>

                <div className="space-y-6">
                    <GlassCard className="p-6">
                        <div className="mb-6 flex items-center justify-between">
                            <Heading level={3}>Inbox</Heading>
                            <Button variant="ghost" size="sm" onClick={async () => {
                                await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id);
                                setNotifications([]);
                            }}>
                                Mark all read
                            </Button>
                        </div>
                        {loading ? (
                            <div className="space-y-3"><SkeletonLoader height="50px" borderRadius="10px" /></div>
                        ) : notifications.length === 0 ? (
                            <div className="py-10 text-center">
                                <Activity className="mx-auto mb-2 text-[#D4D4D8]" size={32} />
                                <p className="text-xs italic text-[#6E6E80]">Inbox is clear.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {notifications.map((notification) => (
                                    <div key={notification.id} className="cursor-pointer rounded-[8px] border border-[#E5E5E5] bg-white p-3 transition-colors hover:bg-[#F7F7F8]" onClick={() => notification.space_id && goToSpace(notification.space_id)}>
                                        <div className="flex items-center gap-3">
                                            <div className="text-[#6E6E80]">
                                                {notification.type === 'file_uploaded'
                                                    ? <FileText size={16} />
                                                    : notification.type === 'message_received'
                                                        ? <MessageSquare size={16} />
                                                        : <Calendar size={16} />}
                                            </div>
                                            <p className="line-clamp-2 text-xs text-[#0D0D0D]">{notification.message}</p>
                                        </div>
                                        <p className="mt-2 text-[10px] text-[#6E6E80]">{timeAgo(notification.created_at)}</p>
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
