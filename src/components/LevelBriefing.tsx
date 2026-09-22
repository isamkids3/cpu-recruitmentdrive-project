"use client";

import React, { useEffect, useState } from "react";
import { PublicLevel } from "@/lib/publicLevels";
import { GAME_COPY } from "@/lib/copy";

interface LevelBriefingProps {
  level: PublicLevel;
  onComplete: () => void;
}

export function LevelBriefing({ level, onComplete }: LevelBriefingProps) {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimeout(onComplete, 300);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      {/* Level Tag */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-4">
        <span>Level {level.id}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span>{level.codename}</span>
      </div>

      <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4 max-w-2xl">
        {level.codename}
      </h1>

      <p className="text-lg md:text-xl text-neutral-300 font-medium max-w-xl mb-8 leading-relaxed">
        {level.tagline}
      </p>

      {/* Target Clue & Constraints */}
      <div className="grid grid-cols-2 gap-4 max-w-md w-full mb-10 text-left">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
            Guard Role
          </div>
          <div className="text-sm font-medium text-neutral-200">
            {level.codename}
          </div>
        </div>
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
            Time & Guesses
          </div>
          <div className="text-sm font-medium text-neutral-200">
            {level.timeLimitSec}s • {level.maxGuesses} Guesses
          </div>
        </div>
      </div>

      {/* 3-2-1 Countdown Circle */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-20 h-20 rounded-full flex items-center justify-center bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.4)]">
          <span className="text-4xl font-black text-cyan-300 animate-bounce">
            {countdown > 0 ? countdown : "GO!"}
          </span>
        </div>
        <span className="text-xs uppercase tracking-widest text-neutral-400 font-mono">
          Starting in {countdown}s...
        </span>
      </div>
    </div>
  );
}
