import { ref, push, remove, onValue, set, get, update } from 'firebase/database';
import { database, firebaseReady } from './firebaseConfig';
import { getDeviceId } from '../utils/identity';
import { generatePlayQueue, globalNextRound } from './queueLogic';

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

/**
 * Convert guest name to a safe Firebase customer key.
 * Each unique guest name gets their own round-robin slot.
 */
export function guestNameToCustomerKey(name) {
    const safe = (name || '').trim().toLowerCase()
        .replace(/[.#$\[\]\/]/g, '')
        .replace(/\s+/g, '_');
    return `guest_${safe || 'unknown'}`;
}

export async function pushToFirebaseQueue(song, customerKey) {
    if (!firebaseReady || !database) return Promise.resolve();

    const effectiveKey = customerKey || getDeviceId();
    const customerRef = ref(database, `customerQueues/${effectiveKey}`);
    const snapshot = await get(customerRef);
    const customerData = snapshot.val();
    const now = Date.now();

    // Read all customerQueues to compute fair startRound
    const allSnapshot = await get(getCustomerQueuesRef());
    const allQueues = allSnapshot.val() || {};
    const nextRound = globalNextRound(allQueues);

    if (!customerData) {
        // Brand new customer → join at current active round
        await update(customerRef, {
            name: song.addedBy || 'Khách mới',
            firstOrderTime: now,
            startRound: nextRound,
        });
    } else {
        // Existing customer — check if they have any remaining normal songs
        const songs = customerData.songs ? Object.values(customerData.songs) : [];
        const hasNormalSongs = songs.some(s => !s.isPriority);

        if (!hasNormalSongs) {
            // All previous songs played → returning customer, bump startRound
            const bumped = Math.max(customerData.startRound || 1, nextRound);
            await update(customerRef, { startRound: bumped, name: song.addedBy });
        } else {
            await update(customerRef, { name: song.addedBy });
        }
    }

    // Add song
    const songsRef = ref(database, `customerQueues/${effectiveKey}/songs`);
    const newSongRef = push(songsRef);
    const newSongKey = newSongRef.key;

    const songData = {
        id: newSongKey,
        videoId: song.videoId,
        title: song.title,
        cleanTitle: song.cleanTitle || song.title,
        artist: song.artist || '',
        addedBy: song.addedBy,
        thumbnail: song.thumbnail || '',
        addedAt: now,
        isPriority: song.isPriority || false,
        source: song.source || 'web',
    };
    if (song.beatOptions) songData.beatOptions = song.beatOptions;
    await set(newSongRef, songData);

    await syncPlayQueue();
    return { key: newSongKey };
}

/**
 * Reserve a slot in the queue without selecting a song.
 * Creates a queue item with status: 'waiting'.
 */
export async function pushReservationToFirebase(guestName, customerKey) {
    if (!firebaseReady || !database) return Promise.resolve();

    const effectiveKey = customerKey || getDeviceId();
    const customerRef = ref(database, `customerQueues/${effectiveKey}`);
    const snapshot = await get(customerRef);
    const customerData = snapshot.val();
    const now = Date.now();

    const allSnapshot = await get(getCustomerQueuesRef());
    const allQueues = allSnapshot.val() || {};
    const nextRound = globalNextRound(allQueues);

    if (!customerData) {
        await update(customerRef, {
            name: guestName || 'Khách mới',
            firstOrderTime: now,
            startRound: nextRound,
        });
    } else {
        const songs = customerData.songs ? Object.values(customerData.songs) : [];
        const hasNormalSongs = songs.some(s => !s.isPriority);
        if (!hasNormalSongs) {
            const bumped = Math.max(customerData.startRound || 1, nextRound);
            await update(customerRef, { startRound: bumped, name: guestName });
        } else {
            await update(customerRef, { name: guestName });
        }
    }

    const songsRef = ref(database, `customerQueues/${effectiveKey}/songs`);
    const newSongRef = push(songsRef);
    const newSongKey = newSongRef.key;

    await set(newSongRef, {
        id: newSongKey,
        videoId: null,
        title: null,
        cleanTitle: null,
        artist: null,
        addedBy: guestName,
        thumbnail: null,
        addedAt: now,
        isPriority: false,
        source: 'host',
        status: 'waiting',
    });

    await syncPlayQueue();
    return { key: newSongKey };
}

/**
 * Update a waiting slot with a song selection.
 * Changes status from 'waiting' to 'ready'.
 */
export async function updateSlotWithSong(songId, songData) {
    if (!firebaseReady || !database || !songId) return;

    try {
        const snapshot = await get(getCustomerQueuesRef());
        const customers = snapshot.val();
        if (!customers) return;

        for (const [custId, data] of Object.entries(customers)) {
            if (data.songs && data.songs[songId]) {
                const songRef = ref(database, `customerQueues/${custId}/songs/${songId}`);
                await update(songRef, {
                    videoId: songData.videoId,
                    title: songData.title,
                    cleanTitle: songData.cleanTitle || songData.title,
                    artist: songData.artist || '',
                    thumbnail: songData.thumbnail || '',
                    status: 'ready',
                });
                await syncPlayQueue();
                return;
            }
        }
    } catch (e) {
        console.error('Error updating slot with song:', e);
    }
}

/**
 * Update the status of a queue item.
 */
export async function updateSlotStatus(songId, status) {
    if (!firebaseReady || !database || !songId) return;

    try {
        const snapshot = await get(getCustomerQueuesRef());
        const customers = snapshot.val();
        if (!customers) return;

        for (const [custId, data] of Object.entries(customers)) {
            if (data.songs && data.songs[songId]) {
                const songRef = ref(database, `customerQueues/${custId}/songs/${songId}`);
                const updateData = { status };
                if (status === 'skipped') updateData.wasSkipped = true;
                await update(songRef, updateData);
                await syncPlayQueue();
                return;
            }
        }
    } catch (e) {
        console.error('Error updating slot status:', e);
    }
}

// Track in-flight removals to prevent duplicate calls
const _pendingRemovals = new Set();

export async function removeFromFirebaseQueue(songId) {
    if (!firebaseReady || !database || !songId) return;

    // Dedup: skip if already being removed
    if (_pendingRemovals.has(songId)) return;
    _pendingRemovals.add(songId);

    try {
        const snapshot = await get(getCustomerQueuesRef());
        const customers = snapshot.val();
        if (!customers) return;

        let foundPath = null;

        for (const [custId, data] of Object.entries(customers)) {
            if (data.songs && data.songs[songId]) {
                foundPath = `customerQueues/${custId}/songs/${songId}`;
                break;
            }
        }

        if (foundPath) {
            await remove(ref(database, foundPath));
            await syncPlayQueue();
        }
    } catch (e) {
        console.error("Error removing song:", e);
    } finally {
        _pendingRemovals.delete(songId);
    }
}

/**
 * Called when a song finishes playing or is skipped-at-turn.
 * Removes the song AND advances the customer's startRound if it's a normal song.
 * This ensures fairness: the customer's next song moves to the next round.
 */
export async function completeSong(songId) {
    if (!firebaseReady || !database || !songId) return;

    if (_pendingRemovals.has(songId)) return;
    _pendingRemovals.add(songId);

    try {
        const snapshot = await get(getCustomerQueuesRef());
        const customers = snapshot.val();
        if (!customers) return;

        for (const [custId, data] of Object.entries(customers)) {
            if (data.songs && data.songs[songId]) {
                const song = data.songs[songId];

                // Remove the song
                await remove(ref(database, `customerQueues/${custId}/songs/${songId}`));

                // Advance startRound if it was a normal (non-priority) song
                if (!song.isPriority) {
                    const currentStart = data.startRound || 1;
                    await update(ref(database, `customerQueues/${custId}`), {
                        startRound: currentStart + 1,
                    });
                }

                await syncPlayQueue();
                return;
            }
        }
    } catch (e) {
        console.error("Error completing song:", e);
    } finally {
        _pendingRemovals.delete(songId);
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

// --- BEAT CHANGE ---

/**
 * Start beat change process for the currently playing song.
 * Sets changingBeat: true and stores beatOptions on nowPlaying.
 */
export async function startBeatChange(beatOptions) {
    if (!firebaseReady || !database) return;
    const npRef = ref(database, 'nowPlaying');
    await update(npRef, {
        changingBeat: true,
        beatOptions: beatOptions || [],
    });
}

/**
 * Confirm a new beat selection. Updates videoId and clears changingBeat.
 */
export async function confirmBeatChange(newBeat) {
    if (!firebaseReady || !database || !newBeat) return;
    const npRef = ref(database, 'nowPlaying');
    await update(npRef, {
        videoId: newBeat.videoId,
        title: newBeat.title,
        changingBeat: false,
        beatOptions: null,
    });
}

/**
 * Cancel beat change without changing the current beat.
 */
export async function cancelBeatChange() {
    if (!firebaseReady || !database) return;
    const npRef = ref(database, 'nowPlaying');
    await update(npRef, {
        changingBeat: false,
        beatOptions: null,
    });
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

export function updateNowPlayingProgress(currentTime, duration) {
    if (!firebaseReady || !database) return Promise.resolve();
    const npRef = ref(database, 'nowPlaying');
    return update(npRef, { currentTime, duration, updatedAt: Date.now() });
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
        const list = val
            ? (Array.isArray(val) ? val : Object.values(val)).filter(Boolean)
            : [];
        callback(list);
    });
}

