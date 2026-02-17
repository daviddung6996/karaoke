import { ref, push, remove, onValue, set, get } from 'firebase/database';
import { database, firebaseReady } from './firebaseConfig';

function getQueueRef() {
    if (!firebaseReady || !database) return null;
    return ref(database, 'queue');
}

export async function pushToFirebaseQueue(song) {
    const queueRef = getQueueRef();
    if (!queueRef) return Promise.resolve();

    // Validation: Prevent empty/ghost items
    if (!song.videoId || !song.title) {
        console.warn('[Firebase] Attempted to push invalid song:', song);
        return Promise.reject(new Error('Invalid song data: missing videoId or title'));
    }

    const addedAt = Date.now();
    // Priority: use an incrementing counter so later priority > earlier priority
    // isPriority=0 means normal, isPriority=N (N>0) means priority with order N
    let priorityOrder = 0;

    if (song.isPriority) {
        try {
            // Find the highest existing priorityOrder in the queue
            const snapshot = await get(queueRef);
            if (snapshot.exists()) {
                const val = snapshot.val();
                let maxPriority = 0;
                Object.values(val).forEach((item) => {
                    if (typeof item.priorityOrder === 'number' && item.priorityOrder > maxPriority) {
                        maxPriority = item.priorityOrder;
                    }
                });
                priorityOrder = maxPriority + 1;
            } else {
                priorityOrder = 1;
            }
            console.log('[Priority] New priority song, priorityOrder:', priorityOrder);
        } catch (e) {
            console.error("Error calculating priority order:", e);
            priorityOrder = Date.now(); // Fallback: use timestamp as order (always highest)
        }
    }

    console.log('[Firebase] Pushing to queue:', { title: song.title, addedBy: song.addedBy, priorityOrder, addedAt });
    return push(queueRef, {
         videoId: song.videoId,
         title: song.title,
         cleanTitle: song.cleanTitle || song.title,
         artist: song.artist || '',
         addedBy: song.addedBy || 'Khách',
         thumbnail: song.thumbnail || '',
         addedAt: addedAt,
         priorityOrder: priorityOrder,
         source: song.source || 'web',
     });
}

export function removeFromFirebaseQueue(firebaseKey) {
    if (!firebaseReady || !database) return Promise.resolve();
    const itemRef = ref(database, `queue/${firebaseKey}`);
    return remove(itemRef);
}

export function clearFirebaseQueue() {
    const queueRef = getQueueRef();
    if (!queueRef) return Promise.resolve();
    return set(queueRef, null);
}

export function setNowPlaying(song) {
    if (!firebaseReady || !database) return Promise.resolve();
    const npRef = ref(database, 'nowPlaying');
    return set(npRef, {
        videoId: song.videoId || '',
        title: song.title || '',
        cleanTitle: song.cleanTitle || '',
        artist: song.artist || '',
        addedBy: song.addedBy || 'Khách',
        thumbnail: song.thumbnail || '',
        startedAt: Date.now(),
    });
}

export function clearNowPlaying() {
    if (!firebaseReady || !database) return Promise.resolve();
    const npRef = ref(database, 'nowPlaying');
    return set(npRef, null);
}

export function listenToFirebaseQueue(callback) {
    const queueRef = getQueueRef();
    if (!queueRef) {
        callback([]);
        return () => { };
    }
    return onValue(queueRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            callback([]);
            return;
        }
        const items = Object.entries(data).map(([key, val]) => ({
            ...val,
            id: key,
            firebaseKey: key,
        }));
        // Sort: priority items first (higher priorityOrder = more recent priority = goes first),
        // then normal items by addedAt ascending (FIFO)
        items.sort((a, b) => {
            const aPri = a.priorityOrder || 0;
            const bPri = b.priorityOrder || 0;
            // Both are priority: later priority (higher number) comes first
            if (aPri > 0 && bPri > 0) return bPri - aPri;
            // One is priority, the other is not: priority comes first
            if (aPri > 0) return -1;
            if (bPri > 0) return 1;
            // Both normal: FIFO by addedAt
            return (a.addedAt || 0) - (b.addedAt || 0);
        });
        callback(items);
    });
}

export function listenToNowPlaying(callback) {
    if (!firebaseReady || !database) {
        callback(null);
        return () => { };
    }
    const npRef = ref(database, 'nowPlaying');
    const unsubscribe = onValue(npRef, (snapshot) => {
        const data = snapshot.val();
        console.log('[Firebase] nowPlaying data:', data);
        callback(data || null);
    });
    return unsubscribe;
}
