
export async function getYouTubeSuggestions(query) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const res = await fetch(
            `/api/suggest?client=youtube&ds=yt&hl=vi&gl=vn&q=${encodeURIComponent(query)}`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        const text = await res.text();
        // Google Suggest returns: window.google.ac.h(["query",[["suggestion 1",0],...]])
        // Or just JSON like: ["query",["suggestion 1",...]]
        // The previous regex `match(/\((.+)\)/)` expects JSONP style. 
        // Let's try to parse flexibly.

        // If it's JSONP-like (wrapped in parens)
        const match = text.match(/\((.+)\)/);
        let data;
        if (match) {
            data = JSON.parse(match[1]);
        } else {
            // Try direct JSON
            try {
                data = JSON.parse(text);
            } catch (e) {
                return [];
            }
        }

        if (Array.isArray(data) && data[1]) {
            return data[1].map((item) => {
                const str = Array.isArray(item) ? item[0] : item; // depends on format
                return {
                    title: str,
                    artist: '',
                    query: str // Keep it simple or append karaoke? Let's rely on user
                };
            });
        }
        return [];
    } catch (e) {
        console.warn("Fallback suggest failed", e);
        return [];
    }
}
