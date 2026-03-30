import React from 'react';
import { Mic, MicOff, User } from 'lucide-react';

interface VideoTileProps {
    videoTrack: MediaStreamTrack | null;
    audioTrack: MediaStreamTrack | null;
    isLocal: boolean;
    isAudioOff: boolean;
    userName: string;
    sessionId: string;
}

/**
 * VideoTile Component
 * 
 * EXPLANATION:
 * This component is responsible for rendering a single participant's video.
 * Instead of using Daily's Prebuilt UI (which loads in an iframe), we are manually
 * managing the video elements using the raw MediaStreamTrack objects.
 * 
 * HOW IT WORKS:
 * - We receive a "videoTrack" from the Daily SDK (this is the low-level WebRTC stream).
 * - We attach this track to an HTML <video> element using a MediaStream.
 * - This is exactly what Daily's Prebuilt UI does internally, but now WE control it.
 * - Benefits: All network requests are now in OUR code, routed through the proxy.
 */
export const VideoTile: React.FC<VideoTileProps> = ({
    videoTrack,
    audioTrack,
    isLocal,
    isAudioOff,
    userName,
    sessionId
}) => {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const audioRef = React.useRef<HTMLAudioElement>(null);

    // Attach video track to the <video> element
    React.useEffect(() => {
        if (!videoRef.current || !videoTrack) return;

        const mediaStream = new MediaStream([videoTrack]);
        videoRef.current.srcObject = mediaStream;
    }, [videoTrack]);

    // Attach audio track to the <audio> element (if remote)
    React.useEffect(() => {
        if (!audioRef.current || !audioTrack || isLocal) return;

        const mediaStream = new MediaStream([audioTrack]);
        audioRef.current.srcObject = mediaStream;
    }, [audioTrack, isLocal]);

    const displayName = isLocal ? 'You' : userName || 'Guest';

    return (
        <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 aspect-video">
            {/* Video Element */}
            {videoTrack ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal} // Mute local to prevent echo
                    className="w-full h-full object-cover"
                />
            ) : (
                // Show avatar if no video
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                    <div className="h-20 w-20 rounded-full bg-white/10 flex items-center justify-center text-white">
                        <User size={40} />
                    </div>
                </div>
            )}

            {/* Audio Element (hidden, for remote participants only) */}
            {!isLocal && audioTrack && (
                <audio ref={audioRef} autoPlay />
            )}

            {/* Name Label */}
            <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full text-white text-sm font-medium flex items-center gap-2">
                {isAudioOff && <MicOff size={14} className="text-rose-400" />}
                {!isAudioOff && <Mic size={14} className="text-emerald-400" />}
                {displayName}
            </div>

            {/* Local Indicator */}
            {isLocal && (
                <div className="absolute top-3 right-3 px-2 py-1 bg-emerald-500/80 rounded-full text-white text-xs font-bold">
                    YOU
                </div>
            )}
        </div>
    );
};
