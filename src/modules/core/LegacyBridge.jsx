import { useEffect } from 'react';
import { ref, onChildAdded, remove, get } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { pushToFirebaseQueue } from '../../services/firebaseQueueService';

/**
 * LegacyBridge: Listens to the old flat `queue` used by the legacy customer web app.
 * When a song is added there, we:
 * 1. Read it.
 * 2. Convert it to the new `customerQueues` format via pushToFirebaseQueue.
 * 3. Remove it from the old `queue` to prevent duplication (and signal it was processed).
 * 
 * NOTE: Removes from old queue means legacy app will see it disappear.
 * If we want legacy app to see it, we must NOT remove it, but tag it.
 * However, tagging requires writing back to old queue.
 * Simple approach: Consume it. The legacy app will just show empty queue? 
 * Or maybe we just leave it and use a local "processed" list?
 * But if we restart the host, we re-process.
 * 
 * Secure approach: Remove it. The legacy app will show "Queue empty" or whatever.
 * The user can see their song in the "Now Playing" or "Upcoming" if we sync BACK to legacy queue?
 * No, let's just consume for now. The goal is to migrate TO new system.
 */
const LegacyBridge = () => {
    useEffect(() => {
        if (!database) return;

        const legacyQueueRef = ref(database, 'queue');

        // Force check existing items on mount to ensure we clear stale data
        get(legacyQueueRef).then(async (snapshot) => {
            try {
                if (snapshot.exists()) {
                    const data = snapshot.val();

                    // Process each existing item
                    for (const [key, val] of Object.entries(data)) {
                        try {
                            await processLegacyItem(key, val);
                        } catch (err) {
                            console.error('[LegacyBridge] Failed to process item:', key, err);
                        }
                    }
                }
            } catch (err) {
                console.error('[LegacyBridge] Failed to check legacy queue:', err);
            }
        });

        const unsubscribe = onChildAdded(legacyQueueRef, async (snapshot) => {
            try {
                const val = snapshot.val();
                const key = snapshot.key;
                if (val) {
                    await processLegacyItem(key, val);
                }
            } catch (err) {
                console.error('[LegacyBridge] onChildAdded error:', err);
            }
        });

        return () => unsubscribe();
    }, []);

    const processLegacyItem = async (key, val) => {
        try {
            if (!val || typeof val !== 'object') {
                console.warn('[LegacyBridge] Invalid item format (not an object), removing:', key);
                try {
                    await remove(ref(database, `queue/${key}`));
                } catch (err) {
                    console.warn('[LegacyBridge] Failed to remove invalid item:', key, err);
                }
                return;
            }

            // Validate required fields
            if (!val.videoId || !val.title) {
                console.warn('[LegacyBridge] Item missing required fields (videoId/title), removing:', key, val);
                try {
                    await remove(ref(database, `queue/${key}`));
                } catch (err) {
                    console.warn('[LegacyBridge] Failed to remove incomplete item:', key, err);
                }
                return;
            }

            // 1. Migrate to new system
            // Ensure no undefined values are passed
            await pushToFirebaseQueue({
                videoId: val.videoId,
                title: val.title,
                cleanTitle: val.cleanTitle || '',
                artist: val.artist || '',
                // Fallback for addedBy if missing
                addedBy: val.addedBy || 'Khách (Web Cũ)',
                thumbnail: val.thumbnail || '',
                source: 'legacy_bridge',
                isPriority: !!val.isPriority // Ensure boolean
            });

            // 2. Remove from old queue immediately
            try {
                await remove(ref(database, `queue/${key}`));
            } catch (err) {
                console.warn('[LegacyBridge] Failed to remove after migration:', key, err);
            }
        } catch (err) {
            console.error('[LegacyBridge] Error processing item:', key, err);
        }
    };

    return null; // Logic only component
};

export default LegacyBridge;
