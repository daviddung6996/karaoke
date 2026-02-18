import { create } from 'zustand';

export const useAppStore = create((set) => ({
    // Queue State
    queue: [],
    addToQueue: (item) => set((state) => {
        if (!item || !item.videoId || !item.title) {
                return state;
        }
        return { queue: [...state.queue, item] };
    }),
    insertToQueue: (item, index) => set((state) => {
        if (!item || !item.videoId || !item.title) {
                return state;
        }
        const newQueue = [...state.queue];
        if (index < 0) index = 0;
        if (index > newQueue.length) index = newQueue.length;
        newQueue.splice(index, 0, item);
        return { queue: newQueue };
    }),
    removeFromQueue: (id) => set((state) => ({ queue: state.queue.filter((i) => i.id !== id) })),
    updateQueueItem: (id, updates) => set((state) => ({
        queue: state.queue.map((i) => (i.id === id ? { ...i, ...updates } : i))
    })),
    reorderQueue: (newQueue) => set({ queue: newQueue }),
    // Manual reorder: save ordered IDs so Firebase sync preserves user's arrangement
    // Persisted to localStorage so it survives F5
    manualOrder: JSON.parse(localStorage.getItem('karaoke_manualOrder') || 'null'),
    setManualOrder: (orderIds) => {
        localStorage.setItem('karaoke_manualOrder', JSON.stringify(orderIds));
        set({ manualOrder: orderIds });
    },
    clearManualOrder: () => {
        localStorage.removeItem('karaoke_manualOrder');
        set({ manualOrder: null });
    },

    // Queue Mode
    queueMode: 'auto', // 'auto' | 'manual'
    toggleQueueMode: () => set((state) => ({ queueMode: state.queueMode === 'auto' ? 'manual' : 'auto' })),
    invitedSongId: null,
    setInvitedSongId: (id) => set({ invitedSongId: id }),

    // Player State
    currentSong: null,
    isPlaying: false,
    waitingForGuest: false,
    setWaitingForGuest: (val) => set({ waitingForGuest: val }),
    waitCountdown: 30,
    setWaitCountdown: (val) => set({ waitCountdown: val }),
    countdownPaused: false,
    setCountdownPaused: (val) => set({ countdownPaused: val }),
    micAttemptHint: null,
    setMicAttemptHint: (hint) => set({ micAttemptHint: hint }),
    restartTrigger: 0, // Integer to trigger effects
    setCurrentSong: (song) => set({ currentSong: song }),
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    triggerRestart: () => set((state) => ({ restartTrigger: state.restartTrigger + 1, isPlaying: true })),
    // Volume State
    volume: 100,
    isMuted: false,
    setVolume: (vol) => set({ volume: vol }),
    setIsMuted: (val) => set({ isMuted: val }),

    // Projection State
    isProjectionOpen: false,
    setProjectionOpen: (isOpen) => set({ isProjectionOpen: isOpen }),

    // History State
    songHistory: [],
    showHistoryModal: false,
    setShowHistoryModal: (val) => set({ showHistoryModal: val }),

    addToHistory: (entry) => set((state) => {
        if (!entry || !entry.videoId) return state;
        const newHistory = [entry, ...state.songHistory];
        const dateKey = `karaoke_history_${new Date().toISOString().slice(0, 10)}`;
        try {
            localStorage.setItem(dateKey, JSON.stringify(newHistory));
        } catch (e) {
            console.warn('[History] Failed to persist:', e);
        }
        return { songHistory: newHistory };
    }),

    loadHistory: () => {
        const today = new Date();
        const dateKey = `karaoke_history_${today.toISOString().slice(0, 10)}`;
        try {
            const raw = localStorage.getItem(dateKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                set({ songHistory: Array.isArray(parsed) ? parsed : [] });
            } else {
                set({ songHistory: [] });
            }
            // Cleanup keys older than 7 days
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith('karaoke_history_') && key !== dateKey) {
                    const dateStr = key.replace('karaoke_history_', '');
                    const keyDate = new Date(dateStr);
                    if ((today - keyDate) / (1000 * 60 * 60 * 24) > 7) {
                        localStorage.removeItem(key);
                    }
                }
            }
        } catch (e) {
            console.warn('[History] Failed to load:', e);
            set({ songHistory: [] });
        }
    },

    clearHistory: () => {
        const dateKey = `karaoke_history_${new Date().toISOString().slice(0, 10)}`;
        localStorage.removeItem(dateKey);
        set({ songHistory: [] });
    },
}));
