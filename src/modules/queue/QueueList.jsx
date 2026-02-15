import React from 'react';
import { useAppStore } from '../core/store';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Trash2, GripVertical } from 'lucide-react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';



const QueueItem = ({ item, index, onRemove, onPlay, onInvite, isFirst, queueMode, invitedSongId }) => {
    const dragControls = useDragControls();

    return (
        <Reorder.Item
            value={item}
            id={item.id}
            dragListener={false}
            dragControls={dragControls}
            className="relative"
            whileDrag={{ scale: 1.02 }}
        >
            <Card className="flex flex-col gap-2 p-2 hover:bg-slate-50 transition-all border-0 shadow-sm relative group rounded-lg select-none">
                <div className="flex items-start gap-3">
                    <div
                        className="text-slate-300 mt-1 cursor-grab active:cursor-grabbing hover:text-slate-500 transition-colors touch-none"
                        onPointerDown={(e) => dragControls.start(e)}
                    >
                        <GripVertical size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-black text-slate-800 text-sm leading-relaxed truncate uppercase tracking-tight" title={item.title} style={{ textDecoration: 'none', borderBottom: 'none', paddingBottom: '2px' }}>{item.title}</h3>
                        <span className="text-xs font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wide">{item.addedBy}</span>
                    </div>

                    <button
                        onClick={() => onRemove(item.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded-md opacity-0 group-hover:opacity-100 cursor-pointer active:scale-90"
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
    const { queue, removeFromQueue, currentSong, setCurrentSong, setIsPlaying, isPlaying, reorderQueue, queueMode, invitedSongId, setInvitedSongId, waitingForGuest } = useAppStore();

    const handlePlay = (item) => {
        setCurrentSong(item);
        removeFromQueue(item.id);
        // Don't auto-play — let the doAnnounceAndPlay effect handle it
    };

    const handleInvite = (item) => {
        setInvitedSongId(item.id);
    };

    return (
        <div className="space-y-4">
            <div className="space-y-4">
                {/* NOW PLAYING SECTION */}
                <AnimatePresence>
                    {currentSong && (
                        <motion.div
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

                            <Card className="p-3 bg-indigo-600 border-0 relative rounded-xl text-white shadow-sm overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl"></div>

                                <div className="flex items-center gap-3 relative z-10">
                                    {/* Animated Icon */}
                                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 backdrop-blur-md shadow-inner border border-white/10">
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
                                            <div className="flex items-center gap-1 bg-white/20 px-1.5 py-0.5 rounded-md backdrop-blur-sm border border-white/10">
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
                                            className="flex-1 bg-white/20 hover:bg-white/30 text-white font-black text-[10px] px-3 py-1.5 uppercase tracking-wider rounded-lg transition-all cursor-pointer active:scale-95 backdrop-blur-sm"
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
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{queue.length}</span>
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
                                    onRemove={removeFromQueue}
                                    onPlay={handlePlay}
                                    onInvite={handleInvite}
                                    isFirst={!currentSong && index === 0}
                                    queueMode={queueMode}
                                    invitedSongId={invitedSongId}
                                />
                            ))}
                        </AnimatePresence>
                    </Reorder.Group>
                </div>
            </div>
        </div>
    );
};

export default QueueList;
