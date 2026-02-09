import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSongs } from "@/hooks/use-songs";
import { useSongTracks, useSeparateStems, useUpdateTrack } from "@/hooks/use-tracks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LogOut, Disc, Play, Pause, Square, Volume2, VolumeX, Mic, Drum,
  Guitar, Music, Loader2, Scissors, ArrowLeft, ChevronRight, Download,
  Package, SkipBack
} from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
              <span className="text-[10px] text-destructive">Failed</span>
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
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { data: songs, isLoading: songsLoading } = useSongs();
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSongList, setShowSongList] = useState(true);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const { data: songTracks, isLoading: tracksLoading } = useSongTracks(selectedSongId);
  const { mutate: separateStems, isPending: isSeparating } = useSeparateStems();
  const { mutate: updateTrack } = useUpdateTrack();

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
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="h-14 md:h-16 border-b border-white/5 bg-black/50 backdrop-blur-md px-4 md:px-6 flex items-center justify-between gap-2 z-50 sticky top-0">
        <div className="flex items-center gap-2 md:gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/dashboard")}
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="bg-gradient-to-tr from-primary to-blue-600 p-1.5 md:p-2 rounded-lg">
            <Disc className="h-4 w-4 md:h-5 md:w-5 text-white animate-spin-slow" />
          </div>
          <span className="text-base md:text-lg font-bold tracking-tight">
            DGB Studio
            <span className="text-primary text-[10px] md:text-xs font-normal px-1.5 md:px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 ml-1.5">
              MULTITRACK
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
            <Avatar className="h-6 w-6">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs bg-primary text-black font-bold">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hidden md:block">{user.firstName} {user.lastName}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => logout()} className="text-muted-foreground" data-testid="button-logout-studio">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

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
