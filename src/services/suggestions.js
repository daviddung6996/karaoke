
export async function getSuggestions(query) {
    if (!query || query.trim().length < 2) return [];

    try {
        // Fetch from Google Suggest API via our proxy
        // client=youtube returns JSON usually: ["query", ["sugg1", "sugg2", ...], ...]
        const response = await fetch(`/api/yt-suggest?client=youtube&ds=yt&q=${encodeURIComponent(query)}`);

        if (!response.ok) return [];

        const text = await response.text();
        let suggestions = [];

        // Try standard JSON.parse first
        try {
            // Sometimes it's pure JSON
            const data = JSON.parse(text);
            if (Array.isArray(data) && Array.isArray(data[1])) {
                // data[1] is array of suggestions: [["suggestion", 0, [type]], ...]
                // Or just strings: ["suggestion", ...]
                suggestions = data[1].map(item => Array.isArray(item) ? item[0] : item);
            }
        } catch (e) {
            // It might be JSONP: window.google.ac.h(["query",[...]])
            // Extract the array content
            const match = text.match(/window\.google\.ac\.h\((.*)\)/);
            if (match && match[1]) {
                try {
                    const data = JSON.parse(match[1]);
                    if (Array.isArray(data) && Array.isArray(data[1])) {
                        suggestions = data[1].map(item => Array.isArray(item) ? item[0] : item);
                    }
                } catch (e2) { /* ignore */ }
            }
        }

        // --- ENHANCEMENT LOGIC ---
        // Older people need clarity and variety

        const cleanQuery = query.toLowerCase().trim();
        // Use a Set to ensure uniqueness, but convert back to Array for returning
        const enhancedSet = new Set();
        const baseSuggestions = suggestions.slice(0, 5); // Take top 5 from YouTube

        // Helper to add if unique
        const add = (s) => enhancedSet.add(s);

        // 1. YouTube's own suggestions first (they are most relevant)
        baseSuggestions.forEach(s => add(s));

        // 2. "Karaoke" Context
        // If query doesn't have "karaoke", add variations
        if (!cleanQuery.includes('karaoke')) {
            add(`${query} karaoke`);
            // Add specific karaoke variations
            add(`${query} karaoke tone nam`);
            add(`${query} karaoke tone nữ`);
            add(`${query} karaoke song ca`);
        } else {
            // Already has karaoke, expand on tones
            if (!cleanQuery.includes('tone')) {
                add(`${query} tone nam`);
                add(`${query} tone nữ`);
            }
        }

        // 3. Music Style Variations
        if (!cleanQuery.includes('remix')) add(`${query} remix`);
        if (!cleanQuery.includes('bolero') && !cleanQuery.includes('nhạc sống')) add(`${query} nhạc sống`);
        if (!cleanQuery.includes('liên khúc')) add(`Liên khúc ${query}`);

        // 4. "Lời bài hát" for those who search by lyrics
        if (!cleanQuery.includes('lời')) add(`Lời bài hát ${query}`);

        // Convert Set to Array
        return Array.from(enhancedSet);
    } catch (err) {
        console.error('Suggestion fetch error:', err);
        return [];
    }
}
