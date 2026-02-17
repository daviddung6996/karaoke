import { create } from 'zustand';

export const useAppStore = create((set) => ({
    // Queue State
    queue: [],
    addToQueue: (item) => set((state) => {
        if (!item || !item.videoId || !item.title) {
            console.warn('[Store] Ignored invalid addToQueue:', item);
            return state;
        }
        return { queue: [...state.queue, item] };
    }),
    insertToQueue: (item, index) => set((state) => {
        if (!item || !item.videoId || !item.title) {
            console.warn('[Store] Ignored invalid insertToQueue:', item);
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

    // Projection State
    isProjectionOpen: false,
    setProjectionOpen: (isOpen) => set({ isProjectionOpen: isOpen }),
}));
