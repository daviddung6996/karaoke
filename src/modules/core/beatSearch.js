// src/modules/core/beatSearch.js
// Search for beat/karaoke variants of a song

const beatCache = new Map();

export async function searchBeatVariants(songTitle, artist, originalVideoId) {
    if (!songTitle) return [];

    const cacheKey = `${songTitle}|${artist || ''}|${originalVideoId || ''}`;
    if (beatCache.has(cacheKey)) return beatCache.get(cacheKey);

    // Clean song title for search (remove existing karaoke/beat keywords)
    const cleanTitle = songTitle
        .replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '')
        .replace(/karaoke/gi, '').replace(/beat/gi, '')
        .replace(/instrumental/gi, '').replace(/tone\s*(nam|nữ|nu)/gi, '')
        .replace(/nhạc sống/gi, '').replace(/phối mới/gi, '')
        .replace(/official.*video/gi, '').replace(/mv/gi, '')
        .replace(/lyrics?/gi, '').replace(/hd|4k/gi, '')
        .replace(/\|/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

    const baseName = cleanTitle || songTitle;

    // Multiple query patterns to find different beat versions
    const queries = [
        `${baseName} ${artist || ''} karaoke beat`.trim(),
        `${baseName} karaoke tone nữ`,
        `${baseName} karaoke tone nam`,
        `${baseName} karaoke phối mới`,
    ];

    const allResults = [];
    const seenIds = new Set();

    // Search all queries in parallel
    const searchPromises = queries.map(async (q) => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const res = await fetch(
                `/api/yt/search?q=${encodeURIComponent(q)}`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            if (!res.ok) return [];
            return await res.json();
        } catch {
            return [];
        }
    });

    const results = await Promise.all(searchPromises);

    for (const items of results) {
        for (const item of items) {
            const id = item.id || item.videoId;
            if (!id || seenIds.has(id)) continue;
            seenIds.add(id);

            const title = (item.title || '').toLowerCase();
            // Must be karaoke/beat related
            const isKaraoke = ['karaoke', 'beat', 'instrumental', 'nhạc sống', 'phối'].some(k => title.includes(k));
            if (!isKaraoke) continue;

            // Detect beat type label
            let beatLabel = 'Beat gốc';
            if (title.includes('tone nữ') || title.includes('tone nu')) beatLabel = 'Beat tone nữ';
            else if (title.includes('tone nam')) beatLabel = 'Beat tone nam';
            else if (title.includes('phối mới') || title.includes('phoi moi')) beatLabel = 'Beat phối mới';
            else if (title.includes('nhạc sống')) beatLabel = 'Nhạc sống';
            else if (title.includes('song ca')) beatLabel = 'Song ca';

            allResults.push({
                videoId: id,
                title: item.title,
                cleanTitle: item.cleanTitle || item.title,
                thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                artist: item.artist || '',
                viewCount: item.viewCount || 0,
                views: item.views || '0',
                duration: item.duration || '',
                beatLabel,
                tags: item.tags || [],
            });
        }
    }

    // Sort by view count (most popular first)
    allResults.sort((a, b) => b.viewCount - a.viewCount);

    // Pin the original track at position 0, rest sorted by views
    if (originalVideoId) {
        const originalIdx = allResults.findIndex(r => r.videoId === originalVideoId);
        if (originalIdx > 0) {
            const [original] = allResults.splice(originalIdx, 1);
            allResults.unshift(original);
        }
    }

    // Limit to top 5
    const finalResults = allResults.slice(0, 5);

    beatCache.set(cacheKey, finalResults);
    return finalResults;
}
