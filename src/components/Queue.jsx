import { useState } from 'react';
import Confirm from './Confirm';

export default function Queue({ waitingQueue, onRemove, onMoveUp, onMoveDown, onClearAll }) {
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [showClearAll, setShowClearAll] = useState(false);

    function handleRemove(id) {
        setConfirmDelete(id);
    }

    function confirmRemove() {
        if (confirmDelete !== null) {
            onRemove(confirmDelete);
            setConfirmDelete(null);
        }
    }

    return (
        <div className="section">
            <div className="section-label">HÀNG CHỜ ({waitingQueue.length} bài)</div>

            {waitingQueue.length === 0 && (
                <div className="empty-state">
                    Chưa có bài nào. Hãy tìm bài!
                </div>
            )}

            {waitingQueue.map((item, idx) => (
                <div key={item.id} className="queue-item">
                    <div className="order-num">#{idx + 2}</div>
                    <div className="song-info">
                        <div className="song-title">
                            {item.title}{item.artist ? ` - ${item.artist}` : ''}
                        </div>
                        {item.singer && <div className="singer-name">{item.singer}</div>}
                    </div>
                    <div className="queue-item-controls">
                        <button
                            className="btn-ghost btn-small"
                            onClick={() => onMoveUp(item.id)}
                            disabled={idx === 0}
                            title="Lên"
                        >
                            ▲
                        </button>
                        <button
                            className="btn-ghost btn-small"
                            onClick={() => onMoveDown(item.id)}
                            disabled={idx === waitingQueue.length - 1}
                            title="Xuống"
                        >
                            ▼
                        </button>
                        <button className="btn-danger btn-small" onClick={() => handleRemove(item.id)}>
                            XÓA
                        </button>
                    </div>
                </div>
            ))}

            {waitingQueue.length > 0 && (
                <button
                    className="btn-ghost"
                    style={{ width: '100%', marginTop: 12, fontSize: 18, minHeight: 48 }}
                    onClick={() => setShowClearAll(true)}
                >
                    🗑️ XÓA HẾT
                </button>
            )}

            {confirmDelete !== null && (
                <Confirm
                    message="Chắc chưa?"
                    onConfirm={confirmRemove}
                    onCancel={() => setConfirmDelete(null)}
                />
            )}

            {showClearAll && (
                <Confirm
                    message="Xóa hết tất cả bài?"
                    requireType="xoa"
                    onConfirm={() => { onClearAll(); setShowClearAll(false); }}
                    onCancel={() => setShowClearAll(false)}
                />
            )}
        </div>
    );
}
