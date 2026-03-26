import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errors';
import {
    LayoutDashboard, Users, MessageSquare, Calendar, FileText, Settings, Plus, Search,
    Briefcase, ChevronRight, LogOut, Video, Download, Upload, Clock, UserPlus, ArrowRight,
    Link as LinkIcon, Copy, ListTodo, MoreVertical, Flag, Trash2, User, ArrowLeft,
    GripVertical, Activity, Shield, Lock, FileUp, Key, FilePlus as FilePlus2,
    File as DocIcon, Rocket, LayoutGrid, Inbox, UserCheck, CheckSquare, FolderClosed,
    Bell, Eye, Play, X, FileVideo, ChevronLeft
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { AlertTriangle } from 'lucide-react';
import {
    GlassCard, Button, Heading, Text, Input, Modal, Checkbox, Toggle,
    SkeletonLoader, SkeletonCard, SkeletonText, SkeletonImage
} from '../UI/index';
import { FileViewerModal } from '../FileViewerModal';
import { FileUploadModal } from '../FileUploadModal';
import { ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData, ClientLifecycle } from '../../types';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeFiles } from '../../hooks/useRealtimeFiles';

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


// 1. Staff Dashboard
const StaffDashboardView = ({ clients, messages, meetings, tasks, profile, onJoin, onInstantMeet, onGoToSpace }: { clients: ClientSpace[], messages: Message[], meetings: Meeting[], tasks: Task[], profile: any, onJoin: (id: string) => void, onInstantMeet?: () => void, onGoToSpace?: (spaceId: string) => void }) => {
    const { showToast } = useToast();
    const { organizationId } = useAuth();
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isInternalUploadModalOpen, setIsInternalUploadModalOpen] = useState(false);
    const [selectedSpaceForUpload, setSelectedSpaceForUpload] = useState<string>(clients[0]?.id || '');
    const [uploading, setUploading] = useState(false);

    const { user } = useAuth();
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [tasksFeed, setTasksFeed] = useState<any[]>([]);
    const [upcomingMeetingsList, setUpcomingMeetingsList] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [engagement, setEngagement] = useState<any[]>([]);

    const loadData = useCallback(async () => {
        if (!user) return;
        try {
            setAnalyticsLoading(true);
            const [
                summaryRes,
                engagementRes,
                feedRes,
                meetingsRes,
                notificationsRes
            ] = await Promise.all([
                supabase.rpc('get_staff_dashboard_summary'),
                supabase.rpc('get_client_engagement_scores'),
                supabase.rpc('get_activity_feed', { p_limit: 10 }),
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
            setTasksFeed(feedRes.data || []);
            setUpcomingMeetingsList(meetingsRes.data || []);
            setNotifications(notificationsRes.data || []);

        } catch (err: any) {
            console.error('[StaffDashboardView] load failed:', err);
            showToast(friendlyError(err?.message), 'error');
        } finally {
            setAnalyticsLoading(false);
        }
    }, [user, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const upcomingMeetings = (meetings || [])
        .filter(m => {
            const isLive = m.status === 'active' || m.status === 'live';
            const isScheduled = m.status === 'scheduled';
            // Guardrail: If live, MUST have a room URL.
            if (isLive && !m.daily_room_url) return false;
            return isLive || isScheduled;
        })
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
        .slice(0, 3);

    const pendingTasks = (tasks || [])
        .filter(t => t.status !== 'done')
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 3);

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-end mb-8">
                <div>
                    <Heading level={1}>Overview</Heading>
                    <Text variant="secondary" className="mt-1">Workspaces and activity summary.</Text>
                </div>
                <div className="flex gap-3">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[#F7F7F8] rounded-md border border-[#D1D5DB]">
                        <div className="w-2 h-2 rounded-full bg-[#10A37F]"></div>
                        <span className="text-[10px] font-bold text-[#565869] uppercase tracking-wider">Cloud Sync Active</span>
                    </div>
                </div>
            </header>

            {/* Zone 1 — My Work Today */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Open Tasks</Text>
                    <div className="flex items-end gap-2 mt-1">
                        <div className="text-2xl font-semibold">{analyticsLoading ? <SkeletonLoader width="40px" height="24px" /> : (summary?.open_tasks ?? 0)}</div>
                        {(summary?.overdue_tasks ?? 0) > 0 && (
                            <span className="mb-1.5 h-2 w-2 rounded-full bg-rose-500 animate-pulse" title={`${summary.overdue_tasks} overdue`} />
                        )}
                    </div>
                </GlassCard>
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Meetings (Week)</Text>
                    <div className="text-2xl font-semibold mt-1">{analyticsLoading ? <SkeletonLoader width="40px" height="24px" /> : (summary?.meetings_this_week ?? 0)}</div>
                </GlassCard>
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tasks Done (Week)</Text>
                    <div className="text-2xl font-semibold mt-1">{analyticsLoading ? <SkeletonLoader width="40px" height="24px" /> : (summary?.tasks_completed_week ?? 0)}</div>
                </GlassCard>
                <GlassCard className="p-4">
                    <Text variant="secondary" className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">My Spaces</Text>
                    <div className="text-2xl font-semibold mt-1">{analyticsLoading ? <SkeletonLoader width="40px" height="24px" /> : (summary?.spaces_managed ?? 0)}</div>
                </GlassCard>
            </div>

            {/* Zone 2 — My Spaces (Engagement) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {analyticsLoading ? (
                    [1, 2, 3].map(i => <SkeletonCard key={i} className="h-48" />)
                ) : engagement.length === 0 ? (
                    <div className="col-span-full py-12 text-center bg-zinc-50 rounded-2xl border border-dashed">
                        <Users className="mx-auto text-zinc-300 mb-2" size={40} />
                        <p className="text-zinc-500 italic">No assigned spaces found.</p>
                    </div>
                ) : (
                    engagement.map(e => (
                        <GlassCard
                            key={e.space_id}
                            className="p-6 cursor-pointer hover:border-zinc-300 transition-all group"
                            onClick={() => onGoToSpace?.(e.space_id)}
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
                                Open Workspace <ArrowRight size={14} className="ml-1" />
                            </div>
                        </GlassCard>
                    ))
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Zone 3 — My Activity Feed */}
                    <GlassCard className="p-6">
                        <Heading level={3} className="mb-6">Recent Activity (Assigned Spaces)</Heading>
                        {analyticsLoading ? (
                            <div className="space-y-3"><SkeletonLoader height="60px" borderRadius="12px" /></div>
                        ) : tasksFeed.length === 0 ? (
                            <div className="text-zinc-400 text-sm italic py-4">No recent activity.</div>
                        ) : (
                            <div className="space-y-3">
                                {tasksFeed.map(item => (
                                    <div key={item.id} className="p-4 border border-zinc-100 rounded-xl bg-white flex items-center justify-between cursor-pointer hover:border-zinc-300 transition-colors" onClick={() => item.space_id && onGoToSpace?.(item.space_id)}>
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
                                        <ArrowRight size={14} className="text-zinc-300" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </GlassCard>

                    {/* Widget 2: Calendar / Upcoming Schedule */}
                    <GlassCard className="p-6">
                        <Heading level={3} className="mb-6">Upcoming Schedule</Heading>
                        {analyticsLoading ? (
                            <div className="space-y-3"><SkeletonLoader height="60px" borderRadius="12px" /></div>
                        ) : upcomingMeetingsList.length === 0 ? (
                            <div className="text-zinc-400 text-sm italic py-4">No upcoming meetings.</div>
                        ) : (
                            <div className="space-y-4">
                                {upcomingMeetingsList.map(m => {
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
                                loadData();
                            }}>Mark all read</Button>
                        </div>
                        {analyticsLoading ? (
                            <div className="space-y-3"><SkeletonLoader height="50px" borderRadius="10px" /></div>
                        ) : notifications.length === 0 ? (
                            <div className="text-center py-10">
                                <Activity className="mx-auto text-zinc-200 mb-2" size={32} />
                                <p className="text-zinc-400 text-xs italic">Inbox is clear.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {notifications.map(n => (
                                    <div key={n.id} className="p-3 bg-white border border-zinc-100 rounded-xl cursor-pointer hover:border-zinc-300 transition-colors" onClick={() => n.space_id && onGoToSpace?.(n.space_id)}>
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

                    <GlassCard className="p-6">
                        <Heading level={3} className="mb-4">Quick Actions</Heading>
                        <div className="space-y-2">
                            <button
                                onClick={() => onInstantMeet?.()}
                                className="w-full flex items-center gap-3 p-3 rounded-md border border-amber-100 bg-amber-50/50 hover:bg-amber-100/50 transition-colors text-left group"
                            >
                                <div className="bg-amber-100 p-2 rounded-lg text-amber-600 group-hover:scale-110 transition-transform">
                                    <Video size={16} />
                                </div>
                                <div>
                                    <span className="text-sm font-semibold text-amber-900 block">Meet Now</span>
                                    <span className="text-[10px] text-amber-700 font-medium">Start an instant video call</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setIsUploadModalOpen(true)}
                                className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-200 text-left"
                            >
                                <div className="bg-zinc-100 p-2 rounded-lg text-zinc-600">
                                    <FilePlus2 size={16} />
                                </div>
                                <span className="text-sm font-medium">Upload Document</span>
                            </button>
                            <button className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-200 text-left">
                                <div className="bg-zinc-100 p-2 rounded-lg text-zinc-600">
                                    <Clock size={16} />
                                </div>
                                <span className="text-sm font-medium">Schedule Meeting</span>
                            </button>
                            <button className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-200 text-left">
                                <div className="bg-zinc-100 p-2 rounded-lg text-zinc-600">
                                    <ListTodo size={16} />
                                </div>
                                <span className="text-sm font-medium">Assign Global Task</span>
                            </button>
                        </div>
                    </GlassCard>
                </div>
            </div>

            {/* Global Upload Modal with Space Selector */}
            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Upload to Client Space">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Select Destination Space</label>
                        <select
                            title="Select Destination Space"
                            className="w-full bg-white/40 border border-zinc-200 rounded-lg px-5 py-3 text-zinc-800 text-sm focus:outline-none"
                            value={selectedSpaceForUpload}
                            onChange={(e) => setSelectedSpaceForUpload(e.target.value)}
                        >
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="pt-2">
                        <Button
                            className="w-full"
                            onClick={() => {
                                setIsUploadModalOpen(false);
                                setIsInternalUploadModalOpen(true);
                            }}
                        >
                            Continue to Upload
                        </Button>
                    </div>
                </div>
            </Modal>

            <FileUploadModal
                isOpen={isInternalUploadModalOpen}
                onClose={() => setIsInternalUploadModalOpen(false)}
                loading={uploading}
                onUpload={async (file) => {
                    if (!selectedSpaceForUpload || !organizationId) return;
                    setUploading(true);
                    try {
                        const fileData = await apiService.uploadFile(selectedSpaceForUpload, organizationId, file);
                        await apiService.sendMessage(
                            selectedSpaceForUpload,
                            `Shared a file: ${file.name}`,
                            'file',
                            { file_id: fileData.id, file_name: file.name, mime_type: file.type },
                            'general',
                            organizationId
                        );
                        setIsInternalUploadModalOpen(false);
                        showToast("File uploaded successfully to the selected space.", "success");
                    } catch (err) {
                        console.error("Global upload error:", err);
                        showToast("Failed to upload file. Please try again.", "error");
                    } finally {
                        setUploading(false);
                    }
                }}
            />
        </div>
    );
};

export default StaffDashboardView;
