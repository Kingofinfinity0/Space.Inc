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

            // Record exit in DB for participants
            apiService.recordParticipantExit(meetingId).catch(err => {
                console.warn('[MeetingRoom] Failed to record participant exit:', err);
            });

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

    // Handle staff ending meeting
    const handleEndMeeting = async () => {
        setIsEnding(true);
        try {
            await apiService.endMeetingByStaff(meetingId, endOutcome, endNotes);
            setShowEndConfirm(false);
            // Leave Daily room after backend confirms
            await callObject?.leave();
            await callObject?.destroy();
            onLeave();
        } catch (err) {
            console.error('[MeetingRoom] endMeetingByStaff failed:', err);
            setIsEnding(false);
        }
    };

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
                    <div className="flex items-center gap-2">
                        {/* Staff-only: End Meeting for everyone */}
                        {(userRole === 'owner' || userRole === 'admin' || userRole === 'staff') && (
                            <button
                                onClick={() => setShowEndConfirm(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-rose-600/30 hover:bg-rose-600/50 text-rose-400 rounded-xl border border-rose-500/30 transition-all text-sm font-semibold"
                            >
                                <Square size={16} />
                                End Meeting
                            </button>
                        )}
                        {/* Everyone: Leave (just you leave) */}
                        <button
                            onClick={handleLeave}
                            disabled={meetingState.state === MeetingState.LEAVING}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <LogOut size={16} />
                            <span className="font-medium">Leave</span>
                        </button>
                    </div>
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
                    onToggleNotepad={() => setIsNotepadOpen(!isNotepadOpen)}
                    isNotepadOpen={isNotepadOpen}
                />
            )}

            {/* End Meeting Confirmation Modal */}
            {showEndConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="max-w-md w-full bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-1">End meeting for everyone?</h2>
                        <p className="text-zinc-400 text-sm mb-6">
                            This marks the meeting as complete and notifies all participants.
                        </p>
                        
                        {/* Outcome selector */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {[
                                { id: 'successful', label: '✅ Successful' },
                                { id: 'follow_up_needed', label: '🔄 Follow-up' },
                                { id: 'no_show', label: '👻 No Show' },
                                { id: 'inconclusive', label: '❓ Inconclusive' },
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setEndOutcome(opt.id)}
                                    className={`px-3 py-2 rounded-xl border text-sm transition-all ${
                                        endOutcome === opt.id
                                            ? 'bg-emerald-500/20 border-emerald-500 text-white'
                                            : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:border-zinc-400'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        
                        {/* Notes */}
                        <input
                            value={endNotes}
                            onChange={e => setEndNotes(e.target.value)}
                            placeholder="Notes (optional)"
                            disabled={isEnding}
                            className="w-full bg-zinc-800 border border-zinc-600 rounded-xl px-4 py-2 text-sm text-white mb-6 outline-none focus:border-emerald-500"
                        />
                        
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowEndConfirm(false)}
                                disabled={isEnding}
                                className="flex-1 py-2 rounded-xl bg-zinc-700 text-zinc-300 text-sm hover:bg-zinc-600 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEndMeeting}
                                disabled={isEnding}
                                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-all disabled:opacity-50"
                            >
                                {isEnding ? 'Ending...' : 'End for Everyone'}
                            </button>
                        </div>
                    </div>
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
        }
    }, [meetingId]);

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
