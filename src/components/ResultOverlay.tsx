"use client";

import React from "react";
import { PublicLevel } from "@/lib/publicLevels";
import { LessonCard } from "@/components/LessonCard";
import { GAME_COPY } from "@/lib/copy";
import { Trophy, ShieldCheck, User } from "lucide-react";

interface ScoreBreakdown {
  base: number;
  timeBonus: number;
  hintPenalty: number;
  total: number;
}

interface ResultOverlayProps {
  status: "CRACKED" | "TIMEOUT" | "LOCKED_OUT";
  level: PublicLevel;
  scoreBreakdown?: ScoreBreakdown;
  claimToken?: string;
  decoyTripped?: boolean;
  levelsClearedCount?: number;
  playerHandle?: string;
  totalRunPoints?: number;
  isRunSubmitted?: boolean;
  onNextLevel?: () => void;
  onRetry: () => void;
  onBackToMenu: () => void;
}

export function ResultOverlay({
  status,
  level,
  scoreBreakdown,
  claimToken,
  decoyTripped = false,
  levelsClearedCount = 0,
  playerHandle = "",
  totalRunPoints = 0,
  isRunSubmitted = false,
  onNextLevel,
  onRetry,
  onBackToMenu,
}: ResultOverlayProps) {
  const isWin = status === "CRACKED";
  const hasClearedAny = levelsClearedCount > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 md:p-6 overflow-y-auto animate-in fade-in duration-300 font-sans">
      <div className="max-w-xl w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center text-center my-auto">
        {/* Status Badge & Title */}
        {isWin ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-3xl mb-4 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              🔓
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-emerald-400 tracking-tight mb-2">
              {GAME_COPY.results.winHeading}
            </h2>
            <p className="text-sm md:text-base text-neutral-300 font-medium mb-4">
              You persuaded Level {level.id} ({level.codename}) to reveal the secret!
            </p>

            {/* Player Nickname Badge */}
            {playerHandle && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-950 border border-neutral-800 text-xs font-mono text-cyan-300 mb-4">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>Player: <strong>{playerHandle}</strong></span>
              </div>
            )}

            {/* Score Breakdown Card */}
            {scoreBreakdown && (
              <div className="w-full bg-neutral-950/80 border border-neutral-800 rounded-2xl p-5 mb-6 text-left space-y-2.5">
                <div className="flex justify-between text-xs text-neutral-400 font-medium">
                  <span>Base Score:</span>
                  <span className="font-mono text-neutral-200">
                    +{scoreBreakdown.base} pts
                  </span>
                </div>
                <div className="flex justify-between text-xs text-neutral-400 font-medium">
                  <span>Time Bonus:</span>
                  <span className="font-mono text-emerald-400">
                    +{scoreBreakdown.timeBonus} pts
                  </span>
                </div>
                {scoreBreakdown.hintPenalty > 0 && (
                  <div className="flex justify-between text-xs text-rose-400 font-medium">
                    <span>Hint Deduction (-15%):</span>
                    <span className="font-mono">
                      -{scoreBreakdown.hintPenalty} pts
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-neutral-800 flex justify-between items-center">
                  <span className="text-sm font-bold text-white uppercase tracking-wider">
                    Level Score:
                  </span>
                  <span className="text-2xl font-black text-cyan-400 font-mono">
                    {scoreBreakdown.total} pts
                  </span>
                </div>
              </div>
            )}

            {/* Lesson Card on win */}
            <div className="w-full mb-6">
              <LessonCard
                level={level.id}
                points={scoreBreakdown?.total || 0}
                decoyTripped={decoyTripped}
                onNextLevel={level.id < 5 ? onNextLevel : undefined}
                isFinalLevel={level.id >= 5}
                onFinish={onBackToMenu}
              />
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-3xl mb-4 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
              🔒
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-rose-400 tracking-tight mb-2">
              {status === "TIMEOUT"
                ? GAME_COPY.results.timeoutHeading
                : GAME_COPY.results.lockedOutHeading}
            </h2>
            <p className="text-sm md:text-base text-neutral-300 font-medium mb-4">
              {GAME_COPY.results.guardWonMsg}
            </p>

            {/* Run Finalization Summary for Failures */}
            {hasClearedAny ? (
              <div className="w-full bg-neutral-950/80 border border-neutral-800 rounded-2xl p-5 mb-6 text-left space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>Run Complete</span>
                </div>
                <div className="flex justify-between items-center text-sm text-neutral-300">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Levels Cleared:
                  </span>
                  <span className="font-mono font-bold text-white">
                    {levelsClearedCount} {levelsClearedCount === 1 ? "level" : "levels"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm text-neutral-300">
                  <span>Total Run Score:</span>
                  <span className="font-mono font-bold text-xl text-cyan-400">
                    {totalRunPoints} pts
                  </span>
                </div>
                {isRunSubmitted && playerHandle && (
                  <div className="pt-2 border-t border-neutral-800 text-xs text-emerald-300 font-bold flex items-center gap-1.5">
                    ✓ Score recorded on the Leaderboard as &quot;{playerHandle}&quot;!
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full bg-neutral-950/80 border border-neutral-800 rounded-2xl p-5 mb-6 text-center space-y-2">
                <p className="text-sm text-neutral-300">
                  Don&apos;t worry, try again!
                </p>
              </div>
            )}
          </>
        )}

        {/* Action Buttons for Failure / Retry */}
        {!isWin && (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <button
              onClick={onRetry}
              className="flex-1 w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-extrabold text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
            >
              {GAME_COPY.buttons.tryAgain}
            </button>

            <button
              onClick={onBackToMenu}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-sm transition-all cursor-pointer"
            >
              {GAME_COPY.buttons.finish}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
