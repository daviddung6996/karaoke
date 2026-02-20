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
        // Remove SEO keywords - Use whitespace boundaries instead of \b for Vietnamese support
        .replace(/(^|\s)(karaoke|beat|tone|tong|nam|nữ|nu|hạ tông|ha tong|gốc|goc|dễ hát|de hat|chuẩn|chuan|nhạc sống|nhac song|full hd|hd|4k|official|mv|lyric|lyrics|video|audio|remix|cover|live|lofi|lo-fi|ver|version|hay nhất|dễ hát nhất|hit nhất|mới nhất|top trending|triệu view|cực hay|siêu hay|cực phẩm|hot nhất|buồn nhất|tuyệt đỉnh|hay nhat|de hat nhat|hit nhat|moi nhat|cuc hay|sieu hay|cuc pham|hot nhat|buon nhat|tuyet dinh)(?=$|\s)/gi, '')
        .trim();

    // Remove leading/trailing separators left behind (e.g., " - Song Name")
    cleaned = cleaned.replace(/^[ \-–|]+|[ \-–|]+$/g, '').trim();

    // Split and take the first non-empty part
    const parts = cleaned.split(/[-–|]/).map(p => p.trim()).filter(p => p.length > 0);

    return parts[0] || '';
}
