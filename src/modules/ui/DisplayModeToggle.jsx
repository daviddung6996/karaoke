import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../core/store';

const DisplayModeToggle = ({ openTV, closeTV, isTVOpen }) => {
    const [mode, setMode] = useState('extend');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch('/api/display/status')
            .then(r => r.json())
            .then(data => { if (data.mode) setMode(data.mode); })
            .catch(() => { });
    }, []);

    const switchMode = useCallback(async (newMode) => {
        if (newMode === mode || loading) return;
        setLoading(true);
        try {
            if (newMode === 'duplicate') {
                if (isTVOpen) closeTV();
                useAppStore.getState().setIsPlaying(false);
            }
            const res = await fetch(`/api/display/${newMode}`, { method: 'POST' });
            const data = await res.json();
            setMode(data.mode);
            if (newMode === 'extend') {
                setTimeout(() => {
                    openTV();
                    const { currentSong } = useAppStore.getState();
                    if (currentSong) useAppStore.getState().setIsPlaying(true);
                }, 2500);
            }
        } catch (err) {
            console.error('[DisplayToggle] Switch failed:', err);
        } finally {
            setLoading(false);
        }
    }, [mode, loading, openTV, closeTV, isTVOpen]);

    const isExtend = mode === 'extend';

    return (
        <div className="relative flex bg-slate-200 rounded-lg p-[3px]" style={{ opacity: loading ? 0.6 : 1 }}>
            {/* Sliding pill */}
            <div
                className="absolute top-[3px] bottom-[3px] rounded-md transition-all duration-300 ease-in-out"
                style={{
                    width: '50%',
                    left: isExtend ? '50%' : '3px',
                    background: isExtend
                        ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                        : 'linear-gradient(135deg, #ef4444, #dc2626)',
                    boxShadow: isExtend
                        ? '0 2px 8px rgba(34, 197, 94, 0.35)'
                        : '0 2px 8px rgba(239, 68, 68, 0.35)',
                }}
            />

            <button
                type="button"
                disabled={loading}
                className={`relative z-10 flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-extrabold uppercase tracking-wide cursor-pointer transition-colors duration-200 ${!isExtend ? 'text-white' : 'text-slate-400 hover:text-slate-600'}`}
                onClick={() => switchMode('duplicate')}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8" /><path d="M12 17v4" />
                </svg>
                YouTube
            </button>

            <button
                type="button"
                disabled={loading}
                className={`relative z-10 flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-extrabold uppercase tracking-wide cursor-pointer transition-colors duration-200 ${isExtend ? 'text-white' : 'text-slate-400 hover:text-slate-600'}`}
                onClick={() => switchMode('extend')}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
                    <path d="M19 10v2a7 7 0 01-14 0v-2" /><path d="M12 19v3" />
                </svg>
                Karaoke
            </button>
        </div>
    );
};

export default DisplayModeToggle;
