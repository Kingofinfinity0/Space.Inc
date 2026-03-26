import React, { useEffect, useState, useCallback, useRef } from 'react';
import { DailyProvider, useParticipant, useParticipantIds, useLocalSessionId, useVideoTrack, useAudioTrack, useScreenShare, useDaily } from '@daily-co/daily-react';
import DailyIframe from '@daily-co/daily-js';
import { Loader2, Video, AlertCircle, X, LogOut } from 'lucide-react';
import { VideoTile } from './meeting/VideoTile';
import { ControlsBar } from './meeting/ControlsBar';
import { apiService } from '../services/apiService';
import { supabase } from '../lib/supabase';
import { MeetingState, MeetingStateContext, getInitialState, isLoading, isInMeeting } from '../utils/meetingStateMachine';
import { useToast } from '../contexts/ToastContext';
import { friendlyError } from '../utils/errors';
import { Button } from './UI';

interface MeetingRoomProps {
    meetingId: string;
    roomUrl?: string | null;
    onLeave: () => void;
}

// Debug flag - set to false in production
const DEBUG_EVENTS = true;

/**
 * STABILIZED MEETING ROOM
 * 
 * KEY PRINCIPLES:
 * 1. Daily SDK events are the SINGLE SOURCE OF TRUTH for connection state
 * 2. Backend calls NEVER block UI readiness
 * 3. State machine prevents invalid transitions
 * 4. Fail-safe mechanisms prevent infinite loading
 * 5. Proper cleanup on leave/unmount
 */

const MeetingRoomContent: React.FC<{ meetingId: string; roomUrl?: string | null; onLeave: () => void; onMeetingEnded: () => void }> = ({ meetingId, roomUrl, onLeave, onMeetingEnded }) => {
    const callObject = useDaily();
    const localSessionId = useLocalSessionId();
    const participantIds = useParticipantIds();
    const { isSharingScreen, startScreenShare, stopScreenShare } = useScreenShare();

    const [meetingState, setMeetingState] = useState<MeetingStateContext>(getInitialState());
    const [meetingTitle, setMeetingTitle] = useState('Meeting');

    // TASK 3: Fail-safe spinner kill mechanism
    const failsafeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // TASK 8: Defensive event logging
    useEffect(() => {
        if (!callObject || !DEBUG_EVENTS) return;

        const events = [
            'loading', 'loaded', 'started-camera', 'camera-error',
            'joining-meeting', 'joined-meeting', 'left-meeting',
            'participant-joined', 'participant-left',
            'track-started', 'track-stopped',
            'error', 'network-quality-change', 'network-connection'
        ];

        const logEvent = (eventName: string) => (data?: any) => {
            console.log(`[Daily Event] 📡 ${eventName}`, data);
        };

        events.forEach(event => {
            callObject.on(event as any, logEvent(event));
        });

        return () => {
            events.forEach(event => {
                callObject.off(event as any, logEvent(event));
            });
        };
    }, [callObject]);

    // TASK 1: Remove backend dependency - Listen ONLY to Daily events
    useEffect(() => {
        if (!callObject) return;

        const handleJoining = () => {
            console.log('[MeetingRoom] 🚪 JOINING state');
            setMeetingState(prev => ({
                ...prev,
                state: MeetingState.JOINING
            }));

            // TASK 3: Start fail-safe timeout
            failsafeTimeoutRef.current = setTimeout(() => {
                console.warn('[MeetingRoom] ⚠️ FAIL-SAFE: Forcing spinner termination after 8s');
                setMeetingState(prev => {
                    if (prev.state === MeetingState.JOINING) {
                        return {
                            ...prev,
                            state: MeetingState.ERROR,
                            error: 'Join timeout - connection may be slow or blocked'
                        };
                    }
                    return prev;
                });
            }, 8000);
        };

        const handleJoined = () => {
            console.log('[MeetingRoom] ✅ JOINED - This is the ONLY condition that stops spinner!');

            // Clear fail-safe timeout
            if (failsafeTimeoutRef.current) {
                clearTimeout(failsafeTimeoutRef.current);
            }

            // CRITICAL: Set state to JOINED - this stops the spinner
            setMeetingState({
                state: MeetingState.JOINED,
                joinedAt: Date.now()
            });
        };

        const handleLeft = () => {
            console.log('[MeetingRoom] 👋 LEFT meeting');
            setMeetingState({
                state: MeetingState.LEFT,
                leftAt: Date.now()
            });
            onMeetingEnded();
        };

        const handleError = (e: any) => {
            console.error('[MeetingRoom] ❌ ERROR:', e);
            setMeetingState(prev => ({
                ...prev,
                state: MeetingState.ERROR,
                error: friendlyError(e?.errorMsg || e?.message || 'UNKNOWN_ERROR')
            }));
        };

        // Subscribe to Daily events
        callObject.on('joining-meeting', handleJoining);
        callObject.on('joined-meeting', handleJoined);
        callObject.on('left-meeting', handleLeft);
        callObject.on('error', handleError);

        return () => {
            callObject.off('joining-meeting', handleJoining);
            callObject.off('joined-meeting', handleJoined);
            callObject.off('left-meeting', handleLeft);
            callObject.off('error', handleError);

            // Cleanup fail-safe timeout
            if (failsafeTimeoutRef.current) {
                clearTimeout(failsafeTimeoutRef.current);
            }
        };
    }, [callObject, onMeetingEnded, onLeave]);

    // TASK 6: Leave meeting handler
    const handleLeave = useCallback(async () => {
        if (!callObject) {
            onMeetingEnded();
            return;
        }

        try {
            console.log('[MeetingRoom] 🚪 Leaving meeting...');
            setMeetingState(prev => ({ ...prev, state: MeetingState.LEAVING }));

            await callObject.leave();
            // Note: 'left-meeting' event will handle state transition to LEFT

            // CRITICAL: Destroy call object to release camera/mic
            await callObject.destroy();
            console.log('[MeetingRoom] 🧹 Call object destroyed');

            // Fail-safe: if Daily doesn't fire left-meeting reliably, ensure backend ends.
            onMeetingEnded();

        } catch (err) {
            console.error('[MeetingRoom] Error leaving:', err);
            // Force close anyway
            onMeetingEnded();
        }
    }, [callObject, onMeetingEnded]);

    // Toggle microphone
    const handleToggleMic = useCallback(() => {
        if (!callObject) return;
        callObject.setLocalAudio(!callObject.localAudio());
    }, [callObject]);

    // Toggle camera
    const handleToggleVideo = useCallback(() => {
        if (!callObject) return;
        callObject.setLocalVideo(!callObject.localVideo());
    }, [callObject]);

    // Toggle screen share
    const handleToggleScreenShare = useCallback(async () => {
        if (isSharingScreen) {
            await stopScreenShare();
        } else {
            await startScreenShare();
        }
    }, [isSharingScreen, startScreenShare, stopScreenShare]);

    // Get local participant state
    const localAudioState = callObject?.localAudio();
    const localVideoState = callObject?.localVideo();

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur-md border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500">
                        <Video size={20} />
                    </div>
                    <div>
                        <h2 className="text-white font-semibold">{meetingTitle}</h2>
                        <div className="flex items-center gap-2 text-xs text-white/50">
                            <div className={`h-2 w-2 rounded-full ${isInMeeting(meetingState.state) ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
                            {isInMeeting(meetingState.state) ? `${participantIds.length} participant${participantIds.length !== 1 ? 's' : ''}` : meetingState.state}
                        </div>
                    </div>
                </div>

                {/* TASK 6: Leave Meeting Button */}
                {isInMeeting(meetingState.state) && (
                    <button
                        onClick={handleLeave}
                        disabled={meetingState.state === MeetingState.LEAVING}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <LogOut size={16} />
                        <span className="font-medium">Leave Meeting</span>
                    </button>
                )}
            </div>

            {/* Video Grid */}
            <div className="flex-1 p-6 overflow-auto">
                {isLoading(meetingState.state) ? (
                    <div className="h-full flex flex-col items-center justify-center">
                        <Loader2 size={48} className="text-emerald-500 animate-spin mb-4" />
                        <p className="text-white text-lg">
                            {meetingState.state === MeetingState.JOINING ? 'Joining meeting...' : 'Leaving meeting...'}
                        </p>
                        <p className="text-white/40 text-sm mt-2">
                            {meetingState.state === MeetingState.JOINING ? 'Establishing connection...' : 'Cleaning up...'}
                        </p>
                    </div>
                ) : meetingState.state === MeetingState.ERROR ? (
                    <div className="h-full flex flex-col items-center justify-center">
                        <div className="h-16 w-16 bg-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500 mb-6">
                            <AlertCircle size={32} />
                        </div>
                        <p className="text-white text-xl font-semibold mb-4">Unable to Join</p>
                        <p className="text-white/60 text-sm mb-6 max-w-md text-center">{meetingState.error}</p>
                        <button
                            onClick={onLeave}
                            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                        >
                            Close
                        </button>
                    </div>
                ) : isInMeeting(meetingState.state) ? (
                    <div className={`grid gap-4 h-full ${participantIds.length === 1 ? 'grid-cols-1' :
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

            {/* Controls */}
            {isInMeeting(meetingState.state) && (
                <ControlsBar
                    isMicMuted={!localAudioState}
                    isVideoOff={!localVideoState}
                    isScreenSharing={isSharingScreen}
                    onToggleMic={handleToggleMic}
                    onToggleVideo={handleToggleVideo}
                    onToggleScreenShare={handleToggleScreenShare}
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

/**
 * MeetingRoom - Main exported component with Provider
 * 
 * CRITICAL: This component handles call object creation
 * Backend calls happen here but NEVER block UI state
 */
export const MeetingRoom: React.FC<MeetingRoomProps> = ({ meetingId, roomUrl: initialRoomUrl, onLeave }) => {
    const [callObject, setCallObject] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const { showToast } = useToast();

    const endMeetingCalledRef = useRef(false);
    const [showOutcomePrompt, setShowOutcomePrompt] = useState(false);
    const [selectedOutcome, setSelectedOutcome] = useState<'successful' | 'follow_up' | 'no_show' | 'inconclusive'>('successful');
    const [outcomeNotes, setOutcomeNotes] = useState('');
    const [isSavingOutcome, setIsSavingOutcome] = useState(false);

    useEffect(() => {
        let mounted = true;
        let createdCall: any = null;

        const setupCall = async () => {
            try {
                setIsInitializing(true);

                // Check for existing instance
                const existingCall = DailyIframe.getCallInstance();
                if (existingCall) {
                    console.log('[MeetingRoom] Destroying existing Daily instance');
                    existingCall.destroy();
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // TASK 1: Get meeting details from backend
                // BUT: This is for room URL/token only, NOT for UI state
                const tokenRes = await apiService.getMeetingToken(meetingId);
                if (tokenRes.error) throw new Error(tokenRes.error.message);
                const { token, roomUrl: resolvedRoomUrl } = tokenRes.data;

                if (!mounted) return;

                // Create call object WITHOUT proxy - Daily handles routing
                console.log('[MeetingRoom] 🔧 Creating call object...');
                createdCall = DailyIframe.createCallObject();

                if (!mounted) {
                    createdCall?.destroy();
                    return;
                }

                setCallObject(createdCall);
                setIsInitializing(false);

                // Task 3C: START_MEETING when the Daily room loads.
                // We don't block joining on this call.
                apiService.startMeeting(meetingId, '').catch(err => {
                    console.error('[MeetingRoom] START_MEETING error:', err);
                });

                // Join the call
                // CRITICAL: We don't wait for this or set any state based on it
                // The 'joined-meeting' event is the ONLY source of truth
                console.log('[MeetingRoom] 🚀 Initiating join (non-blocking)...', { resolvedRoomUrl, hasToken: !!token });
                createdCall.join({ url: resolvedRoomUrl, token }).catch((err: any) => {
                    console.error('[MeetingRoom] Join error:', err);
                    // Error event will handle UI state
                });

            } catch (err: any) {
                console.error('[MeetingRoom] Setup error:', err);
                if (mounted) {
                    setError(friendlyError(err?.message || 'Failed to initialize meeting'));
                    setIsInitializing(false);
                }
                if (createdCall) {
                    try {
                        createdCall.destroy();
                    } catch (e) {
                        console.error('[MeetingRoom] Error destroying call on error:', e);
                    }
                }
            }
        };

        setupCall();

        return () => {
            mounted = false;
            if (createdCall) {
                try {
                    console.log('[MeetingRoom] 🧹 Cleanup: destroying call object');
                    createdCall.destroy();
                } catch (e) {
                    console.error('[MeetingRoom] Error during cleanup:', e);
                }
            }
        };
    }, [meetingId]);

    const handleMeetingEnded = useCallback(async () => {
        if (endMeetingCalledRef.current) return;
        endMeetingCalledRef.current = true;

        // Task 3C: END_MEETING when the Daily room closes.
        const res = await apiService.stopMeeting(meetingId);
        if (res?.error) {
            console.error('[MeetingRoom] END_MEETING error:', res.error);
            // Still show the outcome prompt; user can decide what to record.
        }

        setShowOutcomePrompt(true);
    }, [meetingId]);

    const recordOutcome = useCallback(async () => {
        if (isSavingOutcome) return;
        setIsSavingOutcome(true);
        try {
            const { error: rpcError } = await supabase.rpc('record_meeting_outcome', {
                p_meeting_id: meetingId,
                p_outcome: selectedOutcome,
                p_outcome_notes: outcomeNotes.trim() ? outcomeNotes.trim() : null
            });
            if (rpcError) throw rpcError;
            setShowOutcomePrompt(false);
            setOutcomeNotes('');
            setSelectedOutcome('successful');
            onLeave();
        } catch (err: any) {
            console.error('[MeetingRoom] record_meeting_outcome failed:', err);
            showToast(friendlyError(err?.message), 'error');
        } finally {
            setIsSavingOutcome(false);
        }
    }, [endMeetingCalledRef, isSavingOutcome, meetingId, outcomeNotes, onLeave, selectedOutcome, showToast]);

    // Error state
    if (error) {
        return (
            <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
                <div className="bg-white/10 p-8 rounded-3xl border border-white/20 text-center max-w-md">
                    <div className="h-16 w-16 bg-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500 mx-auto mb-6">
                        <AlertCircle size={32} />
                    </div>
                    <p className="text-white text-xl font-semibold mb-4">Unable to Initialize</p>
                    <p className="text-white/60 text-sm mb-6">{error}</p>
                    <button
                        onClick={onLeave}
                        className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    // Initializing state (fetching room URL/token)
    if (isInitializing || !callObject) {
        return (
            <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={48} className="text-emerald-500 animate-spin mx-auto mb-4" />
                    <p className="text-white text-lg">Initializing meeting...</p>
                </div>
            </div>
        );
    }

    // Render with DailyProvider
    return (
        <>
            <DailyProvider callObject={callObject}>
                <MeetingRoomContent
                    meetingId={meetingId}
                    roomUrl={initialRoomUrl}
                    onLeave={onLeave}
                    onMeetingEnded={handleMeetingEnded}
                />
            </DailyProvider>

            {showOutcomePrompt && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="max-w-md w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                                How did the meeting go?
                            </h2>
                            <button
                                className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10"
                                onClick={() => { setShowOutcomePrompt(false); onLeave(); }}
                                aria-label="Close"
                                title="Close"
                                disabled={isSavingOutcome}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4">
                            {[
                                { id: 'successful', label: 'Successful' },
                                { id: 'follow_up', label: 'Follow-up Needed' },
                                { id: 'no_show', label: 'No Show' },
                                { id: 'inconclusive', label: 'Inconclusive' }
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => setSelectedOutcome(opt.id as any)}
                                    disabled={isSavingOutcome}
                                    className={`px-3 py-2 rounded-xl border text-sm transition-all ${
                                        selectedOutcome === opt.id
                                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                                            : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        <div className="mt-4">
                            <label className="block text-xs font-medium text-zinc-500 mb-1">
                                Notes (optional)
                            </label>
                            <input
                                value={outcomeNotes}
                                onChange={(e) => setOutcomeNotes(e.target.value)}
                                placeholder="______________________________"
                                disabled={isSavingOutcome}
                                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                        </div>

                        <div className="flex gap-3 mt-5">
                            <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={() => { setShowOutcomePrompt(false); setOutcomeNotes(''); onLeave(); }}
                                disabled={isSavingOutcome}
                            >
                                Skip
                            </Button>
                            <Button
                                variant="primary"
                                className="flex-1"
                                onClick={recordOutcome}
                                disabled={isSavingOutcome}
                            >
                                {isSavingOutcome ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
