import { useEffect, useRef } from "react";

interface VUMeterProps {
  getLevel: () => number;
  height?: number;
}

export function VUMeter({ getLevel, height = 120 }: VUMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(0);
  const peakRef = useRef(0);
  const peakHoldRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    const draw = () => {
      const raw = getLevel();
      levelRef.current += (raw - levelRef.current) * 0.3;
      const level = levelRef.current;
      if (level > peakRef.current) {
        peakRef.current = level;
        peakHoldRef.current = 30;
      } else if (peakHoldRef.current > 0) {
        peakHoldRef.current--;
      } else {
        peakRef.current *= 0.95;
      }
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, "#22c55e");
      grad.addColorStop(0.6, "#eab308");
      grad.addColorStop(0.85, "#f97316");
      grad.addColorStop(1, "#ef4444");
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, w, h);
      const barH = level * h;
      ctx.fillStyle = grad;
      ctx.fillRect(1, h - barH, w - 2, barH);
      const peakY = h - peakRef.current * h;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(1, peakY, w - 2, 2);
      for (let i = 0; i < h; i += 3) {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(0, i, w, 1);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [getLevel]);

  return <canvas ref={canvasRef} width={14} height={height} className="rounded-sm" style={{ width: 14, height }} />;
}
