"use client";

import React, { useEffect, useState } from "react";
import { LeaderboardEntry } from "@/lib/leaderboardStore";
import { QRCodeSVG } from "qrcode.react";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.leaderboard || []);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  const signupUrl =
    process.env.NEXT_PUBLIC_SIGNUP_URL || "https://csclub.dev";
  const clubName =
    process.env.NEXT_PUBLIC_CLUB_NAME || "Computer Science Club";

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col p-6 md:p-12 relative overflow-hidden font-sans selection:bg-cyan-500 selection:text-black">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-cyan-600/10 blur-[150px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[400px] bg-blue-600/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Header */}
      <header className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between pb-8 border-b border-neutral-800 gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold uppercase tracking-widest mb-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Live Booth Leaderboard
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white flex items-center gap-3">
            <span>VAULT-9 Wall of Fame</span>
            <span className="text-2xl md:text-3xl">🏆</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Top scores from visitors who outsmarted the robot guard.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right font-mono">
            <div className="text-[11px] text-neutral-500 uppercase tracking-wider">
              Auto-updating (5s)
            </div>
            <div className="text-xs text-neutral-400">
              {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid: Leaderboard (Left) + Club QR Card (Right) */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8 flex-1">
        {/* Left 2 Cols: Leaderboard Table */}
        <div className="lg:col-span-2 bg-neutral-900/60 backdrop-blur-xl border border-neutral-800/80 rounded-3xl p-6 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-800 text-xs font-mono uppercase tracking-wider text-neutral-400">
            <div className="flex items-center gap-4">
              <span className="w-8 text-center">Rank</span>
              <span>Visitor Nickname</span>
            </div>
            <div className="flex items-center gap-8">
              <span className="hidden sm:inline">Cleared</span>
              <span className="w-20 text-right">Points</span>
            </div>
          </div>

          <div className="flex-1 divide-y divide-neutral-800/50 overflow-y-auto mt-2 space-y-1">
            {isLoading ? (
              <div className="py-20 text-center text-neutral-500 font-mono text-sm">
                Loading scores...
              </div>
            ) : entries.length === 0 ? (
              <div className="py-20 text-center text-neutral-500 flex flex-col items-center gap-3">
                <span className="text-3xl">🤖</span>
                <p className="font-mono text-sm">
                  No guard breaches yet. Be the first to crack VAULT-9!
                </p>
              </div>
            ) : (
              entries.map((entry, idx) => {
                const rank = idx + 1;
                return (
                  <div
                    key={`${entry.handle}-${entry.ts}-${idx}`}
                    className={`flex items-center justify-between py-3.5 px-3 rounded-2xl transition-all ${
                      rank === 1
                        ? "bg-amber-500/10 border border-amber-500/30 text-amber-200"
                        : rank === 2
                        ? "bg-slate-300/10 border border-slate-300/20 text-slate-200"
                        : rank === 3
                        ? "bg-amber-700/10 border border-amber-700/20 text-amber-300"
                        : "hover:bg-neutral-800/40 text-neutral-300"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-8 h-8 rounded-xl font-mono font-black text-sm flex items-center justify-center ${
                          rank === 1
                            ? "bg-amber-400 text-black shadow-[0_0_12px_rgba(251,191,36,0.6)]"
                            : rank === 2
                            ? "bg-slate-300 text-black"
                            : rank === 3
                            ? "bg-amber-700 text-white"
                            : "bg-neutral-800 text-neutral-400"
                        }`}
                      >
                        {rank}
                      </div>
                      <div>
                        <span className="font-bold text-white tracking-wide text-base">
                          {entry.handle}
                        </span>
                        <div className="text-[10px] font-mono text-neutral-500">
                          {new Date(entry.ts).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8 font-mono">
                      <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-neutral-800/80 border border-neutral-700 text-xs text-cyan-300 font-semibold">
                        {entry.levelsCleared} {entry.levelsCleared === 1 ? "Level" : "Levels"}
                      </span>
                      <span
                        className={`w-20 text-right text-lg font-black ${
                          rank === 1
                            ? "text-amber-400"
                            : rank <= 3
                            ? "text-cyan-300"
                            : "text-white"
                        }`}
                      >
                        {entry.totalPoints}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 1 Col: Club Info & QR Code */}
        <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800/80 rounded-3xl p-6 shadow-2xl flex flex-col justify-between items-center text-center">
          <div className="w-full flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-2xl mb-4 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
              ⚡
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{clubName}</h2>
            <p className="text-xs text-neutral-400 max-w-xs mb-6">
              Learn how AI agents work, how prompt defense is engineered, and build your own LLM applications with us!
            </p>

            {/* QR Code Container */}
            <div className="p-4 bg-white rounded-2xl shadow-xl flex flex-col items-center mb-4">
              <QRCodeSVG
                value={signupUrl}
                size={180}
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level={"H"}
              />
            </div>

            <span className="text-xs font-mono font-semibold text-cyan-400 tracking-wider uppercase">
              Scan to Join {clubName}
            </span>
          </div>

          <div className="w-full pt-6 border-t border-neutral-800 mt-6 text-center">
            <div className="text-[11px] font-mono text-neutral-500">
              Interactive Booth System v2.0
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
