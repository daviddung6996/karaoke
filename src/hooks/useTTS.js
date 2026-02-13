import { useCallback } from 'react';
import { cleanYouTubeTitle } from '../services/ai';

function playTts(text, lang = 'vi') {
    return new Promise(async (resolve) => {
        try {
            const res = await fetch(`/api/tts?q=${encodeURIComponent(text)}&tl=${lang}`);
            if (!res.ok) {
                console.warn('[TTS] Server returned:', res.status);
                resolve();
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.volume = 1.0;
            audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
            audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
            await audio.play();
        } catch (err) {
            console.warn('[TTS] Error:', err.message);
            resolve();
        }
    });
}

export function useTTS() {
    const announce = useCallback(async (text) => {
        if (!text) return;

        const chunks = splitText(text, 180);
        console.log('[TTS] Speaking:', text, `(${chunks.length} chunk(s))`);

        for (const chunk of chunks) {
            await playTts(chunk);
        }
    }, []);

    const announceSinger = useCallback(async (currentSong, nextSong) => {
        if (!currentSong) return;

        const singerName = currentSong.singer || 'bạn';

        // Use Gemini to extract clean song name from YouTube title
        const { song, artist } = await cleanYouTubeTitle(currentSong.title);
        const displayTitle = artist ? `${song} của ${artist}` : song;

        await announce(`Mời ${singerName} hát bài ${displayTitle}`);

        if (nextSong) {
            await new Promise(r => setTimeout(r, 1000));
            const nextName = nextSong.singer || 'bạn';
            await announce(`Kế tiếp là ${nextName}`);
        }
    }, [announce]);

    const callSinger = useCallback(async (song) => {
        if (!song) return;
        const singerName = song.singer || 'bạn';
        const { song: songTitle } = await cleanYouTubeTitle(song.title);

        await announce(`${singerName} có ở đây không ạ? Mời ${singerName} lên hát ca khúc ${songTitle}`);
    }, [announce]);

    return { announce, announceSinger, callSinger };
}

function splitText(text, maxLen) {
    if (text.length <= maxLen) return [text];

    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxLen) {
            chunks.push(remaining);
            break;
        }
        let splitIdx = remaining.lastIndexOf(',', maxLen);
        if (splitIdx < maxLen / 2) splitIdx = remaining.lastIndexOf(' ', maxLen);
        if (splitIdx < maxLen / 2) splitIdx = maxLen;

        chunks.push(remaining.substring(0, splitIdx).trim());
        remaining = remaining.substring(splitIdx).trim();
    }

    return chunks;
}
