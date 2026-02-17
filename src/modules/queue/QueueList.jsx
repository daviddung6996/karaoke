import { useState, useRef } from 'react';
import { useAppStore } from '../core/store';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Trash2, GripVertical, X, ArrowUpCircle } from 'lucide-react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';

// Module-level ref for Now Playing card element (used by QueueItem to detect overlap)
let _nowPlayingEl = null;


const QueueItem = ({ item, index, onRemove, onPlay, onInvite, isFirst, queueMode, invitedSongId, onDragOverNowPlaying, onDropOnNowPlaying }) => {
    const dragControls = useDragControls();
    const wasOverRef = useRef(false);

    const checkOverlap = (event) => {
        if (!_nowPlayingEl) return false;
        const rect = _nowPlayingEl.getBoundingClientRect();
        const y = event.clientY ?? event.touches?.[0]?.clientY ?? 0;
        const x = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
        return y >= rect.top && y <= rect.bottom && x >= rect.left && x <= rect.right;
    };

    const handleDrag = (event) => {
        const isOver = checkOverlap(event);
        if (isOver !== wasOverRef.current) {
            wasOverRef.current = isOver;
            onDragOverNowPlaying?.(isOver);
        }
    };

    const handleDragEnd = (event) => {
        if (wasOverRef.current) {
            wasOverRef.current = false;
            onDragOverNowPlaying?.(false);
            onDropOnNowPlaying?.(item);
        } else {
            wasOverRef.current = false;
            onDragOverNowPlaying?.(false);
        }
    };

    return (
        <Reorder.Item
            value={item}
            id={item.id}
            dragListener={false}
            dragControls={dragControls}
            layout="position"
            className="relative"
            whileDrag={{ scale: 1.02 }}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
        >
            <Card className="flex flex-col gap-2 p-2 border-0 shadow-sm relative group rounded-lg select-none">
                <div className="flex items-start gap-3">
                    <div
                        className="text-slate-300 mt-1 cursor-grab active:cursor-grabbing hover:text-slate-500 transition-colors touch-none"
                        onPointerDown={(e) => dragControls.start(e)}
                    >
                        <GripVertical size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 text-sm leading-snug truncate uppercase tracking-tight" title={item.title}>{item.title || 'Không có tiêu đề'}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider">{item.addedBy}</span>
                            {item.isPriority && (
                                <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded border border-red-600 uppercase tracking-wider animate-pulse">
                                    Ưu Tiên
                                </span>
                            )}
                            {item.round && !item.isPriority && (
                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-wider">
                                    Vòng {item.round}
                                </span>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => onRemove(item.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded-md cursor-pointer active:scale-90"
                        title="Xóa"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>

                {isFirst && queueMode === 'manual' && (
                    <div className="mt-1 pt-2 border-t border-slate-100 flex gap-2">
                        <Button size="sm" onClick={() => onInvite(item)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider flex-1">
                            Mời Lên Sân Khấu
                        </Button>
                        <Button size="sm" onClick={() => onPlay(item)} className={`text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider flex-1 ${invitedSongId === item.id ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-800 hover:bg-slate-900'}`}>
                            Phát Ngay
                        </Button>
                    </div>
                )}
                {isFirst && queueMode === 'auto' && (
                    <div className="mt-1 pt-2 border-t border-slate-100 flex justify-end">
                        <Button size="sm" onClick={() => onPlay(item)} className="bg-slate-800 hover:bg-slate-900 text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider w-full">
                            Phát Ngay
                        </Button>
                    </div>
                )}
            </Card>
        </Reorder.Item>
    );
};

const QueueList = ({ onReAnnounce }) => {
    const { queue, removeFromQueue, currentSong, setCurrentSong, setIsPlaying, isPlaying, reorderQueue, queueMode, invitedSongId, setInvitedSongId, waitingForGuest, setWaitingForGuest } = useAppStore();
    const [showClearModal, setShowClearModal] = useState(false);
    const [songToDelete, setSongToDelete] = useState(null);
    const [songToReplace, setSongToReplace] = useState(null);
    const [isDragOverNowPlaying, setIsDragOverNowPlaying] = useState(false);
    const nowPlayingRef = useRef(null);

    const handleRemove = (itemId) => {
        const item = queue.find(i => i.id === itemId);
        if (item) {
            setSongToDelete(item);
        }
    };

    const confirmRemoveSong = () => {
        if (!songToDelete) return;

        // If deleting the currently playing song (rare case for this button), clear currentSong
        if (currentSong?.id === songToDelete.id) {
            setCurrentSong(null);
            setIsPlaying(false);
        }
        removeFromQueue(songToDelete.id);
        setSongToDelete(null);
    };

    const handlePlay = (item) => {
        setCurrentSong(item);
        removeFromQueue(item.id);
        // Don't auto-play — let the doAnnounceAndPlay effect handle it
    };

    const handleInvite = (item) => {
        setInvitedSongId(item.id);
    };

    const handleClearQueue = async () => {
        try {
            const { clearFirebaseQueue } = await import('../../services/firebaseQueueService');
            await clearFirebaseQueue();
            queue.forEach((item) => removeFromQueue(item.id));
            setShowClearModal(false);
        } catch (err) {
            console.error('[QueueList] Clear queue failed:', err);
        }
    };

    // --- Drag-to-Replace handlers ---
    // Keep _nowPlayingEl in sync with ref
    const setNowPlayingRef = (el) => {
        nowPlayingRef.current = el;
        _nowPlayingEl = el;
    };

    const handleDragOverNowPlaying = (isOver) => {
        setIsDragOverNowPlaying(isOver);
    };

    const handleDropOnNowPlaying = (item) => {
        setSongToReplace(item);
    };

    const confirmReplaceSong = () => {
        if (!songToReplace) return;
        // Stage the song: skip TTS announcement & waiting, go straight to paused/ready
        const stagedSong = { ...songToReplace, isStaged: true };
        setIsPlaying(false);
        setWaitingForGuest(false);
        setInvitedSongId(null);
        setCurrentSong(stagedSong);
        removeFromQueue(songToReplace.id);
        setSongToReplace(null);
    };

    return (
        <div className="space-y-4">
            <div className="space-y-4">
                {/* NOW PLAYING SECTION */}
                <AnimatePresence>
                    {currentSong && (
                        <motion.div
                            ref={setNowPlayingRef}
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mb-6"
                        >
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                                </span>
                                <h2 className="text-xs font-black text-indigo-500 uppercase tracking-widest">
                                    {waitingForGuest ? 'Đang Chờ Khách...' : isPlaying ? 'Đang Phát' : 'Sẵn Sàng'}
                                </h2>
                            </div>

                            <Card className={`p-3 bg-indigo-600 border-0 relative rounded-xl text-white shadow-sm overflow-hidden transition-all duration-200 ${isDragOverNowPlaying ? 'ring-3 ring-amber-400 ring-offset-2 scale-[1.02] bg-indigo-500' : ''}`}>
                                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>

                                {/* Drag-over overlay hint */}
                                {isDragOverNowPlaying && (
                                    <div className="absolute inset-0 bg-amber-400/20 z-20 flex items-center justify-center rounded-xl">
                                        <div className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg">
                                            <ArrowUpCircle size={18} />
                                            <span className="text-xs font-black uppercase tracking-wider">Thả để thay thế</span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 relative z-10">
                                    {/* Animated Icon */}
                                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/10">
                                        <div className="flex gap-0.5 items-end h-3">
                                            <div className="w-0.5 bg-white animate-[bounce_1s_infinite] h-1.5"></div>
                                            <div className="w-0.5 bg-white animate-[bounce_1.2s_infinite] h-3"></div>
                                            <div className="w-0.5 bg-white animate-[bounce_0.8s_infinite] h-2"></div>
                                            <div className="w-0.5 bg-white animate-[bounce_1.1s_infinite] h-2.5"></div>
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-sm leading-normal truncate mb-0.5" title={currentSong.title} style={{ paddingBottom: '2px' }}>{currentSong.title}</h3>
                                        <div className="flex items-center text-[10px] text-indigo-100 gap-1.5">
                                            <span className="truncate max-w-[80px] opacity-80" style={{ display: 'none' }}>{currentSong.artist}</span>
                                            <span className="w-0.5 h-0.5 rounded-full bg-white/50 shrink-0" style={{ display: 'none' }}></span>
                                            <div className="flex items-center gap-1 bg-white/20 px-1.5 py-0.5 rounded-md border border-white/10">
                                                <span className="opacity-70 font-medium">Hát:</span>
                                                <span className="font-black text-white uppercase truncate max-w-[80px]">{currentSong.addedBy || 'Khách'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Manual mode: re-announce & play buttons */}
                                {queueMode === 'manual' && !isPlaying && (
                                    <div className="mt-2 pt-2 border-t border-white/20 flex gap-2 relative z-10">
                                        <button
                                            onClick={onReAnnounce}
                                            className="flex-1 bg-white/20 hover:bg-white/30 text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider rounded-lg transition-all cursor-pointer active:scale-95"
                                        >
                                            🎤 Mời Lên Lại
                                        </button>
                                    </div>
                                )}
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* WAITING QUEUE SECTION */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end px-1 mb-2">
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Hàng Chờ</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{queue.length}</span>
                            {queue.length > 0 && (
                                <button
                                    onClick={() => setShowClearModal(true)}
                                    className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md cursor-pointer active:scale-90 hover:bg-red-50"
                                    title="Xóa hàng chờ"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {queue.length === 0 && !currentSong && (
                        <div className="text-center py-10 text-slate-300 text-xs font-bold uppercase tracking-widest">
                            Chưa có bài nào
                        </div>
                    )}

                    <Reorder.Group axis="y" values={queue} onReorder={reorderQueue} className="space-y-2">
                        <AnimatePresence>
                            {queue.map((item, index) => (
                                <QueueItem
                                    key={item.id}
                                    item={item}
                                    index={index}
                                    onRemove={handleRemove}
                                    onPlay={handlePlay}
                                    onInvite={handleInvite}
                                    isFirst={!currentSong && index === 0}
                                    queueMode={queueMode}
                                    invitedSongId={invitedSongId}
                                    onDragOverNowPlaying={handleDragOverNowPlaying}
                                    onDropOnNowPlaying={handleDropOnNowPlaying}
                                />
                            ))}
                        </AnimatePresence>
                    </Reorder.Group>
                </div>
            </div>

            {/* Clear Queue Confirmation Modal */}
            {showClearModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl transform transition-all scale-100">
                        <div className="p-4 border-b border-slate-100 bg-red-50 flex justify-between items-center">
                            <h3 className="text-lg font-black text-red-600 uppercase tracking-tighter">Xóa Hàng Chờ?</h3>
                            <button onClick={() => setShowClearModal(false)} className="p-2 hover:bg-red-100 rounded-full transition-colors"><X size={20} className="text-red-500" /></button>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-700 font-bold mb-1">Bạn muốn xóa tất cả <span className="text-red-600">{queue.length}</span> bài hát?</p>
                            <p className="text-xs text-slate-500 font-medium">Hành động này không thể hoàn tác.</p>
                        </div>
                        <div className="p-4 bg-slate-50 flex gap-3 border-t border-slate-100">
                            <Button onClick={() => setShowClearModal(false)} variant="ghost" className="flex-1 font-bold text-slate-600">Hủy</Button>
                            <Button onClick={handleClearQueue} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black">Xóa Tất Cả</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Single Song Delete Modal */}
            {songToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl transform transition-all scale-100">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Xác Nhận Xóa</h3>
                            <button onClick={() => setSongToDelete(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-600 font-medium mb-2">Bạn có chắc muốn xóa bài hát này?</p>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <h4 className="font-black text-slate-800 text-sm line-clamp-2">{songToDelete.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Hát:</span>
                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">{songToDelete.addedBy}</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 flex gap-3 border-t border-slate-100">
                            <Button onClick={() => setSongToDelete(null)} variant="ghost" className="flex-1 font-bold text-slate-600">Giữ Lại</Button>
                            <Button onClick={confirmRemoveSong} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black">Xóa Bài</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Replace Song Confirmation Modal */}
            {songToReplace && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl transform transition-all scale-100">
                        <div className="p-4 border-b border-slate-100 bg-amber-50 flex justify-between items-center">
                            <h3 className="text-lg font-black text-amber-700 uppercase tracking-tighter">Thay Thế Bài Hát?</h3>
                            <button onClick={() => setSongToReplace(null)} className="p-2 hover:bg-amber-100 rounded-full transition-colors"><X size={20} className="text-amber-600" /></button>
                        </div>
                        <div className="p-6 space-y-3">
                            <p className="text-slate-600 font-medium text-sm">Bạn muốn thay thế bài đang {isPlaying ? 'phát' : 'sẵn sàng'}?</p>

                            {/* Current song */}
                            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className="text-[9px] font-black text-red-500 uppercase tracking-wider">Bỏ</span>
                                </div>
                                <h4 className="font-black text-slate-800 text-sm line-clamp-1">{currentSong?.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Hát:</span>
                                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded border border-red-200 uppercase">{currentSong?.addedBy}</span>
                                </div>
                            </div>

                            {/* Arrow */}
                            <div className="flex justify-center">
                                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                                    <ArrowUpCircle size={14} className="text-amber-600 rotate-180" />
                                </div>
                            </div>

                            {/* Replacement song */}
                            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className="text-[9px] font-black text-green-600 uppercase tracking-wider">Thay bằng</span>
                                </div>
                                <h4 className="font-black text-slate-800 text-sm line-clamp-1">{songToReplace.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Hát:</span>
                                    <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded border border-green-200 uppercase">{songToReplace.addedBy}</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 flex gap-3 border-t border-slate-100">
                            <Button onClick={() => setSongToReplace(null)} variant="ghost" className="flex-1 font-bold text-slate-600">Hủy</Button>
                            <Button onClick={confirmReplaceSong} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black">Thay Thế</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QueueList;
