"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { PinAuthModal } from "@/components/PinAuthModal";
import { CameraPreview } from "@/components/CameraPreview";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { BoothDashboard, LogItem } from "@/components/BoothDashboard";
import {
  Sparkles,
  Shield,
  Zap,
  Bot,
  Users,
  Maximize2,
  Minimize2,
  UserPlus,
  Mic,
  MicOff,
  Power,
  RefreshCw,
  Lock,
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

export default function Home() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(true);
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

  // Refs for tracking mutable states across async intervals/callbacks without re-triggering hooks
  const isMicMutedRef = useRef(false);
  const isCameraActiveRef = useRef(true);
  const apiKeyRef = useRef<string | null>(null);
  const isSetupCompleteRef = useRef(false);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  useEffect(() => {
    isCameraActiveRef.current = isCameraActive;
  }, [isCameraActive]);

  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

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

  // Helper to append streaming text chunks into a single unified agent chat bubble
  const appendAgentText = useCallback((chunk: string) => {
    if (!chunk || !chunk.trim()) return;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    setLogs((prev) => {
      // If the top bubble is the current active agent bubble, append to it
      if (
        prev.length > 0 &&
        currentAgentLogIdRef.current &&
        prev[0].id === currentAgentLogIdRef.current &&
        prev[0].sender === "agent"
      ) {
        const existing = prev[0].text;
        const separator = existing.endsWith(" ") || chunk.startsWith(" ") || existing === "" ? "" : " ";
        const updatedText = existing + separator + chunk;
        return [{ ...prev[0], text: updatedText, timestamp: time }, ...prev.slice(1)];
      }

      // Otherwise create a fresh agent bubble and store its ID
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

  // Helper to add timestamped logs
  const addLog = useCallback((sender: "agent" | "user" | "system", text: string) => {
    if (sender !== "agent") {
      // Seal current agent turn when visitor or system logs
      currentAgentLogIdRef.current = null;
    }
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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

  const resetIdleTimer = useCallback(() => {
    setIdleTimerSeconds(0);
  }, []);

  // Stop all active audio playback nodes immediately (for barge-in / conversation reset)
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

  // Decode and queue 24kHz PCM audio chunks from Gemini Live API
  const queueAudioPlayback = useCallback((base64Data: string) => {
    if (!audioContextRef.current) return;
    const audioCtx = audioContextRef.current;
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    try {
      const float32Array = decodePcm16ToFloat32(base64Data);
      if (float32Array.length === 0) return;

      // Gemini Live sends 24,000 Hz 1-channel PCM
      const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;

      // Connect directly to speakers and visualizer
      source.connect(audioCtx.destination);
      if (agentAnalyserRef.current) {
        source.connect(agentAnalyserRef.current);
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
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  }, []);

  // Initialize Camera stream explicitly (available even before connecting WebSocket)
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
        videoRef.current.play().catch(() => { });
      }
      setCameraError(null);
      return vStream;
    } catch (camErr) {
      console.warn("Camera init failed:", camErr);
      setCameraError("Camera permission denied or unavailable.");
      return null;
    }
  }, []);

  // Initialize Media Streams (Camera and Microphone)
  const initMediaStreams = useCallback(async () => {
    try {
      // 1. Initialize Camera
      await initCamera();

      // 2. Initialize AudioContext and Microphone with AudioWorklet
      if (!audioContextRef.current) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

        // Use 16,000 Hz AudioContext to match Gemini Live PCM input spec
        const audioCtx = new AudioContextClass({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;

        // Create Analysers
        const micAnalyser = audioCtx.createAnalyser();
        micAnalyser.fftSize = 128;
        micAnalyserRef.current = micAnalyser;

        const agentAnalyser = audioCtx.createAnalyser();
        agentAnalyser.fftSize = 128;
        agentAnalyserRef.current = agentAnalyser;

        // Output audio gain node
        const agentGain = audioCtx.createGain();
        agentGain.gain.value = 1.0;
        agentGain.connect(agentAnalyser);
        agentGain.connect(audioCtx.destination);
        agentGainNodeRef.current = agentGain;

        // Load AudioWorkletProcessor
        await audioCtx.audioWorklet.addModule("/audio-worklet-processor.js");

        // Request Microphone stream at 16,000 Hz
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

        const micSource = audioCtx.createMediaStreamSource(aStream);
        micSource.connect(micAnalyser);

        const workletNode = new AudioWorkletNode(audioCtx, "audio-recorder-worklet");
        micSource.connect(workletNode);

        // Zero-gain silent sink to keep worklet alive without piping mic into speakers (prevents feedback)
        const silentSink = audioCtx.createGain();
        silentSink.gain.value = 0;
        workletNode.connect(silentSink);
        silentSink.connect(audioCtx.destination);
        workletNodeRef.current = workletNode;

        // Process 16kHz PCM chunks from worklet and stream to WebSocket
        workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
          if (
            wsRef.current &&
            wsRef.current.readyState === WebSocket.OPEN &&
            isSetupCompleteRef.current &&
            !isMicMutedRef.current
          ) {
            const pcmBuffer = event.data;
            const base64Audio = arrayBufferToBase64(pcmBuffer);

            const payload = {
              realtimeInput: {
                audio: {
                  mimeType: "audio/pcm;rate=16000",
                  data: base64Audio,
                },
              },
            };

            wsRef.current.send(JSON.stringify(payload));
          }
        };
      }
    } catch (err: unknown) {
      console.error("Media init error:", err);
      const msg = err instanceof Error ? err.message : "Media device error";
      addLog("system", `Media warning: ${msg}`);
    }
  }, [addLog]);

  // Start 1 FPS Video Capture loop
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
        // Draw frame to 320x240 canvas
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

          // Trigger visual snapshot pulse
          setIsCapturingFrame(true);
          setTimeout(() => setIsCapturingFrame(false), 200);
        }
      } catch (err) {
        console.error("Video frame capture error:", err);
      }
    }, 1000);
  }, []);

  // Establish Gemini 3.1 Flash Live WebSocket Connection
  const connectWebSocket = useCallback(
    async (activeApiKey: string) => {
      if (!activeApiKey || activeApiKey.trim() === "") {
        addLog("system", "Cannot connect: GEMINI_API_KEY is missing or empty.");
        setConnectionStatus("error");
        return;
      }

      // Reset setup state
      isSetupCompleteRef.current = false;
      setConnectionStatus("connecting");
      addLog("system", "Opening WebSocket connection to Gemini 3.1 Flash Live...");

      // Ensure media devices are initialized
      await initMediaStreams();

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(activeApiKey.trim())}`;

      try {
        if (wsRef.current) {
          const prevWs = wsRef.current;
          wsRef.current = null;
          prevWs.close(1000, "Reconnecting");
        }

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        lastPingTimeRef.current = performance.now();

        ws.onopen = () => {
          if (wsRef.current !== ws) return;
          const connectLatency = Math.round(performance.now() - lastPingTimeRef.current);
          setLatencyMs(connectLatency);
          addLog("system", `Socket connected (${connectLatency}ms). Sending setup handshake...`);

          // Send Initial Setup Handshake Payload
          const setupPayload = {
            setup: {
              model: "models/gemini-3.1-flash-live-preview",
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: "Sadaltagar",
                    },
                  },
                },
              },
              systemInstruction: {
                parts: [
                  {
                    text: "Your name is CPUisthebest, a savagely witty fashion critic for the CS Club booth who speaks like a savage comedian with an overly excited, caffeinated pace, dramatic vocal pitch swings, condescending chuckles, and audible scoffs: visually scan whatever the user is wearing or holding, roast them ruthlessly in under two punchy sentences, slap a score out of 10 on their drip, and cheekily tell them to join the CS Club to refactor their aesthetic and go on with their day.",
                  },
                ],
              },
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

            // 1. Handle Setup Complete Acknowledgment
            if (data.setupComplete) {
              isSetupCompleteRef.current = true;
              setConnectionStatus("connected");
              addLog("system", "✅ Gemini Live setup confirmed! Vision & mic streams active.");
              startVideoFrameCapture();
              return;
            }

            // 2. Handle Server API Error
            if (data.error) {
              const errMsg = data.error.message || JSON.stringify(data.error);
              addLog("system", `⚠️ Server Error: ${errMsg}`);
              return;
            }

            // 3. Handle Barge-in Interruption
            if (data.serverContent?.interrupted) {
              stopAllPlayingAudio();
              currentAgentLogIdRef.current = null;
              addLog("system", "⚡ Interruption detected (barge-in): playback cleared.");
            }

            // 4. Handle Model Turn Audio Chunks & Text
            if (data.serverContent?.modelTurn?.parts) {
              for (const part of data.serverContent.modelTurn.parts) {
                const audioData = part.data || part.inlineData?.data;
                const mime = part.mimeType || part.inlineData?.mimeType;

                if (mime && mime.startsWith("audio/pcm") && audioData) {
                  queueAudioPlayback(audioData);
                  resetIdleTimer();
                }
                if (part.text && part.text.trim()) {
                  appendAgentText(part.text);
                  resetIdleTimer();
                }
              }
            }

            // 5. Handle Server Transcriptions (if provided by Gemini Live)
            const serverOutText = data.serverContent?.outputTranscription?.text;
            if (serverOutText && typeof serverOutText === "string" && serverOutText.trim()) {
              appendAgentText(serverOutText);
              resetIdleTimer();
            }

            const serverInText = data.serverContent?.inputTranscription?.text;
            if (serverInText && typeof serverInText === "string" && serverInText.trim()) {
              const now = Date.now();
              if (serverInText !== lastUserSpeechRef.current.text || now - lastUserSpeechRef.current.time > 3000) {
                lastUserSpeechRef.current = { text: serverInText.trim(), time: now };
                addLog("user", serverInText.trim());
                resetIdleTimer();
              }
            }

            // 6. Turn Complete marker: Seals the current agent bubble
            if (data.serverContent?.turnComplete) {
              currentAgentLogIdRef.current = null;
            }
          } catch (msgErr) {
            console.error("Error handling live message:", msgErr);
          }
        };

        ws.onclose = (event) => {
          if (wsRef.current === ws) {
            isSetupCompleteRef.current = false;
            setConnectionStatus("disconnected");
            currentAgentLogIdRef.current = null;
            if (videoIntervalRef.current) {
              clearInterval(videoIntervalRef.current);
            }
            if (event.code !== 1000) {
              const reasonStr = event.reason ? ` - ${event.reason}` : "";
              addLog("system", `WebSocket disconnected (Code: ${event.code}${reasonStr})`);
            }
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          if (wsRef.current === ws) {
            setConnectionStatus("error");
            currentAgentLogIdRef.current = null;
            addLog("system", "WebSocket error encountered.");
          }
        };
      } catch (err: unknown) {
        console.error("Connection attempt failed:", err);
        setConnectionStatus("error");
        const msg = err instanceof Error ? err.message : "Failed to connect";
        addLog("system", `Connection failed: ${msg}`);
      }
    },
    [addLog, appendAgentText, initMediaStreams, queueAudioPlayback, resetIdleTimer, startVideoFrameCapture, stopAllPlayingAudio]
  );

  // Primary Conversation Reset & Visitor Switch Flow
  const handleResetConversation = useCallback(() => {
    currentAgentLogIdRef.current = null;
    addLog("system", "🔄 Next Visitor / Reset Conversation triggered.");

    // 1. Stop audio playback immediately
    stopAllPlayingAudio();

    // 2. Stop video capture timer
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
    }

    // 3. Close active WebSocket (Preserves hot camera & mic media streams!)
    if (wsRef.current) {
      const activeWs = wsRef.current;
      wsRef.current = null;
      activeWs.close(1000, "Reset Conversation");
    }

    // 4. Reset idle watchdog
    resetIdleTimer();

    // 5. Open fresh WebSocket to Gemini Live
    if (apiKeyRef.current) {
      connectWebSocket(apiKeyRef.current);
    }
  }, [addLog, connectWebSocket, resetIdleTimer, stopAllPlayingAudio]);

  // Idle Watchdog (90-second timeout auto-reset)
  useEffect(() => {
    const timer = setInterval(() => {
      if (connectionStatus === "connected") {
        setIdleTimerSeconds((prev) => {
          const next = prev + 1;
          if (next >= 90) {
            addLog("system", "⏳ Idle Watchdog: 90s idle limit reached. Auto-resetting booth session...");
            handleResetConversation();
            return 0;
          }
          return next;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [addLog, connectionStatus, handleResetConversation]);

  // Audio energy monitor for user mic speaking detection
  useEffect(() => {
    let animId: number;
    const checkEnergy = () => {
      animId = requestAnimationFrame(checkEnergy);
      if (micAnalyserRef.current && !isMicMuted) {
        const arr = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
        micAnalyserRef.current.getByteFrequencyData(arr);
        const sum = arr.reduce((a, b) => a + b, 0);
        const avg = sum / arr.length;
        const speaking = avg > 20;
        setIsUserSpeaking(speaking);
        if (speaking) {
          resetIdleTimer();
        }
      } else {
        setIsUserSpeaking(false);
      }
    };
    checkEnergy();
    return () => cancelAnimationFrame(animId);
  }, [isMicMuted, resetIdleTimer]);

  // Client-Side Speech Recognition to capture visitor speech in real-time for chat log
  useEffect(() => {
    if (typeof window === "undefined" || connectionStatus !== "connected" || isMicMuted) {
      return;
    }

    type SpeechRecognitionInstance = {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: (event: { resultIndex: number; results: { isFinal: boolean;[key: number]: { transcript: string } }[] }) => void;
      onerror: (event: unknown) => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    };

    type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    let recognition: SpeechRecognitionInstance | null = null;
    let isStoppedManually = false;

    try {
      recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal && res[0]) {
            const transcript = res[0].transcript.trim();
            const now = Date.now();
            if (
              transcript &&
              (transcript !== lastUserSpeechRef.current.text || now - lastUserSpeechRef.current.time > 3000)
            ) {
              lastUserSpeechRef.current = { text: transcript, time: now };
              addLog("user", transcript);
              resetIdleTimer();
            }
          }
        }
      };

      recognition.onerror = () => {
        // Non-critical background event
      };

      recognition.onend = () => {
        if (!isStoppedManually && isSetupCompleteRef.current && !isMicMutedRef.current) {
          try {
            recognition?.start();
          } catch {
            // Already active or restarting
          }
        }
      };

      recognition.start();
    } catch (e) {
      console.debug("Web Speech Recognition initialization:", e);
    }

    return () => {
      isStoppedManually = true;
      try {
        recognition?.stop();
      } catch {
        // Ignore stop error
      }
    };
  }, [addLog, connectionStatus, isMicMuted, resetIdleTimer]);

  // Automatically initialize camera preview on mount
  useEffect(() => {
    initCamera();
  }, [initCamera]);

  // Handle PIN authentication success (Requests mic and camera permissions, socket stays disconnected until Connect is clicked)
  const handleAuthenticated = useCallback((key: string) => {
    setApiKey(key);
    setIsAuthModalOpen(false);
    initMediaStreams();
    addLog("system", "🔒 PIN verified. Mic and camera active. Click 'Connect Socket' to launch Gemini Live co-host.");
  }, [addLog, initMediaStreams]);

  // Lock session and re-prompt for PIN
  const handleLockSession = useCallback(() => {
    sessionStorage.removeItem("booth_pin");
    sessionStorage.removeItem("booth_api_key");
    sessionStorage.removeItem("booth_authenticated");
    setApiKey(null);
    setIsAuthModalOpen(true);
    if (wsRef.current) {
      const activeWs = wsRef.current;
      wsRef.current = null;
      activeWs.close(1000, "Session Locked");
    }
    stopAllPlayingAudio();
    setConnectionStatus("disconnected");
  }, [stopAllPlayingAudio]);

  // Toggle mic mute
  const handleToggleMic = useCallback(() => {
    setIsMicMuted((prev) => {
      const next = !prev;
      addLog("system", next ? "Microphone muted." : "Microphone unmuted.");
      return next;
    });
  }, [addLog]);

  // Toggle camera
  const handleToggleCamera = useCallback(() => {
    setIsCameraActive((prev) => {
      const next = !prev;
      addLog("system", next ? "Camera feed enabled." : "Camera feed disabled.");
      return next;
    });
  }, [addLog]);

  // Toggle connection state
  const handleToggleConnection = useCallback(() => {
    if (connectionStatus === "connected") {
      if (wsRef.current) {
        const activeWs = wsRef.current;
        wsRef.current = null;
        activeWs.close(1000, "Manual Disconnect");
      }
      stopAllPlayingAudio();
      setConnectionStatus("disconnected");
      addLog("system", "Manual disconnect requested.");
    } else if (apiKeyRef.current) {
      connectWebSocket(apiKeyRef.current);
    } else {
      setIsAuthModalOpen(true);
    }
  }, [addLog, connectWebSocket, connectionStatus, stopAllPlayingAudio]);

  // Toggle Fullscreen mode
  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (typeof document !== "undefined") {
        if (next) {
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => { });
          }
        } else {
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => { });
          }
        }
      }
      return next;
    });
  }, []);

  // Listen for native escape / exit fullscreen events
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // -------------------------------------------------------------
  // Fullscreen Mode View (Matches Split Layout Diagram)
  // -------------------------------------------------------------
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col md:flex-row gap-4 md:gap-5 p-3 md:p-5 overflow-hidden select-none">
        {/* Background ambient lighting */}
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* LEFT COLUMN: Large Camera Vision Feed */}
        <div className="flex-1 h-full min-h-0 min-w-0 flex flex-col relative">
          <CameraPreview
            stream={cameraStream || cameraStreamRef.current}
            videoRef={videoRef}
            isLive={connectionStatus === "connected"}
            isCapturingFrame={isCapturingFrame}
            cameraActive={isCameraActive}
            onToggleCamera={handleToggleCamera}
            error={cameraError}
            className="w-full h-full object-cover flex-1 aspect-auto shadow-[0_0_40px_rgba(6,182,212,0.15)]"
          />
        </div>

        {/* RIGHT COLUMN: Top Card (Chatbox/Logs + Controls) & Bottom Card (Audio Visualizer) */}
        <div className="w-full md:w-[420px] lg:w-[480px] xl:w-[540px] h-full min-h-0 flex flex-col gap-4 shrink-0">
          {/* TOP CARD: Chatbox, Logs, Action Buttons (Reset, Disconnect, Unfullscreen) */}
          <div className="flex-1 min-h-0 flex flex-col rounded-3xl bg-slate-900/90 border border-slate-800 p-4 md:p-5 shadow-2xl backdrop-blur-xl overflow-hidden">
            {/* Header with Title & Unfullscreen Button */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs font-mono">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 p-0.5 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                  <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center">
                    <Bot className="w-4 h-4 text-cyan-400" />
                  </div>
                </div>
                <div>
                  <div className="font-bold text-slate-100 flex items-center gap-1.5">
                    <span>AI BANTER & LOGS</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                      3.1 FLASH
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {logs.length} messages • {latencyMs > 0 ? `${latencyMs}ms` : "Live"}
                  </span>
                </div>
              </div>

              {/* Unfullscreen Button */}
              <button
                onClick={handleToggleFullscreen}
                className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 hover:bg-slate-700/80 text-slate-200 hover:text-white flex items-center gap-1.5 transition-all text-xs font-semibold shadow-sm"
                title="Exit Fullscreen (Esc)"
              >
                <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-mono">EXIT FULLSCREEN</span>
              </button>
            </div>

            {/* Action Buttons Row (Next Visitor / Reset, Mute Mic, Disconnect) */}
            <div className="flex flex-wrap items-center gap-2 pt-3 pb-2 border-b border-slate-800/60">
              {/* Next Visitor / Reset Button */}
              <button
                onClick={handleResetConversation}
                disabled={connectionStatus === "disconnected"}
                className="flex-1 min-w-[130px] py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-40 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Next Visitor</span>
              </button>

              {/* Mute Mic */}
              <button
                onClick={handleToggleMic}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${isMicMuted
                  ? "bg-red-950/60 border-red-500/50 text-red-300 hover:bg-red-900/60"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
                  }`}
              >
                {isMicMuted ? <MicOff className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{isMicMuted ? "Muted" : "Mic"}</span>
              </button>

              {/* Disconnect / Connect */}
              <button
                onClick={handleToggleConnection}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${connectionStatus === "connected"
                  ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
                  : "bg-cyan-950 border-cyan-500/50 text-cyan-300 hover:bg-cyan-900"
                  }`}
              >
                {connectionStatus === "connected" ? (
                  <>
                    <Power className="w-3.5 h-3.5 text-amber-400" />
                    <span>Disconnect</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Connect</span>
                  </>
                )}
              </button>

              {/* Lock Booth */}
              <button
                onClick={handleLockSession}
                className="py-2 px-2.5 rounded-xl text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-all"
                title="Lock Booth"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Chatbox / Live Logs Area (Expands vertically) */}
            <div className="flex-1 min-h-0 overflow-y-auto mt-2.5 pr-1 space-y-2 font-mono text-xs scrollbar-thin scrollbar-thumb-slate-800">
              {logs.length === 0 ? (
                <div className="text-slate-400 italic text-center py-10 text-xs">
                  Waiting for passersby... Wave at the camera or speak into the mic to start banter!
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded-xl flex items-start gap-2.5 transition-all ${log.sender === "agent"
                      ? "bg-cyan-950/40 border border-cyan-500/20 text-cyan-200"
                      : log.sender === "user"
                        ? "bg-slate-900 border border-slate-700/40 text-emerald-300"
                        : "bg-slate-900/40 text-slate-400 text-[11px]"
                      }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 flex-shrink-0">
                      {log.sender === "agent" ? "🤖 AI" : log.sender === "user" ? "👤 VISITOR" : "⚡ SYS"}
                    </span>
                    <p className="flex-1 leading-relaxed break-words">{log.text}</p>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">
                      {log.timestamp}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* BOTTOM CARD: Audio Visualizer */}
          <div className="h-44 md:h-48 shrink-0 flex flex-col rounded-3xl overflow-hidden shadow-2xl">
            <AudioVisualizer
              micAnalyser={micAnalyserRef.current}
              agentAnalyser={agentAnalyserRef.current}
              isAgentSpeaking={isAgentSpeaking}
              isUserSpeaking={isUserSpeaking}
              isMicMuted={isMicMuted}
              isConnected={connectionStatus === "connected"}
              className="h-full"
            />
          </div>
        </div>

        {/* PIN Authentication Security Modal */}
        <PinAuthModal
          isOpen={isAuthModalOpen}
          onAuthenticated={handleAuthenticated}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // Standard Dashboard View
  // -------------------------------------------------------------
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 md:p-6 lg:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner Header */}
      <header className="w-full max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800/80 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 p-0.5 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Bot className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-300 bg-clip-text text-transparent">
                CS CLUB BOOTH AGENT
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 border border-cyan-500/40 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                3.1 FLASH LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              Multimodal Recruitment Co-Host & Interactive Vision Station
            </p>
          </div>
        </div>

        {/* Status badges & Quick Fullscreen toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>PIN Auth:</span>
            <span className={apiKey ? "text-emerald-400 font-bold" : "text-amber-400"}>
              {apiKey ? "VERIFIED" : "LOCKED"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Native Barge-in:</span>
            <span className="text-emerald-400 font-bold">ACTIVE</span>
          </div>

          <button
            onClick={handleToggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-cyan-500/40 hover:bg-cyan-950/60 text-cyan-300 text-xs font-mono transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)]"
            title="Enter Fullscreen Mode"
          >
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">FULLSCREEN</span>
          </button>
        </div>
      </header>

      {/* Main Grid: Left Vision/Audio Visualizer, Right Booth Dashboard */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        {/* Left Column: Camera Vision HUD & Dual Audio Visualizer (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <CameraPreview
            stream={cameraStream || cameraStreamRef.current}
            videoRef={videoRef}
            isLive={connectionStatus === "connected"}
            isCapturingFrame={isCapturingFrame}
            cameraActive={isCameraActive}
            onToggleCamera={handleToggleCamera}
            error={cameraError}
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

        {/* Right Column: Booth Dashboard, Metrics, Banter Ticker, Controls (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <BoothDashboard
            connectionStatus={connectionStatus}
            latencyMs={latencyMs}
            idleTimerSeconds={idleTimerSeconds}
            isMicMuted={isMicMuted}
            isCameraActive={isCameraActive}
            logs={logs}
            onResetConversation={handleResetConversation}
            onToggleMic={handleToggleMic}
            onToggleCamera={handleToggleCamera}
            onToggleConnection={handleToggleConnection}
            onLockSession={handleLockSession}
            onToggleFullscreen={handleToggleFullscreen}
            isFullscreen={isFullscreen}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-7xl pt-6 mt-6 border-t border-slate-900 text-slate-500 text-xs flex flex-col md:flex-row items-center justify-between gap-2 font-mono">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Gemini 3.1 Flash Live Preview • 16kHz PCM In • 24kHz PCM Out</span>
        </div>
        <div>
          <span>CS Club Recruitment Drive Station • Zero DB State • Hybrid Serverless</span>
        </div>
      </footer>

      {/* PIN Authentication Security Modal */}
      <PinAuthModal
        isOpen={isAuthModalOpen}
        onAuthenticated={handleAuthenticated}
      />
    </main>
  );
}
