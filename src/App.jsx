import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import QueueList from './modules/queue/QueueList';
import SearchBar from './modules/search/SearchBar';
import Card from './modules/ui/Card';
import { usePlayerSync } from './modules/player/usePlayerSync';
import ValidationView from './modules/projection/ValidationView';
import PreviewPlayer from './modules/player/PreviewPlayer';
import WaitingOverlay from './modules/player/WaitingOverlay';
import PlayerControls from './modules/player/PlayerControls';
import DisplayModeToggle from './modules/ui/DisplayModeToggle';

import HistoryButton from './modules/queue/HistoryButton';
import HistoryModal from './modules/queue/HistoryModal';
import { Search, Play, Pause, SkipForward, RotateCcw, Square } from 'lucide-react';
import { useAppStore } from './modules/core/store';
import { useTTS } from './modules/core/useTTS';
import { useMicDetection } from './modules/core/useMicDetection';
import { cleanYoutubeTitle } from './utils/titleUtils';
import { useTVWindow } from './modules/core/useTVWindow';
import { useFirebaseSync } from './modules/core/useFirebaseSync';
import { useSessionRestore, saveCurrentSongToSession, saveQueueToSession } from './modules/core/useSessionRestore';
import { setNowPlaying, clearNowPlaying, completeSong, updateNowPlayingProgress } from './services/firebaseQueueService';
import { getPlayerTime, getDuration } from './modules/player/playerRegistry';
import LegacyBridge from './modules/core/LegacyBridge';

const ControlPanel = () => {

  // Get store actions
  const { isPlaying, setIsPlaying, triggerRestart, queue, removeFromQueue, reorderQueue, setCurrentSong, currentSong, queueMode, toggleQueueMode, invitedSongId, setInvitedSongId, setWaitingForGuest, waitCountdown, setWaitCountdown, setCountdownPaused, setMicAttemptHint, addToHistory, loadHistory } = useAppStore();

  // Session restore logic (F5 vs fresh session)
  const { isRefresh, isRestoredSong, setIsRestoredSong } = useSessionRestore(setCurrentSong, setIsPlaying, reorderQueue);

  // Persist queue to session storage whenever it changes
  React.useEffect(() => {
    saveQueueToSession(queue);
  }, [queue]);

  // Load today's song history from localStorage on mount
  React.useEffect(() => {
    loadHistory();
  }, []);

  const logCurrentSongToHistory = () => {
    const finishedSong = useAppStore.getState().currentSong;
    if (finishedSong && finishedSong.videoId) {
      addToHistory({
        id: `${finishedSong.videoId}_${Date.now()}`,
        videoId: finishedSong.videoId,
        title: finishedSong.title,
        cleanTitle: finishedSong.cleanTitle || '',
        addedBy: finishedSong.addedBy || 'Khách',
        customerId: finishedSong.customerId || '',
        thumbnail: finishedSong.thumbnail || '',
        completedAt: Date.now(),
      });
    }
  };

  const handleNext = () => {
    if (queue.length > 0) {
      const nextSong = queue[0];
      setCurrentSong(nextSong);
      removeFromQueue(nextSong.id);
    } else {
      setIsPlaying(false);
      setCurrentSong(null); // Clear current song to indicate "Idle" state
    }
  };

  const handleSongEnd = React.useCallback(() => {
    logCurrentSongToHistory();
    handleNext();
  }, [queue, removeFromQueue, setCurrentSong, setIsPlaying, addToHistory]);

  // Sync state to TV window & Firebase queue
  usePlayerSync('host', { onSongEnded: handleSongEnd });
  useFirebaseSync(isRefresh);

  // Auto-play: block until session restore is done on F5
  // sessionStorage restore is synchronous so currentSong is set before first render completes
  const [restoreComplete, setRestoreComplete] = React.useState(!isRefresh);
  React.useEffect(() => {
    if (!isRefresh) return;
    if (isRestoredSong || currentSong) {
      setRestoreComplete(true);
    }
  }, [isRefresh, isRestoredSong, currentSong]);
  // Fallback timeout: if no song was saved, unblock auto-play after 500ms
  React.useEffect(() => {
    if (isRefresh && !restoreComplete) {
      const timer = setTimeout(() => setRestoreComplete(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isRefresh, restoreComplete]);

  React.useEffect(() => {
    if (!restoreComplete) return;
    if (!currentSong && queue.length > 0 && queueMode === 'auto') {
      const nextSong = queue[0];
      setCurrentSong(nextSong);
      removeFromQueue(nextSong.id);
    }
  }, [currentSong, queue, queueMode, setCurrentSong, removeFromQueue, restoreComplete]);

  const [activePanel, setActivePanel] = React.useState('center'); // 'left', 'center', 'right'
  const { announce } = useTTS();
  const { waitForPresence, cancelDetection } = useMicDetection();
  const { isTVOpen, openTV, closeTV } = useTVWindow();

  // Auto-start: ensure extend mode and open TV on secondary screen at launch
  const autoStartedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    fetch('/api/display/extend', { method: 'POST' })
      .then(() => { setTimeout(() => openTV(), 1500); })
      .catch(() => { openTV(); }); // Even if endpoint fails, try opening TV
  }, [openTV]);

  const micAbortRef = React.useRef(null);
  const skipWaitRef = React.useRef(false);

  // Sync currentSong to Firebase for customer-web
  const initialLoadRef = React.useRef(true);

  React.useEffect(() => {
    // SKIP clearing on initial load if it's a refresh (wait for restore)
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      if (isRefresh && !currentSong) {
        return;
      }
    }

    if (currentSong) {
      saveCurrentSongToSession(currentSong);
      setNowPlaying(currentSong).catch(() => { });
      // Song is now playing → complete it (remove from queue + advance startRound for fairness)
      if (currentSong.firebaseKey) {
        completeSong(currentSong.firebaseKey).catch(() => { });
      }
    } else {
      saveCurrentSongToSession(null);
      clearNowPlaying().catch(() => { });
    }
  }, [currentSong, isRefresh]);

  // Sync playback progress to Firebase every 10s for customer-web
  React.useEffect(() => {
    if (!currentSong || !isPlaying) return;
    const interval = setInterval(() => {
      const time = getPlayerTime();
      const dur = getDuration();
      if (dur > 0) updateNowPlayingProgress(time, dur).catch(() => { });
    }, 10000);
    // Also send immediately when song starts playing
    const t = getPlayerTime();
    const d = getDuration();
    if (d > 0) updateNowPlayingProgress(t, d).catch(() => { });
    return () => clearInterval(interval);
  }, [currentSong, isPlaying]);

  const handlePlayPause = () => {
    // If the current song is staged (waiting for manual start after a delete),
    // we simply un-stage it and start playing/announcing.
    if (currentSong?.isStaged) {
      const activeSong = { ...currentSong, isStaged: false };
      setCurrentSong(activeSong);
      setIsPlaying(true);
      return;
    }

    // Logic handled by active effect above, but manual override needs care
    if (!currentSong && queue.length > 0) {
      // Manual trigger for first song (if effect didn't catch it yet or manual mode)
      const nextSong = queue[0];
      setCurrentSong(nextSong);
      removeFromQueue(nextSong.id);
      return;
    }
    setIsPlaying(!isPlaying);
  };

  const handleManualStart = () => {
    skipWaitRef.current = true;
    if (micAbortRef.current) micAbortRef.current.abort();
  };



  // Auto-announce when song changes
  const [announcedSongId, setAnnouncedSongId] = React.useState(null);

  const performAnnouncement = React.useCallback(async (song) => {
    const singer = song.addedBy || 'quý khách';
    let songName = song.cleanTitle;

    if (!songName) {
      songName = cleanYoutubeTitle(song.title);
    }

    // Random gentle templates
    const templates = [
      `Xin mời ${singer} lên sân khấu, trình bày ca khúc ${songName}`,
      `${singer} ơi? Mời ${singer} lên sân khấu trình bày bài hát ${songName} của mình`,
      `Tiếp theo chương trình, xin mời ${singer} gửi tặng mọi người ca khúc ${songName}`,
      `Một tràng pháo tay cho ${singer} với ca khúc ${songName}`,
      `Xin mời giọng ca ${singer} chuẩn bị cho bài hát ${songName}`,
      `Mời quý vị cùng thưởng thức giọng ca của ${singer} qua nhạc phẩm ${songName}`,
      `Sân khấu xin được nhường lại cho ${singer} với bài hát ${songName}`,
      `Để thay đổi không khí, mời ${singer} gửi đến mọi người ca khúc ${songName}`,
      `Và sau đây, giọng ca ${singer} sẽ trình bày bài hát ${songName}`,
      `Xin mời ${singer} cầm mic và cháy hết mình với ${songName}`,
      `Tiếp nối chương trình văn nghệ, mời ${singer} lên sân khấu với bài ${songName}`
    ];

    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];

    await announce(randomTemplate);
  }, [announce]);

  // Watch invitedSongId for manual mode TTS-only announcement
  React.useEffect(() => {
    if (!invitedSongId || queueMode !== 'manual') return;

    const song = queue.find((s) => s.id === invitedSongId);
    if (!song) return;

    const doAnnounce = async () => {
      if (song.cleanTitle) {
        await performAnnouncement(song);
      } else {
        await new Promise((r) => setTimeout(r, 3000));
        await performAnnouncement(song);
      }
      // After announcement, set as current song and start playback so TV auto-plays
      setCurrentSong(song);
      removeFromQueue(song.id);
      setIsPlaying(true);
    };

    doAnnounce();
  }, [invitedSongId, queueMode, queue, performAnnouncement, setCurrentSong, removeFromQueue, setIsPlaying]);

  React.useEffect(() => {
    if (!currentSong) return;
    if (currentSong.isStaged) return; // Skip if staged (waiting for manual start)
    // Skip TTS entirely for replaced songs — they play instantly
    if (currentSong.isReplaced) {
      setAnnouncedSongId(currentSong.id);
      return;
    }
    if (currentSong.id === announcedSongId) return;

    // Skip TTS announcement for restored songs on F5 refresh
    if (isRestoredSong) {
      setAnnouncedSongId(currentSong.id);
      setIsRestoredSong(false); // Reset for next time
      return;
    }

    // In manual mode, if this song was already invited (announced), skip TTS but DON'T auto-play
    if (queueMode === 'manual' && currentSong.id === invitedSongId) {
      setAnnouncedSongId(currentSong.id);
      setInvitedSongId(null);
      // Manual mode: host clicks "Phát" manually
      return;
    }

    // 1. Stop playing immediately when new song loads
    setIsPlaying(false);

    // Cancel any previous mic detection
    if (micAbortRef.current) micAbortRef.current.abort();
    const abortController = new AbortController();
    micAbortRef.current = abortController;
    skipWaitRef.current = false; // Reset skip state

    const doAnnounceAndPlay = async () => {
      await performAnnouncement(currentSong);

      if (abortController.signal.aborted && !skipWaitRef.current) return;

      // Manual mode: announce only, don't auto-play — host clicks "Phát"
      if (queueMode === 'manual') {
        setAnnouncedSongId(currentSong.id);
        return;
      }

      // Auto mode: wait for guest to arrive on stage via mic detection
      setWaitingForGuest(true);

      const reason = await waitForPresence(abortController.signal, setWaitCountdown, (level) => {
        setMicAttemptHint(level);
        // Auto-clear hint after 3s
        setTimeout(() => setMicAttemptHint(null), 3000);
      });
      setWaitingForGuest(false);
      setMicAttemptHint(null);

      // If aborted but NOT skipped manually, stop here (it means song changed or other abort)
      if (abortController.signal.aborted && !skipWaitRef.current) return;

      setAnnouncedSongId(currentSong.id);
      setIsPlaying(true);
    };

    // If we have the clean title, announce immediately
    if (currentSong.cleanTitle) {
      doAnnounceAndPlay();
    } else {
      // Wait up to 3 seconds for LLM to finish
      const timer = setTimeout(() => {
        if (currentSong.id !== announcedSongId) {
          doAnnounceAndPlay();
        }
      }, 3000);
      return () => {
        clearTimeout(timer);
        abortController.abort();
        cancelDetection();
        setWaitingForGuest(false);
      };
    }

    return () => {
      abortController.abort();
      cancelDetection();
      setWaitingForGuest(false);
    };
  }, [currentSong, announcedSongId, queueMode, invitedSongId, isRestoredSong, performAnnouncement, setIsPlaying, setInvitedSongId, setWaitingForGuest, setIsRestoredSong, waitForPresence, cancelDetection, setMicAttemptHint]);

  const playerContainerRef = React.useRef(null);

  const handleReplay = () => triggerRestart();

  const handleClearSong = () => {
    setIsPlaying(false);
    setWaitingForGuest(false);
    if (micAbortRef.current) micAbortRef.current.abort();
    setAnnouncedSongId(null);

    // If queue has songs, STAGE the next one (don't play yet)
    // This allows the Host to see it, but TV remains idle
    if (queue.length > 0) {
      const nextSong = { ...queue[0], isStaged: true };
      setCurrentSong(nextSong);
      removeFromQueue(nextSong.id);
    } else {
      setCurrentSong(null);
    }
  };

  // Re-announce TTS for current song (manual mode)
  const handleReAnnounce = React.useCallback(() => {
    if (currentSong) {
      performAnnouncement(currentSong);
    }
  }, [currentSong, performAnnouncement]);

  // Global Keyboard Shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'IFRAME'].includes(document.activeElement.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, handlePlayPause]);

  // Dynamic flex-grow values based on active panel
  const getPanelFlex = (panel) => {
    const baseClasses = "flex flex-col gap-4 min-w-0 overflow-hidden transition-[flex] duration-500 ease-in-out will-change-[flex]";

    switch (activePanel) {
      case 'left':
        if (panel === 'left') return `${baseClasses} flex-[5]`;
        if (panel === 'center') return `${baseClasses} flex-[4]`;
        return `${baseClasses} flex-[3]`;
      case 'right':
        if (panel === 'left') return `${baseClasses} flex-[2]`;
        if (panel === 'center') return `${baseClasses} flex-[4]`;
        return `${baseClasses} flex-[6]`;
      case 'center':
      default:
        if (panel === 'left') return `${baseClasses} flex-[2]`;
        if (panel === 'center') return `${baseClasses} flex-[6]`;
        return `${baseClasses} flex-[2]`;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen font-sans p-2 gap-4 bg-slate-100">
      <LegacyBridge />
      {/* Left Panel: Queue */}
      <div
        className={getPanelFlex('left')}
        onClick={() => setActivePanel('left')}
        onMouseEnter={() => setActivePanel('left')}
      >
        <Card className={`h-full flex flex-col border border-slate-200 shadow-sm bg-white overflow-hidden transition-all ${activePanel === 'left' ? 'shadow-md border-slate-300' : ''}`}>
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">HÀNG CHỜ</h2>
            <div className="flex items-center gap-2">
              <HistoryButton />
              <button
                onClick={toggleQueueMode}
                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors cursor-pointer ${queueMode === 'auto' ? 'bg-indigo-500' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${queueMode === 'auto' ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{queueMode === 'auto' ? 'Auto' : 'Thủ Công'}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <QueueList onReAnnounce={handleReAnnounce} />
          </div>
        </Card>
      </div>

      {/* Center Panel: Main Player & Controls */}
      <div
        className={getPanelFlex('center')}
        onClick={() => setActivePanel('center')}
        onMouseEnter={() => setActivePanel('center')}
      >
        <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-slate-200 mb-0">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Logo" className="w-12 h-12 rounded-xl shadow-sm bg-white" />
            <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">KARAOKE SÁU NHÀN</h1>
          </div>

          <DisplayModeToggle openTV={openTV} closeTV={closeTV} isTVOpen={isTVOpen} />
        </div>

        {/* Player Card — no native YT controls on host */}
        <div ref={playerContainerRef} className="player-container relative bg-black overflow-hidden shadow-lg rounded-xl aspect-video w-full">
          <PreviewPlayer className="w-full h-full" />
          <WaitingOverlay countdown={waitCountdown} onSkip={handleManualStart} onPauseToggle={() => {
            const store = useAppStore.getState();
            store.setCountdownPaused(!store.countdownPaused);
          }} />
        </div>

        {/* Custom Controls: Seek + Volume */}
        <Card className="bg-white border-0 shadow-sm rounded-xl px-3 py-2">
          <PlayerControls />
        </Card>

        {/* Playback Controls */}
        <Card className="bg-white border-0 shadow-sm rounded-xl p-3">
          <div className="flex gap-4">
            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              className={`flex-1 py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-indigo-200/50 cursor-pointer ${isPlaying
                ? 'bg-slate-200 text-slate-600 border border-slate-300 hover:bg-slate-300'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            >
              {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
              <span className="text-xl font-black uppercase tracking-tight">{isPlaying ? 'Dừng' : 'Phát'}</span>
            </button>

            {/* Next */}
            <button
              onClick={() => { logCurrentSongToHistory(); handleNext(); }}
              disabled={queue.length === 0}
              className="flex-1 py-4 px-6 rounded-xl flex items-center justify-center gap-3 bg-slate-800 text-white transition-all active:scale-95 shadow-lg shadow-slate-400/50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-900"
            >
              <SkipForward size={28} fill="currentColor" />
              <span className="text-xl font-black uppercase tracking-tight">Qua Bài</span>
            </button>

            {/* Replay */}
            <button
              onClick={handleReplay}
              disabled={!currentSong}
              className="flex-1 py-4 px-6 rounded-xl flex items-center justify-center gap-3 bg-orange-500 text-white transition-all active:scale-95 shadow-lg shadow-orange-200/50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-600"
            >
              <RotateCcw size={28} />
              <span className="text-xl font-black uppercase tracking-tight">Phát Lại</span>
            </button>

            {/* Clear Song */}
            <button
              onClick={handleClearSong}
              disabled={!currentSong}
              className="flex-1 py-4 px-6 rounded-xl flex items-center justify-center gap-3 bg-red-500 text-white transition-all active:scale-95 shadow-lg shadow-red-200/50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600"
            >
              <Square size={28} fill="currentColor" />
              <span className="text-xl font-black uppercase tracking-tight">Xóa Bài</span>
            </button>
          </div>
        </Card>
      </div>

      {/* Right Panel: Search & Suggestions */}
      <div
        className={getPanelFlex('right')}
        onClick={() => setActivePanel('right')}
        onMouseEnter={() => setActivePanel('right')}
        onFocusCapture={() => setActivePanel('right')}
      >
        <Card className={`h-full flex flex-col border border-slate-200 shadow-sm bg-white overflow-hidden transition-all ${activePanel === 'right' ? 'shadow-md border-slate-300' : ''}`}>
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Search size={18} className="text-slate-800" />
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Tìm Kiếm</h2>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <SearchBar isExpanded={activePanel === 'right'} />
          </div>
        </Card>
      </div>

      <HistoryModal />
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ControlPanel />} />
        <Route path="/projection" element={<ValidationView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
