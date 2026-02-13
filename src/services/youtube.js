const SEARCH_PATTERNS = [
    (title, artist) => `${title} ${artist} karaoke beat`,
    (title, artist) => `${title} ${artist} karaoke`,
    (title) => `${title} karaoke`,
];

export async function searchYouTube(title, artist = '') {
    for (const pattern of SEARCH_PATTERNS) {
        const query = pattern(title, artist);
        const videoId = await searchViaProxy(query);
        if (videoId) return videoId;
    }
    return null;
}

export async function searchYouTubeList(query) {
    try {
        const response = await fetch(`/api/yt-search?search_query=${encodeURIComponent(query + ' karaoke')}`);
        if (!response.ok) {
            console.error('[YT] Proxy response not ok:', response.status);
            return [];
        }

        const html = await response.text();
        console.log('[YT] Got HTML response, length:', html.length);

        // Find the ytInitialData JSON blob in the YouTube HTML
        const dataMatch = html.match(/var ytInitialData = (.+?);<\/script>/s);
        if (!dataMatch) {
            console.warn('[YT] Could not find ytInitialData');
            // Fallback: just extract video IDs
            return extractVideoIds(html);
        }

        try {
            const data = JSON.parse(dataMatch[1]);
            const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
                ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

            const results = [];
            for (const item of contents) {
                const video = item.videoRenderer;
                if (!video) continue;

                results.push({
                    videoId: video.videoId,
                    title: video.title?.runs?.map(r => r.text).join('') || 'Untitled',
                    thumbnail: video.thumbnail?.thumbnails?.[0]?.url || null,
                });

                if (results.length >= 5) break;
            }

            console.log('[YT] Parsed results:', results.length);
            return results;
        } catch (parseErr) {
            console.error('[YT] JSON parse failed:', parseErr);
            return extractVideoIds(html);
        }
    } catch (err) {
        console.error('[YT] Search list failed:', err);
        return [];
    }
}

function extractVideoIds(html) {
    const matches = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g);
    if (!matches) return [];

    const seen = new Set();
    const results = [];
    for (const m of matches) {
        const id = m.match(/"videoId":"([^"]+)"/)?.[1];
        if (!id || seen.has(id)) continue;
        seen.add(id);
        results.push({ videoId: id, title: `Video ${results.length + 1}` });
        if (results.length >= 5) break;
    }
    return results;
}

async function searchViaProxy(query) {
    try {
        const response = await fetch(`/api/yt-search?search_query=${encodeURIComponent(query)}`);
        if (!response.ok) return null;

        const html = await response.text();
        const matches = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g);
        if (!matches) return null;

        const ids = [...new Set(matches.map(m => m.match(/"videoId":"([^"]+)"/)[1]))];
        return ids[0] || null;
    } catch {
        return null;
    }
}

export function getYouTubeSearchUrl(title, artist = '') {
    const query = `${title} ${artist} karaoke beat`;
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function getVideoIdFromUrl(url) {
    if (!url) return null;
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
}

export async function getVideoDetails(videoId) {
    try {
        // Use NoEmbed to get title without API key
        const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        if (!response.ok) return null;
        const data = await response.json();
        return {
            title: data.title || 'Unknown Video',
            author: data.author_name || 'Unknown Channel'
        };
    } catch (e) {
        console.warn('[YT] Failed to get video details:', e);
        return { title: 'Unknown Video', author: '' };
    }
}
