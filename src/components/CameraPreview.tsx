"use client";

import React, { useRef, useEffect } from "react";
import { Camera, CameraOff, Eye, Sparkles, RefreshCw } from "lucide-react";

interface CameraPreviewProps {
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isLive: boolean;
  isCapturingFrame: boolean;
  cameraActive: boolean;
  onToggleCamera: () => void;
  error?: string | null;
  className?: string;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  stream,
  videoRef,
  isLive,
  isCapturingFrame,
  cameraActive,
  onToggleCamera,
  error,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(() => {});
    }
  });

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col w-full rounded-2xl md:rounded-3xl overflow-hidden bg-slate-950 border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.1)] group ${
        className || "aspect-[4/3]"
      }`}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover -scale-x-100 transition-opacity duration-500 ${
          cameraActive && stream ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Fallback placeholder when camera is off/loading */}
      {(!cameraActive || !stream) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 text-slate-400 p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700/60 flex items-center justify-center mb-3 text-slate-500">
            <CameraOff className="w-8 h-8" />
          </div>
          <p className="text-sm font-medium text-slate-300">
            {error ? "Camera Error" : "Camera Inactive"}
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            {error || "Enable camera to allow Gemini 3.1 Flash to see booth visitors."}
          </p>
          <button
            onClick={onToggleCamera}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-950 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/60 flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)]"
          >
            <Camera className="w-3.5 h-3.5" />
            Enable Camera Feed
          </button>
        </div>
      )}

      {/* Scanline CRT overlay effect */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-20" />

      {/* Cyberpunk HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between">
        {/* Top bar HUD */}
        <div className="flex items-center justify-between gap-2">
          {/* Live Vision Badge */}
          <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <div className="relative flex h-2.5 w-2.5">
              {isLive && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isLive ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
            </div>
            <span className="text-[11px] font-mono font-bold tracking-wider text-cyan-300 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              LIVE VISION (3.1 FLASH)
            </span>
          </div>

          {/* FPS & Resolution HUD */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-700/60 text-[10px] font-mono text-slate-300">
            <span className="text-cyan-400 font-bold">1 FPS</span>
            <span className="text-slate-600">|</span>
            <span>320x240 @ 0.6q</span>
            <span className="w-1.5 h-1.5 rounded-full ml-1 bg-emerald-400" />
          </div>
        </div>

        {/* Center Target Crosshairs */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
          <div className="relative w-28 h-28 border border-cyan-500/30 rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#06b6d4]" />
            <div className="absolute top-0 w-3 h-0.5 bg-cyan-400" />
            <div className="absolute bottom-0 w-3 h-0.5 bg-cyan-400" />
            <div className="absolute left-0 h-3 w-0.5 bg-cyan-400" />
            <div className="absolute right-0 h-3 w-0.5 bg-cyan-400" />
          </div>
        </div>

        {/* Corner HUD Brackets */}
        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400/80" />
        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400/80" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400/80" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400/80" />

        {/* Bottom bar HUD */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 pointer-events-auto">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">Recruitment Visual Feed</span>
          </div>

          <button
            onClick={onToggleCamera}
            className="hover:text-cyan-300 transition-colors flex items-center gap-1.5 text-xs text-cyan-400 font-sans"
            title={cameraActive ? "Turn off camera" : "Turn on camera"}
          >
            {cameraActive ? (
              <>
                <CameraOff className="w-3.5 h-3.5" />
                <span>Mute Vision</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Enable</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
