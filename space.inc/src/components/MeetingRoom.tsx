import React, { useEffect, useState, useCallback, useRef } from 'react';
import { DailyProvider, useParticipant, useParticipantIds, useLocalSessionId, useVideoTrack, useAudioTrack, useScreenShare, useDaily } from '@daily-co/daily-react';
import DailyIframe from '@daily-co/daily-js';
import { Loader2, Video, AlertCircle, X, LogOut, Square } from 'lucide-react';
import { VideoTile } from './meeting/VideoTile';
import { MeetingNotepad } from './meeting/MeetingNotepad';
import { ControlsBar } from './meeting/ControlsBar';
import { apiService } from '../services/apiService';
import { supabase } from '../lib/supabase';
import { MeetingState, MeetingStateContext, getInitialState, isLoading, isInMeeting } from '../utils/meetingStateMachine';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { friendlyError } from '../utils/errors';
import { Button } from './UI';

interface MeetingRoomProps {
    meetingId: string;
    roomUrl?: string | null;
    onLeave: () => void;
}

const DEBUG_EVENTS = true;

const MeetingRoomContent: React.FC<{ meetingId: string; roomUrl?: string | null; onLeave: () => void; onMeetingEnded: () => void }> = ({ meetingId, roomUrl, onLeave, onMeetingEnded }) => {
    const [isNotepadOpen, setIsNotepadOpen] = useState(false);
    const callObject = useDaily();
    const localSessionId = useLocalSessionId();
    const participantIds = useParticipantIds();
    const { isSharingScreen, startScreenShare, stopScreenShare } = useScreenShare();
    const { userRole } = useAuth();

    const [meetingState, setMeetingState] = useState<MeetingStateContext>(getInitialState());
    const [meetingTitle, setMeetingTitle] = useState('Meeting');
    const [showEndConfirm, setShowEndConfirm] = useState(false);
    const [endOutcome, setEndOutcome] = useState<string>('successful');
    const [endNotes, setEndNotes] = useState('');
    const [isEnding, setIsEnding] = useState(false);

    const failsafeTimeoutRef = useRef<any>(null);

    useEffect(() => {
        if (!callObject || !DEBUG_EVENTS) return;

        const handleJoining = () => setMeetingState(prev => ({ ...prev, state: MeetingState.JOINING }));
        const handleJoined = () => setMeetingState(prev => ({ ...prev, state: MeetingState.JOINED }));
        const handleLeft = () => {
            setMeetingState({ state: MeetingState.LEFT, leftAt: Date.now() });
            onMeetingEnded();
        };

        const handleError = (e: any) => {
            console.error('[MeetingRoom] ERROR:', e);
            setMeetingState(prev => ({
                ...prev,
                state: MeetingState.ERROR,
                error: friendlyError(e?.errorMsg || e?.message || 'UNKNOWN_ERROR')
            }));
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
        };
    }, [callObject, onMeetingEnded]);

    const handleLeave = useCallback(async () => {
        if (!callObject) {
            onMeetingEnded();
            return;
        }
        try {
            setMeetingState(prev => ({ ...prev, state: MeetingState.LEAVING }));
            apiService.recordParticipantExit(meetingId).catch(console.warn);
            await callObject.leave();
            await callObject.destroy();
            onMeetingEnded();
        } catch (err) {
            console.error('[MeetingRoom] Error leaving:', err);
            onMeetingEnded();
        }
    }, [callObject, onMeetingEnded]);

    const handleEndMeeting = async () => {
        setIsEnding(true);
        try {
            await apiService.endMeetingByStaff(meetingId, endOutcome, endNotes);
            setShowEndConfirm(false);
            await callObject?.leave();
            onMeetingEnded();
        } catch (err) {
            console.error('[MeetingRoom] End meeting error:', err);
        } finally {
            setIsEnding(false);
        }
    };

    const handleToggleMic = () => {
        const isMuted = !callObject?.localAudio();
        callObject?.setLocalAudio(!isMuted);
    };

    const handleToggleVideo = () => {
        const isOff = !callObject?.localVideo();
        callObject?.setLocalVideo(!isOff);
    };

    const handleToggleScreenShare = () => {
        if (isSharingScreen) stopScreenShare();
        else startScreenShare();
    };

    const localAudioState = callObject?.localAudio();
    const localVideoState = callObject?.localVideo();

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col font-inter">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 bg-zinc-950/50 backdrop-blur-2xl border-b border-white/5 relative z-[110]">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-emerald-500/10 rounded-[18px] flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                        <Video size={24} />
                    </div>
                    <div>
                        <h2 className="text-white font-black text-lg tracking-tight uppercase">{meetingTitle}</h2>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">
                            <div className={`h-1.5 w-1.5 rounded-full ${isInMeeting(meetingState.state) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse' : 'bg-zinc-700'}`} />
                            {isInMeeting(meetingState.state) ? `${participantIds.length} Personnel Active` : meetingState.state}
                        </div>
                    </div>
                </div>

                {isInMeeting(meetingState.state) && (
                    <div className="flex items-center gap-4">
                        {(userRole === 'owner' || userRole === 'admin' || userRole === 'staff') && (
                            <button
                                onClick={() => setShowEndConfirm(true)}
                                className="flex items-center gap-3 px-6 py-3 bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 rounded-2xl border border-rose-500/20 transition-all text-[11px] font-black uppercase tracking-widest"
                            >
                                <Square size={16} />
                                Terminate Session
                            </button>
                        )}
                        <button
                            onClick={handleLeave}
                            disabled={meetingState.state === MeetingState.LEAVING}
                            className="flex items-center gap-3 px-6 py-3 bg-zinc-900/50 hover:bg-zinc-800 text-white rounded-2xl border border-white/5 transition-all disabled:opacity-50 text-[11px] font-black uppercase tracking-widest"
                        >
                            <LogOut size={16} />
                            Exit
                        </button>
                    </div>
                )}
            </div>

            {/* Main Area */}
            <div className="flex-1 relative flex overflow-hidden bg-zinc-950">
                {/* Video Grid */}
                <div className={`flex-1 p-8 overflow-auto transition-all duration-700 ${isNotepadOpen ? 'mr-[450px] opacity-40 grayscale-[0.5]' : 'mr-0'}`}>
                    {isLoading(meetingState.state) ? (
                        <div className="h-full flex flex-col items-center justify-center gap-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-emerald-500/20 blur-[64px] rounded-full animate-pulse" />
                                <Loader2 size={64} className="text-emerald-500 animate-spin relative" />
                            </div>
                            <p className="text-zinc-500 font-black uppercase tracking-[0.4em] text-[12px] animate-pulse">Synchronizing Neural Stream</p>
                        </div>
                    ) : meetingState.state === MeetingState.ERROR ? (
                        <div className="h-full flex flex-col items-center justify-center">
                            <div className="h-20 w-20 bg-rose-500/10 rounded-3xl flex items-center justify-center text-rose-500 mb-8 border border-rose-500/20">
                                <AlertCircle size={40} />
                            </div>
                            <p className="text-white text-3xl font-black tracking-tighter mb-4 uppercase">Neural Link Failure</p>
                            <p className="text-zinc-500 text-sm mb-10 max-w-md text-center font-medium leading-relaxed">{meetingState.error}</p>
                            <Button
                                onClick={onLeave}
                                className="h-14 px-10 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:scale-105 transition-all shadow-2xl"
                            >
                                Re-initiate Command
                            </Button>
                        </div>
                    ) : isInMeeting(meetingState.state) ? (
                        <div className={`grid gap-6 h-full ${participantIds.length === 1 ? 'grid-cols-1' :
                            participantIds.length === 2 ? 'grid-cols-2' :
                                participantIds.length <= 4 ? 'grid-cols-2' :
                                    participantIds.length <= 6 ? 'grid-cols-3' :
                                        'grid-cols-4'
                            }`}>
                            {participantIds.map((sessionId) => (
                                <ParticipantTile
                                    key={sessionId}
                                    sessionId={sessionId}
                                    isLocal={sessionId === localSessionId}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>

                {/* Collaborative Notepad Overlay */}
                <MeetingNotepad
                    meetingId={meetingId}
                    isOpen={isNotepadOpen}
                    onClose={() => setIsNotepadOpen(false)}
                />
            </div>

            {/* Bottom Controls */}
            {isInMeeting(meetingState.state) && (
                <div className="relative z-[110]">
                    <ControlsBar
                        isMicMuted={!localAudioState}
                        isVideoOff={!localVideoState}
                        isScreenSharing={isSharingScreen}
                        onToggleMic={handleToggleMic}
                        onToggleVideo={handleToggleVideo}
                        onToggleScreenShare={handleToggleScreenShare}
                        onLeave={handleLeave}
                        onToggleNotepad={() => setIsNotepadOpen(!isNotepadOpen)}
                        isNotepadOpen={isNotepadOpen}
                    />
                </div>
            )}

            {/* End Meeting Confirmation Modal */}
            {showEndConfirm && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
                    <GlassCard className="max-w-md w-full p-12 border-rose-500/20 bg-zinc-950 rounded-[48px] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.9)]">
                        <Heading level={2} className="text-3xl font-black text-white mb-3 tracking-tighter uppercase">Terminate Session?</Heading>
                        <Text className="text-zinc-500 mb-10 font-medium leading-relaxed">This action will disconnect all personnel and archive the neural stream metadata.</Text>
                        
                        <div className="grid grid-cols-2 gap-3 mb-8">
                            {[
                                { id: 'successful', label: '✅ Victory' },
                                { id: 'follow_up_needed', label: '🔄 Re-engage' },
                                { id: 'no_show', label: '👻 Ghosted' },
                                { id: 'inconclusive', label: '❓ Ambiguous' },
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setEndOutcome(opt.id)}
                                    className={`px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                                        endOutcome === opt.id
                                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-500/5'
                                            : 'bg-zinc-900/50 border-white/5 text-zinc-600 hover:border-white/10'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        
                        <textarea
                            value={endNotes}
                            onChange={e => setEndNotes(e.target.value)}
                            placeholder="Executive outcome summary..."
                            disabled={isEnding}
                            className="w-full bg-zinc-900 border border-white/5 rounded-3xl px-6 py-4 text-sm text-white mb-10 outline-none focus:border-emerald-500/50 transition-all min-h-[120px] resize-none"
                        />
                        
                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowEndConfirm(false)}
                                disabled={isEnding}
                                className="flex-1 h-14 rounded-2xl bg-zinc-900 text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-zinc-800 transition-all"
                            >
                                Abort
                            </button>
                            <button
                                onClick={handleEndMeeting}
                                disabled={isEnding}
                                className="flex-1 h-14 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-2xl shadow-rose-600/20"
                            >
                                {isEnding ? 'Terminating...' : 'Confirm Exit'}
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

const ParticipantTile: React.FC<{ sessionId: string; isLocal: boolean }> = ({ sessionId, isLocal }) => {
    const videoState = useVideoTrack(sessionId);
    const audioState = useAudioTrack(sessionId);
    const participant = useParticipant(sessionId);

    return (
        <VideoTile
            videoTrack={videoState.track}
            audioTrack={audioState.track}
            isLocal={isLocal}
            isAudioOff={audioState.isOff === true}
            userName={participant?.user_name || 'Guest'}
            sessionId={sessionId}
        />
    );
};

export const MeetingRoom: React.FC<MeetingRoomProps> = ({ meetingId, roomUrl: initialRoomUrl, onLeave }) => {
    const [callObject, setCallObject] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);

    const endMeetingCalledRef = useRef(false);

    useEffect(() => {
        let mounted = true;
        let createdCall: any = null;

        const setupCall = async () => {
            try {
                setIsInitializing(true);
                const existingCall = DailyIframe.getCallInstance();
                if (existingCall) {
                    existingCall.destroy();
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                const tokenRes = await apiService.getMeetingToken(meetingId);
                if (tokenRes.error) throw new Error(tokenRes.error.message);
                const { token, roomUrl: resolvedRoomUrl } = tokenRes.data;

                if (!mounted) return;
                createdCall = DailyIframe.createCallObject();
                if (!mounted) { createdCall?.destroy(); return; }

                setCallObject(createdCall);
                setIsInitializing(false);
                createdCall.join({ url: resolvedRoomUrl, token }).catch(console.error);
            } catch (err: any) {
                if (mounted) {
                    setError(friendlyError(err?.message || 'Failed to initialize meeting'));
                    setIsInitializing(false);
                }
                createdCall?.destroy();
            }
        };

        setupCall();
        return () => {
            mounted = false;
            createdCall?.destroy();
        };
    }, [meetingId]);

    const handleMeetingEnded = useCallback(async () => {
        onLeave();
        if (endMeetingCalledRef.current) return;
        endMeetingCalledRef.current = true;
        const res = await apiService.stopMeeting(meetingId);
        if (res?.error) console.error('[MeetingRoom] END_MEETING error:', res.error);
    }, [meetingId, onLeave]);

    if (error) {
        return (
            <div className="fixed inset-0 z-[1000] bg-black flex items-center justify-center p-6">
                <GlassCard className="max-w-md w-full p-12 text-center border-rose-500/20 bg-zinc-950 rounded-[48px]">
                    <AlertCircle className="h-16 w-16 text-rose-500 mx-auto mb-8" />
                    <Heading level={2} className="text-white mb-3 text-3xl font-black uppercase tracking-tighter">System Error</Heading>
                    <Text className="text-zinc-500 mb-10 font-medium leading-relaxed">{error}</Text>
                    <Button onClick={onLeave} className="w-full h-14 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl">Return to Command</Button>
                </GlassCard>
            </div>
        );
    }

    if (isInitializing || !callObject) {
        return (
            <div className="fixed inset-0 z-[1000] bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-[64px] rounded-full animate-pulse" />
                        <Loader2 size={64} className="text-emerald-500 animate-spin relative" />
                    </div>
                    <p className="text-zinc-500 font-black uppercase tracking-[0.5em] text-xs">Initializing Secure Channel</p>
                </div>
            </div>
        );
    }

    return (
        <DailyProvider callObject={callObject}>
            <MeetingRoomContent
                meetingId={meetingId}
                roomUrl={initialRoomUrl}
                onLeave={onLeave}
                onMeetingEnded={handleMeetingEnded}
            />
        </DailyProvider>
    );
};
