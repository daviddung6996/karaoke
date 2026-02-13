import { useState, useRef, useCallback, useEffect } from 'react';
import { searchYouTubeList } from '../services/youtube';

let ytApiLoaded = false;
let ytApiPromise = null;

function loadYTApi() {
    if (ytApiLoaded) return Promise.resolve();
    if (ytApiPromise) return ytApiPromise;

    ytApiPromise = new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
            ytApiLoaded = true;
            resolve();
            return;
        }
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);

        window.onYouTubeIframeAPIReady = () => {
            ytApiLoaded = true;
            resolve();
        };
    });
    return ytApiPromise;
}

export function useYouTube() {
    const previewPlayerRef = useRef(null);
    const [playerState, setPlayerState] = useState('idle');
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentVideoId, setCurrentVideoId] = useState(null);
    // Store multiple windows: { 1: win, 2: win }
    const tvWindowsRef = useRef({});
    const playerReadyRef = useRef(false);
    const pendingVideoRef = useRef(null);
    const fallbackIdsRef = useRef([]);
    const onErrorCallbackRef = useRef(null);
    const tvHeartbeatRef = useRef(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startTimeTracker = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            if (previewPlayerRef.current?.getCurrentTime) {
                setCurrentTime(previewPlayerRef.current.getCurrentTime());
                setDuration(previewPlayerRef.current.getDuration());
            }
        }, 500);
    }, []);

    const stopTimeTracker = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    const doLoadVideo = useCallback((videoId) => {
        if (previewPlayerRef.current?.loadVideoById) {
            previewPlayerRef.current.loadVideoById(videoId);
        }
        Object.values(tvWindowsRef.current).forEach(win => {
            if (win && !win.closed) {
                win.postMessage({
                    type: 'LOAD_VIDEO',
                    videoId,
                    fallbackIds: [...fallbackIdsRef.current],
                }, '*');
            }
        });
    }, []);

    const tryNextFallback = useCallback(() => {
        const next = fallbackIdsRef.current.shift();
        if (next) {
            console.log('[YT] Trying fallback video:', next);
            setCurrentVideoId(next);
            doLoadVideo(next);
            return true;
        }
        return false;
    }, [doLoadVideo]);

    const initPreviewPlayer = useCallback(async (containerId) => {
        await loadYTApi();
        if (previewPlayerRef.current) return;

        previewPlayerRef.current = new window.YT.Player(containerId, {
            width: 320,
            height: 180,
            playerVars: {
                controls: 1,
                modestbranding: 1,
                rel: 0,
                fs: 0,
                origin: window.location.origin,
                enablejsapi: 1,
                mute: 1, // Start muted
            },
            events: {
                onReady: (event) => {
                    playerReadyRef.current = true;
                    console.log('[YT] Preview player ready');
                    event.target.mute(); // Ensure muted
                    if (pendingVideoRef.current) {
                        const vid = pendingVideoRef.current;
                        pendingVideoRef.current = null;
                        doLoadVideo(vid);
                    }
                },
                onStateChange: (event) => {
                    const states = {
                        [-1]: 'idle',
                        [window.YT.PlayerState.ENDED]: 'ended',
                        [window.YT.PlayerState.PLAYING]: 'playing',
                        [window.YT.PlayerState.PAUSED]: 'paused',
                        [window.YT.PlayerState.BUFFERING]: 'buffering',
                        [window.YT.PlayerState.CUED]: 'cued',
                    };
                    const newState = states[event.data] || 'idle';
                    setPlayerState(newState);

                    if (event.data === window.YT.PlayerState.PLAYING) {
                        startTimeTracker();
                    } else {
                        stopTimeTracker();
                    }
                },
                onError: (event) => {
                    // Error codes: 2=bad ID, 5=HTML5 error, 100=removed, 101/150=embed blocked
                    console.error('[YT] Player error code:', event.data);

                    if (!tryNextFallback()) {
                        setPlayerState('error');
                        if (onErrorCallbackRef.current) {
                            onErrorCallbackRef.current(event.data);
                        }
                    }
                },
            },
        });
    }, [startTimeTracker, stopTimeTracker, doLoadVideo, tryNextFallback]);

    const loadVideo = useCallback((videoId, fallbackIds = []) => {
        setCurrentVideoId(videoId);
        setCurrentTime(0);
        setDuration(0);
        setPlayerState('buffering');
        fallbackIdsRef.current = fallbackIds;

        if (playerReadyRef.current) {
            doLoadVideo(videoId);
        } else {
            console.log('[YT] Player not ready, queuing video:', videoId);
            pendingVideoRef.current = videoId;
        }
    }, [doLoadVideo]);

    const pauseVideo = useCallback(() => {
        if (previewPlayerRef.current?.pauseVideo) {
            previewPlayerRef.current.pauseVideo();
        }
        Object.values(tvWindowsRef.current).forEach(win => {
            if (win && !win.closed) {
                win.postMessage({ type: 'PAUSE_VIDEO' }, '*');
            }
        });
    }, []);

    const resumeVideo = useCallback(() => {
        if (previewPlayerRef.current?.playVideo) {
            previewPlayerRef.current.playVideo();
        }
        Object.values(tvWindowsRef.current).forEach(win => {
            if (win && !win.closed) {
                win.postMessage({ type: 'RESUME_VIDEO' }, '*');
            }
        });
    }, []);

    const replayVideo = useCallback(() => {
        if (previewPlayerRef.current?.seekTo) {
            previewPlayerRef.current.seekTo(0);
            previewPlayerRef.current.playVideo();
        }
        Object.values(tvWindowsRef.current).forEach(win => {
            if (win && !win.closed) {
                win.postMessage({ type: 'REPLAY_VIDEO' }, '*');
            }
        });
    }, []);

    const [nativeMode, setNativeMode] = useState(false);

    const toggleNativeMode = useCallback((enabled) => {
        setNativeMode(enabled);
        Object.values(tvWindowsRef.current).forEach(win => {
            if (win && !win.closed) {
                win.postMessage({
                    type: 'TOGGLE_NATIVE_MODE',
                    enabled
                }, '*');
            }
        });
    }, []);

    const openTVWindow = useCallback((id = 1) => {
        const existingWin = tvWindowsRef.current[id];
        if (existingWin && !existingWin.closed) {
            existingWin.focus();
            return;
        }

        // Open with ID param
        const win = window.open(`/tv?id=${id}`, `karaoke_tv_${id}`, 'width=1280,height=720');
        tvWindowsRef.current[id] = win;

        // If a video is currently loaded, send it to TV after it initializes
        const vid = currentVideoId;
        const isNative = nativeMode;
        // fallbackIdsRef is current

        if (vid || isNative) {
            setTimeout(() => {
                const targetWin = tvWindowsRef.current[id];
                if (targetWin && !targetWin.closed) {
                    if (isNative) {
                        targetWin.postMessage({
                            type: 'TOGGLE_NATIVE_MODE',
                            enabled: true
                        }, '*');
                    }

                    if (vid) {
                        targetWin.postMessage({
                            type: 'LOAD_VIDEO',
                            videoId: vid,
                            fallbackIds: [...fallbackIdsRef.current],
                        }, '*');
                    }
                }
            }, 3000);
        }
    }, [currentVideoId, nativeMode]);

    useEffect(() => {
        async function handleTVMessage(event) {
            if (!event.data) return;

            // Handle Search Requests from TV
            if (event.data.type === 'TV_SEARCH') {
                const { query, requestId, tvId } = event.data;
                console.log(`[YT] Received TV search from TV ${tvId}:`, query);
                const results = await searchYouTubeList(query);

                const targetWin = tvWindowsRef.current[tvId];
                if (targetWin && !targetWin.closed) {
                    targetWin.postMessage({
                        type: 'TV_SEARCH_RESULTS',
                        requestId,
                        results
                    }, '*');
                }
                return;
            }

            if (event.data.type !== 'TV_STATE') return;

            const { currentTime: tvTime, duration: tvDuration, playerState: tvState, videoId: tvVideoId, tvId } = event.data;

            // Prioritize TV 1 for syncing, accept TV 2 if TV 1 is absent
            const isTv1Active = tvWindowsRef.current[1] && !tvWindowsRef.current[1].closed;
            const shouldSync = (tvId === 1) || (!isTv1Active && tvId === 2) || (!tvId); // (!tvId for backward compat)

            if (!shouldSync) {
                // Just log heartbeat, don't sync state
                // return;
            }

            // --- TV Heartbeat Logic ---
            if (tvHeartbeatRef.current) clearTimeout(tvHeartbeatRef.current);

            // TV is alive -> Mute preview
            try {
                if (previewPlayerRef.current?.mute && !previewPlayerRef.current.isMuted()) {
                    console.log('[YT] TV connected -> Muting preview');
                    previewPlayerRef.current.mute();
                }
            } catch (e) {
                // Ignore API errors
            }

            // Set timeout to unmute if TV stops sending updates (closed/frozen)
            tvHeartbeatRef.current = setTimeout(() => {
                console.log('[YT] TV disconnected (timeout) -> Unmuting preview');
                try {
                    if (previewPlayerRef.current?.unMute) {
                        previewPlayerRef.current.unMute();
                        previewPlayerRef.current.setVolume(100);
                    }
                } catch (e) {
                    // Ignore API errors
                }
            }, 2000); // 2s timeout
            // --------------------------

            // Sync state
            setDuration(tvDuration);
            setCurrentTime(tvTime);

            const states = {
                [-1]: 'idle',
                [window.YT.PlayerState.ENDED]: 'ended',
                [window.YT.PlayerState.PLAYING]: 'playing',
                [window.YT.PlayerState.PAUSED]: 'paused',
                [window.YT.PlayerState.BUFFERING]: 'buffering',
                [window.YT.PlayerState.CUED]: 'cued',
            };
            setPlayerState(states[tvState] || 'idle');

            // Sync Preview Player
            if (shouldSync && previewPlayerRef.current && playerReadyRef.current) {
                // If TV is playing different video, load it (unless we just requested a load)
                if (tvVideoId && tvVideoId !== currentVideoId && tvVideoId !== pendingVideoRef.current) {
                    console.log(`[YT] Syncing video ID from TV ${tvId}:`, tvVideoId);
                    setCurrentVideoId(tvVideoId);
                    previewPlayerRef.current.loadVideoById(tvVideoId);
                }

                const previewState = previewPlayerRef.current.getPlayerState();

                // Sync Play/Pause
                if (tvState === window.YT.PlayerState.PLAYING && previewState !== window.YT.PlayerState.PLAYING) {
                    previewPlayerRef.current.playVideo();
                } else if (tvState === window.YT.PlayerState.PAUSED && previewState !== window.YT.PlayerState.PAUSED) {
                    previewPlayerRef.current.pauseVideo();
                }

                // Sync Time (if drift > 2 seconds)
                const previewTime = previewPlayerRef.current.getCurrentTime();
                if (Math.abs(previewTime - tvTime) > 2) {
                    console.log('[YT] Syncing time, drift:', Math.abs(previewTime - tvTime));
                    previewPlayerRef.current.seekTo(tvTime);
                }
            }
        }

        window.addEventListener('message', handleTVMessage);
        return () => {
            window.removeEventListener('message', handleTVMessage);
            if (tvHeartbeatRef.current) clearTimeout(tvHeartbeatRef.current);
        };
    }, [currentVideoId]);

    // Format time helper
    const formatTime = useCallback((seconds) => {
        if (!seconds) return '00:00';
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }, []);

    return {
        initPreviewPlayer,
        loadVideo,
        pauseVideo,
        resumeVideo,
        replayVideo,
        openTVWindow,
        toggleNativeMode,
        nativeMode,
        tvWindowsRef,
        playerState,
        currentTime,
        duration,
        currentVideoId,
        formatTime,
        progress: duration > 0 ? (currentTime / duration) * 100 : 0,
        onErrorCallbackRef,
    };
}
