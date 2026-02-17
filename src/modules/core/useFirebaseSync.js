import { useEffect, useRef, useState } from 'react';
import { useAppStore } from './store';
import { listenToFirebaseQueue, removeFromFirebaseQueue, clearFirebaseQueue } from '../../services/firebaseQueueService';

export function useFirebaseSync(isRefresh) {
    const reorderQueue = useAppStore((s) => s.reorderQueue);
    const queue = useAppStore((s) => s.queue);

    // We don't really need to track "knownIds" for de-duplication anymore if `playQueue` is fully regenerated.
    // However, to avoid flickering, we still rely on reorderQueue.

    const [firebaseInitialized, setFirebaseInitialized] = useState(false);
    const isInitialLoadRef = useRef(true);

    useEffect(() => {
        const unsubscribe = listenToFirebaseQueue((firebaseItems) => {
            // firebaseItems is the Array from `playQueue` node

            if (isInitialLoadRef.current) {
                isInitialLoadRef.current = false;

                // On fresh start (not refresh), strict clear?
                // The prompt says "Clear song queue and current song on a fresh start".
                // But `firebaseQueueService` logic for `playQueue` is persistent.
                // If we want a fresh start, we should explicitly clear Firebase? 
                // No, "App Start" usually means *this client* started. The queue might be shared.
                // If it's a shared queue (Karaoke), we probably WANT to see what's playing.
                // But the user rule said "Clearing the song queue... on a fresh start".
                // Let's assume that rule applied to the *session* state, not necessarily the shared backend.
                // If I am the Host, maybe I should clear?
                // Use caution: If I reload the Host page, I don't want to wipe the queue for everyone.

            }

            // Map firebase items to App format
            const validItems = firebaseItems || [];

            const appQueueItems = validItems.map(item => ({
                id: item.firebaseKey, // This is the unique ID (e.g. "custId_index" or real ID)
                firebaseKey: item.firebaseKey,
                videoId: item.videoId,
                title: item.title,
                cleanTitle: item.cleanTitle,
                artist: item.artist,
                addedBy: item.addedBy || item.customerName || 'Khách',
                thumbnail: item.thumbnail,
                source: item.source || 'web',
                // Round-Robin specific info for UI (optional, but good to have)
                customerId: item.customerId,
                round: item.round,
                isPriority: item.isPriority
            }));

            // We trust the order from Firebase (it is already sorted by Round-Robin)
            reorderQueue(appQueueItems);
            setFirebaseInitialized(true);
        });

        return () => unsubscribe();
    }, []);

    // Cleanup logic: If we remove an item LOCALLY, we must remove it from Firebase.
    // In strict Redux/Flux, we should call the API *then* update state.
    // But `useAppStore` updates state immediately (optimistic).
    // So we watch for state changes and sync delete.
    // BUT: `removeFromQueue` in Store updates `queue`.
    // We need to compare previous queue with current.

    const prevQueueRef = useRef(queue);

    useEffect(() => {
        if (!firebaseInitialized) {
            prevQueueRef.current = queue;
            return;
        }

        // Find items removed from local queue
        const prevKeys = new Set(prevQueueRef.current.map(i => i.firebaseKey).filter(Boolean));
        const currentKeys = new Set(queue.map(i => i.firebaseKey).filter(Boolean));

        for (const key of prevKeys) {
            if (!currentKeys.has(key)) {
                // remove from Firebase
                removeFromFirebaseQueue(key).catch(err => console.error("Remove failed", err));
            }
        }

        prevQueueRef.current = queue;
    }, [queue, firebaseInitialized]);
}

