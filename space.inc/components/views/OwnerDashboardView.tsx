import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import { friendlyError } from '../../utils/errors';
import { GlassCard, Heading, Text, SkeletonLoader } from '../UI/index';
import { Video, Activity, AlertTriangle, FileText, TrendingUp, TrendingDown, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type OwnerDashboardProps = {
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
    const [activityFeed, setActivityFeed] = useState<any[]>([]);

    const load = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [summaryRes, engagementRes, intelRes, pipelineRes, feedRes] = await Promise.all([
                apiService.getOwnerDashboardSummary(),
                apiService.getClientEngagementScores(),
                apiService.getMeetingIntelligence(30),
                apiService.getAcquisitionPipeline(),
                apiService.getActivityFeed(15)
            ]);

            if (summaryRes.error) throw summaryRes.error;
            if (engagementRes.error) throw engagementRes.error;
            if (intelRes.error) throw intelRes.error;
            if (pipelineRes.error) throw pipelineRes.error;
            if (feedRes.error) throw feedRes.error;

            setSummary(summaryRes.data);
            setEngagement(engagementRes.data || []);
            setMeetingIntel(intelRes.data || []);
            setPipeline(pipelineRes.data);
            setActivityFeed(feedRes.data || []);

        } catch (err: any) {
            console.error('[OwnerDashboardView] load failed:', err);
            showToast(friendlyError(err?.message), 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [user?.id]);

    const goToSpace = (spaceId: string) => {
        if (onGoToSpace) return onGoToSpace(spaceId);
        navigate(`/spaces/${spaceId}`);
    };

    const successRateColor = (rate: number) => {
        if (rate >= 60) return 'text-emerald-500';
        if (rate >= 40) return 'text-amber-500';
        return 'text-rose-500';
    };

    return (
        <div className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
            <header className="flex justify-between items-end mb-4">
                <div>
                    <Heading level={1} className="tracking-tight font-black uppercase text-3xl">Executive Analytics</Heading>
                    <Text variant="secondary" className="mt-1 font-medium">
                        Real-time relationship health and engagement signals.
                    </Text>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <GlassCard className="p-5 border-zinc-200/50 shadow-sm">
                    <Text variant="secondary" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Clients</Text>
                    <div className="text-3xl font-bold mt-1 text-zinc-900">{loading ? <SkeletonLoader width="40px" height="32px" /> : summary?.total_clients || 0}</div>
                </GlassCard>
                <GlassCard className="p-5 border-zinc-200/50 shadow-sm">
                    <Text variant="secondary" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">New (Month)</Text>
                    <div className="text-3xl font-bold mt-1 text-zinc-900">{loading ? <SkeletonLoader width="40px" height="32px" /> : summary?.clients_acquired_this_month || 0}</div>
                </GlassCard>
                <GlassCard className="p-5 border-zinc-200/50 shadow-sm">
                    <Text variant="secondary" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Active Spaces</Text>
                    <div className="text-3xl font-bold mt-1 text-zinc-900">{loading ? <SkeletonLoader width="40px" height="32px" /> : summary?.active_spaces || 0}</div>
                </GlassCard>
                <GlassCard className="p-5 border-zinc-200/50 shadow-sm">
                    <Text variant="secondary" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Plan Quota</Text>
                    <div className="text-xl font-bold mt-2 text-zinc-600">{loading ? <SkeletonLoader width="60px" height="24px" /> : `${summary?.active_spaces || 0} / 10`}</div>
                </GlassCard>
                <GlassCard className={`p-5 border-zinc-200/50 shadow-sm ${summary?.spaces_silent_14d > 0 ? 'ring-2 ring-rose-500/20' : ''}`}>
                    <Text variant="secondary" className="text-[10px] font-black uppercase tracking-widest text-rose-500">Silent 14d+</Text>
                    <div className={`text-3xl font-bold mt-1 ${summary?.spaces_silent_14d > 0 ? 'text-rose-600' : 'text-zinc-300'}`}>
                        {loading ? <SkeletonLoader width="40px" height="32px" /> : summary?.spaces_silent_14d || 0}
                    </div>
                </GlassCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <section>
                        <div className="flex items-center gap-2 mb-6">
                            <Activity className="text-indigo-500" size={20} />
                            <Heading level={3} className="text-sm font-black uppercase tracking-widest text-zinc-400">Relationship Health</Heading>
                        </div>
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <SkeletonLoader height="160px" borderRadius="16px" className="w-full" />
                                <SkeletonLoader height="160px" borderRadius="16px" className="w-full" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {engagement.map((space: any) => (
                                    <GlassCard
                                        key={space.space_id}
                                        className="p-6 cursor-pointer hover:border-indigo-300 transition-all hover:shadow-md group"
                                        onClick={() => goToSpace(space.space_id)}
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
                                                <p className={`text-sm font-bold ${successRateColor(space.engagement_score)}`}>{space.engagement_score}</p>
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
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-2">
                                <Video className="text-emerald-500" size={20} />
                                <Heading level={3} className="text-sm font-black uppercase tracking-widest text-zinc-400">Meeting Intelligence (30d)</Heading>
                            </div>
                        </div>
                        {loading ? (
                            <SkeletonLoader height="200px" borderRadius="16px" />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-zinc-100">
                                            <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Space</th>
                                            <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Total</th>
                                            <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Success %</th>
                                            <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Primary Type</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-50">
                                        {meetingIntel.map((intel: any) => (
                                            <tr key={intel.space_id} className="group hover:bg-zinc-50/50 transition-colors">
                                                <td className="py-4 text-sm font-bold text-zinc-800">{intel.space_name}</td>
                                                <td className="py-4 text-sm font-medium text-zinc-500 text-center">{intel.total_meetings}</td>
                                                <td className={`py-4 text-sm font-black text-center ${successRateColor(intel.success_rate)}`}>
                                                    {intel.success_rate}%
                                                </td>
                                                <td className="py-4">
                                                    <span className="px-2 py-0.5 bg-zinc-100 text-[10px] font-bold text-zinc-500 rounded uppercase">
                                                        {Object.entries(intel.category_breakdown || {}).sort((a:any, b:any) => b[1] - a[1])[0]?.[0]?.replace('_', ' ') || 'General'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </GlassCard>
                </div>

                <div className="space-y-8">
                    <GlassCard className="p-6 bg-zinc-900 text-white border-zinc-800 shadow-xl">
                        <Heading level={3} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-6">Growth Pipeline</Heading>
                        {loading ? (
                            <SkeletonLoader height="120px" borderRadius="12px" className="bg-zinc-800" />
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-3xl font-black">{pipeline?.new_spaces_this_month || 0}</p>
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1">New Spaces (MoM)</p>
                                    </div>
                                    <div className={`flex items-center gap-1 ${pipeline?.growth_rate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {pipeline?.growth_rate >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                        <span className="text-sm font-black">{Math.abs(pipeline?.growth_rate || 0)}%</span>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-zinc-800">
                                    <div className="flex justify-between text-xs mb-2">
                                        <span className="text-zinc-500 font-bold uppercase">Invite Acceptance</span>
                                        <span className="text-white font-black">{pipeline?.invite_acceptance_rate || 0}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500" style={{ width: `${pipeline?.invite_acceptance_rate || 0}%` }} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </GlassCard>

                    <GlassCard className="p-6 border-zinc-200/50">
                        <Heading level={3} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6">Live Activity Feed</Heading>
                        {loading ? (
                            <div className="space-y-4"><SkeletonLoader height="40px" borderRadius="8px" /></div>
                        ) : activityFeed.length === 0 ? (
                            <div className="text-center py-10">
                                <Activity className="mx-auto text-zinc-200 mb-2" size={32} />
                                <p className="text-zinc-400 text-xs italic font-medium">No recent signals.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {activityFeed.map((log: any) => (
                                    <div key={log.id} className="flex gap-3 group">
                                        <div className="h-8 w-8 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-400 shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                            {log.action_type.includes('message') ? <MessageSquare size={14} /> :
                                             log.action_type.includes('file') ? <FileText size={14} /> :
                                             log.action_type.includes('meeting') ? <Video size={14} /> :
                                             <Activity size={14} />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs text-zinc-800 font-medium leading-tight">
                                                <span className="font-bold">{log.actor_name}</span> {ACTION_LABELS[log.action_type] || log.action_type}
                                            </p>
                                            <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1">
                                                {log.space_name} • {timeAgo(log.created_at)}
                                            </p>
                                        </div>
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
