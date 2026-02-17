import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../core/store';

const DisplayModeToggle = ({ openTV, closeTV, isTVOpen }) => {
    const [mode, setMode] = useState('extend');
    const [loading, setLoading] = useState(false);
    const containerRef = useRef(null);
    const ytBtnRef = useRef(null);
    const krBtnRef = useRef(null);
    const [sliderStyle, setSliderStyle] = useState({});

    useEffect(() => {
        fetch('/api/display/status')
            .then(r => r.json())
            .then(data => { if (data.mode) setMode(data.mode); })
            .catch(() => { });
    }, []);

    // Compute slider position from actual button rects
    const updateSlider = useCallback(() => {
        const container = containerRef.current;
        const activeBtn = mode === 'extend' ? krBtnRef.current : ytBtnRef.current;
        if (!container || !activeBtn) return;
        const cRect = container.getBoundingClientRect();
        const bRect = activeBtn.getBoundingClientRect();
        setSliderStyle({
            width: bRect.width,
            transform: `translateX(${bRect.left - cRect.left}px)`,
        });
    }, [mode]);

    useEffect(() => {
        updateSlider();
        window.addEventListener('resize', updateSlider);
        return () => window.removeEventListener('resize', updateSlider);
    }, [updateSlider]);

    const switchMode = useCallback(async (newMode) => {
        if (newMode === mode || loading) return;
        setLoading(true);
        try {
            if (newMode === 'duplicate') {
                // YouTube mode: close TV window + pause karaoke
                if (isTVOpen) closeTV();
                useAppStore.getState().setIsPlaying(false);
            }
            const res = await fetch(`/api/display/${newMode}`, { method: 'POST' });
            const data = await res.json();
            setMode(data.mode);
            if (newMode === 'extend') {
                // Karaoke mode: open TV window, resume if song loaded
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
        <div
            ref={containerRef}
            className={`dm-seg ${loading ? 'dm-seg--busy' : ''}`}
        >
            {/* Sliding pill — absolutely positioned, outside flow */}
            <div
                className={`dm-seg__pill ${isExtend ? 'dm-seg__pill--kr' : 'dm-seg__pill--yt'}`}
                style={sliderStyle}
            />

            <button
                ref={ytBtnRef}
                type="button"
                disabled={loading}
                className={`dm-seg__btn ${!isExtend ? 'dm-seg__btn--on' : ''}`}
                onClick={() => switchMode('duplicate')}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8" /><path d="M12 17v4" />
                </svg>
                YouTube
            </button>

            <button
                ref={krBtnRef}
                type="button"
                disabled={loading}
                className={`dm-seg__btn ${isExtend ? 'dm-seg__btn--on' : ''}`}
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
