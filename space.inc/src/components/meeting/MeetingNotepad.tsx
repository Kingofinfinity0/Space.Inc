import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    Loader2, Users, X,
    Download, Copy, Cloud, Sparkles
} from 'lucide-react';
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

    // Sync state to local storage to prevent loss during network blips
    useEffect(() => {
        if (myNote && !isLoading) {
            localStorage.setItem(`meeting_note_draft_${meetingId}`, myNote);
        }
    }, [myNote, meetingId, isLoading]);

    // 1. Initial Load & Sync
    useEffect(() => {
        if (!isOpen) return;

        const initSync = async () => {
            setIsLoading(true);
            try {
                // Restore from local draft first for zero-latency feel
                const draft = localStorage.getItem(`meeting_note_draft_${meetingId}`);
                if (draft) setMyNote(draft);

                const { data, error } = await supabase
                    .from('meeting_notes')
                    .select('*, profiles(full_name, avatar_url)')
                    .eq('meeting_id', meetingId);

                if (!error && data) {
                    const mine = data.find(n => n.user_id === user?.id);
                    const team = data.filter(n => n.user_id !== user?.id);
                    // Only override local draft if DB is newer or local is empty
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

    // 2. Optimized Persistence
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
        saveTimeoutRef.current = setTimeout(() => persistNote(val), 1000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-24 right-6 bottom-32 w-[90vw] md:w-[450px] bg-zinc-950/95 backdrop-blur-3xl border border-white/10 rounded-[48px] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.9)] z-[500] flex flex-col overflow-hidden animate-in slide-in-from-right duration-700 ring-1 ring-white/10">
            {/* Header */}
            <div className="p-10 border-b border-white/5 bg-gradient-to-br from-zinc-900/50 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-5">
                    <div className="h-14 w-14 rounded-[22px] bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-[0_0_32px_rgba(16,185,129,0.1)] relative">
                        <Sparkles size={24} className="animate-pulse" />
                        <div className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-500 rounded-full border-2 border-zinc-950" />
                    </div>
                    <div>
                        <Heading level={3} className="text-2xl font-black tracking-tighter text-white">Meeting Intel</Heading>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,1)]" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Live Synthesis</span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="h-12 w-12 rounded-2xl hover:bg-white/5 flex items-center justify-center text-zinc-600 hover:text-white transition-all border border-transparent hover:border-white/10"
                >
                    <X size={24} />
                </button>
            </div>

            {/* View Toggle */}
            <div className="flex p-2 bg-black/40 mx-10 mt-10 rounded-[24px] border border-white/5 shadow-inner">
                <button
                    onClick={() => setActiveTab('mine')}
                    className={`flex-1 py-3 text-[11px] font-black uppercase tracking-[0.2em] rounded-[18px] transition-all ${activeTab === 'mine' ? 'bg-zinc-800 text-white shadow-2xl ring-1 ring-white/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Workspace
                </button>
                <button
                    onClick={() => setActiveTab('team')}
                    className={`flex-1 py-3 text-[11px] font-black uppercase tracking-[0.2em] rounded-[18px] transition-all flex items-center justify-center gap-3 ${activeTab === 'team' ? 'bg-zinc-800 text-white shadow-2xl ring-1 ring-white/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Team Feed
                    {othersNotes.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-[9px] text-black font-black shadow-lg shadow-emerald-500/20">
                            {othersNotes.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-8">
                        <div className="relative">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-[64px] rounded-full animate-pulse" />
                            <Loader2 className="animate-spin text-emerald-500 relative" size={48} />
                        </div>
                        <Text className="text-zinc-600 font-black uppercase tracking-[0.4em] text-[10px] animate-pulse">Initializing Neural Link</Text>
                    </div>
                ) : activeTab === 'mine' ? (
                    <div className="h-full flex flex-col">
                        <textarea
                            value={myNote}
                            onChange={handleInput}
                            placeholder="Capture strategic insights..."
                            className="flex-1 bg-transparent text-zinc-200 text-[18px] resize-none outline-none placeholder:text-zinc-800 leading-relaxed font-medium selection:bg-emerald-500/30"
                        />
                        <div className="mt-10 pt-8 border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {isSaving ? (
                                    <>
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Syncing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Cloud size={14} className="text-zinc-700" />
                                        <span className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.2em]">Cloud Persistent</span>
                                    </>
                                )}
                            </div>
                            {lastSaved && (
                                <span className="text-[10px] text-zinc-800 font-black uppercase tracking-tighter">
                                    Last Checkpoint: {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {othersNotes.length === 0 ? (
                            <div className="text-center py-24 flex flex-col items-center">
                                <div className="h-24 w-24 rounded-[40px] bg-white/[0.01] border border-white/5 flex items-center justify-center text-zinc-900 mb-10 relative group">
                                    <div className="absolute inset-0 bg-white/5 blur-[48px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                                    <Users size={48} className="relative" />
                                </div>
                                <Text className="text-zinc-500 font-black text-[11px] uppercase tracking-[0.3em]">Awaiting Intel Streams</Text>
                                <Text className="text-zinc-800 text-[10px] mt-3 font-medium tracking-tight">Team collaboration will appear here in real-time</Text>
                            </div>
                        ) : (
                            othersNotes.map(note => (
                                <div key={note.user_id} className="group animate-in fade-in slide-in-from-bottom-6 duration-1000">
                                    <div className="flex items-center gap-4 mb-5">
                                        <div className="h-10 w-10 rounded-2xl bg-zinc-900 flex items-center justify-center text-xs font-black text-zinc-400 border border-white/5 shadow-xl">
                                            {note.profiles?.full_name?.charAt(0) || 'U'}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.15em]">
                                                {note.profiles?.full_name || 'Anonymous Intelligence'}
                                            </div>
                                            <div className="text-[9px] text-zinc-700 font-black uppercase tracking-widest mt-1">
                                                {new Date(note.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white/[0.02] hover:bg-white/[0.04] rounded-[32px] p-8 border border-white/5 transition-all duration-700 group-hover:border-emerald-500/20 shadow-2xl group-hover:shadow-emerald-500/10">
                                        <p className="text-zinc-400 text-[15px] whitespace-pre-wrap leading-relaxed font-medium">
                                            {note.content || <span className="text-zinc-800 italic uppercase text-[11px] tracking-[0.2em]">Synthesizing...</span>}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-10 bg-zinc-950/80 border-t border-white/5 flex gap-5 backdrop-blur-3xl">
                <Button
                    variant="outline"
                    className="flex-1 h-14 bg-zinc-900/50 border-white/5 text-zinc-500 font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-zinc-800 hover:text-white transition-all group shadow-xl"
                    onClick={() => {
                        navigator.clipboard.writeText(myNote);
                    }}
                >
                    <Copy size={18} className="mr-4 group-hover:scale-110 transition-transform text-emerald-500" />
                    Copy Intel
                </Button>
                <Button
                    variant="outline"
                    className="flex-1 h-14 bg-zinc-900/50 border-white/5 text-zinc-500 font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-zinc-800 hover:text-white transition-all group shadow-xl"
                >
                    <Download size={18} className="mr-4 group-hover:scale-110 transition-transform text-emerald-500" />
                    Export PDF
                </Button>
            </div>
        </div>
    );
};
