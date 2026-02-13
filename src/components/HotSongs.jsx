export default function HotSongs({ hotSongs, onSelect, onClose }) {
    if (!hotSongs || hotSongs.length === 0) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                    <h2>🔥 BÀI HAY HÁT</h2>
                    <div className="empty-state" style={{ padding: 20 }}>
                        Chưa có lịch sử. Hát vài bài rồi quay lại!
                    </div>
                    <button className="btn-ghost" style={{ width: '100%' }} onClick={onClose}>
                        ĐÓNG
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}>
                <h2>🔥 BÀI HAY HÁT</h2>
                <div className="hot-songs-grid">
                    {hotSongs.map((song, i) => (
                        <div key={i} className="search-result" onClick={() => onSelect(song)}>
                            <div>
                                <div className="result-title">{song.title} - {song.artist}</div>
                                <div className="result-meta">Đã hát {song.count} lần</div>
                            </div>
                            <button className="btn-success btn-small">CHỌN</button>
                        </div>
                    ))}
                </div>
                <button className="btn-ghost" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>
                    ĐÓNG
                </button>
            </div>
        </div>
    );
}
