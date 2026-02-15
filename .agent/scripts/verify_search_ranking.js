
// Mocking the scoring logic from videoSearch.js for verification
function calculateAndSort(items, query) {
    return items.map(item => {
        let score = 0;
        const title = item.title.toLowerCase();
        const q = query.toLowerCase();
        const qWords = q.split(/\s+/).filter(w => w.length > 0);

        // 1. Exact Phrase Match
        if (title.includes(q)) score += 100;

        // 2. Tone Match
        if (q.includes('tone nam') && title.includes('tone nam')) score += 200;
        if (q.includes('tone nữ') && title.includes('tone nữ')) score += 200;
        if (q.includes('tone nu') && title.includes('tone nữ')) score += 200;

        // 3. Karaoke/Beat/Instrumental
        if (title.includes('karaoke')) score += 20;
        if (title.includes('beat') || title.includes('instrumental')) score += 10;

        // 4. Word Overlap
        let wordMatches = 0;
        qWords.forEach(word => {
            if (title.includes(word)) wordMatches++;
        });
        score += (wordMatches * 10);

        // 5. All Words Bonus
        if (wordMatches === qWords.length) score += 50;

        // 6. Negatives
        const negatives = ['live', 'concert', 'fancam', 'cover', 'remix'];
        negatives.forEach(neg => {
            if (title.includes(neg) && !q.includes(neg)) {
                score -= 50;
            }
        });

        // 7. Official/MV Penalty
        if ((title.includes('official') || title.includes('mv')) && !title.includes('karaoke')) {
            score -= 50;
        }

        return { ...item, score };
    }).sort((a, b) => b.score - a.score);
}

// Test Data
const mockVideos = [
    { title: "Mạnh Mẽ Lên Cô Gái - Anh Tú (Official MV)" },
    { title: "Mạnh Mẽ Lên Cô Gái - Anh Tú (Karaoke Tone Nữ)" },
    { title: "Mạnh Mẽ Lên Cô Gái - Anh Tú (Karaoke Tone Nam)" },
    { title: "Mạnh Mẽ Lên Cô Gái - Anh Tú (Live Concert)" },
    { title: "Mạnh Mẽ Lên Cô Gái - Cover" }
];

const query = "mạnh mẽ lên cô gái tone nam";

console.log(`Query: "${query}"\n`);
const sorted = calculateAndSort(mockVideos, query);

sorted.forEach((item, index) => {
    console.log(`#${index + 1} [Score: ${item.score}] ${item.title}`);
});

// assertions
if (sorted[0].title.includes("Tone Nam")) {
    console.log("\n✅ SUCCESS: Tone Nam matches are #1");
} else {
    console.error("\n❌ FAILED: Tone Nam is not #1");
}
