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
        const interval = setInterval(checkWindow, 3000);
        return () => clearInterval(interval);
    }, [checkWindow]);

    const openTV = useCallback(async () => {
        // If already open, focus it
        if (tvWindowRef.current && !tvWindowRef.current.closed) {
            tvWindowRef.current.focus();
            return;
        }

        let left = 0;
        let top = 0;
        let width = window.screen.width;
        let height = window.screen.height;
        let targetScreen = null;

        // Try Window Management API to find a secondary screen
        if ('getScreenDetails' in window) {
            try {
                const screenDetails = await window.getScreenDetails();
                // Find any screen that is NOT the current one (the TV)
                targetScreen = screenDetails.screens.find(s => s !== screenDetails.currentScreen);

                if (targetScreen) {
                    left = targetScreen.left;
                    top = targetScreen.top;
                    width = targetScreen.width;
                    height = targetScreen.height;
                }
            } catch {
                // Window Management API denied
            }
        }

        // Add fullscreen=yes hint for some browsers
        const features = `popup,left=${left},top=${top},width=${width},height=${height},fullscreen=yes`;

        const tvWindow = window.open(
            '/projection',
            'karaoke_tv',
            features
        );

        if (tvWindow) {
            tvWindowRef.current = tvWindow;
            setIsTVOpen(true);

            // Store target screen for manual toggle
            if (targetScreen) {
                tvWindow.__targetScreen = targetScreen;
            }
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
