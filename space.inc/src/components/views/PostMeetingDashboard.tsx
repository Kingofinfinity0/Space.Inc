import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Video, Download, FileText, Calendar, Clock, Users, ArrowRight
} from 'lucide-react';
import { Button, GlassCard, Heading, Text } from '../UI';

interface PostMeetingDashboardProps {
    meeting: any;
    onClose: () => void;
}

export const PostMeetingDashboard: React.FC<PostMeetingDashboardProps> = ({ meeting, onClose }) => {
    const navigate = useNavigate();

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <GlassCard className="p-6">
                    <Heading level={3} className="text-lg mb-4 flex items-center gap-2">
                        <Video size={20} className="text-emerald-500" />
                        Recording Status
                    </Heading>
                    {meeting.recording_url ? (
                        <div className="space-y-4">
                            <div className="aspect-video bg-zinc-900 rounded-2xl flex items-center justify-center border border-white/5 overflow-hidden group relative">
                                <Video size={48} className="text-zinc-800" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                    <Button
                                        variant="primary"
                                        onClick={() => navigate(`/spaces/${meeting.space_id}/meetings/${meeting.id}/review`)}
                                    >
                                        Watch Recording
                                    </Button>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => window.open(meeting.recording_url, '_blank')}
                            >
                                <Download size={16} className="mr-2" />
                                Download MP4
                            </Button>
                        </div>
                    ) : (
                        <div className="aspect-video bg-zinc-900 rounded-2xl flex flex-col items-center justify-center border border-white/5 text-zinc-500">
                            <Clock size={32} className="mb-2 animate-pulse" />
                            <Text variant="secondary">Processing recording...</Text>
                        </div>
                    )}
                </GlassCard>

                <GlassCard className="p-6">
                    <Heading level={3} className="text-lg mb-4 flex items-center gap-2">
                        <FileText size={20} className="text-blue-500" />
                        Meeting Summary
                    </Heading>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                                <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Outcome</div>
                                <div className="text-sm font-bold text-emerald-500 capitalize">{meeting.outcome || 'Success'}</div>
                            </div>
                            <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                                <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Attendees</div>
                                <div className="text-sm font-bold text-white">{meeting.attendees_count || 0}</div>
                            </div>
                        </div>
                        <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                            <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Notes Excerpt</div>
                            <div className="text-sm text-zinc-400 line-clamp-3">
                                {meeting.outcome_notes || 'No detailed outcome notes provided.'}
                            </div>
                        </div>
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={() => navigate(`/spaces/${meeting.space_id}/meetings/${meeting.id}/review`)}
                        >
                            View Full Transcript & Notes
                            <ArrowRight size={16} className="ml-2" />
                        </Button>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
};
