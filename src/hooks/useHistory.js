import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'karaoke_history';

function loadHistory() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function useHistory() {
    const [history, setHistory] = useState(loadHistory);

    useEffect(() => {
        saveHistory(history);
    }, [history]);

    const addToHistory = useCallback((song) => {
        setHistory(prev => {
            const key = `${song.title}|||${song.artist}`.toLowerCase();
            const existing = prev.find(h => `${h.title}|||${h.artist}`.toLowerCase() === key);

            if (existing) {
                return prev.map(h =>
                    `${h.title}|||${h.artist}`.toLowerCase() === key
                        ? { ...h, count: h.count + 1, lastPlayed: Date.now(), lastSinger: song.singer }
                        : h
                );
            }

            return [...prev, {
                title: song.title,
                artist: song.artist,
                count: 1,
                lastPlayed: Date.now(),
                lastSinger: song.singer || '',
            }];
        });
    }, []);

    const getSuggestions = useCallback((query) => {
        if (!query || query.trim().length < 2) return [];
        const q = query.toLowerCase().trim();
        return history
            .filter(h =>
                h.title.toLowerCase().includes(q) ||
                h.artist.toLowerCase().includes(q)
            )
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [history]);

    const getHotSongs = useCallback(() => {
        return [...history]
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
    }, [history]);

    return {
        history,
        addToHistory,
        getSuggestions,
        getHotSongs,
    };
}
