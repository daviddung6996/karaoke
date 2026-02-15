/**
 * Smart Name Suggester for Karaoke Guests
 * Converts shortcodes and provides tonal variations for Vietnamese typing.
 */

const PREFIX_MAP = {
    'a': 'Anh', 'anh': 'Anh',
    'c': 'Chị', 'chi': 'Chị',
    'e': 'Em', 'em': 'Em',
    'co': 'Cô',
    'ch': 'Chú', 'chu': 'Chú',
    'b': 'Bạn', 'ban': 'Bàn'
};

const NUMBER_MAP = {
    '0': 'Không', '1': 'Một', '2': 'Hai', '3': 'Ba', '4': 'Bốn',
    '5': 'Năm', '6': 'Sáu', '7': 'Bảy', '8': 'Tám', '9': 'Chín', '10': 'Mười'
};

const VIETNAMESE_VOWELS = {
    'a': ['a', 'á', 'à', 'ả', 'ã', 'ạ'],
    'ă': ['ă', 'ắ', 'ằ', 'ẳ', 'ẵ', 'ặ'],
    'â': ['â', 'ấ', 'ầ', 'ẩ', 'ẫ', 'ậ'],
    'e': ['e', 'é', 'è', 'ẻ', 'ẽ', 'ẹ'],
    'ê': ['ê', 'ế', 'ề', 'ể', 'ễ', 'ệ'],
    'i': ['i', 'í', 'ì', 'ỉ', 'ĩ', 'ị'],
    'o': ['o', 'ó', 'ò', 'ỏ', 'õ', 'ọ'],
    'ô': ['ô', 'ố', 'ồ', 'ổ', 'ỗ', 'ộ'],
    'ơ': ['ơ', 'ớ', 'ờ', 'ở', 'ỡ', 'ợ'],
    'u': ['u', 'ú', 'ù', 'ủ', 'ũ', 'ụ'],
    'ư': ['ư', 'ứ', 'ừ', 'ử', 'ữ', 'ự'],
    'y': ['y', 'ý', 'ỳ', 'ỷ', 'ỹ', 'ỵ'],
};

// Common variations to prioritize
const PRIORITY_MAP = {
    'bay': 'Bảy',
    'tam': 'Tám',
    'chin': 'Chín',
    'muoi': 'Mười',
    'hai': 'Hải',
    'sau': 'Sáu',
    'nam': 'Năm',
    'bon': 'Bốn'
};

// Vowel mutations for unaccented typing
const VOWEL_MUTATIONS = {
    'a': ['a', 'ă', 'â'],
    'e': ['e', 'ê'],
    'o': ['o', 'ô', 'ơ'],
    'u': ['u', 'ư'],
    'i': ['i'],
    'y': ['y']
};

function getTonalVariations(word) {
    // 1. Check exact number map
    if (NUMBER_MAP[word]) return [NUMBER_MAP[word]];

    // 2. Check priority map
    if (PRIORITY_MAP[word]) {
        // We can return here or prioritize it.
        // Let's generate variations but put priority first.
        // Only return if exact match? No, we want variations too.
    }

    let variations = new Set();
    const chars = word.split('');

    // Find the primary vowel (nucleus) to mutate
    // Strategy: Find the LAST vowel in the word.
    let vowelIdx = -1;
    let baseChar = '';

    for (let i = chars.length - 1; i >= 0; i--) {
        if (VOWEL_MUTATIONS[chars[i]]) {
            vowelIdx = i;
            baseChar = chars[i];
            break;
        }
    }

    if (vowelIdx !== -1) {
        // Get all base forms (e.g., 'e' -> 'e', 'ê')
        const baseForms = VOWEL_MUTATIONS[baseChar] || [baseChar];

        baseForms.forEach(form => {
            // For each form, get tonal variations (e.g., 'ê' -> 'ế', 'ề'...)
            const tones = VIETNAMESE_VOWELS[form];
            if (tones) {
                tones.forEach(toneChar => {
                    let newChars = [...chars];
                    newChars[vowelIdx] = toneChar;
                    variations.add(newChars.join(''));
                });
            } else {
                // If no tones map (shouldn't happen if config is right), keep base
                let newChars = [...chars];
                newChars[vowelIdx] = form;
                variations.add(newChars.join(''));
            }
        });
    } else {
        variations.add(word);
    }

    // Convert Set to Array and Capitalize
    let result = Array.from(variations).map(v => v.charAt(0).toUpperCase() + v.slice(1));

    // Sort? Maybe prioritized by commonality if we had data.
    // Length sort or alpha sort. Alpha is fine.
    return result;
}

export const suggestNames = (input) => {
    if (!input || !input.trim()) return [];

    const parts = input.toLowerCase().trim().split(/\s+/);
    const lastPart = parts[parts.length - 1]; // The word currently being typed/modified
    const prefixParts = parts.slice(0, parts.length - 1);

    let prefixStr = '';

    // Process prefixes
    const processedPrefixes = prefixParts.map((p, idx) => {
        if (idx === 0 && PREFIX_MAP[p]) return PREFIX_MAP[p];
        return p.charAt(0).toUpperCase() + p.slice(1);
    });

    prefixStr = processedPrefixes.join(' ');

    // Generate variations for the last part
    let variations = getTonalVariations(lastPart);

    // Enhance with priority map if applicable
    if (PRIORITY_MAP[lastPart]) {
        const priority = PRIORITY_MAP[lastPart];
        // Move priority to front
        variations = variations.filter(v => v !== priority);
        variations.unshift(priority);
    }

    // Also check Number Map for the last part if it's a digit
    if (NUMBER_MAP[lastPart]) {
        const numVal = NUMBER_MAP[lastPart];
        variations = variations.filter(v => v !== numVal);
        variations.unshift(numVal);
    }

    // Combine
    return variations.map(v => (prefixStr ? `${prefixStr} ${v}` : v));
};
