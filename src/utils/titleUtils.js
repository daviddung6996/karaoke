/**
 * Cleans YouTube titles for TTS (Text-to-Speech)
 * Removes tags like [KARAOKE], (Official), keywords, and redundant artist names.
 * 
 * @param {string} raw - Raw YouTube title
 * @returns {string} - Cleaned title (Song Name only)
 */
export function cleanYoutubeTitle(raw) {
    if (!raw) return '';
    let cleaned = raw
        // Remove brackets: [KARAOKE], [MV], [OFFICIAL]...
        .replace(/\[.*?\]/g, '')
        // Remove parentheses: (Official MV), (Lyric Video)...
        .replace(/\(.*?\)/g, '')
        // Remove SEO keywords
        .replace(/\b(karaoke|beat|tone|tong|nam|nữ|nu|hạ tông|ha tong|gốc|goc|dễ hát|de hat|chuẩn|chuan|nhạc sống|nhac song|full hd|hd|4k|official|mv|lyric|lyrics|video|audio|remix|cover|live|lofi|lo-fi|ver|version)\b/gi, '')
        .trim();

    // Remove leading/trailing separators left behind (e.g., " - Song Name")
    cleaned = cleaned.replace(/^[ \-–|]+|[ \-–|]+$/g, '').trim();

    // Split and take the first non-empty part
    const parts = cleaned.split(/[-–|]/).map(p => p.trim()).filter(p => p.length > 0);

    return parts[0] || '';
}
