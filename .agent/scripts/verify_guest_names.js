import fs from 'fs';
import path from 'path';

// Helper to clean JSON string
const cleanJSON = (text) => {
    if (!text) return null;
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstOpen = cleaned.indexOf('[');
    const lastClose = cleaned.lastIndexOf(']');
    if (firstOpen !== -1 && lastClose !== -1) {
        cleaned = cleaned.substring(firstOpen, lastClose + 1);
    }
    return cleaned;
};

async function verifyNameSuggestions() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(/VITE_GEMINI_KEY=(.*)/);

        if (!match) {
            console.error("❌ VITE_GEMINI_KEY not found in .env");
            return;
        }

        const apiKey = match[1].trim();
        const model = 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Test inputs representing user scenarios
        const inputs = ["my tam", "son tung", "a tuan"];

        console.log("🔍 Testing Guest Name Suggestions Logic...");

        for (const input of inputs) {

            const prompt = `Bạn là trợ lý sửa lỗi chính tả và gợi ý tên người Việt.
Input: một chuỗi ký tự.
Output: JSON array gồm 5-8 cái tên người Việt hoàn chỉnh.
QUAN TRỌNG: CHỈ TRẢ VỀ JSON ARRAY.

Quy tắc:
1. Nếu input giống tên ca sĩ/người nổi tiếng (ví dụ: "my tam", "son tung"), ưu tiên trả về tên nghệ sĩ đó đầu tiên (ví dụ: "Mỹ Tâm", "Sơn Tùng M-TP").
2. Nếu input là tên thường (ví dụ: "tuan", "lan"), trả về các biến thể phổ biến (Tuấn, Tuân, Lan, Lân...).
3. Nếu input có prefix (ví dụ: "a tuan"), giữ nguyên prefix và sửa phần tên (Anh Tuấn, Anh Tuân).
`;

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: input }] }],
                        systemInstruction: { parts: [{ text: prompt }] },
                        generationConfig: {
                            response_mime_type: "application/json",
                            temperature: 0.4
                        }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    // console.log(`Raw: ${text}`);
                    const cleaned = cleanJSON(text);
                    const parsed = JSON.parse(cleaned);
                    console.log(`\nInput: "${input}"`);
                    console.log(`Output:`, parsed);
                } else {
                    console.error(`❌ API Error for "${input}":`, response.status);
                }
            } catch (err) {
                console.error(`❌ Request Error for "${input}":`, err.message);
            }
        }

    } catch (error) {
        console.error("❌ Verification failed:", error);
    }
}

verifyNameSuggestions();
