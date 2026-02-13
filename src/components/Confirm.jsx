import { useState } from 'react';

export default function Confirm({ message, onConfirm, onCancel, requireType }) {
    const [typed, setTyped] = useState('');

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h2>{message}</h2>

                {requireType && (
                    <div style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 22, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                            Gõ "{requireType}" để xác nhận:
                        </p>
                        <input
                            type="text"
                            value={typed}
                            onChange={e => setTyped(e.target.value)}
                            placeholder={requireType}
                            autoFocus
                            style={{ textAlign: 'center' }}
                        />
                    </div>
                )}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
                    <button className="btn-danger" style={{ flex: 1 }}
                        onClick={onConfirm}
                        disabled={requireType && typed.toLowerCase() !== requireType.toLowerCase()}
                    >
                        Có
                    </button>
                    <button className="btn-ghost" style={{ flex: 1 }} onClick={onCancel}>
                        Không
                    </button>
                </div>
            </div>
        </div>
    );
}
