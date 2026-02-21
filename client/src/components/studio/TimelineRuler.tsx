import { useEffect, useRef } from "react";

interface TimelineRulerProps {
  durationMs: number;
  currentTimeMs: number;
  bpm: number;
  pxPerMs: number;
  offsetMs?: number;
}

export function TimelineRuler({ durationMs, currentTimeMs, bpm, pxPerMs, offsetMs = 0 }: TimelineRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, w, h);

    if (durationMs <= 0) return;

    const beatMs = 60000 / bpm;
    const barMs = beatMs * 4;

    ctx.strokeStyle = "#333";
    ctx.fillStyle = "#666";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";

    for (let ms = 0; ms <= durationMs; ms += barMs) {
      const x = (ms - offsetMs) * pxPerMs;
      if (x < 0 || x > w) continue;
      const barNum = Math.floor(ms / barMs) + 1;

      ctx.beginPath();
      ctx.moveTo(x, h - 8);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.fillText(`${barNum}`, x, h - 10);

      for (let b = 1; b < 4; b++) {
        const bx = (ms + beatMs * b - offsetMs) * pxPerMs;
        if (bx > 0 && bx < w) {
          ctx.beginPath();
          ctx.moveTo(bx, h - 4);
          ctx.lineTo(bx, h);
          ctx.stroke();
        }
      }
    }

    const playX = (currentTimeMs - offsetMs) * pxPerMs;
    if (playX >= 0 && playX <= w) {
      ctx.beginPath();
      ctx.fillStyle = "#ff751f";
      ctx.moveTo(playX - 5, 0);
      ctx.lineTo(playX + 5, 0);
      ctx.lineTo(playX, 8);
      ctx.fill();
    }
  }, [durationMs, currentTimeMs, bpm, pxPerMs, offsetMs]);

  return <canvas ref={canvasRef} className="w-full" style={{ height: 28 }} />;
}
