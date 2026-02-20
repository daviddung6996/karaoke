import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../core/store';
import { getPlayerTime, getDuration, getPlayer, isPlayerReady, setVolume, mutePlayer, unmutePlayer, setUserMuted, playPlayer, pausePlayer, updateRemoteState, triggerRemoteSongEnded } from './playerRegistry';

const CHANNEL_NAME = 'karaoke_sync_channel';

// Stable no-op selectors — TV uses these to avoid re-renders from host-only state
const _NO = () => null;
const _ZERO = () => 0;
const _FALSE = () => false;

/**
 * Sync hook – Host is the "commander", TV is the "player".
 *
 * PERF: Host and TV share the same renderer process (same origin, window.open).
 * TV must NOT subscribe to state it doesn't render (queue, countdown, volume, etc.)
 * otherwise host operations cause TV re-renders → iframe reconciliation → video stutter.
 */
export const usePlayerSync = (role = 'host', { onSongEnded } = {}) => {
    const isHost = role === 'host';

    // Both roles need these (TV uses for waitingForGuest transition)
    const isPlaying = useAppStore((s) => s.isPlaying);
    const waitingForGuest = useAppStore((s) => s.waitingForGuest);

    // Host-only reactive state — TV gets stable dummy values (no re-renders)
    const currentSong = useAppStore(isHost ? (s) => s.currentSong : _NO);
    const waitCountdown = useAppStore(isHost ? (s) => s.waitCountdown : _ZERO);
    const countdownPaused = useAppStore(isHost ? (s) => s.countdownPaused : _FALSE);
    const micAttemptHint = useAppStore(isHost ? (s) => s.micAttemptHint : _NO);
    const restartTrigger = useAppStore(isHost ? (s) => s.restartTrigger : _ZERO);
    const queue = useAppStore(isHost ? (s) => s.queue : _NO);

    // Setters are stable references — safe to subscribe from both roles
    const setCurrentSong = useAppStore((s) => s.setCurrentSong);
    const setIsPlaying = useAppStore((s) => s.setIsPlaying);
    const setWaitingForGuest = useAppStore((s) => s.setWaitingForGuest);
    const setWaitCountdown = useAppStore((s) => s.setWaitCountdown);
    const setCountdownPaused = useAppStore((s) => s.setCountdownPaused);
    const setMicAttemptHint = useAppStore((s) => s.setMicAttemptHint);
    const triggerRestart = useAppStore((s) => s.triggerRestart);

    const channelRef = useRef(null);
    const projectionSongRef = useRef(null);
    const stopAutoplayRef = useRef(null);
    // Track pending wait intervals/timeouts for cleanup on unmount
    const pendingTimersRef = useRef(new Set());

    // --- Get or create persistent channel ---
    const getChannel = useCallback(() => {
        if (!channelRef.current) {
            channelRef.current = new BroadcastChannel(CHANNEL_NAME);
        }
        return channelRef.current;
    }, []);

    const sendMessage = useCallback((type, payload) => {
        try {
            getChannel().postMessage({ type, payload });
        } catch { /* channel closed */ }
    }, [getChannel]);

    // ========== PROJECTION (TV) ROLE ==========
    useEffect(() => {
        if (role !== 'projection') return;
        const channel = getChannel();

        channel.onmessage = (event) => {
            const { type, payload } = event.data;

            switch (type) {
                case 'SET_SONG': {
                    if (projectionSongRef.current !== payload?.videoId) {
                        projectionSongRef.current = payload?.videoId || null;
                        setCurrentSong(payload);

                        // Reset playing state. Host will send PLAY when ready.
                        setIsPlaying(false);

                        // Clear any previous blocker
                        if (stopAutoplayRef.current) clearInterval(stopAutoplayRef.current);

                        // Keep video muted (autoplay:1 will load it muted in bg)
                        // No need to pause — video plays silently, ready for instant unmute
                        if (isPlayerReady()) {
                            mutePlayer();
                        }
                    }
                    break;
                }

                case 'PLAY': {
                    if (stopAutoplayRef.current) {
                        clearInterval(stopAutoplayRef.current);
                        stopAutoplayRef.current = null;
                    }

                    setIsPlaying(true);

                    const doUnmute = () => {
                        unmutePlayer();
                        playPlayer();
                    };

                    if (isPlayerReady()) {
                        doUnmute();
                    } else {
                        const waitForReady = setInterval(() => {
                            if (isPlayerReady()) {
                                clearInterval(waitForReady);
                                pendingTimersRef.current.delete(waitForReady);
                                pendingTimersRef.current.delete(waitTimeout);
                                doUnmute();
                            }
                        }, 300);
                        const waitTimeout = setTimeout(() => {
                            clearInterval(waitForReady);
                            pendingTimersRef.current.delete(waitForReady);
                            pendingTimersRef.current.delete(waitTimeout);
                        }, 10000);
                        pendingTimersRef.current.add(waitForReady);
                        pendingTimersRef.current.add(waitTimeout);
                    }
                    break;
                }

                case 'PAUSE': {
                    setIsPlaying(false);
                    if (isPlayerReady()) mutePlayer();
                    break;
                }

                case 'WAITING_FOR_GUEST':
                    setWaitingForGuest(payload);
                    break;

                case 'COUNTDOWN':
                    setWaitCountdown(payload);
                    break;

                case 'COUNTDOWN_PAUSED':
                    setCountdownPaused(payload);
                    break;

                case 'MIC_ATTEMPT':
                    setMicAttemptHint(payload);
                    break;

                case 'RESTART': {
                    // Restart = seek to 0 on TV only
                    if (isPlayerReady()) {
                        const player = getPlayer();
                        if (player) player.seekTo(0, true);
                    }
                    triggerRestart();
                    break;
                }

                case 'BEAT_CHANGE': {
                    // Update changingBeat flag on TV's currentSong without resetting playback
                    const cur = useAppStore.getState().currentSong;
                    if (cur) {
                        setCurrentSong({ ...cur, changingBeat: payload.changingBeat, beatOptions: payload.beatOptions || cur.beatOptions });
                    }
                    break;
                }

                case 'BEAT_SEARCH_RESULTS':
                    // Show host's search results on TV overlay
                    useAppStore.getState().setBeatSearchResults(payload?.results || []);
                    break;

                case 'SET_VOLUME':
                    // Only allow unmute if we are supposedly playing
                    // This prevents volume adjustments during "Waiting for guest" from unmuting the TV
                    setVolume(payload, useAppStore.getState().isPlaying);
                    break;

                case 'SET_MUTE':
                    setUserMuted(payload);
                    break;

                case 'SYNC_QUEUE':
                    useAppStore.getState().reorderQueue(payload);
                    break;

                case 'FULL_SYNC': {
                    const { song, playing, waiting, countdown, paused, micHint, queue: syncQueue } = payload;

                    if (stopAutoplayRef.current) {
                        clearInterval(stopAutoplayRef.current);
                        stopAutoplayRef.current = null;
                    }

                    if (song) {
                        projectionSongRef.current = song.videoId;
                        setCurrentSong(song);
                        // Just wait for player ready → play (no seeking)
                        if (playing) {
                            const waitForPlayer = setInterval(() => {
                                if (isPlayerReady()) {
                                    clearInterval(waitForPlayer);
                                    pendingTimersRef.current.delete(waitForPlayer);
                                    pendingTimersRef.current.delete(waitPlayerTimeout);
                                    playPlayer();
                                    setTimeout(() => unmutePlayer(), 300);
                                    setIsPlaying(true);
                                }
                            }, 300);
                            const waitPlayerTimeout = setTimeout(() => {
                                clearInterval(waitForPlayer);
                                pendingTimersRef.current.delete(waitForPlayer);
                                pendingTimersRef.current.delete(waitPlayerTimeout);
                            }, 10000);
                            pendingTimersRef.current.add(waitForPlayer);
                            pendingTimersRef.current.add(waitPlayerTimeout);
                        }
                    }
                    setWaitingForGuest(waiting);
                    setWaitCountdown(countdown);
                    setCountdownPaused(paused || false);
                    setMicAttemptHint(micHint || null);
                    if (syncQueue) useAppStore.getState().reorderQueue(syncQueue);

                    // Sync volume state
                    if (typeof payload.volume === 'number') setVolume(payload.volume, playing);
                    if (typeof payload.isMuted === 'boolean') {
                        setUserMuted(payload.isMuted);
                    }
                    break;
                }
            }
        };

        // Request full state from host on mount
        channel.postMessage({ type: 'REQUEST_SYNC' });

        // Broadcast time to host every 3s (reduced for bandwidth)
        const interval = setInterval(() => {
            if (isPlayerReady()) {
                sendMessage('SYNC_TIME', {
                    time: getPlayerTime(),
                    duration: getDuration()
                });
            }
        }, 3000);

        return () => {
            clearInterval(interval);
            // Clean up all pending wait intervals/timeouts
            pendingTimersRef.current.forEach(id => {
                clearInterval(id);
                clearTimeout(id);
            });
            pendingTimersRef.current.clear();
            if (stopAutoplayRef.current) {
                clearInterval(stopAutoplayRef.current);
                stopAutoplayRef.current = null;
            }
            channel.close();
            channelRef.current = null;
        };
    }, [role, getChannel, setCurrentSong, setIsPlaying, setWaitingForGuest, setWaitCountdown, setCountdownPaused, setMicAttemptHint, triggerRestart, sendMessage]);

    // [New] Resume playback when waitingForGuest ends (TV Side)
    // This fixes the issue where TV stays paused/muted after invitation
    const prevWaitingProjectionRef = useRef(false);
    useEffect(() => {
        if (role !== 'projection') return;

        // If we transitioned from Waiting (true) -> Not Waiting (false)
        if (prevWaitingProjectionRef.current && !waitingForGuest) {
            if (isPlaying && isPlayerReady()) {
                unmutePlayer();
                playPlayer();
            }
        }
        prevWaitingProjectionRef.current = waitingForGuest;
    }, [role, waitingForGuest, isPlaying]);

    // ========== HOST ROLE ==========

    // Listen for REQUEST_SYNC and SYNC_TIME from projection
    useEffect(() => {
        if (role !== 'host') return;
        const channel = getChannel();

        channel.onmessage = (event) => {
            const { type, payload } = event.data;

            if (type === 'REQUEST_SYNC') {
                const store = useAppStore.getState();
                sendMessage('FULL_SYNC', {
                    song: store.currentSong,
                    playing: store.isPlaying,
                    waiting: store.waitingForGuest,
                    countdown: store.waitCountdown,
                    paused: store.countdownPaused,
                    micHint: store.micAttemptHint,
                    queue: store.queue,
                    volume: store.volume,
                    isMuted: store.isMuted
                });
            } else if (type === 'SYNC_TIME') {
                updateRemoteState(payload.time, payload.duration);
            } else if (type === 'SONG_ENDED') {
                triggerRemoteSongEnded();
                if (onSongEnded) onSongEnded();
            }
        };

        return () => {
            channel.close();
            channelRef.current = null;
        };
    }, [role, getChannel, sendMessage, onSongEnded]);

    // Send song change — only when videoId actually changes
    const prevSongIdRef = useRef(null);
    useEffect(() => {
        if (role !== 'host') return;

        // Staged waiting slot: send to TV so it shows "Mời chọn bài" overlay
        if (currentSong?.isStaged && currentSong?.status === 'waiting') {
            prevSongIdRef.current = `waiting_${currentSong.id}`;
            sendMessage('SET_SONG', currentSong);
            return;
        }

        // If staged (normal song), send NULL to TV so it shows idle background
        if (currentSong?.isStaged) {
            sendMessage('SET_SONG', null);
            return;
        }

        const videoId = currentSong?.videoId || null;
        if (videoId === prevSongIdRef.current) return;
        prevSongIdRef.current = videoId;

        if (currentSong) {
            sendMessage('SET_SONG', currentSong);
        }
    }, [role, currentSong, sendMessage]);

    // Send changingBeat flag to TV
    const prevChangingBeatRef = useRef(null);
    useEffect(() => {
        if (role !== 'host') return;
        const cb = currentSong?.changingBeat || false;
        if (cb === prevChangingBeatRef.current) return;
        prevChangingBeatRef.current = cb;
        sendMessage('BEAT_CHANGE', { changingBeat: cb, beatOptions: currentSong?.beatOptions });
    }, [role, currentSong?.changingBeat, sendMessage]);

    // Send play/pause — discrete commands
    const prevIsPlayingRef = useRef(null);
    useEffect(() => {
        if (role !== 'host') return;
        if (isPlaying === prevIsPlayingRef.current) return;
        prevIsPlayingRef.current = isPlaying;

        sendMessage(isPlaying ? 'PLAY' : 'PAUSE');
    }, [role, isPlaying, sendMessage]);

    // Send waitingForGuest
    const prevWaitingRef = useRef(null);
    useEffect(() => {
        if (role !== 'host') return;
        if (waitingForGuest === prevWaitingRef.current) return;
        prevWaitingRef.current = waitingForGuest;

        sendMessage('WAITING_FOR_GUEST', waitingForGuest);
    }, [role, waitingForGuest, sendMessage]);

    // Send queue changes (debounced to avoid flooding TV)
    const queueSyncTimerRef = useRef(null);
    useEffect(() => {
        if (role !== 'host') return;
        if (queueSyncTimerRef.current) clearTimeout(queueSyncTimerRef.current);
        queueSyncTimerRef.current = setTimeout(() => {
            sendMessage('SYNC_QUEUE', queue);
        }, 500);
        return () => {
            if (queueSyncTimerRef.current) clearTimeout(queueSyncTimerRef.current);
        };
    }, [role, queue, sendMessage]);

    // Send countdown
    useEffect(() => {
        if (role !== 'host') return;
        sendMessage('COUNTDOWN', waitCountdown);
    }, [role, waitCountdown, sendMessage]);

    // Send countdownPaused
    useEffect(() => {
        if (role !== 'host') return;
        sendMessage('COUNTDOWN_PAUSED', countdownPaused);
    }, [role, countdownPaused, sendMessage]);

    // Send micAttemptHint
    useEffect(() => {
        if (role !== 'host') return;
        sendMessage('MIC_ATTEMPT', micAttemptHint);
    }, [role, micAttemptHint, sendMessage]);

    // Send Volume (host-only subscription)
    const volume = useAppStore(isHost ? (s) => s.volume : _ZERO);
    const isMuted = useAppStore(isHost ? (s) => s.isMuted : _FALSE);

    // Debounce/check previous for volume
    const prevVolumeRef = useRef(100);
    useEffect(() => {
        if (role !== 'host') return;
        if (volume === prevVolumeRef.current) return;
        prevVolumeRef.current = volume;
        sendMessage('SET_VOLUME', volume);
    }, [role, volume, sendMessage]);

    // Check previous for mute
    const prevMuteRef = useRef(false);
    useEffect(() => {
        if (role !== 'host') return;
        if (isMuted === prevMuteRef.current) return;
        prevMuteRef.current = isMuted;
        sendMessage('SET_MUTE', isMuted);
    }, [role, isMuted, sendMessage]);

    // Send restart
    useEffect(() => {
        if (role !== 'host' || restartTrigger === 0) return;
        sendMessage('RESTART');
    }, [role, restartTrigger, sendMessage]);

    // Expose sendMessage for manual triggers if needed (e.g. from ValidationView)
    return { sendMessage };
};
