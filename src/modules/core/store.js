import { create } from 'zustand';

export const useAppStore = create((set) => ({
    // Queue State
    queue: [],
    addToQueue: (item) => set((state) => {
        return { queue: [...state.queue, item] };
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
    restartTrigger: 0, // Integer to trigger effects
    setCurrentSong: (song) => set({ currentSong: song }),
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    triggerRestart: () => set((state) => ({ restartTrigger: state.restartTrigger + 1, isPlaying: true })),

    // Projection State
    isProjectionOpen: false,
    setProjectionOpen: (isOpen) => set({ isProjectionOpen: isOpen }),
}));
