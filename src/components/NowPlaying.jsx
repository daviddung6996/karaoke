export default function NowPlaying({ currentSong, nextSong, onNext, onCallSinger, isVideoEnded, queueLength }) {
    if (queueLength === 0) return null;

    return (
        <div className="section">
            {currentSong && (
                <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 18, color: 'var(--color-text-secondary)', fontWeight: 700 }}>ĐANG HÁT:</span>
                        <span style={{ fontSize: 20 }}>🎤</span>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--color-accent-orange)' }}>
                        {currentSong.title}{currentSong.artist ? ` - ${currentSong.artist}` : ''}
                        {currentSong.singer && (
                            <span style={{ fontSize: 24, color: 'var(--color-text-primary)', marginLeft: 16 }}>
                                ────  {currentSong.singer}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {nextSong && (
                <div style={{ marginBottom: 16, opacity: 0.8 }}>
                    <span style={{ fontSize: 18, color: 'var(--color-text-secondary)', fontWeight: 700 }}>TIẾP THEO: </span>
                    <span style={{ fontSize: 22 }}>
                        {nextSong.title}{nextSong.artist ? ` - ${nextSong.artist}` : ''}
                        {nextSong.singer && (
                            <span style={{ color: 'var(--color-accent-orange)', marginLeft: 12 }}>
                                ────  {nextSong.singer}
                            </span>
                        )}
                    </span>
                </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
                {currentSong && currentSong.singer && (
                    <button
                        className="btn-secondary"
                        onClick={() => onCallSinger(currentSong)}
                        style={{ flex: 1, background: 'var(--color-accent-pink)', border: 'none' }}
                    >
                        📢 GỌI KHÁCH
                    </button>
                )}
                <button
                    className={`btn-next ${isVideoEnded ? 'flash' : ''}`}
                    onClick={onNext}
                    style={{ flex: 2 }}
                >
                    {'>>> BÀI TIẾP THEO >>>'}
                </button>
            </div>
        </div>
    );
}
