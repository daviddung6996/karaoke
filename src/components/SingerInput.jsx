import { useState, useRef, useEffect } from 'react';
import { getSingerNameSuggestions } from '../services/gemini';
import { getApiKey } from '../services/ai';

export default function SingerInput({ songTitle, onSubmit, onSkip }) {
    const [name, setName] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Suggestion Debounce
    useEffect(() => {
        if (!name || name.trim().length < 2) {
            setSuggestions([]);
            setSelectedIndex(-1);
            return;
        }

        const timer = setTimeout(async () => {
            const key = getApiKey();
            if (key) {
                const suggs = await getSingerNameSuggestions(name, key);
                // Only set if name hasn't changed (simple race check)
                setSuggestions(suggs);
                setSelectedIndex(-1); // Reset selection on new suggestions
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [name]);

    const handleSelectSuggestion = (sugg) => {
        setName(sugg);
        setSuggestions([]);
        setSelectedIndex(-1);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0) {
                e.preventDefault();
                handleSelectSuggestion(suggestions[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            setSuggestions([]);
            setSelectedIndex(-1);
        }
    };

    function handleSubmit(e) {
        e.preventDefault();
        onSubmit(name.trim());
    }

    return (
        <div className="modal-overlay">
            <div className="modal">
                <h2>🎤 Tên người hát?</h2>
                <p style={{ fontSize: 22, color: 'var(--color-accent-orange)', marginBottom: 20 }}>
                    {songTitle}
                </p>

                <form onSubmit={handleSubmit}>
                    <div style={{ position: 'relative' }}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ví dụ: Anh Tú"
                            style={{ marginBottom: 16, textAlign: 'center', fontSize: 32, width: '100%' }}
                            autoComplete="off"
                        />

                        {/* Suggestions List (Google Style) */}
                        {suggestions.length > 0 && (
                            <ul style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: '#2a2a2a',
                                border: '1px solid #444',
                                borderRadius: '0 0 8px 8px',
                                listStyle: 'none',
                                padding: 0,
                                margin: '-16px 0 16px 0',
                                zIndex: 1000,
                                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                                maxHeight: '200px',
                                overflowY: 'auto'
                            }}>
                                {suggestions.map((s, i) => (
                                    <li
                                        key={i}
                                        onClick={() => handleSelectSuggestion(s)}
                                        onMouseEnter={() => setSelectedIndex(i)}
                                        style={{
                                            padding: '10px 16px',
                                            cursor: 'pointer',
                                            background: i === selectedIndex ? 'var(--color-accent-blue)' : 'transparent',
                                            color: i === selectedIndex ? 'white' : '#eee',
                                            borderBottom: i < suggestions.length - 1 ? '1px solid #333' : 'none',
                                            textAlign: 'left',
                                            fontSize: 18
                                        }}
                                    >
                                        ✨ {s}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>


                    <div style={{ display: 'flex', gap: 12 }}>
                        <button type="submit" className="btn-success" style={{ flex: 1 }}>
                            ✅ XONG
                        </button>
                        <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={onSkip}>
                            BỎ QUA
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
