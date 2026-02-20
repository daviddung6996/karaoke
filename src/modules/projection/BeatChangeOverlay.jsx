import React from 'react';
import { useAppStore } from '../core/store';
import { Disc3, Search } from 'lucide-react';

const BeatChangeOverlay = React.memo(() => {
    const currentSong = useAppStore((s) => s.currentSong);
    const beatSearchResults = useAppStore((s) => s.beatSearchResults);

    if (!currentSong?.changingBeat) return null;

    const singer = currentSong.addedBy || 'Quý Khách';
    const songTitle = currentSong.cleanTitle || currentSong.title || '';
    const hasResults = beatSearchResults && beatSearchResults.length > 0;

    return (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            {/* Dim background */}
            <div className="absolute inset-0 bg-black/70" />

            {/* Content — wide immersive container */}
            <div className="relative z-10 w-[96vw] h-[94vh] flex flex-col">
                <div className="bg-black/95 rounded-[3rem] border-4 border-indigo-500/50 shadow-[0_0_120px_rgba(99,102,241,0.4)] p-6 md:p-8 flex flex-col h-full overflow-hidden">
                    {/* Header: Song Info - Compacted */}
                    <div className="flex items-center gap-6 mb-6 pb-6 border-b border-white/10">
                        <div className="w-20 h-20 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/40">
                            <Disc3 size={48} className="text-white animate-spin" style={{ animationDuration: '4s' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-indigo-400 font-black text-2xl uppercase tracking-[0.3em] mb-1">ĐANG ĐỔI BEAT — {singer}</p>
                            <p className="text-white font-black text-4xl truncate leading-tight">{songTitle}</p>
                        </div>
                        {hasResults && (
                            <div className="flex flex-col items-end gap-1 px-6 py-2 bg-indigo-500/10 rounded-2xl border border-indigo-500/30">
                                <p className="text-indigo-300 font-extrabold text-xl uppercase tracking-widest">
                                    Chọn số mấy?
                                </p>
                                <div className="flex items-center gap-2">
                                    <Search size={24} className="text-indigo-400" />
                                    <span className="text-white font-black text-3xl">1 - 6</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Search Results — 3 columns, 2 rows - Adjusted gap */}
                    {hasResults ? (
                        <div className="grid grid-cols-3 grid-rows-2 gap-5 flex-1 overflow-hidden">
                            {beatSearchResults.map((result, index) => (
                                <div
                                    key={result.videoId || index}
                                    className="flex flex-col gap-3 p-4 rounded-3xl bg-white/5 border-2 border-white/10 relative overflow-hidden group"
                                >
                                    {/* Number Badge - Slightly smaller */}
                                    <div className="absolute top-3 left-3 z-20 w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-3xl font-black shadow-xl border-2 border-white/20">
                                        {index + 1}
                                    </div>

                                    {/* Thumbnail */}
                                    {result.thumbnail && (
                                        <div className="w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 flex-shrink-0 shadow-lg border border-white/5">
                                            <img src={result.thumbnail} alt="" className="w-full h-full object-cover" />
                                        </div>
                                    )}

                                    {/* Info - Compacted to ensure Channel name fits */}
                                    <div className="flex-1 flex flex-col justify-between">
                                        <p className="text-white font-black text-xl line-clamp-2 leading-tight mb-1">
                                            {result.cleanTitle || result.title}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <p className="text-indigo-400 font-bold text-base uppercase tracking-wider truncate flex-1 mr-2">
                                                {result.artist}
                                            </p>
                                            {result.duration && (
                                                <span className="text-white/40 font-mono text-sm border border-white/10 px-1.5 py-0.5 rounded leading-none">
                                                    {result.duration}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-20">
                            <div className="relative mb-10">
                                <Search size={120} className="text-indigo-500/20" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            </div>
                            <p className="text-indigo-300/60 font-black text-4xl text-center uppercase tracking-widest animate-pulse">
                                Host đang tìm bài...
                            </p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
});

export default BeatChangeOverlay;
