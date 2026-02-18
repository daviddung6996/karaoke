import React, { useMemo } from 'react';
import { useAppStore } from '../core/store';
import { X, Clock, Users, Music, Trophy, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import Button from '../ui/Button';

const HistoryModal = () => {
    const { songHistory, showHistoryModal, setShowHistoryModal, clearHistory } = useAppStore();

    const stats = useMemo(() => {
        if (!songHistory || songHistory.length === 0) {
            return { totalSongs: 0, uniqueGuests: 0, topGuest: null, topGuestCount: 0, guestList: [] };
        }

        const guestMap = {};
        songHistory.forEach(entry => {
            const guest = entry.addedBy || 'Khách';
            guestMap[guest] = (guestMap[guest] || 0) + 1;
        });

        const guestList = Object.entries(guestMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        const topGuest = guestList[0] || null;

        return {
            totalSongs: songHistory.length,
            uniqueGuests: Object.keys(guestMap).length,
            topGuest: topGuest?.name || null,
            topGuestCount: topGuest?.count || 0,
            guestList,
        };
    }, [songHistory]);

    if (!showHistoryModal) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-3xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                        <Clock size={20} className="text-indigo-600" />
                        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                            Lịch Sử Hôm Nay
                        </h3>
                    </div>
                    <button
                        onClick={() => setShowHistoryModal(false)}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                    >
                        <X size={24} className="text-slate-500" />
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="p-4 grid grid-cols-3 gap-3">
                    <div className="bg-indigo-50 rounded-2xl p-3 border border-indigo-100 text-center">
                        <Music size={20} className="text-indigo-500 mx-auto mb-1" />
                        <p className="text-3xl font-black text-indigo-700">{stats.totalSongs}</p>
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Bài Đã Hát</p>
                    </div>

                    <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100 text-center">
                        <Users size={20} className="text-emerald-500 mx-auto mb-1" />
                        <p className="text-3xl font-black text-emerald-700">{stats.uniqueGuests}</p>
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Khách Hát</p>
                    </div>

                    <div className="bg-amber-50 rounded-2xl p-3 border border-amber-100 text-center">
                        <Trophy size={20} className="text-amber-500 mx-auto mb-1" />
                        <p className="text-lg font-black text-amber-700 truncate">{stats.topGuest || '---'}</p>
                        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                            {stats.topGuestCount > 0 ? `${stats.topGuestCount} bài` : 'Hát Nhiều Nhất'}
                        </p>
                    </div>
                </div>

                {/* Guest Leaderboard */}
                {stats.guestList.length > 1 && (
                    <div className="px-4 pb-2">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                            Bảng Xếp Hạng Khách
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {stats.guestList.map((guest, idx) => (
                                <div
                                    key={guest.name}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                        idx === 0
                                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                >
                                    {idx === 0 && <Trophy size={12} />}
                                    <span className="uppercase">{guest.name}</span>
                                    <span className="bg-white/60 px-1.5 py-0.5 rounded-full text-[10px]">
                                        {guest.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Song List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar border-t border-slate-100">
                    <div className="p-3 space-y-2">
                        {songHistory.length === 0 ? (
                            <div className="text-center py-12 text-slate-300">
                                <Clock size={48} strokeWidth={1} className="mx-auto mb-3" />
                                <p className="text-xs font-bold uppercase tracking-widest">
                                    Chưa có bài nào được hát hôm nay
                                </p>
                            </div>
                        ) : (
                            songHistory.map((entry, index) => (
                                <div
                                    key={entry.id}
                                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors"
                                >
                                    <span className="text-xs font-black text-slate-300 w-6 text-right">
                                        {songHistory.length - index}
                                    </span>

                                    <div className="w-10 h-7 rounded-md overflow-hidden bg-slate-200 flex-shrink-0">
                                        {entry.thumbnail && (
                                            <img
                                                src={entry.thumbnail}
                                                alt=""
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-800 text-xs leading-snug truncate">
                                            {entry.cleanTitle || entry.title}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-wider">
                                                {entry.addedBy || 'Khách'}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(entry.completedAt).toLocaleTimeString('vi-VN', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 flex justify-between items-center border-t border-slate-100">
                    {songHistory.length > 0 ? (
                        <Button
                            variant="danger"
                            onClick={clearHistory}
                            className="text-xs font-bold flex items-center gap-1"
                        >
                            <Trash2 size={14} />
                            Xóa Lịch Sử
                        </Button>
                    ) : <div />}
                    <Button
                        variant="ghost"
                        onClick={() => setShowHistoryModal(false)}
                        className="font-bold text-slate-600"
                    >
                        Đóng
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};

export default HistoryModal;
