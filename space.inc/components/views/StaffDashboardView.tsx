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

    // System 5B: Staff analytics (Task 5B)
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [staffSummary, setStaffSummary] = useState<any>(null);
    const [engagement, setEngagement] = useState<any[]>([]);
    const [feed, setFeed] = useState<any[]>([]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                setAnalyticsLoading(true);
                const [summaryRes, engagementRes, feedRes] = await Promise.all([
                    supabase.rpc('get_staff_dashboard_summary'),
                    supabase.rpc('get_client_engagement_scores'),
                    supabase.rpc('get_activity_feed', { p_limit: 10 })
                ]);

                if (summaryRes.error) throw summaryRes.error;
                if (engagementRes.error) throw engagementRes.error;
                if (feedRes.error) throw feedRes.error;

                if (cancelled) return;
                setStaffSummary(summaryRes.data || {});
                setEngagement(engagementRes.data || []);
                setFeed(feedRes.data || []);
            } catch (err: any) {
                console.error('[StaffDashboardView] analytics load failed:', err);
                showToast(friendlyError(err?.message), 'error');
            } finally {
                if (!cancelled) setAnalyticsLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [showToast]);

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

            {/* Zone 1 — My Work (Task 5B) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(() => {
                    const now = new Date();
                    const overdue = staffSummary?.overdue_tasks ?? (tasks || []).filter(t => t.status !== 'done' && new Date(t.due_date).getTime() < now.getTime()).length;
                    const openTasks = staffSummary?.open_tasks ?? (tasks || []).filter(t => t.status !== 'done').length;
                    return (
                        <GlassCard className="p-6 relative overflow-hidden group">
                            <div className="flex items-center justify-between gap-3">
                                <Text variant="secondary" className="mb-4 font-semibold uppercase text-[10px] tracking-wider flex items-center gap-2">
                                    Open Tasks
                                    {overdue > 0 && <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" title="Overdue" />}
                                </Text>
                            </div>
                            <div className="flex items-end justify-between">
                                <span className="text-4xl font-semibold text-[#1D1D1D] tracking-tight">{analyticsLoading ? '—' : openTasks}</span>
                                <div className="h-10 w-10 rounded-md bg-[#ECECF1] flex items-center justify-center text-[#1D1D1D]">
                                    <ListTodo size={18} />
                                </div>
                            </div>
                        </GlassCard>
                    );
                })()}

                {(() => {
                    const upcomingMeetings = staffSummary?.upcoming_meetings_this_week ?? (meetings || []).filter(m => (m.status === 'scheduled' || m.status === 'active') && new Date(m.starts_at).getTime() >= Date.now() && new Date(m.starts_at).getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000).length;
                    return (
                        <GlassCard className="p-6 relative overflow-hidden group">
                            <Text variant="secondary" className="mb-4 font-semibold uppercase text-[10px] tracking-wider">Upcoming Meetings</Text>
                            <div className="flex items-end justify-between">
                                <span className="text-4xl font-semibold text-[#1D1D1D] tracking-tight">{analyticsLoading ? '—' : upcomingMeetings}</span>
                                <div className="h-10 w-10 rounded-md bg-[#ECECF1] flex items-center justify-center text-[#1D1D1D]">
                                    <Video size={18} />
                                </div>
                            </div>
                        </GlassCard>
                    );
                })()}

                {(() => {
                    const completedThisWeek = staffSummary?.tasks_completed_this_week ?? (tasks || []).filter(t => t.status === 'done').length;
                    return (
                        <GlassCard className="p-6 relative overflow-hidden group">
                            <Text variant="secondary" className="mb-4 font-semibold uppercase text-[10px] tracking-wider">Tasks Completed</Text>
                            <div className="flex items-end justify-between">
                                <span className="text-4xl font-semibold text-[#1D1D1D] tracking-tight">{analyticsLoading ? '—' : completedThisWeek}</span>
                                <div className="h-10 w-10 rounded-md bg-[#ECECF1] flex items-center justify-center text-[#1D1D1D]">
                                    <Activity size={18} />
                                </div>
                            </div>
                        </GlassCard>
                    );
                })()}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                <div className="lg:col-span-2 space-y-6">
                    {/* Zone 2 — My Spaces engagement grid */}
                    <GlassCard className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <Heading level={3}>My Spaces</Heading>
                            <Button variant="ghost" size="sm">View All</Button>
                        </div>

                        {analyticsLoading ? (
                            <div className="space-y-3">
                                {[0, 1, 2].map(i => (
                                    <SkeletonLoader key={i} height="92px" borderRadius="18px" />
                                ))}
                            </div>
                        ) : engagement.length === 0 ? (
                            <div className="text-center py-10 text-zinc-400 text-sm italic">No engagement insights.</div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {engagement.map((row: any, idx: number) => {
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
                                            key={spaceId || idx}
                                            onClick={() => spaceId && onGoToSpace?.(spaceId)}
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
                </div>

                <div className="lg:col-span-1 space-y-6">
                    {/* Zone 3 — Activity feed (Task 5B) */}
                    <GlassCard className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <Heading level={3}>Activity Feed</Heading>
                            <Button variant="ghost" size="sm">Recent</Button>
                        </div>
                        {analyticsLoading ? (
                            <div className="space-y-3">
                                {[0, 1, 2].map(i => (
                                    <SkeletonLoader key={i} height="56px" borderRadius="16px" />
                                ))}
                            </div>
                        ) : feed.length === 0 ? (
                            <div className="text-sm text-zinc-400 italic">No activity yet.</div>
                        ) : (
                            <div className="space-y-3">
                                {feed.map((item: any, idx: number) => {
                                    const action = item.action_type || item.actionType;
                                    const actionLabel = ACTION_LABELS[action] || action || 'did something';
                                    const actor = item.actor_name || item.actorName || 'Someone';
                                    const spaceName = item.space_name || item.spaceName || 'space';
                                    const createdAt = item.created_at || item.createdAt;
                                    return (
                                        <div key={item.id || idx} className="p-3 rounded-xl border border-zinc-100 bg-white">
                                            <p className="text-sm text-zinc-800">
                                                {actor} {actionLabel} in {spaceName}
                                            </p>
                                            <p className="text-[12px] text-zinc-500 mt-1">{timeAgo(createdAt)}</p>
                                        </div>
                                    );
                                })}
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
