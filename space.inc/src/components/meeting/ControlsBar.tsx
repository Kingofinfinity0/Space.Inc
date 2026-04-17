import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff, Pencil } from 'lucide-react';

interface ControlsBarProps {
    isMicMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing: boolean;
    isNotepadOpen: boolean;
    onToggleMic: () => void;
    onToggleVideo: () => void;
    onToggleScreenShare: () => void;
    onToggleNotepad: () => void;
    onLeave: () => void;
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
    isMicMuted,
    isVideoOff,
    isScreenSharing,
    isNotepadOpen,
    onToggleMic,
    onToggleVideo,
    onToggleScreenShare,
    onToggleNotepad,
    onLeave
}) => {
    return (
        <div className="flex items-center justify-center gap-4 border-t border-[#E5E5E5] bg-white px-8 py-6 relative z-[120]">
            {/* Microphone Toggle */}
            <button
                onClick={onToggleMic}
                className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${isMicMuted
                        ? 'bg-[#F7F7F8] border border-[#E5E5E5] text-[#0D0D0D]'
                        : 'bg-white border border-[#E5E5E5] text-[#6E6E80] hover:text-[#0D0D0D]'
                    }`}
                title={isMicMuted ? 'Unmute Personnel' : 'Mute Personnel'}
            >
                {isMicMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            {/* Camera Toggle */}
            <button
                onClick={onToggleVideo}
                className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${isVideoOff
                        ? 'bg-[#F7F7F8] border border-[#E5E5E5] text-[#0D0D0D]'
                        : 'bg-white border border-[#E5E5E5] text-[#6E6E80] hover:text-[#0D0D0D]'
                    }`}
                title={isVideoOff ? 'Enable Vision' : 'Disable Vision'}
            >
                {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>

            {/* Screen Share Toggle */}
            <button
                onClick={onToggleScreenShare}
                className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${isScreenSharing
                        ? 'bg-[#F7F7F8] border border-[#E5E5E5] text-[#0D0D0D]'
                        : 'bg-white border border-[#E5E5E5] text-[#6E6E80] hover:text-[#0D0D0D]'
                    }`}
                title={isScreenSharing ? 'Stop Transmission' : 'Broadcast Screen'}
            >
                {isScreenSharing ? <MonitorOff size={22} /> : <Monitor size={22} />}
            </button>

            {/* Notepad Toggle */}
            <button
                onClick={onToggleNotepad}
                className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${isNotepadOpen
                        ? 'bg-[#F7F7F8] border border-[#E5E5E5] text-[#0D0D0D]'
                        : 'bg-white border border-[#E5E5E5] text-[#6E6E80] hover:text-[#0D0D0D]'
                    }`}
                title={isNotepadOpen ? 'Secure Intel' : 'Capture Intel'}
            >
                <Pencil size={22} />
            </button>

            {/* Divider */}
            <div className="h-10 w-px bg-[#E5E5E5] mx-2" />

            {/* Leave Call */}
            <button
                onClick={onLeave}
                className="h-14 px-8 rounded-2xl bg-black hover:bg-[#1A1A1A] text-white font-semibold text-[11px] uppercase tracking-[0.2em] flex items-center gap-3 transition-all"
            >
                <PhoneOff size={18} />
                Disconnect
            </button>
        </div>
    );
};
