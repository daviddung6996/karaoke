
// src/modules/core/videoSearch.js

export async function searchVideos(query) {
    if (!query) return [];

    const searchQuery = query.toLowerCase().includes('karaoke') ? query : `${query} karaoke`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for "real" YouTube

        const res = await fetch(
            `/api/yt/search?q=${encodeURIComponent(searchQuery)}`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(res.status);

        // The middleware already normalizes the data
        const items = await res.json();

        const validKeywords = ['karaoke', 'beat', 'instrumental', 'nhạc sống', 'tone', 'phối'];

        return items
            .filter(item => {
                const title = item.title.toLowerCase();
                // Must contain at least one karaoke keyword
                return validKeywords.some(keyword => title.includes(keyword));
            })
            .map(item => {
                // Calculate score: Base on ViewCount (Quality) * Relevance (Context)
                // Use existing server score if available as baseline, or viewCount
                let baseScore = item.viewCount || 0;
                let multiplier = 1.0;

                const title = item.title.toLowerCase();
                const q = query.toLowerCase();
                const qWords = q.split(/\s+/).filter(w => w.length > 0);

                // 1. Exact Phrase Match (Highest Priority)
                if (title.includes(q)) multiplier *= 2.0;

                // 2. Tone Match (Critical for singers)
                if (q.includes('tone nam') && title.includes('tone nam')) multiplier *= 3.0;
                if (q.includes('tone nữ') && title.includes('tone nữ')) multiplier *= 3.0;
                if (q.includes('tone nu') && title.includes('tone nữ')) multiplier *= 3.0;

                // 3. Keyword Bonus (Karaoke/Beat)
                if (title.includes('karaoke')) multiplier *= 1.2;
                if (title.includes('beat') || title.includes('instrumental')) multiplier *= 1.1;

                // 4. Word Context
                let wordMatches = 0;
                qWords.forEach(word => {
                    if (title.includes(word)) wordMatches++;
                });
                // Small boost for matching words: 10% per word
                multiplier += (wordMatches * 0.1);

                // 5. All Words Present
                if (wordMatches === qWords.length) multiplier *= 1.5;

                // 6. Penalties
                const negatives = ['live', 'concert', 'fancam', 'cover', 'remix'];
                negatives.forEach(neg => {
                    // Only penalize if user DIDN'T search for it
                    if (title.includes(neg) && !q.includes(neg)) {
                        multiplier *= 0.5;
                    }
                });

                if ((title.includes('official') || title.includes('mv')) && !title.includes('karaoke')) {
                    multiplier *= 0.5;
                }

                // Final Score
                let score = baseScore * multiplier;

                // Edge case: If 0 views but relevant, give it a fighting chance (e.g. 1000 pts)
                if (score === 0 && wordMatches > 0) score = 1000 * multiplier;

                return { ...item, score };
            })
            .sort((a, b) => b.score - a.score) // Sort by Descending Score
            .map(item => ({
                ...item,
                videoId: item.id, // Ensure compatibility
                isApi: true
            }));

    } catch (e) {
        console.error("YouTube Search Failed:", e);
        return [];
    }
}
