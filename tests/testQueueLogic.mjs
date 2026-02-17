
import { generatePlayQueue } from '../src/services/queueLogic.js';

// Mock Data
const mockCustomerQueues = {
    "c1": {
        name: "Alice",
        firstOrderTime: 1000,
        songs: [
            { id: "s1_1", title: "Alice 1" },
            { id: "s1_2", title: "Alice 2" },
            { id: "s1_3", title: "Alice 3" }
        ]
    },
    "c2": {
        name: "Bob",
        firstOrderTime: 2000, // Arrived later
        songs: [
            { id: "s2_1", title: "Bob 1" },
            { id: "s2_2", title: "Bob 2" }
        ]
    },
    "c3": {
        name: "Charlie",
        firstOrderTime: 500, // Arrived earliest!
        songs: [
            { id: "s3_1", title: "Charlie 1" }
        ]
    }
};

console.log("--- Testing generatePlayQueue ---");
const queue = generatePlayQueue(mockCustomerQueues);

console.log("Generated Queue:");
queue.forEach((item, idx) => {
    console.log(`${idx + 1}. [Round ${item.round}] ${item.customerName}: ${item.title}`);
});

// Verification steps
// Order should be:
// Sorted Customers: Charlie (500), Alice (1000), Bob (2000)

// Round 1:
// 1. Charlie 1
// 2. Alice 1
// 3. Bob 1

// Round 2:
// 4. Alice 2
// 5. Bob 2 (Charlie has no more)

// Round 3:
// 6. Alice 3 (Bob has no more)

const expectedTitles = [
    "Charlie 1",
    "Alice 1",
    "Bob 1",
    "Alice 2",
    "Bob 2",
    "Alice 3"
];

const actualTitles = queue.map(i => i.title);
const passed = JSON.stringify(expectedTitles) === JSON.stringify(actualTitles);

console.log("\nTest Result:", passed ? "PASS" : "FAIL");
if (!passed) {
    console.log("Expected:", expectedTitles);
    console.log("Actual:", actualTitles);
}
