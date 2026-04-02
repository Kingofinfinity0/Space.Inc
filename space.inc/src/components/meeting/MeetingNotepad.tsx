import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Save, Users, X, NotebookPen } from 'lucide-react';

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
    const [activeTab, setActiveTab] = useState<'my' | 'others'>('my');

    const saveTimeoutRef = useRef<any>(null);

    useEffect(() => {
        if (!isOpen) return;

        const fetchNotes = async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('meeting_notes')
                .select('*, profiles(full_name, avatar_url)')
                .eq('meeting_id', meetingId);

            if (!error && data) {
                const mine = data.find(n => n.user_id === user?.id);
                const others = data.filter(n => n.user_id !== user?.id);
                if (mine) setMyNote(mine.content);
                setOthersNotes(others);
            }
            setIsLoading(false);
        };

        fetchNotes();

        const channel = supabase
            .channel(`meeting_notes:${meetingId}`)
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
                        updated[idx] = { ...updated[idx], content: payload.new.content, updated_at: payload.new.updated_at };
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

    const saveNote = useCallback(async (content: string) => {
        setIsSaving(true);
        const { error } = await supabase.rpc('upsert_meeting_note', {
            p_meeting_id: meetingId,
            p_content: content
        });
        if (error) console.error('[MeetingNotepad] Save error:', error);
        setIsSaving(false);
    }, [meetingId]);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const content = e.target.value;
        setMyNote(content);

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveNote(content);
        }, 800);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-24 right-6 bottom-32 w-80 md:w-96 bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-2xl z-[200] flex flex-col overflow-hidden animate-in slide-in-from-right duration-500">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-b from-white/5 to-transparent">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                        <NotebookPen size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-base tracking-tight">Meeting Notes</h3>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">Real-time Sync</p>
                    </div>
                </div>
                <button onClick={onClose} className="h-10 w-10 rounded-2xl hover:bg-white/5 flex items-center justify-center text-zinc-400 transition-all border border-transparent hover:border-white/10">
                    <X size={20} />
                </button>
            </div>

            <div className="flex p-1.5 bg-black/40 mx-6 mt-6 rounded-[20px] border border-white/5">
                <button
                    onClick={() => setActiveTab('my')}
                    className={`flex-1 py-2 text-xs font-bold rounded-[14px] transition-all ${activeTab === 'my' ? 'bg-zinc-800 text-white shadow-xl ring-1 ring-white/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    My Notes
                </button>
                <button
                    onClick={() => setActiveTab('others')}
                    className={`flex-1 py-2 text-xs font-bold rounded-[14px] transition-all flex items-center justify-center gap-2 ${activeTab === 'others' ? 'bg-zinc-800 text-white shadow-xl ring-1 ring-white/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Collaborative
                    {othersNotes.length > 0 && (
                        <span className="h-5 w-5 rounded-full bg-emerald-500 text-[10px] text-black flex items-center justify-center font-black">
                            {othersNotes.length}
                        </span>
                    )}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
                            <Loader2 className="animate-spin text-emerald-500 relative" size={32} />
                        </div>
                        <p className="text-zinc-500 text-xs font-medium animate-pulse">Establishing secure link...</p>
                    </div>
                ) : activeTab === 'my' ? (
                    <div className="h-full flex flex-col">
                        <textarea
                            value={myNote}
                            onChange={handleContentChange}
                            placeholder="Share your thoughts..."
                            className="flex-1 bg-transparent text-zinc-200 text-[15px] resize-none outline-none placeholder:text-zinc-700 leading-relaxed font-medium"
                        />
                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-bold tracking-tight">
                            <div className="flex items-center gap-2">
                                {isSaving ? (
                                    <>
                                        <Loader2 size={12} className="animate-spin text-emerald-500" />
                                        <span className="text-zinc-500">Syncing...</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                                        <span className="text-zinc-500">Cloud Persistent</span>
                                    </>
                                )}
                            </div>
                            <span className="text-zinc-700 uppercase tracking-widest text-[9px]">Auto-Save Enabled</span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {othersNotes.length === 0 ? (
                            <div className="text-center py-20 flex flex-col items-center">
                                <div className="h-16 w-16 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-zinc-800 mb-6">
                                    <Users size={32} />
                                </div>
                                <p className="text-zinc-500 text-sm font-semibold">No other notes detected</p>
                                <p className="text-zinc-700 text-xs mt-1">Attendees will appear here as they type</p>
                            </div>
                        ) : (
                            othersNotes.map(note => (
                                <div key={note.user_id} className="group animate-in fade-in slide-in-from-bottom-2 duration-700">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="h-6 w-6 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 font-black border border-white/5">
                                            {note.profiles?.full_name?.charAt(0) || 'U'}
                                        </div>
                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em]">
                                            {note.profiles?.full_name || 'Collaborator'}
                                        </span>
                                    </div>
                                    <div className="bg-white/[0.02] hover:bg-white/[0.04] rounded-2xl p-5 border border-white/5 transition-all duration-300 group-hover:border-emerald-500/20 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                                        <p className="text-zinc-400 text-[14px] whitespace-pre-wrap leading-relaxed font-medium">
                                            {note.content || <span className="text-zinc-800 italic">Thinking...</span>}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
