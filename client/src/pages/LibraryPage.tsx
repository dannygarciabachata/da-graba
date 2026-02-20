import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSongs, useTogglePublish, useToggleSongLike } from "@/hooks/use-songs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  ListPlus,
  Plus,
  Check,
  ListMusic,
  X,
  Eye,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MashupDialog } from "@/components/MashupDialog";
import { CoverArtDesigner } from "@/components/CoverArtDesigner";
import { SongActionMenu } from "@/components/SongActionMenu";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
    .map((s: any) => {
      const likes = s.likes || 0;
      const plays = s.playCount || 0;
      const shared = s.isPublic ? 1 : 0;
      const ageHours = s.createdAt ? Math.max(1, (Date.now() - new Date(s.createdAt).getTime()) / 3600000) : 1;
      const trendScore = (likes * 5) + (plays * 2) + (shared * 3);
      const decayFactor = Math.pow(0.95, ageHours / 24);
      return { ...s, _trendScore: trendScore * decayFactor };
    })
    .sort((a: any, b: any) => b._trendScore - a._trendScore)
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
        <div className="hidden lg:flex flex-col w-[140px] flex-shrink-0 border-r border-white/5 bg-black/10" data-testid="library-trending-panel">
          <div className="flex items-center gap-1.5 px-3 py-3 border-b border-white/5">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Top</span>
          </div>
          <TrendingCarousel songs={trendingSongs} onPlay={playSong} currentId={playerState.currentSong?.id} />
        </div>

        {/* ===== CENTER: Song List ===== */}
        <div className="flex-1 overflow-auto min-w-0" data-testid="library-song-list">
          <div className="px-3 md:px-4 py-2 space-y-1">
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
                      "p-2 cursor-pointer transition-all duration-200 border-white/5",
                      isSelected
                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                        : isCurrent
                          ? "border-primary/30 bg-primary/5"
                          : "hover-elevate"
                    )}
                    onClick={() => playSong(song)}
                    data-testid={`card-library-song-${song.id}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "relative w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden",
                        song.status === "completed" ? "bg-primary/10" : "bg-white/5"
                      )}>
                        {song.imageUrl ? (
                          <img src={song.imageUrl} alt={song.title} className="w-8 h-8 object-cover rounded-md" />
                        ) : song.status === "completed" ? (
                          isPlaying ? null : <Play className="h-3.5 w-3.5 text-primary fill-current" />
                        ) : song.status === "processing" ? (
                          <Loader2 className="h-3.5 w-3.5 text-yellow-500 animate-spin" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                        )}

                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-[13px] font-medium truncate leading-tight">
                          {song.variationLabel ? `${song.title || song.prompt} (${song.variationLabel})` : (song.title || song.prompt)}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground mt-0.5">
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
                onRemoveFromHistory={(id: number) => setPlayHistory(prev => prev.filter((s: any) => s.id !== id))}
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

  const scrollBy = (dir: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ top: dir * 130, behavior: "smooth" });
  };

  if (!songs.length) return (
    <div className="flex-1 flex items-center justify-center p-3">
      <span className="text-[10px] text-muted-foreground/50 text-center">Sin tendencias aún</span>
    </div>
  );

  return (
    <div className="flex-1 relative">
      {canScrollUp && (
        <button
          onClick={() => scrollBy(-1)}
          className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/60 to-transparent z-10 flex items-center justify-center cursor-pointer hover:from-black/80 transition-all"
          data-testid="trending-scroll-up"
        >
          <ChevronUp className="h-4 w-4 text-white/80" />
        </button>
      )}
      <div ref={scrollRef} className="h-full overflow-auto py-2 px-3 space-y-2.5 trending-scroll" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,117,31,0.4) transparent" }}>
        {songs.map((song: any, i: number) => (
          <motion.div
            key={song.id}
            className={cn(
              "relative w-[116px] h-[116px] rounded-lg overflow-hidden cursor-pointer mx-auto group",
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
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-1.5">
              <span className="text-[10px] text-white font-semibold truncate block leading-tight drop-shadow-lg">
                {song.title || song.prompt?.substring(0, 20)}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {(song.likes > 0 || song.playCount > 0) && (
                  <>
                    {song.likes > 0 && <span className="text-[8px] text-white/70 flex items-center gap-0.5"><Heart className="h-2 w-2" />{song.likes}</span>}
                    {song.playCount > 0 && <span className="text-[8px] text-white/70 flex items-center gap-0.5"><Eye className="h-2 w-2" />{song.playCount}</span>}
                  </>
                )}
              </div>
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
        <button
          onClick={() => scrollBy(1)}
          className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/60 to-transparent z-10 flex items-center justify-center cursor-pointer hover:from-black/80 transition-all"
          data-testid="trending-scroll-down"
        >
          <ChevronDown className="h-4 w-4 text-white/80" />
        </button>
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
  onRemoveFromHistory,
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
  onRemoveFromHistory: (songId: number) => void;
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
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 z-10">
            <Eye className="h-3.5 w-3.5 text-white/90" />
            <span className="text-xs font-semibold text-white">{(song.playCount ?? 0).toLocaleString()}</span>
          </div>
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
        <AddToPlaylistButton songId={song.id} />
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
                    "flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all group",
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
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveFromHistory(s.id); }}
                    className="flex-shrink-0 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all text-muted-foreground/40 hover:text-destructive"
                    data-testid={`button-remove-history-${s.id}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
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

function AddToPlaylistButton({ songId }: { songId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: playlists = [] } = useQuery<any[]>({
    queryKey: ["/api/playlists"],
    enabled: open,
  });

  const { data: allPlaylistSongs = {} } = useQuery<Record<number, number[]>>({
    queryKey: ["/api/playlists", "song-membership", songId],
    enabled: open && playlists.length > 0,
    queryFn: async () => {
      const map: Record<number, number[]> = {};
      for (const pl of playlists) {
        const res = await fetch(`/api/playlists/${pl.id}/songs`, { credentials: "include" });
        if (res.ok) {
          const songs = await res.json();
          map[pl.id] = songs.map((s: any) => s.songId ?? s.id);
        }
      }
      return map;
    },
  });

  const addMut = useMutation({
    mutationFn: async ({ playlistId }: { playlistId: number }) => {
      await apiRequest("POST", `/api/playlists/${playlistId}/songs`, { songId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      toast({ title: t('playlist.added', 'Agregado a playlist') });
    },
  });

  const removeMut = useMutation({
    mutationFn: async ({ playlistId }: { playlistId: number }) => {
      await apiRequest("DELETE", `/api/playlists/${playlistId}/songs/${songId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      toast({ title: t('playlist.removed', 'Removido de playlist') });
    },
  });

  const createMut = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/playlists", { name });
      return res.json();
    },
    onSuccess: async (pl: any) => {
      await apiRequest("POST", `/api/playlists/${pl.id}/songs`, { songId });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setNewName("");
      setShowCreate(false);
      toast({ title: t('playlist.createdAndAdded', 'Playlist creada y canción agregada') });
    },
  });

  const isSongIn = (plId: number) => (allPlaylistSongs[plId] || []).includes(songId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 rounded-full text-muted-foreground hover:bg-white/5"
          data-testid={`button-add-playlist-${songId}`}
          onClick={(e) => e.stopPropagation()}
        >
          <ListPlus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-0 bg-black/95 border-white/10"
        side="top"
        align="center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t('playlist.addTo', 'Agregar a Playlist')}
          </span>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="text-primary hover:text-primary/80 transition-colors"
            data-testid="button-new-playlist"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {showCreate && (
          <div className="px-3 py-2 border-b border-white/5 flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('playlist.newName', 'Nombre...')}
              className="h-7 text-xs bg-white/5 border-white/10"
              data-testid="input-new-playlist-name"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) createMut.mutate(newName.trim());
              }}
            />
            <Button
              size="sm"
              className="h-7 px-2"
              disabled={!newName.trim() || createMut.isPending}
              onClick={() => createMut.mutate(newName.trim())}
              data-testid="button-create-playlist-confirm"
            >
              {createMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </Button>
          </div>
        )}

        <div className="max-h-[200px] overflow-auto py-1" style={{ scrollbarWidth: "thin" }}>
          {playlists.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <ListMusic className="h-5 w-5 text-muted-foreground/30 mx-auto mb-1" />
              <p className="text-[11px] text-muted-foreground/50">{t('playlist.noPlaylists', 'Sin playlists aún')}</p>
            </div>
          ) : (
            playlists.map((pl: any) => {
              const inPlaylist = isSongIn(pl.id);
              return (
                <button
                  key={pl.id}
                  className={cn(
                    "w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-white/5 transition-colors text-xs",
                    inPlaylist && "text-primary"
                  )}
                  onClick={() => {
                    if (inPlaylist) {
                      removeMut.mutate({ playlistId: pl.id });
                    } else {
                      addMut.mutate({ playlistId: pl.id });
                    }
                  }}
                  data-testid={`playlist-option-${pl.id}`}
                >
                  {inPlaylist ? (
                    <Check className="h-3.5 w-3.5 flex-shrink-0" />
                  ) : (
                    <ListMusic className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
                  )}
                  <span className="truncate">{pl.name}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
