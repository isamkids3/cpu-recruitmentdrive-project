"use client";

import React from "react";
import { Trophy, Award, Medal, Clock, ShieldCheck } from "lucide-react";
import { LeaderboardEntry } from "@/lib/leaderboardStore";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  loading?: boolean;
  highlightHandle?: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  entries,
  loading = false,
  highlightHandle,
}) => {
  if (loading && entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-400 font-mono text-xs">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-2" />
        <span>Loading rankings...</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-500 font-mono text-xs text-center border border-slate-800/60 rounded-2xl bg-slate-950/40">
        <Trophy className="w-8 h-8 text-slate-700 mb-2" />
        <p>No champions yet!</p>
        <p className="text-[11px] text-slate-600 mt-0.5">Be the first to outsmart VAULT-9 and claim #1.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-2 font-mono">
      {entries.map((entry, idx) => {
        const rank = idx + 1;
        const isHighlighted = highlightHandle && entry.handle.toLowerCase() === highlightHandle.toLowerCase();

        return (
          <div
            key={`${entry.handle}-${entry.ts}-${idx}`}
            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
              isHighlighted
                ? "bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400"
                : rank === 1
                ? "bg-amber-950/30 border-amber-500/40 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                : rank === 2
                ? "bg-slate-900 border-slate-700 text-slate-200"
                : rank === 3
                ? "bg-amber-950/20 border-amber-700/30 text-amber-300/90"
                : "bg-slate-950/60 border-slate-800/80 text-slate-300"
            }`}
          >
            {/* Left: Rank & Handle */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-6 flex items-center justify-center font-bold text-xs shrink-0">
                {rank === 1 ? (
                  <Trophy className="w-4 h-4 text-amber-400" />
                ) : rank === 2 ? (
                  <Award className="w-4 h-4 text-slate-300" />
                ) : rank === 3 ? (
                  <Medal className="w-4 h-4 text-amber-600" />
                ) : (
                  <span className="text-slate-500">#{rank}</span>
                )}
              </div>

              <div className="flex flex-col min-w-0">
                <span className="font-bold text-xs truncate text-slate-100">{entry.handle}</span>
                <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  {entry.levelsCleared} {entry.levelsCleared === 1 ? "level" : "levels"} cleared
                </span>
              </div>
            </div>

            {/* Right: Score & Time */}
            <div className="flex flex-col items-end shrink-0 pl-2">
              <span className="text-xs font-bold text-cyan-300">{entry.totalPoints.toLocaleString()} pts</span>
              {entry.totalElapsedSec > 0 && (
                <span className="text-[10px] text-slate-500 flex items-center gap-0.5 mt-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {entry.totalElapsedSec}s
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
