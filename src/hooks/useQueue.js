import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'karaoke_queue';

function loadQueue() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveQueue(queue) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

let nextId = Date.now();

export function useQueue() {
    const [queue, setQueue] = useState(loadQueue);

    useEffect(() => {
        saveQueue(queue);
    }, [queue]);

    const addSong = useCallback((song) => {
        const item = { id: nextId++, ...song, addedAt: Date.now() };
        setQueue(prev => [...prev, item]);
        return item;
    }, []);

    const removeSong = useCallback((id) => {
        setQueue(prev => prev.filter(item => item.id !== id));
    }, []);

    const moveUp = useCallback((id) => {
        setQueue(prev => {
            const idx = prev.findIndex(item => item.id === id);
            if (idx <= 1) return prev;
            const next = [...prev];
            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
            return next;
        });
    }, []);

    const moveDown = useCallback((id) => {
        setQueue(prev => {
            const idx = prev.findIndex(item => item.id === id);
            if (idx < 1 || idx >= prev.length - 1) return prev;
            const next = [...prev];
            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
            return next;
        });
    }, []);

    const advanceQueue = useCallback(() => {
        let removed = null;
        setQueue(prev => {
            if (prev.length === 0) return prev;
            removed = prev[0];
            return prev.slice(1);
        });
        return removed;
    }, []);

    const clearAll = useCallback(() => {
        setQueue([]);
    }, []);

    const currentSong = queue.length > 0 ? queue[0] : null;
    const nextSong = queue.length > 1 ? queue[1] : null;
    const waitingQueue = queue.slice(1);

    return {
        queue,
        currentSong,
        nextSong,
        waitingQueue,
        addSong,
        removeSong,
        moveUp,
        moveDown,
        advanceQueue,
        clearAll,
        queueLength: queue.length,
    };
}
