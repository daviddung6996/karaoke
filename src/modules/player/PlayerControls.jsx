import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../core/store';
import { getPlayerTime, getDuration } from './playerRegistry';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';

const CHANNEL_NAME = 'karaoke_sync_channel';

let _tvChannel = null;
const getTVChannel = () => {
    if (!_tvChannel) _tvChannel = new BroadcastChannel(CHANNEL_NAME);
    return _tvChannel;
};
const sendToTV = (type, payload) => {
    try {
        getTVChannel().postMessage({ type, payload });
    } catch { _tvChannel = null; }
};

const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const PlayerControls = () => {
    const currentSong = useAppStore((s) => s.currentSong);
    const restartTrigger = useAppStore((s) => s.restartTrigger);
    const volume = useAppStore((s) => s.volume);
    const setVolume = useAppStore((s) => s.setVolume);
    const isMuted = useAppStore((s) => s.isMuted);
    const setIsMuted = useAppStore((s) => s.setIsMuted);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const isRestartingRef = useRef(false);
    const prevVolumeRef = useRef(100);

    // Snap to 0 when restart triggered
    useEffect(() => {
        if (restartTrigger > 0) {
            isRestartingRef.current = true;
            setCurrentTime(0);
            setTimeout(() => { isRestartingRef.current = false; }, 1000);
        }
    }, [restartTrigger]);

    // Tick: poll time at 1fps (sufficient for progress bar)
    useEffect(() => {
        if (!currentSong) return;
        const interval = setInterval(() => {
            if (!isRestartingRef.current) {
                const t = getPlayerTime();
                const d = getDuration();
                setCurrentTime(prev => {
                    const rounded = Math.floor(t);
                    return Math.floor(prev) === rounded ? prev : rounded;
                });
                setDuration(prev => {
                    const rounded = Math.floor(d);
                    return Math.floor(prev) === rounded ? prev : rounded;
                });
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [currentSong]);

    // Volume
    const handleVolumeChange = (e) => {
        const val = Number(e.target.value);
        setVolume(val);
        if (val > 0) {
            setIsMuted(false);
            prevVolumeRef.current = val;
        }
    };

    const toggleMute = () => {
        if (isMuted) {
            setIsMuted(false);
            setVolume(prevVolumeRef.current);
        } else {
            prevVolumeRef.current = volume;
            setIsMuted(true);
            setVolume(0);
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
