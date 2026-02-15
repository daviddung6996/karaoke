import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { Innertube, UniversalCache } from 'youtubei.js'

let yt = null;
let ytCreatedAt = 0;
const SESSION_TTL = 1000 * 60 * 30; // Refresh session every 30 minutes

const initYt = async (forceNew = false) => {
  if (forceNew || !yt || (Date.now() - ytCreatedAt > SESSION_TTL)) {
    console.log(forceNew ? '[YT] Forcing new session...' : '[YT] Creating/refreshing session...');
    yt = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
    ytCreatedAt = Date.now();
  }
  return yt;
}

// Fallback: Piped API (no API key, no quota)
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.r4fo.com',
  'https://pipedapi.adminforge.de',
];

const searchPiped = async (query) => {
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}/search?q=${encodeURIComponent(query)}&filter=videos`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      return (data.items || []).filter(v => v.type === 'stream').map(v => ({
        id: v.url?.replace('/watch?v=', '') || '',
        title: v.title || '',
        thumbnail: v.thumbnail || '',
        artist: v.uploaderName || '',
        duration: v.duration ? `${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}` : '',
        views: v.views ? `${(v.views / 1000).toFixed(0)}K` : '0',
        viewCount: v.views || 0,
      }));
    } catch (e) {
      console.warn(`[Piped] ${instance} failed:`, e.message);
    }
  }
  return null;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'youtube-api',
        configureServer(server) {
          const removeAccents = (str) => {
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
          };

          // Get video info by ID (for YouTube URL paste)
          server.middlewares.use('/api/yt/video', async (req, res, next) => {
            try {
              const url = new URL(req.url, `http://${req.headers.host}`);
              const videoId = url.searchParams.get('id');
              if (!videoId) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'No video ID' }));
              }

              const youtube = await initYt();
              const info = await youtube.getBasicInfo(videoId);
              const details = info.basic_info;

              const title = details.title || 'Chưa rõ';
              const lowerTitle = title.toLowerCase();

              const tags = [];
              if (lowerTitle.includes('karaoke')) tags.push('Karaoke');
              if (lowerTitle.includes('remix')) tags.push('Remix');
              if (lowerTitle.includes('beat') || lowerTitle.includes('instrumental')) tags.push('Beat');
              if (lowerTitle.includes('tone nam')) tags.push('Tone Nam');
              if (lowerTitle.includes('tone nữ') || lowerTitle.includes('tone nu')) tags.push('Tone Nữ');
              if (lowerTitle.includes('song ca')) tags.push('Song Ca');

              let cleanTitle = title
                .replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '')
                .replace(/karaoke/gi, '').replace(/official music video/gi, '')
                .replace(/official video/gi, '').replace(/music video/gi, '')
                .replace(/mv/gi, '').replace(/lyrics/gi, '').replace(/lyric/gi, '')
                .replace(/beat/gi, '').replace(/hd/gi, '').replace(/4k/gi, '')
                .replace(/\|/g, '').replace(/-/g, '').replace(/\s+/g, ' ').trim();
              if (cleanTitle.length < 2) cleanTitle = title;

              const viewCount = details.view_count || 0;
              const viewStr = viewCount > 1000000 ? `${(viewCount / 1000000).toFixed(1)}M`
                : viewCount > 1000 ? `${(viewCount / 1000).toFixed(0)}K` : String(viewCount);

              const durationSec = details.duration || 0;
              const duration = `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`;

              const video = {
                id: videoId,
                videoId: videoId,
                title,
                cleanTitle,
                tags,
                thumbnail: details.thumbnail?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                artist: details.channel?.name || details.author || 'Chưa rõ',
                duration,
                views: viewStr,
                viewCount,
                score: viewCount,
                isApi: true,
              };

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(video));
            } catch (e) {
              console.error('[YT] Video info failed:', e.message);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });

          server.middlewares.use('/api/yt/search', async (req, res, next) => {
            try {
              const url = new URL(req.url, `http://${req.headers.host}`);
              const query = url.searchParams.get('q');
              if (!query) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'No query' }));
              }

              const effectiveQuery = query.toLowerCase().includes('karaoke') ? query : `${query} karaoke`;

              // Try Innertube with retry + session refresh
              let rawItems = [];
              for (let attempt = 0; attempt < 2; attempt++) {
                try {
                  const youtube = await initYt(attempt > 0); // Force new session on retry
                  const searchResults = await youtube.search(effectiveQuery);
                  rawItems = searchResults.videos || searchResults.results || [];
                  if (rawItems.length > 0) break;
                } catch (innerErr) {
                  console.warn(`[YT] Innertube attempt ${attempt + 1} failed:`, innerErr.message);
                  if (attempt === 0) yt = null; // Force refresh on next attempt
                }
              }

              // Fallback to Piped API if Innertube failed
              if (rawItems.length === 0) {
                console.log('[YT] Innertube returned 0 results, trying Piped fallback...');
                const pipedResults = await searchPiped(effectiveQuery);
                if (pipedResults && pipedResults.length > 0) {
                  console.log(`[YT] Piped returned ${pipedResults.length} results`);
                  // Piped results are already normalized, apply tags/cleaning and return
                  const withTags = pipedResults.map(v => {
                    const lowerTitle = v.title.toLowerCase();
                    const tags = [];
                    if (lowerTitle.includes('karaoke')) tags.push('Karaoke');
                    if (lowerTitle.includes('remix')) tags.push('Remix');
                    if (lowerTitle.includes('tone nam')) tags.push('Tone Nam');
                    if (lowerTitle.includes('tone nữ') || lowerTitle.includes('tone nu')) tags.push('Tone Nữ');
                    if (lowerTitle.includes('beat')) tags.push('Beat');
                    return { ...v, tags, cleanTitle: v.title };
                  });
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify(withTags));
                }
              }

              console.log('[YT] Found items:', rawItems.length);

              // Normalize and Enhance data
              const videos = rawItems
                .filter(v => v.type === 'Video')
                .map(v => {
                  const originalTitle = v.title?.text || v.title?.toString() || 'Chưa rõ';
                  const lowerTitle = originalTitle.toLowerCase();

                  // Smart Tags Detection
                  const tags = [];
                  if (lowerTitle.includes('karaoke')) tags.push('Karaoke');
                  if (lowerTitle.includes('remix')) tags.push('Remix');
                  if (lowerTitle.includes('cover')) tags.push('Cover');
                  if (lowerTitle.includes('live')) tags.push('Live');
                  if (lowerTitle.includes('beat') || lowerTitle.includes('instrumental')) tags.push('Beat');
                  if (lowerTitle.includes('tone nam') || lowerTitle.includes('tong nam')) tags.push('Tone Nam');
                  if (lowerTitle.includes('tone nữ') || lowerTitle.includes('tone nu') || lowerTitle.includes('tong nu')) tags.push('Tone Nữ');
                  if (lowerTitle.includes('song ca')) tags.push('Song Ca');
                  if (lowerTitle.includes('lofi') || lowerTitle.includes('lo-fi')) tags.push('Lofi');

                  // Title Cleaning (Remove noise to look "Upgraded")
                  let cleanTitle = originalTitle
                    .replace(/\[.*?\]/g, '') // Remove [Tags]
                    .replace(/\(.*?\)/g, '') // Remove (Tags)
                    .replace(/karaoke/gi, '')
                    .replace(/official music video/gi, '')
                    .replace(/official video/gi, '')
                    .replace(/music video/gi, '')
                    .replace(/mv/gi, '')
                    .replace(/lyrics/gi, '')
                    .replace(/lyric/gi, '')
                    .replace(/beat/gi, '')
                    .replace(/hd/gi, '')
                    .replace(/4k/gi, '')
                    .replace(/Remix/gi, '') // Remove Remix from title if grouped
                    .replace(/\|/g, '') // Remove pipes
                    .replace(/-/g, '') // Remove dashes (careful, might be Artist separator)
                    .replace(/\s+/g, ' ') // Collapse spaces
                    .trim();

                  // If we over-cleaned, revert to original (simple heuristic)
                  if (cleanTitle.length < 2) cleanTitle = originalTitle;

                  // View Count Parsing for Sorting
                  const viewString = v.short_view_count?.text || v.view_count?.text || '0';
                  let viewCount = 0;
                  if (viewString) {
                    const num = parseFloat(viewString.replace(/,/g, '').replace(/[^0-9.KMB]/g, '')); // Clean non-numeric except K,M,B
                    if (viewString.includes('K')) viewCount = num * 1000;
                    else if (viewString.includes('M')) viewCount = num * 1000000;
                    else if (viewString.includes('B')) viewCount = num * 1000000000;
                    else viewCount = num || 0;
                  }

                  return {
                    id: v.id,
                    title: originalTitle, // Keep original for reference
                    cleanTitle: cleanTitle,
                    tags: tags,
                    thumbnail: v.thumbnails?.[0]?.url,
                    artist: v.author?.name || v.author?.text || 'Chưa rõ',
                    duration: v.duration?.text || v.duration?.seconds || '',
                    views: v.view_count?.text || v.short_view_count?.text || '0',
                    viewCount: viewCount
                  };
                });

              // SMART SORTING V3 (Context-Aware)
              const attributes = ['tone', 'nam', 'nu', 'nữ', 'karaoke', 'beat', 'remix', 'song', 'ca', 'live', 'cover'];
              const userTokens = removeAccents(query.toLowerCase()).split(/\s+/).filter(t => t.length > 0);
              const songTokens = userTokens.filter(t => !attributes.includes(t));
              const attributeTokens = userTokens.filter(t => attributes.includes(t));

              const scoredVideos = videos.map(v => {
                const titleLower = v.title.toLowerCase();
                const titleNormalized = removeAccents(titleLower);

                // 1. Check Song Match (Strict)
                // Ensure video matches the core song name
                let songMatchRatio = 1;
                if (songTokens.length > 0) {
                  // Check if ALL song tokens are present (relaxed order)
                  // Use normalized title for matching to handle "son" vs "sơn"
                  const matches = songTokens.filter(t => titleNormalized.includes(t)).length;
                  songMatchRatio = matches / songTokens.length;
                }

                // 2. Check Attribute Match (Soft)
                // "Tone Nam" matches give a bonus, but don't rule out others
                let attributeMatchRatio = 0;
                if (attributeTokens.length > 0) {
                  const matches = attributeTokens.filter(t => titleNormalized.includes(t)).length;
                  attributeMatchRatio = matches / attributeTokens.length;
                }

                // 3. Score Calculation
                // Base: Views (User wants high quality beats)
                // Boost: * 5.0 if attributes match perfectly (Strong Preference)
                // This allows a 5M view "Generic" to lose to a 1M "Exact Tone" easily.
                // attributeMatchRatio > 0.5 means they matched "Nam" in "Tone Nam"
                const attributeBoost = attributeMatchRatio > 0.5 ? 5.0 : 1.0;
                let score = v.viewCount * attributeBoost;

                // Penalize low song match hard (Kill "Bạc Phận" when searching "Em Của...")
                // Lower threshold slightly to 0.5 to be more forgiving with partial matches
                if (songMatchRatio < 0.5) score = 0;

                return { ...v, score, songMatchRatio };
              });

              // Filter garbage and Sort
              const finalSorted = scoredVideos
                .filter(v => v.score > 0)
                .sort((a, b) => b.score - a.score);

              // Fallback: If strict filter killed everything, return by views
              const responseIds = finalSorted.length > 0 ? finalSorted : videos.sort((a, b) => b.viewCount - a.viewCount);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(responseIds));
            } catch (e) {
              console.error('[YT] All methods failed:', e.message);
              // Last resort: try Piped in the catch block
              try {
                const q = new URL(req.url, `http://${req.headers.host}`).searchParams.get('q') || '';
                const fallback = await searchPiped(q.toLowerCase().includes('karaoke') ? q : `${q} karaoke`);
                if (fallback && fallback.length > 0) {
                  console.log(`[YT] Emergency Piped fallback: ${fallback.length} results`);
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify(fallback));
                }
              } catch (e2) { /* give up */ }
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        }
      }
    ],
    server: {
      proxy: {
        // Keep Google Suggest fallback
        '/api/suggest': {
          target: 'https://suggestqueries.google.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/suggest/, '/complete/search'),
          headers: { 'User-Agent': 'Mozilla/5.0' },
        },
        // Google Translate TTS Proxy
        '/tts': {
          target: 'https://translate.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/tts/, '/translate_tts'),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://translate.google.com/'
          }
        }
      },
    },
  }
})
