
const fs = require('fs');
const path = require('path');
const https = require('https');

// 1. Get API Key from .env
const envPath = path.resolve(__dirname, '../../.env');
let apiKey = '';
try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/VITE_GEMINI_KEY=(.*)/);
    if (match) apiKey = match[1].trim();
} catch (e) {
    console.error("Could not read .env");
    process.exit(1);
}

if (!apiKey) {
    console.error("No API Key found in .env");
    process.exit(1);
}

// 2. Define Request Logic
const MODEL = 'gemini-2.5-flash';
const API_URL = `generativelanguage.googleapis.com`;
const PATH = `/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

const SYSTEM_PROMPT = `Trợ lý karaoke.
Input: từ khóa tìm kiếm.
Output: JSON array gồm 3-4 gợi ý ngắn gọn.
Quy tắc:
1. Thêm dấu, sửa lỗi chính tả.
2. Nếu mơ hồ, đoán bài phổ biến.
3. KHÔNG trả về markdown, chỉ trả về JSON raw.

Output JSON: [{"title":"Tên","artist":"Ca Sĩ","query":"Keyword"}]`;

const input = "tinh yeu mau nang";

const payload = JSON.stringify({
    contents: [{ parts: [{ text: input.trim().slice(0, 100) }] }],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
        response_mime_type: "application/json",
        max_output_tokens: 1000,
        temperature: 0.3
    }
});

console.log(`Testing Gemini Speed with input: "${input}"...`);
const start = Date.now();

const req = https.request({
    hostname: API_URL,
    path: PATH,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
    }
}, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const end = Date.now();
        const duration = end - start;
        console.log(`\nTime taken: ${duration}ms`);

        try {
            const response = JSON.parse(data);
            if (response.error) {
                console.error("API Error:", response.error);
                return;
            }
            const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                console.error("No text in response");
                return;
            }

            console.log("Raw Text:", text);
            const json = JSON.parse(text);
            console.log(`Parsed ${json.length} items.`);

            if (json.length >= 3 && json.length <= 5) {
                console.log("✅ SUCCESS: Count is correct (3-4 range).");
            } else {
                console.log(`❌ FAIL: Count is ${json.length} (expected 3-4).`);
            }

        } catch (e) {
            console.error("Parse Error:", e);
            console.log("Raw Data:", data);
        }
    });
});

req.on('error', (e) => console.error("Request Error:", e));
req.write(payload);
req.end();
