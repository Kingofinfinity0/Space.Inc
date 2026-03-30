import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff } from 'lucide-react';

interface ControlsBarProps {
    isMicMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing: boolean;
    onToggleMic: () => void;
    onToggleVideo: () => void;
    onToggleScreenShare: () => void;
    onLeave: () => void;
}

/**
 * ControlsBar Component
 * 
 * EXPLANATION:
 * This is the bottom control bar where users can mute/unmute, turn camera on/off, etc.
 * 
 * HOW IT WORKS:
 * - We use the Daily SDK's hooks (e.g., `useLocalSessionId`, `useAudioTrack`) to get the state.
 * - When a button is clicked, we call Daily SDK methods (e.g., `callObject.setLocalAudio(false)`).
 * - The parent component (MeetingRoom) will handle these callbacks using the `useDaily` hook.
 * 
 * DESIGN:
 * - Clean, Apple-style UI with rounded buttons and smooth transitions.
 * - Active states use color (red for off, green for on).
 */
export const ControlsBar: React.FC<ControlsBarProps> = ({
    isMicMuted,
    isVideoOff,
    isScreenSharing,
    onToggleMic,
    onToggleVideo,
    onToggleScreenShare,
    onLeave
}) => {
    return (
        <div className="flex items-center justify-center gap-3 px-6 py-4 bg-white/5 backdrop-blur-xl border-t border-white/10">
            {/* Microphone Toggle */}
            <button
                onClick={onToggleMic}
                className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${isMicMuted
                        ? 'bg-rose-500 hover:bg-rose-600 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                title={isMicMuted ? 'Unmute' : 'Mute'}
            >
                {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {/* Camera Toggle */}
            <button
                onClick={onToggleVideo}
                className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${isVideoOff
                        ? 'bg-rose-500 hover:bg-rose-600 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
                {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
            </button>

            {/* Screen Share Toggle */}
            <button
                onClick={onToggleScreenShare}
                className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${isScreenSharing
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
            >
                {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
            </button>

            {/* Divider */}
            <div className="h-8 w-px bg-white/10 mx-2" />

            {/* Leave Call */}
            <button
                onClick={onLeave}
                className="h-12 px-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-bold flex items-center gap-2 transition-all shadow-lg shadow-rose-500/20"
            >
                <PhoneOff size={20} />
                Leave
            </button>
        </div>
    );
};
