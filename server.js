import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { Innertube, UniversalCache } from 'youtubei.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 5173;

// ── YouTube Session ──
let yt = null;
let ytCreatedAt = 0;
const SESSION_TTL = 1000 * 60 * 30;

const initYt = async (forceNew = false) => {
  if (forceNew || !yt || (Date.now() - ytCreatedAt > SESSION_TTL)) {
    console.log(forceNew ? '[YT] Forcing new session...' : '[YT] Creating/refreshing session...');
    yt = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
    ytCreatedAt = Date.now();
  }
  return yt;
};

// ── Piped Fallback ──
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
};

const removeAccents = (str) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

// ── MIME types ──
const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webp': 'image/webp',
};

// ── Proxy helper ──
async function proxyRequest(targetUrl, headers, res) {
  try {
    const resp = await fetch(targetUrl, { headers, signal: AbortSignal.timeout(10000) });
    res.writeHead(resp.status, {
      'Content-Type': resp.headers.get('content-type') || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    });
    const buffer = Buffer.from(await resp.arrayBuffer());
    res.end(buffer);
  } catch (e) {
    res.writeHead(502);
    res.end('Proxy error');
  }
}

// ── API Handlers ──
async function handleVideoInfo(reqUrl, res) {
  const videoId = reqUrl.searchParams.get('id');
  if (!videoId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'No video ID' })); }

  try {
    const youtube = await initYt();
    const info = await youtube.getBasicInfo(videoId);
    const d = info.basic_info;
    const title = d.title || 'Chưa rõ';
    const lt = title.toLowerCase();
    const tags = [];
    if (lt.includes('karaoke')) tags.push('Karaoke');
    if (lt.includes('remix')) tags.push('Remix');
    if (lt.includes('beat') || lt.includes('instrumental')) tags.push('Beat');
    if (lt.includes('tone nam')) tags.push('Tone Nam');
    if (lt.includes('tone nữ') || lt.includes('tone nu')) tags.push('Tone Nữ');
    if (lt.includes('song ca')) tags.push('Song Ca');

    let cleanTitle = title
      .replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '')
      .replace(/karaoke/gi, '').replace(/official music video/gi, '')
      .replace(/official video/gi, '').replace(/music video/gi, '')
      .replace(/mv/gi, '').replace(/lyrics/gi, '').replace(/lyric/gi, '')
      .replace(/beat/gi, '').replace(/hd/gi, '').replace(/4k/gi, '')
      .replace(/\|/g, '').replace(/-/g, '').replace(/\s+/g, ' ').trim();
    if (cleanTitle.length < 2) cleanTitle = title;

    const viewCount = d.view_count || 0;
    const viewStr = viewCount > 1e6 ? `${(viewCount / 1e6).toFixed(1)}M` : viewCount > 1e3 ? `${(viewCount / 1e3).toFixed(0)}K` : String(viewCount);
    const dur = d.duration || 0;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: videoId, videoId, title, cleanTitle, tags,
      thumbnail: d.thumbnail?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      artist: d.channel?.name || d.author || 'Chưa rõ',
      duration: `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}`,
      views: viewStr, viewCount, score: viewCount, isApi: true,
    }));
  } catch (e) {
    console.error('[YT] Video info failed:', e.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}

async function handleSearch(reqUrl, res) {
  const query = reqUrl.searchParams.get('q');
  if (!query) { res.writeHead(400); return res.end(JSON.stringify({ error: 'No query' })); }

  const effectiveQuery = query.toLowerCase().includes('karaoke') ? query : `${query} karaoke`;

  try {
    let rawItems = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const youtube = await initYt(attempt > 0);
        const searchResults = await youtube.search(effectiveQuery);
        rawItems = searchResults.videos || searchResults.results || [];
        if (rawItems.length > 0) break;
      } catch (innerErr) {
        console.warn(`[YT] Innertube attempt ${attempt + 1} failed:`, innerErr.message);
        if (attempt === 0) yt = null;
      }
    }

    if (rawItems.length === 0) {
      console.log('[YT] Innertube returned 0 results, trying Piped fallback...');
      const pipedResults = await searchPiped(effectiveQuery);
      if (pipedResults && pipedResults.length > 0) {
        const withTags = pipedResults.map(v => {
          const lt = v.title.toLowerCase();
          const tags = [];
          if (lt.includes('karaoke')) tags.push('Karaoke');
          if (lt.includes('remix')) tags.push('Remix');
          if (lt.includes('tone nam')) tags.push('Tone Nam');
          if (lt.includes('tone nữ') || lt.includes('tone nu')) tags.push('Tone Nữ');
          if (lt.includes('beat')) tags.push('Beat');
          return { ...v, tags, cleanTitle: v.title };
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(withTags));
      }
    }

    const videos = rawItems.filter(v => v.type === 'Video').map(v => {
      const originalTitle = v.title?.text || v.title?.toString() || 'Chưa rõ';
      const lt = originalTitle.toLowerCase();
      const tags = [];
      if (lt.includes('karaoke')) tags.push('Karaoke');
      if (lt.includes('remix')) tags.push('Remix');
      if (lt.includes('cover')) tags.push('Cover');
      if (lt.includes('live')) tags.push('Live');
      if (lt.includes('beat') || lt.includes('instrumental')) tags.push('Beat');
      if (lt.includes('tone nam') || lt.includes('tong nam')) tags.push('Tone Nam');
      if (lt.includes('tone nữ') || lt.includes('tone nu') || lt.includes('tong nu')) tags.push('Tone Nữ');
      if (lt.includes('song ca')) tags.push('Song Ca');
      if (lt.includes('lofi') || lt.includes('lo-fi')) tags.push('Lofi');

      let cleanTitle = originalTitle
        .replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '')
        .replace(/karaoke/gi, '').replace(/official music video/gi, '')
        .replace(/official video/gi, '').replace(/music video/gi, '')
        .replace(/mv/gi, '').replace(/lyrics/gi, '').replace(/lyric/gi, '')
        .replace(/beat/gi, '').replace(/hd/gi, '').replace(/4k/gi, '')
        .replace(/Remix/gi, '').replace(/\|/g, '').replace(/-/g, '').replace(/\s+/g, ' ').trim();
      if (cleanTitle.length < 2) cleanTitle = originalTitle;

      const viewString = v.short_view_count?.text || v.view_count?.text || '0';
      let viewCount = 0;
      if (viewString) {
        const num = parseFloat(viewString.replace(/,/g, '').replace(/[^0-9.KMB]/g, ''));
        if (viewString.includes('K')) viewCount = num * 1000;
        else if (viewString.includes('M')) viewCount = num * 1000000;
        else if (viewString.includes('B')) viewCount = num * 1000000000;
        else viewCount = num || 0;
      }

      return {
        id: v.id, title: originalTitle, cleanTitle, tags,
        thumbnail: v.thumbnails?.[0]?.url,
        artist: v.author?.name || v.author?.text || 'Chưa rõ',
        duration: v.duration?.text || v.duration?.seconds || '',
        views: v.view_count?.text || v.short_view_count?.text || '0', viewCount,
      };
    });

    // Smart Sorting
    const attributes = ['tone', 'nam', 'nu', 'nữ', 'karaoke', 'beat', 'remix', 'song', 'ca', 'live', 'cover'];
    const userTokens = removeAccents(query.toLowerCase()).split(/\s+/).filter(t => t.length > 0);
    const songTokens = userTokens.filter(t => !attributes.includes(t));
    const attributeTokens = userTokens.filter(t => attributes.includes(t));

    const scoredVideos = videos.map(v => {
      const titleNormalized = removeAccents(v.title.toLowerCase());
      let songMatchRatio = 1;
      if (songTokens.length > 0) {
        const matches = songTokens.filter(t => titleNormalized.includes(t)).length;
        songMatchRatio = matches / songTokens.length;
      }
      let attributeMatchRatio = 0;
      if (attributeTokens.length > 0) {
        const matches = attributeTokens.filter(t => titleNormalized.includes(t)).length;
        attributeMatchRatio = matches / attributeTokens.length;
      }
      const attributeBoost = attributeMatchRatio > 0.5 ? 5.0 : 1.0;
      let score = v.viewCount * attributeBoost;
      if (songMatchRatio < 0.5) score = 0;
      return { ...v, score, songMatchRatio };
    });

    const finalSorted = scoredVideos.filter(v => v.score > 0).sort((a, b) => b.score - a.score);
    const responseData = finalSorted.length > 0 ? finalSorted : videos.sort((a, b) => b.viewCount - a.viewCount);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseData));
  } catch (e) {
    console.error('[YT] All methods failed:', e.message);
    try {
      const fallback = await searchPiped(effectiveQuery);
      if (fallback && fallback.length > 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(fallback));
      }
    } catch { /* give up */ }
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}

// ── HTTP Server ──
// ── Display Mode State ──
let currentDisplayMode = 'extend';

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = reqUrl.pathname;

  // API: Display Mode
  if (pathname === '/api/display/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ mode: currentDisplayMode }));
  }
  if (pathname === '/api/display/extend' && req.method === 'POST') {
    return exec('DisplaySwitch.exe /extend', (err) => {
      if (err) console.warn('[Display] extend failed:', err.message);
      currentDisplayMode = 'extend';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ mode: 'extend' }));
    });
  }
  if (pathname === '/api/display/duplicate' && req.method === 'POST') {
    return exec('DisplaySwitch.exe /clone', (err) => {
      if (err) console.warn('[Display] clone failed:', err.message);
      currentDisplayMode = 'duplicate';

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ mode: 'duplicate' }));
    });
  }

  // API: YouTube Video Info
  if (pathname === '/api/yt/video') return handleVideoInfo(reqUrl, res);

  // API: YouTube Search
  if (pathname === '/api/yt/search') return handleSearch(reqUrl, res);

  // API: Google Suggest Proxy
  if (pathname.startsWith('/api/suggest')) {
    const target = `https://suggestqueries.google.com/complete/search${req.url.replace(/^\/api\/suggest/, '')}`;
    return proxyRequest(target, { 'User-Agent': 'Mozilla/5.0' }, res);
  }

  // API: TTS Proxy
  if (pathname.startsWith('/tts')) {
    const target = `https://translate.googleapis.com/translate_tts${req.url.replace(/^\/tts/, '')}`;
    return proxyRequest(target, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://translate.google.com/',
    }, res);
  }

  // Static files
  let filePath = path.join(DIST, pathname === '/' ? 'index.html' : pathname);

  // SPA fallback: if file doesn't exist, serve index.html
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST, 'index.html');
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const stat = fs.statSync(filePath);

    // Stream large files (video/audio)
    if (stat.size > 1024 * 1024 && req.headers.range) {
      const range = req.headers.range;
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   🎤  KARAOKE SERVER READY           ║`);
  console.log(`  ║   http://localhost:${PORT}             ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
});
