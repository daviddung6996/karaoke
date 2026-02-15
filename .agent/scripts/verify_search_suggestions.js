
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

async function verifySearchSuggestions() {
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

        const inputs = ["chiec khan gio am", "son tung", "tinh yeu mau nang"];
        console.log("🔍 Testing Search Suggestions Logic...");

        for (const input of inputs) {
            const prompt = `Bạn là trợ lý tìm bài hát karaoke cho người Việt lớn tuổi.
Nhận input tìm kiếm và trả về JSON array gồm 5-7 gợi ý.

QUAN TRỌNG: CHỈ TRẢ VỀ JSON ARRAY. KHÔNG ĐƯỢC CÓ BẤT KỲ VĂN BẢN NÀO KHÁC.

Quy tắc:
- Thêm dấu tiếng Việt đầy đủ, viết hoa đúng
- Sửa lỗi chính tả
- Nếu mơ hồ, đoán bài phổ biến nhất
- Ưu tiên: bolero, nhạc vàng, trữ tình trước; nhạc trẻ sau
- Nếu input rõ ràng, gợi ý thêm phiên bản khác

Output JSON format:
[{"title":"Tên Bài","artist":"Ca Sĩ","query":"Tên Bài Ca Sĩ karaoke"}]`;

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: input }] }],
                        systemInstruction: { parts: [{ text: prompt }] },
                        generationConfig: {
                            response_mime_type: "application/json",
                            max_output_tokens: 500,
                            temperature: 0.3
                        }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    const cleaned = cleanJSON(text);
                    const parsed = JSON.parse(cleaned);
                    console.log(`\nInput: "${input}"`);
                    console.log(`Output First Item:`, parsed[0]);
                } else {
                    console.error(`❌ API Error for "${input}":`, response.status);
                }
            } catch (err) {
                console.error(`❌ Request Error for "${input}":`, err.message);
                console.error(err);
            }
        }

    } catch (error) {
        console.error("❌ Verification failed:", error);
    }
}

verifySearchSuggestions();
