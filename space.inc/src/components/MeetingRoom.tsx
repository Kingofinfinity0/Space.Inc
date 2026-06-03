import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DailyProvider, useAudioTrack, useDaily, useLocalSessionId, useParticipant, useParticipantIds, useScreenShare, useVideoTrack } from '@daily-co/daily-react';
import DailyIframe from '@daily-co/daily-js';
import { AlertCircle, Loader2, LogOut, Square, Video } from 'lucide-react';
import { VideoTile } from './meeting/VideoTile';
import { MeetingNotepad } from './meeting/MeetingNotepad';
import { ControlsBar } from './meeting/ControlsBar';
import { apiService } from '../services/apiService';
import { MeetingState, MeetingStateContext, getInitialState, isInMeeting, isLoading } from '../utils/meetingStateMachine';
import { friendlyError } from '../utils/errors';
import { Button, GlassCard, Heading, Text } from './UI';
import { useAuth } from '../contexts/AuthContext';

interface MeetingRoomProps {
    meetingId: string;
    roomUrl?: string | null;
    onLeave: () => void;
}

type MeetingRoomContentProps = {
    meetingId: string;
    onLeave: () => void;
};

const MeetingRoomContent: React.FC<MeetingRoomContentProps> = ({ meetingId, onLeave }) => {
    const callObject = useDaily();
    const localSessionId = useLocalSessionId();
    const participantIds = useParticipantIds();
    const { isSharingScreen, startScreenShare, stopScreenShare } = useScreenShare();
    const { user, userRole } = useAuth();

    const [meetingState, setMeetingState] = useState<MeetingStateContext>(getInitialState());
    const [meetingTitle, setMeetingTitle] = useState('Meeting');
    const [meetingCreatedBy, setMeetingCreatedBy] = useState<string | null>(null);
    const [isNotepadOpen, setIsNotepadOpen] = useState(false);
    const [showEndConfirm, setShowEndConfirm] = useState(false);
    const [isEnding, setIsEnding] = useState(false);
    const hasLeftRef = useRef(false);

    const canEndMeeting = user?.id === meetingCreatedBy || userRole === 'owner' || userRole === 'admin';

    const finishLocally = useCallback(() => {
        if (hasLeftRef.current) return;
        hasLeftRef.current = true;
        setMeetingState({ state: MeetingState.LEFT, leftAt: Date.now() });
        onLeave();
    }, [onLeave]);

    useEffect(() => {
        const media = window.matchMedia('(min-width: 768px)');
        const update = () => setIsNotepadOpen(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const loadMeeting = async () => {
            const { data } = await apiService.getMeetingDetail(meetingId);
            if (cancelled || !data) return;
            const meeting = data.meeting || data;
            setMeetingTitle(meeting.title || 'Meeting');
            setMeetingCreatedBy(meeting.created_by || null);
        };
        loadMeeting();
        return () => {
            cancelled = true;
        };
    }, [meetingId]);

    useEffect(() => {
        if (!callObject) return;

        const handleJoining = () => setMeetingState((prev) => ({ ...prev, state: MeetingState.JOINING }));
        const handleJoined = () => setMeetingState((prev) => ({ ...prev, state: MeetingState.JOINED }));
        const handleLeft = () => finishLocally();
        const handleError = (event: any) => {
            console.error('[MeetingRoom] ERROR:', event);
            setMeetingState((prev) => ({
                ...prev,
                state: MeetingState.ERROR,
                error: friendlyError(event?.errorMsg || event?.message || 'UNKNOWN_ERROR')
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
    }, [callObject, finishLocally]);

    const handleLeave = useCallback(async () => {
        if (!callObject) {
            finishLocally();
            return;
        }

        try {
            setMeetingState((prev) => ({ ...prev, state: MeetingState.LEAVING }));
            await apiService.recordParticipantExit(meetingId).catch(console.warn);
            await callObject.leave();
            await callObject.destroy();
        } catch (err) {
            console.error('[MeetingRoom] Error leaving:', err);
            finishLocally();
        }
    }, [callObject, finishLocally, meetingId]);

    const handleEndMeeting = async () => {
        setIsEnding(true);
        try {
            const { error } = await apiService.stopMeeting(meetingId);
            if (error) throw error;
            setShowEndConfirm(false);
            await callObject?.leave();
            await callObject?.destroy();
            finishLocally();
        } catch (err) {
            console.error('[MeetingRoom] End meeting error:', err);
        } finally {
            setIsEnding(false);
        }
    };

    const handleToggleMic = () => {
        callObject?.setLocalAudio(!callObject.localAudio());
    };

    const handleToggleVideo = () => {
        callObject?.setLocalVideo(!callObject.localVideo());
    };

    const handleToggleScreenShare = () => {
        if (isSharingScreen) stopScreenShare();
        else startScreenShare();
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-white font-inter text-[#0D0D0D]">
            <div className="relative z-[110] flex items-center justify-between border-b border-[#E5E5E5] bg-[#F7F7F8] px-4 py-4 md:px-8 md:py-5">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-white text-[#0D0D0D] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                        <Video size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight text-[#0D0D0D]">{meetingTitle}</h2>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[#6E6E80]">
                            <div className={`h-1.5 w-1.5 rounded-full ${isInMeeting(meetingState.state) ? 'animate-pulse bg-black' : 'bg-[#E5E5E5]'}`} />
                            {isInMeeting(meetingState.state) ? `${participantIds.length} participants active` : meetingState.state}
                        </div>
                    </div>
                </div>

                {isInMeeting(meetingState.state) && (
                    <div className="flex items-center gap-3">
                        {canEndMeeting && (
                            <button
                                type="button"
                                onClick={() => setShowEndConfirm(true)}
                                className="flex items-center gap-3 rounded-[6px] border border-red-300 bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-red-700 transition-all hover:bg-red-50"
                            >
                                <Square size={16} />
                                End Meeting
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleLeave}
                            disabled={meetingState.state === MeetingState.LEAVING}
                            className="flex items-center gap-3 rounded-[6px] border border-[#DADADA] bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#0D0D0D] transition-all hover:bg-[#F7F7F8] disabled:opacity-50"
                        >
                            <LogOut size={16} />
                            Leave Meeting
                        </button>
                    </div>
                )}
            </div>

            <div className="relative flex flex-1 flex-col overflow-hidden bg-white text-[#0D0D0D]">
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    {isLoading(meetingState.state) ? (
                        <div className="flex h-full flex-col items-center justify-center gap-6">
                            <Loader2 size={64} className="animate-spin text-[#0D0D0D]" />
                            <p className="text-[12px] font-semibold uppercase tracking-[0.35em] text-[#6E6E80]">Synchronizing meeting</p>
                        </div>
                    ) : meetingState.state === MeetingState.ERROR ? (
                        <div className="flex h-full flex-col items-center justify-center">
                            <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-[#F7F7F8] text-[#0D0D0D]">
                                <AlertCircle size={40} />
                            </div>
                            <p className="mb-4 text-3xl font-semibold tracking-tighter text-[#0D0D0D]">Meeting unavailable</p>
                            <p className="mb-10 max-w-md text-center text-sm font-medium leading-relaxed text-[#6E6E80]">{meetingState.error}</p>
                            <Button onClick={onLeave} className="h-14 rounded-[6px] px-10 text-xs font-semibold uppercase tracking-widest">
                                Return
                            </Button>
                        </div>
                    ) : isInMeeting(meetingState.state) ? (
                        <div className={`grid gap-6 ${
                            participantIds.length === 1 ? 'grid-cols-1' :
                                participantIds.length === 2 ? 'grid-cols-2' :
                                    participantIds.length <= 4 ? 'grid-cols-2' :
                                        participantIds.length <= 6 ? 'grid-cols-3' :
                                            'grid-cols-4'
                        }`}>
                            {participantIds.map((sessionId) => (
                                <ParticipantTile key={sessionId} sessionId={sessionId} isLocal={sessionId === localSessionId} />
                            ))}
                        </div>
                    ) : null}

                    <div className="mt-6 space-y-3">
                        <button
                            type="button"
                            onClick={() => setIsNotepadOpen((value) => !value)}
                            className="inline-flex items-center gap-2 rounded-[6px] border border-[#E5E5E5] bg-white px-3 py-2 text-sm font-medium text-[#0D0D0D] hover:bg-[#F7F7F8] md:hidden"
                        >
                            Notes
                        </button>
                        {isNotepadOpen && <MeetingNotepad meetingId={meetingId} readOnly={false} />}
                    </div>
                </div>
            </div>

            {isInMeeting(meetingState.state) && (
                <div className="relative z-[110]">
                    <ControlsBar
                        isMicMuted={!callObject?.localAudio()}
                        isVideoOff={!callObject?.localVideo()}
                        isScreenSharing={isSharingScreen}
                        onToggleMic={handleToggleMic}
                        onToggleVideo={handleToggleVideo}
                        onToggleScreenShare={handleToggleScreenShare}
                        onLeave={handleLeave}
                        onToggleNotepad={() => setIsNotepadOpen((value) => !value)}
                        isNotepadOpen={isNotepadOpen}
                    />
                </div>
            )}

            {showEndConfirm && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/30 p-4">
                    <GlassCard className="w-full max-w-md rounded-[8px] border border-[#E5E5E5] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:p-8">
                        <Heading level={2} className="mb-3 text-2xl font-semibold tracking-tight text-[#0D0D0D]">End Meeting?</Heading>
                        <Text className="mb-8 font-medium leading-relaxed text-[#6E6E80]">This will end the meeting for everyone. Are you sure?</Text>
                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={() => setShowEndConfirm(false)}
                                disabled={isEnding}
                                className="flex-1 rounded-[6px] border border-[#E5E5E5] bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0D0D0D] transition-all hover:bg-[#F7F7F8]"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleEndMeeting}
                                disabled={isEnding}
                                className="flex-1 rounded-[6px] border border-red-300 bg-red-600 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-all hover:bg-red-700 disabled:opacity-60"
                            >
                                {isEnding ? 'Ending...' : 'End Meeting'}
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

export const MeetingRoom: React.FC<MeetingRoomProps> = ({ meetingId, onLeave }) => {
    const [callObject, setCallObject] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        let mounted = true;
        let createdCall: any = null;

        const setupCall = async () => {
            try {
                setIsInitializing(true);
                const existingCall = DailyIframe.getCallInstance();
                if (existingCall) {
                    existingCall.destroy();
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }

                const tokenRes = await apiService.getMeetingToken(meetingId);
                if (tokenRes.error) throw new Error(tokenRes.error.message);
                const { token, roomUrl } = tokenRes.data;

                if (!mounted) return;
                createdCall = DailyIframe.createCallObject();
                if (!mounted) {
                    createdCall?.destroy();
                    return;
                }

                setCallObject(createdCall);
                setIsInitializing(false);
                createdCall.join({ url: roomUrl, token }).catch(console.error);
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

    if (error) {
        return (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black p-6">
                <GlassCard className="w-full max-w-md rounded-[8px] border-rose-500/20 bg-zinc-950 p-12 text-center">
                    <AlertCircle className="mx-auto mb-8 h-16 w-16 text-rose-500" />
                    <Heading level={2} className="mb-3 text-3xl font-semibold tracking-tight text-white">System Error</Heading>
                    <Text className="mb-10 font-medium leading-relaxed text-zinc-500">{error}</Text>
                    <Button onClick={onLeave} className="h-14 w-full rounded-[8px] bg-white text-xs font-semibold uppercase tracking-widest text-black">Return</Button>
                </GlassCard>
            </div>
        );
    }

    if (isInitializing || !callObject) {
        return (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black">
                <div className="text-center">
                    <Loader2 size={64} className="relative mb-8 animate-spin text-white" />
                    <p className="text-xs font-semibold uppercase tracking-[0.5em] text-zinc-500">Initializing secure channel</p>
                </div>
            </div>
        );
    }

    return (
        <DailyProvider callObject={callObject}>
            <MeetingRoomContent meetingId={meetingId} onLeave={onLeave} />
        </DailyProvider>
    );
};
