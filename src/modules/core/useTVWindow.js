import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Hook to manage the TV popup window for guest viewing.
 * Opens /projection route in a new window that can be dragged to the TV.
 */
export const useTVWindow = () => {
    const [isTVOpen, setIsTVOpen] = useState(false);
    const tvWindowRef = useRef(null);

    const checkWindow = useCallback(() => {
        if (tvWindowRef.current && tvWindowRef.current.closed) {
            tvWindowRef.current = null;
            setIsTVOpen(false);
        }
    }, []);

    // Poll to detect if TV window was closed
    useEffect(() => {
        const interval = setInterval(checkWindow, 1000);
        return () => clearInterval(interval);
    }, [checkWindow]);

    const openTV = useCallback(() => {
        // If already open, focus it
        if (tvWindowRef.current && !tvWindowRef.current.closed) {
            tvWindowRef.current.focus();
            return;
        }

        // Open in a new window — user drags to TV + F11 for fullscreen
        const tvWindow = window.open(
            '/projection',
            'karaoke_tv',
            'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no'
        );

        if (tvWindow) {
            tvWindowRef.current = tvWindow;
            setIsTVOpen(true);
        }
    }, []);

    const closeTV = useCallback(() => {
        if (tvWindowRef.current && !tvWindowRef.current.closed) {
            tvWindowRef.current.close();
        }
        tvWindowRef.current = null;
        setIsTVOpen(false);
    }, []);

    return { isTVOpen, openTV, closeTV };
};
