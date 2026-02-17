import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../core/store';
import { getPlayerTime, getDuration, getPlayer, isPlayerReady, setVolume, mutePlayer, unmutePlayer, setUserMuted, playPlayer, pausePlayer, updateRemoteState, triggerRemoteSongEnded } from './playerRegistry';

const CHANNEL_NAME = 'karaoke_sync_channel';

/**
 * Sync hook – Host is the "commander", TV is the "player".
 * 
 * Logic:
 * 1. TV loads the video and plays it.
 * 2. TV broadcasts SYNC_TIME every second to Host.
 * 3. TV broadcasts SONG_ENDED when video finishes.
 * 4. Host uses remote time for progress bar.
 */
export const usePlayerSync = (role = 'host', { onSongEnded } = {}) => {
    const currentSong = useAppStore((s) => s.currentSong);
    const isPlaying = useAppStore((s) => s.isPlaying);
    const waitingForGuest = useAppStore((s) => s.waitingForGuest);
    const waitCountdown = useAppStore((s) => s.waitCountdown);
    const countdownPaused = useAppStore((s) => s.countdownPaused);
    const micAttemptHint = useAppStore((s) => s.micAttemptHint);
    const restartTrigger = useAppStore((s) => s.restartTrigger);
    const queue = useAppStore((s) => s.queue);
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
                                doUnmute();
                            }
                        }, 300);
                        setTimeout(() => clearInterval(waitForReady), 10000);
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
                                    playPlayer();
                                    setTimeout(() => unmutePlayer(), 300);
                                    setIsPlaying(true);
                                }
                            }, 300);
                            setTimeout(() => clearInterval(waitForPlayer), 10000);
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

        // Broadcast time to host every 2s (reduced from 1s for bandwidth)
        const interval = setInterval(() => {
            if (isPlayerReady()) {
                sendMessage('SYNC_TIME', {
                    time: getPlayerTime(),
                    duration: getDuration()
                });
            }
        }, 2000);

        return () => {
            clearInterval(interval);
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

        // If staged, send NULL to TV so it shows idle background
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

    // [New] Send Volume
    const volume = useAppStore((s) => s.volume);
    const isMuted = useAppStore((s) => s.isMuted);

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
