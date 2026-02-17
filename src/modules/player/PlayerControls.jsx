import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../core/store';
import { getPlayerTime, getDuration } from './playerRegistry';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';

const CHANNEL_NAME = 'karaoke_sync_channel';

const sendToTV = (type, payload) => {
    try {
        const ch = new BroadcastChannel(CHANNEL_NAME);
        ch.postMessage({ type, payload });
        ch.close();
    } catch { }
};

const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const PlayerControls = () => {
    const { currentSong, restartTrigger } = useAppStore();
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolumeState] = useState(100);
    const [isMuted, setIsMuted] = useState(false);
    const isRestartingRef = useRef(false);
    const prevVolumeRef = useRef(100);
    const rafRef = useRef(null);

    // Snap to 0 when restart triggered
    useEffect(() => {
        if (restartTrigger > 0) {
            isRestartingRef.current = true;
            setCurrentTime(0);
            setTimeout(() => { isRestartingRef.current = false; }, 1000);
        }
    }, [restartTrigger]);

    // Tick: read remote time from TV (read-only display)
    const tick = useCallback(() => {
        if (!isRestartingRef.current) {
            setCurrentTime(getPlayerTime());
        }
        setDuration(getDuration());
        rafRef.current = requestAnimationFrame(tick);
    }, []);

    useEffect(() => {
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [tick]);

    // Volume
    const handleVolumeChange = (e) => {
        const val = Number(e.target.value);
        setVolumeState(val);
        sendToTV('SET_VOLUME', val);
        if (val > 0) {
            setIsMuted(false);
            prevVolumeRef.current = val;
        }
    };

    const toggleMute = () => {
        if (isMuted) {
            setIsMuted(false);
            setVolumeState(prevVolumeRef.current);
            sendToTV('SET_VOLUME', prevVolumeRef.current);
            sendToTV('SET_MUTE', false);
        } else {
            prevVolumeRef.current = volume;
            setIsMuted(true);
            setVolumeState(0);
            sendToTV('SET_VOLUME', 0);
            sendToTV('SET_MUTE', true);
        }
    };

    if (!currentSong) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

    return (
        <div className="space-y-2">
            {/* Progress Bar (read-only — displays TV playback position) */}
            <div className="space-y-1">
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-100"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Time Display */}
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 tabular-nums">{formatTime(currentTime)}</span>
                    <span className="text-[10px] font-bold text-slate-400 tabular-nums">{formatTime(duration)}</span>
                </div>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                    <button
                        onClick={toggleMute}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-all cursor-pointer active:scale-90 flex items-center gap-1"
                        title="Âm lượng TV"
                    >
                        <span className="text-[9px] font-black text-indigo-500 uppercase">TV</span>
                        <VolumeIcon size={16} />
                    </button>

                    <div className="relative flex-1 group max-w-[140px]">
                        <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-400 rounded-full transition-all duration-75"
                                style={{ width: `${volume}%` }}
                            />
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={volume}
                            onChange={handleVolumeChange}
                            onMouseUp={(e) => e.target.blur()}
                            onTouchEnd={(e) => e.target.blur()}
                            tabIndex={-1}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>

                    <span className="text-[10px] font-bold text-slate-400 w-7 text-right tabular-nums">{volume}%</span>
                </div>
            </div>
        </div>
    );
};

export default PlayerControls;
