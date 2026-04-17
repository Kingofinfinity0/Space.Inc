import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errors';
import { GlassCard, Button, Heading, Text, SkeletonLoader } from '../UI/index';
import { Calendar, Activity, FileText, MessageSquare, ListTodo, Video } from 'lucide-react';
import { ClientSpace, Meeting, Message, Task } from '../../types';
import { apiService } from '../../services/apiService';
import TaskWorkspace from '../tasks/TaskWorkspace';

type StaffDashboardProps = {
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

export default function StaffDashboardView({
    clients,
    tasks,
    onJoin,
    onInstantMeet,
    onCreateTask,
    onUpdateTask,
    onGoToSpace
}: StaffDashboardProps) {
    const { user, organizationId } = useAuth();
    const { showToast } = useToast();

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

    useEffect(() => {
        const loadData = async () => {
            if (!user || !organizationId) return;
            try {
                setLoading(true);
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
                console.error('[StaffDashboardView] load failed:', err);
                showToast(friendlyError(err?.message), 'error');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [organizationId, showToast, user]);

    return (
        <div className="space-y-6">
            <header className="mb-8 flex items-end justify-between">
                <div>
                    <Heading level={1}>Overview</Heading>
                    <Text variant="secondary" className="mt-1">Run work from a cleaner shared task system while staying close to meetings and inbox activity.</Text>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">My Spaces</Text>
                    <div className="mt-1 text-2xl font-semibold">{loading ? <SkeletonLoader width="40px" height="24px" /> : analytics.activeSpaces}</div>
                </GlassCard>
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Clients Active (7d)</Text>
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
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Files (Month)</Text>
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
                        subtitle="Board, list, timeline, calendar, and space views are all available from the overview."
                        groupOptions={['Design', 'Engineering', 'Marketing']}
                        onCreateTask={onCreateTask}
                        onUpdateTask={onUpdateTask}
                        onOpenSpace={onGoToSpace}
                        emptyTitle="No tasks assigned yet"
                        emptyDescription="Start a task here and keep the rest of the team aligned from the same system."
                    />

                    <GlassCard className="p-6">
                        <Heading level={3} className="mb-6">Upcoming Schedule</Heading>
                        {loading ? (
                            <div className="space-y-3"><SkeletonLoader height="60px" borderRadius="12px" /></div>
                        ) : upcomingMeetings.length === 0 ? (
                            <div className="py-4 text-sm italic text-zinc-400">No upcoming meetings.</div>
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
                                <Activity className="mx-auto mb-2 text-zinc-200" size={32} />
                                <p className="text-xs italic text-zinc-400">Inbox is clear.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {notifications.map((notification) => (
                                    <div key={notification.id} className="cursor-pointer rounded-xl border border-zinc-100 bg-white p-3 transition-colors hover:border-zinc-300" onClick={() => notification.space_id && onGoToSpace?.(notification.space_id)}>
                                        <div className="flex items-center gap-3">
                                            <div className="text-zinc-400">
                                                {notification.type === 'file_uploaded'
                                                    ? <FileText size={16} />
                                                    : notification.type === 'message_received'
                                                        ? <MessageSquare size={16} />
                                                        : <Calendar size={16} />}
                                            </div>
                                            <p className="line-clamp-2 text-xs text-zinc-800">{notification.message}</p>
                                        </div>
                                        <p className="mt-2 text-[10px] text-zinc-400">{timeAgo(notification.created_at)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </GlassCard>

                    <GlassCard className="p-6">
                        <Heading level={3} className="mb-4">Quick Actions</Heading>
                        <div className="space-y-2">
                            <button
                                onClick={() => onInstantMeet?.()}
                                className="w-full rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-3 text-left transition-colors hover:bg-white"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-2 text-[#0D0D0D]">
                                        <Video size={16} />
                                    </div>
                                    <div>
                                        <span className="block text-sm font-semibold text-[#0D0D0D]">Meet Now</span>
                                        <span className="text-[10px] font-medium text-[#6E6E80]">Start an instant video call</span>
                                    </div>
                                </div>
                            </button>
                            <div className="flex items-center gap-3 rounded-[8px] border border-[#E5E5E5] p-3">
                                <div className="rounded-[8px] bg-[#F7F7F8] p-2 text-[#6E6E80]">
                                    <ListTodo size={16} />
                                </div>
                                <div>
                                    <span className="block text-sm font-medium text-[#0D0D0D]">Tasks stay synced</span>
                                    <span className="text-[10px] text-[#6E6E80]">Create and update work from overview or inside a space.</span>
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            </div>
        </div>
    );
}
