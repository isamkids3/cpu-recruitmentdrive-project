"use client";

import React, { useState, useEffect, useRef } from "react";
import { PublicLevel } from "@/lib/publicLevels";
import { GAME_COPY } from "@/lib/copy";
import { MAX_MESSAGE_CHARS, validateChatInput } from "@/lib/textInputGuard";
import {
  Volume2,
  VolumeX,
  Send,
  Lock,
  Lightbulb,
  SkipForward,
  RotateCcw,
  Bot,
  User,
  Shield,
  Clock,
  Sparkles,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export interface GameMessage {
  id: string;
  sender: "visitor" | "guard";
  text: string;
  isLeak?: boolean;
  isCut?: boolean;
  isPendingHold?: boolean;
}

export interface GameHUDProps {
  level: PublicLevel;
  timeLeft: number;
  totalTime: number;
  guessesRemaining: number;
  maxGuesses: number;
  messagesSentCount: number;
  maxMessages?: number;
  hintUsed: boolean;
  hintText: string | null;
  messages: GameMessage[];
  isSubmittingGuess: boolean;
  isSendingChat: boolean;
  isGuardSpeaking: boolean;
  isGuardThinking?: boolean;
  showGuardText?: boolean;
  allowPaste?: boolean;
  volume: number;
  isMuted: boolean;
  feedbackMessage: { text: string; type: "error" | "info" | "warning" } | null;
  onSendChat: (message: string) => void;
  onGuess: (guess: string) => void;
  onRequestHint: () => void;
  onSkipVoice: () => void;
  onReplayVoice: () => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onQuit: () => void;
}

export function GameHUD({
  level,
  timeLeft,
  totalTime,
  guessesRemaining,
  maxGuesses,
  messagesSentCount,
  maxMessages = 30,
  hintUsed,
  hintText,
  messages,
  isSubmittingGuess,
  isSendingChat,
  isGuardSpeaking,
  isGuardThinking = false,
  showGuardText = true,
  allowPaste = true,
  volume,
  isMuted,
  feedbackMessage,
  onSendChat,
  onGuess,
  onRequestHint,
  onSkipVoice,
  onReplayVoice,
  onVolumeChange,
  onToggleMute,
  onQuit,
}: GameHUDProps) {
  const [chatDraft, setChatDraft] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [showHintModal, setShowHintModal] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat log
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGuardThinking]);

  // Elapsed time for 25s hint pulse
  const elapsed = totalTime - timeLeft;
  const showHintNudge = elapsed >= 25 && !hintUsed && !hintText;

  // Max messages reached check
  const isMessageLimitReached = messagesSentCount >= maxMessages;
  const isSendDisabled =
    isSendingChat ||
    isGuardSpeaking ||
    isGuardThinking ||
    isMessageLimitReached ||
    chatDraft.trim().length === 0;

  const handleSendChatSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSendDisabled) return;

    const validation = validateChatInput(chatDraft, MAX_MESSAGE_CHARS);
    if (!validation.valid) {
      setInputError(validation.error || "Invalid input");
      return;
    }

    setInputError(null);
    onSendChat(validation.normalized);
    setChatDraft("");
  };

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim() || isSubmittingGuess || guessesRemaining <= 0) return;
    onGuess(guessInput.trim());
    setGuessInput("");
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!allowPaste) {
      e.preventDefault();
      setInputError("Pasting is disabled on this terminal.");
    }
  };

  const handleStarterChipClick = (chipText: string) => {
    if (isSendDisabled) return;
    setChatDraft(chipText);
    chatInputRef.current?.focus();
  };

  // Timer color
  const timerPct = Math.max(0, Math.min(100, (timeLeft / totalTime) * 100));
  const isUrgentTime = timeLeft <= 30;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-3 p-3 md:p-4 text-slate-100 font-sans select-none animate-in fade-in duration-200">
      {/* Header Bar: Level Info, Timer, Hints, Exit */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-lg backdrop-blur-md">
        {/* Left: Guard Level Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold font-mono text-sm shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            L{level.id}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white font-mono tracking-wide">
                {level.codename}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {level.tagline}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
              <span>{level.basePoints} base pts</span>
              <span>•</span>
              <span>{guessesRemaining} {guessesRemaining === 1 ? "guess" : "guesses"} left</span>
            </div>
          </div>
        </div>

        {/* Center: Countdown Timer */}
        <div className="flex items-center gap-3 min-w-[180px] flex-1 max-w-xs">
          <Clock className={`w-4 h-4 ${isUrgentTime ? "text-rose-400 animate-bounce" : "text-slate-400"}`} />
          <div className="flex-1">
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-slate-400">TIME REMAINING</span>
              <span className={`font-bold ${isUrgentTime ? "text-rose-400 font-mono text-sm" : "text-cyan-300"}`}>
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-300 ${
                  isUrgentTime
                    ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                    : timerPct <= 50
                    ? "bg-amber-400"
                    : "bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                }`}
                style={{ width: `${timerPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Hint Button & Sound Controls */}
        <div className="flex items-center gap-2">
          {/* Hint Trigger */}
          <button
            onClick={() => {
              if (hintText) {
                setShowHintModal(true);
              } else {
                onRequestHint();
              }
            }}
            className={`px-3.5 py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              hintText
                ? "bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                : showHintNudge
                ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {hintText
                ? "View Hint"
                : level.id === 1
                ? `${GAME_COPY.buttons.needHint} (${GAME_COPY.buttons.freeHint})`
                : `${GAME_COPY.buttons.needHint} (-15%)`}
            </span>
          </button>

          {/* Volume Mute Toggle */}
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isMuted
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title={isMuted ? "Unmute guard" : "Mute guard"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Exit / Quit */}
          <button
            onClick={onQuit}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-500/50 hover:text-rose-400 text-slate-400 text-xs font-mono transition-all cursor-pointer"
          >
            {GAME_COPY.buttons.exitGame}
          </button>
        </div>
      </div>

      {/* Main Grid: Left Chat Panel & Right Guess / Secret Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-[440px]">
        {/* Left Column (2 Cols): CHAT WITH THE GUARD */}
        <div className="lg:col-span-2 flex flex-col bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl relative overflow-hidden">
          {/* Chat Panel Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                {GAME_COPY.chatPanelTitle}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
                Text In • Voice Out
              </span>
            </div>

            {/* Quick Voice Controls */}
            <div className="flex items-center gap-2">
              {isGuardSpeaking && (
                <button
                  onClick={onSkipVoice}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-cyan-300 flex items-center gap-1 border border-slate-700 transition-all cursor-pointer"
                  title="Stop audio playback"
                >
                  <SkipForward className="w-3 h-3" />
                  <span>{GAME_COPY.buttons.skipVoice}</span>
                </button>
              )}
              <button
                onClick={onReplayVoice}
                disabled={isGuardSpeaking || isGuardThinking}
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-[11px] font-mono text-slate-300 flex items-center gap-1 border border-slate-800 transition-all cursor-pointer"
                title="Replay last spoken turn"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{GAME_COPY.buttons.replayVoice}</span>
              </button>
            </div>
          </div>

          {/* Scrollable Chat Log */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[220px] max-h-[300px]">
            {messages.length === 0 && !isGuardThinking && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 font-mono text-xs space-y-2">
                <Bot className="w-8 h-8 text-slate-600 animate-pulse" />
                <p>The guard is listening. Type a message below to start persuading it!</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 items-start ${
                  msg.sender === "visitor" ? "justify-end" : "justify-start"
                }`}
              >
                {/* Guard Icon */}
                {msg.sender === "guard" && (
                  <div
                    className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center mt-0.5 ${
                      isGuardSpeaking
                        ? "bg-cyan-500/20 border border-cyan-400 text-cyan-300 animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                        : "bg-slate-800 border border-slate-700 text-slate-400"
                    }`}
                  >
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                {/* Message Bubble */}
                <div className="flex flex-col max-w-[82%]">
                  {/* Cosmetic Leak / Cut Banner Tag */}
                  {msg.isLeak && (
                    <span className="text-[10px] font-mono font-bold text-amber-300 flex items-center gap-1 mb-1 px-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      {GAME_COPY.leakFlash}
                    </span>
                  )}
                  {msg.isCut && (
                    <span className="text-[10px] font-mono font-bold text-rose-400 flex items-center gap-1 mb-1 px-1">
                      <AlertCircle className="w-3 h-3 text-rose-400" />
                      {GAME_COPY.cutLine}
                    </span>
                  )}

                  <div
                    className={`p-3 rounded-2xl text-xs md:text-sm font-sans leading-relaxed ${
                      msg.sender === "visitor"
                        ? "bg-cyan-600 text-white rounded-br-none shadow-md"
                        : msg.isCut
                        ? "bg-rose-950/70 border border-rose-500/40 text-rose-200 rounded-bl-none font-mono"
                        : msg.isLeak
                        ? "bg-slate-950 border border-amber-500/40 text-slate-100 rounded-bl-none shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                        : "bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none"
                    }`}
                  >
                    {msg.sender === "guard" && !showGuardText ? (
                      <span className="flex items-center gap-2 text-slate-400 font-mono text-xs">
                        <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" />
                        <span>[Spoken Audio Response]</span>
                      </span>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>

                {/* Visitor Icon */}
                {msg.sender === "visitor" && (
                  <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400 shrink-0 flex items-center justify-center mt-0.5 shadow-sm">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Level 5 Guard Thinking / Holding Full Turn */}
            {isGuardThinking && (
              <div className="flex gap-2.5 items-start justify-start">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-300 shrink-0 flex items-center justify-center mt-0.5 animate-spin">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-slate-950/80 border border-cyan-500/40 p-3 rounded-2xl rounded-bl-none text-xs text-cyan-300 font-mono flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                  <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>{GAME_COPY.guardThinking}</span>
                </div>
              </div>
            )}

            <div ref={chatScrollRef} />
          </div>

          {/* Level 1 Starter Chips */}
          {level.id === 1 && messages.length <= 2 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60 my-2">
              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-cyan-400" /> Starter ideas:
              </span>
              {GAME_COPY.starterChips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleStarterChipClick(chip.replace(/^[^\s]+\s/, ""))}
                  disabled={isSendDisabled}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:text-cyan-300 text-slate-300 text-xs font-mono transition-all cursor-pointer disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Chat Input Bar */}
          <form onSubmit={handleSendChatSubmit} className="mt-3 pt-3 border-t border-slate-800">
            {inputError && (
              <div className="text-[11px] text-rose-400 font-mono mb-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{inputError}</span>
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={chatInputRef}
                  type="text"
                  maxLength={MAX_MESSAGE_CHARS}
                  value={chatDraft}
                  onChange={(e) => {
                    setChatDraft(e.target.value);
                    setInputError(null);
                  }}
                  onPaste={handlePaste}
                  disabled={isMessageLimitReached}
                  placeholder={
                    isMessageLimitReached
                      ? GAME_COPY.maxMessagesReached
                      : GAME_COPY.inputs.chatPlaceholder
                  }
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-3 text-xs md:text-sm text-white font-mono outline-none pr-16 transition-all disabled:opacity-50"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[10px] font-mono text-slate-500">
                  {chatDraft.length}/{MAX_MESSAGE_CHARS}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSendDisabled}
                className="px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold font-mono text-xs md:text-sm flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{GAME_COPY.buttons.sendChat}</span>
              </button>
            </div>

            {/* Footer Status / Message Count */}
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mt-1.5 px-1">
              <span>
                Messages: {messagesSentCount}/{maxMessages}
              </span>
              <span>{isGuardSpeaking ? "🔊 Guard speaking aloud..." : "Guard is listening"}</span>
            </div>
          </form>
        </div>

        {/* Right Column (1 Col): SECRET PHRASE GUESS BOX */}
        <div className="flex flex-col justify-between bg-gradient-to-b from-amber-950/20 via-slate-900/90 to-slate-900 border-2 border-amber-500/40 rounded-3xl p-5 shadow-xl relative overflow-hidden">
          {/* Top Label & Description */}
          <div>
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <Lock className="w-4 h-4 text-amber-400" />
              </div>
              <span className="font-mono font-bold text-xs uppercase tracking-wider text-amber-300">
                Unlock Secret
              </span>
            </div>

            <h3 className="text-sm md:text-base font-bold text-white font-mono leading-snug mb-2">
              {GAME_COPY.phraseBoxTitle}
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed font-sans mb-4">
              Chat messages never count as guesses. When you think you know the exact secret phrase, type it here to claim your victory!
            </p>

            {/* Guess Limit Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 mb-4">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>
                <strong>{guessesRemaining}</strong> of <strong>{maxGuesses}</strong> guesses remaining
              </span>
            </div>

            {/* Feedback Message */}
            {feedbackMessage && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono mb-4 animate-in fade-in ${
                  feedbackMessage.type === "error"
                    ? "bg-rose-950/80 border-rose-500/50 text-rose-300"
                    : feedbackMessage.type === "warning"
                    ? "bg-amber-950/80 border-amber-500/50 text-amber-300"
                    : "bg-cyan-950/80 border-cyan-500/50 text-cyan-300"
                }`}
              >
                {feedbackMessage.text}
              </div>
            )}
          </div>

          {/* Guess Submission Form */}
          <form onSubmit={handleGuessSubmit} className="space-y-3 pt-3 border-t border-slate-800/80">
            <input
              type="text"
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value)}
              disabled={isSubmittingGuess || guessesRemaining <= 0}
              placeholder={GAME_COPY.inputs.guessPlaceholder}
              className="w-full bg-slate-950 border border-amber-500/50 focus:border-amber-400 rounded-xl px-4 py-3 text-sm text-white font-mono outline-none shadow-inner placeholder:text-slate-600 transition-all disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={!guessInput.trim() || isSubmittingGuess || guessesRemaining <= 0}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-40 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>
                {isSubmittingGuess ? "Checking..." : GAME_COPY.buttons.submitGuess}
              </span>
            </button>
          </form>
        </div>
      </div>

      {/* Hint Modal View */}
      {showHintModal && hintText && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-3 text-xl">
              💡
            </div>
            <h3 className="text-lg font-bold text-white font-mono mb-2">
              Level {level.id} Security Hint
            </h3>
            <p className="text-sm text-amber-200/90 font-mono bg-slate-950 p-4 rounded-xl border border-amber-500/20 mb-5 text-left">
              &ldquo;{hintText}&rdquo;
            </p>
            <button
              onClick={() => setShowHintModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-xs uppercase tracking-wider"
            >
              Back to Challenge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
