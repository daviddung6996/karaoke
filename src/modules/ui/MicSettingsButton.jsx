import { Mic } from 'lucide-react';
import { useAppStore } from '../core/store';

const MicSettingsButton = () => {
    const setShowMicSettingsModal = useAppStore((s) => s.setShowMicSettingsModal);

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                setShowMicSettingsModal(true);
            }}
            className="relative p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer active:scale-90"
            title="Cài đặt độ nhạy & visualization"
        >
            <Mic size={16} />
        </button>
    );
};

export default MicSettingsButton;
