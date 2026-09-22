"use client";

import React, { useState } from "react";
import { Mic, Lock, Loader2, AlertCircle } from "lucide-react";

interface StaffModeModalProps {
  currentMode: "game" | "cohost";
  pushToTalk: boolean;
  onTogglePushToTalk: (enabled: boolean) => void;
  showGuardText?: boolean;
  onToggleShowGuardText?: (enabled: boolean) => void;
  allowPaste?: boolean;
  onToggleAllowPaste?: (enabled: boolean) => void;
  onSelectMode: (mode: "game" | "cohost") => void;
  onClose: () => void;
}

export function StaffModeModal({
  currentMode,
  pushToTalk,
  onTogglePushToTalk,
  showGuardText = true,
  onToggleShowGuardText,
  allowPaste = true,
  onToggleAllowPaste,
  onSelectMode,
  onClose,
}: StaffModeModalProps) {
  const [selected, setSelected] = useState<"game" | "cohost">(currentMode);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    if (selected === currentMode) {
      onClose();
      return;
    }

    // Switching modes requires re-entering the PIN
    if (!pin.trim()) {
      setError("Please enter the Booth PIN to switch modes.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid PIN. Mode switch denied.");
      }

      onSelectMode(selected);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800 mb-6">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚙️</span>
            <h2 className="text-lg font-bold text-white tracking-wide">
              Staff Booth Controls
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center text-sm font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Mode Options */}
        <div className="space-y-3 mb-6">
          {/* Game Mode */}
          <button
            onClick={() => setSelected("game")}
            className={`w-full p-4 rounded-2xl border text-left transition-all flex items-start gap-4 ${
              selected === "game"
                ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700"
            }`}
          >
            <div className="text-2xl mt-0.5">🤖</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">
                  Crack the Vault
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                  VAULT-9
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Text-in, voice-out security challenge with 5 levels, scoring, and leaderboard.
              </p>
            </div>
            {selected === "game" && (
              <span className="text-cyan-400 font-bold text-base">✓</span>
            )}
          </button>

          {/* Co-Host Mode */}
          <button
            onClick={() => setSelected("cohost")}
            className={`w-full p-4 rounded-2xl border text-left transition-all flex items-start gap-4 ${
              selected === "cohost"
                ? "bg-purple-500/10 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700"
            }`}
          >
            <div className="text-2xl mt-0.5">🎙️</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">
                  CPU AI Co-Host
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                  Camera + Mic
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Booth co-host with live webcam vision and friendly conversational banter.
              </p>
            </div>
            {selected === "cohost" && (
              <span className="text-purple-400 font-bold text-base">✓</span>
            )}
          </button>
        </div>

        {/* Staff Audio Settings: Push-to-Talk Toggle (Co-host mode) */}
        {selected === "cohost" && (
          <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Mic className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-xs font-bold text-white">Push-to-Talk Mode</div>
                <div className="text-[11px] text-neutral-400">
                  Only send audio while holding Spacebar or on-screen button.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onTogglePushToTalk(!pushToTalk)}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                pushToTalk ? "bg-cyan-500 justify-end" : "bg-neutral-800 justify-start"
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>
        )}

        {/* Game Mode Staff Settings: Captions & Paste */}
        {selected === "game" && (
          <div className="space-y-3 mb-4">
            <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">Guard Text Captions</div>
                <div className="text-[11px] text-neutral-400">
                  Show transcript text in bubbles (turn off for voice-only challenge).
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleShowGuardText?.(!showGuardText)}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                  showGuardText ? "bg-cyan-500 justify-end" : "bg-neutral-800 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md" />
              </button>
            </div>

            <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">Allow Chat Paste</div>
                <div className="text-[11px] text-neutral-400">
                  Allow clipboard paste into the chat box.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleAllowPaste?.(!allowPaste)}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                  allowPaste ? "bg-cyan-500 justify-end" : "bg-neutral-800 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md" />
              </button>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 mb-6">
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
            Booth Display Links
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-300">
              Standalone Leaderboard Screen:
            </span>
            <a
              href="/leaderboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline"
            >
              Open /leaderboard ↗
            </a>
          </div>
        </div>

        {/* PIN Entry Required if Mode Changed */}
        {selected !== currentMode && (
          <div className="mb-6 space-y-2">
            <label className="block text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Enter Booth PIN to confirm mode switch</span>
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Booth PIN"
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-sm text-white font-mono outline-none focus:border-cyan-400"
            />
            {error && (
              <div className="flex items-center gap-2 text-rose-400 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleApply}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-black font-extrabold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <span>Apply Changes</span>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-sm transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
