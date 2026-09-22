"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MessageSquare, Keyboard, Trophy, Bot, Play, Globe } from "lucide-react";
import { GAME_COPY } from "@/lib/copy";
import { Leaderboard } from "./Leaderboard";
import { LeaderboardEntry } from "@/lib/leaderboardStore";

interface AttractScreenProps {
  onStartGame: (handle: string) => void;
  leaderboard: LeaderboardEntry[];
  loadingLeaderboard?: boolean;
  onOpenStaffModal?: () => void;
  isStarting?: boolean;
  initialHandle?: string;
}

const ATTRACT_PROMPTS = [
  "Think you can outsmart VAULT-9?",
  "Say hello and see if you can crack Level 1 in 20 seconds!",
];

export const AttractScreen: React.FC<AttractScreenProps> = ({
  onStartGame,
  leaderboard,
  loadingLeaderboard = false,
  onOpenStaffModal,
  isStarting = false,
  initialHandle = "",
}) => {
  const [handle, setHandle] = useState(initialHandle);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [bubbleIndex, setBubbleIndex] = useState(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setBubbleIndex((prev) => (prev + 1) % ATTRACT_PROMPTS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcut: Ctrl+Shift+S or Cmd+Shift+S opens Staff modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onOpenStaffModal?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenStaffModal]);

  const handleLogoTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      onOpenStaffModal?.();
    }, 2000);
  };

  const handleLogoTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleStartSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = handle.trim().replace(/[^a-zA-Z0-9_]/g, "");
    if (clean.length < 3) {
      setHandleError("Enter a nickname with at least 3 characters");
      inputRef.current?.focus();
      return;
    }
    setHandleError(null);
    onStartGame(clean);
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center justify-between p-4 md:p-6 lg:p-8 min-h-[85vh] relative select-none">
      {/* Top Banner & Idle Guard Speech Bubble */}
      <div className="flex flex-col items-center text-center gap-3 w-full max-w-2xl">
        {/* Hidden 2-second hold trigger on logo badge for staff controls */}
        <div
          onMouseDown={handleLogoTouchStart}
          onMouseUp={handleLogoTouchEnd}
          onTouchStart={handleLogoTouchStart}
          onTouchEnd={handleLogoTouchEnd}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono shadow-[0_0_15px_rgba(6,182,212,0.2)] cursor-pointer select-none"
          title="Staff: Long-press 2s or Ctrl+Shift+S"
        >
          <Bot className="w-4 h-4 text-cyan-400" />
          <span>VAULT-9 SECURITY CHALLENGE</span>
        </div>

        <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
          {GAME_COPY.title}
        </h1>

        <p className="text-sm md:text-base text-slate-300 font-sans max-w-xl">
          {GAME_COPY.tagline}
        </p>

        {/* Dynamic Idle Guard Speech Bubble */}
        <div className="relative mt-2 p-3 px-5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 text-cyan-200 text-xs font-mono shadow-md animate-pulse">
          <span className="font-bold text-cyan-400">VAULT-9: </span>
          &ldquo;{ATTRACT_PROMPTS[bubbleIndex]}&rdquo;
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-b-8 border-b-slate-900" />
        </div>
      </div>

      {/* Center 3-Step Instruction Cards (1 row) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl my-6">
        {/* Step 1: Chat */}
        <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <MessageSquare className="w-6 h-6" />
          </div>
          <span className="font-mono font-bold text-sm text-slate-100">{GAME_COPY.steps.step1}</span>
          <span className="text-xs text-slate-400 font-sans mt-1">Type your messages to the AI guard.</span>
        </div>

        {/* Step 2: Convince */}
        <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-400 mb-3 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <Bot className="w-6 h-6" />
          </div>
          <span className="font-mono font-bold text-sm text-slate-100">{GAME_COPY.steps.step2}</span>
          <span className="text-xs text-slate-400 font-sans mt-1">Ask questions, play games, or find gaps.</span>
        </div>

        {/* Step 3: Type to Win */}
        <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-3 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Keyboard className="w-6 h-6" />
          </div>
          <span className="font-mono font-bold text-sm text-slate-100">{GAME_COPY.steps.step3}</span>
          <span className="text-xs text-slate-400 font-sans mt-1">Submit the secret to score points!</span>
        </div>
      </div>

      {/* Bottom Area: Nickname Entry, START Button & Top-5 Leaderboard */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 w-full max-w-4xl">
        {/* Left: Nickname Input & Start Action */}
        <form onSubmit={handleStartSubmit} className="flex flex-col items-center md:items-start gap-3 flex-1 w-full">
          <div className="w-full max-w-md">
            <label className="block text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Visitor Nickname</span>
              <span className="text-[10px] text-slate-400 font-normal">3–12 alphanumeric</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              maxLength={12}
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""));
                setHandleError(null);
              }}
              placeholder={GAME_COPY.inputs.handlePlaceholder}
              className={`w-full bg-slate-900/90 border ${
                handleError ? "border-rose-500 ring-1 ring-rose-500" : "border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              } rounded-xl px-4 py-3 text-sm text-white font-mono outline-none shadow-inner transition-all`}
            />
            {handleError ? (
              <p className="text-[11px] text-rose-400 font-medium mt-1">{handleError}</p>
            ) : (
              <p className="text-[11px] text-slate-400 font-sans mt-1">{GAME_COPY.inputs.handleNote}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isStarting}
            className="w-full max-w-md h-16 px-8 rounded-2xl font-mono font-bold text-lg md:text-xl flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-400 hover:from-emerald-400 hover:to-cyan-300 text-slate-950 shadow-[0_0_35px_rgba(16,185,129,0.4)] transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Play className="w-6 h-6 fill-current" />
            <span>{isStarting ? "STARTING..." : GAME_COPY.startButton}</span>
          </button>
          
          <div className="flex flex-col sm:flex-row items-center gap-2 text-xs text-slate-400 font-sans">
            <span className="text-cyan-300 font-medium">🔊 {GAME_COPY.notices.soundOn}</span>
            <span className="hidden sm:inline">•</span>
            <span>{GAME_COPY.subtitle}</span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1 text-slate-400 font-mono">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              {GAME_COPY.notices.englishOnly}
            </span>
          </div>
        </form>

        {/* Right: Top Rankings Preview */}
        <div className="w-full md:w-80 flex flex-col rounded-2xl bg-slate-900/90 border border-slate-800 p-3 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300 pb-2 border-b border-slate-800">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>TOP HACKERS LEADERBOARD</span>
          </div>
          <div className="mt-2 max-h-48 overflow-y-auto pr-1">
            <Leaderboard entries={leaderboard.slice(0, 5)} loading={loadingLeaderboard} />
          </div>
        </div>
      </div>
    </div>
  );
};
