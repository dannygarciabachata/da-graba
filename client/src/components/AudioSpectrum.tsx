import { useEffect, useRef } from "react";
import { usePlayer } from "@/contexts/PlayerContext";

interface AudioSpectrumProps {
  songId: number;
  className?: string;
  barCount?: number;
  barColor?: string;
}

export function AudioSpectrum({ songId, className = "", barCount = 5, barColor = "#ff751f" }: AudioSpectrumProps) {
  const { state, analyserNode } = usePlayer();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const isActive = state.currentSong?.id === songId && state.isPlaying;

  useEffect(() => {
    if (!isActive || !analyserNode || !canvasRef.current) {
      cancelAnimationFrame(rafRef.current);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyserNode.getByteFrequencyData(dataArray);

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const gap = 2;
      const barW = Math.max(2, (w - gap * (barCount - 1)) / barCount);
      const step = Math.max(1, Math.floor(dataArray.length / barCount));

      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i * step] / 255;
        const barH = Math.max(2, val * h * 0.9);
        const x = i * (barW + gap);
        const y = h - barH;

        ctx.fillStyle = barColor;
        ctx.globalAlpha = 0.7 + val * 0.3;
        ctx.beginPath();
        const safeW = Math.max(barW, 0.5);
        ctx.roundRect(x, y, safeW, barH, Math.min(1, safeW / 2));
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, analyserNode, barCount, barColor]);

  if (!isActive) return null;

  return (
    <div className={`absolute inset-0 flex items-end justify-center bg-black/50 ${className}`} data-testid={`spectrum-${songId}`}>
      <canvas
        ref={canvasRef}
        width={40}
        height={32}
        className="w-[70%] h-[60%] mb-[10%]"
      />
    </div>
  );
}
