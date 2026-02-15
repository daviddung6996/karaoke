
import { search } from './searchEngine';
import { getSmartSuggestions as fetchGemini } from '../modules/core/geminiService'; // Re-use existing service logic but wrapper here

// --- History & Analytics ---
const HISTORY_KEY = 'karaoke_history';
const YOUTUBE_CACHE_KEY = 'youtube_id_cache';

export const recordPlay = (title, artist) => {
    try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        // Remove duplicate if exists
        const newHistory = history.filter(h => h.title !== title);
        // Add to top
        newHistory.unshift({ title, artist, timestamp: Date.now() });
        // Keep last 50
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory.slice(0, 50)));
    } catch (e) {
        console.error("Record play failed", e);
    }
};

export const cacheYoutubeId = (title, artist, videoId) => {
    try {
        const cache = JSON.parse(localStorage.getItem(YOUTUBE_CACHE_KEY) || '{}');
        const key = `${title}-${artist}`;
        cache[key] = videoId;
        localStorage.setItem(YOUTUBE_CACHE_KEY, JSON.stringify(cache));
    } catch (e) { }
};

// --- Hybrid Search ---

/**
 * Hybrid Search: Local (Instant) + LLM (Async)
 * @param {string} input User query
 * @param {AbortSignal} signal Abort signal
 * @param {function} onLLMResults Callback when LLM results arrive
 * @returns {Array} Initial local results
 */
const suggestionCache = new Map();

/**
 * Hybrid Search: Local (Instant) + LLM (Async)
 * @param {string} input User query
 * @param {AbortSignal} signal Abort signal
 * @param {function} onLLMResults Callback when LLM results arrive
 * @returns {Array} Initial local results
 */
export const getSmartSuggestions = async (input, signal, onLLMResults) => {
    if (!input || input.trim().length < 2) return [];

    const trimmedInput = input.trim();

    // 1. Local Search (Instant)
    const localResults = search(trimmedInput);

    // 2. Check Cache for LLM
    if (suggestionCache.has(trimmedInput)) {
        const cached = suggestionCache.get(trimmedInput);
        if (onLLMResults) {
            // Return cached results immediately (next tick to allow local results to render first if needed)
            setTimeout(() => onLLMResults(cached), 0);
        }
        return localResults;
    }

    // 3. Fetch LLM in background if not cached
    // Don't await here, just trigger it
    fetchGemini(input, signal).then(llmSuggestions => {
        if (signal.aborted) return;

        if (llmSuggestions && Array.isArray(llmSuggestions) && llmSuggestions.length > 0) {
            // Mark source as AI
            const aiResults = llmSuggestions.map(item => ({
                ...item,
                source: 'ai'
            }));

            // Save to Cache
            suggestionCache.set(trimmedInput, aiResults);

            // Invoke callback to update UI
            if (onLLMResults) {
                onLLMResults(aiResults);
            }
        }
    }).catch(err => {
        // Ignore abort errors usually
    });

    return localResults;
};
