import React, { useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import { useAppStore } from '../core/store';
import { registerPlayer, unregisterPlayer } from './playerRegistry';

const YouTubePlayer = ({ className, onReady, onStateChange, onEnded, muted = false, controls = true, quality = null }) => {
    const { currentSong, isPlaying, setIsPlaying, restartTrigger, waitingForGuest } = useAppStore();
    const playerRef = useRef(null);
    const justLoadedRef = useRef(false);

    const opts = React.useMemo(() => ({
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: 0,
            controls: controls ? 1 : 0,
            mute: muted ? 1 : 0,
            disablekb: controls ? 0 : 1,
            modestbranding: 1,
            fs: controls ? 1 : 0,
            iv_load_policy: 3,
            rel: 0,
            origin: window.location.origin,
        },
    }), [controls, muted]);

    const _onReady = (event) => {
        playerRef.current = event.target;
        registerPlayer(event.target);

        const iframe = event.target.getIframe();
        if (iframe) {
            iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";
            iframe.style.pointerEvents = 'auto';
        }

        // Force low quality on control panel to save bandwidth
        if (quality) {
            event.target.setPlaybackQuality(quality);
        }

        justLoadedRef.current = true;
        setTimeout(() => { justLoadedRef.current = false; }, 1500);

        // Always pause on load — only play when store explicitly says so
        event.target.pauseVideo();

        if (onReady) onReady(event);
    };

    // Unregister on unmount AND on videoId change (before new player mounts)
    useEffect(() => {
        return () => {
            unregisterPlayer();
            playerRef.current = null;
        };
    }, [currentSong?.videoId]);

    const _onStateChange = (event) => {
        const store = useAppStore.getState();

        // Re-enforce quality cap on buffering/playing to prevent YouTube auto-upgrade
        if (quality && (event.data === 1 || event.data === 3)) {
            event.target.setPlaybackQuality(quality);
        }

        // STRICT: While waiting for guest, NEVER allow playback
        if (store.waitingForGuest && event.data === 1) {
            event.target.pauseVideo();
            return;
        }

        // During initial load, block YouTube auto-play if store says paused
        if (justLoadedRef.current && event.data === 1 && !store.isPlaying) {
            event.target.pauseVideo();
            return;
        }

        if (onStateChange) onStateChange(event);
        if (event.data === 1) setIsPlaying(true);
        if (event.data === 2) setIsPlaying(false);
        if (event.data === 0 && onEnded) onEnded();
    };

    // Sync logic: When store state changes, update player
    // STRICT: Also block play while waitingForGuest
    useEffect(() => {
        if (!playerRef.current) return;
        if (isPlaying && !waitingForGuest) {
            playerRef.current.playVideo();
        } else {
            playerRef.current.pauseVideo();
        }
    }, [isPlaying, waitingForGuest]);

    // Restart logic
    useEffect(() => {
        if (playerRef.current && restartTrigger > 0) {
            playerRef.current.seekTo(0);
            playerRef.current.playVideo();
        }
    }, [restartTrigger]);

    if (!currentSong) return <div className="bg-black text-white flex items-center justify-center h-full w-full">No Song Playing</div>;

    return (
        <div className={className}>
            <YouTube
                key={currentSong.videoId}
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
