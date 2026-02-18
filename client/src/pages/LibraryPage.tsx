import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSongs, useTogglePublish } from "@/hooks/use-songs";
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
} from "lucide-react";
import { MashupDialog } from "@/components/MashupDialog";
import { CoverArtDesigner } from "@/components/CoverArtDesigner";
import { AudioSpectrum } from "@/components/AudioSpectrum";
import { SongActionMenu } from "@/components/SongActionMenu";
import { motion } from "framer-motion";

export default function LibraryPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: songs, isLoading } = useSongs();
  const togglePublish = useTogglePublish();
  const { state: playerState, play: globalPlay, togglePlayPause } = usePlayer();
  const [designCoverFor, setDesignCoverFor] = useState<any>(null);
  const [mashupOpen, setMashupOpen] = useState(false);
  const [mashupPreselect, setMashupPreselect] = useState<number | undefined>(undefined);

  if (!user) return null;

  const completedSongs = (songs || []).filter((s: any) => s.status === "completed" && s.audioUrl);

  const handlePlay = (song: any) => {
    if (song.status !== "completed" || !song.audioUrl) return;
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
      artistName: s.artistName || user?.firstName || "DAGRABA",
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

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 md:px-6 py-6 border-b border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-3">
              <Library className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold" data-testid="text-library-title">{t('library.title')}</h1>
            </div>
            {completedSongs.length >= 2 && (
              <Button
                variant="outline"
                onClick={() => setMashupOpen(true)}
                data-testid="button-open-mashup"
              >
                <Shuffle className="h-4 w-4 mr-2" />
                {t('mashup.title', 'Mashup')}
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground pl-8">
            {t('library.subtitle')}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-4">
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
              <Button
                onClick={() => setLocation("/create")}
                data-testid="button-go-create"
              >
                {t('library.createFirst')}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {songs.map((song: any) => {
                const isCurrent = playerState.currentSong?.id === song.id;
                const isPlaying = isCurrent && playerState.isPlaying;
                return (
                  <Card
                    key={song.id}
                    className={cn(
                      "p-4 cursor-pointer transition-all duration-200 border-white/5",
                      isCurrent
                        ? "border-primary/50 bg-primary/5"
                        : "hover-elevate"
                    )}
                    onClick={() => handlePlay(song)}
                    data-testid={`card-library-song-${song.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "relative w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden",
                        song.status === "completed" ? "bg-primary/10" : "bg-white/5"
                      )}>
                        {song.imageUrl ? (
                          <img src={song.imageUrl} alt={song.title} className="w-10 h-10 object-cover" />
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
                        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground mt-0.5">
                          {isCurrent && (
                            <span className="text-primary font-medium flex items-center gap-1">
                              {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                              {isPlaying ? t('library.nowPlaying') : t('library.paused') || "Paused"}
                            </span>
                          )}
                          <span>
                            {song.createdAt && formatDistanceToNow(new Date(song.createdAt), { addSuffix: true })}
                          </span>
                          {song.genre && <span>{song.genre === "Bachata" ? "DAGRABACHATA" : song.genre === "Bolero" ? "DAGRABOLERO" : song.genre}</span>}
                          {song.duration && <span>{Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, '0')}</span>}
                          {song.isPublic && (
                            <span className="text-primary text-[10px] font-medium">{t('songMenu.public')}</span>
                          )}
                          {song.status === "processing" && (
                            <span className="text-yellow-500 animate-pulse">{t('common.processing')}</span>
                          )}
                          {song.status === "failed" && (
                            <span className="text-destructive" title={song.error || ""}>
                              {t('common.failed')}{song.error ? ` — ${song.error.substring(0, 60)}` : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      <SongActionMenu
                        song={song}
                        onDesignCover={() => setDesignCoverFor(designCoverFor?.id === song.id ? null : song)}
                        onOpenStudio={() => setLocation("/studio")}
                        onMashup={() => {
                          setMashupPreselect(song.id);
                          setMashupOpen(true);
                        }}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {designCoverFor && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
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

      <MashupDialog
        open={mashupOpen}
        onOpenChange={(open) => {
          setMashupOpen(open);
          if (!open) setMashupPreselect(undefined);
        }}
        preSelectedSongId={mashupPreselect}
      />
    </div>
  );
}
