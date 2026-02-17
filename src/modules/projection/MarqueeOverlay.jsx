import React, { useEffect, useState } from 'react';
import { useAppStore } from '../core/store';
import { cleanYoutubeTitle } from '../../utils/titleUtils';
import { Music, Mic, SkipForward } from 'lucide-react';

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
            className="absolute top-0 left-0 right-0 z-50 pointer-events-none flex justify-center px-6 pt-5"
            style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
                transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}
        >
            <div className="flex items-stretch gap-0 max-w-[90vw] rounded-2xl overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                {/* Current song */}
                <div className="flex items-center gap-4 bg-black/80 px-7 py-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
                        <Mic size={24} className="text-yellow-400" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-yellow-400 text-xs font-bold uppercase tracking-widest leading-none mb-1.5">ĐANG HÁT</div>
                        <div className="text-white font-black text-2xl uppercase truncate max-w-[35vw] leading-tight">{songTitle}</div>
                        <div className="text-white/60 text-sm font-bold uppercase tracking-wide mt-0.5">{singer}</div>
                    </div>
                </div>

                {/* Next song */}
                <div className="flex items-center gap-4 bg-indigo-900/80 px-7 py-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-indigo-400/20 flex items-center justify-center flex-shrink-0">
                        <SkipForward size={24} className="text-indigo-300" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-indigo-300 text-xs font-bold uppercase tracking-widest leading-none mb-1.5">TIẾP THEO</div>
                        {nextVideoId ? (
                            <>
                                <div className="text-white font-black text-2xl uppercase truncate max-w-[30vw] leading-tight">{nextTitle}</div>
                                <div className="text-white/60 text-sm font-bold uppercase tracking-wide mt-0.5">{nextAddedBy || 'Khách'}</div>
                            </>
                        ) : (
                            <div className="text-white/50 font-bold text-base uppercase">Chúc bà con hát vui vẻ!</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default MarqueeOverlay;
