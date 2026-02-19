import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSongs } from "@/hooks/use-songs";
import { useSongTracks, useSeparateStems, useUpdateTrack, useCreateTrack, useMasterSong, useDenoiseSong, useCoverSong, useTrimSong } from "@/hooks/use-tracks";
import { useAudioEngine } from "@/hooks/use-audio-engine";
import { useStripeSubscription } from "@/hooks/use-stripe";
import { useDawClips, useCreateDawClip, useUpdateDawClip, useDeleteDawClip, useRecordAudio, SNAP_VALUES, snapToGrid } from "@/hooks/use-daw";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play, Pause, Square, Volume2, VolumeX, Mic, Drum,
  Guitar, Music, Loader2, Scissors, Download, SkipBack,
  Sparkles, Shield, MicVocal, ChevronDown, ChevronUp,
  Repeat, Package, PanelRightClose, PanelRightOpen,
  Plus, Trash2, GripVertical, Radio, CircleDot, Grid3X3,
  Piano, Waves, Wand2, SlidersVertical, Headphones,
  ArrowRight, CheckCircle2, Circle, XCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import type { Track, DawClip } from "@shared/schema";
import JSZip from "jszip";
import { useTranslation } from "react-i18next";
import type { EQSettings, CompressorSettings, ReverbSettings } from "@/hooks/use-audio-engine";

const GENRE_DISPLAY: Record<string, string> = {
  Bachata: "DA GRABACHATA",
  Bolero: "DA GRABOLERO",
};

const STEM_COLORS: Record<string, string> = {
  vocals: "#FF6B9D",
  drums: "#FFB347",
  bass: "#4ECDC4",
  other: "#A78BFA",
  recording: "#FF6B9D",
  instrumental: "#ff751f",
  master: "#ff751f",
};

const STEM_ICONS: Record<string, typeof Mic> = {
  vocals: Mic,
  drums: Drum,
  bass: Guitar,
  other: Music,
  recording: Radio,
  instrumental: Music,
  master: Headphones,
};

const CLIP_COLORS = [
  "#FF6B9D", "#FFB347", "#4ECDC4", "#A78BFA", "#ff751f",
  "#22d3ee", "#f43f5e", "#84cc16", "#f59e0b", "#8b5cf6",
];

const LANE_HEIGHT = 80;
const HEADER_WIDTH = 160;
const PX_PER_MS = 0.08;

const BACHATA_INSTRUMENTS = [
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
];

function VUMeter({ getLevel, height = 120 }: { getLevel: () => number; height?: number }) {
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

function MiniWaveform({ buffer, color, width = 200, height = 40 }: { buffer: AudioBuffer | null; color: string; width?: number; height?: number }) {
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

function TimelineRuler({ durationMs, currentTimeMs, bpm, pxPerMs, offsetMs = 0 }: { durationMs: number; currentTimeMs: number; bpm: number; pxPerMs: number; offsetMs?: number }) {
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

function ClipBlock({ clip, pxPerMs, snapMs, onUpdate, onDelete, color }: {
  clip: DawClip;
  pxPerMs: number;
  snapMs: number;
  onUpdate: (data: Partial<DawClip>) => void;
  onDelete: () => void;
  color: string;
}) {
  const clipWidth = Math.max(30, (clip.durationMs || 2000) * pxPerMs);
  const clipLeft = (clip.startTimeMs || 0) * pxPerMs;
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, startTimeMs: 0 });

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, startTimeMs: clip.startTimeMs || 0 };

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStartRef.current.x;
      const newMs = Math.max(0, dragStartRef.current.startTimeMs + dx / pxPerMs);
      const snapped = snapToGrid(newMs, snapMs);
      onUpdate({ startTimeMs: Math.round(snapped) });
    };
    const handleUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 rounded-md border cursor-grab select-none flex items-center overflow-hidden group",
        isDragging && "opacity-70 cursor-grabbing z-20"
      )}
      style={{
        left: clipLeft,
        width: clipWidth,
        borderColor: `${color}60`,
        backgroundColor: `${color}20`,
      }}
      onMouseDown={handleDragStart}
      data-testid={`clip-block-${clip.id}`}
    >
      <div className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(135deg, ${color}40 0%, transparent 60%)` }} />
      <div className="flex items-center gap-1 px-1.5 relative z-10 min-w-0">
        <GripVertical className="w-3 h-3 flex-shrink-0 opacity-50" />
        <span className="text-[9px] font-medium truncate">{clip.name}</span>
      </div>
      <button
        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        data-testid={`button-delete-clip-${clip.id}`}
      >
        <Trash2 className="w-2.5 h-2.5 text-red-400" />
      </button>
    </div>
  );
}

function TrackLane({ track, clips, engine, pxPerMs, snapMs, onUpdateClip, onDeleteClip, anySoloed, isActive, onSelect }: {
  track: Track;
  clips: DawClip[];
  engine: ReturnType<typeof useAudioEngine>;
  pxPerMs: number;
  snapMs: number;
  onUpdateClip: (clipId: number, data: Partial<DawClip>) => void;
  onDeleteClip: (clipId: number) => void;
  anySoloed: boolean;
  isActive: boolean;
  onSelect: () => void;
}) {
  const Icon = STEM_ICONS[track.type] || Music;
  const color = STEM_COLORS[track.type] || "#A78BFA";
  const isSoloedByOther = anySoloed && !track.isSolo;
  const isPending = track.status === "pending" || track.status === "processing";
  const buffer = track.status === "completed" ? engine.getTrackBuffer(track.id) : null;
  const engineTrack = engine.tracks.get(track.id);
  const vol = engineTrack?.volume ?? (track.volume ?? 100) / 100;

  return (
    <div
      className={cn(
        "flex border-b border-white/5 bg-[#111] overflow-visible relative cursor-pointer transition-colors",
        isSoloedByOther && !track.isMuted && "opacity-40",
        isActive && "ring-1 ring-[#ff751f]/50 bg-[#ff751f]/5"
      )}
      style={{ height: LANE_HEIGHT }}
      onClick={onSelect}
      data-testid={`track-lane-${track.id}`}
    >
      <div
        className="flex flex-col items-center justify-center gap-1 px-2 border-r border-white/5 flex-shrink-0"
        style={{ width: HEADER_WIDTH, backgroundColor: isActive ? `${color}15` : `${color}08` }}
      >
        <div className="flex items-center gap-1.5 w-full">
          <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-medium truncate block" data-testid={`text-track-name-${track.id}`}>
              {track.name}
            </span>
            <span className="text-[8px] text-muted-foreground">{track.type}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 w-full">
          <button
            className={cn("w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center transition-colors",
              track.isMuted ? "bg-red-500/80 text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            )}
            onClick={(e) => { e.stopPropagation(); engine.setTrackMute(track.id, !track.isMuted); }}
            data-testid={`button-mute-${track.id}`}
          >M</button>
          <button
            className={cn("w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center transition-colors",
              track.isSolo ? "bg-yellow-500/80 text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            )}
            onClick={(e) => { e.stopPropagation(); engine.setTrackSolo(track.id, !track.isSolo); }}
            data-testid={`button-solo-${track.id}`}
          >S</button>
          <div className="flex-1 mx-1">
            <Slider
              value={[vol * 100]}
              max={100}
              step={1}
              onValueChange={(v) => engine.setTrackVolume(track.id, v[0] / 100)}
              className="w-full"
              data-testid={`slider-track-vol-${track.id}`}
            />
          </div>
          <VUMeter getLevel={() => engine.getTrackMeter(track.id)} height={20} />
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {isPending ? (
          <div className="h-full flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Procesando...</span>
          </div>
        ) : buffer ? (
          <div className="absolute inset-0 opacity-30">
            <MiniWaveform buffer={buffer} color={color} width={800} height={LANE_HEIGHT - 8} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground/50">Sin audio - Genera o graba para este track</span>
          </div>
        )}

        {clips.map((clip) => (
          <ClipBlock
            key={clip.id}
            clip={clip}
            pxPerMs={pxPerMs}
            snapMs={snapMs}
            color={CLIP_COLORS[(clip.laneIndex || 0) % CLIP_COLORS.length]}
            onUpdate={(data) => onUpdateClip(clip.id, data)}
            onDelete={() => onDeleteClip(clip.id)}
          />
        ))}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function formatTimeMs(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const frac = Math.floor((totalSec % 1) * 10);
  return `${min}:${sec.toString().padStart(2, "0")}.${frac}`;
}

export default function StudioPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: songs, isLoading: songsLoading } = useSongs();
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const { data: songTracks, isLoading: tracksLoading } = useSongTracks(selectedSongId);
  const { data: dawClips } = useDawClips(selectedSongId);
  const { mutate: createClip } = useCreateDawClip();
  const { mutate: updateClip } = useUpdateDawClip();
  const { mutate: deleteClip } = useDeleteDawClip();
  const { mutate: recordAudio, isPending: isRecordingSaving } = useRecordAudio();
  const { mutate: separateStems, isPending: isSeparating } = useSeparateStems();
  const { mutate: createTrack, isPending: isCreatingTrack } = useCreateTrack();
  const { mutate: updateTrack } = useUpdateTrack();
  const { mutate: masterSong, isPending: isMastering } = useMasterSong();
  const { mutate: denoiseSong, isPending: isDenoising } = useDenoiseSong();
  const { mutate: coverSong, isPending: isCovering } = useCoverSong();
  const { mutate: trimSong, isPending: isTrimming } = useTrimSong();
  const { data: subData } = useStripeSubscription();
  const userTier = subData?.tier || "free";
  const canUseStemSeparation = userTier === "pro" || userTier === "premium" || userTier === "producer" || user?.role === "super_admin" || user?.role === "admin";

  const engine = useAudioEngine();

  const [showMixer, setShowMixer] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [coverVoice, setCoverVoice] = useState("");
  const [trimStart, setTrimStart] = useState("");
  const [trimEnd, setTrimEnd] = useState("");
  const [bpm, setBpm] = useState(130);
  const [snapIndex, setSnapIndex] = useState(3);
  const snapMs = SNAP_VALUES[snapIndex]?.ms || 0;
  const [sidebarTab, setSidebarTab] = useState("instruments");
  const [activeTrackId, setActiveTrackId] = useState<number | null>(null);

  const completedSongs = songs?.filter((s) => s.status === "completed" && s.audioUrl) ?? [];
  const selectedSong = completedSongs.find((s) => s.id === selectedSongId);
  const hasTracks = songTracks && songTracks.length > 0;
  const allTracksReady = songTracks?.every((t) => t.status === "completed") ?? false;
  const completedTracks = songTracks?.filter((t) => t.status === "completed" && t.audioUrl) ?? [];
  const anySoloed = songTracks?.some((t) => t.isSolo) ?? false;
  const activeTrack = songTracks?.find((t) => t.id === activeTrackId);
  const activeEngineTrack = activeTrackId ? engine.tracks.get(activeTrackId) : null;

  const totalDurationMs = useMemo(() => {
    const trackDur = engine.transport.duration * 1000;
    const clipMaxMs = dawClips?.reduce((max, c) => Math.max(max, (c.startTimeMs || 0) + (c.durationMs || 0)), 0) || 0;
    return Math.max(trackDur, clipMaxMs, 30000);
  }, [engine.transport.duration, dawClips]);

  useEffect(() => {
    if (!completedTracks.length) return;
    completedTracks.forEach((track) => {
      if (track.audioUrl) {
        engine.loadTrack(track.id, track.audioUrl, track.name, track.type);
      }
    });
  }, [completedTracks.map((t) => `${t.id}:${t.audioUrl}`).join(",")]);

  useEffect(() => {
    if (activeTrackId && songTracks && !songTracks.find((t) => t.id === activeTrackId)) {
      setActiveTrackId(null);
    }
  }, [songTracks, activeTrackId]);

  const handleSeparate = () => {
    if (selectedSongId) separateStems(selectedSongId);
  };

  const handleAddInstrumentTrack = (instrument: typeof BACHATA_INSTRUMENTS[0]) => {
    if (!selectedSongId) return;
    createTrack({
      songId: selectedSongId,
      name: instrument.name,
      type: instrument.type,
    });
  };

  const handleStartRecording = async () => {
    try {
      await engine.startRecording();
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const handleStopRecording = async () => {
    if (!selectedSongId) return;
    try {
      const { blob, durationMs } = await engine.stopRecording();
      recordAudio({
        songId: selectedSongId,
        blob,
        name: `Grabación ${new Date().toLocaleTimeString()}`,
        laneIndex: songTracks?.length || 0,
        startTimeMs: Math.round(engine.transport.currentTime * 1000),
        durationMs,
      });
    } catch (err) {
      console.error("Failed to stop recording:", err);
    }
  };

  const handleDownloadAll = async () => {
    if (completedTracks.length === 0 || !selectedSong) return;
    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();
      const songName = selectedSong.title.replace(/[^a-zA-Z0-9\s-]/g, "").trim() || "stems";
      for (const track of completedTracks) {
        if (!track.audioUrl) continue;
        const response = await fetch(track.audioUrl, { credentials: "include" });
        const blob = await response.blob();
        zip.file(`${songName}_${track.name}.wav`, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${songName}_stems.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download stems:", err);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  if (!user) return null;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] text-foreground font-sans overflow-hidden">
      {/* ===== TRANSPORT BAR ===== */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#111] border-b border-white/10 flex-wrap" data-testid="studio-transport-bar">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded bg-[#ff751f]/20 flex items-center justify-center">
            <Music className="w-4 h-4 text-[#ff751f]" />
          </div>
          <select
            className="bg-[#1a1a1a] border border-white/10 rounded px-2 py-1.5 text-sm text-foreground min-w-[160px] max-w-[250px] truncate"
            value={selectedSongId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              engine.stopPlayback();
              setSelectedSongId(val ? Number(val) : null);
              setActiveTrackId(null);
            }}
            data-testid="select-song"
          >
            <option value="">{songsLoading ? "Cargando..." : "Selecciona una canción..."}</option>
            {completedSongs.map((song) => (
              <option key={song.id} value={song.id}>{song.title}</option>
            ))}
          </select>
        </div>

        {selectedSong && (
          <>
            <div className="h-6 w-px bg-white/10" />

            {/* Playback Controls */}
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => { engine.stopPlayback(); engine.seekTo(0); }} data-testid="button-rewind">
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                className={cn("w-9 h-9 rounded-full", engine.transport.isPlaying ? "bg-[#ff751f] text-white hover:bg-[#ff751f]/80" : "bg-white/10 hover:bg-white/20")}
                onClick={() => engine.togglePlayPause()}
                data-testid="button-play-pause"
              >
                {engine.transport.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </Button>
              <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => engine.stopPlayback()} data-testid="button-stop">
                <Square className="w-4 h-4 fill-current" />
              </Button>
            </div>

            <div className="h-6 w-px bg-white/10" />

            {/* Record Button */}
            <Button
              size="sm"
              className={cn(
                "gap-1.5 h-8 px-3 font-medium",
                engine.isRecording
                  ? "bg-red-600 text-white hover:bg-red-700 animate-pulse"
                  : "bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30"
              )}
              onClick={engine.isRecording ? handleStopRecording : handleStartRecording}
              disabled={!selectedSongId || isRecordingSaving}
              data-testid="button-record"
            >
              <CircleDot className="w-3.5 h-3.5" />
              {engine.isRecording ? "Parar Grabación" : "Grabar Voz"}
            </Button>

            {/* Loop */}
            <Button
              size="icon"
              variant={engine.transport.loopEnabled ? "default" : "ghost"}
              className={cn("w-8 h-8", engine.transport.loopEnabled && "bg-[#ff751f]/20 text-[#ff751f]")}
              onClick={() => engine.setLoop(!engine.transport.loopEnabled)}
              data-testid="button-loop"
            >
              <Repeat className="w-3.5 h-3.5" />
            </Button>

            <div className="h-6 w-px bg-white/10" />

            {/* Time Display */}
            <div className="font-mono text-sm text-[#ff751f] tabular-nums bg-black/40 px-2 py-1 rounded" data-testid="text-time-display">
              {formatTimeMs(engine.transport.currentTime * 1000)}
            </div>

            <div className="h-6 w-px bg-white/10" />

            {/* BPM */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">BPM</span>
              <Input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(Math.max(30, Math.min(300, Number(e.target.value) || 130)))}
                className="w-16 h-7 text-xs text-center bg-black/30 border-white/10 px-1"
                data-testid="input-bpm"
              />
            </div>

            {/* Snap */}
            <div className="flex items-center gap-1.5">
              <Grid3X3 className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                className="bg-black/30 border border-white/10 rounded px-2 py-1 text-[11px] text-foreground"
                value={snapIndex}
                onChange={(e) => setSnapIndex(Number(e.target.value))}
                data-testid="select-snap"
              >
                {SNAP_VALUES.map((sv, i) => (
                  <option key={i} value={i}>{sv.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="flex items-center gap-1 ml-auto">
          {selectedSong && (
            <Badge variant="secondary" className="text-xs" data-testid="badge-song-info">
              {GENRE_DISPLAY[selectedSong.genre || ""] || selectedSong.genre || "DA GRABACHATA"}
            </Badge>
          )}
          {engine.isRecording && (
            <Badge variant="destructive" className="text-xs animate-pulse" data-testid="badge-recording">
              🔴 REC
            </Badge>
          )}
          <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => setShowMixer(!showMixer)} data-testid="button-toggle-mixer">
            <SlidersVertical className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => setShowSidePanel(!showSidePanel)} data-testid="button-toggle-side-panel">
            {showSidePanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ===== TIMELINE + MIXER ===== */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto" data-testid="timeline-area">
            {!selectedSong ? (
              /* ===== WELCOME / NO SONG SELECTED ===== */
              <div className="flex-1 flex items-center justify-center h-full p-8">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-lg">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#ff751f]/20 to-indigo-500/20 flex items-center justify-center mx-auto mb-6">
                    <Music className="w-12 h-12 text-[#ff751f]/60" />
                  </div>
                  <h2 className="text-2xl font-bold mb-3" data-testid="text-studio-title">DA GRABA Studio DAW</h2>
                  <p className="text-base text-muted-foreground mb-8">
                    Selecciona una canción para comenzar a mezclar, editar y grabar.
                  </p>

                  <div className="space-y-4 text-left">
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-white/[0.03] border border-white/5" data-testid="flow-step-1">
                      <div className="w-8 h-8 rounded-full bg-[#ff751f]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-[#ff751f]">1</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">Selecciona una canción</p>
                        <p className="text-xs text-muted-foreground">Elige una canción completada del menú de arriba</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-white/[0.03] border border-white/5" data-testid="flow-step-2">
                      <div className="w-8 h-8 rounded-full bg-[#ff751f]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-[#ff751f]">2</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">Separa stems o agrega instrumentos</p>
                        <p className="text-xs text-muted-foreground">Divide la canción en tracks individuales o agrega instrumentos de Bachata</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-white/[0.03] border border-white/5" data-testid="flow-step-3">
                      <div className="w-8 h-8 rounded-full bg-[#ff751f]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-[#ff751f]">3</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">Mezcla, graba y aplica efectos</p>
                        <p className="text-xs text-muted-foreground">Ajusta volumen, EQ, reverb, graba voz y usa herramientas AI</p>
                      </div>
                    </div>
                  </div>

                  {completedSongs.length === 0 && !songsLoading && (
                    <div className="mt-8">
                      <p className="text-sm text-muted-foreground mb-3">No tienes canciones todavía</p>
                      <Button onClick={() => setLocation("/create")} className="gap-2 bg-[#ff751f] hover:bg-[#ff751f]/80" data-testid="button-go-create">
                        <Plus className="w-4 h-4" />
                        Crear mi primera canción
                      </Button>
                    </div>
                  )}
                </motion.div>
              </div>
            ) : (
              /* ===== SONG SELECTED - TIMELINE ===== */
              <div className="flex flex-col h-full">
                {/* Timeline Ruler */}
                <div style={{ paddingLeft: HEADER_WIDTH }}>
                  <TimelineRuler
                    durationMs={totalDurationMs}
                    currentTimeMs={engine.transport.currentTime * 1000}
                    bpm={bpm}
                    pxPerMs={PX_PER_MS}
                  />
                </div>

                {/* Track Lanes */}
                <ScrollArea className="flex-1">
                  <div>
                    {tracksLoading ? (
                      <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : !hasTracks ? (
                      /* ===== NO TRACKS - PROMPT TO CREATE ===== */
                      <div className="p-8">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl mx-auto space-y-6">
                          <div className="text-center mb-6">
                            <h3 className="text-lg font-bold mb-2">"{selectedSong.title}" está lista</h3>
                            <p className="text-sm text-muted-foreground">Elige cómo quieres trabajar con esta canción:</p>
                          </div>

                          {/* Option 1: Separate Stems */}
                          {canUseStemSeparation && (
                            <button
                              className="w-full p-5 rounded-xl border border-[#ff751f]/20 bg-gradient-to-r from-[#ff751f]/5 to-transparent hover:from-[#ff751f]/10 transition-all text-left group"
                              onClick={handleSeparate}
                              disabled={isSeparating}
                              data-testid="button-separate-stems"
                            >
                              <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-lg bg-[#ff751f]/20 flex items-center justify-center flex-shrink-0">
                                  {isSeparating ? <Loader2 className="w-6 h-6 animate-spin text-[#ff751f]" /> : <Scissors className="w-6 h-6 text-[#ff751f]" />}
                                </div>
                                <div>
                                  <h4 className="font-bold text-base mb-1 group-hover:text-[#ff751f] transition-colors">
                                    Separar Stems con IA
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    La IA separa la canción en tracks individuales: voces, batería, bajo y melodía. 
                                    Podrás mezclar cada uno por separado.
                                  </p>
                                  {isSeparating && <p className="text-xs text-[#ff751f] mt-2 animate-pulse">Procesando separación de stems...</p>}
                                </div>
                                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-[#ff751f] flex-shrink-0 mt-1 transition-colors" />
                              </div>
                            </button>
                          )}

                          {/* Option 2: Add Instruments */}
                          <button
                            className="w-full p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-left group"
                            onClick={() => setSidebarTab("instruments")}
                            data-testid="button-add-instruments-flow"
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-lg bg-[#A78BFA]/20 flex items-center justify-center flex-shrink-0">
                                <Piano className="w-6 h-6 text-[#A78BFA]" />
                              </div>
                              <div>
                                <h4 className="font-bold text-base mb-1 group-hover:text-[#A78BFA] transition-colors">
                                  Agregar Instrumentos
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  Añade tracks de instrumentos de Bachata desde el panel lateral: Requinto, Bongo, Güira, Piano y más.
                                </p>
                              </div>
                              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-[#A78BFA] flex-shrink-0 mt-1 transition-colors" />
                            </div>
                          </button>

                          {/* Option 3: Record */}
                          <button
                            className="w-full p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-left group"
                            onClick={handleStartRecording}
                            data-testid="button-record-flow"
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                <Mic className="w-6 h-6 text-red-400" />
                              </div>
                              <div>
                                <h4 className="font-bold text-base mb-1 group-hover:text-red-400 transition-colors">
                                  Grabar Voz
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  Graba tu voz directamente con el micrófono. La grabación se guardará como un nuevo track.
                                </p>
                              </div>
                              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-red-400 flex-shrink-0 mt-1 transition-colors" />
                            </div>
                          </button>
                        </motion.div>
                      </div>
                    ) : (
                      /* ===== TRACKS EXIST - SHOW LANES ===== */
                      <>
                        {songTracks?.map((track) => (
                          <TrackLane
                            key={track.id}
                            track={track}
                            clips={dawClips?.filter((c) => c.trackId === track.id) || []}
                            engine={engine}
                            pxPerMs={PX_PER_MS}
                            snapMs={snapMs}
                            anySoloed={anySoloed}
                            isActive={track.id === activeTrackId}
                            onSelect={() => setActiveTrackId(track.id === activeTrackId ? null : track.id)}
                            onUpdateClip={(clipId, data) => {
                              if (selectedSongId) updateClip({ id: clipId, songId: selectedSongId, ...data });
                            }}
                            onDeleteClip={(clipId) => {
                              if (selectedSongId) deleteClip({ id: clipId, songId: selectedSongId });
                            }}
                          />
                        ))}

                        {/* Add Track Row */}
                        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2 text-xs text-muted-foreground hover:text-[#ff751f]"
                            onClick={() => { setShowSidePanel(true); setSidebarTab("instruments"); }}
                            data-testid="button-add-track"
                          >
                            <Plus className="w-4 h-4" />
                            Agregar Instrumento
                          </Button>
                          {canUseStemSeparation && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-2 text-xs text-muted-foreground hover:text-[#ff751f]"
                              onClick={handleSeparate}
                              disabled={isSeparating}
                              data-testid="button-separate-stems-inline"
                            >
                              {isSeparating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5" />}
                              Separar Stems
                            </Button>
                          )}
                        </div>

                        {/* Active Track Info Banner */}
                        {activeTrack && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="px-4 py-2 bg-[#ff751f]/5 border-b border-[#ff751f]/20 flex items-center gap-3"
                            data-testid="active-track-banner"
                          >
                            <div className="w-2 h-2 rounded-full bg-[#ff751f]" />
                            <span className="text-xs font-medium">Track activo: <strong className="text-[#ff751f]">{activeTrack.name}</strong></span>
                            <span className="text-[10px] text-muted-foreground">— Usa el panel derecho para aplicar efectos a este track</span>
                          </motion.div>
                        )}
                      </>
                    )}
                  </div>
                </ScrollArea>

                {/* Playhead Line */}
                {engine.transport.duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-[#ff751f]/70 pointer-events-none z-10"
                    style={{
                      left: HEADER_WIDTH + (engine.transport.currentTime * 1000) * PX_PER_MS,
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {/* ===== MIXER CONSOLE ===== */}
          <AnimatePresence>
            {showMixer && hasTracks && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 220 }}
                exit={{ height: 0 }}
                className="border-t border-white/10 bg-[#0d0d0d] overflow-hidden"
                data-testid="mixer-console"
              >
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mixer</span>
                    <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => setShowMixer(false)} data-testid="button-hide-mixer">
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>
                  <ScrollArea className="flex-1" data-testid="mixer-scroll">
                    <div className="flex gap-0 p-2 h-full">
                      {songTracks?.map((track) => {
                        const color = STEM_COLORS[track.type] || "#A78BFA";
                        const trackId = track.id;
                        const engineTrack = engine.tracks.get(trackId);
                        const vol = engineTrack?.volume ?? (track.volume ?? 100) / 100;
                        const isActive = trackId === activeTrackId;

                        return (
                          <div
                            key={trackId}
                            className={cn(
                              "flex flex-col items-center gap-1 px-3 border-r border-white/5 last:border-r-0 cursor-pointer transition-colors",
                              isActive && "bg-[#ff751f]/5"
                            )}
                            style={{ minWidth: 90 }}
                            onClick={() => setActiveTrackId(trackId)}
                            data-testid={`mixer-strip-${track.id}`}
                          >
                            <VUMeter getLevel={() => engine.getTrackMeter(trackId)} height={50} />
                            <div className="flex items-center gap-1" style={{ height: 50 }}>
                              <Slider
                                orientation="vertical"
                                value={[vol * 100]}
                                max={100}
                                step={1}
                                onValueChange={(v) => {
                                  engine.setTrackVolume(trackId, v[0] / 100);
                                  updateTrack({ id: trackId, volume: Math.round(v[0]) });
                                }}
                                className="h-full"
                                data-testid={`slider-volume-${track.id}`}
                              />
                            </div>
                            <div className="flex gap-0.5">
                              <button
                                className={cn("w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center",
                                  track.isMuted ? "bg-red-500/80 text-white" : "bg-white/5 text-muted-foreground"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateTrack({ id: trackId, isMuted: !track.isMuted });
                                  engine.setTrackMute(trackId, !track.isMuted);
                                }}
                                data-testid={`mixer-mute-${track.id}`}
                              >M</button>
                              <button
                                className={cn("w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center",
                                  track.isSolo ? "bg-yellow-500/80 text-white" : "bg-white/5 text-muted-foreground"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateTrack({ id: trackId, isSolo: !track.isSolo });
                                  engine.setTrackSolo(trackId, !track.isSolo);
                                }}
                                data-testid={`mixer-solo-${track.id}`}
                              >S</button>
                            </div>
                            <span className="text-[9px] font-medium truncate w-full text-center" style={{ color }}>{track.name}</span>
                          </div>
                        );
                      })}

                      <div className="flex flex-col items-center gap-1 px-3 border-l-2 border-[#ff751f]/30" style={{ minWidth: 90 }} data-testid="mixer-strip-master">
                        <VUMeter getLevel={() => engine.getMasterMeter()} height={50} />
                        <div className="flex items-center gap-1" style={{ height: 50 }}>
                          <Slider
                            orientation="vertical"
                            value={[engine.masterSettings.volume * 100]}
                            max={100}
                            step={1}
                            onValueChange={(v) => engine.setMasterVolume(v[0] / 100)}
                            className="h-full"
                            data-testid="slider-master-volume"
                          />
                        </div>
                        <span className="text-[9px] font-bold text-[#ff751f] uppercase tracking-wider">MASTER</span>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ===== RIGHT SIDEBAR ===== */}
        <AnimatePresence>
          {showSidePanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-white/10 bg-[#0d0d0d] overflow-hidden flex-shrink-0 flex flex-col"
              data-testid="side-panel"
            >
              <Tabs value={sidebarTab} onValueChange={setSidebarTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="bg-transparent border-b border-white/10 rounded-none px-2 h-10 flex-shrink-0">
                  <TabsTrigger value="instruments" className="text-xs px-3 h-8 data-[state=active]:bg-[#ff751f]/10 data-[state=active]:text-[#ff751f]" data-testid="tab-instruments">
                    🎸 Instrumentos
                  </TabsTrigger>
                  <TabsTrigger value="effects" className="text-xs px-3 h-8 data-[state=active]:bg-[#ff751f]/10 data-[state=active]:text-[#ff751f]" data-testid="tab-effects">
                    🎛️ Efectos
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="text-xs px-3 h-8 data-[state=active]:bg-[#ff751f]/10 data-[state=active]:text-[#ff751f]" data-testid="tab-ai-tools">
                    ✨ AI
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1">
                  {/* ===== INSTRUMENTS TAB ===== */}
                  <TabsContent value="instruments" className="m-0 p-3 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Piano className="w-4 h-4 text-[#ff751f]" />
                      <span className="text-xs font-bold uppercase tracking-wider">DA GRABA Instrumentos</span>
                    </div>

                    {!selectedSong ? (
                      <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                        <p className="text-xs text-muted-foreground">Selecciona una canción primero para agregar instrumentos</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          Haz clic en un instrumento para agregarlo como track a tu proyecto:
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {BACHATA_INSTRUMENTS.map((inst) => (
                            <button
                              key={inst.name}
                              className="p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.08] hover:border-[#ff751f]/30 transition-all text-left group active:scale-95"
                              onClick={() => handleAddInstrumentTrack(inst)}
                              disabled={isCreatingTrack}
                              data-testid={`sidebar-instrument-${inst.name.toLowerCase().replace(/\s/g, "-")}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{inst.icon}</span>
                                <div>
                                  <span className="text-[11px] font-medium block leading-tight group-hover:text-[#ff751f] transition-colors">{inst.name}</span>
                                  <span className="text-[9px] text-muted-foreground">VST3 · {inst.type}</span>
                                </div>
                              </div>
                              <div className="mt-1.5 flex items-center gap-1 text-[9px] text-[#ff751f]/60 group-hover:text-[#ff751f] transition-colors">
                                <Plus className="w-3 h-3" />
                                <span>Agregar track</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    <div className="pt-3 border-t border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <Volume2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-bold uppercase tracking-wider">Samples</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-2">Graba y edita muestras de audio en el Sample Lab</p>
                      <Button size="sm" variant="outline" className="w-full gap-2 text-xs h-8" onClick={() => setLocation("/sample-lab")} data-testid="button-goto-sample-lab">
                        <Wand2 className="w-3.5 h-3.5" />
                        Abrir Sample Lab
                      </Button>
                    </div>
                  </TabsContent>

                  {/* ===== EFFECTS TAB ===== */}
                  <TabsContent value="effects" className="m-0 p-3 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <SlidersVertical className="w-4 h-4 text-[#ff751f]" />
                      <span className="text-xs font-bold uppercase tracking-wider">Efectos de Audio</span>
                    </div>

                    {!activeTrack ? (
                      <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 text-center space-y-2">
                        <SlidersVertical className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                        <p className="text-xs text-muted-foreground">
                          {!selectedSong
                            ? "Selecciona una canción y luego un track para aplicar efectos"
                            : !hasTracks
                              ? "Agrega tracks primero y luego selecciona uno para aplicar efectos"
                              : "Haz clic en un track del timeline para seleccionarlo y aplicar efectos aquí"
                          }
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="p-2 rounded-lg bg-[#ff751f]/5 border border-[#ff751f]/20 flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-[#ff751f]" />
                          <span className="text-xs font-medium">Track: <strong className="text-[#ff751f]">{activeTrack.name}</strong></span>
                        </div>

                        {/* EQ Controls */}
                        <Card className="p-3 border-white/5 bg-white/[0.02]" data-testid="fx-eq-panel">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <SlidersVertical className="w-3.5 h-3.5 text-[#ff751f]" />
                              <span className="text-xs font-bold">EQ (3 bandas)</span>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {(["low", "mid", "high"] as const).map((band) => (
                              <div key={band} className="flex items-center gap-3">
                                <span className="text-[10px] text-muted-foreground w-8 uppercase font-mono">{band}</span>
                                <Slider
                                  value={[activeEngineTrack?.eq?.[band] ?? 0]}
                                  min={-12}
                                  max={12}
                                  step={0.5}
                                  onValueChange={(v) => engine.setTrackEQ(activeTrackId!, band, v[0])}
                                  className="flex-1"
                                  data-testid={`slider-eq-${band}`}
                                />
                                <span className="text-[10px] text-muted-foreground w-10 text-right font-mono">
                                  {(activeEngineTrack?.eq?.[band] ?? 0).toFixed(1)}dB
                                </span>
                              </div>
                            ))}
                          </div>
                        </Card>

                        {/* Compressor */}
                        <Card className="p-3 border-white/5 bg-white/[0.02]" data-testid="fx-compressor-panel">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <SlidersVertical className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-xs font-bold">Compressor</span>
                            </div>
                            <button
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold transition-colors",
                                activeEngineTrack?.compressorSettings?.enabled
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-white/5 text-muted-foreground"
                              )}
                              onClick={() => engine.setTrackCompressor(activeTrackId!, { enabled: !activeEngineTrack?.compressorSettings?.enabled })}
                              data-testid="button-toggle-compressor"
                            >
                              {activeEngineTrack?.compressorSettings?.enabled ? "ON" : "OFF"}
                            </button>
                          </div>
                          {activeEngineTrack?.compressorSettings?.enabled && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] text-muted-foreground w-12 font-mono">Thresh</span>
                                <Slider
                                  value={[activeEngineTrack.compressorSettings.threshold]}
                                  min={-60}
                                  max={0}
                                  step={1}
                                  onValueChange={(v) => engine.setTrackCompressor(activeTrackId!, { threshold: v[0] })}
                                  className="flex-1"
                                  data-testid="slider-comp-threshold"
                                />
                                <span className="text-[10px] text-muted-foreground w-10 text-right font-mono">{activeEngineTrack.compressorSettings.threshold}dB</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] text-muted-foreground w-12 font-mono">Ratio</span>
                                <Slider
                                  value={[activeEngineTrack.compressorSettings.ratio]}
                                  min={1}
                                  max={20}
                                  step={0.5}
                                  onValueChange={(v) => engine.setTrackCompressor(activeTrackId!, { ratio: v[0] })}
                                  className="flex-1"
                                  data-testid="slider-comp-ratio"
                                />
                                <span className="text-[10px] text-muted-foreground w-10 text-right font-mono">{activeEngineTrack.compressorSettings.ratio}:1</span>
                              </div>
                            </div>
                          )}
                        </Card>

                        {/* Reverb */}
                        <Card className="p-3 border-white/5 bg-white/[0.02]" data-testid="fx-reverb-panel">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Waves className="w-3.5 h-3.5 text-blue-400" />
                              <span className="text-xs font-bold">Reverb</span>
                            </div>
                            <button
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold transition-colors",
                                activeEngineTrack?.reverbSettings?.enabled
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-white/5 text-muted-foreground"
                              )}
                              onClick={() => engine.setTrackReverb(activeTrackId!, { enabled: !activeEngineTrack?.reverbSettings?.enabled })}
                              data-testid="button-toggle-reverb"
                            >
                              {activeEngineTrack?.reverbSettings?.enabled ? "ON" : "OFF"}
                            </button>
                          </div>
                          {activeEngineTrack?.reverbSettings?.enabled && (
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-muted-foreground w-8 font-mono">Mix</span>
                              <Slider
                                value={[(activeEngineTrack.reverbSettings.mix ?? 0) * 100]}
                                min={0}
                                max={100}
                                step={1}
                                onValueChange={(v) => engine.setTrackReverb(activeTrackId!, { mix: v[0] / 100 })}
                                className="flex-1"
                                data-testid="slider-reverb-mix"
                              />
                              <span className="text-[10px] text-muted-foreground w-10 text-right font-mono">{Math.round((activeEngineTrack.reverbSettings.mix ?? 0) * 100)}%</span>
                            </div>
                          )}
                        </Card>

                        {/* Quick Mixer */}
                        <Card className="p-3 border-white/5 bg-white/[0.02]" data-testid="fx-quick-mixer">
                          <div className="flex items-center gap-2 mb-3">
                            <Volume2 className="w-3.5 h-3.5 text-[#ff751f]" />
                            <span className="text-xs font-bold">Volumen & Pan</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-muted-foreground w-8 font-mono">Vol</span>
                              <Slider
                                value={[(activeEngineTrack?.volume ?? 1) * 100]}
                                min={0}
                                max={100}
                                step={1}
                                onValueChange={(v) => {
                                  engine.setTrackVolume(activeTrackId!, v[0] / 100);
                                  updateTrack({ id: activeTrackId!, volume: Math.round(v[0]) });
                                }}
                                className="flex-1"
                                data-testid="slider-fx-volume"
                              />
                              <span className="text-[10px] text-muted-foreground w-10 text-right font-mono">{Math.round((activeEngineTrack?.volume ?? 1) * 100)}%</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-muted-foreground w-8 font-mono">Pan</span>
                              <Slider
                                value={[(activeEngineTrack?.pan ?? 0) * 50 + 50]}
                                min={0}
                                max={100}
                                step={1}
                                onValueChange={(v) => engine.setTrackPan(activeTrackId!, (v[0] - 50) / 50)}
                                className="flex-1"
                                data-testid="slider-fx-pan"
                              />
                              <span className="text-[10px] text-muted-foreground w-10 text-right font-mono">
                                {(activeEngineTrack?.pan ?? 0) < -0.05 ? `L${Math.round(Math.abs(activeEngineTrack!.pan) * 100)}` :
                                  (activeEngineTrack?.pan ?? 0) > 0.05 ? `R${Math.round(activeEngineTrack!.pan * 100)}` : "C"}
                              </span>
                            </div>
                          </div>
                        </Card>

                        <Button size="sm" variant="outline" className="w-full gap-2 text-xs h-8 mt-2" onClick={() => setShowMixer(true)} data-testid="button-open-mixer-from-fx">
                          <SlidersVertical className="w-3.5 h-3.5" />
                          Abrir Mixer Completo
                        </Button>
                      </>
                    )}
                  </TabsContent>

                  {/* ===== AI TOOLS TAB ===== */}
                  <TabsContent value="ai" className="m-0 p-3 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-[#ff751f]" />
                      <span className="text-xs font-bold uppercase tracking-wider">Herramientas AI</span>
                    </div>

                    {!selectedSong ? (
                      <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 text-center space-y-2">
                        <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                        <p className="text-xs text-muted-foreground">Selecciona una canción para usar las herramientas de IA</p>
                      </div>
                    ) : (
                      <>
                        {/* Stem Separation */}
                        {canUseStemSeparation && (
                          <Card className="p-4 border-white/5 bg-[#111]" data-testid="ai-stem-separation">
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-10 h-10 rounded-lg bg-[#FF8C00]/10 flex items-center justify-center flex-shrink-0">
                                <Scissors className="w-5 h-5 text-[#FF8C00]" />
                              </div>
                              <div>
                                <span className="text-sm font-bold block">Separar Stems</span>
                                <span className="text-[11px] text-muted-foreground">Divide la canción en voces, batería, bajo y melodía</span>
                              </div>
                            </div>
                            <Button size="sm" className="w-full gap-2 h-9 bg-[#FF8C00]/20 text-[#FF8C00] hover:bg-[#FF8C00]/30 border border-[#FF8C00]/20" disabled={isSeparating} onClick={handleSeparate} data-testid="button-separate-stems-side">
                              {isSeparating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
                              {isSeparating ? "Procesando..." : "Separar Stems"}
                            </Button>
                          </Card>
                        )}

                        {/* Master */}
                        <Card className="p-4 border-white/5 bg-[#111]" data-testid="ai-master">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                              <Sparkles className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                              <span className="text-sm font-bold block">Masterizar</span>
                              <span className="text-[11px] text-muted-foreground">Procesa el audio para calidad profesional de estudio</span>
                            </div>
                          </div>
                          <Button size="sm" className="w-full gap-2 h-9 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/20" disabled={isMastering} onClick={() => selectedSongId && masterSong(selectedSongId)} data-testid="button-master-song">
                            {isMastering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {isMastering ? "Procesando..." : "Masterizar Track"}
                          </Button>
                        </Card>

                        {/* Denoise */}
                        <Card className="p-4 border-white/5 bg-[#111]" data-testid="ai-denoise">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                              <Shield className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                              <span className="text-sm font-bold block">Eliminar Ruido</span>
                              <span className="text-[11px] text-muted-foreground">Remueve ruido de fondo y mejora la claridad del audio</span>
                            </div>
                          </div>
                          <Button size="sm" className="w-full gap-2 h-9 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/20" disabled={isDenoising} onClick={() => selectedSongId && denoiseSong(selectedSongId)} data-testid="button-denoise-song">
                            {isDenoising ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                            {isDenoising ? "Procesando..." : "Eliminar Ruido"}
                          </Button>
                        </Card>

                        {/* AI Cover */}
                        <Card className="p-4 border-white/5 bg-[#111]" data-testid="ai-cover">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                              <MicVocal className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                              <span className="text-sm font-bold block">Cover con IA</span>
                              <span className="text-[11px] text-muted-foreground">Re-canta tu canción con una voz generada por IA</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Nombre de la voz..."
                              value={coverVoice}
                              onChange={(e) => setCoverVoice(e.target.value)}
                              className="flex-1 text-xs bg-black/20 border-white/10 h-9"
                              data-testid="input-cover-voice"
                            />
                            <Button
                              size="sm"
                              className="flex-shrink-0 gap-1.5 h-9 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/20"
                              disabled={isCovering || !coverVoice.trim() || !selectedSongId}
                              onClick={() => {
                                if (selectedSongId && coverVoice.trim()) {
                                  coverSong({ songId: selectedSongId, voiceId: coverVoice });
                                  setCoverVoice("");
                                }
                              }}
                              data-testid="button-cover-song"
                            >
                              {isCovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <MicVocal className="w-4 h-4" />}
                              Crear
                            </Button>
                          </div>
                        </Card>

                        {/* Trim */}
                        <Card className="p-4 border-white/5 bg-[#111]" data-testid="ai-trim">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                              <Scissors className="w-5 h-5 text-orange-400" />
                            </div>
                            <div>
                              <span className="text-sm font-bold block">Cortar Audio</span>
                              <span className="text-[11px] text-muted-foreground">Recorta la canción a un rango específico en segundos</span>
                            </div>
                          </div>
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="text-[10px] text-muted-foreground block mb-1">Inicio (seg)</label>
                              <Input type="number" placeholder="0" min="0" step="0.5" value={trimStart} onChange={(e) => setTrimStart(e.target.value)} className="text-xs bg-black/20 border-white/10 h-8" data-testid="input-trim-start" />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-muted-foreground block mb-1">Fin (seg)</label>
                              <Input type="number" placeholder="30" min="0.5" step="0.5" value={trimEnd} onChange={(e) => setTrimEnd(e.target.value)} className="text-xs bg-black/20 border-white/10 h-8" data-testid="input-trim-end" />
                            </div>
                            <Button
                              size="sm"
                              className="flex-shrink-0 h-8 gap-1.5 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/20"
                              disabled={isTrimming || !trimStart || !trimEnd || !selectedSongId || parseFloat(trimEnd) <= parseFloat(trimStart)}
                              onClick={() => {
                                if (selectedSongId && trimStart && trimEnd) {
                                  trimSong({ songId: selectedSongId, startTimeMs: parseFloat(trimStart) * 1000, endTimeMs: parseFloat(trimEnd) * 1000 });
                                  setTrimStart("");
                                  setTrimEnd("");
                                }
                              }}
                              data-testid="button-trim-song"
                            >
                              {isTrimming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5" />}
                              Cortar
                            </Button>
                          </div>
                        </Card>

                        {/* Download */}
                        {completedTracks.length > 0 && (
                          <Card className="p-4 border-white/5 bg-[#111]" data-testid="ai-download">
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-10 h-10 rounded-lg bg-[#ff751f]/10 flex items-center justify-center flex-shrink-0">
                                <Package className="w-5 h-5 text-[#ff751f]" />
                              </div>
                              <div>
                                <span className="text-sm font-bold block" data-testid="text-download-section-title">Descargar</span>
                                <span className="text-[11px] text-muted-foreground">{completedTracks.length} tracks · WAV</span>
                              </div>
                            </div>
                            <div className="space-y-1 mb-3 max-h-32 overflow-auto">
                              {completedTracks.map((track) => (
                                <div key={track.id} className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-white/5">
                                  <span className="text-[11px] text-muted-foreground truncate">{track.name}</span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="w-6 h-6"
                                    onClick={() => {
                                      const link = document.createElement("a");
                                      link.href = track.audioUrl!;
                                      link.download = `${track.name}.wav`;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }}
                                    data-testid={`button-download-${track.type}`}
                                  >
                                    <Download className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            <Button size="sm" className="w-full gap-2 h-9 bg-[#ff751f]/20 text-[#ff751f] hover:bg-[#ff751f]/30 border border-[#ff751f]/20" disabled={isDownloadingAll} onClick={handleDownloadAll} data-testid="button-download-all-stems">
                              {isDownloadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                              {isDownloadingAll ? "Creando ZIP..." : "Descargar Todo (ZIP)"}
                            </Button>
                          </Card>
                        )}
                      </>
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
