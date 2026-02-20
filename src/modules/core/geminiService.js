
// Gemini API calls are proxied through Vite server to keep the API key server-side

// Helper to clean JSON string
const cleanJSON = (text) => {
    if (!text) return null;

    // Remove markdown code blocks
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Fix common JSON issues from LLMs:
    // 1. Replace single quotes with double quotes for keys/strings (risky but often needed for loose JSON)
    //    We only replace if it looks like a key or simple string value to avoid breaking content with apostrophes
    //    Actually, a safer approach for keys: quote unquoted keys

    // Quote unquoted keys: { key: "value" } -> { "key": "value" }
    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');

    // Convert single-quoted keys: { 'key': "value" } -> { "key": "value" }
    cleaned = cleaned.replace(/([{,]\s*)'([a-zA-Z0-9_]+)'(\s*:)/g, '$1"$2"$3');

    // 1. Array Case `[...]`
    const firstOpenBracket = cleaned.indexOf('[');
    const lastCloseBracket = cleaned.lastIndexOf(']');

    if (firstOpenBracket !== -1) {
        if (lastCloseBracket !== -1 && lastCloseBracket > firstOpenBracket) {
            return cleaned.substring(firstOpenBracket, lastCloseBracket + 1);
        } else {
            // Salvage truncated array: [ {..}, {..
            let salvaged = cleaned.substring(firstOpenBracket);
            const lastBraceClose = salvaged.lastIndexOf('}');
            if (lastBraceClose !== -1) {
                return salvaged.substring(0, lastBraceClose + 1) + ']';
            }
        }
    }

    // 2. Object Case `{...}`
    const firstOpenBrace = cleaned.indexOf('{');
    const lastCloseBrace = cleaned.lastIndexOf('}');

    if (firstOpenBrace !== -1) {
        if (lastCloseBrace !== -1 && lastCloseBrace > firstOpenBrace) {
            return cleaned.substring(firstOpenBrace, lastCloseBrace + 1);
        } else {
            // Salvage truncated object? Harder, but let's try finding the last key-value pair
            // For now, just return what we have and let JSON.parse fail if it must
            return cleaned.substring(firstOpenBrace);
        }
    }

    return cleaned;
};

const SYSTEM_PROMPT = `Gợi ý bài hát karaoke.
Input: từ khóa (có thể sai chính tả, gõ tắt, thiếu dấu).
Output: JSON array string 8-10 items "Title|Artist|Query".
Format: ["Title|Artist|Query", "Title|Artist|Query"]
Quy tắc:
1. CHỈ gợi ý bài hát CÓ THẬT, phổ biến tại Việt Nam. TUYỆT ĐỐI KHÔNG BỊA TÊN.
2. ƯU TIÊN SỬA LỖI CHÍNH TẢ & VIẾT TẮT (vd: "co"->"cho", "dc"->"được").
3. Đa dạng kết quả, TRÁNH trùng lặp.
4. CHỈ TRẢ VỀ JSON ARRAY STRING.
5. Dùng dấu gạch đứng (|) để ngăn cách.`;

// Core fetch function (internal)
const fetchGeminiRaw = async (input, signal) => {
    if (!input || input.trim().length < 2) return null;

    try {
        const response = await fetch('/api/gemini/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: input.trim().slice(0, 100) }] }], // Cap input length
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                generationConfig: {
                    response_mime_type: "application/json",
                    response_schema: {
                        type: "ARRAY",
                        items: {
                            type: "STRING"
                        }
                    },
                    max_output_tokens: 2048,
                    temperature: 0.3,
                    thinkingConfig: { thinkingBudget: 0 }
                }
            }),
            signal
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            console.warn("Gemini API Error:", response.status, errBody);
            return null;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) return null;

        try {
            const cleanedText = cleanJSON(text);
            if (!cleanedText) return null;
            const parsed = JSON.parse(cleanedText);
            if (!Array.isArray(parsed)) return null;

            // Convert ["Title|Artist|Query"] -> [{title, artist, query}]
            const uniqueResults = [];
            const seen = new Set();

            parsed.forEach(item => {
                if (typeof item !== 'string') return;
                const parts = item.split('|');
                const title = parts[0]?.trim();
                const artist = parts[1]?.trim() || "";

                if (!title) return;

                // Deduplicate based on Title + Artist
                const key = `${title.toLowerCase()}-${artist.toLowerCase()}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueResults.push({
                        title: title,
                        artist: artist,
                        query: parts[2]?.trim() || title
                    });
                }
            });

            return uniqueResults;
        } catch (parseError) {
            console.warn("Gemini JSON Parse Error (Suggestions):", parseError.message);
            console.debug("Raw Text:", text);
            // Don't throw to retry in loop wrapper if needed, or implement retry here?
            // The user wants "until success". Let's throw to trigger retry in wrapper.
            throw new Error("JSON_PARSE_ERROR");
        }
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        if (error.message === 'JSON_PARSE_ERROR') throw error; // Re-throw to caller to handle retry? 
        // Actually, let's handle retry internally here or in wrapper.
        console.warn("Gemini Request Failed:", error);
        return null;
    }
};

const getSmartSuggestions = async (input, signal, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
        try {
            const result = await fetchGeminiRaw(input, signal);
            if (result) return result;
        } catch (e) {
            if (e.name === 'AbortError') throw e;
            if (e.message === 'JSON_PARSE_ERROR' && i < retries) {
                console.warn(`Gemini JSON Error, Retrying (${i + 1}/${retries})...`);
                continue;
            }
            if (i === retries) console.warn("Gemini Suggestions Failed after retries:", e);
        }
    }
    return null;
};


const GUEST_NAME_PROMPT = `Bạn là trợ lý sửa lỗi chính tả và gợi ý tên người Việt.
Input: một chuỗi ký tự.
Output: JSON array gồm 5-8 cái tên người Việt hoàn chỉnh.
QUAN TRỌNG: CHỈ TRẢ VỀ JSON ARRAY.

Quy tắc:
1. Nếu input giống tên ca sĩ/người nổi tiếng (ví dụ: "my tam", "son tung"), ưu tiên trả về tên nghệ sĩ đó đầu tiên (ví dụ: "Mỹ Tâm", "Sơn Tùng M-TP").
2. Nếu input là tên thường (ví dụ: "tuan", "lan"), trả về các biến thể phổ biến (Tuấn, Tuân, Lan, Lân...).
3. Nếu input có prefix (ví dụ: "a tuan"), giữ nguyên prefix và sửa phần tên (Anh Tuấn, Anh Tuân).
4. Luôn viết hoa chữ cái đầu mỗi từ.

Output format: ["Tên 1", "Tên 2", "Tên 3"]`;

export const getGuestNameSuggestions = async (input, signal) => {
    if (!input || input.trim().length < 2) return [];

    try {
        const response = await fetch('/api/gemini/guest-names', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: input.trim() }] }],
                systemInstruction: { parts: [{ text: GUEST_NAME_PROMPT }] },
                generationConfig: {
                    response_mime_type: "application/json",
                    max_output_tokens: 1000,
                    temperature: 0.4,
                    thinkingConfig: { thinkingBudget: 0 }
                }
            }),
            signal
        });

        if (!response.ok) return [];

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) return [];

        try {
            const cleanedText = cleanJSON(text);
            if (!cleanedText) return [];
            const result = JSON.parse(cleanedText);
            return Array.isArray(result) ? result : [];
        } catch (e) {
            console.warn("Gemini JSON Parse Error (Guest Names):", e.message);
            return [];
        }
    } catch (error) {
        if (error.name !== 'AbortError') console.warn("Gemini Name Suggestion Failed:", error);
        return [];
    }
};

const CLEAN_TITLE_PROMPT = `Extract ONLY the Song Title.
Input: raw youtube title.
Output: JSON { "title": "Song Name", "artist": "Artist Name" }
Rules:
1. EXCLUDE Artist Name from Title.
2. If format is "Artist - Title" or "Artist | Title", extract Title correctly.
3. Remove 'karaoke', 'remix', 'beat', 'cover', 'mv', 'official', 'lyrics', '[...]', '(...)' tags.
4. Remove 'tone', 'hạ tone', 'nâng tone', 'dễ hát', 'tone nam', 'tone nữ', 'hạ beat', 'gốc'.
5. Remove clickbait/SEO phrases: 'hay nhất', 'dễ hát nhất', 'hit nhất', 'mới nhất', 'top trending', 'triệu view', 'cực hay', 'siêu hay', 'cực phẩm', 'hot nhất', 'buồn nhất', 'tuyệt đỉnh', etc. These are NOT part of the song title.
6. Capitalize correctly.`;

export const cleanSongTitle = async (rawTitle) => {
    if (!rawTitle) return null;

    try {
        const response = await fetch('/api/gemini/clean-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: rawTitle.slice(0, 150) }] }],
                systemInstruction: { parts: [{ text: CLEAN_TITLE_PROMPT }] },
                generationConfig: {
                    response_mime_type: "application/json",
                    max_output_tokens: 100,
                    temperature: 0.1,
                    thinkingConfig: { thinkingBudget: 0 }
                }
            })
        });

        if (!response.ok) return null;
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;

        try {
            const cleaned = cleanJSON(text);
            if (!cleaned) return null;
            return JSON.parse(cleaned);
        } catch (e) {
            console.warn("Gemini JSON Parse Error (Clean Title):", e.message);
            console.debug("Raw Text:", text);
            return null;
        }
    } catch (e) {
        console.warn("LLM Clean Title Request Failed:", e);
        return null;
    }
};

export { getSmartSuggestions as fetchGeminiSuggestions, getSmartSuggestions };
