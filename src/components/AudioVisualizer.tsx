"use client";

import React, { useRef, useEffect } from "react";
import { Mic, Volume2, Bot, Radio } from "lucide-react";

interface AudioVisualizerProps {
  micAnalyser: AnalyserNode | null;
  agentAnalyser: AnalyserNode | null;
  isAgentSpeaking: boolean;
  isUserSpeaking: boolean;
  isMicMuted: boolean;
  isConnected: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  micAnalyser,
  agentAnalyser,
  isAgentSpeaking,
  isUserSpeaking,
  isMicMuted,
  isConnected,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const micDataArray = micAnalyser ? new Uint8Array(micAnalyser.frequencyBinCount) : null;
    const agentDataArray = agentAnalyser ? new Uint8Array(agentAnalyser.frequencyBinCount) : null;

    let phase = 0;

    const render = () => {
      animationId = requestAnimationFrame(render);
      phase += 0.05;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Background subtle gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, "rgba(2, 6, 23, 0.9)");
      bgGrad.addColorStop(1, "rgba(15, 23, 42, 0.9)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = "rgba(6, 182, 212, 0.07)";
      ctx.lineWidth = 1;
      const gridSize = 24;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Read audio data
      let micEnergy = 0;
      if (micAnalyser && micDataArray && !isMicMuted) {
        micAnalyser.getByteFrequencyData(micDataArray);
        const sum = micDataArray.reduce((acc, val) => acc + val, 0);
        micEnergy = sum / micDataArray.length / 255;
      }

      let agentEnergy = 0;
      if (agentAnalyser && agentDataArray) {
        agentAnalyser.getByteFrequencyData(agentDataArray);
        const sum = agentDataArray.reduce((acc, val) => acc + val, 0);
        agentEnergy = sum / agentDataArray.length / 255;
      }

      // Draw center visualizer
      const centerY = height / 2;

      if (!isConnected) {
        // Standby idle wave
        ctx.beginPath();
        ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
        ctx.lineWidth = 2;
        for (let x = 0; x < width; x++) {
          const y = centerY + Math.sin(x * 0.02 + phase) * 4;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        return;
      }

      if (isAgentSpeaking || agentEnergy > 0.05) {
        // AGENT SPEAKING: Glowing Neon Waveform + Particle Rings
        const waveCount = 3;
        for (let w = 0; w < waveCount; w++) {
          ctx.beginPath();
          ctx.lineWidth = 2.5;
          const alpha = 0.8 - w * 0.25;
          ctx.strokeStyle = w === 0 ? `rgba(6, 182, 212, ${alpha})` : `rgba(168, 85, 247, ${alpha})`;
          ctx.shadowBlur = 15;
          ctx.shadowColor = w === 0 ? "#06b6d4" : "#a855f7";

          const amp = Math.max(12, agentEnergy * 90) * (1 - w * 0.25);
          const freq = 0.015 + w * 0.005;

          for (let x = 0; x < width; x += 3) {
            const normalX = x / width;
            const windowFactor = Math.sin(Math.PI * normalX); // taper at ends
            const waveY = centerY + Math.sin(x * freq + phase * (w + 1)) * amp * windowFactor;
            if (x === 0) ctx.moveTo(x, waveY);
            else ctx.lineTo(x, waveY);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Agent Neural Orb in Center
        const orbRadius = 14 + agentEnergy * 28;
        const orbGrad = ctx.createRadialGradient(width / 2, centerY, 2, width / 2, centerY, orbRadius);
        orbGrad.addColorStop(0, "rgba(6, 240, 255, 0.9)");
        orbGrad.addColorStop(0.5, "rgba(168, 85, 247, 0.6)");
        orbGrad.addColorStop(1, "rgba(6, 182, 212, 0)");

        ctx.fillStyle = orbGrad;
        ctx.beginPath();
        ctx.arc(width / 2, centerY, orbRadius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // USER / AMBIENT MIC FREQUENCY SPECTRUM
        const barCount = 48;
        const barWidth = width / barCount - 2;
        const binStep = micDataArray ? Math.floor(micDataArray.length / barCount) : 1;

        for (let i = 0; i < barCount; i++) {
          const binIndex = i * binStep;
          const rawVal = micDataArray && !isMicMuted ? micDataArray[binIndex] || 0 : 0;
          const norm = rawVal / 255;

          // Gentle ambient breathing idle height if low energy
          const idleWave = Math.sin(i * 0.3 + phase) * 3 + 4;
          const barHeight = Math.max(idleWave, norm * (height * 0.75));

          const x = i * (barWidth + 2);
          const y = centerY - barHeight / 2;

          // Gradient for mic bars
          const barGrad = ctx.createLinearGradient(x, y, x, y + barHeight);
          if (isUserSpeaking || micEnergy > 0.08) {
            barGrad.addColorStop(0, "#10b981");
            barGrad.addColorStop(0.5, "#06b6d4");
            barGrad.addColorStop(1, "#3b82f6");
          } else {
            barGrad.addColorStop(0, "rgba(6, 182, 212, 0.4)");
            barGrad.addColorStop(1, "rgba(30, 41, 59, 0.6)");
          }

          ctx.fillStyle = barGrad;
          ctx.fillRect(x, y, barWidth, barHeight);
        }

        // Center baseline glowing axis
        ctx.beginPath();
        ctx.strokeStyle = "rgba(6, 182, 212, 0.3)";
        ctx.lineWidth = 1;
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [micAnalyser, agentAnalyser, isAgentSpeaking, isUserSpeaking, isMicMuted, isConnected]);

  return (
    <div className="relative flex flex-col w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
      {/* Top status header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-xs font-mono">
        <div className="flex items-center gap-2">
          {isAgentSpeaking ? (
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold animate-pulse">
              <Bot className="w-4 h-4 text-cyan-400" />
              <span>GEMINI TALKING (24kHz PCM)</span>
            </div>
          ) : isUserSpeaking ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Mic className="w-4 h-4 text-emerald-400" />
              <span>VISITOR SPEAKING (16kHz PCM)</span>
            </div>
          ) : isMicMuted ? (
            <div className="flex items-center gap-1.5 text-amber-400">
              <Mic className="w-4 h-4 text-amber-400 opacity-50" />
              <span>MIC MUTED</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-400">
              <Radio className="w-4 h-4 text-cyan-500 animate-pulse" />
              <span>LISTENING FOR PASSERSBY...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            Barge-in: <strong className="text-emerald-400">ON</strong>
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative w-full h-32 md:h-36">
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          className="w-full h-full block"
        />

        {/* Dynamic status pill */}
        <div className="absolute bottom-2 left-3 pointer-events-none">
          {isAgentSpeaking && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950/90 border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              AI Voice Streaming
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
