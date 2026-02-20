import React, { useState, useRef, useCallback } from 'react';
import { useAppStore } from '../core/store';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Trash2, GripVertical, X, Play, ArrowUpToLine, Disc3 } from 'lucide-react';
import { removeFromFirebaseQueue, setNowPlaying } from '../../services/firebaseQueueService';

// ─── Drag-to-Reorder via pure pointer events ───
// Songs are NEVER removed from the array during drag.
// We only swap indices in a local copy, then commit on drop.

/**
 * Calculate translateY shift for each item during drag.
 * Items between from↔to slide to make room for the dragged item.
 */
function calcShift(index, dragIndex, overIndex, itemHeight) {
    if (dragIndex == null || overIndex == null || overIndex < 0) return 0;
    if (index === dragIndex) return 0; // dragged item stays in place (faded)

    // Dragging UP: items between [overIndex, dragIndex-1] shift DOWN
    if (overIndex < dragIndex) {
        if (index >= overIndex && index < dragIndex) return itemHeight;
    }
    // Dragging DOWN: items between [dragIndex+1, overIndex] shift UP
    if (overIndex > dragIndex) {
        if (index > dragIndex && index <= overIndex) return -itemHeight;
    }
    return 0;
}

const QueueItem = React.memo(({ item, index, onRemove, onReplace, onPlay, onInvite, onWaitForSong, onChooseForGuest, onSkipWaiting, isFirst, hasCurrentSong, queueMode, invitedSongId, dragState, onDragStart, itemHeight }) => {
    const isDragging = dragState?.dragIndex === index;
    const shift = dragState ? calcShift(index, dragState.dragIndex, dragState.overIndex, itemHeight) : 0;

    return (
        <div
            className={`queue-item relative ${isDragging ? 'opacity-20 scale-[0.96]' : ''}`}
            data-index={index}
            style={{
                transform: isDragging ? 'scale(0.96)' : `translateY(${shift}px)`,
                transition: dragState ? 'transform 200ms cubic-bezier(0.2, 0, 0, 1)' : 'none',
                zIndex: isDragging ? 0 : shift !== 0 ? 2 : 1,
            }}
        >
            <Card className={`flex flex-col gap-2 p-2 border-0 shadow-sm relative group rounded-lg select-none ${item.status === 'waiting' ? 'bg-amber-50 border border-amber-200' :
                    item.status === 'skipped' ? 'opacity-50 bg-slate-50' :
                        item.wasSkipped && item.status === 'ready' ? 'bg-green-50 border-2 border-green-300 animate-pulse' :
                            ''
                }`}>
                <div className="flex items-start gap-3">
                    {/* Drag Handle */}
                    <div
                        className="text-slate-300 mt-1 cursor-grab active:cursor-grabbing hover:text-slate-500 transition-colors touch-none p-1"
                        onPointerDown={(e) => onDragStart(e, index)}
                    >
                        <GripVertical size={16} />
                    </div>

                    {/* Song Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className={`font-bold text-sm leading-snug truncate uppercase tracking-tight ${item.status === 'waiting' ? 'text-amber-700' :
                                item.status === 'skipped' ? 'text-slate-400' :
                                    'text-slate-800'
                            }`} title={item.title || 'Chờ chọn bài'}>
                            {item.status === 'waiting' ? `${item.addedBy} - ⏳ Chờ chọn bài` : (item.title || 'Không có tiêu đề')}
                        </h3>
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
                            {item.status === 'waiting' && (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 uppercase tracking-wider">
                                    Chờ Bài
                                </span>
                            )}
                            {item.status === 'skipped' && (
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider">
                                    Đã Bỏ Qua
                                </span>
                            )}
                            {item.wasSkipped && item.status === 'ready' && (
                                <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded border border-green-200 uppercase tracking-wider">
                                    Đã Chọn Bài
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
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

                {/* First-item controls */}
                {isFirst && item.status === 'waiting' && (
                    <div className="mt-1 pt-2 border-t border-amber-200 flex gap-2">
                        <Button size="sm" onClick={() => onWaitForSong && onWaitForSong(item)} className="bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider flex-1">
                            Chờ Chọn Bài
                        </Button>
                        <Button size="sm" onClick={() => onChooseForGuest && onChooseForGuest(item)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider flex-1">
                            Chọn Hộ
                        </Button>
                        <Button size="sm" onClick={() => onSkipWaiting && onSkipWaiting(item)} className="bg-slate-500 hover:bg-slate-600 text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider flex-1">
                            Bỏ Qua
                        </Button>
                    </div>
                )}
                {isFirst && item.status !== 'waiting' && queueMode === 'manual' && (
                    <div className="mt-1 pt-2 border-t border-slate-100 flex gap-2">
                        <Button size="sm" onClick={() => onInvite(item)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider flex-1">
                            Mời Lên Sân Khấu
                        </Button>
                        <Button size="sm" onClick={() => onPlay(item)} className={`text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider flex-1 ${invitedSongId === item.id ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-800 hover:bg-slate-900'}`}>
                            Phát Ngay
                        </Button>
                    </div>
                )}
                {isFirst && item.status !== 'waiting' && queueMode === 'auto' && (
                    <div className="mt-1 pt-2 border-t border-slate-100 flex justify-end">
                        <Button size="sm" onClick={() => onPlay(item)} className="bg-slate-800 hover:bg-slate-900 text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider w-full">
                            Phát Ngay
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
}, (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item.status === next.item.status &&
    prev.item.wasSkipped === next.item.wasSkipped &&
    prev.index === next.index &&
    prev.isFirst === next.isFirst &&
    prev.hasCurrentSong === next.hasCurrentSong &&
    prev.queueMode === next.queueMode &&
    prev.invitedSongId === next.invitedSongId &&
    prev.dragState === next.dragState &&
    prev.itemHeight === next.itemHeight
);

const QueueList = ({ onReAnnounce, onWaitForSong, onChooseForGuest, onSkipWaiting, onAddGuest, onChangeBeat }) => {
    const queue = useAppStore((s) => s.queue);
    const removeFromQueue = useAppStore((s) => s.removeFromQueue);
    const currentSong = useAppStore((s) => s.currentSong);
    const setCurrentSong = useAppStore((s) => s.setCurrentSong);
    const setIsPlaying = useAppStore((s) => s.setIsPlaying);
    const isPlaying = useAppStore((s) => s.isPlaying);
    const reorderQueue = useAppStore((s) => s.reorderQueue);
    const setManualOrder = useAppStore((s) => s.setManualOrder);
    const queueMode = useAppStore((s) => s.queueMode);
    const invitedSongId = useAppStore((s) => s.invitedSongId);
    const setInvitedSongId = useAppStore((s) => s.setInvitedSongId);
    const waitingForGuest = useAppStore((s) => s.waitingForGuest);
    const [showClearModal, setShowClearModal] = useState(false);
    const [songToDelete, setSongToDelete] = useState(null);
    const [replacementItem, setReplacementItem] = useState(null);
    const nowPlayingRef = useRef(null);
    const listRef = useRef(null);

    // ─── Native Pointer Drag State ───
    const [dragState, setDragState] = useState(null); // { dragIndex, overIndex, overNP }
    const [itemHeight, setItemHeight] = useState(0);
    const dragRef = useRef({ active: false, startIndex: -1 });
    const scrollRAF = useRef(null);

    // Find the scrollable parent (overflow-y-auto container)
    const getScrollContainer = useCallback(() => {
        return listRef.current?.closest('.overflow-y-auto');
    }, []);

    const getIndexFromPoint = useCallback((y) => {
        if (!listRef.current) return -1;
        const items = listRef.current.querySelectorAll('.queue-item');
        for (let i = 0; i < items.length; i++) {
            const rect = items[i].getBoundingClientRect();
            // 30% threshold — chỉ cần vào 1/3 trên của item là trigger
            const threshold = rect.top + rect.height * 0.3;
            if (y < threshold) return i;
        }
        return items.length - 1;
    }, []);

    const isOverNowPlaying = useCallback((x, y) => {
        if (!nowPlayingRef.current) return false;
        const rect = nowPlayingRef.current.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }, []);

    const handleDragStart = useCallback((e, index) => {
        e.preventDefault();
        e.target.setPointerCapture(e.pointerId);
        dragRef.current = { active: true, startIndex: index };

        const items = listRef.current?.querySelectorAll('.queue-item');
        let ghost = null;
        let offsetY = 0;

        if (items?.[index]) {
            const rect = items[index].getBoundingClientRect();
            setItemHeight(rect.height + 8);
            offsetY = e.clientY - rect.top;

            // Create floating ghost clone
            ghost = items[index].cloneNode(true);
            ghost.style.cssText = `
                position: fixed;
                left: ${rect.left}px;
                top: ${e.clientY - offsetY}px;
                width: ${rect.width}px;
                z-index: 9999;
                pointer-events: none;
                opacity: 0.9;
                transform: scale(1.03);
                box-shadow: 0 12px 32px rgba(0,0,0,0.18);
                border-radius: 12px;
                transition: transform 0.15s, box-shadow 0.15s;
            `;
            document.body.appendChild(ghost);
        }

        setDragState({ dragIndex: index, overIndex: index, overNP: false });

        // ─── Auto-scroll edge detection ───
        const EDGE_ZONE = 60;
        const SCROLL_SPEED = 8;

        const autoScroll = (clientY) => {
            const container = getScrollContainer();
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const distFromTop = clientY - rect.top;
            const distFromBottom = rect.bottom - clientY;

            if (distFromTop < EDGE_ZONE && container.scrollTop > 0) {
                const speed = SCROLL_SPEED * (1 - distFromTop / EDGE_ZONE);
                container.scrollTop -= speed;
            } else if (distFromBottom < EDGE_ZONE && container.scrollTop < container.scrollHeight - container.clientHeight) {
                const speed = SCROLL_SPEED * (1 - distFromBottom / EDGE_ZONE);
                container.scrollTop += speed;
            }
        };

        let lastClientY = e.clientY;
        const scrollLoop = () => {
            if (!dragRef.current.active) return;
            autoScroll(lastClientY);
            scrollRAF.current = requestAnimationFrame(scrollLoop);
        };
        scrollRAF.current = requestAnimationFrame(scrollLoop);

        const onMove = (ev) => {
            if (!dragRef.current.active) return;
            lastClientY = ev.clientY;

            // Move ghost
            if (ghost) {
                ghost.style.top = `${ev.clientY - offsetY}px`;
            }

            const overNP = isOverNowPlaying(ev.clientX, ev.clientY);
            const overIdx = overNP ? -1 : getIndexFromPoint(ev.clientY);
            setDragState(prev => {
                if (prev?.overIndex === overIdx && prev?.overNP === overNP) return prev;
                return { dragIndex: dragRef.current.startIndex, overIndex: overIdx, overNP };
            });
        };

        const onUp = () => {
            if (scrollRAF.current) cancelAnimationFrame(scrollRAF.current);

            // Remove ghost
            if (ghost) {
                ghost.remove();
                ghost = null;
            }

            if (dragRef.current.active) {
                const from = dragRef.current.startIndex;
                dragRef.current.active = false;

                setDragState(prev => {
                    if (!prev) return null;
                    const currentQueue = useAppStore.getState().queue;
                    const draggedItem = currentQueue[from];

                    if (prev.overNP && draggedItem) {
                        setTimeout(() => setReplacementItem(draggedItem), 0);
                        return null;
                    }

                    if (prev.overIndex >= 0 && prev.overIndex !== from) {
                        const newQueue = [...currentQueue];
                        const [moved] = newQueue.splice(from, 1);
                        newQueue.splice(prev.overIndex, 0, moved);
                        reorderQueue(newQueue);
                        // Persist manual order so Firebase sync won't overwrite
                        setManualOrder(newQueue.map(i => i.id));
                    }
                    return null;
                });
            }
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    }, [getIndexFromPoint, isOverNowPlaying, getScrollContainer, reorderQueue]);

    const handleRemove = (itemId) => {
        const item = queue.find(i => i.id === itemId);
        if (item) setSongToDelete(item);
    };

    const handleReplace = (item) => setReplacementItem(item);

    const confirmRemoveSong = () => {
        if (!songToDelete) return;
        if (currentSong?.id === songToDelete.id) {
            setCurrentSong(null);
            setIsPlaying(false);
        }
        removeFromQueue(songToDelete.id);
        if (songToDelete.firebaseKey) {
            removeFromFirebaseQueue(songToDelete.firebaseKey).catch(() => { });
        }
        setSongToDelete(null);
    };

    const handlePlay = (item) => {
        setCurrentSong(item);
        removeFromQueue(item.id);
    };

    const handleInvite = (item) => setInvitedSongId(item.id);

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
                {currentSong ? (
                    <div
                        ref={nowPlayingRef}
                        className={`mb-6 relative rounded-2xl border-2 border-dashed transition-colors duration-200 ${dragState?.overNP ? 'border-indigo-400 bg-indigo-50/50 p-1.5' : 'border-transparent p-1.5'}`}
                    >
                        <div className="flex items-center gap-2 mb-2 px-1">
                            <span className={`inline-flex rounded-full h-3 w-3 ${currentSong.status === 'waiting' ? 'bg-amber-500' : isPlaying ? 'bg-indigo-500' : 'bg-orange-500'}`}></span>
                            <h2 className={`text-xs font-black uppercase tracking-widest ${currentSong.status === 'waiting' ? 'text-amber-500' : isPlaying ? 'text-indigo-500' : 'text-orange-500'}`}>
                                {currentSong.status === 'waiting' ? '⏳ Chờ Chọn Bài' : dragState?.overNP ? 'Thả để thay thế' : waitingForGuest ? 'Đang Chờ Khách...' : isPlaying ? 'Đang Phát' : 'Sẵn Sàng'}
                            </h2>
                        </div>

                        {currentSong.status === 'waiting' ? (
                            /* WAITING SLOT — special Now Playing card */
                            <Card className="p-3 border-2 border-amber-300 relative rounded-xl shadow-sm overflow-hidden bg-amber-50">
                                <div className="flex items-center gap-3 relative z-10">
                                    <div className="w-10 h-10 bg-amber-200 rounded-lg flex items-center justify-center flex-shrink-0 border border-amber-300">
                                        <span className="text-xl">⏳</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-amber-800 text-sm leading-normal truncate mb-0.5">{currentSong.addedBy || 'Khách'} - Chờ chọn bài</h3>
                                        <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 uppercase tracking-wider">
                                            Chờ Bài
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-2 pt-2 border-t border-amber-200 flex gap-2 relative z-10">
                                    <button
                                        onClick={() => onWaitForSong && onWaitForSong(currentSong)}
                                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider rounded-lg transition-all cursor-pointer active:scale-95"
                                    >
                                        🎤 Mời Chọn Bài
                                    </button>
                                    <button
                                        onClick={() => onChooseForGuest && onChooseForGuest(currentSong)}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider rounded-lg transition-all cursor-pointer active:scale-95"
                                    >
                                        Chọn Hộ
                                    </button>
                                    <button
                                        onClick={() => onSkipWaiting && onSkipWaiting(currentSong)}
                                        className="flex-1 bg-slate-500 hover:bg-slate-600 text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider rounded-lg transition-all cursor-pointer active:scale-95"
                                    >
                                        Bỏ Qua
                                    </button>
                                </div>
                            </Card>
                        ) : (
                            /* NORMAL Now Playing card */
                            <Card className={`p-3 border-0 relative rounded-xl text-white shadow-sm overflow-hidden ${isPlaying ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                                {/* Background Decorations */}
                                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                                <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full -ml-8 -mb-8"></div>

                                <div className="flex items-center gap-3 relative z-10">
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

                                {onChangeBeat && (
                                    <div className="mt-2 pt-2 border-t border-white/20 flex gap-2 relative z-10">
                                        <button
                                            onClick={onChangeBeat}
                                            className="flex-1 bg-white/20 hover:bg-white/30 text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider rounded-lg transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1"
                                        >
                                            <Disc3 size={12} /> Đổi Beat
                                        </button>
                                    </div>
                                )}
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
                        )}
                    </div>
                ) : null}

                {/* WAITING QUEUE SECTION */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end px-1 mb-2">
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Hàng Chờ</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{queue.length}</span>
                            {onAddGuest && (
                                <button
                                    onClick={onAddGuest}
                                    className="text-[10px] font-black text-white bg-amber-500 hover:bg-amber-600 px-2 py-0.5 rounded-full cursor-pointer active:scale-95 transition-all"
                                    title="Thêm khách giữ chỗ"
                                >
                                    + Khách
                                </button>
                            )}
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

                    {/* Native pointer drag list — songs stay in DOM at all times */}
                    <div ref={listRef} className="space-y-2">
                        {queue.map((item, index) => (
                            <QueueItem
                                key={item.id}
                                item={item}
                                index={index}
                                onRemove={handleRemove}
                                onReplace={handleReplace}
                                onPlay={handlePlay}
                                onInvite={handleInvite}
                                onWaitForSong={onWaitForSong}
                                onChooseForGuest={onChooseForGuest}
                                onSkipWaiting={onSkipWaiting}
                                isFirst={!currentSong && index === 0}
                                hasCurrentSong={!!currentSong}
                                queueMode={queueMode}
                                invitedSongId={invitedSongId}
                                dragState={dragState}
                                itemHeight={itemHeight}
                                onDragStart={handleDragStart}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Replacement Confirmation Modal */}
            {replacementItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-lg">
                        <div className="p-4 border-b border-slate-100 bg-indigo-50 flex justify-between items-center">
                            <h3 className="text-lg font-black text-indigo-800 uppercase tracking-tighter">Thay Thế Bài Hát</h3>
                            <button onClick={() => setReplacementItem(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"><X size={20} className="text-slate-500" /></button>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 opacity-50">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Đang Phát</span>
                                <h4 className="font-bold text-slate-500 text-sm line-clamp-2 line-through mt-1">{currentSong?.title || 'Không có bài'}</h4>
                                {currentSong?.addedBy && (
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider mt-1.5 inline-block">
                                        {currentSong.addedBy}
                                    </span>
                                )}
                            </div>
                            <div className="flex justify-center">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                    <ArrowUpToLine size={16} className="text-indigo-600 rotate-180" />
                                </div>
                            </div>
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
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-lg">
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
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-lg">
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
