# CLAUDE.md - Project Context & Developer Guide

> **Welcome AI Developer!** This file contains the essential context, architecture, and rules for working on the "Karaoke Sáu Nhàn" project. Read this before making changes.

## 1. Project Overview
**Karaoke Sáu Nhàn** is a modern, web-based karaoke management system designed for dual-screen operation (Host Control Panel + TV Projection).
- **Core Philosophy:** "2026 Light Theme UI/UX Pro Max" - Clean, Flat, Fast.
- **Primary Goal:** Seamless karaoke experience with smart queuing, voice announcements, and synchronized playback.

## 2. Tech Stack
- **Framework:** React 18 + Vite
- **Styling:** TailwindCSS v4 (Flat Design, No Gradients) + Framer Motion
- **State Management:** Zustand (`src/modules/core/store.js`)
- **Icons:** Lucide React
- **Video Player:** `react-youtube` (YouTube IFrame API)
- **External APIs:**
  - YouTube Search: Standalone middleware using `youtubei.js` + Piped fallbacks.
  - Google Gemini: For title cleaning/suggestions in `geminiService.js`.
  - Google Translate: For TTS announcements.
  - Firebase Realtime Database: For real-time queue sync between apps.

## 3. Architecture & Core Concepts

### 3.1 Dual-Window System
The app runs in two modes, synchronized via `BroadcastChannel`:
1.  **Host (Control Panel)**: The main interface (`/`) for searching, queuing, and controlling playback.
2.  **TV (Projection)**: A passive full-screen view (`/projection`) that mirrors the host's video state.

**Sync Mechanism (`usePlayerSync.js` & `useFirebaseSync.js`):**
- **Window Sync**: Host broadcasts playback state (Seek, Play/Pause) to TV via `BroadcastChannel`.
- **Queue Sync**: Customer web pushes songs to Firebase; Host listens via `useFirebaseSync.js` and updates the global store in real-time.

### 3.3 Multi-App Setup
The project now consists of two independent Vite applications:
1.  **Main App** (Root): The full Host + TV interface. Runs on port **5176**.
2.  **Customer Web** (`/customer-web`): A mobile-optimized search & request portal. Runs on port **5173**.
    - It has its own `youtubei.js` middleware for independent search.
    - No direct dependency on the main app's uptime for choosing songs.

### 3.2 State Management (`store.js`)
The `useAppStore` hook controls the global truth:
- `queue`: Array of songs.
- `currentSong`: Currently playing track.
- `isPlaying`: Global playback status.
- `waitingForGuest`: Boolean, pauses playback while waiting for guest presence (Mic detection).

### 3.3 Search Logic (`videoSearch.js`)
We use a sophisticated scoring algorithm to rank results:
- **Priority:** Exact matches > Tone matches (Nam/Nữ) > Karaoke keywords > View count.
- **Filtering:** Aggressively removes "Live", "Cover", "Remix" unless specified.
- **Local Cache:** Caches results to minimize API API calls.

## 4. Directory Structure
```
src/
├── assets/            # Static assets
├── modules/
│   ├── core/          # Business logic (Store, Sync, Search, TTS)
│   ├── player/        # YouTube integration & Controls
│   ├── projection/    # TV-specific views
│   ├── queue/         # Queue list & logic
│   ├── search/        # Search bar & Suggestion modal
│   └── ui/            # Reusable UI components (Flat design)
├── utils/             # Helper functions
├── App.jsx            # Main Layout (3-Panel Flex)
└── main.jsx           # Entry point
```

## 5. Coding Guidelines

### 5.1 Design & UI
- **Flat Design Only:** Do NOT use gradients. Use solid colors (e.g., `bg-indigo-600`, `bg-slate-50`).
- **Tailwind:** Use utility classes for everything.
- **Responsive:** The Control Panel is designed for Desktop (Landscape), but individual panels use `flex-grow` to resize dynamically.

### 5.2 Development Rules
- **Verify Inputs:** Always check properties exists (e.g., `song?.videoId`) before accessing.
- **Ref forwarding:** UI components (`Input`, `Button`) must support `ref` for accessibility and focus management.
- **Async/Await:** Use async/wait for all promises.
- **Cleanup:** Remove unused imports and regex logs before committing.

### 5.3 Common Workflows
- **Adding a Feature:**
    1. Update `store.js` if global state is needed.
    2. Create component in `modules/<domain>/`.
    3. Import in `App.jsx` or parent component.
- **Modifying Search:**
    - Edit `modules/core/videoSearch.js`. **Do not break the scoring algorithm.**

## 6. Commands
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Main App (Host+TV) on port 5176 |
| `cd customer-web && npm run dev` | Start Customer Portal on port 5173 |
| `npm run build` | Build Main App for production |
| `npm run lint` | Run ESLint |

## 7. Environment Variables
Shared across apps (must be in `.env` and `customer-web/.env`):
- `VITE_GEMINI_KEY`: Gemini AI access.
- `VITE_FIREBASE_API_KEY`: Firebase auth.
- `VITE_FIREBASE_DATABASE_URL`: Firebase Realtime DB URL.
- `VITE_FIREBASE_PROJECT_ID`: Firebase project ID.

## 9. Secondary Monitor Fullscreen (Borderless Popup Strategy)

### 9.1 The "Secret"
Instead of fighting with the strict `requestFullscreen()` API (which fails without clicks) or unstable server hacks, we use a **Borderless Popup** approach that leverages the browser's native window management.

### 9.2 Mechanism
1.  **Physical Dimensions:** We open the popup using `screen.width` and `screen.height` (physical pixels), **NOT** `availWidth` (which subtracts the taskbar).
2.  **Precise Targeting:** `window.open` places the window exactly at `left=X, top=Y` of the secondary monitor.
3.  **The "Toggle" Trick (Auto-Fix):**
    - Sometimes the OS taskbar might stay on top initially.
    - **Switching Modes** (e.g., YouTube <-> Karaoke) triggers `openTV()` again on the *same* window name (`'karaoke_tv'`).
    - This forces the browser to **re-apply** the dimensions (`width/height`) to the existing window.
    - This "refresh" action snaps the window **over the Windows Taskbar**, creating a perfect **Borderless Fullscreen** experience.

**Why it's better:**
- **Zero Clicks:** No user gesture needed on the TV side.
- **Crash-Proof:** Uses standard web APIs, no external scripts or fragile hacks.
- **Reliable:** It's "Soft Fullscreen" — looks like F11, but behaves like a robust native window.

### 9.3 The "Must-Have" Extension
For the best result, install **Automatic Fullscreen**:
- **Link**: [Automatic Fullscreen](https://chromewebstore.google.com/detail/automatic-fullscreen/cflkfeodinanncgojjjfdglaobdkhhob)
- **Why**: It is a "must-have weapon" to force fullscreen effectively, replacing unstable browser tricks.

## 8. TV Autoplay Architecture (CRITICAL — Read Before Touching Player Code)

### 8.1 The Problem
Browsers block autoplay of **unmuted** video without user interaction. The TV window (`/projection`) is a **secondary window** opened via `window.open()` — it has **no user interaction** by default. Without special handling, YouTube videos won't play with sound on TV.

### 8.2 The Solution: `autoplay:1 + mute:1` + Unmute on Command

```
YouTube playerVars: { autoplay: 1, mute: 1 }
→ Browser allows muted autoplay (always permitted)
→ Video loads and plays silently in background
→ When Host sends PLAY → unmute programmatically → user hears audio
```

### 8.3 Single Controller Principle

> ⚠️ **RULE: Only `usePlayerSync.js` controls play/pause on TV.** Nothing else.

The TV player (`YouTubePlayer.jsx` with `passive=true`) must **NOT** independently decide to play/pause. All 5 places that previously tried to control playback caused infinite conflict loops:

| Component | What it does on TV | What it must NOT do |
|-----------|-------------------|-------------------|
| `_onReady` | Unmute if store says playing, else stay muted | ❌ Never call `pauseVideo()` |
| `_onStateChange` (passive) | Unmute/mute based on `store.isPlaying` | ❌ Never call `playVideo()`/`pauseVideo()` |
| Sync effect (line ~160) | Skipped entirely (`if (passive) return`) | ❌ Never run for TV |
| `usePlayerSync` PLAY handler | `unmutePlayer()` + `playPlayer()` | ✅ This is the ONLY play controller |
| Watchdog | Safety net for stuck states (-1, 5) only | ❌ Never intervene for state 2 (paused) |

### 8.4 CSS Visibility Rule

> ⚠️ **NEVER use `visibility: hidden` or `display: none` on the YouTube iframe container.**

Browsers **block autoplay** on invisible iframes. Use `opacity-0` instead:
```jsx
// ✅ CORRECT — iframe can still autoplay
<div className={`${isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>

// ❌ WRONG — browser blocks iframe autoplay
<div className={`${isPlaying ? '' : 'invisible'}`}>
<div className={`${isPlaying ? '' : 'hidden'}`}>
```

### 8.5 Timing: SET_SONG → PLAY Race Condition

When Host sends `SET_SONG`, react-youtube re-renders with new `videoId` → player iframe reloads → `_onReady` fires. But `PLAY` command may arrive **before** the new player is ready.

**Solution in `usePlayerSync.js` PLAY handler:**
```js
if (isPlayerReady()) {
    doPlay(); // immediate
} else {
    // Retry every 300ms until player is ready (max 10s)
    const wait = setInterval(() => {
        if (isPlayerReady()) { clearInterval(wait); doPlay(); }
    }, 300);
    setTimeout(() => clearInterval(wait), 10000);
}
```

### 8.6 Flow Diagram
```
Host sends SET_SONG → TV: setCurrentSong() + setIsPlaying(false)
                        → YouTube re-renders with new videoId
                        → autoplay:1+mute:1 → video plays MUTED in bg
                        → Player div is opacity-0 (bg video visible)

Host sends PLAY     → TV: setIsPlaying(true)
                        → usePlayerSync: unmutePlayer() + playPlayer()
                        → _onStateChange: state=1 + isPlaying → unmute
                        → Player div becomes opacity-100 (video visible)
                        → Watchdog: safety check every 3s (stuck only)

Host sends PAUSE    → TV: setIsPlaying(false)
                        → usePlayerSync: mutePlayer() (video keeps playing silently)
                        → Player div becomes opacity-0 (bg video visible)
```

