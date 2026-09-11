"use client";

import React from "react";
import {
  Activity,
  Mic,
  MicOff,
  UserPlus,
  RefreshCw,
  Power,
  Cpu,
  Clock,
  Volume2,
  Terminal,
  Zap,
  Lock,
} from "lucide-react";

export interface LogItem {
  id: string;
  sender: "agent" | "user" | "system";
  text: string;
  timestamp: string;
}

interface BoothDashboardProps {
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  latencyMs: number;
  idleTimerSeconds: number;
  maxIdleSeconds?: number;
  isMicMuted: boolean;
  isCameraActive: boolean;
  logs: LogItem[];
  onResetConversation: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleConnection: () => void;
  onLockSession: () => void;
}

export const BoothDashboard: React.FC<BoothDashboardProps> = ({
  connectionStatus,
  latencyMs,
  idleTimerSeconds,
  maxIdleSeconds = 90,
  isMicMuted,
  isCameraActive,
  logs,
  onResetConversation,
  onToggleMic,
  onToggleCamera,
  onToggleConnection,
  onLockSession,
}) => {
  const idleProgress = Math.max(0, Math.min(100, (idleTimerSeconds / maxIdleSeconds) * 100));

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Model Card */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              TARGET MODEL
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/40">
              LIVE
            </span>
          </div>
          <div className="font-mono font-bold text-xs md:text-sm text-white truncate" title="gemini-3.1-flash-live-preview">
            gemini-3.1-flash
          </div>
          <div className="text-[10px] text-cyan-400 font-mono mt-0.5 flex items-center gap-1">
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            Voice: Puck (24kHz)
          </div>
        </div>

        {/* Connection Status Card */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              SOCKET STATE
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-emerald-400 shadow-[0_0_10px_#10b981] animate-pulse"
                  : connectionStatus === "connecting"
                  ? "bg-amber-400 animate-ping"
                  : "bg-red-400"
              }`}
            />
            <span className="font-mono font-bold text-sm uppercase text-slate-200">
              {connectionStatus}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            Bidi WebSocket Stream
          </div>
        </div>

        {/* Audio Latency Card */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              ROUND TRIP LATENCY
            </span>
          </div>
          <div className="font-mono font-bold text-base text-cyan-300">
            {connectionStatus === "connected" ? `${latencyMs > 0 ? latencyMs : "< 250"} ms` : "---"}
          </div>
          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
            Real-time Subsecond
          </div>
        </div>

        {/* Idle Watchdog Card */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              IDLE WATCHDOG
            </span>
            <span className="text-[11px] font-mono text-amber-300">
              {idleTimerSeconds}s / {maxIdleSeconds}s
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden my-1">
            <div
              className={`h-full transition-all duration-1000 ${
                idleProgress > 75 ? "bg-red-500" : idleProgress > 50 ? "bg-amber-400" : "bg-cyan-400"
              }`}
              style={{ width: `${idleProgress}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Auto-resets at 90s idle
          </div>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Next Visitor / Reset Button */}
        <button
          onClick={onResetConversation}
          disabled={connectionStatus === "disconnected"}
          className="flex-1 min-w-[200px] py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-40 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]"
        >
          <UserPlus className="w-4 h-4" />
          <span>Next Visitor / Reset Conversation</span>
        </button>

        {/* Mute Mic Toggle */}
        <button
          onClick={onToggleMic}
          className={`py-3 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
            isMicMuted
              ? "bg-red-950/60 border-red-500/50 text-red-300 hover:bg-red-900/60 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              : "bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800"
          }`}
        >
          {isMicMuted ? (
            <>
              <MicOff className="w-4 h-4 text-red-400" />
              <span>Mic Muted</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 text-emerald-400" />
              <span>Mute Mic</span>
            </>
          )}
        </button>

        {/* Connect / Disconnect Toggle */}
        <button
          onClick={onToggleConnection}
          className={`py-3 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
            connectionStatus === "connected"
              ? "bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800"
              : "bg-cyan-950/80 border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/80 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
          }`}
        >
          {connectionStatus === "connected" ? (
            <>
              <Power className="w-4 h-4 text-amber-400" />
              <span>Disconnect</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              <span>Connect Socket</span>
            </>
          )}
        </button>

        {/* Lock PIN button */}
        <button
          onClick={onLockSession}
          className="py-3 px-3.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
          title="Lock booth and change PIN"
        >
          <Lock className="w-4 h-4" />
        </button>
      </div>

      {/* Live AI Conversation & Banter Stream Ticker */}
      <div className="flex flex-col rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI CO-HOST LIVE BANTER & LOGS</span>
          </div>
          <span className="text-[10px] text-slate-400">
            {logs.length} messages
          </span>
        </div>

        <div className="p-3.5 max-h-48 overflow-y-auto space-y-2 font-mono text-xs scrollbar-thin scrollbar-thumb-slate-800">
          {logs.length === 0 ? (
            <div className="text-slate-400 italic text-center py-4 text-xs">
              Waiting for passersby... Wave at the camera or speak into the mic to start banter!
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`p-2 rounded-xl flex items-start gap-2.5 transition-all ${
                  log.sender === "agent"
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
    </div>
  );
};
