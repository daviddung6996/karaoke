# CLAUDE.md - Project Context & Rules

## Project Overview
Karaoke Web App built with React + Vite.
**Current Version:** 3.0 "Antigravity Flat" (Clean, No Gradients)
**Features:** 
- Dual-Window Architecture (Control Panel + Projection View).
- Realtime YouTube Search with Hybrid Filter (Local + API).
- Smart Queue with Drag & Drop and Guest Names.
- TTS Announcements via Google Translate Proxy.
- Full-screen Player Mode with Sync.

## Commands
- **Dev Server**: `npm run dev` (Port 5173 default)
- **Build**: `npm run build`
- **Lint**: `npm run lint`

## Tech Stack
- **Frontend**: React 18, Vite, TailwindCSS (for flat styling).
- **State Management**: Zustand (`useAppStore`).
- **Sync**: BroadcastChannel API (`usePlayerSync`).
- **TTS**: Google Translate Proxy (`/tts` -> `translate.google.com`).
- **API**: YouTube IFrame API, Google Gemini (Suggestions/Cleaning), Custom Piped Fallback.

## Key Files & Directories
- `src/App.jsx`: Main entry, orchestrates Control Panel.
- `src/modules/projection/ValidationView.jsx`: The TV/Projector window component.
- `src/modules/core/store.js`: Global state (Queue, Player, Sync).
- `src/modules/core/usePlayerSync.js`: Sync logic between Host and Projection.
- `src/modules/core/videoSearch.js`: YouTube search logic with Piped fallback.
- `src/modules/search/SearchBar.jsx`: Search UI with Smart Suggestions.

## Code Style & Rules
- **Design**: FLAT DESIGN ONLY. No Gradients. Use Tailwind colors (e.g., `bg-indigo-600`).
- **Components**: Functional components with hooks.
- **Naming**: PascalCase for components, camelCase for functions/vars.
- **Async**: Use `async/await` for API calls.
- **Sync**: Always use `usePlayerSync` for state propagation to TV.

## Specific Behaviors
- **Queue**: Stores in localStorage. Drag-and-drop reordering.
- **TTS**: Triggered via `useTTS` hook. Proxies validation to avoid CORS.
- **Search**: Debounced input. Prioritizes "Karaoke", "Beat", "Tone" keywords.
- **Player**: YouTube Iframe. Host controls playback; TV follows Host via BroadcastChannel.

## Environment Variables
- `VITE_GEMINI_KEY`: API Key for Gemini functionalities.
