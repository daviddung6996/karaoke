import { ref, push, remove, onValue, set, get, update } from 'firebase/database';
import { database, firebaseReady } from './firebaseConfig';
import { getDeviceId } from '../utils/identity';
import { generatePlayQueue } from './queueLogic';

// --- REF & UTILS ---

function getCustomerQueuesRef() {
    if (!firebaseReady || !database) return null;
    return ref(database, 'customerQueues');
}

function getPlayQueueRef() {
    if (!firebaseReady || !database) return null;
    return ref(database, 'playQueue');
}

// Helper to re-generate playQueue whenever customerQueues changes
// IMPORTANT: In a robust real-time app without backend, this is tricky. 
// We will trigger this ONLY when we perform write operations (optimistic client-side logic + final write).
// Or we can have a "Host" client that listens to customerQueues and updates playQueue.
// For simplicity: The client appearing to "push" the song will transactionally update the play queue.
// BETTER: Just update customerQueues, and let a "PlayQueueGenerator" (running on Host) update playQueue?
// BUT: Basic clients might not have the power.
// COMPROMISE: We will read current customerQueues, update it, generate new playQueue, and save BOTH.

async function syncPlayQueue() {
    if (!firebaseReady || !database) return;
    try {
        const snapshot = await get(getCustomerQueuesRef());
        const customerQueues = snapshot.val() || {};
        const newQueue = generatePlayQueue(customerQueues);

        // Save to Firebase
        await set(getPlayQueueRef(), newQueue);
    } catch (e) {
        console.error("Failed to sync play queue:", e);
    }
}


// --- ACTIONS ---

export async function pushToFirebaseQueue(song) {
    if (!firebaseReady || !database) return Promise.resolve();

    // 1. Identify User
    const deviceId = getDeviceId();
    const customerRef = ref(database, `customerQueues/${deviceId}`);

    // 2. Get current state of this customer
    const snapshot = await get(customerRef);
    let customerData = snapshot.val();

    const now = Date.now();

    if (!customerData) {
        // Determine current round from existing playQueue
        let startRound = 1;
        const pqSnapshot = await get(getPlayQueueRef());
        const currentPlayQueue = pqSnapshot.val();
        if (currentPlayQueue) {
            const items = Array.isArray(currentPlayQueue) ? currentPlayQueue : Object.values(currentPlayQueue);
            const firstNormal = items.find(item => !item.isPriority);
            if (firstNormal && firstNormal.round) {
                startRound = firstNormal.round;
            }
        }

        // New customer
        customerData = {
            name: song.addedBy || 'Khách mới',
            firstOrderTime: now,
            startRound: startRound,
            songs: {}
        };
    }

    // 3. Prepare new song entry
    // We use push() to generate a key, but we need to store it inside the object
    // Actually, let's just use an array in memory and save it back, or use firebase push
    // `songs` as a sub-collection (node)

    // Let's use a sub-node 'songs'
    const songsRef = ref(database, `customerQueues/${deviceId}/songs`);
    const newSongRef = push(songsRef);
    const newSongKey = newSongRef.key;

    const newSongData = {
        id: newSongKey,
        videoId: song.videoId,
        title: song.title,
        cleanTitle: song.cleanTitle || song.title,
        artist: song.artist || '',
        addedBy: song.addedBy, // Store the name used at that time
        thumbnail: song.thumbnail || '',
        addedAt: now,
        isPriority: song.isPriority || false,
        source: song.source || 'web',
    };

    // 4. Update Firebase: Add song AND update customer metadata if needed
    // We do sequential updates to ensure consistency is acceptable
    await set(newSongRef, newSongData);

    const existingSnapshot = await get(customerRef);
    const existingData = existingSnapshot.val();
    if (!existingData || !existingData.firstOrderTime) {
        await update(customerRef, {
            firstOrderTime: customerData.firstOrderTime || now,
            startRound: customerData.startRound || 1,
            name: song.addedBy
        });
    } else {
        // Always update name to latest used
        await update(customerRef, { name: song.addedBy });
    }

    // 5. Trigger Re-generation of Play Queue
    // We wait for the add to finish, then sync.
    await syncPlayQueue();

    return { key: newSongKey };
}

export async function removeFromFirebaseQueue(songId) {
    // This is tricky: we receive a songId (firebaseKey) but don't know WHICH customer it belongs to easily
    // unless the ID contains the customerId, or we search.
    // However, our generatePlayQueue puts `customerId` in the item.
    // The UI should pass the full item or we need to find it.

    // If we only get an ID, we might need to search all customers?
    // Let's assume the UI passes the ID that matches a key in `customerQueues/{cid}/songs/{songId}`
    // WAIT: generated IDs are unique per push.

    // Strategy: Search in customerQueues
    // This is inefficient but functional for small karaoke scale (<50 customers).

    if (!firebaseReady || !database) return;

    try {
        const snapshot = await get(getCustomerQueuesRef());
        const customers = snapshot.val();
        if (!customers) return;

        let foundPath = null;

        // Find who owns this song
        for (const [custId, data] of Object.entries(customers)) {
            if (data.songs && data.songs[songId]) {
                foundPath = `customerQueues/${custId}/songs/${songId}`;
                break;
            }
        }

        if (foundPath) {
            await remove(ref(database, foundPath));
            await syncPlayQueue();
        } else {
            console.warn("Song not found to remove:", songId);
        }
    } catch (e) {
        console.error("Error removing song:", e);
    }
}

export function clearFirebaseQueue() {
    if (!firebaseReady || !database) return Promise.resolve();
    // Clear both
    const updates = {};
    updates['customerQueues'] = null;
    updates['playQueue'] = null;
    return update(ref(database), updates);
}

// --- NOW PLAYING (Unchanged mostly) ---

export function setNowPlaying(song) {
    if (!firebaseReady || !database) return Promise.resolve();
    const npRef = ref(database, 'nowPlaying');

    // Sanitize song object: remove undefined values
    const safeSong = { ...song };
    Object.keys(safeSong).forEach(key => {
        if (safeSong[key] === undefined) {
            safeSong[key] = null; // or delete safeSong[key]
        }
    });

    return set(npRef, {
        ...safeSong, // Save sanitized song object
        startedAt: Date.now(),
    });
}

export function clearNowPlaying() {
    if (!firebaseReady || !database) return Promise.resolve();
    const npRef = ref(database, 'nowPlaying');
    return set(npRef, null);
}

export function listenToNowPlaying(callback) {
    if (!firebaseReady || !database) {
        callback(null);
        return () => { };
    }
    const npRef = ref(database, 'nowPlaying');
    return onValue(npRef, (snapshot) => {
        callback(snapshot.val() || null);
    });
}

// --- LISTENERS ---

// New listener: Listens to the GENERATED playQueue
export function listenToFirebaseQueue(callback) {
    const qRef = getPlayQueueRef();
    if (!qRef) {
        callback([]);
        return () => { };
    }

    return onValue(qRef, (snapshot) => {
        const val = snapshot.val();
        const list = val ? Object.values(val) : [];
        // Note: generatePlayQueue returns an Array. Firebase stores array as array (index keys).
        // callback expects the new playQueue format.
        callback(list);
    });
}

