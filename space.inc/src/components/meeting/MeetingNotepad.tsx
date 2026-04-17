import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Pencil } from 'lucide-react';

interface MeetingNotepadProps {
    meetingId: string;
    readOnly: boolean;
}

type SaveState = 'idle' | 'saving' | 'saved';

export const MeetingNotepad: React.FC<MeetingNotepadProps> = ({ meetingId, readOnly }) => {
    const { user } = useAuth();
    const [noteText, setNoteText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [showSaveState, setShowSaveState] = useState(false);

    const debounceRef = useRef<number | null>(null);
    const localVersionRef = useRef(0);
    const committedVersionRef = useRef(0);
    const noteRef = useRef('');

    const normalizedContent = useMemo(() => noteText.trim(), [noteText]);

    const loadNote = useCallback(async () => {
        if (!meetingId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_meeting_note', {
                p_meeting_id: meetingId
            });

            if (error) throw error;

            const content = (data as { note_content?: string | null } | null)?.note_content ?? '';
            noteRef.current = content;
            setNoteText(content);
            committedVersionRef.current = localVersionRef.current;
        } catch (err) {
            console.error('[MeetingNotepad] load failed:', err);
        } finally {
            setIsLoading(false);
        }
    }, [meetingId]);

    const scheduleSave = useCallback((content: string) => {
        if (readOnly) return;
        if (debounceRef.current) window.clearTimeout(debounceRef.current);

        const versionAtSchedule = localVersionRef.current;
        setSaveState('saving');
        setShowSaveState(true);

        debounceRef.current = window.setTimeout(async () => {
            try {
                await supabase.rpc('upsert_meeting_note', {
                    p_meeting_id: meetingId,
                    p_content: content
                });
                committedVersionRef.current = versionAtSchedule;
                setSaveState('saved');
            } catch (err) {
                console.error('[MeetingNotepad] save failed:', err);
                setSaveState('idle');
            } finally {
                window.setTimeout(() => setShowSaveState(false), 1200);
            }
        }, 800);
    }, [meetingId, readOnly]);

    useEffect(() => {
        loadNote();
    }, [loadNote]);

    useEffect(() => {
        if (readOnly) return;

        const channel = supabase
            .channel(`meeting-notes:${meetingId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'meeting_notes',
                filter: `meeting_id=eq.${meetingId}`
            }, (payload: any) => {
                const next = payload?.new?.content ?? payload?.new?.note_content ?? '';
                const hasUncommittedLocalChanges = localVersionRef.current !== committedVersionRef.current;
                if (hasUncommittedLocalChanges && next !== noteRef.current) return;
                noteRef.current = next;
                setNoteText(next);
                setSaveState('saved');
                setShowSaveState(true);
                window.setTimeout(() => setShowSaveState(false), 900);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [meetingId, readOnly]);

    useEffect(() => {
        return () => {
            if (debounceRef.current) window.clearTimeout(debounceRef.current);
        };
    }, []);

    const handleChange = (value: string) => {
        setNoteText(value);
        noteRef.current = value;
        localVersionRef.current += 1;
        scheduleSave(value);
    };

    if (isLoading) {
        return (
            <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-[#0D0D0D]">Meeting Notes</div>
                    <div className="text-xs text-[#6E6E80]">Loading...</div>
                </div>
                <div className="mt-4 min-h-[200px] rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8]" />
            </div>
        );
    }

    const emptyMessage = 'No notes were taken for this meeting.';

    if (readOnly) {
        return (
            <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-medium text-[#0D0D0D]">Meeting Notes</div>
                </div>
                <div className="rounded-[8px] bg-[#F7F7F8] p-4 text-sm leading-6 text-[#0D0D0D]">
                    {normalizedContent ? noteText : emptyMessage}
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-[#0D0D0D]">
                    <Pencil size={14} className="text-[#6E6E80]" />
                    Meeting Notes
                </div>
                <div
                    className={`text-xs text-[#6E6E80] transition-opacity duration-300 ${
                        showSaveState ? 'opacity-100' : 'opacity-0'
                    }`}
                >
                    {saveState === 'saving' ? 'Saving...' : 'Saved'}
                </div>
            </div>
            <textarea
                value={noteText}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="Capture decisions, blockers, and next steps..."
                className="min-h-[200px] w-full resize-y border-none bg-transparent text-sm text-[#0D0D0D] outline-none placeholder:text-[#6E6E80]"
            />
        </div>
    );
};
