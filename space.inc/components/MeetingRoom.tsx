import React, { useEffect, useState, useCallback, useRef } from 'react';
import { DailyProvider, useParticipant, useParticipantIds, useLocalSessionId, useVideoTrack, useAudioTrack, useScreenShare, useDaily } from '@daily-co/daily-react';
import DailyIframe from '@daily-co/daily-js';
import { Loader2, Video, AlertCircle, X, LogOut } from 'lucide-react';
import { VideoTile } from './meeting/VideoTile';
import { ControlsBar } from './meeting/ControlsBar';
import { apiService } from '../services/apiService';
import { supabase } from '../lib/supabase';
import { MeetingState, MeetingStateContext, getInitialState, isLoading, isInMeeting } from '../utils/meetingStateMachine';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { friendlyError } from '../utils/errors';
import { Button, GlassCard } from './UI';

interface MeetingRoomProps {
    meetingId: string;
    onLeave: () => void;
}

const DEBUG_EVENTS = true;

const MeetingRoomContent: React.FC<{
    meetingId: string;
    meeting: any;
    onLeave: () => void;
    onMeetingEnded: () => void
}> = ({ meetingId, meeting, onLeave, onMeetingEnded }) => {
    const callObject = useDaily();
    const localSessionId = useLocalSessionId();
    const participantIds = useParticipantIds();
    const { profile } = useAuth();
    const { isSharingScreen, startScreenShare, stopScreenShare } = useScreenShare();

    const [meetingState, setMeetingState] = useState<MeetingStateContext>(getInitialState());
    const [meetingTitle] = useState(meeting?.title || 'Meeting');

    const failsafeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!callObject || !DEBUG_EVENTS) return;
        const events = ['loading', 'loaded', 'started-camera', 'joined-meeting', 'left-meeting', 'error'];
        const logEvent = (eventName: string) => (data?: any) => console.log(`[Daily Event] 📡 ${eventName}`, data);
        events.forEach(event => callObject.on(event as any, logEvent(event)));
        return () => events.forEach(event => callObject.off(event as any, logEvent(event)));
    }, [callObject]);

    useEffect(() => {
        if (!callObject) return;

        const handleJoining = () => {
            setMeetingState(prev => ({ ...prev, state: MeetingState.JOINING }));
            failsafeTimeoutRef.current = setTimeout(() => {
                setMeetingState(prev => prev.state === MeetingState.JOINING ? { ...prev, state: MeetingState.ERROR, error: 'Join timeout' } : prev);
            }, 10000);
        };

        const handleJoined = async () => {
            if (failsafeTimeoutRef.current) clearTimeout(failsafeTimeoutRef.current);
            setMeetingState({ state: MeetingState.JOINED, joinedAt: Date.now() });

            if (profile && meetingId) {
                try {
                    await supabase.from('meeting_participants').upsert({
                        meeting_id: meetingId,
                        user_id: profile.id,
                        participant_id: profile.id,
                        participant_name: profile.full_name || 'Guest',
                        role: meeting?.created_by === profile.id ? 'host' : 'participant',
                        joined_at: new Date().toISOString()
                    }, { onConflict: 'meeting_id,user_id' });
                } catch (err) {
                    console.error('[MeetingRoom] Failed to track participant:', err);
                }
            }
        };

        const handleLeft = () => {
            setMeetingState({ state: MeetingState.LEFT, leftAt: Date.now() });
            onMeetingEnded();
        };

        const handleError = (e: any) => {
            setMeetingState(prev => ({ ...prev, state: MeetingState.ERROR, error: friendlyError(e?.errorMsg || e?.message) }));
        };

        callObject.on('joining-meeting', handleJoining);
        callObject.on('joined-meeting', handleJoined);
        callObject.on('left-meeting', handleLeft);
        callObject.on('error', handleError);

        return () => {
            callObject.off('joining-meeting', handleJoining);
            callObject.off('joined-meeting', handleJoined);
            callObject.off('left-meeting', handleLeft);
            callObject.off('error', handleError);
            if (failsafeTimeoutRef.current) clearTimeout(failsafeTimeoutRef.current);
        };
    }, [callObject, meetingId, meeting, profile, onMeetingEnded]);

    const handleLeave = useCallback(async () => {
        if (!callObject) { onMeetingEnded(); return; }
        try {
            setMeetingState(prev => ({ ...prev, state: MeetingState.LEAVING }));
            await callObject.leave();
            await callObject.destroy();
            onMeetingEnded();
        } catch (err) {
            onMeetingEnded();
        }
    }, [callObject, onMeetingEnded]);

    const localAudioState = callObject?.localAudio();
    const localVideoState = callObject?.localVideo();

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur-md border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500"><Video size={20} /></div>
                    <div>
                        <h2 className="text-white font-semibold">{meetingTitle}</h2>
                        <div className="flex items-center gap-2 text-xs text-white/50">
                            <div className={`h-2 w-2 rounded-full ${isInMeeting(meetingState.state) ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
                            {isInMeeting(meetingState.state) ? `${participantIds.length} participant${participantIds.length !== 1 ? 's' : ''}` : meetingState.state}
                        </div>
                    </div>
                </div>
                {isInMeeting(meetingState.state) && (
                    <button onClick={handleLeave} className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 rounded-xl transition-all">
                        <LogOut size={16} /> <span className="font-medium text-xs uppercase font-black tracking-widest">Leave</span>
                    </button>
                )}
            </div>
            <div className="flex-1 p-6 overflow-auto">
                {isLoading(meetingState.state) ? (
                    <div className="h-full flex flex-col items-center justify-center">
                        <Loader2 size={48} className="text-emerald-500 animate-spin mb-4" />
                        <p className="text-white text-lg">Connecting...</p>
                    </div>
                ) : meetingState.state === MeetingState.ERROR ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                        <AlertCircle size={48} className="text-rose-500 mb-4" />
                        <p className="text-white text-xl font-bold">Connection Failed</p>
                        <p className="text-white/60 text-sm mt-2 max-w-xs">{meetingState.error}</p>
                        <Button variant="primary" className="mt-8" onClick={onLeave}>Return</Button>
                    </div>
                ) : isInMeeting(meetingState.state) ? (
                    <div className={`grid gap-4 h-full ${participantIds.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {participantIds.map((id) => <ParticipantTile key={id} sessionId={id} isLocal={id === localSessionId} />)}
                    </div>
                ) : null}
            </div>
            {isInMeeting(meetingState.state) && (
                <ControlsBar
                    isMicMuted={!localAudioState}
                    isVideoOff={!localVideoState}
                    isScreenSharing={isSharingScreen}
                    onToggleMic={() => callObject?.setLocalAudio(!callObject.localAudio())}
                    onToggleVideo={() => callObject?.setLocalVideo(!callObject.localVideo())}
                    onToggleScreenShare={async () => isSharingScreen ? await stopScreenShare() : await startScreenShare()}
                    onLeave={handleLeave}
                />
            )}
        </div>
    );
};

const ParticipantTile: React.FC<{ sessionId: string; isLocal: boolean }> = ({ sessionId, isLocal }) => {
    const videoState = useVideoTrack(sessionId);
    const audioState = useAudioTrack(sessionId);
    const participant = useParticipant(sessionId);
    return <VideoTile videoTrack={videoState.track} audioTrack={audioState.track} isLocal={isLocal} isAudioOff={audioState.isOff === true} userName={participant?.user_name || 'Guest'} sessionId={sessionId} />;
};

export const MeetingRoom: React.FC<MeetingRoomProps> = ({ meetingId, onLeave }) => {
    const [callObject, setCallObject] = useState<any>(null);
    const [meeting, setMeeting] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const { showToast } = useToast();
    const endMeetingCalledRef = useRef(false);
    const [showOutcomePrompt, setShowOutcomePrompt] = useState(false);
    const [selectedOutcome, setSelectedOutcome] = useState<'successful' | 'follow_up_needed' | 'no_show' | 'inconclusive'>('successful');
    const [outcomeNotes, setOutcomeNotes] = useState('');
    const [isSavingOutcome, setIsSavingOutcome] = useState(false);

    useEffect(() => {
        let mounted = true;
        const setup = async () => {
            try {
                setIsInitializing(true);
                const tokenRes = await apiService.getMeetingToken(meetingId);
                if (tokenRes.error) throw tokenRes.error;
                const { token, roomUrl, meeting: meetingData } = tokenRes.data;
                if (!mounted) return;
                setMeeting(meetingData);
                const createdCall = DailyIframe.createCallObject();
                setCallObject(createdCall);
                setIsInitializing(false);
                createdCall.join({ url: roomUrl, token }).catch(err => console.error('[MeetingRoom] Join error:', err));
            } catch (err: any) {
                if (mounted) { setError(friendlyError(err?.message)); setIsInitializing(false); }
            }
        };
        setup();
        return () => { mounted = false; if (callObject) callObject.destroy(); };
    }, [meetingId]);

    const handleMeetingEnded = useCallback(async () => {
        if (endMeetingCalledRef.current) return;
        endMeetingCalledRef.current = true;
        await apiService.stopMeeting(meetingId);
        setShowOutcomePrompt(true);
    }, [meetingId]);

    const recordOutcome = async () => {
        setIsSavingOutcome(true);
        try {
            await supabase.rpc('record_meeting_outcome', {
                p_meeting_id: meetingId,
                p_outcome: selectedOutcome as any,
                p_outcome_notes: outcomeNotes.trim() || null
            });
            onLeave();
        } catch (err: any) {
            showToast(friendlyError(err?.message), 'error');
        } finally {
            setIsSavingOutcome(false);
        }
    };

    if (error) return <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"><div className="bg-white/10 p-8 rounded-3xl text-center"><AlertCircle size={48} className="text-rose-500 mx-auto mb-6"/><p className="text-white text-xl font-bold">Initialization Error</p><p className="text-white/60 mt-2">{error}</p><Button variant="primary" className="mt-8" onClick={onLeave}>Close</Button></div></div>;
    if (isInitializing) return <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center text-center"><div className="animate-pulse"><Loader2 size={48} className="text-emerald-500 animate-spin mx-auto mb-4"/><p className="text-white font-medium">Entering Lobby...</p></div></div>;

    return (
        <>
            <DailyProvider callObject={callObject}>
                <MeetingRoomContent meetingId={meetingId} meeting={meeting} onLeave={onLeave} onMeetingEnded={handleMeetingEnded} />
            </DailyProvider>
            {showOutcomePrompt && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <GlassCard className="max-w-md w-full p-8 relative">
                        <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 mb-6">Record Outcome</h2>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {['successful', 'follow_up_needed', 'no_show', 'inconclusive'].map((id) => (
                                <button key={id} onClick={() => setSelectedOutcome(id as any)} className={`px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${selectedOutcome === id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-zinc-50 border-zinc-200 text-zinc-400'}`}>
                                    {id.replace(/_/g, ' ')}
                                </button>
                            ))}
                        </div>
                        <textarea placeholder="Optional notes..." value={outcomeNotes} onChange={e => setOutcomeNotes(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm mb-8 min-h-[100px] outline-none" />
                        <div className="flex gap-3">
                            <Button variant="ghost" className="flex-1 uppercase font-black text-[10px] tracking-widest" onClick={onLeave}>Skip</Button>
                            <Button variant="primary" className="flex-1 uppercase font-black text-[10px] tracking-widest shadow-xl" onClick={recordOutcome} disabled={isSavingOutcome}>{isSavingOutcome ? 'Saving...' : 'Save'}</Button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </>
    );
};
