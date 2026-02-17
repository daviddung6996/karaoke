
/**
 * Generates what the "Play Queue" should look like based on current Customer Queues.
 * Implements a Round-Robin algorithm:
 * 1. Sort customers by firstOrderTime (who came first).
 * 2. Pick 1 song from each customer in order (Round 1).
 * 3. Pick next song from each customer (Round 2), and so on.
 * 
 * @param {Object} customerQueues - Map of customerId -> { name, firstOrderTime, songs: { songId: SongData } }
 * @param {Array} playedSongs - List of song IDs (or unique keys) that have already been played/skipped in the current session.
 *                              This helps prevent re-generating songs that were already processed.
 *                              (Optional: for now we might just regenerate everything and filter, or keep index).
 * 
 * Strategy for "played":
 * actually, the playQueue in Firebase should probably just be the *future* list?
 * Or should it be the full list including history?
 * 
 * To catch up with the prompt: "Giữ nguyên các bài đã hát (index < currentIndex). Chỉ re-generate phần chưa hát"
 * But since we don't have persistent backend state other than Firebase,
 * simpler approach:
 * - Generate the FULL target list from scratch every time.
 * - But wait, if we re-generate, the IDs might change? 
 * - We need stable IDs for songs in customerQueues.
 * 
 * @returns {Array} playQueueItems - [{ customerId, song, round, ... }]
 */
export function generatePlayQueue(customerQueues) {
    // 1. Separate Priority Songs vs Normal Songs
    const prioritySongs = [];
    const normalCustomerQueues = {};

    // Clone and partition
    Object.entries(customerQueues).forEach(([id, data]) => {
        let songs = [];
        if (data.songs) {
            if (Array.isArray(data.songs)) {
                songs = [...data.songs];
            } else {
                songs = Object.values(data.songs);
            }
        }

        const pSongs = songs.filter(s => s.isPriority);
        const nSongs = songs.filter(s => !s.isPriority);

        if (pSongs.length > 0) {
            pSongs.forEach(s => {
                prioritySongs.push({
                    ...s,
                    customerId: id,
                    customerName: data.name,
                    isPriority: true,
                    // valid firebaseKey
                    firebaseKey: s.id || s.firebaseKey
                });
            });
        }

        if (nSongs.length > 0) {
            normalCustomerQueues[id] = {
                ...data,
                songs: nSongs.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0))
            };
        }
    });

    // 2. Sort Priority Songs (LIFO or FIFO? implementation plan said LIFO for priority previously?)
    // "Most recently prioritized song always appears at the very top" -> LIFO?
    // Let's stick to: Higher priorityOrder = Top. If same, later added = Top?
    // Let's use addedAt ASC for fairness among priority?
    // Actually, usually Priority = Insert at index 1.
    // Let's sort by addedAt (FIFO) for now, unless priorityOrder is present.
    prioritySongs.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

    // 3. Generate Round Robin for Normal Songs
    const rrQueue = [];

    // Sort customers by arrival
    const customers = Object.entries(normalCustomerQueues).map(([id, data]) => ({
        id,
        ...data
    }));
    customers.sort((a, b) => (a.firstOrderTime || 0) - (b.firstOrderTime || 0));

    // Calculate max round needed (accounting for startRound offset per customer)
    const maxRound = Math.max(
        ...customers.map(c => ((c.startRound || 1) - 1) + (c.songs || []).length),
        0
    );

    for (let round = 1; round <= maxRound; round++) {
        for (const customer of customers) {
            const startRound = customer.startRound || 1;
            const songIndex = round - startRound;
            const songs = customer.songs || [];
            if (songIndex >= 0 && songIndex < songs.length) {
                const song = songs[songIndex];
                rrQueue.push({
                    ...song,
                    customerId: customer.id,
                    customerName: customer.name,
                    round: round,
                    originalSongIndex: songIndex,
                    firebaseKey: song.id || song.firebaseKey || `${customer.id}_${songIndex}`
                });
            }
        }
    }

    // 4. Merge: Priority First, then Round Robin
    return [...prioritySongs, ...rrQueue];
}
