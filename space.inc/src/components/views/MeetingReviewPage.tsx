import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    Calendar, Clock, Users, FileText, Download, Play,
    ArrowLeft, Loader2, Video, CheckCircle2, AlertCircle,
    LayoutGrid, History, Shield, Cloud
} from 'lucide-react';
import { Button, GlassCard, Heading, Text } from '../UI';

interface MeetingNote {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    profiles?: {
        full_name: string;
        avatar_url: string;
    };
}

interface Meeting {
    id: string;
    title: string;
    starts_at: string;
    duration_minutes: number;
    recording_url: string;
    recording_status: string;
    outcome: string;
    outcome_notes: string;
    participants?: any[];
}

const MeetingReviewPage: React.FC = () => {
    const { spaceId, meetingId } = useParams();
    const navigate = useNavigate();
    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [notes, setNotes] = useState<MeetingNote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [videoError, setVideoError] = useState(false);

    useEffect(() => {
        const fetchMeetingData = async () => {
            setIsLoading(true);
            try {
                const { data: mData, error: mErr } = await supabase
                    .from('meetings')
                    .select('*, participants:meeting_participants(*)')
                    .eq('id', meetingId)
                    .single();

                if (mErr) throw mErr;
                setMeeting(mData);

                const { data: nData, error: nErr } = await supabase
                    .from('meeting_notes')
                    .select('*, profiles(full_name, avatar_url)')
                    .eq('meeting_id', meetingId);

                if (nErr) throw nErr;
                setNotes(nData || []);
            } catch (err) {
                console.error('Error fetching review data:', err);
            } finally {
                setIsLoading(false);
            }
        };

        if (meetingId) fetchMeetingData();
    }, [meetingId]);

    const handleDownload = () => {
        if (meeting?.recording_url) {
            window.open(meeting.recording_url, '_blank');
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
                        <Loader2 className="h-12 w-12 text-emerald-500 animate-spin mx-auto relative" />
                    </div>
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Establishing Secure Link...</p>
                </div>
            </div>
        );
    }

    if (!meeting) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6">
                <GlassCard className="max-w-md w-full p-12 text-center border-rose-500/20 bg-zinc-950/50 backdrop-blur-3xl rounded-[40px]">
                    <div className="h-20 w-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mx-auto mb-8">
                        <AlertCircle size={40} />
                    </div>
                    <Heading level={2} className="text-white mb-3 text-3xl font-black tracking-tight">Meeting Inaccessible</Heading>
                    <Text className="text-zinc-500 mb-10 font-medium">This record has been archived, deleted, or you do not have permission to access it.</Text>
                    <Button onClick={() => navigate(-1)} className="w-full h-14 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all">
                        Return to Command Center
                    </Button>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8 lg:p-12 selection:bg-emerald-500/30">
            <div className="max-w-7xl mx-auto mb-12 flex items-center justify-between">
                <button
                    onClick={() => navigate(-1)}
                    className="group flex items-center gap-4 text-zinc-500 hover:text-white transition-all font-black text-[11px] uppercase tracking-[0.2em]"
                >
                    <div className="h-12 w-12 rounded-2xl bg-zinc-900 flex items-center justify-center border border-white/5 group-hover:border-white/20 group-hover:bg-zinc-800 transition-all shadow-2xl">
                        <ArrowLeft size={20} />
                    </div>
                    Back to Workspace
                </button>

                <div className="hidden md:flex items-center gap-6">
                    <div className="flex -space-x-3">
                        {meeting.participants?.slice(0, 3).map((p, i) => (
                            <div key={i} className="h-10 w-10 rounded-xl bg-zinc-800 border-2 border-black flex items-center justify-center text-[10px] font-black text-zinc-400">
                                {p.participant_name?.charAt(0)}
                            </div>
                        ))}
                        {meeting.participants && meeting.participants.length > 3 && (
                            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border-2 border-black flex items-center justify-center text-[10px] font-black text-emerald-500">
                                +{meeting.participants.length - 3}
                            </div>
                        )}
                    </div>
                    <div className="h-8 w-px bg-white/5" />
                    <div className="px-5 py-2.5 rounded-2xl bg-zinc-900/50 border border-white/5 flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Encrypted Review</span>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

                <div className="lg:col-span-8 space-y-10">
                    <div className="relative overflow-hidden rounded-[48px] p-10 md:p-16 border border-white/5 bg-gradient-to-br from-zinc-900/40 via-zinc-900/20 to-transparent backdrop-blur-md">
                        <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-5 mb-8">
                                <span className="px-4 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/5">
                                    {meeting.outcome || 'General Review'}
                                </span>
                                <span className="text-zinc-700 font-black text-xs">•</span>
                                <span className="text-zinc-500 font-bold text-[11px] uppercase tracking-[0.15em]">
                                    {new Date(meeting.starts_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                                </span>
                            </div>
                            <Heading level={1} className="text-5xl md:text-6xl font-black tracking-tight mb-8 leading-[1.1] bg-gradient-to-br from-white via-white to-zinc-500 bg-clip-text text-transparent">
                                {meeting.title}
                            </Heading>
                            <div className="flex items-start gap-4">
                                <div className="mt-1.5 h-1 w-12 rounded-full bg-emerald-500/50 shadow-lg shadow-emerald-500/20" />
                                <Text className="text-zinc-400 text-lg md:text-xl font-medium max-w-2xl leading-relaxed">
                                    {meeting.outcome_notes || 'No strategic outcome was recorded. This session is currently classified as a General Review. Refer to collaborative notes for execution details.'}
                                </Text>
                            </div>
                        </div>
                    </div>

                    <div className="group relative rounded-[48px] overflow-hidden border border-white/5 bg-zinc-950 aspect-video shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] ring-1 ring-white/5 transition-all duration-700 hover:ring-emerald-500/20">
                        {meeting.recording_url ? (
                            <video
                                src={meeting.recording_url}
                                controls
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-16 text-center bg-zinc-900/10">
                                <div className="h-32 w-32 rounded-[40px] bg-white/[0.02] border border-white/5 flex items-center justify-center text-zinc-800 mb-10 relative">
                                    <div className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-full" />
                                    <Video size={56} className="relative" />
                                </div>
                                <Heading level={2} className="text-zinc-400 mb-3 text-2xl font-black">Decrypting Recording</Heading>
                                <Text className="text-zinc-600 max-w-sm mx-auto font-medium">
                                    The session stream is currently being processed and transferred to secure storage.
                                </Text>
                            </div>
                        )}

                        {meeting.recording_url && (
                            <div className="absolute bottom-10 right-10 opacity-0 group-hover:opacity-100 transition-all duration-700 transform translate-y-4 group-hover:translate-y-0 scale-95 group-hover:scale-100">
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-4 px-8 py-4 bg-white text-black font-black text-[11px] uppercase tracking-[0.2em] rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.4)] hover:scale-105 active:scale-95 transition-all"
                                >
                                    <Download size={18} />
                                    Export Session Data
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { label: 'Strategic Runtime', value: `${meeting.duration_minutes || '0'} Minutes`, icon: Clock },
                            { label: 'Personnel Count', value: `${meeting.participants?.length || 0} Members`, icon: Users },
                            { label: 'Security Layer', value: '256-bit AES', icon: Shield },
                        ].map((stat, i) => (
                            <div key={i} className="p-8 rounded-[40px] bg-zinc-900/20 border border-white/5 hover:border-emerald-500/20 transition-all duration-500 group shadow-xl">
                                <div className="h-12 w-12 rounded-2xl bg-zinc-950 flex items-center justify-center mb-6 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition-colors border border-white/5">
                                    <stat.icon size={22} />
                                </div>
                                <div className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-2">{stat.label}</div>
                                <div className="text-2xl font-black text-white tracking-tight">{stat.value}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-10">
                    <div className="rounded-[48px] border border-white/5 bg-zinc-900/20 overflow-hidden backdrop-blur-xl shadow-2xl">
                        <div className="p-10 border-b border-white/5 flex items-center justify-between bg-zinc-950/20">
                            <div>
                                <Heading level={3} className="text-2xl font-black tracking-tight mb-1">Session Notes</Heading>
                                <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Aggregated Intel</p>
                            </div>
                            <div className="h-12 w-12 rounded-2xl bg-zinc-950 flex items-center justify-center text-zinc-700 border border-white/5">
                                <FileText size={20} />
                            </div>
                        </div>
                        <div className="p-10 space-y-10 max-h-[800px] overflow-y-auto scrollbar-hide">
                            {notes.length === 0 ? (
                                <div className="text-center py-20 flex flex-col items-center">
                                    <div className="h-16 w-16 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-zinc-800 mb-6">
                                        <FileText size={32} />
                                    </div>
                                    <p className="text-zinc-600 font-black text-xs uppercase tracking-widest">No Intelligence Gathered</p>
                                </div>
                            ) : (
                                notes.map((note) => (
                                    <div key={note.id} className="group animate-in fade-in slide-in-from-bottom-4 duration-700">
                                        <div className="flex items-center gap-4 mb-5">
                                            <div className="h-8 w-8 rounded-xl bg-zinc-800 flex items-center justify-center text-[11px] font-black text-zinc-400 border border-white/5 group-hover:border-emerald-500/20 transition-colors">
                                                {note.profiles?.full_name?.charAt(0) || 'U'}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.1em]">
                                                    {note.profiles?.full_name || 'Anonymous'}
                                                </div>
                                                <div className="text-[9px] text-zinc-700 font-black uppercase tracking-widest mt-0.5">
                                                    {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-7 rounded-[32px] bg-white/[0.02] border border-white/5 group-hover:bg-white/[0.04] transition-all duration-500">
                                            <Text className="text-zinc-400 text-[15px] leading-relaxed font-medium">
                                                {note.content}
                                            </Text>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="rounded-[48px] border border-white/5 bg-zinc-900/20 overflow-hidden shadow-2xl">
                        <div className="p-10 border-b border-white/5 bg-zinc-950/20">
                            <Heading level={3} className="text-2xl font-black tracking-tight">Personnel</Heading>
                        </div>
                        <div className="p-10 space-y-5">
                            {meeting.participants?.map((p, i) => (
                                <div key={i} className="group flex items-center justify-between p-5 rounded-[24px] bg-zinc-950/50 border border-white/5 hover:border-emerald-500/20 transition-all duration-300">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-[14px] bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-black text-xs border border-emerald-500/20">
                                            {p.participant_name?.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-black text-zinc-200 tracking-tight">{p.participant_name}</div>
                                            <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest capitalize">{p.role || 'Participant'}</div>
                                        </div>
                                    </div>
                                    <div className="h-2 w-2 rounded-full bg-zinc-800 group-hover:bg-emerald-500 transition-colors shadow-[0_0_8px_rgba(16,185,129,0)] group-hover:shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default MeetingReviewPage;
