import React, { useState, useRef, useCallback } from 'react';
import { useAppStore } from '../core/store';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Trash2, GripVertical, X, Play, ArrowUpToLine } from 'lucide-react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import { removeFromFirebaseQueue, setNowPlaying } from '../../services/firebaseQueueService';

const QueueItem = React.memo(({ item, index, onRemove, onReplace, onPlay, onInvite, isFirst, hasCurrentSong, queueMode, invitedSongId, onDrag, onDragEnd }) => {
    const dragControls = useDragControls();

    return (
        <Reorder.Item
            value={item}
            id={item.id}
            dragListener={false}
            dragControls={dragControls}
            layout="position"
            className="relative"
            whileDrag={{ scale: 1.05, zIndex: 50, cursor: 'grabbing' }}
            onDrag={(event, info) => onDrag && onDrag(event, info, item)}
            onDragEnd={(event, info) => onDragEnd && onDragEnd(event, info, item)}
        >
            <Card className="flex flex-col gap-2 p-2 border-0 shadow-sm relative group rounded-lg select-none">
                <div className="flex items-start gap-3">
                    <div
                        className="text-slate-300 mt-1 cursor-grab active:cursor-grabbing hover:text-slate-500 transition-colors touch-none p-1"
                        onPointerDown={(e) => dragControls.start(e)}
                    >
                        <GripVertical size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 text-sm leading-snug truncate uppercase tracking-tight" title={item.title}>{item.title || 'Không có tiêu đề'}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider">{item.addedBy}</span>
                            {item.isPriority && (
                                <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded border border-red-600 uppercase tracking-wider">
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

                    <div className="flex items-center gap-0.5">
                        {hasCurrentSong && (
                            <button
                                onClick={() => onReplace(item)}
                                className="text-slate-300 hover:text-indigo-500 transition-colors p-1 rounded-md cursor-pointer active:scale-90"
                                title="Thay thế bài đang phát"
                            >
                                <ArrowUpToLine size={16} />
                            </button>
                        )}
                        <button
                            onClick={() => onRemove(item.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded-md cursor-pointer active:scale-90"
                            title="Xóa"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
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
}, (prev, next) => prev.item.id === next.item.id && prev.isFirst === next.isFirst && prev.hasCurrentSong === next.hasCurrentSong && prev.queueMode === next.queueMode && prev.invitedSongId === next.invitedSongId);

const QueueList = ({ onReAnnounce }) => {
    const { queue, removeFromQueue, currentSong, setCurrentSong, setIsPlaying, isPlaying, reorderQueue, queueMode, invitedSongId, setInvitedSongId, waitingForGuest } = useAppStore();
    const [showClearModal, setShowClearModal] = useState(false);
    const [songToDelete, setSongToDelete] = useState(null);
    const [replacementItem, setReplacementItem] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const nowPlayingRef = useRef(null);

    const handleRemove = (itemId) => {
        const item = queue.find(i => i.id === itemId);
        if (item) {
            setSongToDelete(item);
        }
    };

    const handleReplace = (item) => {
        setReplacementItem(item);
    };

    const confirmRemoveSong = () => {
        if (!songToDelete) return;

        if (currentSong?.id === songToDelete.id) {
            setCurrentSong(null);
            setIsPlaying(false);
        }
        removeFromQueue(songToDelete.id);
        // Cancel (not complete) — don't advance startRound
        if (songToDelete.firebaseKey) {
            removeFromFirebaseQueue(songToDelete.firebaseKey).catch(() => { });
        }
        setSongToDelete(null);
    };

    const handlePlay = (item) => {
        setCurrentSong(item);
        removeFromQueue(item.id);
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

    // --- DRAG HELPER ---
    const checkDropZone = (point) => {
        if (!nowPlayingRef.current) return false;
        const rect = nowPlayingRef.current.getBoundingClientRect();
        return (
            point.x >= rect.left &&
            point.x <= rect.right &&
            point.y >= rect.top &&
            point.y <= rect.bottom
        );
    };

    // Called continuously while dragging
    const handleDrag = useCallback((event, info, item) => {
        const isOver = checkDropZone(info.point);
        if (isOver !== isDragOver) {
            setIsDragOver(isOver);
        }
    }, [isDragOver]);

    // Called when drop
    const handleDragEnd = useCallback((event, info, item) => {
        const isOver = checkDropZone(info.point);
        setIsDragOver(false); // Reset UI
        if (isOver) {
            setReplacementItem(item);
        }
    }, []);

    const handleConfirmReplace = async () => {
        if (!replacementItem) return;

        try {
            await removeFromFirebaseQueue(replacementItem.id);
            await setNowPlaying(replacementItem);

            removeFromQueue(replacementItem.id);
            setCurrentSong({ ...replacementItem, isReplaced: true });
            setIsPlaying(false);
        } catch (error) {
            console.error("Replace failed:", error);
        }

        setReplacementItem(null);
    };


    return (
        <div className="space-y-4">
            <div className="space-y-4">
                {/* NOW PLAYING SECTION */}
                <AnimatePresence>
                    {currentSong ? (
                        <motion.div
                            ref={nowPlayingRef}
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`mb-6 relative rounded-2xl border-2 border-dashed transition-colors duration-200 ${isDragOver ? 'border-slate-300 p-1.5' : 'border-transparent p-1.5'}`}
                        >
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <span className={`inline-flex rounded-full h-3 w-3 ${isPlaying ? 'bg-indigo-500' : 'bg-orange-500'}`}></span>
                                <h2 className={`text-xs font-black uppercase tracking-widest ${isPlaying ? 'text-indigo-500' : 'text-orange-500'}`}>
                                    {isDragOver ? 'Thả để thay thế' : waitingForGuest ? 'Đang Chờ Khách...' : isPlaying ? 'Đang Phát' : 'Sẵn Sàng'}
                                </h2>
                            </div>

                            <Card className={`p-3 border-0 relative rounded-xl text-white shadow-sm overflow-hidden ${isPlaying ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                                {/* Background Decorations */}
                                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                                <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full -ml-8 -mb-8"></div>

                                <div className="flex items-center gap-3 relative z-10">
                                    {/* Animated Icon or Play Button */}
                                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/10 cursor-pointer hover:bg-white/30 transition-colors"
                                        onClick={() => setIsPlaying(!isPlaying)}
                                    >
                                        {isPlaying ? (
                                            <div className="flex gap-0.5 items-end h-3">
                                                <div className="w-0.5 bg-white h-1.5"></div>
                                                <div className="w-0.5 bg-white h-3"></div>
                                                <div className="w-0.5 bg-white h-2"></div>
                                                <div className="w-0.5 bg-white h-2.5"></div>
                                            </div>
                                        ) : (
                                            <Play size={20} className="text-white fill-current ml-0.5" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-sm leading-normal truncate mb-0.5" title={currentSong.title} style={{ paddingBottom: '2px' }}>{currentSong.title}</h3>
                                        <div className="flex items-center text-[10px] text-white/80 gap-1.5">
                                            <div className="flex items-center gap-1 bg-white/20 px-1.5 py-0.5 rounded-md border border-white/10">
                                                <span className="opacity-70 font-medium">Hát:</span>
                                                <span className="font-black text-white uppercase truncate max-w-[80px]">{currentSong.addedBy || 'Khách'}</span>
                                            </div>
                                            {!isPlaying && (
                                                <span className="text-orange-300 font-bold text-[9px] uppercase border border-orange-500/50 px-1.5 py-0.5 rounded ml-auto">
                                                    Đang chờ phát
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Controls */}
                                {queueMode === 'manual' && !isPlaying && (
                                    <div className="mt-2 pt-2 border-t border-white/20 flex gap-2 relative z-10">
                                        {!isPlaying && (
                                            <button
                                                onClick={() => setIsPlaying(true)}
                                                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider rounded-lg transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1 shadow-lg shadow-green-900/20"
                                            >
                                                <Play size={12} fill="currentColor" /> Phát Ngay
                                            </button>
                                        )}
                                        <button
                                            onClick={onReAnnounce}
                                            className="flex-1 bg-white/20 hover:bg-white/30 text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider rounded-lg transition-all cursor-pointer active:scale-95"
                                        >
                                            🎤 Mời Lại
                                        </button>
                                    </div>
                                )}
                            </Card>
                        </motion.div>
                    ) : null}
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
                                    onReplace={handleReplace}
                                    onPlay={handlePlay}
                                    onInvite={handleInvite}
                                    isFirst={!currentSong && index === 0}
                                    hasCurrentSong={!!currentSong}
                                    queueMode={queueMode}
                                    invitedSongId={invitedSongId}
                                    onDrag={handleDrag}
                                    onDragEnd={handleDragEnd}
                                />
                            ))}
                        </AnimatePresence>
                    </Reorder.Group>
                </div>
            </div>

            {/* Replacement Confirmation Modal */}
            {replacementItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 bg-indigo-50 flex justify-between items-center">
                            <h3 className="text-lg font-black text-indigo-800 uppercase tracking-tighter">Thay Thế Bài Hát</h3>
                            <button onClick={() => setReplacementItem(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"><X size={20} className="text-slate-500" /></button>
                        </div>

                        {/* Body: Swap Visual */}
                        <div className="p-5 space-y-3">
                            {/* Current Song — faded */}
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 opacity-50">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Đang Phát</span>
                                <h4 className="font-bold text-slate-500 text-sm line-clamp-2 line-through mt-1">{currentSong?.title || 'Không có bài'}</h4>
                                {currentSong?.addedBy && (
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider mt-1.5 inline-block">
                                        {currentSong.addedBy}
                                    </span>
                                )}
                            </div>

                            {/* Swap Arrow */}
                            <div className="flex justify-center">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                    <ArrowUpToLine size={16} className="text-indigo-600 rotate-180" />
                                </div>
                            </div>

                            {/* Replacement Song — highlighted */}
                            <div className="bg-indigo-50 p-3 rounded-xl border-2 border-indigo-200">
                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Bài Mới</span>
                                <h4 className="font-black text-slate-800 text-sm line-clamp-2 mt-1">{replacementItem.title}</h4>
                                {replacementItem.addedBy && (
                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 uppercase tracking-wider mt-1.5 inline-block">
                                        {replacementItem.addedBy}
                                    </span>
                                )}
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-50 flex gap-3 border-t border-slate-100">
                            <Button onClick={() => setReplacementItem(null)} variant="ghost" className="font-bold text-slate-600 px-4">Hủy</Button>
                            <Button onClick={handleConfirmReplace} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black">Thay Thế</Button>
                        </div>
                    </div>
                </div>
            )}

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
        </div>
    );
};

export default QueueList;
