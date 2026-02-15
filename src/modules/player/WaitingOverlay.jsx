import React from 'react';
import { createPortal } from 'react-dom';
import { Mic } from 'lucide-react';
import { useAppStore } from '../core/store';


const WaitingOverlay = ({ countdown: propCountdown, onSkip }) => {
    const { waitingForGuest, currentSong, waitCountdown } = useAppStore();
    const countdown = propCountdown ?? waitCountdown;

    if (!waitingForGuest) return null;

    const singer = currentSong?.addedBy || 'Khách';

    const handleStartNow = () => {
        if (onSkip) onSkip();
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center text-white select-none">
            {/* Pulsing mic icon */}
            <div className="relative mb-10">
                <div className="absolute -inset-4 animate-ping rounded-full bg-indigo-500/20" style={{ animationDuration: '2s' }} />
                <div className="relative w-28 h-28 bg-indigo-600 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-500/40 cursor-pointer hover:scale-105 transition-transform" onClick={handleStartNow}>
                    <Mic size={56} strokeWidth={2.5} />
                </div>
            </div>

            {/* Singer name */}
            <div className="text-6xl font-black uppercase tracking-tight mb-3">
                {singer}
            </div>
            <div className="text-3xl font-black text-indigo-400 uppercase tracking-widest mb-10">
                Mời Lên Sân Khấu
            </div>

            {/* Hướng dẫn */}
            <div className="flex flex-col items-center gap-6">
                <div className="text-2xl font-black text-white/80 tracking-wide">
                    🎤 Gõ nhẹ vào Mic hoặc nói <span className="text-green-400">"A Lô"</span>
                </div>

                {/* Countdown */}
                <div className="text-xl font-bold text-white/40">
                    Tự động phát sau <span className="text-white/70 tabular-nums">{countdown ?? 30}</span> giây
                </div>

                {/* Manual Start Button */}
                <button
                    onClick={handleStartNow}
                    className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-lg font-bold backdrop-blur-sm transition-all active:scale-95 flex items-center gap-2"
                >
                    <span>BẮT ĐẦU NGAY</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l14 0" />
                        <path d="M13 18l6 -6" />
                        <path d="M13 6l6 6" />
                    </svg>
                </button>
            </div>
        </div>,
        document.body
    );
};

export default WaitingOverlay;
