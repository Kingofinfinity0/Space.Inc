import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Clock, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, GlassCard, Heading, Text } from '../UI';
import { MeetingNotepad } from '../meeting/MeetingNotepad';

type NormalizedParticipant = {
    id?: string;
    role?: 'host' | 'participant' | 'observer' | string;
    joined_at?: string | null;
    left_at?: string | null;
    profile_name?: string;
    avatar_url?: string | null;
};

type MeetingDetails = {
    id: string;
    title?: string;
    starts_at?: string;
    duration_minutes?: number | null;
    category?: string | null;
    meeting_category?: string | null;
    outcome?: 'successful' | 'follow_up_needed' | 'no_show' | 'cancelled' | 'inconclusive' | null;
    outcome_notes?: string | null;
    status?: string;
    ended_at?: string | null;
    ended_by?: string | null;
    ended_by_name?: string | null;
    recorded_by?: string | null;
    recorded_by_name?: string | null;
    recording_url?: string | null;
    recording_path?: string | null;
    meeting_participants?: NormalizedParticipant[];
    participants?: NormalizedParticipant[];
};

const OUTCOME_STYLES: Record<string, string> = {
    successful: 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
    follow_up_needed: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]',
    no_show: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]',
    cancelled: 'bg-[#F7F7F8] text-[#6E6E80] border-[#E5E5E5]',
    inconclusive: 'bg-[#F7F7F8] text-[#6E6E80] border-[#E5E5E5]',
};

function formatDateTime(value?: string) {
    if (!value) return 'Unknown time';
    const date = new Date(value);
    const dayPart = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
    const timePart = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);
    return `${dayPart} at ${timePart}`;
}

function formatDuration(minutes?: number | null, startedAt?: string, endedAt?: string | null) {
    if (minutes && minutes > 0) return `${minutes} min`;
    if (startedAt && endedAt) {
        const diff = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000));
        return `${diff} min`;
    }
    return 'Unknown';
}

export const MeetingDetailsPanel: React.FC<{ meetingId: string; onClose?: () => void }> = ({ meetingId, onClose }) => {
    const [meeting, setMeeting] = useState<MeetingDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                let loadedMeeting: MeetingDetails | null = null;

                const { data: rpcData, error: rpcError } = await supabase.rpc('get_meeting_details', {
                    p_meeting_id: meetingId
                });

                if (!rpcError && rpcData) {
                    loadedMeeting = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as MeetingDetails;
                } else {
                    const { data: fallback, error: fallbackError } = await supabase
                        .from('meetings')
                        .select('*, meeting_participants(*, profiles(full_name, avatar_url))')
                        .eq('id', meetingId)
                        .single();
                    if (fallbackError) throw fallbackError;
                    loadedMeeting = fallback as MeetingDetails;
                }

                if (!loadedMeeting) {
                    setMeeting(null);
                    return;
                }

                setMeeting(loadedMeeting);

                const path = loadedMeeting.recording_path || (loadedMeeting.recording_url && !loadedMeeting.recording_url.startsWith('http') ? loadedMeeting.recording_url : null);
                if (path) {
                    const { data } = await supabase.storage.from('meeting-recordings').createSignedUrl(path, 3600);
                    setRecordingUrl(data?.signedUrl || null);
                } else if (loadedMeeting.recording_url) {
                    setRecordingUrl(loadedMeeting.recording_url);
                } else {
                    setRecordingUrl(null);
                }
            } catch (err) {
                console.error('[MeetingDetailsPanel] load failed:', err);
                setMeeting(null);
            } finally {
                setLoading(false);
            }
        };

        if (meetingId) load();
    }, [meetingId]);

    const participants = useMemo(() => {
        if (!meeting) return [];
        const raw = meeting.meeting_participants || meeting.participants || [];
        return raw.map((participant: any, index: number) => ({
            id: participant.id || `${index}`,
            role: participant.role || participant.participant_role || 'participant',
            joined_at: participant.joined_at || participant.joinedAt || null,
            left_at: participant.left_at || participant.leftAt || null,
            profile_name: participant.profiles?.full_name || participant.participant_name || participant.full_name || 'Unknown',
            avatar_url: participant.profiles?.avatar_url || participant.avatar_url || null
        })) as NormalizedParticipant[];
    }, [meeting]);

    const category = meeting?.category || meeting?.meeting_category || 'General';
    const outcome = meeting?.outcome || 'inconclusive';
    const outcomeLabel = outcome.replace(/_/g, ' ');

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                    <div className="h-5 w-48 rounded bg-[#F7F7F8]" />
                    <div className="mt-3 h-4 w-72 rounded bg-[#F7F7F8]" />
                </div>
                <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                    <div className="h-40 rounded bg-[#F7F7F8]" />
                </div>
            </div>
        );
    }

    if (!meeting) {
        return (
            <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <Heading level={3}>Meeting details unavailable</Heading>
                <Text variant="secondary" className="mt-2">We could not load this meeting.</Text>
            </div>
        );
    }

    const startedAt = formatDateTime(meeting.starts_at);
    const metadata = [
        { label: 'Duration', value: formatDuration(meeting.duration_minutes, meeting.starts_at, meeting.ended_at) },
        { label: 'Participants', value: String(participants.length) },
        { label: 'Ended by', value: meeting.ended_by_name || meeting.ended_by || 'System' },
        { label: 'Recorded by', value: meeting.recorded_by_name || meeting.recorded_by || 'System' }
    ];

    return (
        <div className="space-y-6">
            <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Heading level={2} className="text-xl font-semibold text-[#0D0D0D]">
                                {meeting.title || 'Meeting'}
                            </Heading>
                            <p className="text-sm text-[#6E6E80]">{startedAt}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-[#E5E5E5] bg-white px-3 py-1 text-xs text-[#6E6E80]">
                                {category}
                            </span>
                            <span className={`rounded-full border px-3 py-1 text-xs ${OUTCOME_STYLES[outcome] || OUTCOME_STYLES.inconclusive}`}>
                                {outcomeLabel}
                            </span>
                        </div>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="rounded-[6px] border border-[#E5E5E5] bg-white p-2 text-[#6E6E80] hover:bg-[#F7F7F8]"
                            aria-label="Close meeting details"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {metadata.map((item) => (
                    <div key={item.label} className="rounded-[8px] border border-[#E5E5E5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                        <div className="text-xs uppercase tracking-wide text-[#6E6E80]">{item.label}</div>
                        <div className="mt-2 text-sm font-medium text-[#0D0D0D]">{item.value}</div>
                    </div>
                ))}
            </div>

            <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:p-6">
                <Heading level={3} className="text-lg font-semibold text-[#0D0D0D]">Participants</Heading>
                <div className="mt-4 overflow-hidden rounded-[8px] border border-[#E5E5E5]">
                    {participants.length === 0 ? (
                        <div className="p-4 text-sm text-[#6E6E80]">No participant data recorded.</div>
                    ) : (
                        <div className="divide-y divide-[#E5E5E5]">
                            {participants.map((participant) => (
                                <div key={participant.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr] md:items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-sm font-medium text-[#0D0D0D]">
                                            {(participant.profile_name || 'U').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-[#0D0D0D]">{participant.profile_name}</div>
                                            <div className="text-xs text-[#6E6E80]">Joined meeting</div>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-2 py-1 text-[10px] uppercase tracking-wide text-[#6E6E80]">
                                            {participant.role === 'host' ? 'host' : 'participant'}
                                        </span>
                                    </div>
                                    <div className="text-sm text-[#0D0D0D]">
                                        {participant.joined_at ? new Date(participant.joined_at).toLocaleString() : 'Unknown'}
                                    </div>
                                    <div className="text-sm text-[#0D0D0D]">
                                        {participant.left_at ? new Date(participant.left_at).toLocaleString() : 'Still present'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:p-6">
                <Heading level={3} className="text-lg font-semibold text-[#0D0D0D]">Recording</Heading>
                <div className="mt-4">
                    {meeting.status === 'ended' && recordingUrl ? (
                        <div className="space-y-3">
                            <video controls src={recordingUrl} className="w-full rounded-[8px] border border-[#E5E5E5] bg-black" />
                            <button
                                className="text-sm underline underline-offset-4 text-[#0D0D0D] hover:text-[#6E6E80]"
                                onClick={() => window.open(recordingUrl, '_blank')}
                            >
                                Download .mp4
                            </button>
                        </div>
                    ) : (
                        <div className="rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4 text-sm text-[#6E6E80]">
                            No recording available for this meeting.
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <Heading level={3} className="text-lg font-semibold text-[#0D0D0D]">Notes</Heading>
                <MeetingNotepad meetingId={meeting.id} readOnly={true} />
            </div>

            {meeting.outcome_notes ? (
                <div className="rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                    <Heading level={3} className="text-lg font-semibold text-[#0D0D0D]">Outcome Notes</Heading>
                    <Text className="mt-3 text-sm leading-6 text-[#0D0D0D]">{meeting.outcome_notes}</Text>
                </div>
            ) : null}
        </div>
    );
};
