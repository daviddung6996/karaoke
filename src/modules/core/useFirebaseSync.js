import { useEffect, useRef, useState } from 'react';
import { useAppStore } from './store';
import { listenToFirebaseQueue, removeFromFirebaseQueue, clearFirebaseQueue, pushToFirebaseQueue } from '../../services/firebaseQueueService';

export function useFirebaseSync(isRefresh) {
    const addToQueue = useAppStore((s) => s.addToQueue);
    const insertToQueue = useAppStore((s) => s.insertToQueue);
    const reorderQueue = useAppStore((s) => s.reorderQueue);
    const queue = useAppStore((s) => s.queue);
    const knownIdsRef = useRef(new Set());
    const isInitialLoadRef = useRef(true);
    const [firebaseInitialized, setFirebaseInitialized] = useState(false);

    // NOTE: isRefresh is passed from parent to ensure consistency

    useEffect(() => {
        // Populate known IDs from existing local queue (only on mount)
        if (queue.length > 0) {
            queue.forEach((item) => {
                if (item.firebaseKey) knownIdsRef.current.add(item.firebaseKey);
            });
        }
    }, []); // Only once on mount

    useEffect(() => {
        const unsubscribe = listenToFirebaseQueue((firebaseItems) => {
            // On initial load
            if (isInitialLoadRef.current) {
                isInitialLoadRef.current = false;

                // Fresh session: clear old queue from Firebase, don't restore
                if (!isRefresh) {
                    console.log('[FirebaseSync] Fresh session — clearing old Firebase queue', { isRefresh });
                    clearFirebaseQueue().catch(() => { });
                    // Mark all existing items as known so they won't be re-added
                    firebaseItems.forEach((item) => {
                        if (item && item.id) knownIdsRef.current.add(item.id);
                    });
                    setFirebaseInitialized(true);
                    return;
                }

                // F5 refresh: restore queue from Firebase (in correct order)
                console.log('[FirebaseSync] F5 refresh — restoring queue from Firebase', { isRefresh, firebaseItemsCount: firebaseItems.length });

                // Filter valid items only & rebuild from Firebase (maintain order)
                const validItems = firebaseItems.filter(item => item && item.videoId && item.title);

                // CRITICAL FIX: If Firebase is empty but we have local items (restored from SessionStorage),
                // DO NOT wipe the queue. Instead, push local items to Firebase to sync them up.
                if (validItems.length === 0) {
                    const localQueue = useAppStore.getState().queue;
                    if (localQueue.length > 0) {
                        console.log('[FirebaseSync] Firebase empty, but found local items (session restored). Syncing local -> Firebase.');

                        // Trigger background sync (fire & forget)
                        // The listener will pick up the new items and update the queue naturally
                        localQueue.forEach(async (item) => {
                            try {
                                await pushToFirebaseQueue({
                                    ...item,
                                    firebaseKey: null, // Force new key
                                    id: null
                                });
                            } catch (err) {
                                console.error('[FirebaseSync] Failed to re-sync item:', item.title, err);
                            }
                        });

                        setFirebaseInitialized(true);
                        return; // Skip reorderQueue to preserve local items until sync comes back
                    }
                }

                console.log('[FirebaseSync] Valid items to restore:', validItems.length, 'of', firebaseItems.length);
                console.log('[FirebaseSync] Items with timestamps:', validItems.map((v) => ({ title: v.title, addedAt: v.addedAt, addedBy: v.addedBy })));

                // Convert all items to queue format
                const restoredItems = validItems.map((item) => ({
                    id: item.id,
                    firebaseKey: item.id,
                    videoId: item.videoId,
                    title: item.title,
                    cleanTitle: item.cleanTitle || item.title,
                    artist: item.artist || '',
                    addedBy: item.addedBy || 'Khách',
                    thumbnail: item.thumbnail || '',
                    source: item.source || 'web',
                    priorityOrder: item.priorityOrder || 0,
                }));

                // Add all to knownIds
                validItems.forEach((item) => knownIdsRef.current.add(item.id));

                // Rebuild entire queue at once using reorderQueue (faster & preserves order)
                console.log('[FirebaseSync] Rebuilding queue with', restoredItems.length, 'items');
                reorderQueue(restoredItems);
                setFirebaseInitialized(true);
                return;
            }

            // Subsequent updates: only add NEW items, but rebuild entire queue to maintain Firebase sort order
            const newItems = [];
            firebaseItems.forEach((item) => {
                // Validate item integrity before adding
                if (!item.videoId || !item.title) {
                    console.warn('[FirebaseSync] Ignored invalid item from Firebase:', item);
                    return;
                }

                if (!knownIdsRef.current.has(item.id)) {
                    console.log('[FirebaseSync] NEW item from Firebase:', item.title, `(addedAt=${item.addedAt}, addedBy=${item.addedBy})`);
                    knownIdsRef.current.add(item.id);
                    newItems.push({
                        id: item.id,
                        firebaseKey: item.id,
                        videoId: item.videoId,
                        title: item.title,
                        cleanTitle: item.cleanTitle,
                        artist: item.artist,
                        addedBy: item.addedBy,
                        thumbnail: item.thumbnail,
                        source: item.source || 'web',
                        priorityOrder: item.priorityOrder || 0,
                    });
                }
            });

            // If there are new items, rebuild entire queue from Firebase to maintain sort order
            if (newItems.length > 0) {
                console.log('[FirebaseSync] Rebuilding queue with', newItems.length, 'new items');
                const updatedItems = firebaseItems
                    .filter(item => item && item.videoId && item.title)
                    .map((item) => ({
                        id: item.id,
                        firebaseKey: item.id,
                        videoId: item.videoId,
                        title: item.title,
                        cleanTitle: item.cleanTitle,
                        artist: item.artist,
                        addedBy: item.addedBy,
                        thumbnail: item.thumbnail,
                        source: item.source || 'web',
                        priorityOrder: item.priorityOrder || 0,
                    }));
                reorderQueue(updatedItems);
            }
        });

        return () => unsubscribe();
    }, []); // Only once on mount — never re-subscribe

    // Clean up Firebase when songs are removed locally
    // IMPORTANT: Only cleanup AFTER Firebase has finished initial restore/clear + grace period
    const prevQueueRef = useRef([]);
    const cleanupReadyRef = useRef(false);

    useEffect(() => {
        // Skip cleanup until Firebase initialization is complete
        if (!firebaseInitialized) {
            console.log('[FirebaseSync] Skipping cleanup - Firebase not initialized yet');
            prevQueueRef.current = queue;
            cleanupReadyRef.current = false;
            return;
        }

        // Grace period: wait 1.5s after Firebase init before enabling cleanup
        // This prevents deleting items that are being auto-played on F5 restore
        if (!cleanupReadyRef.current) {
            console.log('[FirebaseSync] Cleanup grace period - waiting 1.5s...');
            const timer = setTimeout(() => {
                cleanupReadyRef.current = true;
                console.log('[FirebaseSync] Cleanup enabled');
            }, 1500);
            prevQueueRef.current = queue;
            return () => clearTimeout(timer);
        }

        const prevKeys = new Set(prevQueueRef.current.map((q) => q.firebaseKey).filter(Boolean));
        const currentKeys = new Set(queue.map((q) => q.firebaseKey).filter(Boolean));

        prevKeys.forEach((key) => {
            if (!currentKeys.has(key)) {
                // knownIdsRef.current.delete(key); // Don't forget this ID, even if removed from queue, to prevent re-adding from stale snapshots
                console.log('[FirebaseSync] Removing from Firebase:', key);
                removeFromFirebaseQueue(key).catch(() => { });
            }
        });

        prevQueueRef.current = queue;
    }, [queue, firebaseInitialized]);
}
