import { useEffect, useRef } from 'react';

export default function Preview({
    playerState,
    currentTime,
    duration,
    progress,
    formatTime,
    initPreviewPlayer,
    onPause,
    onResume,
    onReplay,
    currentVideoId,
}) {
    const initialized = useRef(false);

    useEffect(() => {
        if (!initialized.current) {
            initialized.current = true;
            initPreviewPlayer('preview-player');
        }
    }, [initPreviewPlayer]);

    const stateLabels = {
        idle: '',
        playing: '▶ Đang phát',
        paused: '⏸ Tạm dừng',
        ended: '✅ Đã hết bài!',
        buffering: '⏳ Đang tải...',
        cued: '⏳ Sẵn sàng',
    };

    const isEnded = playerState === 'ended';

    return (
        <div className="section">
            <div className="section-label">XEM TRƯỚC</div>
            <div className="preview-container">
                <div className="preview-iframe-wrap">
                    <div id="preview-player"></div>
                </div>

                {currentVideoId && (
                    <>
                        <div className="progress-bar">
                            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                        </div>

                        <div className="preview-status" style={{
                            color: isEnded ? 'var(--color-accent-orange)' : 'var(--color-text-primary)'
                        }}>
                            {stateLabels[playerState]}
                            {(playerState === 'playing' || playerState === 'paused') && (
                                <span style={{ marginLeft: 12, color: 'var(--color-text-secondary)' }}>
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </span>
                            )}
                        </div>

                        <div className="preview-controls">
                            <button className="btn-secondary btn-small" onClick={onPause}>
                                ⏸ TẠM DỪNG
                            </button>
                            <button className="btn-secondary btn-small" onClick={onResume}>
                                ▶ TIẾP TỤC
                            </button>
                            <button className="btn-secondary btn-small" onClick={onReplay}>
                                🔄 HÁT LẠI
                            </button>
                        </div>
                    </>
                )}

                {!currentVideoId && (
                    <div style={{ fontSize: 22, color: 'var(--color-text-secondary)', textAlign: 'center', padding: 20 }}>
                        Chưa có bài nào đang phát
                    </div>
                )}
            </div>
        </div>
    );
}
