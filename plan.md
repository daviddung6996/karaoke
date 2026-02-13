# Karaoke Queue Automation - Detailed Plan

## Context

A garden cafe in rural Vietnam where customers sing karaoke for each other. Currently, the operator (uncle, elderly) has to manually listen to song requests, type and search on YouTube — slow and inefficient. This app replaces the entire workflow.

Primary user: the uncle (elderly, not tech-savvy, lives in rural area). Interacts via keyboard + mouse only. No microphone input — the cafe is too noisy with live singing.

---

## Hardware Setup

### Single Laptop + TV (Extended Display)

Only 1 laptop needed. Connect TV via HDMI cable. Set display mode to **Extend** (not Duplicate).

```
Windows: Settings → Display → Multiple displays → "Extend these displays"
```

This gives 2 independent screens from 1 laptop:

```
+---------------------------+     HDMI cable     +---------------------------+
|    LAPTOP SCREEN          | =================> |    TV (big screen)        |
|    Uncle's control panel  |                    |    YouTube fullscreen     |
|    (only uncle sees this) |                    |    (customers watch this) |
+---------------------------+                    +---------------------------+
```

**Speaker:** TV speaker or external speaker connected to laptop. Plays both karaoke music and TTS announcements.

---

## Architecture Overview

```
[Uncle types song name/description] → [LLM guesses song] → [Select song + customer name] → [Add to queue]
                                            ↓ fail
                                   [Fallback: open YouTube search]

[Queue] → [Press "Next"] → [TTS announces singer] → [YouTube auto-plays on TV]
```

---

## Laptop Screen Layout (Uncle's Control Panel)

Uncle sees this on the laptop. Customers cannot see it.

Everything is designed for elderly users: big text, big buttons, minimal clutter, Vietnamese labels, high contrast.

```
+-----------------------------------------------------------------------+
|                                                                        |
|  [PREVIEW]  Duyen Phan - Nhu Quynh karaoke       00:02:31 / 00:04:15 |
|  (small YouTube iframe, 320x180, shows what TV is playing)             |
|  [⏸ TAM DUNG]  [▶ TIEP TUC]  [🔄 HAT LAI]                          |
|                                                                        |
+-----------------------------------------------------------------------+
|                                                                        |
|  DANG HAT:  🎤 Duyen Phan - Nhu Quynh ──── Anh Tu                    |
|  TIEP THEO: #2 Nguoi Tinh Mua Dong - Nhu Quynh ──── Chi Nam          |
|                                                                        |
|  ┌─────────────────────────────────────────────────────────────────┐   |
|  │           [  >>> BAI TIEP THEO >>>  ]                          │   |
|  │           (big red button, most important action)              │   |
|  └─────────────────────────────────────────────────────────────────┘   |
|                                                                        |
+-----------------------------------------------------------------------+
|  HANG CHO:                                                             |
|  #3  Tinh Nho - Thu Phuong ──── Anh Sau              [XOA]           |
|  #4  Mua Thu La Bay - Nhu Quynh ──── Co Bay           [XOA]           |
|  #5  ...                                                               |
+-----------------------------------------------------------------------+
|                                                                        |
|  [ Go ten bai hoac mo ta...                         ] [  TIM BAI  ]  |
|                                                                        |
|  Ket qua:                                                              |
|  [  Duyen Phan - Nhu Quynh                                    CHON ] |
|  [  Duyen Tham - Thanh Thuy                                    CHON ] |
|  [  Duyen Que - Ngoc Son                                       CHON ] |
|                                                                        |
|  [ TIM TREN YOUTUBE ]   [ THEM BAI THU CONG ]                        |
|                                                                        |
+-----------------------------------------------------------------------+
```

### TV Screen (Customer View)

Customers only see YouTube fullscreen karaoke video. Nothing else.

The app opens a second browser window, drags it to the TV screen, and puts it in fullscreen (F11). This window only contains the YouTube player iframe.

---

## Elderly-Friendly UI Design Rules

### Text & Font
- Minimum font size: 28px for body, 36px for headings
- Font: system default sans-serif, no fancy fonts
- High contrast: white text on dark background (dark mode default)
- No English text in the UI — everything in Vietnamese
- No icons alone — always pair icon with Vietnamese text label

### Buttons
- Minimum button size: 60px tall, full width when possible
- "BAI TIEP THEO" (Next Song) is the biggest button, red, center of screen
- Buttons have clear border/shadow so they look "pressable"
- No hover-only effects — elderly users may not understand hover
- After pressing a destructive button (XOA), show simple confirm: "Chac chua?" with "Co" and "Khong"

### Layout
- No tabs, no sidebar, no hamburger menu
- Single scrollable page, everything visible
- Most important action (Next Song) always visible without scrolling
- Preview + Now Playing at top, Queue in middle, Search at bottom
- No animations or transitions — things appear/disappear instantly

### Colors
- Background: #1a1a2e (dark navy)
- Text: #ffffff (white)
- Primary button (Next Song): #e63946 (bright red)
- Secondary buttons: #457b9d (blue)
- Queue items: #2d2d44 (dark card)
- Now playing highlight: #f4a261 (warm orange)
- Success feedback: #2a9d8f (green)

### Feedback
- When uncle adds a song: brief green flash "Da them bai [song name]"
- When queue is empty: big text "Chua co bai nao. Hay tim bai!"
- When AI is searching: simple text "Dang tim..." (no spinning loaders)
- When AI finds nothing: "Khong tim thay. Bam 'Tim tren YouTube' de tu tim"

### Error Prevention
- No way to accidentally delete the entire queue — "Xoa het" requires typing "xoa" to confirm
- "BAI TIEP THEO" skips confirm because speed matters, but shows undo for 5 seconds: "Bam day de quay lai bai truoc"
- If uncle presses Search with empty input, do nothing (no error popup)

---

## Features

### 1. TV Preview (Small iframe on laptop)

A small YouTube iframe (320x180px) on the uncle's control panel that mirrors what the TV is showing.

**How it works:**
- Both the TV window and the preview iframe load the same YouTube video ID
- Preview uses YouTube IFrame API to show current playback position
- Uncle can see at a glance: what's playing, how far along, has it ended

**Controls under preview:**
- "TAM DUNG" (Pause) — pauses both preview and TV
- "TIEP TUC" (Resume) — resumes playback
- "HAT LAI" (Replay) — restart current video from beginning

**Sync mechanism:**
```javascript
// TV window and preview share the same video ID
// When uncle loads a new song:
tvPlayer.loadVideoById(videoId);      // fullscreen on TV
previewPlayer.loadVideoById(videoId); // small on laptop

// Sync state
previewPlayer.addEventListener('onStateChange', (e) => {
  if (e.data === YT.PlayerState.PAUSED) tvPlayer.pauseVideo();
  if (e.data === YT.PlayerState.PLAYING) tvPlayer.playVideo();
});
```

**Status display under preview:**
- Current time / Total time (e.g., "02:31 / 04:15")
- Simple progress bar
- Text status: "Dang phat" / "Tam dung" / "Da het"
- When video ends: preview area flashes gently + text "Da het bai! Bam BAI TIEP THEO"

### 2. Song Search

**Input:** Large text field (font 28px), uncle types anything:
- Exact song name: "Duyen Phan"
- Artist name: "Nhu Quynh"
- Vague description: "bai buon con gai hat mua gi do"
- Combo: "nhac Son Tung vui vui"

**Flow:**

```
Step 1: Check local history first (previously played songs)
        → If match → show suggestion immediately, no API call

Step 2: Send to LLM (Anthropic API)
        Prompt: "Guess the Vietnamese song from this description,
        return JSON: {songs: [{title, artist}]}, max 3 results"

Step 3: Show results, each song is a big button, tap to select

Step 4: If LLM fails or results are wrong
        → Show "TIM TREN YOUTUBE" button
        → Opens YouTube search in new tab on LAPTOP screen (not TV)
        → Uncle finds manually, copies video title back
        → Or uses "THEM BAI THU CONG" to type song name directly
```

**Manual fallback:**
- "THEM BAI THU CONG" button → type song name + artist directly → add to queue
- No AI needed, no YouTube API needed
- For when uncle already knows the exact song, just wants to add it fast

### 3. Queue Management

**Display:**
- Vertical list, big text, high contrast
- Each item: order number, song title, artist, customer name
- Now playing: highlighted warm orange, pinned at top
- Next up: subtle highlight

**Controls:**
- "XOA" button on each song (with simple confirm)
- "BAI TIEP THEO" big red button → advance to next song
- "HAT LAI" → replay current song on TV
- "XOA HET" at very bottom → clear entire queue (must type "xoa" to confirm)
- No drag & drop — too complex for elderly. Instead: "LEN" and "XUONG" arrow buttons on each queue item to reorder

**Storage:**
- localStorage — single device, simple, no internet needed for queue

### 4. YouTube Karaoke Player

**How it works:**
- When uncle selects a song or presses "BAI TIEP THEO":
  1. App searches YouTube for: `{song title} {artist} karaoke beat`
  2. Takes the top result video ID
  3. Loads it in both TV iframe (fullscreen) and preview iframe (small)
  4. Auto-plays on TV

**Two browser windows from one app:**
```
Window 1 (laptop): Full control panel app
Window 2 (TV):     Opened via window.open(), moved to TV, fullscreen
                   Contains only YouTube iframe, nothing else
```

**YouTube IFrame API events:**
```javascript
player.addEventListener('onStateChange', function(event) {
  if (event.data === YT.PlayerState.ENDED) {
    // Show on laptop: "Da het bai! Bam BAI TIEP THEO"
    // Flash the Next Song button
    // Do NOT auto-advance — wait for uncle
  }
});
```

**Fallback when iframe doesn't work:**
- "MO YOUTUBE" button → opens YouTube search in new tab
- Uncle manually finds the right karaoke video
- Drags that tab to TV screen and fullscreens it

**YouTube search strategy:**
```
Primary:   "{song} {artist} karaoke beat"
Fallback:  "{song} {artist} karaoke"
Last try:  "{song} karaoke"
```

### 5. TTS - Announce Singer Name

**When to speak:**
- When uncle presses "BAI TIEP THEO"
- Says in Vietnamese: "Moi [customer name] hat bai [song title]"
- Then announces next person: "Ke tiep la [next customer name]"

**Tech:**
```javascript
function announce(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'vi-VN';
  u.rate = 0.85;  // slower than normal for clarity
  u.volume = 1.0;
  speechSynthesis.speak(u);
}

// Usage when pressing Next:
announce("Moi anh Tu hat bai Duyen Phan");
setTimeout(() => {
  announce("Ke tiep la chi Nam");
}, 4000);
```

- Uses Web Speech Synthesis API (free, built into Chrome)
- Plays through laptop speaker → external speaker → whole cafe hears
- "DOC LAI" (Repeat) button in case customers didn't hear

**TTS plays BEFORE YouTube starts the next song**, so customers have time to walk up to the mic.

### 6. History & Smart Suggestions

**Save history:**
- Every played song: title, artist, customer name, date
- Store in localStorage

**Autocomplete:**
- When uncle starts typing, check history first
- Show suggestions below input field as big buttons
- Sort by frequency: most played songs appear first
- Example: uncle types "Duy" → shows "Duyen Phan - Nhu Quynh (da hat 12 lan)"

**This is the most useful feature for elderly users** — after a few weeks, most regular songs are in history and uncle barely needs AI anymore. Just type a few letters → tap the suggestion.

### 7. Additional Features

**Hot songs list:**
- Button "BAI HAY HAT" opens list of top 20 most frequently played songs
- Uncle just taps to add to queue, no typing
- Perfect when customer says "hat bai gi cung duoc"

**Countdown on TV (optional, Phase 3):**
- Overlay on TV showing queue: "Sap toi: Anh Tu - Duyen Phan"
- Customers see when they're up without asking uncle

---

## Tech Stack

| Component | Technology | Reason |
|---|---|---|
| Frontend | React + Vite | Familiar, fast |
| UI | Tailwind CSS | Quick, responsive |
| AI song guess | Anthropic API (Claude Sonnet) | Cheap, good Vietnamese |
| TTS | Web Speech Synthesis API | Free, no backend needed |
| Player | YouTube IFrame API | Free, huge karaoke library |
| Storage | localStorage | Simple, no internet needed for queue |
| Deploy | Run locally on laptop | No hosting cost, works offline (except AI) |

---

## Hardware

```
1 laptop (can be old, just needs Chrome)
    ├── HDMI cable → 1 TV (customers watch karaoke)
    ├── Audio cable or Bluetooth → External speaker (for music + TTS)
    └── Display mode: Extend (not Duplicate)
```

**That's it.** No tablet, no extra PC, no server, no cloud sync.

**Speaker note:** The TV speaker might be enough if the cafe is small. For bigger spaces, connect an external speaker to the laptop's audio jack. Both YouTube karaoke and TTS announcements play through the same speaker.

---

## File Structure

```
karaoke-app/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx                # Main layout, control panel
│   ├── TVWindow.jsx           # Separate window for TV (YouTube only)
│   ├── components/
│   │   ├── Preview.jsx        # Small YouTube preview + controls
│   │   ├── NowPlaying.jsx     # Current song info + Next button
│   │   ├── Queue.jsx          # Queue list with reorder buttons
│   │   ├── SearchBar.jsx      # Song search + AI results
│   │   ├── SingerInput.jsx    # Customer name input modal
│   │   ├── HotSongs.jsx       # Popular songs list
│   │   └── Confirm.jsx        # Simple confirm dialog (Vietnamese)
│   ├── hooks/
│   │   ├── useQueue.js        # Queue logic, CRUD, localStorage
│   │   ├── useTTS.js          # Text-to-speech Vietnamese
│   │   ├── useHistory.js      # Save + suggest played songs
│   │   └── useYouTube.js      # YouTube IFrame API, dual player sync
│   ├── services/
│   │   ├── ai.js              # Anthropic API song guessing
│   │   └── youtube.js         # YouTube search + video ID extraction
│   └── styles/
│       └── globals.css        # Large fonts, big buttons, high contrast
```

---

## User Flow (Step by Step)

```
SETUP (one time):
1. Plug HDMI from laptop to TV
2. Windows → Settings → Display → Extend
3. Open Chrome, run the app
4. App auto-opens TV window → drag it to TV screen → press F11

DAILY USE:
1. Customer walks up: "Cho anh hat bai buon buon cua Nhu Quynh"

2. Uncle types: "buon nhu quynh"

3. App shows AI results:
   [ Duyen Phan - Nhu Quynh          CHON ]
   [ Nguoi Tinh Mua Dong - Nhu Quynh CHON ]
   [ Noi Buon Hoa Phuong - Nhu Quynh CHON ]

4. Uncle taps "Duyen Phan - Nhu Quynh"

5. Popup: "Ten nguoi hat?" → Uncle types "Anh Tu" → taps "XONG"
   (or taps "BO QUA" if doesn't want to enter name)

6. Queue updates: #5 Duyen Phan - Nhu Quynh (Anh Tu)
   Brief green flash: "Da them bai Duyen Phan"

7. ... other songs play on TV ...

8. Anh Tu's turn. Uncle sees preview: current song is ending.
   "BAI TIEP THEO" button flashes.

9. Uncle taps "BAI TIEP THEO"

10. TTS through speaker: "Moi anh Tu hat bai Duyen Phan"
    Then: "Ke tiep la chi Nam"

11. 3 second pause for customer to get ready

12. YouTube karaoke auto-plays on TV: "Duyen Phan Nhu Quynh karaoke beat"
    Preview on laptop shows same video in small

13. If wrong video → uncle taps "TIM TREN YOUTUBE" → finds correct one manually
```

---

## Development Priorities

**Phase 1 - MVP (build first, ~2-3 days):**
- Search input + AI song guessing
- Basic queue (add, remove, next song with UP/DOWN buttons)
- YouTube opens in second window on TV
- Small preview iframe on laptop
- TTS announcing customer name in Vietnamese
- localStorage for queue

**Phase 2 - Polish (~1-2 days):**
- History + autocomplete from previously played songs
- Hot songs list
- Video end detection → flash "BAI TIEP THEO" button
- YouTube search fallback strategy (3 query patterns)

**Phase 3 - Nice to have:**
- Song and singer statistics
- Queue overlay on TV screen
- Export history to CSV/spreadsheet

---

## Monthly Cost

| Item | Cost |
|---|---|
| Anthropic API | ~$0.50-1/month (very few requests) |
| YouTube | Free |
| TTS | Free (Web Speech API) |
| Hosting | Free (runs locally on laptop) |
| Hardware | Laptop + TV + HDMI cable (already have) |
| **Total** | **Under $2/month** |
