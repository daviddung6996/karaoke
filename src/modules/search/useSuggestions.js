import { useState, useRef, useCallback, useEffect } from 'react';
import { getSmartSuggestions } from '../../services/smartSuggestionService';

export const useSuggestions = (query, isFocused) => {
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const abortControllerRef = useRef(null);
    const debounceTimeoutRef = useRef(null);
    const lastFetchedQuery = useRef(null);

    const fetchLogic = useCallback(async (input) => {
        if (!input || input.trim().length < 2) {
            setSuggestions([]);
            setIsLoading(false);
            return;
        }

        const normalizedQuery = input.trim();
        setIsLoading(true);

        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
            const handleAIResults = (aiResults) => {
                if (!signal.aborted) {
                    setSuggestions(prev => [...prev, ...aiResults]);
                    setIsLoading(false);
                }
            };

            const localResults = await getSmartSuggestions(normalizedQuery, signal, handleAIResults);

            if (!signal.aborted) {
                setSuggestions(localResults);
                lastFetchedQuery.current = normalizedQuery;
                if (localResults.length >= 2) {
                    setIsLoading(false);
                }
            }
        } catch (e) {
            if (e.name !== 'AbortError') console.warn("Suggestion chain failed", e);
            if (!signal.aborted) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

        debounceTimeoutRef.current = setTimeout(() => {
            fetchLogic(query);
        }, 50);

        return () => {
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [query, fetchLogic]);

    // Re-fetch when user focuses back on input with same query
    useEffect(() => {
        if (isFocused && query && query.trim().length >= 2 && suggestions.length === 0) {
            fetchLogic(query);
        }
    }, [isFocused, query, suggestions.length, fetchLogic]);

    return { suggestions, isLoading };
};
