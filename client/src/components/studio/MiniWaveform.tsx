import { useEffect, useRef } from "react";

interface MiniWaveformProps {
  buffer: AudioBuffer | null;
  color: string;
  width?: number;
  height?: number;
}

export function MiniWaveform({ buffer, color, width = 200, height = 40 }: MiniWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const mid = height / 2;

    ctx.beginPath();
    ctx.strokeStyle = `${color}80`;
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i++) {
      let min = 1.0, max = -1.0;
      for (let j = 0; j < step; j++) {
        const idx = i * step + j;
        if (idx < data.length) {
          if (data[idx] < min) min = data[idx];
          if (data[idx] > max) max = data[idx];
        }
      }
      ctx.moveTo(i, mid + min * mid);
      ctx.lineTo(i, mid + max * mid);
    }
    ctx.stroke();
  }, [buffer, color, width, height]);

  return <canvas ref={canvasRef} style={{ width, height }} className="rounded-sm" />;
}
