import { useState, useEffect } from 'react';
import { X, Check, Music, Loader2 } from 'lucide-react';
import Button from '../ui/Button';
import { searchBeatVariants } from '../core/beatSearch';

const formatViews = (count) => {
    if (!count) return null;
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
    return String(count);
};

const BeatSelectionModal = ({ isOpen, onClose, onConfirm, track }) => {
    const [beatOptions, setBeatOptions] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !track) return;

        setIsLoading(true);
        setBeatOptions([]);
        setSelectedIndex(0);

        searchBeatVariants(track.cleanTitle || track.title, track.artist, track.videoId)
            .then((results) => {
                if (results.length > 0) {
                    setBeatOptions(results);
                } else {
                    // No beat options found, use the original track as the only option
                    setBeatOptions([{
                        videoId: track.videoId,
                        title: track.title,
                        cleanTitle: track.cleanTitle || track.title,
                        thumbnail: track.thumbnail,
                        artist: track.artist,
                        viewCount: track.viewCount || 0,
                        views: track.views || '0',
                        duration: track.duration || '',
                        beatLabel: 'Beat gốc',
                        tags: track.tags || [],
                    }]);
                }
            })
            .finally(() => setIsLoading(false));
    }, [isOpen, track]);

    const handleConfirm = () => {
        const selectedBeat = beatOptions[selectedIndex];
        if (!selectedBeat) return;
        onConfirm(selectedBeat, beatOptions);
    };

    // Skip beat selection — use original track directly
    const handleSkip = () => {
        if (!track) return;
        onConfirm({
            videoId: track.videoId,
            title: track.title,
            cleanTitle: track.cleanTitle || track.title,
            thumbnail: track.thumbnail,
            artist: track.artist,
            viewCount: track.viewCount || 0,
            views: track.views || '0',
            duration: track.duration || '',
            beatLabel: 'Beat gốc',
            tags: track.tags || [],
        }, []);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Chọn Beat</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors cursor-pointer">
                        <X size={28} className="text-slate-500" />
                    </button>
                </div>

                <div className="p-4 flex-1 overflow-hidden flex flex-col gap-4">
                    {/* Song Info */}
                    <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100">
                        <p className="text-xs font-bold text-indigo-400 uppercase tracking-wide mb-1">Chọn beat cho</p>
                        <p className="text-xl font-bold text-indigo-900 leading-tight">{track?.cleanTitle || track?.title}</p>
                        {track?.artist && (
                            <p className="text-sm font-bold text-indigo-500 mt-1">{track.artist}</p>
                        )}
                    </div>

                    {/* Loading */}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <Loader2 size={32} className="text-indigo-500 animate-spin" />
                            <p className="text-sm font-bold text-slate-400">Đang tìm beat...</p>
                        </div>
                    )}

                    {/* Beat Options */}
                    {!isLoading && beatOptions.length > 0 && (
                        <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2 space-y-2">
                            {beatOptions.map((beat, index) => (
                                <button
                                    key={beat.videoId}
                                    onClick={() => setSelectedIndex(index)}
                                    className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 group cursor-pointer border ${
                                        index === selectedIndex
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200'
                                            : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-100 hover:border-slate-200'
                                    }`}
                                >
                                    {/* Thumbnail */}
                                    <div className="w-28 h-20 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                                        <img src={beat.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-black uppercase tracking-wide mb-0.5 ${
                                            index === selectedIndex ? 'text-indigo-200' : 'text-indigo-500'
                                        }`}>
                                            {beat.beatLabel}
                                        </p>
                                        <p className={`text-sm font-bold leading-snug truncate ${
                                            index === selectedIndex ? 'text-white' : 'text-slate-800'
                                        }`}>
                                            {beat.title}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] font-bold ${
                                                index === selectedIndex ? 'text-indigo-200' : 'text-slate-400'
                                            }`}>
                                                {beat.artist}
                                            </span>
                                            {beat.viewCount > 0 && (
                                                <span className={`text-[10px] font-bold ${
                                                    index === selectedIndex ? 'text-indigo-200' : 'text-slate-400'
                                                }`}>
                                                    · {formatViews(beat.viewCount)} views
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Check mark */}
                                    {index === selectedIndex && (
                                        <div className="flex-shrink-0">
                                            <Check size={24} className="text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* No results */}
                    {!isLoading && beatOptions.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400">
                            <Music size={48} strokeWidth={1} />
                            <p className="text-sm font-bold">Không tìm thấy beat nào</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                    <Button variant="ghost" onClick={handleSkip} size="lg" className="text-slate-500 hover:text-slate-700 font-bold text-lg">
                        Bỏ qua
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isLoading || beatOptions.length === 0}
                        size="lg"
                        className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-lg disabled:opacity-50"
                    >
                        Xác Nhận Beat
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default BeatSelectionModal;
