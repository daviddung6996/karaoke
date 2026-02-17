import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '../core/store';
import YouTubePlayer from '../player/YouTubePlayer';
import WaitingOverlay from '../player/WaitingOverlay';
import MarqueeOverlay from './MarqueeOverlay';
import { usePlayerSync } from '../player/usePlayerSync';
import { Maximize, Minimize } from 'lucide-react';

import bgVideo from '../../assets/bg.mp4';

class PlayerErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorKey: 0 };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error) {
        console.warn('[TV] Player crashed, recovering...', error.message);
        setTimeout(() => this.setState({ hasError: false }), 500);
    }

    componentDidUpdate(prevProps) {
        // Auto-recover when song changes
        if (prevProps.videoId !== this.props.videoId && this.state.hasError) {
            this.setState({ hasError: false });
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="w-full h-full bg-black flex items-center justify-center">
                    <div className="text-white/50 text-xl">Đang tải...</div>
                </div>
            );
        }
        return this.props.children;
    }
}

import { getPlayerState, playPlayer, mutePlayer, unmutePlayer } from '../player/playerRegistry';

const Watchdog = React.memo(() => {
    const isPlaying = useAppStore((s) => s.isPlaying);
    const waitingForGuest = useAppStore((s) => s.waitingForGuest);

    // Aggressive initial boot: faster checks for first 15s to handle strict browsers like Brave
    const bootRef = useRef(true);
    useEffect(() => {
        const timer = setTimeout(() => { bootRef.current = false; }, 15000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!isPlaying || waitingForGuest) return;

        const checkInterval = bootRef.current ? 1500 : 3000;

        const interval = setInterval(() => {
            const state = getPlayerState();

            if (state === 1) {
                unmutePlayer();
            } else if (state === -1 || state === 5 || state === 2) {
                // Stuck or paused unexpectedly — kickstart with mute trick
                mutePlayer();
                playPlayer();
                setTimeout(() => unmutePlayer(), 500);
            }
        }, checkInterval);
        return () => clearInterval(interval);
    }, [isPlaying, waitingForGuest]);

    return null;
});

const ValidationView = () => {
    const { sendMessage } = usePlayerSync('projection');
    const currentSong = useAppStore((s) => s.currentSong);
    const isPlaying = useAppStore((s) => s.isPlaying);
    const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
    const [controlsVisible, setControlsVisible] = useState(true);
    const hideTimerRef = useRef(null);

    const toggleFullscreen = useCallback(() => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        } else {
            document.documentElement.requestFullscreen().catch(() => { });
        }
    }, []);

    // Media engagement: play near-silent audio to build browser trust for autoplay
    // Brave requires higher engagement score than Chrome — a real (quiet) tone helps
    useEffect(() => {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const audioCtx = new AudioContext();

        // Play a near-silent tone (gain = 0.001 ≈ inaudible) for 0.5s to register media engagement
        const kickstartEngagement = () => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 1; // 1Hz — completely inaudible
            gain.gain.value = 0.001; // Near-zero volume
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        };
        kickstartEngagement();

        // Keep-alive oscillator (fully silent) to prevent tab throttling
        const keepAliveOsc = audioCtx.createOscillator();
        const keepAliveGain = audioCtx.createGain();
        keepAliveOsc.frequency.value = 440;
        keepAliveGain.gain.value = 0;
        keepAliveOsc.connect(keepAliveGain);
        keepAliveGain.connect(audioCtx.destination);
        keepAliveOsc.start();

        return () => {
            keepAliveOsc.stop();
            audioCtx.close();
        };
    }, []);

    const handleSongEnded = useCallback(() => {
        sendMessage('SONG_ENDED');
    }, [sendMessage]);

    useEffect(() => {
        const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFSChange);
        return () => document.removeEventListener('fullscreenchange', onFSChange);
    }, []);

    // Auto-fullscreen ONLY if on a secondary screen (prevents fullscreening laptop)
    useEffect(() => {
        const trySmartFullscreen = async () => {
            // Check if we're on a secondary screen
            if ('getScreenDetails' in window) {
                try {
                    const details = await window.getScreenDetails();
                    const current = details.currentScreen;
                    const isSecondary = details.screens.length > 1 && current !== details.screens.find(s => s.isPrimary);

                    if (isSecondary && !document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(() => { });
                    }
                } catch {
                    // Screen detection not available
                }
            }
        };

        // Initial check
        setTimeout(trySmartFullscreen, 1000);

        // Re-check on song change (safety net)
        if (currentSong?.videoId) {
            setTimeout(trySmartFullscreen, 500);
        }
    }, [currentSong?.videoId]);

    // Auto-hide controls after 3s, show on mouse move (throttled)
    const resetHideTimer = useCallback(() => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }, []);

    const throttledMouseMove = useRef(null);
    useEffect(() => {
        const onMove = () => {
            if (throttledMouseMove.current) return;
            throttledMouseMove.current = true;
            setControlsVisible(true);
            resetHideTimer();
            setTimeout(() => { throttledMouseMove.current = false; }, 500);
        };
        resetHideTimer();
        window.addEventListener('mousemove', onMove);
        return () => {
            window.removeEventListener('mousemove', onMove);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, [resetHideTimer]);

    return (
        <div className="h-screen w-screen bg-black overflow-hidden flex items-center justify-center relative">
            {/* Watchdog: Force Playback if Stuck */}
            <Watchdog />

            {/* Player Container - Always mounted to prevent fullscreen exit */}
            <div className={`w-full h-full relative z-10 transition-opacity duration-500 ${currentSong && isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {currentSong ? (
                    <div className="w-full h-full relative">
                        <PlayerErrorBoundary videoId={currentSong.videoId}>
                            <YouTubePlayer
                                className="w-full h-full"
                                autoUnmute={true}
                                quality="hd1080"
                                controls={false}
                                passive={true}
                                onEnded={handleSongEnded}
                            />
                        </PlayerErrorBoundary>
                        {/* Block clicks */}
                        <div className="absolute inset-0 z-10" />
                        <MarqueeOverlay />
                    </div>
                ) : <div className="w-full h-full" />}
            </div>

            {/* Background Video — only mounted when visible to save GPU */}
            {(!currentSong || !isPlaying) && (
                <div className="absolute inset-0 z-0 overflow-hidden">
                    <video
                        src={bgVideo}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                    />
                </div>
            )}
            <WaitingOverlay />

            {/* Fullscreen toggle — auto-hide after 3s */}
            <button
                onClick={toggleFullscreen}
                className={`absolute top-4 right-4 z-50 p-3 bg-black/50 hover:bg-black/80 text-white rounded-xl transition-all duration-500 cursor-pointer active:scale-90 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            >
                {isFullscreen ? <Minimize size={28} /> : <Maximize size={28} />}
            </button>
        </div>
    );
};

export default ValidationView;
