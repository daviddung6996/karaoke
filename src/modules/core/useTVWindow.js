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

    const openTV = useCallback(async () => {
        // If already open, focus it
        if (tvWindowRef.current && !tvWindowRef.current.closed) {
            tvWindowRef.current.focus();
            return;
        }

        let features = 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no';
        let targetScreen = null;

        // Try Window Management API to find a secondary screen
        if ('getScreenDetails' in window) {
            try {
                const screenDetails = await window.getScreenDetails();
                const currentScreen = screenDetails.currentScreen;
                // Find any screen that is NOT the current one (the TV)
                targetScreen = screenDetails.screens.find(s => s !== currentScreen);

                if (targetScreen) {
                    // Use full width/height (not availWidth) to cover taskbar if possible
                    features = `popup,left=${targetScreen.left},top=${targetScreen.top},width=${targetScreen.width},height=${targetScreen.height}`;
                }
            } catch (e) {
                console.warn('Window Management API not available or denied:', e);
            }
        }

        // Open in a new window
        const tvWindow = window.open(
            '/projection',
            'karaoke_tv',
            features
        );

        if (tvWindow) {
            tvWindowRef.current = tvWindow;
            setIsTVOpen(true);

            // Only fullscreen + reposition if we found a SECONDARY screen
            if (targetScreen) {
                const tryFullscreen = () => {
                    console.log(`[TV] Targeting secondary screen: ${targetScreen.width}x${targetScreen.height} at (${targetScreen.left},${targetScreen.top})`);

                    // Strategy 1: requestFullscreen with { screen } option (Window Management API)
                    let fsSucceeded = false;
                    try {
                        // This API allows fullscreen on a SPECIFIC screen
                        tvWindow.document.documentElement.requestFullscreen({ screen: targetScreen })
                            .then(() => {
                                fsSucceeded = true;
                                console.log('[TV] Fullscreen on secondary screen OK (screen option)');
                            })
                            .catch(() => {
                                console.log('[TV] requestFullscreen({screen}) blocked — using position fallback');
                                forcePosition();
                            });
                    } catch {
                        forcePosition();
                    }

                    // Strategy 2 (fallback): Position + oversize to cover window chrome
                    function forcePosition() {
                        // Offset negative to hide title bar, oversize to cover decorations
                        tvWindow.moveTo(targetScreen.left, targetScreen.top - 30);
                        tvWindow.resizeTo(targetScreen.width, targetScreen.height + 60);

                        // Re-apply after a tick (some browsers defer moveTo)
                        setTimeout(() => {
                            tvWindow.moveTo(targetScreen.left, targetScreen.top - 30);
                            tvWindow.resizeTo(targetScreen.width, targetScreen.height + 60);
                        }, 500);
                    }
                };

                if (tvWindow.document.readyState === 'complete') {
                    tryFullscreen();
                } else {
                    tvWindow.addEventListener('load', tryFullscreen);
                }
            } else {
                console.log('[TV] No secondary screen detected — opened as popup on primary screen (no fullscreen)');
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
