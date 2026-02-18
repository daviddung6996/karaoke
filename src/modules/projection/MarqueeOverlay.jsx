import React, { useEffect, useState } from 'react';
import { useAppStore } from '../core/store';
import { cleanYoutubeTitle } from '../../utils/titleUtils';
import { Mic, SkipForward } from 'lucide-react';

const MarqueeOverlay = React.memo(() => {
    const currentSong = useAppStore((s) => s.currentSong);
    const nextVideoId = useAppStore((s) => s.queue[0]?.videoId ?? null);
    const nextTitle = useAppStore((s) => s.queue[0]?.cleanTitle || s.queue[0]?.title || null);
    const nextAddedBy = useAppStore((s) => s.queue[0]?.addedBy ?? null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (currentSong) {
            const showDuration = 8000;
            const timeouts = [];

            const show = () => {
                setIsVisible(true);
                timeouts.push(setTimeout(() => setIsVisible(false), showDuration));
            };

            // Parse Duration
            let durationSec = 0;
            if (currentSong.duration) {
                if (typeof currentSong.duration === 'string' && currentSong.duration.includes(':')) {
                    const parts = currentSong.duration.split(':').map(Number);
                    if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
                    else if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
                } else {
                    durationSec = parseInt(currentSong.duration, 10) || 0;
                }
            }

            // Show at: Start (5s), Middle (50%), Near End (end-35s)
            timeouts.push(setTimeout(show, 5000));

            if (durationSec > 60) {
                const mid = (durationSec * 1000) / 2;
                if (mid > 5000 + showDuration) timeouts.push(setTimeout(show, mid));

                let end = (durationSec * 1000) - 35000;
                if (end < 0) end = (durationSec * 1000) * 0.85;
                if (end > mid + showDuration) timeouts.push(setTimeout(show, end));
            } else {
                timeouts.push(setInterval(show, 45000));
            }

            return () => {
                timeouts.forEach(t => { clearTimeout(t); clearInterval(t); });
            };
        } else {
            setIsVisible(false);
        }
    }, [currentSong]);

    // Show immediately when next song is added
    useEffect(() => {
        if (currentSong && nextVideoId) {
            setIsVisible(true);
        }
    }, [nextVideoId]);

    if (!currentSong) return null;

    const songTitle = currentSong.cleanTitle || cleanYoutubeTitle(currentSong.title);
    const singer = currentSong.addedBy || 'Khách';

    return (
        <div
            className="absolute top-0 left-0 right-0 z-50 pointer-events-none flex justify-center px-8 pt-8"
            style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
                transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}
        >
            <div className="flex items-stretch gap-0 w-[95vw] max-w-[95vw] rounded-3xl overflow-hidden bg-black/85 border border-white/10">
                {/* Current song */}
                <div className="flex-1 w-1/2 flex items-center gap-6 px-8 py-7 min-w-0 border-r border-white/10">
                    <div className="w-20 h-20 rounded-2xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                        <Mic size={40} className="text-yellow-400 drop-shadow-md" />
                    </div>
                    <div className="min-w-0 flex flex-col justify-center flex-1">
                        <div className="text-yellow-500 text-lg font-bold uppercase tracking-[0.2em] leading-none mb-2">ĐANG HÁT</div>
                        <div className="text-white font-black text-4xl uppercase line-clamp-2 w-full leading-[1.1] break-words">{songTitle}</div>
                        <div className="text-yellow-300 text-3xl font-extrabold uppercase tracking-wide mt-2 truncate">{singer}</div>
                    </div>
                </div>

                {/* Next song */}
                <div className="flex-1 w-1/2 flex items-center gap-6 bg-indigo-950/40 px-8 py-7 min-w-0">
                    <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <SkipForward size={36} className="text-indigo-300" />
                    </div>
                    <div className="min-w-0 flex flex-col justify-center flex-1">
                        <div className="text-indigo-300 text-sm font-bold uppercase tracking-widest leading-none mb-2">TIẾP THEO</div>
                        {nextVideoId ? (
                            <>
                                <div className="text-white/90 font-bold text-3xl uppercase line-clamp-2 w-full leading-tight break-words">{nextTitle}</div>
                                <div className="text-white text-2xl font-bold uppercase tracking-wide mt-1 truncate">{nextAddedBy || 'Khách'}</div>
                            </>
                        ) : (
                            <div className="text-white/50 font-bold text-xl uppercase">Chúc bà con hát vui vẻ!</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default MarqueeOverlay;
