
import fs from 'fs';
import path from 'path';

async function verifyGemini() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(/VITE_GEMINI_KEY=(.*)/);
        const apiKey = match[1].trim();

        // Testing the specific 2.5 flash model
        const model = 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        console.log(`Testing Gemini API with model: ${model}...`);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello, confirm you are working." }] }]
            })
        });

        if (!response.ok) {
            console.error(`❌ API Request Failed: ${response.status} ${response.statusText}`);
            console.error(await response.text());
            return;
        }

        const data = await response.json();
        const output = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log("✅ API Success! Response:", output);

    } catch (error) {
        console.error("❌ Verification failed:", error);
    }
}

verifyGemini();
