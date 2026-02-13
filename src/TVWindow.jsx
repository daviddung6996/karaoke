import { useEffect, useRef, useState } from 'react';


export default function TVWindow() {
    const playerRef = useRef(null);
    const readyRef = useRef(false);
    const pendingRef = useRef(null);
    const fallbackIdsRef = useRef([]);
    const [isNativeMode, setIsNativeMode] = useState(false);
    const isNativeModeRef = useRef(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    const [isSearching, setIsSearching] = useState(false);

    // Tone Filter State: 'all' | 'nam' | 'nu'
    const [tone, setTone] = useState('all');

    // URL Params for TV ID
    const [tvId, setTvId] = useState(1);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const id = parseInt(params.get('id')) || 1;
        setTvId(id);
        document.title = `Karaoke TV ${id}`;

        // --- WAKE LOCK IMPLEMENTATION ---
        let wakeLock = null;

        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('[TV] Wake Lock is active');
                }
            } catch (err) {
                console.error(`[TV] Wake Lock error: ${err.name}, ${err.message}`);
            }
        };

        const handleVisibilityChange = async () => {
            if (wakeLock !== null && document.visibilityState === 'visible') {
                await requestWakeLock();
            }
        };

        requestWakeLock();
        document.addEventListener('visibilitychange', handleVisibilityChange);
        // --------------------------------

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);

        // Broadcast state to opener every 500ms
        const broadcastInterval = setInterval(() => {
            if (playerRef.current && readyRef.current && window.opener) {
                try {
                    const currentTime = playerRef.current.getCurrentTime();
                    const duration = playerRef.current.getDuration();
                    const state = playerRef.current.getPlayerState();

                    window.opener.postMessage({
                        type: 'TV_STATE',
                        currentTime,
                        duration,
                        playerState: state,
                        videoId: playerRef.current.getVideoData()?.video_id,
                        isNativeMode: isNativeModeRef.current,
                        tvId
                    }, '*');
                } catch (e) {
                    // Ignore errors (e.g. player not fully ready)
                }
            }
        }, 500);

        function createPlayer() {
            if (playerRef.current) {
                try {
                    playerRef.current.destroy();
                } catch (e) { /* ignore */ }
            }

            readyRef.current = false;

            // Native mode: controls=1, disablekb=0, showinfo=1
            // Karaoke mode: controls=0, disablekb=1, showinfo=0
            const playerVars = isNativeModeRef.current ? {
                autoplay: 1,
                controls: 1,
                modestbranding: 1,
                rel: 0,
                fs: 1,
                iv_load_policy: 3,
                origin: window.location.origin,
                enablejsapi: 1,
                disablekb: 0,
            } : {
                autoplay: 1,
                controls: 0,
                modestbranding: 1,
                rel: 0,
                fs: 0,
                iv_load_policy: 3,
                origin: window.location.origin,
                enablejsapi: 1,
                disablekb: 1,
            };

            playerRef.current = new window.YT.Player('tv-player', {
                width: '100%',
                height: '100%',
                playerVars,
                events: {
                    onReady: () => {
                        readyRef.current = true;
                        console.log(`[TV] Player ready (Native: ${isNativeModeRef.current})`);
                        if (pendingRef.current) {
                            const vid = pendingRef.current;
                            pendingRef.current = null;
                            playerRef.current.loadVideoById(vid);
                        }
                    },
                    onError: (event) => {
                        console.error('[TV] Player error:', event.data);
                        const next = fallbackIdsRef.current.shift();
                        if (next) {
                            console.log('[TV] Trying fallback video:', next);
                            playerRef.current.loadVideoById(next);
                        }
                    },
                    onStateChange: (event) => {
                        if (event.data === window.YT.PlayerState.ENDED) {
                            window.opener?.postMessage({ type: 'TV_VIDEO_ENDED' }, '*');
                        }
                    },
                },
            });
        }

        window.onYouTubeIframeAPIReady = () => {
            createPlayer();
        };

        function handleMessage(event) {
            // IMPORTANT: Validate message - YouTube iframe sends its own postMessage events
            // that don't have our expected format. Only process our custom messages.
            if (!event.data || typeof event.data !== 'object') return;
            if (!event.data.type) return;

            const { type, videoId, fallbackIds, enabled, results } = event.data;

            switch (type) {
                case 'TOGGLE_NATIVE_MODE':
                    console.log('[TV] Toggle Native Mode:', enabled);
                    setIsNativeMode(enabled);
                    isNativeModeRef.current = enabled;

                    if (enabled) {
                        try {
                            window.focus();
                        } catch (e) { /* ignore */ }
                    }

                    // Save current video and time to restore after destroy
                    let currentVid = null;
                    if (playerRef.current && readyRef.current) {
                        try {
                            const data = playerRef.current.getVideoData();
                            if (data) currentVid = data.video_id;
                        } catch (e) { /* ignore */ }
                    }

                    if (currentVid) {
                        pendingRef.current = currentVid;
                    }

                    createPlayer();
                    break;
                case 'LOAD_VIDEO':
                    if (!videoId || typeof videoId !== 'string') {
                        console.warn('[TV] Invalid LOAD_VIDEO: no videoId');
                        return;
                    }
                    fallbackIdsRef.current = Array.isArray(fallbackIds) ? fallbackIds : [];
                    console.log('[TV] Load video:', videoId, 'fallbacks:', fallbackIdsRef.current.length);

                    if (readyRef.current && playerRef.current) {
                        playerRef.current.loadVideoById(videoId);
                    } else {
                        console.log('[TV] Player not ready, queuing:', videoId);
                        pendingRef.current = videoId;
                    }
                    break;
                case 'PAUSE_VIDEO':
                    if (readyRef.current) playerRef.current?.pauseVideo();
                    break;
                case 'RESUME_VIDEO':
                    if (readyRef.current) playerRef.current?.playVideo();
                    break;
                case 'REPLAY_VIDEO':
                    if (readyRef.current) {
                        playerRef.current?.seekTo(0);
                        playerRef.current?.playVideo();
                    }
                    break;
                case 'TV_SEARCH_RESULTS':
                    console.log('[TV] Got search results:', results?.length);
                    setSearchResults(results || []);
                    setIsSearching(false);
                    // Hide suggestions when results arrive
                    setShowSuggestions(false);
                    break;
                default:
                    // Ignore unknown message types (including YouTube's own messages)
                    break;
            }
        }

        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(broadcastInterval);
            if (wakeLock !== null) {
                wakeLock.release()
                    .then(() => {
                        wakeLock = null;
                    });
            }
        };
    }, []);

    const buildQuery = (q) => {
        let final = q.trim();
        if (tone === 'nam') final += ' karaoke tone nam';
        else if (tone === 'nu') final += ' karaoke tone nu';
        return final;
    };

    // Debounce Search Effect
    useEffect(() => {
        // Only auto-search if query is long enough
        if (searchQuery.trim().length < 2) return;

        const timer = setTimeout(() => {
            console.log('[TV] Auto-searching for:', searchQuery, 'Tone:', tone);
            setIsSearching(true);
            setSearchResults([]); // Clear previous
            window.opener.postMessage({
                type: 'TV_SEARCH',
                query: buildQuery(searchQuery),
                requestId: Date.now(),
                tvId
            }, '*');
        }, 1000); // 1 second delay

        return () => clearTimeout(timer);
    }, [searchQuery, tone]);

    const handleSearchInput = async (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        setSearchResults([]); // Hide previous results while typing
    };



    const handleSearchCheck = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleSearch = () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setSearchResults([]); // Clear previous
        window.opener.postMessage({
            type: 'TV_SEARCH',
            query: buildQuery(searchQuery),
            requestId: Date.now(),
            tvId
        }, '*');
    };

    const handlePlayResult = (videoId) => {
        if (!videoId) return;

        // Load in TV player
        if (playerRef.current && readyRef.current) {
            playerRef.current.loadVideoById(videoId);
        }

        setSearchResults([]);
        setSearchQuery('');
    };

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: '#000',
            overflow: 'hidden',
            cursor: isNativeMode ? 'auto' : 'none',
        }}>
            {/* Wrapper div to control pointer events properly even after iframe replacement */}
            <div style={{
                width: '100%',
                height: '100%',
                pointerEvents: isNativeMode ? 'auto' : 'none',
                position: 'relative' // For absolute positioning of search UI
            }}>
                <div id="tv-player" style={{ width: '100%', height: '100%' }}></div>

                {/* Search UI Overlay - Only in Native Mode */}
                {isNativeMode && (
                    <div style={{
                        position: 'absolute',
                        top: 20,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '700px', // Wider implementation
                        maxWidth: '90%'
                    }}>
                        <div style={{
                            display: 'flex',
                            width: '100%',
                            background: 'rgba(0,0,0,0.8)',
                            padding: 10,
                            borderRadius: 8,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            gap: 10
                        }}>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={handleSearchInput}
                                onKeyDown={handleSearchCheck}
                                placeholder="Gõ tên bài hát..."
                                style={{
                                    flex: 1,
                                    fontSize: 22,
                                    padding: '12px 16px',
                                    borderRadius: 4,
                                    border: '1px solid #444',
                                    background: '#222',
                                    color: '#fff',
                                    outline: 'none'
                                }}
                            />

                            {/* Tone Toggles */}
                            <div style={{ display: 'flex', gap: 5 }}>
                                <button
                                    onClick={() => setTone(prev => prev === 'nam' ? 'all' : 'nam')}
                                    style={{
                                        background: tone === 'nam' ? 'var(--color-accent-blue, #2196F3)' : '#333',
                                        color: '#fff',
                                        border: '1px solid #555',
                                        borderRadius: 4,
                                        padding: '0 15px',
                                        fontSize: 16,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontWeight: tone === 'nam' ? 'bold' : 'normal'
                                    }}
                                >
                                    NAM
                                </button>
                                <button
                                    onClick={() => setTone(prev => prev === 'nu' ? 'all' : 'nu')}
                                    style={{
                                        background: tone === 'nu' ? 'var(--color-accent-pink, #E91E63)' : '#333',
                                        color: '#fff',
                                        border: '1px solid #555',
                                        borderRadius: 4,
                                        padding: '0 15px',
                                        fontSize: 16,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontWeight: tone === 'nu' ? 'bold' : 'normal'
                                    }}
                                >
                                    NỮ
                                </button>
                            </div>

                            <button
                                onClick={handleSearch}
                                disabled={isSearching}
                                style={{
                                    background: '#ff0000',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    padding: '0 24px',
                                    fontSize: 18,
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    opacity: isSearching ? 0.7 : 1
                                }}
                            >
                                {isSearching ? '...' : 'TÌM'}
                            </button>
                        </div>



                        {/* Results List */}
                        {searchResults.length > 0 && (
                            <div style={{
                                width: '100%',
                                background: 'rgba(0,0,0,0.9)',
                                marginTop: 10,
                                borderRadius: 8,
                                maxHeight: '60vh',
                                overflowY: 'auto',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                            }}>
                                {searchResults.map((item) => (
                                    <div
                                        key={item.videoId}
                                        onClick={() => handlePlayResult(item.videoId)}
                                        style={{
                                            padding: '10px',
                                            borderBottom: '1px solid #333',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'background 0.2s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#333'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        {/* Thumbnail Implementation */}
                                        {item.thumbnail ? (
                                            <img
                                                src={item.thumbnail}
                                                alt="thumb"
                                                style={{
                                                    width: '120px',
                                                    height: '68px',
                                                    objectFit: 'cover',
                                                    borderRadius: '4px',
                                                    marginRight: '15px'
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '120px',
                                                height: '68px',
                                                background: '#333',
                                                borderRadius: '4px',
                                                marginRight: '15px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#666'
                                            }}>
                                                No img
                                            </div>
                                        )}
                                        <div style={{
                                            fontWeight: 'bold',
                                            fontSize: 18,
                                            color: '#fff',
                                            flex: 1
                                        }}>
                                            {item.title}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
