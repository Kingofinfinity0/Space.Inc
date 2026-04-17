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
        <div className="relative overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white aspect-video">
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
                <div className="w-full h-full flex items-center justify-center bg-[#F7F7F8]">
                    <div className="h-20 w-20 rounded-[8px] border border-[#E5E5E5] bg-white flex items-center justify-center text-[#0D0D0D]">
                        <User size={40} />
                    </div>
                </div>
            )}

            {/* Audio Element (hidden, for remote participants only) */}
            {!isLocal && audioTrack && (
                <audio ref={audioRef} autoPlay />
            )}

            {/* Name Label */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-3 py-1.5 text-sm font-medium text-[#0D0D0D]">
                {isAudioOff && <MicOff size={14} className="text-[#6E6E80]" />}
                {!isAudioOff && <Mic size={14} className="text-[#0D0D0D]" />}
                {displayName}
            </div>

            {/* Local Indicator */}
            {isLocal && (
                <div className="absolute top-3 right-3 rounded-full border border-[#E5E5E5] bg-[#F7F7F8] px-2 py-1 text-xs font-semibold text-[#0D0D0D]">
                    YOU
                </div>
            )}
        </div>
    );
};
