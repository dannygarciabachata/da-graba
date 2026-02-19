import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSongs } from "@/hooks/use-songs";
import { useSongTracks, useSeparateStems, useUpdateTrack, useMasterSong, useDenoiseSong, useCoverSong, useTrimSong } from "@/hooks/use-tracks";
import { useAudioEngine } from "@/hooks/use-audio-engine";
import { useStripeSubscription } from "@/hooks/use-stripe";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Play, Pause, Square, Volume2, VolumeX, Mic, Drum,
  Guitar, Music, Loader2, Scissors, Download, SkipBack,
  Sparkles, Shield, MicVocal, ChevronDown, ChevronUp,
  Repeat, Package, PanelRightClose, PanelRightOpen
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import type { Track } from "@shared/schema";
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
};

const STEM_ICONS: Record<string, typeof Mic> = {
  vocals: Mic,
  drums: Drum,
  bass: Guitar,
  other: Music,
};

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

  return (
    <canvas
      ref={canvasRef}
      width={14}
      height={height}
      className="rounded-sm"
      style={{ width: 14, height }}
    />
  );
}

function WaveformCanvas({
  buffer,
  color,
  currentTime,
  duration,
  onSeek,
  height = 64,
}: {
  buffer: AudioBuffer | null;
  color: string;
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, w, h);

    if (buffer) {
      const data = buffer.getChannelData(0);
      const step = Math.ceil(data.length / w);
      const mid = h / 2;

      ctx.beginPath();
      ctx.strokeStyle = `${color}50`;
      ctx.lineWidth = 1;

      for (let i = 0; i < w; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
          const idx = i * step + j;
          if (idx < data.length) {
            const val = data[idx];
            if (val < min) min = val;
            if (val > max) max = val;
          }
        }
        const yLow = mid + min * mid;
        const yHigh = mid + max * mid;
        ctx.moveTo(i, yLow);
        ctx.lineTo(i, yHigh);
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      const rmsStep = Math.ceil(data.length / w);
      for (let i = 0; i < w; i++) {
        let sum = 0;
        let count = 0;
        for (let j = 0; j < rmsStep; j++) {
          const idx = i * rmsStep + j;
          if (idx < data.length) {
            sum += data[idx] * data[idx];
            count++;
          }
        }
        const rms = Math.sqrt(sum / (count || 1));
        const yTop = mid - rms * mid * 0.8;
        const yBot = mid + rms * mid * 0.8;
        ctx.moveTo(i, yTop);
        ctx.lineTo(i, yBot);
      }
      ctx.stroke();
    }

    if (duration > 0) {
      const progress = currentTime / duration;
      const playheadX = progress * w;

      ctx.fillStyle = `${color}15`;
      ctx.fillRect(0, 0, playheadX, h);

      ctx.beginPath();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, h);
      ctx.stroke();
    }
  }, [buffer, color, currentTime, duration]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    onSeek(progress * duration);
  };

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer rounded-sm"
        onClick={handleClick}
        style={{ height }}
      />
    </div>
  );
}

function TimelineRuler({ duration, currentTime }: { duration: number; currentTime: number }) {
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

    if (duration <= 0) return;

    const interval = duration > 120 ? 30 : duration > 60 ? 10 : duration > 30 ? 5 : 1;

    ctx.strokeStyle = "#333";
    ctx.fillStyle = "#666";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";

    for (let t = 0; t <= duration; t += interval) {
      const x = (t / duration) * w;
      ctx.beginPath();
      ctx.moveTo(x, h - 6);
      ctx.lineTo(x, h);
      ctx.stroke();

      const min = Math.floor(t / 60);
      const sec = Math.floor(t % 60);
      ctx.fillText(`${min}:${sec.toString().padStart(2, "0")}`, x, h - 8);
    }

    const playX = (currentTime / duration) * w;
    ctx.beginPath();
    ctx.fillStyle = "#ff751f";
    ctx.moveTo(playX - 4, 0);
    ctx.lineTo(playX + 4, 0);
    ctx.lineTo(playX, 6);
    ctx.fill();
  }, [duration, currentTime]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: 24 }}
    />
  );
}

function formatTime(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function StudioPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: songs, isLoading: songsLoading } = useSongs();
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const { data: songTracks, isLoading: tracksLoading } = useSongTracks(selectedSongId);
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

  const [showMixer, setShowMixer] = useState(true);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [coverVoice, setCoverVoice] = useState("");
  const [trimStart, setTrimStart] = useState("");
  const [trimEnd, setTrimEnd] = useState("");
  const [trackPans, setTrackPans] = useState<Record<number, number>>({});
  const [trackEqs, setTrackEqs] = useState<Record<number, { low: number; mid: number; high: number }>>({});
  const [trackCompressors, setTrackCompressors] = useState<Record<number, boolean>>({});
  const [trackReverbs, setTrackReverbs] = useState<Record<number, number>>({});

  const completedSongs = songs?.filter((s) => s.status === "completed" && s.audioUrl) ?? [];
  const selectedSong = completedSongs.find((s) => s.id === selectedSongId);
  const hasTracks = songTracks && songTracks.length > 0;
  const allTracksReady = songTracks?.every((t) => t.status === "completed") ?? false;
  const completedTracks = songTracks?.filter((t) => t.status === "completed" && t.audioUrl) ?? [];

  useEffect(() => {
    if (!completedTracks.length) return;
    completedTracks.forEach((track) => {
      if (track.audioUrl) {
        engine.loadTrack(track.id, track.audioUrl, track.name, track.type);
      }
    });
  }, [completedTracks.map((t) => `${t.id}:${t.audioUrl}`).join(",")]);

  const handleSeparate = () => {
    if (selectedSongId) {
      separateStems(selectedSongId);
    }
  };

  const handleToggleMute = (track: Track) => {
    const newMuted = !track.isMuted;
    updateTrack({ id: track.id, isMuted: newMuted });
    engine.setTrackMute(track.id, newMuted);
  };

  const handleToggleSolo = (track: Track) => {
    const newSolo = !track.isSolo;
    updateTrack({ id: track.id, isSolo: newSolo });
    engine.setTrackSolo(track.id, newSolo);
  };

  const handleVolumeChange = (trackId: number, vol: number) => {
    engine.setTrackVolume(trackId, vol);
    updateTrack({ id: trackId, volume: Math.round(vol * 100) });
  };

  const handlePanChange = (trackId: number, pan: number) => {
    engine.setTrackPan(trackId, pan);
    setTrackPans((prev) => ({ ...prev, [trackId]: pan }));
  };

  const handleEQChange = (trackId: number, band: "low" | "mid" | "high", value: number) => {
    engine.setTrackEQ(trackId, band, value);
    setTrackEqs((prev) => ({
      ...prev,
      [trackId]: { ...(prev[trackId] || { low: 0, mid: 0, high: 0 }), [band]: value },
    }));
  };

  const handleCompressorToggle = (trackId: number) => {
    const current = trackCompressors[trackId] ?? false;
    const newEnabled = !current;
    engine.setTrackCompressor(trackId, { enabled: newEnabled });
    setTrackCompressors((prev) => ({ ...prev, [trackId]: newEnabled }));
  };

  const handleReverbChange = (trackId: number, mix: number) => {
    engine.setTrackReverb(trackId, { mix, enabled: mix > 0 });
    setTrackReverbs((prev) => ({ ...prev, [trackId]: mix }));
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

  const anySoloed = songTracks?.some((t) => t.isSolo) ?? false;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] text-foreground font-sans overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 bg-[#111] border-b border-white/5 flex-wrap" data-testid="studio-top-bar">
        <div className="flex items-center gap-2 min-w-0">
          <Scissors className="w-4 h-4 text-[#ff751f] flex-shrink-0" />
          <select
            className="bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-sm text-foreground min-w-[140px] max-w-[220px] truncate"
            value={selectedSongId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                engine.stopPlayback();
                setSelectedSongId(Number(val));
              } else {
                setSelectedSongId(null);
              }
            }}
            data-testid="select-song"
          >
            <option value="">{songsLoading ? "Loading..." : "Select a song..."}</option>
            {completedSongs.map((song) => (
              <option key={song.id} value={song.id}>
                {song.title}
              </option>
            ))}
          </select>
        </div>

        {selectedSong && hasTracks && allTracksReady && (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => { engine.stopPlayback(); engine.seekTo(0); }}
              data-testid="button-rewind"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => engine.togglePlayPause()}
              data-testid="button-play-pause"
            >
              {engine.transport.isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => engine.stopPlayback()}
              data-testid="button-stop"
            >
              <Square className="w-4 h-4 fill-current" />
            </Button>
            <Button
              size="icon"
              variant={engine.transport.loopEnabled ? "default" : "ghost"}
              className={cn("toggle-elevate", engine.transport.loopEnabled && "toggle-elevated")}
              onClick={() => engine.setLoop(!engine.transport.loopEnabled)}
              data-testid="button-loop"
            >
              <Repeat className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground font-mono" data-testid="text-time-display">
            {formatTime(engine.transport.currentTime)} / {formatTime(engine.transport.duration)}
          </span>
          {selectedSong && (
            <Badge variant="secondary" className="text-[10px]" data-testid="badge-song-info">
              {GENRE_DISPLAY[selectedSong.genre || ""] || selectedSong.genre || "DA GRABACHATA"}
            </Badge>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowSidePanel(!showSidePanel)}
            data-testid="button-toggle-side-panel"
          >
            {showSidePanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto" data-testid="timeline-area">
            {!selectedSong ? (
              <div className="flex-1 flex items-center justify-center h-full p-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Scissors className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-bold mb-2" data-testid="text-studio-title">{t("studio.title")}</h3>
                  <p className="text-sm text-muted-foreground max-w-md">{t("studio.selectSong")}</p>
                </motion.div>
              </div>
            ) : !hasTracks ? (
              <div className="flex-1 flex items-center justify-center h-full p-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <div className="grid grid-cols-2 gap-3 mb-6 max-w-xs mx-auto">
                    {[
                      { icon: Mic, label: t("studio.tracks.vocals"), color: "#FF6B9D" },
                      { icon: Drum, label: t("studio.tracks.drums"), color: "#FFB347" },
                      { icon: Guitar, label: t("studio.tracks.bass"), color: "#4ECDC4" },
                      { icon: Music, label: t("studio.tracks.other"), color: "#A78BFA" },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="p-4 rounded-xl border border-white/5 bg-[#111] flex flex-col items-center gap-2"
                      >
                        <s.icon className="w-6 h-6" style={{ color: s.color }} />
                        <span className="text-xs font-medium">{s.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground max-w-sm mb-4">
                    {canUseStemSeparation ? t("studio.separateDescription") : t("studio.stemsProOnly")}
                  </p>
                  {canUseStemSeparation ? (
                    <Button
                      onClick={handleSeparate}
                      disabled={isSeparating}
                      className="gap-2"
                      data-testid="button-separate-stems"
                    >
                      {isSeparating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
                      {t("studio.separateTracks")}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setLocation("/pricing")}
                      variant="outline"
                      className="gap-2"
                      data-testid="button-upgrade-stems"
                    >
                      <Sparkles className="w-4 h-4" />
                      {t("studio.upgradeForStems")}
                    </Button>
                  )}
                </motion.div>
              </div>
            ) : tracksLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="px-4 pt-2" style={{ paddingLeft: 140 }}>
                  <TimelineRuler duration={engine.transport.duration} currentTime={engine.transport.currentTime} />
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-1 p-2">
                    {songTracks?.map((track) => {
                      const Icon = STEM_ICONS[track.type] || Music;
                      const color = STEM_COLORS[track.type] || "#A78BFA";
                      const isSoloedByOther = anySoloed && !track.isSolo;
                      const isPending = track.status === "pending" || track.status === "processing";
                      const buffer = track.status === "completed" ? engine.getTrackBuffer(track.id) : null;

                      return (
                        <div
                          key={track.id}
                          className={cn(
                            "flex items-stretch bg-[#111] rounded border border-white/5 overflow-visible",
                            isSoloedByOther && !track.isMuted && "opacity-40"
                          )}
                          data-testid={`track-row-${track.id}`}
                        >
                          <div
                            className="flex flex-col items-center justify-center gap-1 px-3 py-2 border-r border-white/5 flex-shrink-0"
                            style={{ width: 130, backgroundColor: `${color}08` }}
                          >
                            <div
                              className="w-8 h-8 rounded flex items-center justify-center"
                              style={{ backgroundColor: `${color}20` }}
                            >
                              <Icon className="w-4 h-4" style={{ color }} />
                            </div>
                            <span className="text-[10px] font-medium truncate w-full text-center" data-testid={`text-track-name-${track.type}`}>
                              {track.name}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant={track.isMuted ? "default" : "ghost"}
                                className={cn("toggle-elevate", track.isMuted && "toggle-elevated bg-destructive/80")}
                                onClick={() => handleToggleMute(track)}
                                data-testid={`button-mute-${track.type}`}
                              >
                                <span className="text-[10px] font-bold">M</span>
                              </Button>
                              <Button
                                size="icon"
                                variant={track.isSolo ? "default" : "ghost"}
                                className={cn("toggle-elevate", track.isSolo && "toggle-elevated bg-yellow-600")}
                                onClick={() => handleToggleSolo(track)}
                                data-testid={`button-solo-${track.type}`}
                              >
                                <span className="text-[10px] font-bold">S</span>
                              </Button>
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 p-1">
                            {isPending ? (
                              <div className="h-16 flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Processing...</span>
                              </div>
                            ) : track.status === "completed" ? (
                              <WaveformCanvas
                                buffer={buffer}
                                color={color}
                                currentTime={engine.transport.currentTime}
                                duration={engine.transport.duration}
                                onSeek={(time) => engine.seekTo(time)}
                                height={64}
                              />
                            ) : (
                              <div className="h-16 flex items-center justify-center">
                                <span className="text-xs text-destructive">{track.error || "Failed"}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <AnimatePresence>
            {showMixer && hasTracks && allTracksReady && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 220 }}
                exit={{ height: 0 }}
                className="border-t border-white/5 bg-[#0d0d0d] overflow-hidden"
                data-testid="mixer-console"
              >
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between px-3 py-1 border-b border-white/10">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mixer Console</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowMixer(false)}
                      data-testid="button-hide-mixer"
                    >
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
                        const pan = trackPans[trackId] ?? 0;
                        const eq = trackEqs[trackId] || { low: 0, mid: 0, high: 0 };
                        const compEnabled = trackCompressors[trackId] ?? false;
                        const reverbMix = trackReverbs[trackId] ?? 0;

                        return (
                          <div
                            key={trackId}
                            className="flex flex-col items-center gap-1 px-2 border-r border-white/5 last:border-r-0"
                            style={{ minWidth: 90 }}
                            data-testid={`mixer-strip-${track.type}`}
                          >
                            <VUMeter getLevel={() => engine.getTrackMeter(trackId)} height={50} />

                            <div className="flex items-center gap-1" style={{ height: 50 }}>
                              <Slider
                                orientation="vertical"
                                value={[vol * 100]}
                                max={100}
                                step={1}
                                onValueChange={(v) => handleVolumeChange(trackId, v[0] / 100)}
                                className="h-full"
                                data-testid={`slider-volume-${track.type}`}
                              />
                            </div>

                            <div className="w-full">
                              <Slider
                                value={[pan * 50 + 50]}
                                max={100}
                                step={1}
                                onValueChange={(v) => handlePanChange(trackId, (v[0] - 50) / 50)}
                                data-testid={`slider-pan-${track.type}`}
                              />
                              <span className="text-[8px] text-muted-foreground block text-center">
                                {pan < -0.1 ? `L${Math.abs(Math.round(pan * 100))}` : pan > 0.1 ? `R${Math.round(pan * 100)}` : "C"}
                              </span>
                            </div>

                            <div className="flex gap-0.5 w-full">
                              {(["low", "mid", "high"] as const).map((band) => (
                                <div key={band} className="flex-1 flex flex-col items-center">
                                  <span className="text-[7px] text-muted-foreground uppercase">{band[0]}</span>
                                  <Slider
                                    orientation="vertical"
                                    value={[eq[band] + 12]}
                                    max={24}
                                    step={1}
                                    onValueChange={(v) => handleEQChange(trackId, band, v[0] - 12)}
                                    className="h-[24px]"
                                    data-testid={`slider-eq-${band}-${track.type}`}
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant={track.isMuted ? "default" : "ghost"}
                                className={cn("toggle-elevate", track.isMuted && "toggle-elevated bg-destructive/80")}
                                onClick={() => handleToggleMute(track)}
                                data-testid={`mixer-mute-${track.type}`}
                              >
                                <span className="text-[8px] font-bold">M</span>
                              </Button>
                              <Button
                                size="icon"
                                variant={track.isSolo ? "default" : "ghost"}
                                className={cn("toggle-elevate", track.isSolo && "toggle-elevated bg-yellow-600")}
                                onClick={() => handleToggleSolo(track)}
                                data-testid={`mixer-solo-${track.type}`}
                              >
                                <span className="text-[8px] font-bold">S</span>
                              </Button>
                            </div>

                            <span
                              className="text-[8px] font-medium truncate w-full text-center"
                              style={{ color }}
                            >
                              {track.name}
                            </span>
                          </div>
                        );
                      })}

                      <div
                        className="flex flex-col items-center gap-1 px-2 border-l border-[#ff751f]/30"
                        style={{ minWidth: 90 }}
                        data-testid="mixer-strip-master"
                      >
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

                        <div className="flex gap-0.5 w-full">
                          {(["low", "mid", "high"] as const).map((band) => (
                            <div key={band} className="flex-1 flex flex-col items-center">
                              <span className="text-[7px] text-muted-foreground uppercase">{band[0]}</span>
                              <Slider
                                orientation="vertical"
                                value={[engine.masterSettings.eq[band] + 12]}
                                max={24}
                                step={1}
                                onValueChange={(v) => engine.setMasterEQ(band, v[0] - 12)}
                                className="h-[24px]"
                                data-testid={`slider-master-eq-${band}`}
                              />
                            </div>
                          ))}
                        </div>

                        <span className="text-[8px] font-bold text-[#ff751f] uppercase tracking-wider">
                          MASTER
                        </span>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!showMixer && hasTracks && allTracksReady && (
            <div className="border-t border-white/5 bg-[#0d0d0d] px-3 py-1">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-[10px]"
                onClick={() => setShowMixer(true)}
                data-testid="button-show-mixer"
              >
                <ChevronUp className="w-3 h-3" />
                Show Mixer
              </Button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {showSidePanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-white/5 bg-[#0d0d0d] overflow-hidden flex-shrink-0"
              data-testid="side-panel"
            >
              <ScrollArea className="h-full">
                <div className="p-3 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-[#ff751f]" />
                    <h3 className="text-sm font-bold" data-testid="text-ai-tools-title">{t("studio.aiTools")}</h3>
                  </div>

                  {selectedSong && !hasTracks && canUseStemSeparation && (
                    <Card className="p-3 border-white/5 bg-[#111]">
                      <div className="flex items-center gap-2 mb-2">
                        <Scissors className="w-4 h-4 text-[#FF8C00]" />
                        <p className="text-sm font-medium">{t("studio.separateTracks")}</p>
                      </div>
                      <Button
                        size="sm"
                        className="w-full gap-1.5"
                        disabled={isSeparating}
                        onClick={handleSeparate}
                        data-testid="button-separate-stems-side"
                      >
                        {isSeparating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
                        {isSeparating ? t("common.processing") : t("studio.separateTracks")}
                      </Button>
                    </Card>
                  )}

                  {selectedSong && (
                    <>
                      <Card className="p-3 border-white/5 bg-[#111]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center">
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-xs font-medium">Master</p>
                            <p className="text-[9px] text-muted-foreground">Professional quality</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="w-full gap-1.5"
                          disabled={isMastering}
                          onClick={() => selectedSongId && masterSong(selectedSongId)}
                          data-testid="button-master-song"
                        >
                          {isMastering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          {isMastering ? t("common.processing") : t("studio.masterTrack")}
                        </Button>
                      </Card>

                      <Card className="p-3 border-white/5 bg-[#111]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center">
                            <Shield className="w-3 h-3 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-xs font-medium">Denoise</p>
                            <p className="text-[9px] text-muted-foreground">Remove noise</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="w-full gap-1.5"
                          disabled={isDenoising}
                          onClick={() => selectedSongId && denoiseSong(selectedSongId)}
                          data-testid="button-denoise-song"
                        >
                          {isDenoising ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                          {isDenoising ? t("common.processing") : t("studio.denoiseTrack")}
                        </Button>
                      </Card>

                      <Card className="p-3 border-white/5 bg-[#111]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded bg-purple-500/10 flex items-center justify-center">
                            <MicVocal className="w-3 h-3 text-purple-400" />
                          </div>
                          <div>
                            <p className="text-xs font-medium">AI Cover</p>
                            <p className="text-[9px] text-muted-foreground">Re-sing with AI voice</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Voice name..."
                            value={coverVoice}
                            onChange={(e) => setCoverVoice(e.target.value)}
                            className="flex-1 text-xs bg-black/20 border-white/10"
                            data-testid="input-cover-voice"
                          />
                          <Button
                            size="sm"
                            className="flex-shrink-0 gap-1"
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
                            {isCovering ? t("common.processing") : t("studio.createCover")}
                          </Button>
                        </div>
                      </Card>

                      <Card className="p-3 border-white/5 bg-[#111]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded bg-orange-500/10 flex items-center justify-center">
                            <Scissors className="w-3 h-3 text-orange-400" />
                          </div>
                          <div>
                            <p className="text-xs font-medium">Audio Cutter</p>
                            <p className="text-[9px] text-muted-foreground">Trim to range</p>
                          </div>
                        </div>
                        <div className="flex gap-2 items-end flex-wrap">
                          <div className="flex-1 min-w-[60px]">
                            <label className="text-[9px] text-muted-foreground mb-1 block">Start (s)</label>
                            <Input
                              type="number"
                              placeholder="0"
                              min="0"
                              step="0.5"
                              value={trimStart}
                              onChange={(e) => setTrimStart(e.target.value)}
                              className="text-xs bg-black/20 border-white/10"
                              data-testid="input-trim-start"
                            />
                          </div>
                          <div className="flex-1 min-w-[60px]">
                            <label className="text-[9px] text-muted-foreground mb-1 block">End (s)</label>
                            <Input
                              type="number"
                              placeholder="30"
                              min="0.5"
                              step="0.5"
                              value={trimEnd}
                              onChange={(e) => setTrimEnd(e.target.value)}
                              className="text-xs bg-black/20 border-white/10"
                              data-testid="input-trim-end"
                            />
                          </div>
                          <Button
                            size="sm"
                            className="flex-shrink-0 gap-1"
                            disabled={isTrimming || !trimStart || !trimEnd || !selectedSongId || parseFloat(trimEnd) <= parseFloat(trimStart)}
                            onClick={() => {
                              if (selectedSongId && trimStart && trimEnd) {
                                const startMs = parseFloat(trimStart) * 1000;
                                const endMs = parseFloat(trimEnd) * 1000;
                                trimSong({ songId: selectedSongId, startTimeMs: startMs, endTimeMs: endMs });
                                setTrimStart("");
                                setTrimEnd("");
                              }
                            }}
                            data-testid="button-trim-song"
                          >
                            {isTrimming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
                            {isTrimming ? t("common.processing") : t("studio.trimAudio")}
                          </Button>
                        </div>
                      </Card>
                    </>
                  )}

                  {completedTracks.length > 0 && (
                    <Card className="p-3 border-white/5 bg-[#111]">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-4 h-4 text-[#FF8C00]" />
                        <div>
                          <p className="text-xs font-medium" data-testid="text-download-section-title">Download Stems</p>
                          <p className="text-[9px] text-muted-foreground">{completedTracks.length} tracks · WAV</p>
                        </div>
                      </div>
                      <div className="space-y-1 mb-2">
                        {completedTracks.map((track) => (
                          <div key={track.id} className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-muted-foreground truncate">{track.name}</span>
                            <Button
                              size="icon"
                              variant="ghost"
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
                      <Button
                        size="sm"
                        className="w-full gap-1.5"
                        disabled={isDownloadingAll}
                        onClick={handleDownloadAll}
                        data-testid="button-download-all-stems"
                      >
                        {isDownloadingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
                        {isDownloadingAll ? "Creating ZIP..." : "Download All (ZIP)"}
                      </Button>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
