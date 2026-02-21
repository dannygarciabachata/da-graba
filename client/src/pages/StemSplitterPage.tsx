import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSongs } from "@/hooks/use-songs";
import { useSongTracks, useSeparateStems, useDeleteTrack } from "@/hooks/use-tracks";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play, Pause, Square, SkipBack, SkipForward, Loader2, Download,
  Music, Mic, Layers, FileAudio, Share2, Upload, RefreshCw, Check,
  ChevronDown, Volume2, Drum, Guitar, Headphones, Waves, Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import daGrabaLogo from "@assets/Logomobil2_1771526285843.png";

const STEM_COLORS: Record<string, string> = {
  vocals: "#FF6B9D",
  drums: "#FFB347",
  bass: "#4ECDC4",
  other: "#A78BFA",
  instrumental: "#ff751f",
  master: "#ff751f",
};

const STEM_ICONS: Record<string, typeof Mic> = {
  vocals: Mic,
  drums: Drum,
  bass: Guitar,
  other: Music,
  instrumental: Music,
  master: Headphones,
};

export default function StemSplitterPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: songs = [], isLoading: songsLoading } = useSongs();
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"splitter" | "workspace">("splitter");
  const { data: tracks = [], isLoading: tracksLoading } = useSongTracks(selectedSongId);
  const { mutate: separateStems, isPending: isSeparating } = useSeparateStems();
  const { mutate: deleteTrack, isPending: isDeleting } = useDeleteTrack();

  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const completedSongs = (songs || []).filter((s: any) => s.status === "completed" && s.audioUrl);
  const selectedSong = completedSongs.find((s: any) => s.id === selectedSongId);

  const stemTracks = tracks.filter((t: any) => t.type !== "master" && t.audioUrl);
  const hasStemResults = stemTracks.length > 0;
  const isProcessing = tracks.some((t: any) => t.status === "processing" || t.status === "pending");

  const handleSeparate = () => {
    if (!selectedSongId) {
      toast({ title: "Selecciona una canción", variant: "destructive" });
      return;
    }
    separateStems(selectedSongId);
  };

  const togglePlay = useCallback((trackId: number, audioUrl: string) => {
    if (playingTrackId === trackId) {
      audioRef.current?.pause();
      setPlayingTrackId(null);
      return;
    }
    window.dispatchEvent(new CustomEvent("dagraba:audio-exclusive", { detail: { source: "stem-splitter" } }));
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    const audio = new Audio(audioUrl);
    audio.onended = () => setPlayingTrackId(null);
    audio.play().catch(console.error);
    audioRef.current = audio;
    setPlayingTrackId(trackId);
  }, [playingTrackId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.source !== "stem-splitter") {
        audioRef.current?.pause();
        setPlayingTrackId(null);
      }
    };
    window.addEventListener("dagraba:audio-exclusive", handler);
    return () => {
      window.removeEventListener("dagraba:audio-exclusive", handler);
      audioRef.current?.pause();
    };
  }, []);

  const handleDownloadStem = (track: any) => {
    if (!track.audioUrl) return;
    const a = document.createElement("a");
    a.href = track.audioUrl;
    a.download = `${track.name || track.type}_stem.mp3`;
    a.click();
  };

  const handleDownloadAll = () => {
    stemTracks.forEach((track: any) => handleDownloadStem(track));
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0d" }}>
      <header className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-white/5">
        <div className="flex items-center gap-6">
          <img
            src={daGrabaLogo}
            alt="DA GRABA"
            className="h-14 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,117,31,0.3)]"
            data-testid="img-splitter-logo"
          />
          <nav className="hidden md:flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn("text-sm", activeTab === "splitter" ? "text-[#ff751f] font-semibold" : "text-white/60 hover:text-white")}
              onClick={() => setActiveTab("splitter")}
              data-testid="tab-splitter"
            >
              Stem Splitter
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("text-sm", activeTab === "workspace" ? "text-[#ff751f] font-semibold" : "text-white/60 hover:text-white")}
              onClick={() => setActiveTab("workspace")}
              data-testid="tab-workspace"
            >
              Cloud Workspace
            </Button>
          </nav>
        </div>
        <Badge variant="outline" className="border-[#ff751f]/30 text-[#ff751f] text-xs gap-1">
          <Layers className="h-3 w-3" />
          AI Stem Engine
        </Badge>
      </header>

      <div className="flex-1 p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
          <div className={cn("lg:col-span-3 space-y-6", activeTab === "workspace" && "hidden lg:block")}>
            <Card className="bg-white/[0.03] border-white/5 p-6" data-testid="card-splitter-main">
              <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#ff751f]" />
                Stem Splitter
              </h2>
              <p className="text-xs text-white/40 mb-5">Separa cualquier canción en pistas individuales usando IA</p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-white/70 mb-2 block">Seleccionar Canción</label>
                  <div className="relative">
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-[#ff751f]/50 transition-colors"
                      value={selectedSongId ?? ""}
                      onChange={(e) => setSelectedSongId(e.target.value ? Number(e.target.value) : null)}
                      data-testid="select-song"
                    >
                      <option value="" className="bg-[#1a1a1a]">Elige una canción para separar...</option>
                      {completedSongs.map((song: any) => (
                        <option key={song.id} value={song.id} className="bg-[#1a1a1a]">
                          {song.title || song.prompt || `Song #${song.id}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                  </div>
                </div>

                {selectedSong && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5"
                    data-testid="selected-song-preview"
                  >
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#ff751f]/20 to-purple-600/20 flex items-center justify-center flex-shrink-0">
                      {selectedSong.imageUrl ? (
                        <img src={selectedSong.imageUrl} alt="" className="w-full h-full rounded-lg object-cover" />
                      ) : (
                        <Music className="w-5 h-5 text-[#ff751f]/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{selectedSong.title || selectedSong.prompt}</p>
                      <p className="text-xs text-white/40">{selectedSong.genre || "Track"}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">
                      {selectedSong.genre || "Audio"}
                    </Badge>
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleSeparate}
                    disabled={!selectedSongId || isSeparating || isProcessing}
                    className="flex-1 bg-[#ff751f] hover:bg-[#ff751f]/80 text-white font-bold py-3 rounded-lg"
                    data-testid="button-separate"
                  >
                    {isSeparating || isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Separando...
                      </>
                    ) : (
                      <>
                        <Layers className="w-4 h-4 mr-2" />
                        SEPARAR STEMS
                      </>
                    )}
                  </Button>
                  {hasStemResults && (
                    <Button
                      variant="outline"
                      onClick={handleDownloadAll}
                      className="border-white/10 text-white/70 hover:text-white"
                      data-testid="button-download-all"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Descargar Todo
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            <AnimatePresence>
              {hasStemResults && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Card className="bg-white/[0.03] border-white/5 p-6" data-testid="card-stem-results">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Waves className="h-5 w-5 text-[#ff751f]" />
                      Stems Separados
                    </h3>
                    <div className="space-y-3">
                      {stemTracks.map((track: any) => {
                        const StemIcon = STEM_ICONS[track.type] || Music;
                        const stemColor = STEM_COLORS[track.type] || "#ff751f";
                        const isPlaying = playingTrackId === track.id;

                        return (
                          <div
                            key={track.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors group"
                            data-testid={`stem-track-${track.type}`}
                          >
                            <button
                              onClick={() => togglePlay(track.id, track.audioUrl!)}
                              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                              style={{ backgroundColor: `${stemColor}20` }}
                              data-testid={`button-play-${track.type}`}
                            >
                              {isPlaying ? (
                                <Pause className="w-4 h-4" style={{ color: stemColor }} />
                              ) : (
                                <Play className="w-4 h-4 ml-0.5" style={{ color: stemColor }} />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <StemIcon className="w-3.5 h-3.5" style={{ color: stemColor }} />
                                <span className="text-sm font-medium text-white capitalize">{track.name || track.type}</span>
                              </div>
                              <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    backgroundColor: stemColor,
                                    width: isPlaying ? "60%" : "100%",
                                    opacity: isPlaying ? 1 : 0.3,
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-white/40 hover:text-white"
                                onClick={() => handleDownloadStem(track)}
                                data-testid={`button-download-${track.type}`}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-white/40 hover:text-white"
                                data-testid={`button-share-${track.type}`}
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-white/40 hover:text-red-400"
                                onClick={() => {
                                  if (playingTrackId === track.id) {
                                    audioRef.current?.pause();
                                    setPlayingTrackId(null);
                                  }
                                  deleteTrack({ id: track.id, songId: track.songId });
                                }}
                                disabled={isDeleting}
                                data-testid={`button-delete-${track.type}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {isProcessing && (
              <Card className="bg-white/[0.03] border-white/5 p-6">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-[#ff751f]/20 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-[#ff751f] animate-spin" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Separando stems con IA...</p>
                    <p className="text-xs text-white/40 mt-0.5">Este proceso puede tomar unos minutos</p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          <div className={cn("lg:col-span-2", activeTab === "splitter" && "hidden lg:block")}>
            <Card className="bg-white/[0.03] border-white/5 p-5 h-full" data-testid="card-cloud-workspace">
              <h3 className="text-lg font-bold text-white mb-4">Cloud Workspace</h3>

              <ScrollArea className="h-[400px] lg:h-[500px]">
                <div className="space-y-2 pr-2">
                  {songsLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-5 h-5 animate-spin text-white/40" />
                    </div>
                  ) : completedSongs.length === 0 ? (
                    <div className="text-center py-10">
                      <Music className="w-10 h-10 text-white/10 mx-auto mb-3" />
                      <p className="text-sm text-white/30">No hay canciones aún</p>
                      <p className="text-xs text-white/20 mt-1">Genera una canción para empezar</p>
                    </div>
                  ) : (
                    completedSongs.map((song: any) => {
                      const isSelected = song.id === selectedSongId;
                      const songTracks = tracks.filter((t: any) => t.songId === song.id);
                      const hasStemsForSong = songTracks.some((t: any) => t.type !== "master" && t.audioUrl);

                      return (
                        <div
                          key={song.id}
                          onClick={() => setSelectedSongId(song.id)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border",
                            isSelected
                              ? "bg-[#ff751f]/5 border-[#ff751f]/20"
                              : "bg-white/[0.02] border-transparent hover:bg-white/[0.04] hover:border-white/5"
                          )}
                          data-testid={`workspace-song-${song.id}`}
                        >
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: isSelected ? "rgba(255,117,31,0.15)" : "rgba(255,255,255,0.05)" }}
                          >
                            {song.imageUrl ? (
                              <img src={song.imageUrl} alt="" className="w-full h-full rounded-lg object-cover" />
                            ) : (
                              <img src={daGrabaLogo} alt="" className="w-6 h-6 object-contain" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate font-medium">
                              {song.title || song.prompt || `Song #${song.id}`}
                            </p>
                            <p className="text-[10px] text-white/30 mt-0.5">
                              {song.genre || "Audio"} {hasStemsForSong && "• Stems ✓"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {hasStemsForSong ? (
                              <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px] px-1.5">
                                <Check className="w-3 h-3" />
                              </Badge>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-white/30 hover:text-[#ff751f]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSongId(song.id);
                                  separateStems(song.id);
                                }}
                                data-testid={`button-quick-separate-${song.id}`}
                              >
                                <Layers className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>
        </div>
      </div>

      <footer className="border-t border-white/5 px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[#ff751f] text-sm font-semibold">DA GRABA Engine V1</span>
          <span className="text-xs text-white/30">-</span>
          <span className="text-green-400 text-xs font-medium flex items-center gap-1">
            READY
            <RefreshCw className="w-3 h-3 text-[#ff751f]" />
          </span>
        </div>
        <p className="text-[10px] text-white/20">
          &copy; {new Date().getFullYear()} DA GRABA Systems. Powered by DGB Studio Cloud Engine
        </p>
      </footer>
    </div>
  );
}
