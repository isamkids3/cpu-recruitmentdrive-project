# CS Club Multimodal AI Booth Agent & "Crack the Vault" (VAULT-9)

A production-ready, real-time multimodal web application and security educational game designed for university computer science club recruitment drives, tech exhibits, and interactive kiosks. Powered by Google's **Gemini 3.1 Flash Live Preview** (`gemini-3.1-flash-live-preview`) bidirectional streaming WebSocket API.

---

## ⚡ Key Features

### 1. Game Mode: "Crack the Vault" (VAULT-9)
- **New Interaction Model (Text Chat In, Voice Out)**:
  - **Visitor Types**: Visitors type messages into the dedicated chat box (250 char cap, Latin-script only validation, 800ms throttle, one-in-flight lock).
  - **Guard Replies Spoken Aloud**: Guard replies are vocalized aloud over 24kHz Web Audio PCM and streamed into the **"CHAT WITH THE GUARD"** log.
  - **No Microphone in Game Mode**: Zero audio capture, no AudioWorklet initialization, and no mic permissions requested.
  - **Clear UI Separation**: The chat input and secret phrase guess boxes are physically, visually, and functionally separated. Chat messages never count as guesses, and guesses are never sent to the LLM.
- **5 Multi-Tier Security Levels**:
  - L1 (Rookie Guard, 150s), L2 (Nervous Intern, 120s), L3 (Security Analyst, 150s), L4 (Paranoid Sentinel, 150s), L5 (Fort Knox, 180s).
- **Server-Enforced State & Scoring**:
  - HMAC-SHA256 signed `boothToken`, `attemptToken`, and `claimToken` prevent parameter tampering and client-side score forgery.
  - Server-calculated scores factoring in elapsed time bonuses, hint penalties (-15%), and a 25% base score floor.
  - Rate-limited and lockout-protected passcode guessing (Levenshtein $\le 1$ on L1, exact match on L2–L5).
- **Anti-Cheat & Clean Bundle Security**:
  - Zero passphrases, decoy phrases, or system instructions are bundled into client `.next/static` bundles (enforced by automated test scan).
  - Replay-attack prevention and unique nonce tracking across single and batch submissions.
  - Strict handle sanitization (3–12 alphanumeric characters with profanity blocklist).
- **Level 5 Full-Turn Output Guard**:
  - Holds all audio PCM chunks and transcript text for the entire turn until turn completion + 300ms grace (`L5_TRANSCRIPT_GRACE_MS = 300`).
  - If a secret phrase leak is detected in the whole-turn buffer, audio and text are completely discarded, an error buzzer sounds, and the guard shows *"ACCESS DENIED."* alongside *"🤐 The AI caught itself!"*.
  - Levels 1–4 stream immediately for ultra-responsive feedback.
- **English-Only Language Constraint**: Strict prompt-level and client-side script validation blocking non-Latin alphabets and enforcing standardized friendly English fallback lines.

### 2. Co-Host Mode: Multimodal Vision & Audio
- **Live Vision**: 1 FPS 320x240 @ 0.6 quality JPEG snapshots captured via offscreen canvas.
- **Hardware-Gated Audio**: 16,000 Hz 1-channel 16-bit signed PCM audio captured via `AudioWorklet` with echo cancellation, noise suppression, and auto gain control.
- **Push-to-Talk Setting**: Optional staff toggle to gate microphone transmission during noisy hall conditions.
- **Friendly Playful Persona**: Fun, welcoming banter without body/appearance remarks.

---

## 🏃 Running an Event & Booth Requirements

For live booth exhibits and kiosk deployments, follow these guidelines:

### 0. Booth Audio & Hardware Setup
- **Speakers Required**: Since the guard responds with spoken audio in a busy event space, connect high-output booth speakers or headphones so visitors can clearly hear the guard's voice.
- **No Mic Needed for Game Mode**: Game mode requires only a keyboard/touchscreen and speakers. Microphone permissions are only requested if switching to Co-Host mode.

### 1. Build and Run in Production Mode
Always run the booth in production mode. **Do not run `npm run dev` during events**, as hot-reloads and dev server overhead can impact audio latency and reset in-memory state:
```bash
npm run build
npm start
```

### 2. Chrome Kiosk Mode Flags
Launch Google Chrome or Chromium in dedicated kiosk mode:
```bash
google-chrome \
  --kiosk "http://localhost:3000" \
  --no-first-run \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --autoplay-policy=no-user-gesture-required
```

### 3. Disable Developer Tools (Public Station Hardening)
To prevent visitors from inspecting memory or network tokens on public touchscreens, configure Chrome policy or launch with:
```bash
# macOS Managed Preference:
defaults write com.google.Chrome DeveloperToolsAvailability -int 2
```

### 4. Rotating Per-Event Passphrases & Secrets
Rotate secrets before each event by setting them in `.env.local`:
```env
# Server HMAC Secret (min 32 characters)
GAME_SECRET=generate_a_random_32_character_string_here

# Level Passphrases & Decoys
LEVEL_1_PASSPHRASE=purple pizza
LEVEL_2_PASSPHRASE=velvet thunder
LEVEL_3_PASSPHRASE=solar flare
LEVEL_4_PASSPHRASE=quantum shadow
LEVEL_4_DECOY=golden matrix
LEVEL_5_PASSPHRASE=cobalt fortress
LEVEL_5_DECOY=silver cipher

# Public Club Metadata
NEXT_PUBLIC_CLUB_NAME="Computer Science Club"
NEXT_PUBLIC_MEETING_INFO="Tuesdays & Thursdays at 6 PM in Lab 404"
NEXT_PUBLIC_SIGNUP_URL="https://csclub.dev/join"
```

### 5. Gemini Live API Quotas
Verify that your Google AI Studio project has sufficient RPM / concurrent session quotas for bidirectional WebSocket streaming on `gemini-3.1-flash-live-preview`.

---

## 🧪 Testing & Verification

Run the full automated test suite with Vitest:
```bash
npm test
```

Typecheck the codebase:
```bash
npx tsc --noEmit
```

Build the production bundle:
```bash
npm run build
```
