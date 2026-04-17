import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Users, X, Download, Copy, Cloud, Sparkles } from 'lucide-react';
import { Button, Heading, Text } from '../UI';

interface MeetingNote {
    id: string;
    user_id: string;
    content: string;
    updated_at: string;
    profiles?: {
        full_name: string;
        avatar_url: string;
    } | any;
}

interface MeetingNotepadProps {
    meetingId: string;
    isOpen: boolean;
    onClose: () => void;
}

export const MeetingNotepad: React.FC<MeetingNotepadProps> = ({ meetingId, isOpen, onClose }) => {
    const { user } = useAuth();
    const [myNote, setMyNote] = useState('');
    const [othersNotes, setOthersNotes] = useState<MeetingNote[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [activeTab, setActiveTab] = useState<'mine' | 'team'>('mine');
    const saveTimeoutRef = useRef<any>(null);

    useEffect(() => {
        if (myNote && !isLoading) {
            localStorage.setItem(`meeting_note_draft_${meetingId}`, myNote);
        }
    }, [myNote, meetingId, isLoading]);

    useEffect(() => {
        if (!isOpen) return;

        const initSync = async () => {
            setIsLoading(true);
            try {
                const draft = localStorage.getItem(`meeting_note_draft_${meetingId}`);
                if (draft) setMyNote(draft);

                const { data, error } = await supabase
                    .from('meeting_notes')
                    .select('*, profiles(full_name, avatar_url)')
                    .eq('meeting_id', meetingId);

                if (!error && data) {
                    const mine = data.find(n => n.user_id === user?.id);
                    const team = data.filter(n => n.user_id !== user?.id);
                    if (mine && (!draft || new Date(mine.updated_at) > new Date())) {
                        setMyNote(mine.content);
                    }
                    setOthersNotes(team);
                }
            } catch (err) {
                console.error('[Notepad] Init error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        initSync();

        const channel = supabase
            .channel(`notepad:${meetingId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'meeting_notes',
                filter: `meeting_id=eq.${meetingId}`
            }, (payload: any) => {
                if (payload.new.user_id === user?.id) return;

                setOthersNotes(prev => {
                    const idx = prev.findIndex(n => n.user_id === payload.new.user_id);
                    if (idx > -1) {
                        const updated = [...prev];
                        updated[idx] = { ...updated[idx], ...payload.new };
                        return updated;
                    }
                    return [...prev, payload.new];
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [meetingId, user?.id, isOpen]);

    const persistNote = useCallback(async (content: string) => {
        if (!content) return;
        setIsSaving(true);
        try {
            await supabase.rpc('upsert_meeting_note', {
                p_meeting_id: meetingId,
                p_content: content
            });
            setLastSaved(new Date());
        } catch (err) {
            console.error('[Notepad] Sync failed:', err);
        } finally {
            setIsSaving(false);
        }
    }, [meetingId]);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setMyNote(val);

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => persistNote(val), 900);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-4 z-[600] flex flex-col overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:inset-y-6 md:right-6 md:left-auto md:w-[460px]">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] p-5">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D]">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <Heading level={3} className="text-xl font-semibold">Meeting notes</Heading>
                        <div className="mt-1 flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-black" />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6E6E80]">Live sync</span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="rounded-[6px] border border-[#E5E5E5] bg-white p-2 text-[#6E6E80] hover:bg-[#F7F7F8] hover:text-[#0D0D0D]"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="p-4">
                <div className="flex rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-1">
                    <button
                        onClick={() => setActiveTab('mine')}
                        className={`flex-1 rounded-[6px] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                            activeTab === 'mine' ? 'bg-white text-[#0D0D0D] shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : 'text-[#6E6E80]'
                        }`}
                    >
                        Workspace
                    </button>
                    <button
                        onClick={() => setActiveTab('team')}
                        className={`flex-1 rounded-[6px] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                            activeTab === 'team' ? 'bg-white text-[#0D0D0D] shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : 'text-[#6E6E80]'
                        }`}
                    >
                        Team feed {othersNotes.length > 0 ? `(${othersNotes.length})` : ''}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <div className="flex items-center gap-3 text-[#6E6E80]">
                            <Loader2 className="animate-spin" size={18} />
                            <span className="text-sm">Loading notes...</span>
                        </div>
                    </div>
                ) : activeTab === 'mine' ? (
                    <div className="flex h-full flex-col">
                        <textarea
                            value={myNote}
                            onChange={handleInput}
                            placeholder="Capture decisions, next steps, and follow-ups..."
                            className="min-h-[280px] flex-1 resize-none rounded-[8px] border border-[#E5E5E5] bg-white p-4 text-[15px] leading-7 text-[#0D0D0D] outline-none placeholder:text-[#6E6E80] focus:border-black"
                        />
                        <div className="mt-4 flex items-center justify-between border-t border-[#E5E5E5] pt-4">
                            <div className="flex items-center gap-3 text-[#6E6E80]">
                                {isSaving ? (
                                    <>
                                        <div className="h-2 w-2 rounded-full bg-black animate-pulse" />
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Saving</span>
                                    </>
                                ) : (
                                    <>
                                        <Cloud size={14} />
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Synced</span>
                                    </>
                                )}
                            </div>
                            {lastSaved && (
                                <span className="text-[10px] text-[#6E6E80]">
                                    {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {othersNotes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-[#6E6E80]">
                                    <Users size={28} />
                                </div>
                                <Text variant="secondary">No team notes yet.</Text>
                            </div>
                        ) : (
                            othersNotes.map(note => (
                                <div key={note.user_id} className="rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] p-4">
                                    <div className="mb-3 flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-white text-sm font-medium text-[#0D0D0D] border border-[#E5E5E5]">
                                            {note.profiles?.full_name?.charAt(0) || 'U'}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-[#0D0D0D]">
                                                {note.profiles?.full_name || 'Anonymous'}
                                            </div>
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-[#6E6E80]">
                                                {new Date(note.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                    <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#0D0D0D]">
                                        {note.content || <span className="text-[#6E6E80] italic">Empty note</span>}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <div className="flex gap-3 border-t border-[#E5E5E5] p-4">
                <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => navigator.clipboard.writeText(myNote)}
                >
                    <Copy size={16} />
                    Copy note
                </Button>
                <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                        const blob = new Blob([myNote], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `meeting-notes-${new Date().toISOString().split('T')[0]}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }}
                >
                    <Download size={16} />
                    Export
                </Button>
            </div>
        </div>
    );
};
