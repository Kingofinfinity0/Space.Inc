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
import { Button, GlassCard, Heading, Text } from './UI';

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
        const media = window.matchMedia('(min-width: 768px)');
        const update = () => setIsNotepadOpen(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

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
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#FFFFFF] font-inter text-[#0D0D0D]">
            {/* Header */}
            <div className="relative z-[110] flex items-center justify-between border-b border-[#E5E5E5] bg-[#F7F7F8] px-4 py-4 md:px-8 md:py-5">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-white text-[#0D0D0D] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                        <Video size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight text-[#0D0D0D]">{meetingTitle}</h2>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[#6E6E80]">
                            <div className={`h-1.5 w-1.5 rounded-full ${isInMeeting(meetingState.state) ? 'animate-pulse bg-black' : 'bg-[#E5E5E5]'}`} />
                            {isInMeeting(meetingState.state) ? `${participantIds.length} Personnel Active` : meetingState.state}
                        </div>
                    </div>
                </div>

                {isInMeeting(meetingState.state) && (
                    <div className="flex items-center gap-4">
                        {(userRole === 'owner' || userRole === 'admin' || userRole === 'staff') && (
                            <button
                                onClick={() => setShowEndConfirm(true)}
                                className="flex items-center gap-3 rounded-[6px] border border-[#E5E5E5] bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#0D0D0D] transition-all hover:bg-[#F7F7F8]"
                            >
                                <Square size={16} />
                                Terminate Session
                            </button>
                        )}
                        <button
                            onClick={handleLeave}
                            disabled={meetingState.state === MeetingState.LEAVING}
                            className="flex items-center gap-3 rounded-[6px] border border-[#E5E5E5] bg-black px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-white transition-all hover:bg-[#1A1A1A] disabled:opacity-50"
                        >
                            <LogOut size={16} />
                            Exit
                        </button>
                    </div>
                )}
            </div>

            {/* Main Area */}
            <div className="flex-1 relative flex flex-col overflow-hidden bg-white text-[#0D0D0D]">
                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    {isLoading(meetingState.state) ? (
                        <div className="flex h-full flex-col items-center justify-center gap-6">
                            <div className="relative">
                                <div className="absolute inset-0 rounded-full bg-black/5 blur-[64px] animate-pulse" />
                                <Loader2 size={64} className="relative animate-spin text-[#0D0D0D]" />
                            </div>
                            <p className="text-[12px] font-semibold uppercase tracking-[0.35em] text-[#6E6E80] animate-pulse">Synchronizing meeting</p>
                        </div>
                    ) : meetingState.state === MeetingState.ERROR ? (
                        <div className="flex h-full flex-col items-center justify-center">
                            <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D]">
                                <AlertCircle size={40} />
                            </div>
                            <p className="mb-4 text-3xl font-semibold tracking-tighter text-[#0D0D0D]">Meeting unavailable</p>
                            <p className="mb-10 max-w-md text-center text-sm font-medium leading-relaxed text-[#6E6E80]">{meetingState.error}</p>
                            <Button
                                onClick={onLeave}
                                className="h-14 rounded-[6px] px-10 font-semibold uppercase tracking-widest text-xs"
                            >
                                Return
                            </Button>
                        </div>
                    ) : isInMeeting(meetingState.state) ? (
                        <div className={`grid gap-6 ${participantIds.length === 1 ? 'grid-cols-1' :
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

                    <div className="mt-6 space-y-3">
                        <button
                            onClick={() => setIsNotepadOpen((v) => !v)}
                            className="inline-flex items-center gap-2 rounded-[6px] border border-[#E5E5E5] bg-white px-3 py-2 text-sm font-medium text-[#0D0D0D] hover:bg-[#F7F7F8] md:hidden"
                        >
                            Notes
                        </button>
                        {isNotepadOpen && (
                            <MeetingNotepad meetingId={meetingId} readOnly={false} />
                        )}
                    </div>
                </div>
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
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/30 p-4">
                    <GlassCard className="w-full max-w-md rounded-[8px] border border-[#E5E5E5] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:p-8">
                        <Heading level={2} className="mb-3 text-2xl font-semibold tracking-tight text-[#0D0D0D]">Terminate Session?</Heading>
                        <Text className="mb-8 font-medium leading-relaxed text-[#6E6E80]">This action will disconnect all participants and archive the meeting.</Text>
                        
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
                                    className={`px-4 py-3 rounded-[6px] border text-xs font-medium uppercase tracking-widest transition-all ${
                                        endOutcome === opt.id
                                            ? 'bg-[#F7F7F8] border-[#0D0D0D] text-[#0D0D0D]'
                                            : 'bg-white border-[#E5E5E5] text-[#6E6E80] hover:bg-[#F7F7F8]'
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
                            className="mb-8 min-h-[120px] w-full resize-none rounded-[8px] border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#0D0D0D] outline-none transition-all placeholder:text-[#6E6E80] focus:border-[#0D0D0D]"
                        />
                        
                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowEndConfirm(false)}
                                disabled={isEnding}
                                className="flex-1 rounded-[6px] border border-[#E5E5E5] bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0D0D0D] transition-all hover:bg-[#F7F7F8]"
                            >
                                Abort
                            </button>
                            <button
                                onClick={handleEndMeeting}
                                disabled={isEnding}
                                className="flex-1 rounded-[6px] bg-black px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-all hover:bg-[#1A1A1A]"
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
