import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to handle native browser Fullscreen API
 * @returns {Object} { isFullscreen, toggleFullscreen, enterFullscreen, exitFullscreen }
 */
export const useFullscreen = () => {
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Helper to get the correct method name handling vendor prefixes
    const getFullscreenElement = () => {
        return document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement;
    };

    const updateFullscreenState = useCallback(() => {
        setIsFullscreen(!!getFullscreenElement());
    }, []);

    useEffect(() => {
        // Standard and vendor-prefixed event listeners
        const events = [
            'fullscreenchange',
            'webkitfullscreenchange',
            'mozfullscreenchange',
            'MSFullscreenChange'
        ];

        events.forEach(event => {
            document.addEventListener(event, updateFullscreenState);
        });

        // Check initial state
        updateFullscreenState();

        return () => {
            events.forEach(event => {
                document.removeEventListener(event, updateFullscreenState);
            });
        };
    }, [updateFullscreenState]);

    const enterFullscreen = useCallback(async () => {
        const docEl = document.documentElement;
        try {
            if (docEl.requestFullscreen) {
                await docEl.requestFullscreen();
            } else if (docEl.webkitRequestFullscreen) {
                await docEl.webkitRequestFullscreen();
            } else if (docEl.msRequestFullscreen) {
                await docEl.msRequestFullscreen();
            }
        } catch (err) {
            console.error('Error attempting to enable fullscreen:', err);
        }
    }, []);

    const exitFullscreen = useCallback(async () => {
        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                await document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                await document.msExitFullscreen();
            }
        } catch (err) {
            console.error('Error attempting to exit fullscreen:', err);
        }
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (getFullscreenElement()) {
            exitFullscreen();
        } else {
            enterFullscreen();
        }
    }, [enterFullscreen, exitFullscreen]);

    return { isFullscreen, toggleFullscreen, enterFullscreen, exitFullscreen };
};
