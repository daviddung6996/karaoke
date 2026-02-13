export async function getGeminiSuggestions(query, apiKey) {
    if (!query || !query.trim()) return [];
    if (!apiKey) return [];

    try {
        const prompt = `
            You are a karaoke expert. A user is searching for a song with the following description: "${query}".
            
            Return a JSON array of the 5 most likely songs that match this description.
            Each item in the array must be an object with:
            - "title": The song title.
            - "artist": The artist name.
            - "reason": A very short explanation (max 10 words) of why this song matches.
            
            Return ONLY raw JSON. Do not use Markdown block.
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            console.error('Gemini API Error:', errData);
            throw new Error(errData.error?.message || 'Gemini API Failed');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) return [];

        // Clean markdown if present
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(jsonString);

    } catch (e) {
        console.error('Gemini Suggestion Error:', e);
        return [];
    }
}

export async function getSingerNameSuggestions(name, apiKey) {
    if (!name || name.trim().length < 2) return [];
    if (!apiKey) return [];

    try {
        const prompt = `
            Task: Suggest 5 likely Vietnamese name variations with correct accents based on this input: "${name}".
            Strict Rule: Only add accents to the input characters. Do not change words or suggest completely different names unless it's a very famous singer correction.
            
            Return ONLY a raw JSON array of strings. 
            Example Input: "quan khac quyen"
            Example Output: ["Quân Khắc Quyền", "Quán Khắc Quyên", "Quân Khắc Quyên"]
            Do not use Markdown block.
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            console.error('Gemini Singer API Error');
            return [];
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) return [];

        // Clean markdown if present
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const result = JSON.parse(jsonString);
        return Array.isArray(result) ? result : [];

    } catch (e) {
        console.error('Gemini Singer Suggestion Error:', e);
        return [];
    }
}
