import { useEffect, useRef, useState } from 'react';
import { useAppStore } from './store';
import { listenToFirebaseQueue } from '../../services/firebaseQueueService';

/**
 * Firebase is the SINGLE SOURCE OF TRUTH for the queue.
 * This hook ONLY reads from Firebase and updates the local store.
 * It NEVER writes back to Firebase based on local state changes.
 * 
 * All Firebase writes (add/remove/clear) must happen via explicit user actions
 * (e.g., removeFromFirebaseQueue called directly in event handlers).
 */
export function useFirebaseSync(isRefresh) {
    const reorderQueue = useAppStore((s) => s.reorderQueue);

    const [firebaseInitialized, setFirebaseInitialized] = useState(false);
    const isInitialLoadRef = useRef(true);

    useEffect(() => {
        const unsubscribe = listenToFirebaseQueue((firebaseItems) => {
            if (isInitialLoadRef.current) {
                isInitialLoadRef.current = false;
            }

            const validItems = firebaseItems || [];

            const appQueueItems = validItems.map(item => ({
                id: item.firebaseKey,
                firebaseKey: item.firebaseKey,
                videoId: item.videoId,
                title: item.title,
                cleanTitle: item.cleanTitle,
                artist: item.artist,
                addedBy: item.addedBy || item.customerName || 'Khách',
                thumbnail: item.thumbnail,
                source: item.source || 'web',
                customerId: item.customerId,
                round: item.round,
                isPriority: item.isPriority
            }));

            reorderQueue(appQueueItems);
            setFirebaseInitialized(true);
        });

        return () => unsubscribe();
    }, []);

    return { firebaseInitialized };
}

