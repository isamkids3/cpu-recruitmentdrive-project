"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { PinAuthModal } from "@/components/PinAuthModal";
import { CameraPreview } from "@/components/CameraPreview";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { BoothDashboard, LogItem } from "@/components/BoothDashboard";
import { AttractScreen } from "@/components/AttractScreen";
import { LevelBriefing } from "@/components/LevelBriefing";
import { GameHUD, GameMessage } from "@/components/GameHUD";
import { ResultOverlay } from "@/components/ResultOverlay";
import { StaffModeModal } from "@/components/StaffModeModal";
import { PUBLIC_LEVELS, PublicLevel } from "@/lib/publicLevels";
import { normalize } from "@/lib/normalize";
import { LeaderboardEntry } from "@/lib/leaderboardStore";
import { GAME_COPY } from "@/lib/copy";
import { COHOST_SYSTEM_PROMPT } from "@/lib/cohostPrompt";
import {
  validateChatInput,
  MAX_MESSAGE_CHARS,
  MIN_MESSAGE_SEND_INTERVAL_MS,
} from "@/lib/textInputGuard";
import {
  Sparkles,
  Shield,
  Bot,
  Users,
  Maximize2,
  Minimize2,
  UserPlus,
  Mic,
  MicOff,
  Power,
  RefreshCw,
  Gamepad2,
  Tv,
  AlertTriangle,
} from "lucide-react";

// Converts an ArrayBuffer or Uint8Array to base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Robust decoder from base64 16-bit PCM little-endian to Float32Array
function decodePcm16ToFloat32(base64Data: string): Float32Array {
  const binaryString = atob(base64Data);
  const numSamples = Math.floor(binaryString.length / 2);
  const float32 = new Float32Array(numSamples);
  const buffer = new ArrayBuffer(binaryString.length);
  const uint8 = new Uint8Array(buffer);
  for (let i = 0; i < binaryString.length; i++) {
    uint8[i] = binaryString.charCodeAt(i);
  }
  const dataView = new DataView(buffer);
  for (let i = 0; i < numSamples; i++) {
    const int16 = dataView.getInt16(i * 2, true); // little-endian
    float32[i] = int16 / 32768.0;
  }
  return float32;
}

// Helper to synthesize a local buzzer sound on Level 5 leak cutoff
function playBuzzerSound(audioCtx: AudioContext) {
  try {
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch {
    // Buzzer synth error handled silently
  }
}

interface ScoreBreakdown {
  base: number;
  timeBonus: number;
  hintPenalty: number;
  total: number;
}

const L5_TRANSCRIPT_GRACE_MS = 300;

export default function Home() {
  const levels = PUBLIC_LEVELS;

  // Session & Authentication
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [boothToken, setBoothToken] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(true);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [mode, setMode] = useState<"game" | "cohost">("game");

  // Push to Talk (Staff setting for Co-host mode)
  const [pushToTalk, setPushToTalk] = useState(false);
  const [isPttActive, setIsPttActive] = useState(false);
  const isPttActiveRef = useRef(false);
  const pushToTalkRef = useRef(false);

  useEffect(() => {
    isPttActiveRef.current = isPttActive;
  }, [isPttActive]);

  useEffect(() => {
    pushToTalkRef.current = pushToTalk;
  }, [pushToTalk]);

  // Staff Game Mode Settings
  const [showGuardText, setShowGuardText] = useState(true);
  const [allowPaste, setAllowPaste] = useState(true);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);

  // Game Mode State Machine
  const [gameState, setGameState] = useState<
    "ATTRACT" | "BRIEFING" | "LIVE" | "CRACKED" | "TIMEOUT" | "LOCKED_OUT"
  >("ATTRACT");
  const [selectedLevelId, setSelectedLevelId] = useState<number>(1);
  const [attemptToken, setAttemptToken] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(150);
  const [guessesRemaining, setGuessesRemaining] = useState(10);
  const [messagesSentCount, setMessagesSentCount] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [gameMessages, setGameMessages] = useState<GameMessage[]>([]);
  const [isSubmittingGuess, setIsSubmittingGuess] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isGuardThinking, setIsGuardThinking] = useState(false);
  const [isStartingLevel, setIsStartingLevel] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    type: "error" | "info" | "warning";
  } | null>(null);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [decoyTripped, setDecoyTripped] = useState(false);
  const [levelsCleared, setLevelsCleared] = useState<number[]>([]);

  // Persistent Player Run Tracking for Leaderboard
  const [playerHandle, setPlayerHandle] = useState<string>("");
  const [accumulatedClaimTokens, setAccumulatedClaimTokens] = useState<string[]>([]);
  const [totalRunPoints, setTotalRunPoints] = useState<number>(0);
  const [isRunSubmitted, setIsRunSubmitted] = useState<boolean>(false);
  const playerHandleRef = useRef<string>("");
  const accumulatedClaimTokensRef = useRef<string[]>([]);
  const totalRunPointsRef = useRef<number>(0);
  const isRunSubmittedRef = useRef<boolean>(false);

  // Connection Error / Recovery Overlay State
  const [connectionErrorOverlay, setConnectionErrorOverlay] = useState<string | null>(null);
  const [micDeviceError, setMicDeviceError] = useState<string | null>(null);

  // Co-Host & Connection States
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [latencyMs, setLatencyMs] = useState(0);
  const [idleTimerSeconds, setIdleTimerSeconds] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isCapturingFrame, setIsCapturingFrame] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Mutable refs
  const isMicMutedRef = useRef(false);
  const isCameraActiveRef = useRef(true);
  const apiKeyRef = useRef<string | null>(null);
  const boothTokenRef = useRef<string | null>(null);
  const isSetupCompleteRef = useRef(false);
  const modeRef = useRef<"game" | "cohost">("game");

  // Dynamic instruction and leak needles from server
  const currentSystemInstructionRef = useRef<string>("");
  const currentOpeningLineRef = useRef<string>("");
  const currentLeakNeedlesRef = useRef<string[]>([]);

  // Output Guard & Buffer Refs
  const accumulatedTurnTextRef = useRef<string>("");
  const suppressAudioUntilTurnEndRef = useRef<boolean>(false);
  const currentGuardMsgIdRef = useRef<string | null>(null);
  const lastSentChatTimeRef = useRef<number>(0);
  const lastGuardAudioChunksRef = useRef<string[]>([]);
  const l5TurnAudioChunksRef = useRef<string[]>([]);
  const l5TurnTranscriptRef = useRef<string>("");

  const currentLevel = levels.find((l) => l.id === selectedLevelId) || levels[0];
  const currentLevelRef = useRef<PublicLevel>(currentLevel);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  useEffect(() => {
    isCameraActiveRef.current = isCameraActive;
  }, [isCameraActive]);

  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  useEffect(() => {
    boothTokenRef.current = boothToken;
  }, [boothToken]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    currentLevelRef.current = currentLevel;
  }, [currentLevel]);

  // Fetch leaderboard preview
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch {
      // Non-critical background fetch
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Media & Web Audio references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const agentAnalyserRef = useRef<AnalyserNode | null>(null);
  const agentGainNodeRef = useRef<GainNode | null>(null);

  // WebSocket and Playback Queue references
  const wsRef = useRef<WebSocket | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextPlayTimeRef = useRef<number>(0);
  const videoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPingTimeRef = useRef<number>(0);
  const lastUserSpeechRef = useRef<{ text: string; time: number }>({ text: "", time: 0 });
  const currentAgentLogIdRef = useRef<string | null>(null);

  // Update Gain Node when Volume / Mute changes
  useEffect(() => {
    if (agentGainNodeRef.current) {
      agentGainNodeRef.current.gain.value = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Ensure AudioContext is initialized and ready on user gesture
  const ensureAudioContextReady = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioContextClass({ sampleRate: 24000 });
        audioContextRef.current = audioCtx;

        const agentAnalyser = audioCtx.createAnalyser();
        agentAnalyser.fftSize = 128;
        agentAnalyserRef.current = agentAnalyser;

        const agentGain = audioCtx.createGain();
        agentGain.gain.value = isMuted ? 0 : volume;
        agentGain.connect(agentAnalyser);
        agentGain.connect(audioCtx.destination);
        agentGainNodeRef.current = agentGain;
      } else if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume();
      }
      return audioContextRef.current;
    } catch {
      return null;
    }
  }, [isMuted, volume]);

  // Helper to add timestamped logs (Co-host)
  const addLog = useCallback((sender: "agent" | "user" | "system", text: string) => {
    if (sender !== "agent") {
      currentAgentLogIdRef.current = null;
    }
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        sender,
        text,
        timestamp: time,
      },
      ...prev.slice(0, 49),
    ]);
  }, []);

  // Helper to append streaming text chunks into agent log (Co-host)
  const appendAgentText = useCallback((chunk: string) => {
    if (!chunk || !chunk.trim()) return;
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    setLogs((prev) => {
      if (
        prev.length > 0 &&
        currentAgentLogIdRef.current &&
        prev[0].id === currentAgentLogIdRef.current &&
        prev[0].sender === "agent"
      ) {
        const existing = prev[0].text;
        const separator =
          existing.endsWith(" ") || chunk.startsWith(" ") || existing === "" ? "" : " ";
        const updatedText = existing + separator + chunk;
        return [{ ...prev[0], text: updatedText, timestamp: time }, ...prev.slice(1)];
      }

      const newId = Math.random().toString(36).substring(2, 9);
      currentAgentLogIdRef.current = newId;
      return [
        {
          id: newId,
          sender: "agent",
          text: chunk.trim(),
          timestamp: time,
        },
        ...prev.slice(0, 49),
      ];
    });
  }, []);

  const resetIdleTimer = useCallback(() => {
    setIdleTimerSeconds(0);
  }, []);

  // Watchdog: reset idle timer on any keystroke or mouse click
  useEffect(() => {
    const handleActivity = () => resetIdleTimer();
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    return () => {
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
    };
  }, [resetIdleTimer]);

  // Stop all active audio playback nodes immediately
  const stopAllPlayingAudio = useCallback(() => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Node already stopped
      }
    });
    activeSourcesRef.current.clear();
    if (audioContextRef.current) {
      nextPlayTimeRef.current = audioContextRef.current.currentTime;
    }
    setIsAgentSpeaking(false);
  }, []);

  // Direct Audio Playback Execution (24kHz Web Audio)
  const playAudioChunkImmediately = useCallback(
    (base64Data: string) => {
      if (suppressAudioUntilTurnEndRef.current) return;
      const audioCtx = ensureAudioContextReady();
      if (!audioCtx) return;

      try {
        const float32Array = decodePcm16ToFloat32(base64Data);
        if (float32Array.length === 0) return;

        const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
        audioBuffer.getChannelData(0).set(float32Array);

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;

        if (agentGainNodeRef.current) {
          source.connect(agentGainNodeRef.current);
        } else {
          source.connect(audioCtx.destination);
        }

        const currentTime = audioCtx.currentTime;
        const startTime = Math.max(currentTime, nextPlayTimeRef.current);
        source.start(startTime);
        nextPlayTimeRef.current = startTime + audioBuffer.duration;

        activeSourcesRef.current.add(source);
        setIsAgentSpeaking(true);

        source.onended = () => {
          activeSourcesRef.current.delete(source);
          if (activeSourcesRef.current.size === 0) {
            setIsAgentSpeaking(false);
          }
        };
      } catch {
        // Audio decode error handled silently
      }
    },
    [ensureAudioContextReady]
  );

  // Queue Audio Playback
  const queueAudioPlayback = useCallback(
    (base64Data: string) => {
      if (suppressAudioUntilTurnEndRef.current) return;
      playAudioChunkImmediately(base64Data);
    },
    [playAudioChunkImmediately]
  );

  // Initialize Camera stream explicitly (Co-host mode only)
  const initCamera = useCallback(async () => {
    if (cameraStreamRef.current) return cameraStreamRef.current;
    try {
      const vStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });
      cameraStreamRef.current = vStream;
      setCameraStream(vStream);
      if (videoRef.current) {
        videoRef.current.srcObject = vStream;
        videoRef.current.play().catch(() => {});
      }
      setCameraError(null);
      return vStream;
    } catch {
      setCameraError("Camera permission denied or unavailable.");
      return null;
    }
  }, []);

  // Initialize Microphone and Web Audio (Strict 16kHz & Noise Suppression - Co-host only)
  const initAudioStream = useCallback(async () => {
    if (audioContextRef.current && micStreamRef.current) return true;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      const audioCtx = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const micAnalyser = audioCtx.createAnalyser();
      micAnalyser.fftSize = 128;
      micAnalyserRef.current = micAnalyser;

      const agentAnalyser = audioCtx.createAnalyser();
      agentAnalyser.fftSize = 128;
      agentAnalyserRef.current = agentAnalyser;

      const agentGain = audioCtx.createGain();
      agentGain.gain.value = 1.0;
      agentGain.connect(agentAnalyser);
      agentGain.connect(audioCtx.destination);
      agentGainNodeRef.current = agentGain;

      await audioCtx.audioWorklet.addModule("/audio-worklet-processor.js");

      // Strict browser audio constraints to prevent hall murmur hallucinations
      const aStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = aStream;
      setMicDeviceError(null);

      const micSource = audioCtx.createMediaStreamSource(aStream);
      micSource.connect(micAnalyser);

      const workletNode = new AudioWorkletNode(audioCtx, "audio-recorder-worklet");
      micSource.connect(workletNode);

      const silentSink = audioCtx.createGain();
      silentSink.gain.value = 0;
      workletNode.connect(silentSink);
      silentSink.connect(audioCtx.destination);
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (
          !wsRef.current ||
          wsRef.current.readyState !== WebSocket.OPEN ||
          !isSetupCompleteRef.current ||
          isMicMutedRef.current
        ) {
          return;
        }

        // Push-to-Talk hardware gate
        if (pushToTalkRef.current && !isPttActiveRef.current) {
          return;
        }

        const base64Audio = arrayBufferToBase64(event.data);
        const payload = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: "audio/pcm;rate=16000",
                data: base64Audio,
              },
            ],
          },
        };

        try {
          wsRef.current.send(JSON.stringify(payload));
        } catch {
          // Socket write error handled silently
        }
      };

      return true;
    } catch {
      setMicDeviceError(GAME_COPY.micPermissionError);
      return false;
    }
  }, []);

  // Start 1 FPS Video Capture loop (Co-host only)
  const startVideoFrameCapture = useCallback(() => {
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
    }

    if (!offscreenCanvasRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      offscreenCanvasRef.current = canvas;
    }

    videoIntervalRef.current = setInterval(() => {
      if (
        !wsRef.current ||
        wsRef.current.readyState !== WebSocket.OPEN ||
        !isSetupCompleteRef.current ||
        !videoRef.current ||
        !isCameraActiveRef.current ||
        videoRef.current.readyState < 2
      ) {
        return;
      }

      const canvas = offscreenCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      try {
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
        const base64Jpeg = dataUrl.split(",")[1];

        if (base64Jpeg) {
          const payload = {
            realtimeInput: {
              video: {
                mimeType: "image/jpeg",
                data: base64Jpeg,
              },
            },
          };
          wsRef.current.send(JSON.stringify(payload));
          setIsCapturingFrame(true);
          setTimeout(() => setIsCapturingFrame(false), 200);
        }
      } catch {
        // Frame capture error handled silently
      }
    }, 1000);
  }, []);

  // Connect WebSocket to Gemini Live
  const connectWebSocket = useCallback(
    async (activeApiKey: string, customSystemPrompt?: string, openingLine?: string) => {
      if (!activeApiKey || activeApiKey.trim() === "") {
        addLog("system", "Cannot connect: API key missing.");
        setConnectionStatus("error");
        setConnectionErrorOverlay("Cannot connect: API key missing.");
        return;
      }

      isSetupCompleteRef.current = false;
      suppressAudioUntilTurnEndRef.current = false;
      accumulatedTurnTextRef.current = "";
      setConnectionStatus("connecting");
      setConnectionErrorOverlay(null);

      // In Co-host mode, initialize mic & camera
      if (modeRef.current === "cohost") {
        const micOk = await initAudioStream();
        if (!micOk) {
          setConnectionStatus("error");
          return;
        }
        await initCamera();
      } else {
        // In Game mode, ensure Web Audio output is initialized (no mic!)
        ensureAudioContextReady();
      }

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(
        activeApiKey.trim()
      )}`;

      try {
        if (wsRef.current) {
          const prevWs = wsRef.current;
          wsRef.current = null;
          prevWs.close(1000, "Reconnecting");
        }

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        lastPingTimeRef.current = performance.now();

        const activeMode = modeRef.current;
        const promptText = customSystemPrompt || COHOST_SYSTEM_PROMPT;

        ws.onopen = () => {
          if (wsRef.current !== ws) return;
          const connectLatency = Math.round(performance.now() - lastPingTimeRef.current);
          setLatencyMs(connectLatency);

          const voiceName = currentLevelRef.current.voice || "Puck";

          const setupPayload = {
            setup: {
              model: "models/gemini-3.1-flash-live-preview",
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: activeMode === "cohost" ? "Puck" : voiceName,
                    },
                  },
                },
              },
              systemInstruction: {
                parts: [
                  {
                    text: promptText,
                  },
                ],
              },
              outputAudioTranscription: {},
            },
          };

          ws.send(JSON.stringify(setupPayload));
        };

        ws.onmessage = async (event: MessageEvent) => {
          if (wsRef.current !== ws) return;
          try {
            let messageText = "";
            if (event.data instanceof Blob) {
              messageText = await event.data.text();
            } else {
              messageText = event.data;
            }

            const data = JSON.parse(messageText);

            // 1. Setup Complete
            if (data.setupComplete) {
              isSetupCompleteRef.current = true;
              setConnectionStatus("connected");

              if (activeMode === "cohost") {
                addLog("system", "✅ Gemini Live setup confirmed! Vision & mic active.");
                startVideoFrameCapture();
              } else if (activeMode === "game") {
                if (openingLine) {
                  // Opening line is sent as realtimeInput.text
                  const openingPayload = {
                    realtimeInput: {
                      text: openingLine,
                    },
                  };
                  ws.send(JSON.stringify(openingPayload));
                }
              }
              return;
            }

            // 2. Server Error
            if (data.error) {
              const errMsg = data.error.message || JSON.stringify(data.error);
              addLog("system", `Server Error: ${errMsg}`);
              if (activeMode === "game" && gameState === "LIVE") {
                setConnectionErrorOverlay(GAME_COPY.connectionLostMsg);
              }
              return;
            }

            // 3. Interruption / Barge-in
            if (data.serverContent?.interrupted) {
              stopAllPlayingAudio();
              suppressAudioUntilTurnEndRef.current = false;
              accumulatedTurnTextRef.current = "";
              currentAgentLogIdRef.current = null;
              currentGuardMsgIdRef.current = null;
              l5TurnAudioChunksRef.current = [];
              l5TurnTranscriptRef.current = "";
              setIsGuardThinking(false);
              setIsSendingChat(false);
              if (activeMode === "cohost") {
                addLog("system", "⚡ Interruption detected (barge-in): playback cleared.");
              }
            }

            // 4. Model Turn: Process EVERY part
            if (data.serverContent?.modelTurn?.parts) {
              for (const part of data.serverContent.modelTurn.parts) {
                // Text check
                if (part.text && part.text.trim()) {
                  if (activeMode === "cohost") {
                    appendAgentText(part.text);
                  } else {
                    const lvl = currentLevelRef.current;
                    if (lvl.id === 5) {
                      l5TurnTranscriptRef.current += part.text;
                      setIsGuardThinking(true);
                    } else {
                      accumulatedTurnTextRef.current += " " + part.text;
                      const normalizedAccum = normalize(accumulatedTurnTextRef.current);
                      const isLeak = currentLeakNeedlesRef.current.some(
                        (needle) => needle && normalizedAccum.includes(needle)
                      );

                      setGameMessages((prev) => {
                        if (
                          prev.length > 0 &&
                          currentGuardMsgIdRef.current &&
                          prev[prev.length - 1].id === currentGuardMsgIdRef.current &&
                          prev[prev.length - 1].sender === "guard"
                        ) {
                          const lastIdx = prev.length - 1;
                          const existing = prev[lastIdx].text;
                          const separator =
                            existing.endsWith(" ") || part.text.startsWith(" ") || existing === "" ? "" : " ";
                          const updated = [...prev];
                          updated[lastIdx] = {
                            ...updated[lastIdx],
                            text: existing + separator + part.text,
                            isLeak: updated[lastIdx].isLeak || isLeak,
                          };
                          return updated;
                        }

                        const newId = Math.random().toString(36).substring(2, 9);
                        currentGuardMsgIdRef.current = newId;
                        return [
                          ...prev,
                          {
                            id: newId,
                            sender: "guard",
                            text: part.text.trim(),
                            isLeak,
                          },
                        ];
                      });
                    }
                  }
                  resetIdleTimer();
                }

                // Audio check
                const audioData = part.data || part.inlineData?.data;
                const mime = part.mimeType || part.inlineData?.mimeType;

                if (mime && mime.startsWith("audio/pcm") && audioData) {
                  if (activeMode === "cohost") {
                    queueAudioPlayback(audioData);
                  } else {
                    const lvl = currentLevelRef.current;
                    if (lvl.id === 5) {
                      l5TurnAudioChunksRef.current.push(audioData);
                      setIsGuardThinking(true);
                    } else {
                      lastGuardAudioChunksRef.current.push(audioData);
                      playAudioChunkImmediately(audioData);
                    }
                  }
                  resetIdleTimer();
                }
              }
            }

            // 5. Server Output Transcriptions
            const serverOutText = data.serverContent?.outputTranscription?.text;
            if (serverOutText && typeof serverOutText === "string" && serverOutText.trim()) {
              if (activeMode === "cohost") {
                appendAgentText(serverOutText);
              } else {
                const lvl = currentLevelRef.current;
                if (lvl.id === 5) {
                  l5TurnTranscriptRef.current += " " + serverOutText;
                  setIsGuardThinking(true);
                } else {
                  accumulatedTurnTextRef.current += " " + serverOutText;
                  const normalizedAccum = normalize(accumulatedTurnTextRef.current);
                  const isLeak = currentLeakNeedlesRef.current.some(
                    (needle) => needle && normalizedAccum.includes(needle)
                  );

                  setGameMessages((prev) => {
                    if (
                      prev.length > 0 &&
                      currentGuardMsgIdRef.current &&
                      prev[prev.length - 1].id === currentGuardMsgIdRef.current &&
                      prev[prev.length - 1].sender === "guard"
                    ) {
                      const lastIdx = prev.length - 1;
                      const existing = prev[lastIdx].text;
                      const separator =
                        existing.endsWith(" ") || serverOutText.startsWith(" ") || existing === "" ? "" : " ";
                      const updated = [...prev];
                      updated[lastIdx] = {
                        ...updated[lastIdx],
                        text: existing + separator + serverOutText,
                        isLeak: updated[lastIdx].isLeak || isLeak,
                      };
                      return updated;
                    }

                    const newId = Math.random().toString(36).substring(2, 9);
                    currentGuardMsgIdRef.current = newId;
                    return [
                      ...prev,
                      {
                        id: newId,
                        sender: "guard",
                        text: serverOutText.trim(),
                        isLeak,
                      },
                    ];
                  });
                }
              }
              resetIdleTimer();
            }

            // 6. Turn Complete / Generation Complete
            if (data.serverContent?.turnComplete || data.serverContent?.generationComplete) {
              if (activeMode === "cohost") {
                currentAgentLogIdRef.current = null;
              } else if (activeMode === "game") {
                const lvl = currentLevelRef.current;
                if (lvl.id === 5) {
                  // L5: Evaluate full turn transcript at turn completion with grace timeout
                  setTimeout(() => {
                    const fullTranscript = l5TurnTranscriptRef.current;
                    const normalized = normalize(fullTranscript);
                    const isLeak = currentLeakNeedlesRef.current.some(
                      (n) => n && normalized.includes(n)
                    );

                    setIsGuardThinking(false);
                    setIsSendingChat(false);

                    if (isLeak) {
                      // Discard held audio and transcript, play buzzer sound
                      l5TurnAudioChunksRef.current = [];
                      l5TurnTranscriptRef.current = "";

                      if (audioContextRef.current) {
                        playBuzzerSound(audioContextRef.current);
                      }

                      setGameMessages((prev) => [
                        ...prev,
                        {
                          id: Math.random().toString(36).substring(2, 9),
                          sender: "guard",
                          text: GAME_COPY.accessDeniedBubble,
                          isCut: true,
                        },
                      ]);
                    } else {
                      // Clean: reveal transcript and play buffered audio
                      if (fullTranscript.trim()) {
                        setGameMessages((prev) => [
                          ...prev,
                          {
                            id: Math.random().toString(36).substring(2, 9),
                            sender: "guard",
                            text: fullTranscript.trim(),
                          },
                        ]);
                      }

                      lastGuardAudioChunksRef.current = [...l5TurnAudioChunksRef.current];
                      for (const chunk of l5TurnAudioChunksRef.current) {
                        playAudioChunkImmediately(chunk);
                      }
                      l5TurnAudioChunksRef.current = [];
                      l5TurnTranscriptRef.current = "";
                    }
                  }, L5_TRANSCRIPT_GRACE_MS);
                } else {
                  currentGuardMsgIdRef.current = null;
                  accumulatedTurnTextRef.current = "";
                  setIsSendingChat(false);
                  setIsGuardThinking(false);
                }
              }
            }
          } catch {
            // Live message parsing error handled safely
          }
        };

        ws.onclose = (event) => {
          if (wsRef.current === ws) {
            isSetupCompleteRef.current = false;
            setConnectionStatus("disconnected");
            currentAgentLogIdRef.current = null;
            currentGuardMsgIdRef.current = null;
            accumulatedTurnTextRef.current = "";
            suppressAudioUntilTurnEndRef.current = false;

            if (videoIntervalRef.current) {
              clearInterval(videoIntervalRef.current);
            }

            if (event.code !== 1000) {
              if (activeMode === "game" && gameState === "LIVE") {
                setConnectionErrorOverlay(GAME_COPY.connectionLostMsg);
              }
            }
          }
        };

        ws.onerror = () => {
          if (wsRef.current === ws) {
            setConnectionStatus("error");
            if (activeMode === "game" && gameState === "LIVE") {
              setConnectionErrorOverlay(GAME_COPY.connectionLostMsg);
            }
          }
        };
      } catch {
        setConnectionStatus("error");
        if (modeRef.current === "game" && gameState === "LIVE") {
          setConnectionErrorOverlay(GAME_COPY.connectionLostMsg);
        }
      }
    },
    [
      addLog,
      appendAgentText,
      initAudioStream,
      initCamera,
      ensureAudioContextReady,
      playAudioChunkImmediately,
      queueAudioPlayback,
      resetIdleTimer,
      startVideoFrameCapture,
      stopAllPlayingAudio,
      gameState,
    ]
  );

  // Close active connection
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      const activeWs = wsRef.current;
      wsRef.current = null;
      activeWs.close(1000, "Disconnect requested");
    }
    stopAllPlayingAudio();
    setConnectionStatus("disconnected");
  }, [stopAllPlayingAudio]);

  // Finalize & Submit Full Run to Leaderboard
  const finalizeRunScore = useCallback(
    async (tokensToSubmit?: string[], handleToUse?: string) => {
      const tokens = tokensToSubmit || accumulatedClaimTokensRef.current;
      const handle = (handleToUse || playerHandleRef.current || "").trim();

      if (tokens.length === 0 || !handle || isRunSubmittedRef.current) return;

      try {
        const res = await fetch("/api/leaderboard", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${boothTokenRef.current || ""}`,
          },
          body: JSON.stringify({
            claimTokens: tokens,
            handle,
          }),
        });
        if (res.ok) {
          setIsRunSubmitted(true);
          isRunSubmittedRef.current = true;
          fetchLeaderboard();
        }
      } catch {
        // Run score submission error handled silently
      }
    },
    [fetchLeaderboard]
  );

  // Game Mode: Start Level Sequence
  const handleStartLevel = useCallback(
    async (levelNumber: number, handleOverride?: string) => {
      if (isStartingLevel) return;
      setIsStartingLevel(true);

      ensureAudioContextReady();

      if (levelNumber === 1 || handleOverride) {
        const activeHandle = (handleOverride || playerHandleRef.current || "").trim() || "Anonymous";
        setPlayerHandle(activeHandle);
        playerHandleRef.current = activeHandle;
        setAccumulatedClaimTokens([]);
        accumulatedClaimTokensRef.current = [];
        setTotalRunPoints(0);
        totalRunPointsRef.current = 0;
        setLevelsCleared([]);
        setIsRunSubmitted(false);
        isRunSubmittedRef.current = false;
      }

      const lvl = levels.find((l) => l.id === levelNumber) || levels[0];
      setSelectedLevelId(lvl.id);
      setGameState("BRIEFING");
      setGameMessages([]);
      setMessagesSentCount(0);
      setFeedbackMessage(null);
      setHintText(null);
      setHintUsed(false);
      setClaimToken(null);
      setScoreBreakdown(null);
      setDecoyTripped(false);
      setConnectionErrorOverlay(null);
      setIsSendingChat(false);
      setIsGuardThinking(false);

      try {
        const res = await fetch("/api/game/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${boothTokenRef.current || ""}`,
          },
          body: JSON.stringify({
            level: lvl.id,
            boothToken: boothTokenRef.current,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setAttemptToken(data.attemptToken);
          currentSystemInstructionRef.current = data.systemInstruction || "";
          currentOpeningLineRef.current = data.openingLine || "";
          currentLeakNeedlesRef.current = data.leakNeedles || [];
          setTimeLeft(data.level?.timeLimitSec || lvl.timeLimitSec);
          setGuessesRemaining(data.level?.maxGuesses || lvl.maxGuesses);
        } else {
          setTimeLeft(lvl.timeLimitSec);
          setGuessesRemaining(lvl.maxGuesses);
        }
      } catch {
        setTimeLeft(lvl.timeLimitSec);
        setGuessesRemaining(lvl.maxGuesses);
        setConnectionErrorOverlay(GAME_COPY.connectionLostMsg);
      } finally {
        setIsStartingLevel(false);
      }
    },
    [isStartingLevel, levels, ensureAudioContextReady]
  );

  // Briefing countdown finished -> Go LIVE
  const handleBriefingComplete = useCallback(() => {
    setGameState("LIVE");
    if (apiKeyRef.current) {
      connectWebSocket(
        apiKeyRef.current,
        currentSystemInstructionRef.current,
        currentOpeningLineRef.current
      );
    }
  }, [connectWebSocket]);

  // In-Game Live Countdown Timer
  useEffect(() => {
    if (gameState !== "LIVE" || connectionErrorOverlay) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          disconnectWebSocket();
          setGameState("TIMEOUT");
          finalizeRunScore();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, disconnectWebSocket, connectionErrorOverlay, finalizeRunScore]);

  // 90s Idle Watchdog (Returns to ATTRACT in Game mode, resets session in Co-host mode)
  useEffect(() => {
    const timer = setInterval(() => {
      if (mode === "game" && gameState !== "ATTRACT") {
        setIdleTimerSeconds((prev) => {
          const next = prev + 1;
          if (next >= 90) {
            disconnectWebSocket();
            setGameState("ATTRACT");
            fetchLeaderboard();
            return 0;
          }
          return next;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [disconnectWebSocket, fetchLeaderboard, gameState, mode]);

  // Auto-return to ATTRACT after 20s if connection error overlay is active
  useEffect(() => {
    if (!connectionErrorOverlay) return;
    const timeout = setTimeout(() => {
      setConnectionErrorOverlay(null);
      disconnectWebSocket();
      setGameState("ATTRACT");
    }, 20000);
    return () => clearTimeout(timeout);
  }, [connectionErrorOverlay, disconnectWebSocket]);

  // Handle Typed Chat Message from Visitor
  const handleSendChat = useCallback(
    (text: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (isSendingChat || isAgentSpeaking || isGuardThinking) return;

      const now = Date.now();
      if (now - lastSentChatTimeRef.current < MIN_MESSAGE_SEND_INTERVAL_MS) {
        return;
      }
      lastSentChatTimeRef.current = now;

      // Validate & normalize
      const validation = validateChatInput(text, MAX_MESSAGE_CHARS);
      if (!validation.valid) return;

      const normalized = validation.normalized;

      // Add visitor message to log
      const visitorMsgId = Math.random().toString(36).substring(2, 9);
      setGameMessages((prev) => [
        ...prev,
        {
          id: visitorMsgId,
          sender: "visitor",
          text: normalized,
        },
      ]);

      setMessagesSentCount((prev) => prev + 1);
      setIsSendingChat(true);

      // Reset turn accumulation buffers
      currentGuardMsgIdRef.current = null;
      accumulatedTurnTextRef.current = "";
      l5TurnAudioChunksRef.current = [];
      l5TurnTranscriptRef.current = "";
      lastGuardAudioChunksRef.current = [];

      if (currentLevelRef.current.id === 5) {
        setIsGuardThinking(true);
      }

      // Send to Gemini Live WebSocket as realtimeInput.text
      const payload = {
        realtimeInput: {
          text: normalized,
        },
      };
      wsRef.current.send(JSON.stringify(payload));
    },
    [isSendingChat, isAgentSpeaking, isGuardThinking]
  );

  // Skip Voice (Stop current spoken turn playback without removing text)
  const handleSkipVoice = useCallback(() => {
    stopAllPlayingAudio();
    setIsAgentSpeaking(false);
  }, [stopAllPlayingAudio]);

  // Replay Voice (Replay last spoken turn from PCM buffer)
  const handleReplayVoice = useCallback(() => {
    if (isAgentSpeaking || isGuardThinking || lastGuardAudioChunksRef.current.length === 0) return;
    stopAllPlayingAudio();
    const audioCtx = ensureAudioContextReady();
    if (!audioCtx) return;

    for (const base64Chunk of lastGuardAudioChunksRef.current) {
      playAudioChunkImmediately(base64Chunk);
    }
  }, [isAgentSpeaking, isGuardThinking, stopAllPlayingAudio, ensureAudioContextReady, playAudioChunkImmediately]);

  // Submit Passcode Guess
  const handleGuess = useCallback(
    async (guess: string) => {
      if (!attemptToken || isSubmittingGuess) return;
      setIsSubmittingGuess(true);
      setFeedbackMessage(null);

      try {
        const res = await fetch("/api/game/guess", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${boothTokenRef.current || ""}`,
          },
          body: JSON.stringify({
            attemptToken,
            guess,
          }),
        });

        const data = await res.json();

        if (res.ok && data.correct) {
          disconnectWebSocket();
          setClaimToken(data.claimToken);
          const pts = data.scoreBreakdown?.totalScore || data.pointsAwarded || 0;
          setAccumulatedClaimTokens((prev) => {
            const next = [...prev, data.claimToken];
            accumulatedClaimTokensRef.current = next;
            return next;
          });
          setTotalRunPoints((prev) => {
            const next = prev + pts;
            totalRunPointsRef.current = next;
            return next;
          });
          setLevelsCleared((prev) =>
            prev.includes(selectedLevelId) ? prev : [...prev, selectedLevelId]
          );
          setScoreBreakdown({
            base: data.scoreBreakdown?.baseScore || 0,
            timeBonus: data.scoreBreakdown?.timeBonus || 0,
            hintPenalty: data.scoreBreakdown?.hintPenalty || 0,
            total: pts,
          });
          setGameState("CRACKED");
        } else {
          const remaining =
            typeof data.guessesRemaining === "number"
              ? data.guessesRemaining
              : guessesRemaining - 1;
          setGuessesRemaining(remaining);

          if (data.decoy) {
            setDecoyTripped(true);
            setFeedbackMessage({
              text: GAME_COPY.decoyGuessed,
              type: "warning",
            });
          } else {
            setFeedbackMessage({
              text: data.message || "Incorrect passcode.",
              type: "error",
            });
          }

          if (remaining <= 0 || data.lockedOut) {
            disconnectWebSocket();
            setGameState("LOCKED_OUT");
            finalizeRunScore();
          }
        }
      } catch {
        setFeedbackMessage({
          text: "Network error submitting guess.",
          type: "error",
        });
      } finally {
        setIsSubmittingGuess(false);
      }
    },
    [attemptToken, isSubmittingGuess, disconnectWebSocket, guessesRemaining, selectedLevelId, finalizeRunScore]
  );

  // Request Guard Hint
  const handleRequestHint = useCallback(async () => {
    if (!attemptToken) return;
    try {
      const res = await fetch("/api/game/hint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${boothTokenRef.current || ""}`,
        },
        body: JSON.stringify({ attemptToken }),
      });
      if (res.ok) {
        const data = await res.json();
        setHintText(data.hint);
        setHintUsed(true);
      }
    } catch {
      // Hint error handled silently
    }
  }, [attemptToken]);

  // Quit / End Run
  const handleQuitGame = useCallback(async () => {
    disconnectWebSocket();
    if (accumulatedClaimTokensRef.current.length > 0 && !isRunSubmittedRef.current) {
      await finalizeRunScore();
    }
    fetchLeaderboard();
    setGameState("ATTRACT");
  }, [disconnectWebSocket, fetchLeaderboard, finalizeRunScore]);

  // Next level flow
  const handleNextLevel = useCallback(() => {
    if (selectedLevelId < 5) {
      handleStartLevel(selectedLevelId + 1);
    } else {
      handleQuitGame();
    }
  }, [selectedLevelId, handleStartLevel, handleQuitGame]);

  // Retry level flow
  const handleRetryLevel = useCallback(() => {
    // Retry starts fresh run from Level 1
    handleStartLevel(1, playerHandleRef.current);
  }, [handleStartLevel]);

  // Fullscreen Handlers
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // -------------------------------------------------------------
  // GAME MODE VIEWS
  // -------------------------------------------------------------
  if (mode === "game") {
    return (
      <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-between p-4 md:p-6 relative overflow-hidden font-sans select-none">
        {/* Ambient background glows */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

        {/* Top Header Bar */}
        <header className="w-full max-w-5xl flex items-center justify-between pb-4 border-b border-neutral-800 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg shadow-[0_0_20px_rgba(6,182,212,0.2)]">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black text-white tracking-tight">
                  VAULT-9: {GAME_COPY.title.toUpperCase()}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                  TEXT IN • VOICE OUT
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono">
                AI Persuasion Challenge • Gemini 3.1 Flash Live
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/leaderboard"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-cyan-500/40 text-neutral-300 hover:text-cyan-300 text-xs font-mono font-semibold transition-all flex items-center gap-1.5"
            >
              <Tv className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Leaderboard</span>
            </a>
          </div>
        </header>

        {/* Dynamic Game View */}
        <div className="w-full max-w-5xl flex-1 flex flex-col justify-center items-center relative z-10 my-4">
          {gameState === "ATTRACT" && (
            <AttractScreen
              onStartGame={(handle) => handleStartLevel(1, handle)}
              leaderboard={leaderboard}
              initialHandle={playerHandle}
              onOpenStaffModal={() => setIsStaffModalOpen(true)}
              isStarting={isStartingLevel}
            />
          )}

          {gameState === "BRIEFING" && (
            <LevelBriefing
              level={currentLevel}
              onComplete={handleBriefingComplete}
            />
          )}

          {gameState === "LIVE" && (
            <GameHUD
              level={currentLevel}
              timeLeft={timeLeft}
              totalTime={currentLevel.timeLimitSec}
              guessesRemaining={guessesRemaining}
              maxGuesses={currentLevel.maxGuesses}
              messagesSentCount={messagesSentCount}
              maxMessages={currentLevel.maxMessages || 30}
              hintUsed={hintUsed}
              hintText={hintText}
              messages={gameMessages}
              isSubmittingGuess={isSubmittingGuess}
              isSendingChat={isSendingChat}
              isGuardSpeaking={isAgentSpeaking}
              isGuardThinking={isGuardThinking}
              showGuardText={showGuardText}
              allowPaste={allowPaste}
              volume={volume}
              isMuted={isMuted}
              feedbackMessage={feedbackMessage}
              onSendChat={handleSendChat}
              onGuess={handleGuess}
              onRequestHint={handleRequestHint}
              onSkipVoice={handleSkipVoice}
              onReplayVoice={handleReplayVoice}
              onVolumeChange={setVolume}
              onToggleMute={() => setIsMuted((prev) => !prev)}
              onQuit={handleQuitGame}
            />
          )}

          {(gameState === "CRACKED" ||
            gameState === "TIMEOUT" ||
            gameState === "LOCKED_OUT") && (
            <ResultOverlay
              status={gameState}
              level={currentLevel}
              scoreBreakdown={scoreBreakdown || undefined}
              claimToken={claimToken || undefined}
              decoyTripped={decoyTripped}
              levelsClearedCount={levelsCleared.length}
              playerHandle={playerHandle}
              totalRunPoints={totalRunPoints}
              isRunSubmitted={isRunSubmitted}
              onNextLevel={
                selectedLevelId < 5 ? handleNextLevel : undefined
              }
              onRetry={handleRetryLevel}
              onBackToMenu={handleQuitGame}
            />
          )}
        </div>

        {/* Failure Recovery Overlay */}
        {connectionErrorOverlay && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 max-w-md w-full text-center shadow-2xl animate-in zoom-in-95">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4 text-2xl">
                ⚠️
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                {GAME_COPY.connectionLostTitle}
              </h2>
              <p className="text-sm text-neutral-300 mb-6">
                {connectionErrorOverlay}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleRetryLevel}
                  className="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider"
                >
                  {GAME_COPY.buttons.tryAgain}
                </button>
                <button
                  onClick={handleQuitGame}
                  className="px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-wider"
                >
                  {GAME_COPY.buttons.finish}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Auth PIN Modal */}
        <PinAuthModal
          isOpen={isAuthModalOpen}
          onAuthenticated={(obtainedApiKey: string, token?: string) => {
            setApiKey(obtainedApiKey);
            if (token) setBoothToken(token);
            setIsAuthModalOpen(false);
          }}
        />

        {/* Staff Mode & Settings Modal */}
        {isStaffModalOpen && (
          <StaffModeModal
            currentMode={mode}
            pushToTalk={pushToTalk}
            onTogglePushToTalk={setPushToTalk}
            showGuardText={showGuardText}
            onToggleShowGuardText={setShowGuardText}
            allowPaste={allowPaste}
            onToggleAllowPaste={setAllowPaste}
            onSelectMode={(newMode) => {
              disconnectWebSocket();
              setGameState("ATTRACT");
              setMode(newMode);
              setIsStaffModalOpen(false);
            }}
            onClose={() => setIsStaffModalOpen(false)}
          />
        )}
      </main>
    );
  }

  // -------------------------------------------------------------
  // CO-HOST MULTIMODAL CAMERA & VISION VIEW
  // -------------------------------------------------------------
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-4 md:p-6 relative overflow-hidden font-sans select-none">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-6xl flex items-center justify-between pb-4 border-b border-slate-800 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-lg shadow-[0_0_20px_rgba(168,85,247,0.2)]">
            🎙️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-black text-white tracking-tight">
                CPU AI CO-HOST
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 border border-purple-500/30 text-purple-300">
                MULTIMODAL VISION
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Live Booth Companion • Gemini 3.1 Flash Live
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsStaffModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-all"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Staff Controls</span>
          </button>
        </div>
      </header>

      {/* Main Co-host Dashboard */}
      <div className="w-full max-w-6xl flex-1 flex flex-col md:flex-row gap-4 my-4 relative z-10">
        {/* Left: Camera View & Audio Visualizer */}
        <div className="flex-1 flex flex-col gap-4">
          <CameraPreview
            videoRef={videoRef}
            stream={cameraStream}
            isLive={connectionStatus === "connected"}
            isCapturingFrame={isCapturingFrame}
            error={cameraError}
            cameraActive={isCameraActive}
            onToggleCamera={() => setIsCameraActive((prev) => !prev)}
            className="flex-1 min-h-[300px]"
          />

          <AudioVisualizer
            micAnalyser={micAnalyserRef.current}
            agentAnalyser={agentAnalyserRef.current}
            isAgentSpeaking={isAgentSpeaking}
            isUserSpeaking={isUserSpeaking}
            isMicMuted={isMicMuted}
            isConnected={connectionStatus === "connected"}
          />
        </div>

        {/* Right: Co-Host Controls & Live Banter Log */}
        <div className="w-full md:w-96 flex flex-col">
          <BoothDashboard
            connectionStatus={connectionStatus}
            latencyMs={latencyMs}
            idleTimerSeconds={idleTimerSeconds}
            logs={logs}
            isMicMuted={isMicMuted}
            isCameraActive={isCameraActive}
            onToggleConnection={() => {
              if (connectionStatus === "connected") {
                disconnectWebSocket();
              } else if (apiKeyRef.current) {
                connectWebSocket(apiKeyRef.current);
              } else {
                setIsAuthModalOpen(true);
              }
            }}
            onToggleMic={() => setIsMicMuted((prev) => !prev)}
            onToggleCamera={() => setIsCameraActive((prev) => !prev)}
            onResetConversation={() => {
              disconnectWebSocket();
              if (apiKeyRef.current) {
                setTimeout(() => connectWebSocket(apiKeyRef.current!), 300);
              }
            }}
            onLockSession={() => {
              disconnectWebSocket();
              setApiKey(null);
              sessionStorage.removeItem("booth_pin");
              setIsAuthModalOpen(true);
            }}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
        </div>
      </div>

      {/* Auth PIN Modal */}
      <PinAuthModal
        isOpen={isAuthModalOpen}
        onAuthenticated={(obtainedApiKey: string, token?: string) => {
          setApiKey(obtainedApiKey);
          if (token) setBoothToken(token);
          setIsAuthModalOpen(false);
          connectWebSocket(obtainedApiKey);
        }}
      />

      {/* Staff Mode Modal */}
      {isStaffModalOpen && (
        <StaffModeModal
          currentMode={mode}
          pushToTalk={pushToTalk}
          onTogglePushToTalk={setPushToTalk}
          showGuardText={showGuardText}
          onToggleShowGuardText={setShowGuardText}
          allowPaste={allowPaste}
          onToggleAllowPaste={setAllowPaste}
          onSelectMode={(newMode) => {
            disconnectWebSocket();
            setMode(newMode);
            setIsStaffModalOpen(false);
          }}
          onClose={() => setIsStaffModalOpen(false)}
        />
      )}
    </main>
  );
}
