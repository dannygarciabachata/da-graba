import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSongs, useTogglePublish, useToggleSongLike } from "@/hooks/use-songs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  AlertCircle,
  Loader2,
  Library,
  Music,
  Shuffle,
  Heart,
  Share2,
  Globe,
  Lock,
  ChevronUp,
  ChevronDown,
  Clock,
  TrendingUp,
} from "lucide-react";
import { MashupDialog } from "@/components/MashupDialog";
import { CoverArtDesigner } from "@/components/CoverArtDesigner";
import { AudioSpectrum } from "@/components/AudioSpectrum";
import { SongActionMenu } from "@/components/SongActionMenu";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function LibraryPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: songs, isLoading } = useSongs();
  const { mutate: togglePublishMut } = useTogglePublish();
  const { mutate: toggleLike } = useToggleSongLike();
  const { state: playerState, play: globalPlay, togglePlayPause } = usePlayer();
  const [designCoverFor, setDesignCoverFor] = useState<any>(null);
  const [mashupOpen, setMashupOpen] = useState(false);
  const [mashupPreselect, setMashupPreselect] = useState<number | undefined>(undefined);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [playHistory, setPlayHistory] = useState<any[]>([]);

  if (!user) return null;

  const completedSongs = (songs || []).filter((s: any) => s.status === "completed" && s.audioUrl);

  const trendingSongs = [...completedSongs]
    .sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 10);

  const selectSong = (song: any) => {
    if (song.status !== "completed" || !song.audioUrl) return;
    setSelectedSong(song);
  };

  const playSong = (song: any) => {
    if (song.status !== "completed" || !song.audioUrl) return;

    setSelectedSong(song);
    setPlayHistory(prev => {
      const filtered = prev.filter((s: any) => s.id !== song.id);
      return [song, ...filtered].slice(0, 20);
    });

    if (playerState.currentSong?.id === song.id) {
      togglePlayPause();
      return;
    }
    const queue: PlayerSong[] = completedSongs.map((s: any) => ({
      id: s.id,
      title: s.variationLabel ? `${s.title || s.prompt} (${s.variationLabel})` : (s.title || s.prompt || "Untitled"),
      audioUrl: s.audioUrl,
      imageUrl: s.imageUrl,
      genre: s.genre,
      artistName: s.artistName || user?.firstName || "DA GRABA",
      prompt: s.prompt,
      variationLabel: s.variationLabel,
      lyricsText: s.lyricsText,
      copyrightHolder: s.copyrightHolder,
      isPublic: s.isPublic,
      duration: s.duration,
    }));
    const playerSong = queue.find(q => q.id === song.id) || queue[0];
    globalPlay(playerSong, queue);
  };

  const handleToggleCurrentPlayPause = () => {
    if (playerState.currentSong?.id === activeSong?.id) {
      togglePlayPause();
    } else if (activeSong) {
      playSong(activeSong);
    }
  };

  const handleShare = (song: any) => {
    const url = `${window.location.origin}/discover?song=${song.id}`;
    navigator.clipboard.writeText(url);
    toast({ title: t('common.copied', 'Enlace copiado'), description: url });
  };

  const activeSong = selectedSong || (playerState.currentSong ? completedSongs.find((s: any) => s.id === playerState.currentSong?.id) : null);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 md:px-6 py-4 border-b border-white/5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Library className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold" data-testid="text-library-title">{t('library.title')}</h1>
            <span className="text-xs text-muted-foreground">
              {completedSongs.length} {t('library.tracks', 'tracks')}
            </span>
          </div>
          {completedSongs.length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMashupOpen(true)}
              data-testid="button-open-mashup"
            >
              <Shuffle className="h-4 w-4 mr-2" />
              {t('mashup.title', 'Mashup')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">

        {/* ===== LEFT: Trending Carousel ===== */}
        <div className="hidden lg:flex flex-col w-[100px] flex-shrink-0 border-r border-white/5 bg-black/10" data-testid="library-trending-panel">
          <div className="flex items-center gap-1.5 px-3 py-3 border-b border-white/5">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Top</span>
          </div>
          <TrendingCarousel songs={trendingSongs} onPlay={playSong} currentId={playerState.currentSong?.id} />
        </div>

        {/* ===== CENTER: Song List ===== */}
        <div className="flex-1 overflow-auto min-w-0" data-testid="library-song-list">
          <div className="px-3 md:px-4 py-4 space-y-1.5">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !songs?.length ? (
              <div className="text-center py-16">
                <div className="p-4 bg-white/5 rounded-full inline-block mb-4">
                  <Music className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">{t('library.empty')}</p>
                <Button onClick={() => setLocation("/create")} data-testid="button-go-create">
                  {t('library.createFirst')}
                </Button>
              </div>
            ) : (
              songs.map((song: any) => {
                const isCurrent = playerState.currentSong?.id === song.id;
                const isPlaying = isCurrent && playerState.isPlaying;
                const isSelected = activeSong?.id === song.id;
                return (
                  <Card
                    key={song.id}
                    className={cn(
                      "p-3 cursor-pointer transition-all duration-200 border-white/5",
                      isSelected
                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                        : isCurrent
                          ? "border-primary/30 bg-primary/5"
                          : "hover-elevate"
                    )}
                    onClick={() => playSong(song)}
                    data-testid={`card-library-song-${song.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "relative w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden",
                        song.status === "completed" ? "bg-primary/10" : "bg-white/5"
                      )}>
                        {song.imageUrl ? (
                          <img src={song.imageUrl} alt={song.title} className="w-10 h-10 object-cover rounded-lg" />
                        ) : song.status === "completed" ? (
                          isPlaying ? null : <Play className="h-4 w-4 text-primary fill-current" />
                        ) : song.status === "processing" ? (
                          <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                        <AudioSpectrum songId={song.id} barCount={4} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">
                          {song.variationLabel ? `${song.title || song.prompt} (${song.variationLabel})` : (song.title || song.prompt)}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground mt-0.5">
                          {isCurrent && (
                            <span className="text-primary font-medium flex items-center gap-1">
                              {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                              {isPlaying ? t('library.nowPlaying') : t('library.paused', 'Paused')}
                            </span>
                          )}
                          {song.genre && <span>{song.genre === "Bachata" ? "DA GRABACHATA" : song.genre === "Bolero" ? "DA GRABOLERO" : song.genre}</span>}
                          {song.duration && <span>{Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, '0')}</span>}
                          {song.isPublic && <Globe className="h-3 w-3 text-primary" />}
                          {song.status === "processing" && (
                            <span className="text-yellow-500 animate-pulse">{t('common.processing')}</span>
                          )}
                          {song.status === "failed" && (
                            <span className="text-destructive">{t('common.failed')}</span>
                          )}
                        </div>
                      </div>

                      <SongActionMenu
                        song={song}
                        onDesignCover={() => setDesignCoverFor(designCoverFor?.id === song.id ? null : song)}
                        onOpenStudio={() => setLocation("/studio")}
                        onMashup={() => { setMashupPreselect(song.id); setMashupOpen(true); }}
                        compact
                      />
                    </div>
                  </Card>
                );
              })
            )}

            {designCoverFor && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <CoverArtDesigner
                  songTitle={designCoverFor.title || ""}
                  artistName={user?.firstName || ""}
                  songId={designCoverFor.id}
                  songGenre={designCoverFor.genre || ""}
                  existingImageUrl={designCoverFor.imageUrl || undefined}
                  onClose={() => setDesignCoverFor(null)}
                  onApplied={() => setDesignCoverFor(null)}
                />
              </motion.div>
            )}
          </div>
        </div>

        {/* ===== RIGHT: Now Playing Panel with Cover, Lyrics, Actions, History ===== */}
        <AnimatePresence>
          {activeSong && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="hidden md:flex flex-col flex-shrink-0 border-l border-white/5 bg-black/20 overflow-hidden"
              data-testid="library-now-playing-panel"
            >
              <NowPlayingPanel
                song={activeSong}
                isPlaying={playerState.currentSong?.id === activeSong.id && playerState.isPlaying}
                onTogglePlay={handleToggleCurrentPlayPause}
                onShare={() => handleShare(activeSong)}
                onToggleLike={() => toggleLike({ songId: activeSong.id, value: 1 })}
                onTogglePublish={() => togglePublishMut(activeSong.id)}
                playHistory={playHistory}
                onPlayFromHistory={playSong}
                currentPlayingId={playerState.currentSong?.id}
                currentTime={playerState.currentTime || 0}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <MashupDialog
        open={mashupOpen}
        onOpenChange={(open) => { setMashupOpen(open); if (!open) setMashupPreselect(undefined); }}
        preSelectedSongId={mashupPreselect}
      />
    </div>
  );
}

function TrendingCarousel({ songs, onPlay, currentId }: { songs: any[]; onPlay: (s: any) => void; currentId?: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 10);
    setCanScrollDown(el.scrollTop < el.scrollHeight - el.clientHeight - 10);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    el?.addEventListener("scroll", checkScroll);
    return () => el?.removeEventListener("scroll", checkScroll);
  }, [checkScroll, songs]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || songs.length < 3) return;
    let pos = 0;
    const interval = setInterval(() => {
      pos += 86;
      if (pos >= el.scrollHeight - el.clientHeight) pos = 0;
      el.scrollTo({ top: pos, behavior: "smooth" });
    }, 4000);
    return () => clearInterval(interval);
  }, [songs]);

  if (!songs.length) return (
    <div className="flex-1 flex items-center justify-center p-3">
      <span className="text-[10px] text-muted-foreground/50 text-center">Sin tendencias aún</span>
    </div>
  );

  return (
    <div className="flex-1 relative">
      {canScrollUp && (
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black/40 to-transparent z-10 flex items-center justify-center">
          <ChevronUp className="h-3 w-3 text-white/60" />
        </div>
      )}
      <div ref={scrollRef} className="h-full overflow-auto py-2 px-2 space-y-2" style={{ scrollbarWidth: "none" }}>
        {songs.map((song: any, i: number) => (
          <motion.div
            key={song.id}
            className={cn(
              "relative w-[76px] h-[76px] rounded-lg overflow-hidden cursor-pointer mx-auto group",
              currentId === song.id && "ring-2 ring-primary"
            )}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPlay(song)}
            data-testid={`trending-cover-${song.id}`}
          >
            {song.imageUrl ? (
              <img src={song.imageUrl} alt={song.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/30 to-indigo-900/60 flex items-center justify-center">
                <Music className="h-5 w-5 text-white/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
              <Play className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity fill-current" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
              <span className="text-[8px] text-white/90 font-medium truncate block leading-tight">
                {song.title || song.prompt?.substring(0, 15)}
              </span>
            </div>
            {i < 3 && (
              <div className="absolute top-1 left-1 bg-primary/90 text-[8px] font-bold text-white rounded px-1">
                #{i + 1}
              </div>
            )}
          </motion.div>
        ))}
      </div>
      {canScrollDown && (
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black/40 to-transparent z-10 flex items-center justify-center">
          <ChevronDown className="h-3 w-3 text-white/60" />
        </div>
      )}
    </div>
  );
}

function NowPlayingPanel({
  song,
  isPlaying,
  onTogglePlay,
  onShare,
  onToggleLike,
  onTogglePublish,
  playHistory,
  onPlayFromHistory,
  currentPlayingId,
  currentTime,
}: {
  song: any;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onShare: () => void;
  onToggleLike: () => void;
  onTogglePublish: () => void;
  playHistory: any[];
  onPlayFromHistory: (s: any) => void;
  currentPlayingId?: number;
  currentTime: number;
}) {
  const { t } = useTranslation();
  const lyricsRef = useRef<HTMLDivElement>(null);
  const songTitle = song.variationLabel
    ? `${song.title || song.prompt} (${song.variationLabel})`
    : (song.title || song.prompt || "Untitled");

  const { lines: parsedLyrics, hasTimestamps } = parseLyricsWithTimestamps(song.lyricsText);
  const currentLineIdx = hasTimestamps ? getCurrentLyricLine(parsedLyrics, currentTime) : -1;

  useEffect(() => {
    if (lyricsRef.current && currentLineIdx >= 0 && hasTimestamps) {
      const lineEl = lyricsRef.current.children[currentLineIdx] as HTMLElement;
      lineEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentLineIdx, hasTimestamps]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Cover Art */}
      <div className="p-4 flex-shrink-0">
        <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-2xl shadow-primary/10" data-testid="now-playing-cover">
          {song.imageUrl ? (
            <img src={song.imageUrl} alt={songTitle} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 via-indigo-900/40 to-black flex items-center justify-center">
              <Music className="h-16 w-16 text-white/20" />
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
            <h3 className="text-sm font-bold text-white truncate">{songTitle}</h3>
            <p className="text-xs text-white/60">{song.artistName || song.genre || "DA GRABA"}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-2 px-4 pb-3 flex-shrink-0" data-testid="now-playing-actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
          className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20"
          data-testid="button-toggle-play"
        >
          {isPlaying ? <Pause className="h-4 w-4 text-primary" /> : <Play className="h-4 w-4 text-primary fill-current" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onToggleLike(); }}
          className={cn("h-9 w-9 rounded-full", (song.userLikeValue === 1) ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-white/5")}
          data-testid={`button-like-panel-${song.id}`}
        >
          <Heart className={cn("h-4 w-4", (song.userLikeValue === 1) && "fill-current")} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onShare(); }}
          className="h-9 w-9 rounded-full text-muted-foreground hover:bg-white/5"
          data-testid={`button-share-panel-${song.id}`}
        >
          <Share2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onTogglePublish(); }}
          className={cn("h-9 w-9 rounded-full", song.isPublic ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-white/5")}
          data-testid={`button-publish-panel-${song.id}`}
        >
          {song.isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        </Button>
      </div>

      {/* Synced Lyrics */}
      {song.lyricsText && (
        <div className="flex-shrink-0 max-h-[200px] overflow-hidden">
          <div className="px-4 pb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold">{t('library.lyrics', 'Letra')}</span>
          </div>
          <div
            ref={lyricsRef}
            className="px-4 pb-3 overflow-y-auto max-h-[170px] space-y-1"
            style={{ scrollbarWidth: "thin" }}
            data-testid="now-playing-lyrics"
          >
            {parsedLyrics.map((line, i) => (
              <p
                key={i}
                className={cn(
                  "text-[12px] leading-relaxed transition-all duration-300",
                  hasTimestamps
                    ? i === currentLineIdx
                      ? "text-primary font-semibold scale-[1.02] origin-left"
                      : i < currentLineIdx
                        ? "text-muted-foreground/40"
                        : "text-muted-foreground/70"
                    : "text-muted-foreground/70"
                )}
              >
                {line.text}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Play History */}
      <div className="flex-1 overflow-hidden flex flex-col border-t border-white/5 mt-1">
        <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold">{t('library.history', 'Historial')}</span>
        </div>
        <div className="flex-1 overflow-auto px-3 pb-3 space-y-1" style={{ scrollbarWidth: "thin" }} data-testid="play-history-list">
          {playHistory.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/40 text-center py-4">{t('library.noHistory', 'Reproduce una canción')}</p>
          ) : (
            playHistory.map((s: any) => {
              const isCurr = currentPlayingId === s.id;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all",
                    isCurr ? "bg-primary/10" : "hover:bg-white/5"
                  )}
                  onClick={() => onPlayFromHistory(s)}
                  data-testid={`history-song-${s.id}`}
                >
                  <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                    {s.imageUrl ? (
                      <img src={s.imageUrl} alt="" className="w-8 h-8 object-cover" />
                    ) : (
                      <div className="w-8 h-8 bg-white/5 flex items-center justify-center">
                        <Music className="h-3 w-3 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-[11px] truncate", isCurr ? "text-primary font-medium" : "text-foreground/80")}>
                      {s.variationLabel ? `${s.title || s.prompt} (${s.variationLabel})` : (s.title || s.prompt)}
                    </p>
                    <p className="text-[9px] text-muted-foreground/40">{s.genre || "DA GRABA"}</p>
                  </div>
                  {isCurr && <AudioSpectrum songId={s.id} barCount={3} />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

interface LyricLine {
  time: number;
  text: string;
}

function parseLyricsWithTimestamps(lyricsText?: string | null): { lines: LyricLine[]; hasTimestamps: boolean } {
  if (!lyricsText) return { lines: [], hasTimestamps: false };

  const rawLines = lyricsText.split("\n").filter(l => l.trim());
  const parsed: LyricLine[] = [];
  const timestampRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/;
  let hasTimestamps = false;

  for (const line of rawLines) {
    const match = line.match(timestampRegex);
    if (match) {
      hasTimestamps = true;
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0;
      const time = minutes * 60 + seconds + ms / 1000;
      const text = line.replace(timestampRegex, "").trim();
      if (text) parsed.push({ time, text });
    } else {
      const text = line.replace(/^\[.*?\]\s*/, "").trim();
      if (text && !text.match(/^\[(verse|chorus|bridge|intro|outro)/i)) {
        parsed.push({ time: -1, text });
      }
    }
  }

  return { lines: parsed, hasTimestamps };
}

function getCurrentLyricLine(lyrics: LyricLine[], currentTime: number): number {
  if (!lyrics.length || currentTime <= 0) return -1;

  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentTime >= lyrics[i].time) return i;
  }
  return -1;
}
