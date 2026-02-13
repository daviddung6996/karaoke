import { useState, useCallback, useEffect } from 'react';
import { useQueue } from './hooks/useQueue';
import { useHistory } from './hooks/useHistory';
import { useTTS } from './hooks/useTTS';
import { useYouTube } from './hooks/useYouTube';
import { searchYouTube } from './services/youtube';
import { setApiKey, getApiKey } from './services/ai';
import Preview from './components/Preview';
import NowPlaying from './components/NowPlaying';
import Queue from './components/Queue';
import SearchBar from './components/SearchBar';
import SingerInput from './components/SingerInput';
import HotSongs from './components/HotSongs';

export default function App() {
    const { queue, currentSong, nextSong, waitingQueue, addSong, removeSong, moveUp, moveDown, advanceQueue, clearAll, queueLength } = useQueue();
    const { addToHistory, getHotSongs } = useHistory();
    const { announceSinger, callSinger } = useTTS();
    const youtube = useYouTube();

    const [singerModal, setSingerModal] = useState(null);
    const [showHotSongs, setShowHotSongs] = useState(false);
    const [toast, setToast] = useState(null);
    const [undoItem, setUndoItem] = useState(null);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        if (!getApiKey()) {
            setShowSettings(true);
        }
    }, []);

    const showToast = useCallback((message) => {
        setToast(message);
        setTimeout(() => setToast(null), 2500);
    }, []);

    const handleSelectSong = useCallback((song) => {
        setSingerModal(song);
    }, []);

    async function playSong(song) {
        // If we already have a videoId (from YouTube search results), use it directly
        if (song.videoId) {
            console.log('[App] Using pre-resolved video:', song.videoId, 'fallbacks:', song.fallbackIds?.length || 0);
            youtube.loadVideo(song.videoId, song.fallbackIds || []);
            showToast(`▶ Đang phát: ${song.title}`);
            return;
        }

        showToast(`🔍 Đang tìm bài ${song.title}...`);
        const videoId = await searchYouTube(song.title, song.artist);
        if (videoId) {
            console.log('[App] Found video:', videoId);
            youtube.loadVideo(videoId);
            showToast(`▶ Đang phát: ${song.title}`);
        } else {
            console.warn('[App] No video found for:', song.title);
            showToast(`❌ Không tìm thấy video. Thử "THÊM BÀI THỦ CÔNG".`);
        }
    }

    const handleSingerSubmit = useCallback(async (singerName) => {
        if (!singerModal) return;
        const songData = {
            title: singerModal.title,
            artist: singerModal.artist || '',
            singer: singerName || '',
            videoId: singerModal.videoId || null,
            fallbackIds: singerModal.fallbackIds || [],
        };
        const item = addSong(songData);
        showToast(`Đã thêm bài ${singerModal.title}`);
        setSingerModal(null);

        // If this is the first song (queue was empty), announce and play immediately
        if (queueLength === 0) {
            addToHistory({ title: songData.title, artist: songData.artist, singer: songData.singer });
            await announceSinger(item, null);
            await new Promise(r => setTimeout(r, 2000));
            await playSong(item);
        }
    }, [singerModal, addSong, showToast, queueLength, addToHistory, announceSinger]);

    const handleSingerSkip = useCallback(async () => {
        if (!singerModal) return;
        const songData = {
            title: singerModal.title,
            artist: singerModal.artist || '',
            singer: '',
            videoId: singerModal.videoId || null,
            fallbackIds: singerModal.fallbackIds || [],
        };
        const item = addSong(songData);
        showToast(`Đã thêm bài ${singerModal.title}`);
        setSingerModal(null);

        if (queueLength === 0) {
            addToHistory({ title: songData.title, artist: songData.artist, singer: '' });
            await announceSinger(item, null);
            await new Promise(r => setTimeout(r, 2000));
            await playSong(item);
        }
    }, [singerModal, addSong, showToast, queueLength, addToHistory, announceSinger]);

    const handleNext = useCallback(async () => {
        if (queueLength === 0) return;

        // Grab references to next songs BEFORE advancing (queue state is stale after setQueue)
        const upcomingSong = queue[1];  // will become the new current
        const afterThat = queue[2];     // will become the new next

        const removed = advanceQueue();
        if (removed) {
            setUndoItem(removed);
            setTimeout(() => setUndoItem(null), 5000);
        }

        if (upcomingSong) {
            addToHistory({ title: upcomingSong.title, artist: upcomingSong.artist, singer: upcomingSong.singer });

            // Announce singer with TTS
            await announceSinger(upcomingSong, afterThat || null);

            // Wait for customer to walk up
            await new Promise(r => setTimeout(r, 3000));

            // Search and play on YouTube
            await playSong(upcomingSong);
        }
    }, [queueLength, advanceQueue, queue, addToHistory, announceSinger]);

    const handleUndo = useCallback(() => {
        if (!undoItem) return;
        addSong(undoItem);
        setUndoItem(null);
    }, [undoItem, addSong]);

    const handleHotSongSelect = useCallback((song) => {
        setShowHotSongs(false);
        handleSelectSong({ title: song.title, artist: song.artist });
    }, [handleSelectSong]);

    function handleSaveKey() {
        if (apiKeyInput.trim()) {
            setApiKey(apiKeyInput.trim());
            setShowSettings(false);
            showToast('Đã lưu API key');
        }
    }

    return (
        <div className="app-container">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ fontSize: 32, fontWeight: 900 }}>🎤 KARAOKE</h1>
                <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                        <button className="btn-secondary btn-small" onClick={() => youtube.openTVWindow(1)}>
                            📺 TV 1
                        </button>
                        <button className="btn-secondary btn-small" onClick={() => youtube.openTVWindow(2)}>
                            📺 TV 2
                        </button>
                    </div>
                    <button className="btn-ghost btn-small" onClick={() => setShowSettings(!showSettings)}>
                        ⚙️
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="section">
                    <div className="section-label">CÀI ĐẶT</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <input
                            type="text"
                            value={apiKeyInput}
                            onChange={e => setApiKeyInput(e.target.value)}
                            placeholder="Gemini API Key..."
                            style={{ flex: 1, fontSize: 20 }}
                        />
                        <button className="btn-success btn-small" onClick={handleSaveKey}>LƯU</button>
                    </div>
                    {getApiKey() && (
                        <div style={{ fontSize: 16, color: 'var(--color-accent-green)', marginTop: 8 }}>
                            ✅ Đã có API key
                        </div>
                    )}
                    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #333' }}>
                        <div className="section-label">CHẾ ĐỘ MÀN HÌNH</div>
                        <button
                            className={`btn-secondary btn-small ${youtube.nativeMode ? 'active' : ''}`}
                            onClick={() => youtube.toggleNativeMode(!youtube.nativeMode)}
                            style={{
                                background: youtube.nativeMode ? 'var(--color-accent-red)' : undefined,
                                width: '100%'
                            }}
                        >
                            {youtube.nativeMode ? '🔴 TẮT CHẾ ĐỘ YOUTUBE (VỀ KARAOKE)' : '🟢 BẬT CHẾ ĐỘ YOUTUBE (FULL CONTROL)'}
                        </button>
                        <div style={{ fontSize: 14, color: '#888', marginTop: 8 }}>
                            Cho phép điều khiển TV bằng chuột/phím và giao diện YouTube gốc.
                        </div>
                    </div>
                </div>
            )}

            {/* Preview */}
            <Preview
                playerState={youtube.playerState}
                currentTime={youtube.currentTime}
                duration={youtube.duration}
                progress={youtube.progress}
                formatTime={youtube.formatTime}
                initPreviewPlayer={youtube.initPreviewPlayer}
                onPause={youtube.pauseVideo}
                onResume={youtube.resumeVideo}
                onReplay={youtube.replayVideo}
                currentVideoId={youtube.currentVideoId}
            />

            {/* Now Playing + Next Button */}
            <NowPlaying
                currentSong={currentSong}
                nextSong={nextSong}
                onNext={handleNext}
                onCallSinger={callSinger}
                isVideoEnded={youtube.playerState === 'ended'}
                queueLength={queueLength}
            />

            {/* Queue */}
            <Queue
                waitingQueue={waitingQueue}
                onRemove={removeSong}
                onMoveUp={moveUp}
                onMoveDown={moveDown}
                onClearAll={clearAll}
            />

            {/* Search */}
            <SearchBar
                onSelectSong={handleSelectSong}
            />

            {/* Hot Songs Button */}
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setShowHotSongs(true)}>
                🔥 BÀI HAY HÁT
            </button>

            {/* Modals */}
            {singerModal && (
                <SingerInput
                    songTitle={`${singerModal.title}${singerModal.artist ? ` - ${singerModal.artist}` : ''}`}
                    onSubmit={handleSingerSubmit}
                    onSkip={handleSingerSkip}
                />
            )}

            {showHotSongs && (
                <HotSongs
                    hotSongs={getHotSongs()}
                    onSelect={handleHotSongSelect}
                    onClose={() => setShowHotSongs(false)}
                />
            )}

            {/* Toast */}
            {toast && <div className="toast">{toast}</div>}

            {/* Undo Bar */}
            {undoItem && (
                <div className="undo-bar" onClick={handleUndo}>
                    ↩️ Bấm đây để quay lại bài trước
                </div>
            )}
        </div>
    );
}
