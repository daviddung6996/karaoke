# CLAUDE.md - Project Context & Rules

## Project Overview
Karaoke Web App built with React + Vite.
Features: YouTube Search/Playback, Queue Management, Dual Window (TV Mode), AI suggestions (Gemini), TTS announcements.

## Commands
- **Dev Server**: `npm run dev` (Port 5173 default)
- **Build**: `npm run build`
- **Lint**: `npm run lint` (if available)

## Tech Stack
- **Frontend**: React 18, Vite
- **State Management**: React Hooks (`useContext`, `useReducer`, custom hooks)
- **API**: YouTube IFrame API, Gemini AI (via `generativelanguage.googleapis.com`)
- **Styling**: Standard CSS (likely in `index.css` or component-level)

## Key Directories
- `src/components`: UI Components (`SearchBar`, `NowPlaying`, `Queue`, etc.)
- `src/hooks`: Custom logic (`useQueue`, `useYouTube`, `useTTS`, `useHistory`)
- `src/services`: API interactions (`youtube.js`, `gemini.js`, `ai.js`)

## Code Style & Rules
- **Components**: Functional components with hooks.
- **Naming**: PascalCase for components, camelCase for functions/vars.
- **Async**: Use `async/await` for API calls.
- **Error Handling**: `try/catch` block for external APIs (YouTube, Gemini).
- **No Class Components**: Use functional components only.
- **State**: Lift state up or use Context when shared across many components.

## Specific Behaviors
- **Multi-Window**: The app supports opening separate "TV Windows" (`/tv?id=1`, `/tv?id=2`) which are synchronized via `window.postMessage`.
- **TTS**: Text-to-Speech is handled via `window.speechSynthesis`.
- **YouTube**: Interaction via `window.YT.Player`. Native controls can be toggled.

## Environment Variables
- `VITE_GEMINI_KEY`: API Key for Gemini functionalities.
