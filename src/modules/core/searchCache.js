
const CACHE_KEY_PREFIX = 'karaoke_search_cache_';
const MAX_CACHE_SIZE = 50; // Limit keys to avoid filling storage

export const getCachedSuggestions = (query) => {
    try {
        const normalizedQuery = query.trim().toLowerCase();
        const item = sessionStorage.getItem(CACHE_KEY_PREFIX + normalizedQuery);
        if (item) {
            return JSON.parse(item);
        }
    } catch (e) {
        console.warn("Cache read error", e);
    }
    return null;
};

export const cacheSuggestions = (query, suggestions) => {
    try {
        const normalizedQuery = query.trim().toLowerCase();
        sessionStorage.setItem(CACHE_KEY_PREFIX + normalizedQuery, JSON.stringify(suggestions));

        // rudimentary cleanup (optional, omitted for simplicity unless user needs it)
    } catch (e) {
        console.warn("Cache write error", e);
    }
};
