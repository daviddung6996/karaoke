import { useEffect, useRef } from 'react';
import { useAppStore } from '../core/store';
import { getPlayerTime, seekPlayer, isPlayerReady, setVolume, mutePlayer, unmutePlayer } from './playerRegistry';

const CHANNEL_NAME = 'karaoke_sync_channel';
const HEARTBEAT_INTERVAL = 3000;
const DRIFT_THRESHOLD = 2;

export const usePlayerSync = (role = 'host') => {
    const { currentSong, isPlaying, waitingForGuest, waitCountdown, restartTrigger, queue,
        setCurrentSong, setIsPlaying, setWaitingForGuest, setWaitCountdown, triggerRestart } = useAppStore();

    const projectionSongRef = useRef(null);

    // --- Projection: receive messages from host ---
    useEffect(() => {
        if (role !== 'projection') return;
        const channel = new BroadcastChannel(CHANNEL_NAME);

        channel.onmessage = (event) => {
            const { type, payload } = event.data;

            if (type === 'SET_SONG') {
                projectionSongRef.current = payload?.videoId || null;
                setCurrentSong(payload);
            }

            if (type === 'PLAY_STATE') {
                const { isPlaying: playing, time, videoId } = payload;
                if (videoId && videoId === projectionSongRef.current && isPlayerReady()) {
                    seekPlayer(time);
                    setTimeout(() => setIsPlaying(playing), 150);
                } else {
                    setIsPlaying(playing);
                }
            }

            if (type === 'SYNC_TIME') {
                const { time, videoId } = payload;
                if (videoId && videoId === projectionSongRef.current && isPlayerReady()) {
                    const localTime = getPlayerTime();
                    const drift = Math.abs(time - localTime);
                    if (drift > DRIFT_THRESHOLD) {
                        console.log(`[projection] Correcting drift: ${drift.toFixed(1)}s`);
                        seekPlayer(time);
                    }
                }
            }

            if (type === 'WAITING_FOR_GUEST') setWaitingForGuest(payload);
            if (type === 'COUNTDOWN') setWaitCountdown(payload);

            if (type === 'RESTART') {
                if (isPlayerReady()) seekPlayer(0);
                triggerRestart();
            }

            if (type === 'SET_VOLUME') setVolume(payload);
            if (type === 'SET_MUTE') {
                if (payload) mutePlayer();
                else unmutePlayer();
            }
            if (type === 'SEEK_TO') {
                if (isPlayerReady()) seekPlayer(payload);
            }

            if (type === 'SYNC_QUEUE') useAppStore.getState().reorderQueue(payload);

            // Full state sync response from host
            if (type === 'FULL_SYNC') {
                const { song, playing, time, waiting, countdown, queue } = payload;
                if (song) {
                    projectionSongRef.current = song.videoId;
                    setCurrentSong(song);
                    // Wait for player to load, then seek & play
                    const waitForPlayer = setInterval(() => {
                        if (isPlayerReady()) {
                            clearInterval(waitForPlayer);
                            if (time > 0) seekPlayer(time);
                            setTimeout(() => setIsPlaying(playing), 300);
                        }
                    }, 200);
                    // Safety: clear after 10s
                    setTimeout(() => clearInterval(waitForPlayer), 10000);
                }
                setWaitingForGuest(waiting);
                setWaitCountdown(countdown);
                if (queue) useAppStore.getState().reorderQueue(queue);
            }
        };

        // Request full state from host on mount
        channel.postMessage({ type: 'REQUEST_SYNC' });

        return () => channel.close();
    }, [role, setCurrentSong, setIsPlaying, setWaitingForGuest, setWaitCountdown, triggerRestart]);

    // --- Host: listen for REQUEST_SYNC from projection ---
    useEffect(() => {
        if (role !== 'host') return;
        const channel = new BroadcastChannel(CHANNEL_NAME);

        channel.onmessage = (event) => {
            const { type } = event.data;
            if (type === 'REQUEST_SYNC') {
                const store = useAppStore.getState();
                const reply = new BroadcastChannel(CHANNEL_NAME);
                reply.postMessage({
                    type: 'FULL_SYNC',
                    payload: {
                        song: store.currentSong,
                        playing: store.isPlaying,
                        time: getPlayerTime(),
                        waiting: store.waitingForGuest,
                        countdown: store.waitCountdown,
                        queue: store.queue,
                    }
                });
                reply.close();
            }
        };

        return () => channel.close();
    }, [role]);

    // --- Host: send state changes to projection ---
    useEffect(() => {
        if (role !== 'host') return;
        const channel = new BroadcastChannel(CHANNEL_NAME);

        // Sync Queue
        channel.postMessage({ type: 'SYNC_QUEUE', payload: queue });

        if (currentSong) {
            channel.postMessage({ type: 'SET_SONG', payload: currentSong });
        }

        const time = getPlayerTime();
        channel.postMessage({
            type: 'PLAY_STATE',
            payload: { isPlaying, time, videoId: currentSong?.videoId }
        });

        channel.postMessage({ type: 'WAITING_FOR_GUEST', payload: waitingForGuest });

        return () => channel.close();
    }, [role, currentSong, isPlaying, waitingForGuest, queue]);

    // --- Host: send countdown ---
    useEffect(() => {
        if (role !== 'host') return;
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channel.postMessage({ type: 'COUNTDOWN', payload: waitCountdown });
        channel.close();
    }, [role, waitCountdown]);

    // --- Host: send restart ---
    useEffect(() => {
        if (role !== 'host' || restartTrigger === 0) return;
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channel.postMessage({ type: 'RESTART' });
        channel.close();
    }, [role, restartTrigger]);

    // --- Host: periodic heartbeat ---
    useEffect(() => {
        if (role !== 'host') return;

        const interval = setInterval(() => {
            if (!isPlaying || !isPlayerReady()) return;

            const channel = new BroadcastChannel(CHANNEL_NAME);
            channel.postMessage({
                type: 'SYNC_TIME',
                payload: { time: getPlayerTime(), videoId: currentSong?.videoId }
            });
            channel.close();
        }, HEARTBEAT_INTERVAL);

        return () => clearInterval(interval);
    }, [role, isPlaying, currentSong?.videoId]);
};
