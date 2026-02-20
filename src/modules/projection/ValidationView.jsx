import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '../core/store';
import YouTubePlayer from '../player/YouTubePlayer';
import WaitingOverlay from '../player/WaitingOverlay';
import MarqueeOverlay from './MarqueeOverlay';
import BeatChangeOverlay from './BeatChangeOverlay';
import { usePlayerSync } from '../player/usePlayerSync';
import { Maximize, Minimize } from 'lucide-react';

const BG_VIDEO_PATH = '/bg.mp4';

class PlayerErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorKey: 0 };
        this._recoverTimer = null;
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch() {
        // Auto-recover from crash
        if (this._recoverTimer) clearTimeout(this._recoverTimer);
        this._recoverTimer = setTimeout(() => this.setState({ hasError: false }), 500);
    }

    componentDidUpdate(prevProps) {
        // Auto-recover when song changes
        if (prevProps.videoId !== this.props.videoId && this.state.hasError) {
            this.setState({ hasError: false });
        }
    }

    componentWillUnmount() {
        if (this._recoverTimer) clearTimeout(this._recoverTimer);
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
    const unmuteTimerRef = useRef(null);
    useEffect(() => {
        const timer = setTimeout(() => { bootRef.current = false; }, 15000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!isPlaying || waitingForGuest) return;

        const checkInterval = bootRef.current ? 2000 : 3000;

        const interval = setInterval(() => {
            const state = getPlayerState();

            if (state === 1) {
                unmutePlayer();
            } else if (state === -1 || state === 5) {
                // Stuck — kickstart with mute trick (skip state 2 = user pause)
                mutePlayer();
                playPlayer();
                if (unmuteTimerRef.current) clearTimeout(unmuteTimerRef.current);
                unmuteTimerRef.current = setTimeout(() => unmutePlayer(), 500);
            }
        }, checkInterval);
        return () => {
            clearInterval(interval);
            if (unmuteTimerRef.current) clearTimeout(unmuteTimerRef.current);
        };
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

    // Media engagement: deferred until first user gesture (click) to avoid AudioContext autoplay block
    const [mediaReady, setMediaReady] = useState(false);
    const [userActivated, setUserActivated] = useState(false);
    const audioCtxRef = useRef(null);

    // Defer bg video mount to avoid GPU overload at startup
    useEffect(() => {
        const timer = setTimeout(() => setMediaReady(true), 2000);
        return () => clearTimeout(timer);
    }, []);

    // AudioContext engagement — only after user gesture
    useEffect(() => {
        if (!userActivated) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;

        // Resume if suspended (shouldn't be after user gesture, but safety net)
        if (audioCtx.state === 'suspended') audioCtx.resume();

        // Play a near-silent tone (gain = 0.001 ≈ inaudible) for 0.5s to register media engagement
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 1;
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);

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
            audioCtxRef.current = null;
        };
    }, [userActivated]);

    const handleSongEnded = useCallback(() => {
        sendMessage('SONG_ENDED');
    }, [sendMessage]);

    useEffect(() => {
        const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFSChange);
        return () => document.removeEventListener('fullscreenchange', onFSChange);
    }, []);

    // Fullscreen: handled by user click (handleStart) or Automatic Fullscreen extension.
    // Do NOT call requestFullscreen() on a timer — it always fails without user gesture.

    // Auto-hide controls after 3s, show on mouse move (throttled)
    const resetHideTimer = useCallback(() => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }, []);

    const throttledMouseMove = useRef(null);
    const throttleTimerRef = useRef(null);
    useEffect(() => {
        const onMove = () => {
            if (throttledMouseMove.current) return;
            throttledMouseMove.current = true;
            setControlsVisible(true);
            resetHideTimer();
            if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
            throttleTimerRef.current = setTimeout(() => { throttledMouseMove.current = false; }, 500);
        };
        resetHideTimer();
        window.addEventListener('mousemove', onMove);
        return () => {
            window.removeEventListener('mousemove', onMove);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
        };
    }, [resetHideTimer]);

    const handleStart = useCallback(() => {
        // User gesture unlocks AudioContext + fullscreen
        setUserActivated(true);
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
        }
        window.__unlocked = true;
        if (window.opener) {
            window.opener.postMessage({ type: 'tv-ready' }, '*');
        }
    }, []);

    return (
        <div
            className="h-screen w-screen bg-black overflow-hidden flex items-center justify-center relative cursor-pointer"
            onClick={handleStart}
        >
            {/* Watchdog: Force Playback if Stuck */}
            <Watchdog />

            {/* Player Container - Always mounted to prevent fullscreen exit */}
            <div className={`w-full h-full relative z-10 transition-opacity duration-500 ${currentSong && currentSong.videoId && (isPlaying || currentSong.changingBeat) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {currentSong && currentSong.videoId ? (
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
                        <BeatChangeOverlay />
                    </div>
                ) : <div className="w-full h-full" />}
            </div>

            {/* Background Video — deferred mount to avoid GPU overload at startup */}
            <div className={`absolute inset-0 z-0 overflow-hidden transition-opacity duration-300 ${currentSong && isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                {mediaReady && (
                    <video
                        src={BG_VIDEO_PATH}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                    />
                )}
            </div>
            {/* Waiting Slot Overlay — invite guest to choose song */}
            {currentSong && currentSong.status === 'waiting' && !isPlaying && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    <div className="relative px-20 py-14 text-center max-w-[85vw]">
                        {/* Solid dark card */}
                        <div className="absolute inset-0 bg-black rounded-[2rem] border-2 border-indigo-400 shadow-[0_0_80px_rgba(99,102,241,0.3)]" />

                        {/* Content */}
                        <div className="relative z-10">
                            {/* Top accent line */}
                            <div className="mx-auto w-24 h-1 bg-indigo-500 rounded-full mb-8" />

                            <p className="text-indigo-300 font-bold text-2xl uppercase tracking-[0.3em] mb-4">Xin mời</p>

                            <h2 className="text-white font-black text-7xl uppercase tracking-tight mb-6 drop-shadow-lg">
                                {currentSong.addedBy || 'Quý Khách'}
                            </h2>

                            <p className="text-indigo-400 font-extrabold text-4xl uppercase tracking-widest">
                                Lên chọn bài hát
                            </p>

                            {/* Bottom accent line */}
                            <div className="mx-auto w-24 h-1 bg-indigo-500 rounded-full mt-8" />
                        </div>
                    </div>
                </div>
            )}

            <WaitingOverlay onPauseToggle={() => {
                const store = useAppStore.getState();
                store.setCountdownPaused(!store.countdownPaused);
            }} />

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
