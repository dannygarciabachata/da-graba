import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSongs } from "@/hooks/use-songs";
import { useSongTracks, useSeparateStems, useUpdateTrack, useMasterSong, useDenoiseSong, useCoverSong, useTrimSong } from "@/hooks/use-tracks";
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
  Piano, Waves, Wand2, SlidersVertical, Headphones
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import type { Track, DawClip } from "@shared/schema";
import JSZip from "jszip";
import { useTranslation } from "react-i18next";

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

const LANE_HEIGHT = 72;
const HEADER_WIDTH = 140;
const PX_PER_MS = 0.08;

const BACHATA_INSTRUMENTS = [
  { name: "Requinto", icon: "🎸", color: "#ff751f" },
  { name: "Segunda Guitarra", icon: "🎸", color: "#FFB347" },
  { name: "Bongo", icon: "🥁", color: "#FF6B9D" },
  { name: "Conga", icon: "🥁", color: "#f43f5e" },
  { name: "Güira", icon: "🪘", color: "#22d3ee" },
  { name: "Timbal", icon: "🥁", color: "#84cc16" },
  { name: "Campanas", icon: "🔔", color: "#f59e0b" },
  { name: "Bajo", icon: "🎸", color: "#4ECDC4" },
  { name: "Piano", icon: "🎹", color: "#A78BFA" },
  { name: "Pad", icon: "🎹", color: "#8b5cf6" },
  { name: "Violines", icon: "🎻", color: "#ec4899" },
  { name: "Chelos", icon: "🎻", color: "#6366f1" },
];

const EFFECTS_LIST = [
  { name: "Reverb", desc: "Room ambience", icon: Waves },
  { name: "Delay", desc: "Echo effect", icon: Repeat },
  { name: "Compressor", desc: "Dynamic control", icon: SlidersVertical },
  { name: "EQ", desc: "Frequency shaping", icon: SlidersVertical },
  { name: "Chorus", desc: "Stereo widening", icon: Waves },
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

function TrackLane({ track, clips, engine, pxPerMs, snapMs, onUpdateClip, onDeleteClip, anySoloed }: {
  track: Track;
  clips: DawClip[];
  engine: ReturnType<typeof useAudioEngine>;
  pxPerMs: number;
  snapMs: number;
  onUpdateClip: (clipId: number, data: Partial<DawClip>) => void;
  onDeleteClip: (clipId: number) => void;
  anySoloed: boolean;
}) {
  const Icon = STEM_ICONS[track.type] || Music;
  const color = STEM_COLORS[track.type] || "#A78BFA";
  const isSoloedByOther = anySoloed && !track.isSolo;
  const isPending = track.status === "pending" || track.status === "processing";
  const buffer = track.status === "completed" ? engine.getTrackBuffer(track.id) : null;

  return (
    <div
      className={cn(
        "flex border-b border-white/5 bg-[#111] overflow-visible relative",
        isSoloedByOther && !track.isMuted && "opacity-40"
      )}
      style={{ height: LANE_HEIGHT }}
      data-testid={`track-lane-${track.id}`}
    >
      <div
        className="flex flex-col items-center justify-center gap-0.5 px-2 border-r border-white/5 flex-shrink-0"
        style={{ width: HEADER_WIDTH, backgroundColor: `${color}08` }}
      >
        <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-3 h-3" style={{ color }} />
        </div>
        <span className="text-[9px] font-medium truncate w-full text-center" data-testid={`text-track-name-${track.id}`}>
          {track.name}
        </span>
        <div className="flex gap-0.5">
          <button
            className={cn("w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center transition-colors",
              track.isMuted ? "bg-red-500/80 text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            )}
            onClick={() => engine.setTrackMute(track.id, !track.isMuted)}
            data-testid={`button-mute-${track.id}`}
          >M</button>
          <button
            className={cn("w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center transition-colors",
              track.isSolo ? "bg-yellow-500/80 text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            )}
            onClick={() => engine.setTrackSolo(track.id, !track.isSolo)}
            data-testid={`button-solo-${track.id}`}
          >S</button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {isPending ? (
          <div className="h-full flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Processing...</span>
          </div>
        ) : buffer ? (
          <div className="absolute inset-0 opacity-30">
            <MiniWaveform buffer={buffer} color={color} width={800} height={LANE_HEIGHT - 8} />
          </div>
        ) : null}

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

function TrackCreationCard({ onClose, songId, onCreate }: {
  onClose: () => void;
  songId: number;
  onCreate: (data: { name: string; prompt: string; instrument: string }) => void;
}) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedInstrument, setSelectedInstrument] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="border border-[#ff751f]/30 rounded-lg bg-[#111]/95 backdrop-blur-sm p-4 mx-2 my-1"
      data-testid="track-creation-card"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#ff751f]" />
          <span className="text-sm font-bold">New Track</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-white" data-testid="button-close-new-track">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Track Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Requinto Lead"
            className="text-xs bg-black/30 border-white/10 h-8"
            data-testid="input-new-track-name"
          />
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Instrument</label>
          <div className="grid grid-cols-4 gap-1">
            {BACHATA_INSTRUMENTS.slice(0, 8).map((inst) => (
              <button
                key={inst.name}
                onClick={() => setSelectedInstrument(inst.name)}
                className={cn(
                  "p-1.5 rounded text-center border transition-all",
                  selectedInstrument === inst.name
                    ? "border-[#ff751f] bg-[#ff751f]/10"
                    : "border-white/5 bg-white/5 hover:bg-white/10"
                )}
                data-testid={`button-instrument-${inst.name.toLowerCase().replace(/\s/g, "-")}`}
              >
                <span className="text-sm">{inst.icon}</span>
                <span className="text-[8px] block truncate">{inst.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Prompt</label>
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what this track should sound like..."
            className="text-xs bg-black/30 border-white/10 h-8"
            data-testid="input-new-track-prompt"
          />
        </div>

        <Button
          size="sm"
          className="w-full bg-gradient-to-r from-[#ff751f] to-[#ff9a4d] text-white hover:opacity-90"
          disabled={!name.trim()}
          onClick={() => {
            if (name.trim()) {
              onCreate({ name: name.trim(), prompt: prompt.trim(), instrument: selectedInstrument });
            }
          }}
          data-testid="button-create-track"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Track
        </Button>
      </div>
    </motion.div>
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
  const [showNewTrack, setShowNewTrack] = useState(false);
  const [bpm, setBpm] = useState(130);
  const [snapIndex, setSnapIndex] = useState(3);
  const snapMs = SNAP_VALUES[snapIndex]?.ms || 0;
  const [sidebarTab, setSidebarTab] = useState("instruments");

  const completedSongs = songs?.filter((s) => s.status === "completed" && s.audioUrl) ?? [];
  const selectedSong = completedSongs.find((s) => s.id === selectedSongId);
  const hasTracks = songTracks && songTracks.length > 0;
  const allTracksReady = songTracks?.every((t) => t.status === "completed") ?? false;
  const completedTracks = songTracks?.filter((t) => t.status === "completed" && t.audioUrl) ?? [];
  const anySoloed = songTracks?.some((t) => t.isSolo) ?? false;

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

  const handleSeparate = () => {
    if (selectedSongId) separateStems(selectedSongId);
  };

  const handleCreateTrack = (data: { name: string; prompt: string; instrument: string }) => {
    if (!selectedSongId) return;
    createClip({
      songId: selectedSongId,
      name: data.name,
      startTimeMs: 0,
      durationMs: 4000,
      laneIndex: songTracks?.length || 0,
      color: CLIP_COLORS[(songTracks?.length || 0) % CLIP_COLORS.length],
      source: data.instrument || "custom",
      volume: 100,
    });
    setShowNewTrack(false);
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
        name: `Recording ${new Date().toLocaleTimeString()}`,
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
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111] border-b border-white/5 flex-wrap" data-testid="studio-transport-bar">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded bg-[#ff751f]/20 flex items-center justify-center">
            <Music className="w-3 h-3 text-[#ff751f]" />
          </div>
          <select
            className="bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-xs text-foreground min-w-[120px] max-w-[200px] truncate"
            value={selectedSongId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              engine.stopPlayback();
              setSelectedSongId(val ? Number(val) : null);
            }}
            data-testid="select-song"
          >
            <option value="">{songsLoading ? "Loading..." : "Select a song..."}</option>
            {completedSongs.map((song) => (
              <option key={song.id} value={song.id}>{song.title}</option>
            ))}
          </select>
        </div>

        {selectedSong && (
          <>
            <div className="h-5 w-px bg-white/10" />
            <div className="flex items-center gap-0.5">
              <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => { engine.stopPlayback(); engine.seekTo(0); }} data-testid="button-rewind">
                <SkipBack className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={cn("w-8 h-8", engine.transport.isPlaying && "text-[#ff751f]")}
                onClick={() => engine.togglePlayPause()}
                data-testid="button-play-pause"
              >
                {engine.transport.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </Button>
              <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => engine.stopPlayback()} data-testid="button-stop">
                <Square className="w-3.5 h-3.5 fill-current" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                className={cn("w-7 h-7", engine.isRecording && "text-red-500 animate-pulse")}
                onClick={engine.isRecording ? handleStopRecording : handleStartRecording}
                disabled={!selectedSongId || isRecordingSaving}
                data-testid="button-record"
              >
                <CircleDot className="w-3.5 h-3.5" />
              </Button>

              <Button
                size="icon"
                variant={engine.transport.loopEnabled ? "default" : "ghost"}
                className={cn("w-7 h-7", engine.transport.loopEnabled && "bg-[#ff751f]/20 text-[#ff751f]")}
                onClick={() => engine.setLoop(!engine.transport.loopEnabled)}
                data-testid="button-loop"
              >
                <Repeat className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="h-5 w-px bg-white/10" />

            <div className="font-mono text-xs text-muted-foreground tabular-nums" data-testid="text-time-display">
              {formatTimeMs(engine.transport.currentTime * 1000)} / {formatTimeMs(totalDurationMs)}
            </div>

            <div className="h-5 w-px bg-white/10" />

            <div className="flex items-center gap-1">
              <span className="text-[9px] text-muted-foreground uppercase">BPM</span>
              <Input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(Math.max(30, Math.min(300, Number(e.target.value) || 130)))}
                className="w-14 h-6 text-xs text-center bg-black/30 border-white/10 px-1"
                data-testid="input-bpm"
              />
            </div>

            <div className="flex items-center gap-1">
              <Grid3X3 className="w-3 h-3 text-muted-foreground" />
              <select
                className="bg-black/30 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-foreground"
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
            <Badge variant="secondary" className="text-[9px]" data-testid="badge-song-info">
              {GENRE_DISPLAY[selectedSong.genre || ""] || selectedSong.genre || "DA GRABACHATA"}
            </Badge>
          )}
          {engine.isRecording && (
            <Badge variant="destructive" className="text-[9px] animate-pulse" data-testid="badge-recording">
              REC
            </Badge>
          )}
          <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setShowMixer(!showMixer)} data-testid="button-toggle-mixer">
            <SlidersVertical className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setShowSidePanel(!showSidePanel)} data-testid="button-toggle-side-panel">
            {showSidePanel ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ===== TIMELINE + MIXER ===== */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Timeline Area */}
          <div className="flex-1 overflow-auto" data-testid="timeline-area">
            {!selectedSong ? (
              <div className="flex-1 flex items-center justify-center h-full p-8">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#ff751f]/20 to-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                    <Music className="w-10 h-10 text-[#ff751f]/60" />
                  </div>
                  <h3 className="text-lg font-bold mb-2" data-testid="text-studio-title">DA GRABA Studio DAW</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Select a song to start mixing, editing, and recording.
                  </p>
                </motion.div>
              </div>
            ) : (
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
                      <div className="flex items-center justify-center h-40 text-center">
                        <div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {canUseStemSeparation ? "Separate stems or add a new track to start" : "Upgrade to PRO for stem separation"}
                          </p>
                          {canUseStemSeparation && (
                            <div className="flex gap-2 justify-center">
                              <Button size="sm" onClick={handleSeparate} disabled={isSeparating} className="gap-1.5" data-testid="button-separate-stems">
                                {isSeparating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
                                Separate Stems
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setShowNewTrack(true)} className="gap-1.5" data-testid="button-add-track-empty">
                                <Plus className="w-3 h-3" />
                                New Track
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      songTracks?.map((track) => (
                        <TrackLane
                          key={track.id}
                          track={track}
                          clips={dawClips?.filter((c) => c.trackId === track.id) || []}
                          engine={engine}
                          pxPerMs={PX_PER_MS}
                          snapMs={snapMs}
                          anySoloed={anySoloed}
                          onUpdateClip={(clipId, data) => {
                            if (selectedSongId) updateClip({ id: clipId, songId: selectedSongId, ...data });
                          }}
                          onDeleteClip={(clipId) => {
                            if (selectedSongId) deleteClip({ id: clipId, songId: selectedSongId });
                          }}
                        />
                      ))
                    )}

                    {/* Orphan clips (no track) */}
                    {dawClips?.filter((c) => !c.trackId || !songTracks?.find((t) => t.id === c.trackId)).length ? (
                      <div className="border-b border-white/5 bg-[#111] relative" style={{ height: LANE_HEIGHT }}>
                        <div className="flex flex-col items-center justify-center px-2 border-r border-white/5 flex-shrink-0 h-full" style={{ width: HEADER_WIDTH }}>
                          <span className="text-[9px] text-muted-foreground">Clips</span>
                        </div>
                      </div>
                    ) : null}

                    {/* New Track Card */}
                    <AnimatePresence>
                      {showNewTrack && selectedSongId && (
                        <TrackCreationCard
                          songId={selectedSongId}
                          onClose={() => setShowNewTrack(false)}
                          onCreate={handleCreateTrack}
                        />
                      )}
                    </AnimatePresence>

                    {/* Add Track Button */}
                    {selectedSong && !showNewTrack && (
                      <div className="px-2 py-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-[10px] text-muted-foreground hover:text-[#ff751f]"
                          onClick={() => setShowNewTrack(true)}
                          data-testid="button-add-track"
                        >
                          <Plus className="w-3 h-3" />
                          Add Track
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Playhead Line */}
                {engine.transport.duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-white/50 pointer-events-none z-10"
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
            {showMixer && hasTracks && allTracksReady && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 200 }}
                exit={{ height: 0 }}
                className="border-t border-white/5 bg-[#0d0d0d] overflow-hidden"
                data-testid="mixer-console"
              >
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between px-3 py-1 border-b border-white/10">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mixer</span>
                    <Button size="icon" variant="ghost" className="w-5 h-5" onClick={() => setShowMixer(false)} data-testid="button-hide-mixer">
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </div>
                  <ScrollArea className="flex-1" data-testid="mixer-scroll">
                    <div className="flex gap-0 p-2 h-full">
                      {completedTracks.map((track) => {
                        const color = STEM_COLORS[track.type] || "#A78BFA";
                        const trackId = track.id;
                        const engineTrack = engine.tracks.get(trackId);
                        const vol = engineTrack?.volume ?? (track.volume ?? 100) / 100;

                        return (
                          <div key={trackId} className="flex flex-col items-center gap-1 px-2 border-r border-white/5 last:border-r-0" style={{ minWidth: 80 }} data-testid={`mixer-strip-${track.type}`}>
                            <VUMeter getLevel={() => engine.getTrackMeter(trackId)} height={45} />
                            <div className="flex items-center gap-1" style={{ height: 45 }}>
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
                                data-testid={`slider-volume-${track.type}`}
                              />
                            </div>
                            <div className="flex gap-0.5">
                              <button
                                className={cn("w-4 h-4 rounded text-[7px] font-bold flex items-center justify-center",
                                  track.isMuted ? "bg-red-500/80 text-white" : "bg-white/5 text-muted-foreground"
                                )}
                                onClick={() => {
                                  updateTrack({ id: trackId, isMuted: !track.isMuted });
                                  engine.setTrackMute(trackId, !track.isMuted);
                                }}
                                data-testid={`mixer-mute-${track.type}`}
                              >M</button>
                              <button
                                className={cn("w-4 h-4 rounded text-[7px] font-bold flex items-center justify-center",
                                  track.isSolo ? "bg-yellow-500/80 text-white" : "bg-white/5 text-muted-foreground"
                                )}
                                onClick={() => {
                                  updateTrack({ id: trackId, isSolo: !track.isSolo });
                                  engine.setTrackSolo(trackId, !track.isSolo);
                                }}
                                data-testid={`mixer-solo-${track.type}`}
                              >S</button>
                            </div>
                            <span className="text-[8px] font-medium truncate w-full text-center" style={{ color }}>{track.name}</span>
                          </div>
                        );
                      })}

                      <div className="flex flex-col items-center gap-1 px-2 border-l border-[#ff751f]/30" style={{ minWidth: 80 }} data-testid="mixer-strip-master">
                        <VUMeter getLevel={() => engine.getMasterMeter()} height={45} />
                        <div className="flex items-center gap-1" style={{ height: 45 }}>
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
                        <span className="text-[8px] font-bold text-[#ff751f] uppercase tracking-wider">MASTER</span>
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
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-white/5 bg-[#0d0d0d] overflow-hidden flex-shrink-0 flex flex-col"
              data-testid="side-panel"
            >
              <Tabs value={sidebarTab} onValueChange={setSidebarTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="bg-transparent border-b border-white/5 rounded-none px-1 h-8 flex-shrink-0">
                  <TabsTrigger value="instruments" className="text-[9px] px-2 h-6 data-[state=active]:bg-[#ff751f]/10 data-[state=active]:text-[#ff751f]" data-testid="tab-instruments">
                    🎸 Instruments
                  </TabsTrigger>
                  <TabsTrigger value="effects" className="text-[9px] px-2 h-6 data-[state=active]:bg-[#ff751f]/10 data-[state=active]:text-[#ff751f]" data-testid="tab-effects">
                    🎛️ FX
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="text-[9px] px-2 h-6 data-[state=active]:bg-[#ff751f]/10 data-[state=active]:text-[#ff751f]" data-testid="tab-ai-tools">
                    ✨ AI
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1">
                  {/* INSTRUMENTS TAB */}
                  <TabsContent value="instruments" className="m-0 p-2 space-y-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Piano className="w-3.5 h-3.5 text-[#ff751f]" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">DA GRABA Instruments</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {BACHATA_INSTRUMENTS.map((inst) => (
                        <button
                          key={inst.name}
                          className="p-2 rounded-md border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-[#ff751f]/30 transition-all text-left group"
                          data-testid={`sidebar-instrument-${inst.name.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{inst.icon}</span>
                            <div>
                              <span className="text-[10px] font-medium block leading-tight">{inst.name}</span>
                              <span className="text-[8px] text-muted-foreground">VST3</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Samples</span>
                      </div>
                      <p className="text-[9px] text-muted-foreground mb-2">Drag samples from Sample Lab to timeline</p>
                      <Button size="sm" variant="outline" className="w-full gap-1.5 text-[10px] h-7" onClick={() => setLocation("/sample-lab")} data-testid="button-goto-sample-lab">
                        <Wand2 className="w-3 h-3" />
                        Open Sample Lab
                      </Button>
                    </div>
                  </TabsContent>

                  {/* EFFECTS TAB */}
                  <TabsContent value="effects" className="m-0 p-2 space-y-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <SlidersVertical className="w-3.5 h-3.5 text-[#ff751f]" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Audio Effects</span>
                    </div>
                    {EFFECTS_LIST.map((fx) => (
                      <Card key={fx.name} className="p-2 border-white/5 bg-white/[0.02] hover:bg-white/[0.06] transition-colors cursor-pointer" data-testid={`sidebar-effect-${fx.name.toLowerCase()}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded bg-white/5 flex items-center justify-center">
                            <fx.icon className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <span className="text-[10px] font-medium block">{fx.name}</span>
                            <span className="text-[8px] text-muted-foreground">{fx.desc}</span>
                          </div>
                        </div>
                      </Card>
                    ))}

                    {hasTracks && allTracksReady && (
                      <div className="pt-2 border-t border-white/5">
                        <p className="text-[9px] text-muted-foreground mb-2">Use the Mixer panel for per-track EQ, compression, and reverb</p>
                        <Button size="sm" variant="outline" className="w-full gap-1.5 text-[10px] h-7" onClick={() => setShowMixer(true)} data-testid="button-open-mixer-from-fx">
                          <SlidersVertical className="w-3 h-3" />
                          Open Mixer
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  {/* AI TOOLS TAB */}
                  <TabsContent value="ai" className="m-0 p-2 space-y-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#ff751f]" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">AI Tools</span>
                    </div>

                    {selectedSong && !hasTracks && canUseStemSeparation && (
                      <Card className="p-2.5 border-white/5 bg-[#111]">
                        <div className="flex items-center gap-2 mb-2">
                          <Scissors className="w-3.5 h-3.5 text-[#FF8C00]" />
                          <span className="text-[10px] font-medium">Stem Separation</span>
                        </div>
                        <Button size="sm" className="w-full gap-1.5 text-[10px] h-7" disabled={isSeparating} onClick={handleSeparate} data-testid="button-separate-stems-side">
                          {isSeparating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
                          {isSeparating ? "Processing..." : "Separate Stems"}
                        </Button>
                      </Card>
                    )}

                    {selectedSong && (
                      <>
                        <Card className="p-2.5 border-white/5 bg-[#111]">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 rounded bg-emerald-500/10 flex items-center justify-center">
                              <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                            </div>
                            <div>
                              <span className="text-[10px] font-medium block">Master</span>
                              <span className="text-[8px] text-muted-foreground">Professional quality</span>
                            </div>
                          </div>
                          <Button size="sm" className="w-full gap-1.5 text-[10px] h-7" disabled={isMastering} onClick={() => selectedSongId && masterSong(selectedSongId)} data-testid="button-master-song">
                            {isMastering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            {isMastering ? "Processing..." : "Master Track"}
                          </Button>
                        </Card>

                        <Card className="p-2.5 border-white/5 bg-[#111]">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 rounded bg-blue-500/10 flex items-center justify-center">
                              <Shield className="w-2.5 h-2.5 text-blue-400" />
                            </div>
                            <div>
                              <span className="text-[10px] font-medium block">Denoise</span>
                              <span className="text-[8px] text-muted-foreground">Remove noise</span>
                            </div>
                          </div>
                          <Button size="sm" className="w-full gap-1.5 text-[10px] h-7" disabled={isDenoising} onClick={() => selectedSongId && denoiseSong(selectedSongId)} data-testid="button-denoise-song">
                            {isDenoising ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                            {isDenoising ? "Processing..." : "Denoise"}
                          </Button>
                        </Card>

                        <Card className="p-2.5 border-white/5 bg-[#111]">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 rounded bg-purple-500/10 flex items-center justify-center">
                              <MicVocal className="w-2.5 h-2.5 text-purple-400" />
                            </div>
                            <div>
                              <span className="text-[10px] font-medium block">AI Cover</span>
                              <span className="text-[8px] text-muted-foreground">Re-sing with AI voice</span>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <Input
                              placeholder="Voice..."
                              value={coverVoice}
                              onChange={(e) => setCoverVoice(e.target.value)}
                              className="flex-1 text-[10px] bg-black/20 border-white/10 h-7"
                              data-testid="input-cover-voice"
                            />
                            <Button
                              size="sm"
                              className="flex-shrink-0 gap-1 h-7 text-[10px]"
                              disabled={isCovering || !coverVoice.trim() || !selectedSongId}
                              onClick={() => {
                                if (selectedSongId && coverVoice.trim()) {
                                  coverSong({ songId: selectedSongId, voiceId: coverVoice });
                                  setCoverVoice("");
                                }
                              }}
                              data-testid="button-cover-song"
                            >
                              {isCovering ? <Loader2 className="w-3 h-3 animate-spin" /> : <MicVocal className="w-3 h-3" />}
                            </Button>
                          </div>
                        </Card>

                        <Card className="p-2.5 border-white/5 bg-[#111]">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 rounded bg-orange-500/10 flex items-center justify-center">
                              <Scissors className="w-2.5 h-2.5 text-orange-400" />
                            </div>
                            <div>
                              <span className="text-[10px] font-medium block">Trim</span>
                              <span className="text-[8px] text-muted-foreground">Cut to range</span>
                            </div>
                          </div>
                          <div className="flex gap-1.5 items-end">
                            <div className="flex-1">
                              <label className="text-[8px] text-muted-foreground block mb-0.5">Start</label>
                              <Input type="number" placeholder="0" min="0" step="0.5" value={trimStart} onChange={(e) => setTrimStart(e.target.value)} className="text-[10px] bg-black/20 border-white/10 h-6" data-testid="input-trim-start" />
                            </div>
                            <div className="flex-1">
                              <label className="text-[8px] text-muted-foreground block mb-0.5">End</label>
                              <Input type="number" placeholder="30" min="0.5" step="0.5" value={trimEnd} onChange={(e) => setTrimEnd(e.target.value)} className="text-[10px] bg-black/20 border-white/10 h-6" data-testid="input-trim-end" />
                            </div>
                            <Button
                              size="sm"
                              className="flex-shrink-0 h-6 w-6 p-0"
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
                              {isTrimming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
                            </Button>
                          </div>
                        </Card>
                      </>
                    )}

                    {completedTracks.length > 0 && (
                      <Card className="p-2.5 border-white/5 bg-[#111]">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-3.5 h-3.5 text-[#FF8C00]" />
                          <div>
                            <span className="text-[10px] font-medium block" data-testid="text-download-section-title">Download</span>
                            <span className="text-[8px] text-muted-foreground">{completedTracks.length} tracks · WAV</span>
                          </div>
                        </div>
                        <div className="space-y-0.5 mb-2">
                          {completedTracks.map((track) => (
                            <div key={track.id} className="flex items-center justify-between gap-1">
                              <span className="text-[9px] text-muted-foreground truncate">{track.name}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="w-5 h-5"
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
                                <Download className="w-2.5 h-2.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <Button size="sm" className="w-full gap-1.5 text-[10px] h-7" disabled={isDownloadingAll} onClick={handleDownloadAll} data-testid="button-download-all-stems">
                          {isDownloadingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
                          {isDownloadingAll ? "Creating ZIP..." : "Download All (ZIP)"}
                        </Button>
                      </Card>
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
