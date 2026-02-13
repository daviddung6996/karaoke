import { useState, useRef, useEffect } from 'react';
import { searchYouTubeList, getYouTubeSearchUrl, getVideoIdFromUrl, getVideoDetails } from '../services/youtube';
import { getGeminiSuggestions } from '../services/gemini';
import { getApiKey } from '../services/ai';

export default function SearchBar({ onSelectSong }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // Manual add mode state
    const [manualMode, setManualMode] = useState(false);
    const [manualTitle, setManualTitle] = useState('');
    const [manualArtist, setManualArtist] = useState('');

    // AI Suggestion State
    const [aiMode, setAiMode] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiResults, setAiResults] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);

    // Tone Filter State
    const [tone, setTone] = useState('all');

    const inputRef = useRef(null);



    // 2. Debounce Auto-Search Effect
    useEffect(() => {
        // Auto-search if we have a query and NOT already showing results
        // (to avoid constant re-searching if user is just looking at results)
        // Also don't auto-search if loading
        if (query.trim().length < 2 || loading) return;

        const timer = setTimeout(() => {
            console.log('[SearchBar] Auto-searching:', query, 'Tone:', tone);
            performSearch(query);
        }, 1000);

        return () => clearTimeout(timer);
    }, [query, tone]); // Include tone in dependency to auto-search on toggle

    async function performSearch(searchTerm) {
        if (!searchTerm.trim()) return;

        setLoading(true);
        setError('');
        // Don't clear results immediately to avoid flicker if user is just adding a char
        // setResults([]); 

        try {
            let finalQuery = searchTerm.trim();
            if (tone === 'nam') finalQuery += ' karaoke tone nam';
            else if (tone === 'nu') finalQuery += ' karaoke tone nu';

            const videos = await searchYouTubeList(finalQuery);
            if (videos.length === 0) {
                setError('Không tìm thấy video karaoke.');
                setResults([]);
            } else {
                setResults(videos);
                // Hide suggestions when we have results
                setSuggestions([]);
            }
        } catch (err) {
            console.error('[SearchBar] YouTube search failed:', err);
            setError('Lỗi tìm kiếm. Thử lại sau.');
            setResults([]);
        }
        setLoading(false);
    }

    async function handleSearch(e) {
        e.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) return;

        // Check if it's a YouTube URL
        const videoId = getVideoIdFromUrl(trimmed);
        if (videoId) {
            setLoading(true);
            try {
                const details = await getVideoDetails(videoId);
                onSelectSong({
                    title: details.title,
                    artist: details.author,
                    videoId: videoId,
                    fallbackIds: []
                });
                setQuery('');
                setResults([]);
            } catch (err) {
                console.error('Failed to resolve URL:', err);
                setError('Lỗi khi lấy thông tin video.');
            }
            setLoading(false);
            return;
        }

        performSearch(query);
    }

    function handleSelectResult(video) {
        // Pass selected videoId + remaining candidates as fallbacks
        const fallbacks = results
            .filter(v => v.videoId !== video.videoId)
            .map(v => v.videoId);

        onSelectSong({
            title: video.title,
            artist: '',
            videoId: video.videoId,
            fallbackIds: fallbacks
        });

        setQuery('');
        setResults([]);
        setSuggestions([]);
    }

    function handleSelectSuggestion(suggestionString) {
        // When selecting a suggestion, we can either:
        // A) Just set the query and let auto-search take over (might feel slow)
        // B) Set query and trigger search immediately (better UX)
        setQuery(suggestionString);
        setSuggestions([]); // hide suggestions
        performSearch(suggestionString);
    }

    function handleManualAdd(e) {
        e.preventDefault();
        if (!manualTitle.trim()) return;
        onSelectSong({ title: manualTitle.trim(), artist: manualArtist.trim() });
        setManualTitle('');
        setManualArtist('');
        setManualMode(false);
    }

    function openYouTubeSearch() {
        const url = getYouTubeSearchUrl(query || 'karaoke');
        window.open(url, '_blank');
    }

    if (manualMode) {
        return (
            <div className="section">
                <div className="section-label">THÊM BÀI THỦ CÔNG</div>
                <form onSubmit={handleManualAdd}>
                    <input
                        type="text"
                        value={manualTitle}
                        onChange={e => setManualTitle(e.target.value)}
                        placeholder="Tên bài hát..."
                        style={{ marginBottom: 10 }}
                        autoFocus
                    />
                    <input
                        type="text"
                        value={manualArtist}
                        onChange={e => setManualArtist(e.target.value)}
                        placeholder="Ca sĩ (có thể bỏ trống)..."
                        style={{ marginBottom: 16 }}
                    />
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button type="submit" className="btn-success" style={{ flex: 1 }}>
                            ✅ THÊM
                        </button>
                        <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setManualMode(false)}>
                            HỦY
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    // --- AI HANDLERS ---

    const handleAiSearch = async (e) => {
        e.preventDefault();
        const key = getApiKey();

        if (!aiPrompt.trim()) return;
        if (!key) {
            alert('Chưa có API Key. Vui lòng vào Cài đặt (⚙️) để nhập key.');
            return;
        }

        setAiLoading(true);
        setAiResults([]);

        try {
            const suggestions = await getGeminiSuggestions(aiPrompt, key);
            setAiResults(suggestions);
        } catch (err) {
            alert('Lỗi khi gọi AI: ' + err.message);
        }
        setAiLoading(false);
    };

    const handleSelectAiResult = (item) => {
        // Use title + artist for search
        const term = `${item.title} ${item.artist}`;
        setQuery(term);
        setAiMode(false);
        performSearch(term);
    };

    if (aiMode) {
        return (
            <div className="section">
                <div className="section-label">✨ GỢI Ý BẰNG AI (GEMINI)</div>



                <form onSubmit={handleAiSearch}>
                    <div style={{ fontSize: 14, color: '#aaa', marginBottom: 5 }}>🤖 Mô tả bài hát (VD: "nhạc buồn thất tình 2010"):</div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                        <input
                            type="text"
                            value={aiPrompt}
                            onChange={e => setAiPrompt(e.target.value)}
                            placeholder="Mô tả bài hát..."
                            style={{ flex: 1 }}
                            autoFocus
                        />
                        <button type="submit" className="btn-primary" disabled={aiLoading}>
                            {aiLoading ? '⏳...' : 'HỎI AI'}
                        </button>
                    </div>
                </form>

                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {aiResults.map((item, idx) => (
                        <div
                            key={idx}
                            onClick={() => handleSelectAiResult(item)}
                            style={{
                                padding: 10,
                                borderBottom: '1px solid #333',
                                cursor: 'pointer',
                                background: 'rgba(255,255,255,0.05)',
                                marginBottom: 5,
                                borderRadius: 4
                            }}
                        >
                            <div style={{ fontWeight: 'bold', color: '#4CAF50' }}>{item.title}</div>
                            <div style={{ fontSize: 14, color: '#ccc' }}>🎤 {item.artist}</div>
                            <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>💡 {item.reason}</div>
                        </div>
                    ))}
                    {aiResults.length === 0 && !aiLoading && (
                        <div style={{ textAlign: 'center', color: '#666', padding: 20 }}>
                            Chưa có kết quả. Hãy nhập mô tả và nhấn "HỎI AI".
                        </div>
                    )}
                </div>

                <button
                    onClick={() => setAiMode(false)}
                    style={{ width: '100%', padding: 10, background: '#333', border: 'none', color: '#fff', marginTop: 10, cursor: 'pointer', borderRadius: 4 }}
                >
                    QUAY LẠI
                </button>
            </div>
        );
    }

    return (
        <div className="section">
            <div className="section-label">TÌM BÀI HÁT</div>
            <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Gõ tên bài hát..."
                        style={{ flex: 1 }}
                    />
                    <button type="submit" className="btn-secondary" disabled={loading}>
                        🔍 TÌM
                    </button>
                </div>

                {/* Tone Toggles */}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        type="button"
                        onClick={() => setTone(prev => prev === 'nam' ? 'all' : 'nam')}
                        className={tone === 'nam' ? 'btn-primary' : 'btn-ghost'}
                        style={{
                            flex: 1,
                            border: tone === 'nam' ? '1px solid var(--color-accent-blue)' : '1px solid #444',
                            background: tone === 'nam' ? 'var(--color-accent-blue)' : 'transparent'
                        }}
                    >
                        👨 Tone Nam
                    </button>
                    <button
                        type="button"
                        onClick={() => setTone(prev => prev === 'nu' ? 'all' : 'nu')}
                        className={tone === 'nu' ? 'btn-primary' : 'btn-ghost'}
                        style={{
                            flex: 1,
                            border: tone === 'nu' ? '1px solid var(--color-accent-pink)' : '1px solid #444',
                            background: tone === 'nu' ? 'var(--color-accent-pink)' : 'transparent'
                        }}
                    >
                        👩 Tone Nữ
                    </button>
                </div>
            </form>



            {loading && (
                <div style={{ fontSize: 24, textAlign: 'center', padding: 20, color: 'var(--color-text-secondary)' }}>
                    🔍 Đang tìm trên YouTube...
                </div>
            )}

            {error && (
                <div style={{ fontSize: 22, textAlign: 'center', padding: 16, color: 'var(--color-accent-orange)' }}>
                    {error}
                </div>
            )}

            {/* YouTube Results */}
            {results.length > 0 && (
                <div>
                    <div style={{ fontSize: 18, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                        Kết quả YouTube:
                    </div>
                    {results.map((video, i) => (
                        <div key={i} className="search-result" onClick={() => handleSelectResult(video)}>
                            {/* Thumbnail */}
                            {video.thumbnail ? (
                                <img
                                    src={video.thumbnail}
                                    alt="thumb"
                                    style={{
                                        width: '80px',
                                        height: '45px',
                                        objectFit: 'cover',
                                        borderRadius: '4px',
                                        marginRight: '12px'
                                    }}
                                />
                            ) : (
                                <div style={{
                                    width: '80px',
                                    height: '45px',
                                    background: '#333',
                                    borderRadius: '4px',
                                    marginRight: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    color: '#666'
                                }}>
                                    No img
                                </div>
                            )}
                            <div style={{ flex: 1 }}>
                                <div className="result-title">{video.title}</div>
                            </div>
                            <button className="btn-success btn-small">CHỌN</button>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button className="btn-ghost" style={{ flex: 1, background: 'linear-gradient(45deg, #2196F3, #9C27B0)', border: 'none' }} onClick={() => setAiMode(true)}>
                    ✨ GỢI Ý AI
                </button>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={openYouTubeSearch}>
                    🌐 YOUTUBE
                </button>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setManualMode(true)}>
                    ✍️ THÊM BÀI
                </button>
            </div>
        </div>
    );
}
