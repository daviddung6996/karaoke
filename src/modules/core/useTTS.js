import { useCallback } from 'react';

export const useTTS = () => {
    const announce = useCallback((text) => {
        if (!text || !window.speechSynthesis) return Promise.resolve();

        // Clean text for better experience
        const cleanText = text
            .replace(/[\[\]\(\)\|\-]/g, ' ')
            .replace(/\b(karaoke|beat|gốc|tông|tone|nam|nữ|song ca|hạ|ca sĩ|full|hd|official|video|music|lyrics|lyric|mv|audio|remix|cover|live|lofi|nhạc sống|mới nhất|hay nhất|acoustic|ver|version)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleanText) return Promise.resolve();

        const speak = (text) => {
            return new Promise(async (resolve) => {
                try {
                    const url = `/tts?ie=UTF-8&tl=vi&client=gtx&q=${encodeURIComponent(text)}`;
                    const res = await fetch(url);
                    const blob = await res.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const audio = new Audio(blobUrl);

                    audio.playbackRate = 1.0;

                    // Resolve when audio finishes or errors
                    audio.onended = () => { URL.revokeObjectURL(blobUrl); resolve(); };
                    audio.onerror = (e) => {
                        URL.revokeObjectURL(blobUrl);
                        console.error("Audio playback error", e);
                        resolve();
                    };

                    await audio.play();
                } catch (error) {
                    console.error("TTS Error:", error);
                    resolve(); // Resolve anyway to proceed
                }
            });
        };

        return speak(cleanText);
    }, []);

    // Placeholder for isPlaying, though native TTS doesn't easily expose "playing" state 
    // without complex event listeners. For now, false is fine or we can add state if needed.
    return { announce, isPlaying: false };
};
