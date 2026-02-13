const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

let API_KEY = import.meta.env.VITE_GEMINI_KEY || localStorage.getItem('karaoke_gemini_key') || '';

export function setApiKey(key) {
    API_KEY = key;
    localStorage.setItem('karaoke_gemini_key', key);
}

export function getApiKey() {
    return API_KEY;
}

export async function searchSongByAI(query) {
    if (!API_KEY) {
        throw new Error('API_KEY_MISSING');
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `Bạn là chuyên gia nhạc Việt Nam. Người dùng mô tả bài hát, hãy đoán bài hát.
Trả lời CHÍNH XÁC theo JSON format, không giải thích gì thêm:
{"songs": [{"title": "Tên bài hát", "artist": "Ca sĩ"}]}
Tối đa 3 kết quả. Nếu không biết, trả về {"songs": []}.

Mô tả: "${query}"`
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 300,
            },
        }),
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.error('[AI] Gemini API error:', response.status, errBody);
        throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return parsed.songs || [];
        }
    } catch {
        // parse error
    }

    return [];
}

export async function cleanYouTubeTitle(ytTitle) {
    // Always try local cleaning first (instant, no API needed)
    const local = localCleanTitle(ytTitle);

    // If we have a valid API key, try Gemini for better results
    if (API_KEY && API_KEY.length > 20 && !API_KEY.includes('Fake')) {
        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Trích xuất TÊN BÀI HÁT và CA SĨ từ tiêu đề YouTube karaoke sau.
Bỏ hết các từ: Karaoke, HD, Beat, Tone Nam/Nữ, Nhạc Sống, MV, Official, Lyric, Cover, Remix, v.v.
Trả lời ĐÚNG JSON: {"song":"tên bài","artist":"ca sĩ"}
Nếu không rõ ca sĩ, để artist rỗng.

Tiêu đề: "${ytTitle}"`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 100,
                    },
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const match = text.match(/\{[\s\S]*\}/);
                if (match) {
                    const parsed = JSON.parse(match[0]);
                    console.log('[AI] Gemini cleaned:', ytTitle, '→', parsed);
                    return { song: parsed.song || local.song, artist: parsed.artist || local.artist };
                }
            }
        } catch (err) {
            console.warn('[AI] Gemini clean failed, using local:', err.message);
        }
    }

    console.log('[AI] Local cleaned:', ytTitle, '→', local);
    return local;
}

function localCleanTitle(title) {
    // Split by common separators to find artist
    const separators = /\s*[|–—]\s*/;
    const parts = title.split(separators).map(p => p.trim()).filter(Boolean);

    let songPart = parts[0] || title;
    let artist = '';

    // Check if any part looks like an artist name (not containing karaoke keywords)
    const karaokeWords = /karaoke|beat|tone|nhạc sống|official|lyrics?|mv |hd|remix|cover|instrumental|playback/i;
    for (let i = 1; i < parts.length; i++) {
        if (!karaokeWords.test(parts[i]) && parts[i].length > 1) {
            artist = parts[i];
            break;
        }
    }

    // Also check for " - Artist" pattern within the song part
    const dashSplit = songPart.split(/\s*-\s*/);
    if (dashSplit.length >= 2) {
        const lastPart = dashSplit[dashSplit.length - 1].trim();
        if (!karaokeWords.test(lastPart) && lastPart.length > 1) {
            if (!artist) artist = lastPart;
            songPart = dashSplit.slice(0, -1).join(' - ');
        }
    }

    // Remove karaoke-related keywords from song name
    songPart = songPart
        .replace(/\b(karaoke|hd|4k|beat\s*(gốc|chuẩn)?|tone\s*(nam|nữ|hạ)?|nhạc\s*sống|official|lyrics?|mv|remix|cover|instrumental|playback)\b/gi, '')
        .replace(/\s*\(.*?\)\s*/g, ' ')  // Remove parenthetical content
        .replace(/\s*\[.*?\]\s*/g, ' ')  // Remove bracketed content
        .replace(/\s{2,}/g, ' ')
        .trim();

    // Clean artist too
    if (artist) {
        artist = artist
            .replace(/\b(karaoke|beat|tone|nhạc sống|official|lyrics?|mv|remix|cover)\b/gi, '')
            .trim();
    }

    return { song: songPart || title, artist };
}
