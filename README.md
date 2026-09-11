# CS Club Multimodal AI Booth Agent

A production-ready, real-time multimodal web application co-host for computer science club recruitment drives, tech booth exhibits, and interactive kiosks. Powered by Google's **Gemini 3.1 Flash Live Preview** (`gemini-3.1-flash-live-preview`) bidirectional streaming WebSocket API.

---

## ⚡ Key Features

- **Live Multimodal Vision & Audio**:
  - **Vision**: 1 FPS 320x240 @ 0.6 quality JPEG snapshots captured via offscreen canvas.
  - **Microphone**: 16,000 Hz 1-channel 16-bit signed PCM audio captured via a dedicated `AudioWorklet` buffered to 2,048 samples (~128ms) for reliable Voice Activity Detection (VAD).
  - **Speaker Playback**: Sequential 24,000 Hz PCM audio buffer scheduling via Web Audio API (`AudioContext`).
- **Modern Gemini Live Protocol**: Uses direct typed `realtimeInput.audio` and `realtimeInput.video` payloads matching the latest Gemini 3.1 Live API specification.
- **Bidirectional Live Banter Ticker**:
  - **Visitor Speech Recognition**: Integrated Web Speech API (`SpeechRecognition`) providing instantaneous live speech-to-text logging for visitors (`👤 VISITOR`).
  - **Unified AI Chat Bubbles**: Streamed response tokens and server transcriptions automatically aggregate into cohesive, single chat cards per response (`🤖 AI`).
- **Native Barge-In (Interruption Handling)**: Seamless, natural conversational flow; immediately halts playing audio nodes and clears the playback queue when `serverContent.interrupted = true`.
- **PIN Gatekeeper Authentication**:
  - Serverless Next.js endpoint (`POST /api/session`) verifies `BOOTH_PIN` before issuing `GEMINI_API_KEY` to browser memory (`sessionStorage`).
  - Prevents API key exposure to web crawlers and unauthorized visitors.
- **Instant Visitor Reset**: "Next Visitor / Reset Conversation" button closes and reconnects the WebSocket for a fresh session while preserving camera and microphone hardware tracks (zero video flicker or permission re-prompts).
- **Idle Watchdog**: Automatically resets the conversation after 90 seconds of inactivity to prevent runaway token usage.
- **Cyberpunk Dark-Tech HUD**: Real-time audio waveform visualizers for both user and AI, targeting crosshairs, live round-trip latency meter, and telemetry status badges.

---

## 🏗️ Architecture & Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               Browser Client                                │
│                                                                             │
│  ┌────────────────────┐   ┌────────────────────┐    ┌────────────────────┐  │
│  │    AudioWorklet    │   │  Offscreen Canvas  │    │     Web Audio      │  │
│  │  (16kHz PCM Audio) │   │    (1 FPS JPEG)    │    │  (24kHz Playback)  │  │
│  └─────────┬──────────┘   └─────────┬──────────┘    └──────────▲─────────┘  │
│            │                        │                          │            │
│  ┌─────────┴──────────┐             │               ┌──────────┴─────────┐  │
│  │ Web Speech API STT │             │               │ Native Barge-in    │  │
│  │ (Visitor Logs)     │             │               │ (Playback Flush)   │  │
│  └────────────────────┘             │               └────────────────────┘  │
└────────────┼────────────────────────┼──────────────────────────┼────────────┘
             │                        │                          │
    1. PIN   │  3. 16kHz PCM Audio    │  4. 1 FPS Video Frames   │ 5. 24kHz PCM
    Auth     │     (Base64)           │     (Base64)             │    Audio Stream
             ▼                        ▼                          │
┌─────────────────────────┐     ┌────────────────────────────────┴────────────┐
│ Next.js API Route       │     │ Gemini 3.1 Flash Live WebSocket             │
│ POST /api/session       │     │ wss://generativelanguage.googleapis.com...  │
│ (BOOTH_PIN Verification)│     │                                             │
└─────────────────────────┘     └─────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
├── public/
│   └── audio-worklet-processor.js  # 16-bit PCM AudioWorklet processor (2048-sample buffer)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── session/
│   │   │       └── route.ts        # PIN authentication & API key issuing endpoint
│   │   ├── globals.css             # Tailwind CSS & cyberpunk dark theme
│   │   ├── layout.tsx              # Root Next.js layout & fonts
│   │   └── page.tsx                # Main booth application & WebSocket orchestrator
│   └── components/
│       ├── AudioVisualizer.tsx     # Dual-channel canvas waveform / frequency visualizer
│       ├── BoothDashboard.tsx      # Co-host dashboard, metrics, logs, & controls
│       ├── CameraPreview.tsx       # Live webcam feed with targeting HUD & crosshairs
│       └── PinAuthModal.tsx        # Booth station access PIN modal
├── .env.example                    # Template for environment variables
├── .env.local                      # Local secrets (GEMINI_API_KEY, BOOTH_PIN)
└── package.json
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: 18.x or 20.x+
- **Google AI Studio API Key**: An API key with access to `models/gemini-3.1-flash-live-preview`.
- **Browser**: Modern Chromium-based browser (Chrome, Edge, Brave) for full `AudioWorklet`, `SpeechRecognition`, and WebRTC support.

### 2. Installation
```bash
git clone <your-repo-url>
cd cpu-livellm-project
npm install
```

### 3. Environment Configuration
Create a `.env.local` file from `.env.example`:
```bash
cp .env.example .env.local
```

Configure your secrets in `.env.local`:
```env
# Server-side only (NEVER expose with NEXT_PUBLIC_)
GEMINI_API_KEY=AIzaSy...your_google_ai_studio_api_key
BOOTH_PIN=4242
```

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Customization & Persona

### Changing the AI System Prompt & Voice
You can customize the AI co-host's personality, system instructions, and voice in **[`src/app/page.tsx`](file:///Users/adamdali/Documents/Code/cpu-livellm-project/src/app/page.tsx)** inside the `setupPayload`:

```typescript
const setupPayload = {
  setup: {
    model: "models/gemini-3.1-flash-live-preview",
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Leda", // Options: "Puck", "Charon", "Kore", "Fenrir", "Aoede", "Leda"
          },
        },
      },
    },
    systemInstruction: {
      parts: [
        {
          text: "Your custom AI co-host persona and booth instructions go here...",
        },
      ],
    },
  },
};
```

### Changing the Access PIN
Update `BOOTH_PIN` in `.env.local` (or in your hosting provider's environment settings):
```env
BOOTH_PIN=your_custom_pin
```

---


