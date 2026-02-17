import React, { useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import { useAppStore } from '../core/store';
import { registerPlayer, unregisterPlayer, playPlayer, pausePlayer, isPlayerReady } from './playerRegistry';

const YT_HIDE_STYLE = (
    <style>{`
        .ytp-endscreen-container { display: none !important; }
        .ytp-suggestions { display: none !important; }
    `}</style>
);

const YouTubePlayer = ({ className, onReady, onStateChange, onEnded, muted = false, controls = true, quality = null, autoUnmute = false, passive = false }) => {
    const currentSong = useAppStore((s) => s.currentSong);
    const isPlaying = useAppStore((s) => s.isPlaying);
    const setIsPlaying = useAppStore((s) => s.setIsPlaying);
    const restartTrigger = useAppStore((s) => s.restartTrigger);
    const waitingForGuest = useAppStore((s) => s.waitingForGuest);
    const playerRef = useRef(null);
    const justLoadedRef = useRef(false);
    const containerRef = useRef(null);

    const opts = React.useMemo(() => ({
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: autoUnmute ? 1 : 0,
            controls: controls ? 1 : 0,
            mute: autoUnmute ? 1 : (muted ? 1 : 0), // TV: muted autoplay (no audio leak). Host: based on prop.
            disablekb: controls ? 0 : 1,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            rel: 0,
            origin: window.location.origin,
        },
    }), [controls, muted, autoUnmute]);

    // Fallback: Unmute on any click (if browser blocked programmatic unmute)
    useEffect(() => {
        if (!autoUnmute) return;

        const handleGlobalClick = () => {
            if (playerRef.current) {
                playerRef.current.unMute();
            }
        };

        document.addEventListener('click', handleGlobalClick, { once: true });
        return () => document.removeEventListener('click', handleGlobalClick);
    }, [autoUnmute]);

    const _onReady = (event) => {
        playerRef.current = event.target;
        registerPlayer(event.target);

        const iframe = event.target.getIframe();
        if (iframe) {
            iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";
        }

        const enforceQuality = () => {
            if (quality && event.target.setPlaybackQuality) {
                event.target.setPlaybackQuality(quality);
            }
        };

        enforceQuality();

        // Periodic enforcement (every 5s) to fight YouTube auto-quality
        if (window.ytQualityInterval) clearInterval(window.ytQualityInterval);
        window.ytQualityInterval = setInterval(enforceQuality, 15000);

        justLoadedRef.current = true;
        setTimeout(() => { justLoadedRef.current = false; }, 1500);

        // Initial Load Logic
        const store = useAppStore.getState();
        const shouldPlay = store.isPlaying && !store.waitingForGuest;

        if (passive) {
            // TV mode: video starts muted via autoplay:1 + mute:1
            // Only unmute when Host sends PLAY (store.isPlaying=true)
            if (shouldPlay) {
                event.target.unMute();
            } else {
                event.target.mute();
            }
        } else if (shouldPlay) {
            event.target.playVideo();
        } else {
            event.target.mute();
            event.target.pauseVideo();
        }

        if (onReady) onReady(event);
    };

    // Unregister on unmount AND on videoId change (before new player mounts)
    useEffect(() => {
        return () => {
            if (window.ytQualityInterval) clearInterval(window.ytQualityInterval);
            if (!currentSong?.videoId) { // Only unregister if truly unmounting/clearing
                unregisterPlayer();
                playerRef.current = null;
            }
        };
    }, [currentSong?.videoId, autoUnmute, quality]);

    const _onStateChange = (event) => {
        const store = useAppStore.getState();

        if (quality && (event.data === 1 || event.data === 3)) {
            event.target.setPlaybackQuality(quality);
        }

        // STRICT: TV must NEVER play unmuted unless Host explicitly sent PLAY
        // This covers waitingForGuest AND the gap before it's set (during TTS)
        if (passive && event.data === 1 && (!store.isPlaying || store.waitingForGuest)) {
            event.target.mute();
            // Don't setVolume(0) here — mute() is sufficient to silence audio.
            // Setting volume to 0 causes unmutePlayer() to reset to 100, losing user's volume.
            event.target.pauseVideo();
            return;
        }

        // Host: block auto-play during waitingForGuest 
        if (!passive && store.waitingForGuest && event.data === 1) {
            event.target.pauseVideo();
            return;
        }

        // During initial load, block YouTube auto-play if store says paused (Host only)
        if (justLoadedRef.current && event.data === 1 && !store.isPlaying && !passive) {
            event.target.pauseVideo();
            return;
        }

        if (onStateChange) onStateChange(event);

        if (passive) {
            // TV mode: unmute/mute based on store state
            // Volume is controlled by usePlayerSync, do NOT reset it here
            if (event.data === 1) {
                if (store.isPlaying && !store.waitingForGuest) {
                    event.target.unMute();
                } else {
                    event.target.mute();
                }
            }
        } else {
            if (event.data === 1) setIsPlaying(true);
            if (event.data === 2) setIsPlaying(false);
        }
        if (event.data === 0 && onEnded) onEnded();
    };

    // Sync logic: When store state changes, update player
    // STRICT: Also block play while waitingForGuest
    useEffect(() => {
        if (!isPlayerReady()) return;
        // TV (passive) mode: usePlayerSync directly controls player. Skip this effect.
        if (passive) return;

        if (isPlaying && !waitingForGuest) {
            if (autoUnmute) {
                // Mute → Play → Unmute trick for autoplay browsers
                if (playerRef.current) {
                    playerRef.current.mute();
                    playerRef.current.playVideo();
                    setTimeout(() => {
                        if (playerRef.current) {
                            playerRef.current.unMute();
                            playerRef.current.setVolume(100);
                        }
                    }, 500);
                }
            } else {
                playPlayer();
            }
        } else {
            pausePlayer();
        }
    }, [isPlaying, waitingForGuest, autoUnmute]);

    // Restart logic
    useEffect(() => {
        if (restartTrigger > 0 && isPlayerReady()) {
            playerRef.current.seekTo(0, true);
            setTimeout(() => playPlayer(), 100);
        }
    }, [restartTrigger]);

    if (!currentSong) return <div className="bg-black text-white flex items-center justify-center h-full w-full">Chưa phát bài nào</div>;

    return (
        <div ref={containerRef} className={className} style={{ position: 'relative', overflow: 'hidden' }}>
            {YT_HIDE_STYLE}
            <YouTube
                videoId={currentSong.videoId}
                opts={opts}
                onReady={_onReady}
                onStateChange={_onStateChange}
                className="w-full h-full"
            />
        </div>
    );
};

export default YouTubePlayer;
