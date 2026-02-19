import { useRef, useEffect, useCallback } from "react";
import { usePlayerOptional } from "@/contexts/PlayerContext";

const BAR_COUNT = 32;
const COLORS = [
  [255, 117, 31],
  [255, 140, 60],
  [255, 165, 90],
  [255, 180, 120],
  [220, 140, 255],
  [160, 100, 255],
  [100, 80, 255],
  [60, 60, 220],
];

function interpolateColor(t: number): [number, number, number] {
  const idx = t * (COLORS.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, COLORS.length - 1);
  const frac = idx - lo;
  return [
    Math.round(COLORS[lo][0] + (COLORS[hi][0] - COLORS[lo][0]) * frac),
    Math.round(COLORS[lo][1] + (COLORS[hi][1] - COLORS[lo][1]) * frac),
    Math.round(COLORS[lo][2] + (COLORS[hi][2] - COLORS[lo][2]) * frac),
  ];
}

export function HeaderSpectrum() {
  const player = usePlayerOptional();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const smoothedRef = useRef<Float32Array>(new Float32Array(BAR_COUNT).fill(0));
  const peaksRef = useRef<Float32Array>(new Float32Array(BAR_COUNT).fill(0));
  const peakDecayRef = useRef<Float32Array>(new Float32Array(BAR_COUNT).fill(0));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    const W = rect.width;
    const H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const analyser = player?.analyserNode;
    const isPlaying = player?.state?.isPlaying ?? false;

    const smoothed = smoothedRef.current;
    const peaks = peaksRef.current;
    const peakDecay = peakDecayRef.current;

    if (analyser && isPlaying) {
      const bufLen = analyser.frequencyBinCount;
      const data = new Uint8Array(bufLen);
      analyser.getByteFrequencyData(data);

      for (let i = 0; i < BAR_COUNT; i++) {
        const startBin = Math.floor((i / BAR_COUNT) * bufLen * 0.7);
        const endBin = Math.floor(((i + 1) / BAR_COUNT) * bufLen * 0.7);
        let sum = 0;
        let count = 0;
        for (let b = startBin; b < endBin && b < bufLen; b++) {
          sum += data[b];
          count++;
        }
        const raw = count > 0 ? sum / count / 255 : 0;
        const boost = i < BAR_COUNT * 0.3 ? 1.3 : i < BAR_COUNT * 0.6 ? 1.1 : 0.9;
        const target = Math.min(raw * boost, 1);
        smoothed[i] += (target - smoothed[i]) * 0.25;
      }
    } else {
      for (let i = 0; i < BAR_COUNT; i++) {
        smoothed[i] *= 0.92;
      }
    }

    const gap = 1.5;
    const barWidth = (W - (BAR_COUNT - 1) * gap) / BAR_COUNT;
    const maxBarH = H * 0.85;
    const baseY = H * 0.92;

    for (let i = 0; i < BAR_COUNT; i++) {
      const val = smoothed[i];
      const barH = Math.max(val * maxBarH, 1.5);
      const x = i * (barWidth + gap);
      const y = baseY - barH;

      const t = i / (BAR_COUNT - 1);
      const [r, g, b] = interpolateColor(t);

      const glow = val * 0.6;
      if (glow > 0.05) {
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${glow})`;
        ctx.shadowBlur = 6 * val;
      }

      const grad = ctx.createLinearGradient(x, y, x, baseY);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.9 + val * 0.1})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.3)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      const safeBarW = Math.max(barWidth, 0.5);
      const radius = Math.max(Math.min(safeBarW / 2, 2), 0);
      ctx.roundRect(x, y, safeBarW, barH, [radius, radius, 0, 0]);
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      if (val > peaks[i]) {
        peaks[i] = val;
        peakDecay[i] = 0;
      } else {
        peakDecay[i] += 0.008;
        peaks[i] = Math.max(peaks[i] - peakDecay[i], 0);
      }

      if (peaks[i] > 0.05) {
        const peakY = baseY - peaks[i] * maxBarH;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
        ctx.fillRect(x, peakY - 1.5, barWidth, 1.5);
      }
    }

    const mirrorH = H * 0.06;
    for (let i = 0; i < BAR_COUNT; i++) {
      const val = smoothed[i];
      const barH = Math.max(val * mirrorH, 0.5);
      const x = i * (barWidth + gap);

      const t = i / (BAR_COUNT - 1);
      const [r, g, b] = interpolateColor(t);

      const grad = ctx.createLinearGradient(x, baseY, x, baseY + barH);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.15)`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, baseY + 1, barWidth, barH);
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [player]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="h-[50px] w-[120px] opacity-90"
      style={{ imageRendering: "auto" }}
      data-testid="header-spectrum"
    />
  );
}
