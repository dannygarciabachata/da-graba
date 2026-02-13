import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSongs } from "@/hooks/use-songs";
import { useSongTracks, useSeparateStems, useUpdateTrack, useMasterSong, useDenoiseSong, useCoverSong, useTrimSong } from "@/hooks/use-tracks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Play, Pause, Square, Volume2, VolumeX, Mic, Drum,
  Guitar, Music, Loader2, Scissors, ArrowLeft, ChevronRight, Download,
  Package, SkipBack, Sparkles, Shield, MicVocal
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import type { Track } from "@shared/schema";
import WaveSurfer from "wavesurfer.js";
import JSZip from "jszip";

const STEM_ICONS: Record<string, typeof Mic> = {
  vocals: Mic,
  drums: Drum,
  bass: Guitar,
  other: Music,
};

const STEM_COLORS: Record<string, string> = {
  vocals: "#FF6B9D",
  drums: "#FFB347",
  bass: "#4ECDC4",
  other: "#A78BFA",
};

function TrackStrip({
  track,
  audioRef,
  isSoloedByOther,
  onToggleMute,
  onToggleSolo,
  onVolumeChange,
  onSeek,
}: {
  track: Track;
  audioRef: HTMLAudioElement | null;
  isSoloedByOther: boolean;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onVolumeChange: (vol: number) => void;
  onSeek: (progress: number) => void;
}) {
  const waveRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [waveReady, setWaveReady] = useState(false);
  const Icon = STEM_ICONS[track.type] || Music;
  const color = STEM_COLORS[track.type] || "#00F3FF";

  const effectivelyMuted = isSoloedByOther || (track.isMuted && !track.isSolo);

  useEffect(() => {
    if (!waveRef.current || !track.audioUrl || track.status !== "completed" || !audioRef) return;

    const ws = WaveSurfer.create({
      container: waveRef.current,
      waveColor: `${color}40`,
      progressColor: color,
      cursorColor: "#ffffff40",
      barWidth: 2,
      barGap: 2,
      height: 48,
      normalize: false,
      interact: true,
      media: audioRef,
    });

    ws.on("ready", () => setWaveReady(true));
    ws.on("seeking", (currentTime: number) => {
      if (audioRef && audioRef.duration) {
        onSeek(currentTime / audioRef.duration);
      }
    });
    wsRef.current = ws;

    return () => {
      ws.destroy();
      wsRef.current = null;
      setWaveReady(false);
    };
  }, [track.audioUrl, track.status, color, audioRef]);

  useEffect(() => {
    if (!audioRef) return;
    const vol = effectivelyMuted ? 0 : (track.volume ?? 100) / 100;
    audioRef.volume = vol;
  }, [effectivelyMuted, track.volume, audioRef]);

  const isPending = track.status === "pending" || track.status === "processing";
  const isFailed = track.status === "failed";

  return (
    <Card
      className={cn(
        "p-3 md:p-4 border-white/5 bg-card transition-opacity duration-200",
        isSoloedByOther && !track.isSolo && "opacity-40"
      )}
      data-testid={`track-strip-${track.type}`}
    >
      <div className="flex items-center gap-3 md:gap-4">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium truncate" data-testid={`text-track-name-${track.type}`}>
              {track.name}
            </span>
            {isPending && (
              <span className="text-[10px] text-yellow-500 flex items-center gap-1 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processing
              </span>
            )}
            {isFailed && (
              <span className="text-[10px] text-destructive" title={track.error || "Processing failed"}>
                Failed - Retry available
              </span>
            )}
            {track.status === "completed" && track.isSolo && (
              <span className="text-[10px] text-yellow-500 uppercase tracking-wider font-bold">
                SOLO
              </span>
            )}
            {effectivelyMuted && track.status === "completed" && (
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {isSoloedByOther ? "Solo Off" : "Muted"}
              </span>
            )}
          </div>

          {track.status === "completed" && track.audioUrl ? (
            <div ref={waveRef} className="w-full" />
          ) : (
            <div className="h-12 bg-white/5 rounded flex items-center justify-center">
              {isPending ? (
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-1 bg-white/20 rounded-full animate-pulse"
                      style={{
                        height: `${12 + Math.random() * 24}px`,
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">No audio</span>
              )}
            </div>
          )}
        </div>
      </div>

      {track.status === "completed" && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Button
            size="sm"
            variant={track.isMuted ? "default" : "outline"}
            className={cn("text-xs gap-1", track.isMuted && "bg-destructive/80")}
            onClick={onToggleMute}
            data-testid={`button-mute-${track.type}`}
          >
            {track.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            {track.isMuted ? "Muted" : "Mute"}
          </Button>
          <Button
            size="sm"
            variant={track.isSolo ? "default" : "outline"}
            className={cn("text-xs gap-1", track.isSolo && "bg-yellow-600")}
            onClick={onToggleSolo}
            data-testid={`button-solo-${track.type}`}
          >
            S
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-[100px]">
            <Slider
              value={[track.volume ?? 100]}
              max={100}
              step={1}
              onValueChange={(v) => onVolumeChange(v[0])}
              className="flex-1"
              data-testid={`slider-volume-${track.type}`}
            />
            <span className="text-xs text-muted-foreground w-8 text-right font-mono">
              {track.volume ?? 100}%
            </span>
          </div>
          {track.audioUrl && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs"
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
              WAV
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export default function StudioPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: songs, isLoading: songsLoading } = useSongs();
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSongList, setShowSongList] = useState(true);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const { data: songTracks, isLoading: tracksLoading } = useSongTracks(selectedSongId);
  const { mutate: separateStems, isPending: isSeparating } = useSeparateStems();
  const { mutate: updateTrack } = useUpdateTrack();
  const { mutate: masterSong, isPending: isMastering } = useMasterSong();
  const { mutate: denoiseSong, isPending: isDenoising } = useDenoiseSong();
  const { mutate: coverSong, isPending: isCovering } = useCoverSong();
  const { mutate: trimSong, isPending: isTrimming } = useTrimSong();
  const [showTools, setShowTools] = useState(false);
  const [coverVoice, setCoverVoice] = useState("");
  const [trimStart, setTrimStart] = useState("");
  const [trimEnd, setTrimEnd] = useState("");

  const audioElementsRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const [audioReady, setAudioReady] = useState<Set<number>>(new Set());

  const completedSongs = songs?.filter((s) => s.status === "completed" && s.audioUrl) ?? [];
  const selectedSong = completedSongs.find((s) => s.id === selectedSongId);
  const hasTracks = songTracks && songTracks.length > 0;
  const allTracksReady = songTracks?.every((t) => t.status === "completed") ?? false;
  const completedTracks = songTracks?.filter((t) => t.status === "completed" && t.audioUrl) ?? [];

  const anySoloed = songTracks?.some((t) => t.isSolo) ?? false;

  useEffect(() => {
    const map = audioElementsRef.current;
    const currentIds = new Set(completedTracks.map((t) => t.id));

    for (const track of completedTracks) {
      if (!track.audioUrl) continue;
      if (map.has(track.id)) continue;
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.preload = "auto";
      audio.src = track.audioUrl;
      audio.addEventListener("canplaythrough", () => {
        setAudioReady((prev) => new Set(prev).add(track.id));
      }, { once: true });
      map.set(track.id, audio);
    }

    Array.from(map.entries()).forEach(([id, audio]) => {
      if (!currentIds.has(id)) {
        audio.pause();
        audio.src = "";
        map.delete(id);
      }
    });

    setAudioReady((prev) => {
      const next = new Set<number>();
      prev.forEach((id) => {
        if (currentIds.has(id)) next.add(id);
      });
      return next;
    });

    return () => {};
  }, [completedTracks.map((t) => `${t.id}:${t.audioUrl}`).join(",")]);

  useEffect(() => {
    return () => {
      Array.from(audioElementsRef.current.values()).forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      audioElementsRef.current.clear();
    };
  }, [selectedSongId]);

  const allAudioReady = completedTracks.length > 0 && completedTracks.every((t) => audioReady.has(t.id));

  const syncPlayAll = useCallback(() => {
    const elements = audioElementsRef.current;
    const audios = completedTracks.map((t) => elements.get(t.id)).filter(Boolean) as HTMLAudioElement[];
    if (audios.length === 0) return;

    const masterTime = audios[0].currentTime;
    for (const audio of audios) {
      if (Math.abs(audio.currentTime - masterTime) > 0.05) {
        audio.currentTime = masterTime;
      }
    }

    Promise.all(audios.map((a) => a.play()))
      .then(() => setIsPlaying(true))
      .catch(() => {
        for (const audio of audios) {
          audio.play().catch(() => {});
        }
        setIsPlaying(true);
      });
  }, [completedTracks]);

  const pauseAll = useCallback(() => {
    Array.from(audioElementsRef.current.values()).forEach((audio) => {
      audio.pause();
    });
    setIsPlaying(false);
  }, []);

  const stopAll = useCallback(() => {
    Array.from(audioElementsRef.current.values()).forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    setIsPlaying(false);
  }, []);

  const seekAll = useCallback((progress: number) => {
    Array.from(audioElementsRef.current.values()).forEach((audio) => {
      if (audio.duration && isFinite(audio.duration)) {
        audio.currentTime = progress * audio.duration;
      }
    });
  }, []);

  if (!user) return null;

  const handleSeparate = () => {
    if (selectedSongId) {
      separateStems(selectedSongId);
      setShowSongList(false);
    }
  };

  const handleToggleMute = (track: Track) => {
    updateTrack({ id: track.id, isMuted: !track.isMuted });
  };

  const handleToggleSolo = (track: Track) => {
    updateTrack({ id: track.id, isSolo: !track.isSolo });
  };

  const handleVolumeChange = (track: Track, vol: number) => {
    updateTrack({ id: track.id, volume: vol });
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

  return (
    <div className="h-full bg-background text-foreground flex flex-col font-sans">
      <div className="px-4 md:px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Scissors className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold" data-testid="text-studio-title">Multitrack Studio</h1>
            <p className="text-xs text-muted-foreground">AI-powered stem separation & mixing</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div
          className={cn(
            "lg:w-80 lg:border-r border-white/5 flex flex-col bg-black/30",
            !showSongList && selectedSongId ? "hidden lg:flex" : "flex"
          )}
        >
          <div className="p-4 border-b border-white/5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Completed Songs
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Select a song to separate into individual tracks
            </p>
          </div>
          <ScrollArea className="flex-1 p-3">
            {songsLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : completedSongs.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground text-sm">
                No completed songs yet. Generate a track first.
              </div>
            ) : (
              <div className="space-y-2">
                {completedSongs.map((song) => (
                  <Card
                    key={song.id}
                    className={cn(
                      "p-3 cursor-pointer transition-all duration-200 border",
                      song.id === selectedSongId
                        ? "bg-primary/10 border-primary/50"
                        : "bg-card border-white/5 hover-elevate"
                    )}
                    onClick={() => {
                      pauseAll();
                      setSelectedSongId(song.id);
                      setShowSongList(false);
                    }}
                    data-testid={`card-studio-song-${song.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-blue-600/20 flex items-center justify-center flex-shrink-0">
                        <Music className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{song.title}</h4>
                        <p className="text-[10px] text-muted-foreground">
                          {song.genre || "Bachata"} · {song.mode === "aggregate" ? "Quick" : "Custom"}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedSong ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Scissors className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold mb-2">Multitrack Studio</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Select a completed song to separate it into individual tracks: Vocals, Drums, Bass, and Melody.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-white/5 flex items-center gap-3 flex-wrap">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setShowSongList(true)}
                  data-testid="button-show-song-list"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base md:text-lg font-bold truncate" data-testid="text-studio-song-title">
                    {selectedSong.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedSong.genre || "Bachata"} · Stem Separation
                  </p>
                </div>

                {!hasTracks && (
                  <Button
                    onClick={handleSeparate}
                    disabled={isSeparating}
                    className="gap-2"
                    data-testid="button-separate-stems"
                  >
                    {isSeparating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Scissors className="w-4 h-4" />
                    )}
                    Separate Tracks
                  </Button>
                )}

                {hasTracks && allTracksReady && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={stopAll}
                      data-testid="button-studio-rewind"
                    >
                      <SkipBack className="w-4 h-4 fill-current" />
                    </Button>
                    <Button
                      size="icon"
                      onClick={() => (isPlaying ? pauseAll() : syncPlayAll())}
                      disabled={!allAudioReady}
                      className="rounded-full bg-white text-black shadow-lg shadow-white/10"
                      data-testid="button-studio-play"
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={stopAll}
                      data-testid="button-studio-stop"
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </Button>
                  </div>
                )}
              </div>

              <ScrollArea className="flex-1 p-4">
                {tracksLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="animate-spin text-muted-foreground" />
                  </div>
                ) : !hasTracks ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center p-8 text-center"
                  >
                    <div className="grid grid-cols-2 gap-3 mb-6 max-w-xs">
                      {[
                        { icon: Mic, label: "Vocals", color: "#FF6B9D" },
                        { icon: Drum, label: "Drums", color: "#FFB347" },
                        { icon: Guitar, label: "Bass", color: "#4ECDC4" },
                        { icon: Music, label: "Melody", color: "#A78BFA" },
                      ].map((s) => (
                        <div
                          key={s.label}
                          className="p-4 rounded-xl border border-white/5 bg-card flex flex-col items-center gap-2"
                        >
                          <s.icon className="w-6 h-6" style={{ color: s.color }} />
                          <span className="text-xs font-medium">{s.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Click "Separate Tracks" to use AI to split this song into Vocals, Drums, Bass, and Melody stems.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3"
                  >
                    {songTracks?.map((track) => (
                      <TrackStrip
                        key={track.id}
                        track={track}
                        audioRef={audioElementsRef.current.get(track.id) ?? null}
                        isSoloedByOther={track.status === "completed" && anySoloed && !track.isSolo}
                        onToggleMute={() => handleToggleMute(track)}
                        onToggleSolo={() => handleToggleSolo(track)}
                        onVolumeChange={(vol) => handleVolumeChange(track, vol)}
                        onSeek={seekAll}
                      />
                    ))}

                    {completedTracks.length > 0 && (
                      <Card className="p-4 border-white/5 bg-card">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <h3 className="text-sm font-bold" data-testid="text-download-section-title">
                              Download Stems
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {completedTracks.length} tracks available in WAV format
                            </p>
                          </div>
                          <Button
                            onClick={handleDownloadAll}
                            disabled={isDownloadingAll}
                            className="gap-2"
                            data-testid="button-download-all-stems"
                          >
                            {isDownloadingAll ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Package className="w-4 h-4" />
                            )}
                            {isDownloadingAll ? "Creating ZIP..." : "Download All (ZIP)"}
                          </Button>
                        </div>
                      </Card>
                    )}

                    <Card className="p-4 border-white/5 bg-card">
                      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <h3 className="text-sm font-bold" data-testid="text-ai-tools-title">AI Audio Tools</h3>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => setShowTools(!showTools)}
                          data-testid="button-toggle-tools"
                        >
                          {showTools ? "Hide" : "Show Tools"}
                        </Button>
                      </div>

                      {showTools && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Card className="p-3 border-white/5">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                  <Sparkles className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Master</p>
                                  <p className="text-[10px] text-muted-foreground">Professional quality audio</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="w-full gap-1.5"
                                disabled={isMastering || !selectedSong}
                                onClick={() => selectedSongId && masterSong(selectedSongId)}
                                data-testid="button-master-song"
                              >
                                {isMastering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                {isMastering ? "Mastering..." : "Master Track"}
                              </Button>
                            </Card>

                            <Card className="p-3 border-white/5">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                  <Shield className="w-4 h-4 text-blue-400" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Denoise</p>
                                  <p className="text-[10px] text-muted-foreground">Remove background noise</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="w-full gap-1.5"
                                disabled={isDenoising || !selectedSong}
                                onClick={() => selectedSongId && denoiseSong(selectedSongId)}
                                data-testid="button-denoise-song"
                              >
                                {isDenoising ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                                {isDenoising ? "Cleaning..." : "Denoise Track"}
                              </Button>
                            </Card>
                          </div>

                          <Card className="p-3 border-white/5">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <MicVocal className="w-4 h-4 text-purple-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">AI Cover</p>
                                <p className="text-[10px] text-muted-foreground">Re-sing with a different AI voice</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Input
                                placeholder="Enter voice name... (e.g. Drake, Taylor Swift)"
                                value={coverVoice}
                                onChange={(e) => setCoverVoice(e.target.value)}
                                className="flex-1 text-xs bg-black/20 border-white/10"
                                data-testid="input-cover-voice"
                              />
                              <Button
                                size="sm"
                                className="gap-1.5 flex-shrink-0"
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
                                {isCovering ? "Creating..." : "Create Cover"}
                              </Button>
                            </div>
                          </Card>

                          <Card className="p-3 border-white/5">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                <Scissors className="w-4 h-4 text-orange-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">Audio Cutter</p>
                                <p className="text-[10px] text-muted-foreground">Trim audio to a specific time range</p>
                              </div>
                            </div>
                            <div className="flex gap-2 items-end flex-wrap">
                              <div className="flex-1 min-w-[80px]">
                                <label className="text-[10px] text-muted-foreground mb-1 block">Start (seconds)</label>
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
                              <div className="flex-1 min-w-[80px]">
                                <label className="text-[10px] text-muted-foreground mb-1 block">End (seconds)</label>
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
                                className="gap-1.5 flex-shrink-0"
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
                                {isTrimming ? "Trimming..." : "Trim Audio"}
                              </Button>
                            </div>
                          </Card>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                )}
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
