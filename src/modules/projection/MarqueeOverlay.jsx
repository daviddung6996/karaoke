import React, { useEffect, useState } from 'react';
import { useAppStore } from '../core/store';
import { cleanYoutubeTitle } from '../../utils/titleUtils';

const MarqueeOverlay = () => {
    const { currentSong, queue } = useAppStore();
    const [isVisible, setIsVisible] = useState(false);

    // Get next song details
    const nextSong = queue.length > 0 ? queue[0] : null;



    useEffect(() => {
        if (currentSong) {
            // Animation is 18s, so we must show for at least 18s to complete it.
            const showDuration = 18000;
            const timeouts = [];

            const showMatrix = () => {
                setIsVisible(true);
                const t = setTimeout(() => setIsVisible(false), showDuration);
                timeouts.push(t);
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

            // Strategy: Start (5s), Middle (50%), Near End (90% or End-35s)

            // 1. Start
            const startDelay = 5000; // 5s in
            timeouts.push(setTimeout(showMatrix, startDelay));

            if (durationSec > 60) {
                // 2. Middle
                const middleDelay = (durationSec * 1000) / 2;
                if (middleDelay > startDelay + showDuration) {
                    timeouts.push(setTimeout(showMatrix, middleDelay));
                }

                // 3. Near End (30-40s before end)
                let endDelay = (durationSec * 1000) - 40000;
                if (endDelay < 0) endDelay = (durationSec * 1000) * 0.85;

                if (endDelay > middleDelay + showDuration) {
                    timeouts.push(setTimeout(showMatrix, endDelay));
                }
            } else {
                // Fallback for unknown duration or very short songs
                const interval = setInterval(() => {
                    showMatrix();
                }, 45000);
                timeouts.push(interval);
            }

            return () => {
                timeouts.forEach(t => {
                    clearTimeout(t);
                    clearInterval(t);
                });
            };
        } else {
            setIsVisible(false);
        }
    }, [currentSong]);

    // Show marquee immediately when next song changes (e.g. added to queue)
    useEffect(() => {
        if (currentSong && nextSong) {
            setIsVisible(true);
        }
    }, [nextSong]);

    if (!currentSong || !isVisible) return null;

    const currentText = `ĐANG PHÁT: ${currentSong.cleanTitle || cleanYoutubeTitle(currentSong.title)} — BIỂU DIỄN: ${currentSong.addedBy || 'Khách'}.`.toUpperCase();
    const nextText = nextSong
        ? `TIẾP THEO LÀ CA KHÚC ${nextSong.cleanTitle || cleanYoutubeTitle(nextSong.title)} - ${nextSong.addedBy || 'Khách'}.`.toUpperCase()
        : "CHÚC BÀ CON CA HÁT VUI VẺ!.".toUpperCase();

    const marqueeText = `${currentText}          ${nextText}          ${currentText}          ${nextText}`;

    return (
        <div className="absolute top-10 left-0 w-full z-50 pointer-events-none overflow-hidden">
            <div
                className="whitespace-nowrap text-3xl font-black text-yellow-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] animate-marquee uppercase"
                style={{
                    animationDuration: '20s',
                    animationIterationCount: 2,
                    WebkitTextStroke: '1px black',
                    textShadow: '0 0 4px rgba(0,0,0,0.5)'
                }}
                onAnimationEnd={() => setIsVisible(false)}
            >
                {marqueeText}
            </div>
        </div>
    );
};

export default MarqueeOverlay;
