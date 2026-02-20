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
                isPriority: item.isPriority,
                status: item.status || (item.videoId ? 'ready' : 'waiting'),
                wasSkipped: item.wasSkipped || false,
            }));

            // If user has manually reordered, preserve their arrangement
            const { manualOrder } = useAppStore.getState();
            if (manualOrder && manualOrder.length > 0) {
                const itemMap = new Map(appQueueItems.map(item => [item.id, item]));

                // Rebuild queue: manual-ordered items first (skip removed ones)
                const ordered = [];
                const placed = new Set();
                for (const id of manualOrder) {
                    const item = itemMap.get(id);
                    if (item) {
                        ordered.push(item);
                        placed.add(id);
                    }
                }
                // New items from Firebase: priority → top, normal → bottom
                const newPriority = [];
                const newNormal = [];
                for (const item of appQueueItems) {
                    if (!placed.has(item.id)) {
                        if (item.isPriority) newPriority.push(item);
                        else newNormal.push(item);
                    }
                }
                ordered.unshift(...newPriority);
                ordered.push(...newNormal);

                reorderQueue(ordered);
            } else {
                reorderQueue(appQueueItems);
            }

            setFirebaseInitialized(true);
        });

        return () => unsubscribe();
    }, []);

    return { firebaseInitialized };
}

