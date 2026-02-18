
/**
 * Fair Round-Robin Queue Generator for Karaoke
 * 
 * FAIRNESS CONTRACT:
 * 1. Each customer's i-th normal song plays at round = startRound + i
 * 2. New customers join at the current active round (not round 1)
 * 3. Returning customers (all songs played, adding more) rejoin at current round
 * 4. Within the same round, customers are ordered by firstOrderTime (who came first)
 * 5. Priority songs always go before all normal songs (FIFO among priorities)
 * 
 * DATA MODEL (per customer in Firebase):
 *   { name, firstOrderTime, startRound, songs: { id: SongData } }
 * 
 * startRound = the absolute round number for this customer's FIRST remaining normal song
 */

/**
 * Compute the current active round from customerQueues (NOT from playQueue).
 * This is the earliest round that any customer is still waiting on.
 * Returns 1 if no customers have normal songs.
 */
export function globalNextRound(customerQueues) {
    const rounds = [];

    for (const data of Object.values(customerQueues || {})) {
        const songs = parseSongs(data.songs);
        const normalSongs = songs.filter(s => !s.isPriority);
        if (normalSongs.length > 0) {
            rounds.push(data.startRound || 1);
        }
    }

    return rounds.length > 0 ? Math.min(...rounds) : 1;
}

/**
 * Generate the play queue from customerQueues.
 * @param {Object} customerQueues - Firebase customerQueues snapshot
 * @returns {Array} Ordered play queue items
 */
export function generatePlayQueue(customerQueues) {
    if (!customerQueues || Object.keys(customerQueues).length === 0) return [];

    const prioritySongs = [];
    const customers = [];

    // Partition priority vs normal, per customer
    for (const [id, data] of Object.entries(customerQueues)) {
        const songs = parseSongs(data.songs);
        const pSongs = songs.filter(s => s.isPriority);
        const nSongs = songs.filter(s => !s.isPriority)
            .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

        for (const s of pSongs) {
            prioritySongs.push({
                ...s,
                customerId: id,
                customerName: data.name,
                isPriority: true,
                firebaseKey: s.id || s.firebaseKey,
            });
        }

        if (nSongs.length > 0) {
            customers.push({
                id,
                name: data.name,
                firstOrderTime: data.firstOrderTime || 0,
                startRound: data.startRound || 1,
                songs: nSongs,
            });
        }
    }

    // Priority songs: LIFO — bài ưu tiên sau lên đầu (hát trước)
    prioritySongs.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    // Sort customers by arrival order (who came to the session first)
    customers.sort((a, b) => a.firstOrderTime - b.firstOrderTime);

    // Round-Robin with startRound offset
    if (customers.length === 0) return prioritySongs;

    const minRound = Math.min(...customers.map(c => c.startRound));
    const maxRound = Math.max(
        ...customers.map(c => c.startRound + c.songs.length - 1)
    );

    const rrQueue = [];

    for (let round = minRound; round <= maxRound; round++) {
        for (const customer of customers) {
            const songIndex = round - customer.startRound;
            if (songIndex >= 0 && songIndex < customer.songs.length) {
                const song = customer.songs[songIndex];
                rrQueue.push({
                    ...song,
                    customerId: customer.id,
                    customerName: customer.name,
                    round,
                    originalSongIndex: songIndex,
                    firebaseKey: song.id || song.firebaseKey || `${customer.id}_${songIndex}`,
                });
            }
        }
    }

    return [...prioritySongs, ...rrQueue];
}

/** Normalize Firebase songs (object or array) into a plain array */
function parseSongs(songs) {
    if (!songs) return [];
    if (Array.isArray(songs)) return [...songs];
    return Object.values(songs);
}
