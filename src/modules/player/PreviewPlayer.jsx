import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Mic } from 'lucide-react';
import { useAppStore } from '../core/store';

const PreviewPlayer = React.memo(({ className }) => {
    const currentSong = useAppStore(s => s.currentSong);
    const isPlaying = useAppStore(s => s.isPlaying);
    const diskRef = useRef(null);
    const [hovered, setHovered] = useState(false);

    useEffect(() => {
        if (!diskRef.current) return;
        diskRef.current.style.animationPlayState = isPlaying ? 'running' : 'paused';
    }, [isPlaying]);

    const thumbnailUrl = useMemo(
        () => currentSong ? `https://img.youtube.com/vi/${currentSong.videoId}/hqdefault.jpg` : null,
        [currentSong?.videoId]
    );

    if (!currentSong) return <div className="bg-black text-white flex items-center justify-center h-full w-full">Chưa phát bài nào</div>;

    return (
        <div
            className={`${className} bg-black flex items-center justify-center relative overflow-hidden`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Background Blur - Optimized: removed scale/blur for performance, just use opacity */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-30 object-cover"
                style={{ backgroundImage: `url(${thumbnailUrl})` }}
            />

            {/* Rotating Disc */}
            <div
                ref={diskRef}
                className="relative z-10 h-[92%] aspect-square rounded-full border-4 border-slate-800 shadow-2xl overflow-hidden will-change-transform"
                style={{
                    animation: 'disc-spin 10s linear infinite',
                    animationPlayState: isPlaying ? 'running' : 'paused'
                }}
            >
                <img
                    src={thumbnailUrl}
                    alt="Song Thumbnail"
                    className="w-full h-full object-cover scale-110"
                />
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-black rounded-full border-2 border-slate-700 flex items-center justify-center">
                    <div className="w-6 h-6 bg-slate-900 rounded-full" />
                </div>
            </div>



            {/* Hover Info Bar */}
            <div
                className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-3 bg-black/85"
                style={{
                    opacity: hovered ? 1 : 0,
                    transform: hovered ? 'translateY(0)' : 'translateY(100%)',
                    transition: 'opacity 0.3s ease, transform 0.3s ease',
                }}
            >
                <Mic size={16} className="text-yellow-400 flex-shrink-0" />
                <div className="min-w-0 flex items-center gap-2 flex-1">
                    <span className="text-yellow-400 font-black text-sm uppercase truncate">{currentSong.title}</span>
                    <span className="text-white/30 flex-shrink-0">•</span>
                    <span className="text-white/60 font-bold text-xs uppercase flex-shrink-0">{currentSong.addedBy || 'Khách'}</span>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${isPlaying ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}`}>
                    {isPlaying ? 'ĐANG HÁT' : 'TẠM NGƯNG'}
                </div>
            </div>
        </div>
    );
});

export default PreviewPlayer;
