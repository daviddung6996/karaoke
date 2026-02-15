
import { songsDb } from '../data/songsDb';

// Helper: Xóa dấu tiếng Việt
function removeAccents(str) {
    if (!str) return "";
    return str.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase();
}

// Build Index (chạy 1 lần khi app load)
// Structure: [ { title, artist, searchStr, raw } ]
const searchIndex = songsDb.map(item => {
    const [title, artist] = item;
    return {
        title,
        artist,
        // Chuỗi tìm kiếm: "tieu de ca si" (không dấu)
        searchStr: removeAccents(`${title} ${artist}`),
        // Raw để hiển thị
        raw: item
    };
});

/**
 * Tìm kiếm local (< 20ms)
 * @param {string} query 
 * @returns {Array} Top 5 kết quả
 */
export const search = (query) => {
    if (!query || query.length < 2) return [];

    const normalizedQuery = removeAccents(query.trim());
    const matches = [];

    for (let i = 0; i < searchIndex.length; i++) {
        const song = searchIndex[i];

        // Match logic:
        // 1. Exact phrase match in title or artist
        if (song.searchStr.includes(normalizedQuery)) {
            matches.push({
                title: song.title,
                artist: song.artist,
                query: `${song.title} ${song.artist}`,
                source: 'local',
                score: 1 // Basic score
            });
        }

        // Limit to 10 to keep it fast
        if (matches.length >= 10) break;
    }

    return matches;
};
