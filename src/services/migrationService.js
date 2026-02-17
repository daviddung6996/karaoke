
import { ref, get, set, update, push } from 'firebase/database';
import { database } from './firebaseConfig';
// Actually running this via node might require firebase-admin or full config. 
// Easier to run this as a "useEffect" in a temporary component or just add it to App.jsx for a second.

// Let's create a service function we can trigger from the execution
export async function migrateLegacyQueue() {
    const queueRef = ref(database, 'queue');
    const customerQueuesRef = ref(database, 'customerQueues');
    const playQueueRef = ref(database, 'playQueue');

    try {
        const snapshot = await get(queueRef);
        if (!snapshot.exists()) {
            return;
        }

        const legacyData = snapshot.val();
        const legacyItems = Object.values(legacyData); // Array of items

        if (legacyItems.length === 0) return;

        // Group by addedBy (Name) since we don't have IDs
        const startTimestamp = Date.now();
        const grouped = {};

        legacyItems.forEach((item, index) => {
            const name = item.addedBy || 'Khách';
            // Create a pseudo-ID based on name
            const customerId = 'legacy_' + btoa(unescape(encodeURIComponent(name))).replace(/[^a-zA-Z0-9]/g, '');

            if (!grouped[customerId]) {
                grouped[customerId] = {
                    name: name,
                    firstOrderTime: item.addedAt || (startTimestamp + index), // Preserve relative order
                    songs: []
                };
            }

            grouped[customerId].songs.push({
                ...item,
                source: 'legacy',
                migratedAt: Date.now()
            });
        });

        // Write to customerQueues
        const updates = {};
        Object.entries(grouped).forEach(([custId, data]) => {
            updates[`customerQueues/${custId}`] = {
                name: data.name,
                firstOrderTime: data.firstOrderTime,
                songs: data.songs // This works if we treat songs as array. 
                // In my logic I supported array or object.
            };
        });

        // Also clear legacy? 
        // Better NOT to clear legacy immediately if we want the old site to still show something?
        // But if we don't clear, and we run migration again?
        // Let's NOT clear for now, just Copy.

        await update(ref(database), updates); // Use root update? No, `customerQueues` prefix is safer

        // Wait, `update` at root:
        // await update(ref(database), updates); 
        // This is fine.

        // Sync Playqueue
        const { generatePlayQueue } = await import('./queueLogic');

        // Read back the full customerQueues to be safe
        const fullSnap = await get(customerQueuesRef);
        const fullQueues = fullSnap.val();
        const newPlayQueue = generatePlayQueue(fullQueues);

        await set(playQueueRef, newPlayQueue);

    } catch (e) {
        console.error("Migration Failed:", e);
    }
}
