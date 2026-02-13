import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function ttsMiddleware() {
  return {
    name: 'tts-middleware',
    configureServer(server) {
      server.middlewares.use('/api/tts', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const text = url.searchParams.get('q');
          const lang = url.searchParams.get('tl') || 'vi';

          if (!text) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing q parameter');
            return;
          }

          const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob&ttsspeed=1`;

          const response = await fetch(ttsUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://translate.google.com/',
            },
          });

          if (!response.ok) {
            console.error('[TTS Middleware] Google returned:', response.status);
            res.writeHead(response.status);
            res.end();
            return;
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': buffer.length,
          });
          res.end(buffer);
        } catch (err) {
          console.error('[TTS Middleware] Error:', err.message);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('TTS error');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ttsMiddleware()],
  server: {
    proxy: {
      '/api/yt-search': {
        target: 'https://www.youtube.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yt-search/, '/results'),
      },
      '/api/yt-suggest': {
        target: 'https://suggestqueries.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yt-suggest/, '/complete/search'),
      },
    },
  },
  appType: 'spa',
})
