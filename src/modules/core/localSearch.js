import songsDB from './data/songs-db.json';

const removeAccents = (str) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
};

export const searchLocalSongs = (query) => {
    if (!query || query.length < 2) return [];

    const normalizedQuery = removeAccents(query.trim());

    // Exact Prefix matches get highest priority
    const prefixMatches = [];
    // Fuzzy matches get lower priority
    const fuzzyMatches = [];

    songsDB.forEach(song => {
        const normTitle = removeAccents(song.title);
        const normArtist = removeAccents(song.artist);
        let score = 0;

        // Check Title Prefix
        if (normTitle.startsWith(normalizedQuery)) score += 100;
        // Check Title Contains
        else if (normTitle.includes(normalizedQuery)) score += 50;

        // Check Artist Prefix
        if (normArtist.startsWith(normalizedQuery)) score += 80;
        // Check Artist Contains
        else if (normArtist.includes(normalizedQuery)) score += 40;

        // Check Aliases
        if (song.aliases) {
            song.aliases.forEach(alias => {
                if (alias.startsWith(normalizedQuery)) score += 90;
                else if (alias.includes(normalizedQuery)) score += 45;
            });
        }

        if (score > 0) {
            const result = {
                title: song.title,
                artist: song.artist,
                query: `${song.title} ${song.artist}`, // For search
                source: 'local',
                score: score + (song.popularity || 0) // Boost by popularity
            };

            if (score >= 80) prefixMatches.push(result);
            else fuzzyMatches.push(result);
        }
    });

    // Sort by Score
    prefixMatches.sort((a, b) => b.score - a.score);
    fuzzyMatches.sort((a, b) => b.score - a.score);

    // Combine and Limit
    return [...prefixMatches, ...fuzzyMatches].slice(0, 5);
};
