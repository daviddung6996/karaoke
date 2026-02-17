import React from 'react';
import { clearNowPlaying } from '../../services/firebaseQueueService';

const SESSION_KEY = '__karaoke_session_active__';
const CURRENT_SONG_KEY = '__karaoke_current_song__';
const QUEUE_KEY = '__karaoke_queue__';

/**
 * Detects if current load is F5 refresh or fresh session
 * Uses sessionStorage flag: if exists, it's a refresh; if not, fresh session
 */
function useRefreshDetection() {
  return React.useMemo(() => {
    const flag = sessionStorage.getItem(SESSION_KEY);

    if (!flag) {
      sessionStorage.setItem(SESSION_KEY, '1');
      return false;
    }

    return true;
  }, []);
}

/**
 * Save currentSong to sessionStorage so F5 can restore it instantly (no race condition)
 */
export function saveCurrentSongToSession(song) {
  if (song) {
    sessionStorage.setItem(CURRENT_SONG_KEY, JSON.stringify(song));
  } else {
    sessionStorage.removeItem(CURRENT_SONG_KEY);
  }
}

/**
 * Save queue to sessionStorage
 */
export function saveQueueToSession(queue) {
  if (queue && queue.length > 0) {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } else {
    sessionStorage.removeItem(QUEUE_KEY);
  }
}

/**
 * Restore currentSong from sessionStorage (synchronous, instant)
 */
function restoreCurrentSongFromSession() {
  try {
    const raw = sessionStorage.getItem(CURRENT_SONG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[useSessionRestore] Failed to parse saved currentSong:', e);
  }
  return null;
}

/**
 * Restore queue from sessionStorage
 */
function restoreQueueFromSession() {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[useSessionRestore] Failed to parse saved queue:', e);
  }
  return [];
}

/**
 * Handles F5 refresh vs fresh session:
 * - F5: Restore currentSong & Queue from sessionStorage (instant, no async race)
 * - Fresh: Clear Firebase nowPlaying & sessionStorage
 * 
 * Returns { isRefresh, isRestoredSong } flags for use in announcement logic
 */
export function useSessionRestore(setCurrentSong, setIsPlaying, setQueue) { // Added setQueue
  const isRefresh = useRefreshDetection();
  const [isRestoredSong, setIsRestoredSong] = React.useState(false);
  const restoredRef = React.useRef(false);

  React.useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    // Fresh session: clear everything
    if (!isRefresh) {
      clearNowPlaying().catch(() => { });
      sessionStorage.removeItem(CURRENT_SONG_KEY);
      sessionStorage.removeItem(QUEUE_KEY);
      return;
    }

    // F5 refresh: restore from sessionStorage (instant, synchronous)
    const savedSong = restoreCurrentSongFromSession();
    if (savedSong) {
      setCurrentSong(savedSong);
      setIsPlaying(true);
      setIsRestoredSong(true);
    }

    const savedQueue = restoreQueueFromSession();
    if (savedQueue && savedQueue.length > 0) {
      if (setQueue) setQueue(savedQueue);
    }

  }, [isRefresh, setCurrentSong, setIsPlaying, setQueue]);

  return { isRefresh, isRestoredSong, setIsRestoredSong };
}
