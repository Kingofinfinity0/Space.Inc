import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import { friendlyError } from '../../utils/errors';
import {
    MessageSquare, Calendar, FileText, Video, Activity, ArrowRight,
    ListTodo, Clock, FilePlus as FilePlus2, Users, AlertTriangle
} from 'lucide-react';
import {
    GlassCard, Button, Heading, Text, Modal, SkeletonLoader
} from '../UI/index';
import { FileUploadModal } from '../FileUploadModal';
import { ClientSpace } from '../../types';

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

const StaffDashboardView = ({ clients, onJoin, onGoToSpace, onInstantMeet }: { clients: ClientSpace[], onJoin: (id: string) => void, onInstantMeet?: () => void, onGoToSpace?: (spaceId: string) => void }) => {
    const { user, organizationId } = useAuth();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>(null);
    const [engagement, setEngagement] = useState<any[]>([]);
    const [activityFeed, setActivityFeed] = useState<any[]>([]);

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isInternalUploadModalOpen, setIsInternalUploadModalOpen] = useState(false);
    const [selectedSpaceForUpload, setSelectedSpaceForUpload] = useState<string>(clients[0]?.id || '');
    const [uploading, setUploading] = useState(false);

    const load = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [summaryRes, engagementRes, feedRes] = await Promise.all([
                apiService.getStaffDashboardSummary(),
                apiService.getClientEngagementScores(),
                apiService.getActivityFeed(10)
            ]);

            if (summaryRes.error) throw summaryRes.error;
            if (engagementRes.error) throw engagementRes.error;
            if (feedRes.error) throw feedRes.error;

            setSummary(summaryRes.data);
            setEngagement(engagementRes.data || []);
            setActivityFeed(feedRes.data || []);
        } catch (err: any) {
            console.error('[StaffDashboardView] load failed:', err);
            showToast(friendlyError(err?.message), 'error');
        } finally {
            setLoading(false);
        }
    }, [user, showToast]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
            <header className="flex justify-between items-end mb-4">
                <div>
                    <Heading level={1} className="tracking-tight font-black uppercase text-3xl">Workday Overview</Heading>
                    <Text variant="secondary" className="mt-1 font-medium">Your spaces, tasks, and client engagement signals.</Text>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlassCard className="p-5 border-zinc-200/50 shadow-sm">
                    <Text variant="secondary" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Open Tasks</Text>
                    <div className="flex items-center gap-3 mt-1">
                        <div className="text-3xl font-bold text-zinc-900">{loading ? <SkeletonLoader width="40px" height="32px" /> : summary?.open_tasks || 0}</div>
                        {summary?.overdue_tasks > 0 && (
                            <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" title="Overdue tasks present" />
                        )}
                    </div>
                </GlassCard>
                <GlassCard className="p-5 border-zinc-200/50 shadow-sm">
                    <Text variant="secondary" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Meetings (Week)</Text>
                    <div className="text-3xl font-bold mt-1 text-zinc-900">{loading ? <SkeletonLoader width="40px" height="32px" /> : summary?.upcoming_meetings_week || 0}</div>
                </GlassCard>
                <GlassCard className="p-5 border-zinc-200/50 shadow-sm">
                    <Text variant="secondary" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tasks Done (Week)</Text>
                    <div className="text-3xl font-bold mt-1 text-zinc-900">{loading ? <SkeletonLoader width="40px" height="32px" /> : summary?.tasks_completed_week || 0}</div>
                </GlassCard>
                <GlassCard className="p-5 border-zinc-200/50 shadow-sm">
                    <Text variant="secondary" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Managed Spaces</Text>
                    <div className="text-3xl font-bold mt-1 text-zinc-900">{loading ? <SkeletonLoader width="40px" height="32px" /> : summary?.spaces_managed || 0}</div>
                </GlassCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <section>
                        <div className="flex items-center gap-2 mb-6">
                            <Users className="text-indigo-500" size={20} />
                            <Heading level={3} className="text-sm font-black uppercase tracking-widest text-zinc-400">My Client Health</Heading>
                        </div>
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <SkeletonLoader height="160px" borderRadius="16px" className="w-full" />
                                <SkeletonLoader height="160px" borderRadius="16px" className="w-full" />
                            </div>
                        ) : engagement.length === 0 ? (
                            <GlassCard className="p-12 text-center border-dashed border-2">
                                <p className="text-zinc-400 text-sm italic">No assigned spaces with activity yet.</p>
                            </GlassCard>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {engagement.map((space: any) => (
                                    <GlassCard
                                        key={space.space_id}
                                        className="p-6 cursor-pointer hover:border-indigo-300 transition-all hover:shadow-md group"
                                        onClick={() => onGoToSpace?.(space.space_id)}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">{space.space_name}</h4>
                                                <p className="text-xs text-zinc-400 font-medium">Last active: {space.days_since_activity === 0 ? 'Today' : `${space.days_since_activity}d ago`}</p>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                                                space.engagement_level === 'active' ? 'bg-emerald-50 text-emerald-600' :
                                                space.engagement_level === 'watching' ? 'bg-amber-50 text-amber-600' :
                                                'bg-rose-50 text-rose-600'
                                            }`}>
                                                {space.engagement_level}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mb-4">
                                            <div className="text-center p-2 bg-zinc-50 rounded-lg">
                                                <p className="text-[10px] font-black text-zinc-400 uppercase">Msg/wk</p>
                                                <p className="text-sm font-bold text-zinc-700">{space.messages_this_week}</p>
                                            </div>
                                            <div className="text-center p-2 bg-zinc-50 rounded-lg">
                                                <p className="text-[10px] font-black text-zinc-400 uppercase">Meet/mo</p>
                                                <p className="text-sm font-bold text-zinc-700">{space.meetings_this_month}</p>
                                            </div>
                                            <div className="text-center p-2 bg-zinc-50 rounded-lg">
                                                <p className="text-[10px] font-black text-zinc-400 uppercase">Score</p>
                                                <p className={`text-sm font-bold ${space.engagement_score >= 60 ? 'text-emerald-500' : space.engagement_score >= 40 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                    {space.engagement_score}
                                                </p>
                                            </div>
                                        </div>
                                        {space.alert_message && (
                                            <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-100 rounded-lg text-amber-700 text-[10px] font-bold">
                                                <AlertTriangle size={12} />
                                                {space.alert_message}
                                            </div>
                                        )}
                                    </GlassCard>
                                ))}
                            </div>
                        )}
                    </section>

                    <GlassCard className="p-8 border-zinc-200/50">
                        <div className="flex items-center gap-2 mb-8">
                            <Activity className="text-indigo-500" size={20} />
                            <Heading level={3} className="text-sm font-black uppercase tracking-widest text-zinc-400">My Activity Feed</Heading>
                        </div>
                        {loading ? (
                            <div className="space-y-4"><SkeletonLoader height="48px" borderRadius="12px" /></div>
                        ) : activityFeed.length === 0 ? (
                            <div className="text-center py-10">
                                <p className="text-zinc-400 text-sm italic">No recent activity in your spaces.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {activityFeed.map((log: any) => (
                                    <div key={log.id} className="p-4 border border-zinc-100 rounded-xl bg-white flex items-center justify-between group hover:border-indigo-200 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                                {log.action_type.includes('message') ? <MessageSquare size={18} /> :
                                                 log.action_type.includes('file') ? <FileText size={18} /> :
                                                 log.action_type.includes('meeting') ? <Video size={18} /> :
                                                 <Activity size={18} />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-zinc-900">
                                                    {log.actor_id === user?.id ? 'You' : log.actor_name} {ACTION_LABELS[log.action_type] || log.action_type}
                                                </p>
                                                <p className="text-xs text-zinc-500 font-medium">{log.space_name} • {timeAgo(log.created_at)}</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" icon={<ArrowRight size={14} />} onClick={() => onGoToSpace?.(log.space_id)} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </GlassCard>
                </div>

                <div className="space-y-8">
                    <GlassCard className="p-6 border-zinc-200/50">
                        <Heading level={3} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6">Staff Terminal</Heading>
                        <div className="space-y-2">
                            <button
                                onClick={() => onInstantMeet?.()}
                                className="w-full flex items-center gap-4 p-4 rounded-xl border border-amber-100 bg-amber-50/50 hover:bg-amber-100/50 transition-all text-left group"
                            >
                                <div className="bg-amber-100 p-2.5 rounded-lg text-amber-600 group-hover:scale-110 transition-transform">
                                    <Video size={20} />
                                </div>
                                <div>
                                    <span className="text-sm font-black text-amber-900 block uppercase tracking-tight">Meet Now</span>
                                    <span className="text-[10px] text-amber-700 font-bold uppercase">Launch Video War Room</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setIsUploadModalOpen(true)}
                                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-zinc-50 transition-all border border-transparent hover:border-zinc-200 text-left group"
                            >
                                <div className="bg-zinc-100 p-2.5 rounded-lg text-zinc-600 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                    <FilePlus2 size={20} />
                                </div>
                                <div>
                                    <span className="text-sm font-bold text-zinc-800 block">Deliver Document</span>
                                    <span className="text-[10px] text-zinc-400 font-bold uppercase">Share secure file</span>
                                </div>
                            </button>
                            <button className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-zinc-50 transition-all border border-transparent hover:border-zinc-200 text-left group">
                                <div className="bg-zinc-100 p-2.5 rounded-lg text-zinc-600 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <span className="text-sm font-bold text-zinc-800 block">Schedule Sync</span>
                                    <span className="text-[10px] text-zinc-400 font-bold uppercase">Calendarize touchpoint</span>
                                </div>
                            </button>
                            <button className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-zinc-50 transition-all border border-transparent hover:border-zinc-200 text-left group">
                                <div className="bg-zinc-100 p-2.5 rounded-lg text-zinc-600 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                    <ListTodo size={20} />
                                </div>
                                <div>
                                    <span className="text-sm font-bold text-zinc-800 block">Create Task</span>
                                    <span className="text-[10px] text-zinc-400 font-bold uppercase">Assign delivery item</span>
                                </div>
                            </button>
                        </div>
                    </GlassCard>
                </div>
            </div>

            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Select Destination">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-1">Destination Space</label>
                        <select
                            title="Select Space"
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 text-sm focus:outline-none"
                            value={selectedSpaceForUpload}
                            onChange={(e) => setSelectedSpaceForUpload(e.target.value)}
                        >
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <Button
                        className="w-full py-4 uppercase font-black tracking-widest text-xs mt-2"
                        onClick={() => {
                            setIsUploadModalOpen(false);
                            setIsInternalUploadModalOpen(true);
                        }}
                    >
                        Continue to Upload
                    </Button>
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
                        showToast("File delivered successfully.", "success");
                    } catch (err) {
                        console.error("Global upload error:", err);
                        showToast("Delivery failed.", "error");
                    } finally {
                        setUploading(false);
                    }
                }}
            />
        </div>
    );
};

export default StaffDashboardView;
