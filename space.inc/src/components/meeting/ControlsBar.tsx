import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff, NotebookPen } from 'lucide-react';

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
        <div className="flex items-center justify-center gap-4 px-8 py-6 bg-zinc-950/80 backdrop-blur-3xl border-t border-white/5 relative z-[120]">
            {/* Microphone Toggle */}
            <button
                onClick={onToggleMic}
                className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${isMicMuted
                        ? 'bg-rose-600/10 border border-rose-500/30 text-rose-500 shadow-lg shadow-rose-500/5'
                        : 'bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white'
                    }`}
                title={isMicMuted ? 'Unmute Personnel' : 'Mute Personnel'}
            >
                {isMicMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            {/* Camera Toggle */}
            <button
                onClick={onToggleVideo}
                className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${isVideoOff
                        ? 'bg-rose-600/10 border border-rose-500/30 text-rose-500 shadow-lg shadow-rose-500/5'
                        : 'bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white'
                    }`}
                title={isVideoOff ? 'Enable Vision' : 'Disable Vision'}
            >
                {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>

            {/* Screen Share Toggle */}
            <button
                onClick={onToggleScreenShare}
                className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${isScreenSharing
                        ? 'bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 shadow-lg shadow-emerald-500/5'
                        : 'bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white'
                    }`}
                title={isScreenSharing ? 'Stop Transmission' : 'Broadcast Screen'}
            >
                {isScreenSharing ? <MonitorOff size={22} /> : <Monitor size={22} />}
            </button>

            {/* Notepad Toggle */}
            <button
                onClick={onToggleNotepad}
                className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${isNotepadOpen
                        ? 'bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 shadow-lg shadow-emerald-500/5'
                        : 'bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white'
                    }`}
                title={isNotepadOpen ? 'Secure Intel' : 'Capture Intel'}
            >
                <NotebookPen size={22} />
            </button>

            {/* Divider */}
            <div className="h-10 w-px bg-white/5 mx-2" />

            {/* Leave Call */}
            <button
                onClick={onLeave}
                className="h-14 px-8 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-3 transition-all shadow-2xl shadow-rose-600/20"
            >
                <PhoneOff size={18} />
                Disconnect
            </button>
        </div>
    );
};
