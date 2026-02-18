import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mic, Pause, Play } from 'lucide-react';
import { useAppStore } from '../core/store';

const WaitingOverlay = ({ countdown: propCountdown, onSkip, onPauseToggle }) => {
    const waitingForGuest = useAppStore((s) => s.waitingForGuest);
    const currentSong = useAppStore((s) => s.currentSong);
    const waitCountdown = useAppStore((s) => s.waitCountdown);
    const countdownPaused = useAppStore((s) => s.countdownPaused);
    const micAttemptHint = useAppStore((s) => s.micAttemptHint);
    const countdown = propCountdown ?? waitCountdown;

    const [entered, setEntered] = useState(false);

    useEffect(() => {
        if (waitingForGuest) {
            const t = setTimeout(() => setEntered(true), 100);
            return () => clearTimeout(t);
        } else {
            setEntered(false);
        }
    }, [waitingForGuest]);

    if (!waitingForGuest) return null;

    const singer = currentSong?.addedBy || 'Khách';
    const songTitle = currentSong?.cleanTitle || currentSong?.title || '';

    const maxSeconds = 30;
    const progress = Math.max(0, (countdown ?? maxSeconds) / maxSeconds);

    return (
        <>
            {/* ── Root Overlay ── */}
            {entered && createPortal(
                <div className={`inv-overlay ${entered ? 'inv-overlay--entered' : ''}`}>
                    {/* Background Orbs */}
                    <div className="inv-orbs">
                        <div className="inv-orb" style={{ left: '20%', width: '300px', height: '300px', animationDelay: '0s' }} />
                        <div className="inv-orb" style={{ left: '70%', width: '400px', height: '400px', animationDelay: '-5s' }} />
                    </div>

                    {/* Main Content (Centered & Expanded) */}
                    <div className="inv-content">
                        {/* Mic & Rings */}
                        <div className="inv-mic-wrap" onClick={onSkip}>
                            <div className="inv-rings">
                                <div className="inv-ring" style={{ animationDelay: '0s' }} />
                            </div>
                            <svg className="inv-countdown-svg" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                                <circle
                                    cx="50" cy="50" r="48" fill="none" stroke="#22d3ee" strokeWidth="3"
                                    strokeDasharray="301.6"
                                    strokeDashoffset={301.6 * (1 - progress)}
                                    strokeLinecap="round"
                                    style={{ transition: countdownPaused ? 'none' : 'stroke-dashoffset 1s linear' }}
                                    transform="rotate(-90 50 50)"
                                />
                            </svg>
                            <div className="inv-mic-btn">
                                <Mic size={80} color="#fff" strokeWidth={2.5} />
                            </div>
                        </div>

                        {/* Text Content */}
                        <h1 className="inv-singer">{singer}</h1>
                        <h2 className="inv-subtitle">MỜI LÊN SÂN KHẤU</h2>
                        <div className="inv-song">
                            TRÌNH BÀY BÀI HÁT: <span className="inv-song-title">{songTitle}</span>
                        </div>

                        <p className="inv-instruction">
                            Gõ nhẹ vào mic hoặc nói <span className="inv-alo">A Lô</span> để bắt đầu
                        </p>
                    </div>

                    {/* Footer Controls (Bottom Pinned) */}
                    <div className="inv-footer">
                        {/* Countdown & Pause */}
                        <div className="inv-countdown-row">
                            <span className="inv-countdown-text">Tự động phát sau</span>
                            <span className="inv-countdown-num">{countdown} giây</span>
                            {onPauseToggle && (
                                <button className="inv-pause-btn" onClick={(e) => { e.stopPropagation(); onPauseToggle?.(); }}>
                                    {countdownPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                                    {countdownPaused ? 'Tiếp Tục' : 'Dừng Đếm'}
                                </button>
                            )}
                        </div>

                        {/* Manual Start Button */}
                        <button className="inv-start-btn" onClick={onSkip}>
                            BẮT ĐẦU NGAY <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12l14 0" />
                                <path d="M13 18l6 -6" />
                                <path d="M13 6l6 6" />
                            </svg>
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Hint Banner Portal (Always top z-index) ── */}
            {micAttemptHint && createPortal(
                <div className={`inv-hint ${micAttemptHint === 'weak' ? 'inv-hint--amber' : 'inv-hint--green'}`}>
                    {micAttemptHint === 'weak' && "🎤 Hãy gõ mạnh hơn vào mic!"}
                    {micAttemptHint === 'medium' && "🔊 Gần rồi! Nói to hơn nữa!"}
                </div>,
                document.body
            )}
        </>
    );
};

export default React.memo(WaitingOverlay);
