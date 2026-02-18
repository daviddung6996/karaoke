import { Clock } from 'lucide-react';
import { useAppStore } from '../core/store';

const HistoryButton = () => {
    const { setShowHistoryModal, songHistory } = useAppStore();

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                setShowHistoryModal(true);
            }}
            className="relative p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer active:scale-90"
            title="Lịch sử bài hát hôm nay"
        >
            <Clock size={16} />
            {songHistory.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-indigo-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                    {songHistory.length}
                </span>
            )}
        </button>
    );
};

export default HistoryButton;
