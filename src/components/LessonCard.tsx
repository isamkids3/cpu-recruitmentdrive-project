"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Sparkles, ArrowRight, ShieldAlert, Users, CheckCircle2 } from "lucide-react";
import { GAME_COPY } from "@/lib/copy";

interface LessonCardProps {
  level: number;
  points: number;
  decoyTripped?: boolean;
  onNextLevel?: () => void;
  isFinalLevel?: boolean;
  onFinish?: () => void;
}

export const LessonCard: React.FC<LessonCardProps> = ({
  level,
  points,
  decoyTripped = false,
  onNextLevel,
  isFinalLevel = false,
  onFinish,
}) => {
  const lesson = GAME_COPY.lessons[level] || {
    plain: "You successfully persuaded the guard to reveal the secret phrase!",
    technicalName: "security research",
  };

  const explanation = decoyTripped && lesson.decoyVariant ? lesson.decoyVariant : lesson.plain;

  const clubName = process.env.NEXT_PUBLIC_CLUB_NAME || "CPU";
  const meetingInfo = process.env.NEXT_PUBLIC_MEETING_INFO || "CS Club @ HWUM";
  const signupUrl = process.env.NEXT_PUBLIC_SIGNUP_URL || "https://google.com";

  return (
    <div className="w-full flex flex-col gap-4 font-mono text-slate-200">
      {/* Top Banner: Success & Points Awarded */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-cyan-950/80 border border-emerald-500/40 flex items-center justify-between shadow-[0_0_25px_rgba(16,185,129,0.2)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">🎉 YOU DID IT!</h3>
            <p className="text-xs text-emerald-300 mt-0.5">Level {level} security bypassed</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 uppercase tracking-widest block">Earned</span>
          <span className="text-lg font-bold text-cyan-300">+{points} pts</span>
        </div>
      </div>

      {/* Center: What You Just Did Lesson Breakdown */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <span>WHAT YOU JUST DID</span>
        </div>

        <p className="text-sm font-sans leading-relaxed text-slate-200">{explanation}</p>

        <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Real name:</span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-950/90 border border-cyan-500/40 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
            {lesson.technicalName}
          </span>
        </div>
      </div>

      {/* Bottom: Club Plug & Dynamic Signup QR */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <Users className="w-4 h-4" />
            <span>Join {clubName}</span>
          </div>
          <p className="text-slate-400 text-[11px] font-sans leading-snug">
            Want to learn all about coding? Join CPU.
          </p>
        </div>

        {/* QR Code Container */}
        <div className="p-2 bg-white rounded-xl shrink-0 shadow-md">
          <QRCodeSVG value={signupUrl} size={68} level="M" />
        </div>
      </div>

      {/* Action Navigation */}
      <div className="flex items-center gap-3 pt-1">
        {onFinish && (
          <button
            onClick={onFinish}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-all"
          >
            {GAME_COPY.buttons.finish}
          </button>
        )}

        {!isFinalLevel && onNextLevel ? (
          <button
            onClick={onNextLevel}
            className="flex-[2] py-3.5 px-5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all transform active:scale-[0.98]"
          >
            <span>{GAME_COPY.buttons.nextLevel}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onFinish}
            className="flex-[2] py-3.5 px-5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all transform active:scale-[0.98]"
          >
            <span>Save Score & Finish</span>
            <Sparkles className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
