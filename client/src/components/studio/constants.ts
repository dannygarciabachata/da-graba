import {
  Mic, Drum, Guitar, Music, Radio, Headphones
} from "lucide-react";

export const GENRE_DISPLAY: Record<string, string> = {
  Bachata: "DA GRABACHATA",
  Bolero: "DA GRABOLERO",
};

export const STEM_COLORS: Record<string, string> = {
  vocals: "#FF6B9D",
  drums: "#FFB347",
  bass: "#4ECDC4",
  other: "#A78BFA",
  recording: "#FF6B9D",
  instrumental: "#ff751f",
  master: "#ff751f",
};

export const STEM_ICONS: Record<string, typeof Mic> = {
  vocals: Mic,
  drums: Drum,
  bass: Guitar,
  other: Music,
  recording: Radio,
  instrumental: Music,
  master: Headphones,
};

export const CLIP_COLORS = [
  "#FF6B9D", "#FFB347", "#4ECDC4", "#A78BFA", "#ff751f",
  "#22d3ee", "#f43f5e", "#84cc16", "#f59e0b", "#8b5cf6",
];

export const LANE_HEIGHT = 80;
export const HEADER_WIDTH = 160;
export const PX_PER_MS = 0.08;

export const BACHATA_INSTRUMENTS = [
  { name: "Requinto", icon: "🎸", color: "#ff751f", type: "instrumental" },
  { name: "Segunda Guitarra", icon: "🎸", color: "#FFB347", type: "instrumental" },
  { name: "Bongo", icon: "🥁", color: "#FF6B9D", type: "drums" },
  { name: "Conga", icon: "🥁", color: "#f43f5e", type: "drums" },
  { name: "Güira", icon: "🪘", color: "#22d3ee", type: "drums" },
  { name: "Timbal", icon: "🥁", color: "#84cc16", type: "drums" },
  { name: "Campanas", icon: "🔔", color: "#f59e0b", type: "other" },
  { name: "Bajo", icon: "🎸", color: "#4ECDC4", type: "bass" },
  { name: "Piano", icon: "🎹", color: "#A78BFA", type: "instrumental" },
  { name: "Pad", icon: "🎹", color: "#8b5cf6", type: "other" },
  { name: "Violines", icon: "🎻", color: "#ec4899", type: "other" },
  { name: "Chelos", icon: "🎻", color: "#6366f1", type: "other" },
] as const;

export type BachataInstrument = typeof BACHATA_INSTRUMENTS[number];

export function formatTime(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function formatTimeMs(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const frac = Math.floor((totalSec % 1) * 10);
  return `${min}:${sec.toString().padStart(2, "0")}.${frac}`;
}
