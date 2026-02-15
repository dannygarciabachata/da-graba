import { useState } from "react";
import { useSongs, useDeleteSong, useTogglePublish } from "@/hooks/use-songs";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Play,
  AlertCircle,
  Trash2,
  Scissors,
  Loader2,
  Library,
  Music,
  Download,
  Palette,
} from "lucide-react";
import { CoverArtDesigner } from "@/components/CoverArtDesigner";
import { NowPlayingBanner } from "@/components/NowPlayingBanner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";

export default function LibraryPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: songs, isLoading } = useSongs();
  const { mutate: deleteSong } = useDeleteSong();
  const { mutate: togglePublish } = useTogglePublish();
  const [currentSong, setCurrentSong] = useState<any>(null);
  const [designCoverFor, setDesignCoverFor] = useState<any>(null);

  if (!user) return null;

  const activeSong = currentSong
    ? songs?.find((s: any) => s.id === currentSong.id) || currentSong
    : null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 md:px-6 py-6 border-b border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <Library className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold" data-testid="text-library-title">Your Library</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-8">
            All your generated tracks in one place
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-4">
          {activeSong && !activeSong.audioUrl && (
            <motion.div
              key={activeSong.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AudioPlayer
                url={activeSong.audioUrl}
                title={activeSong.title || "Untitled Track"}
                imageUrl={activeSong.imageUrl}
                genre={activeSong.genre}
                duration={activeSong.duration}
                createdAt={activeSong.createdAt}
                isPublic={activeSong.isPublic}
                onTogglePublic={() => togglePublish(activeSong.id)}
                onOpenStudio={() => setLocation("/studio")}
              />
            </motion.div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !songs?.length ? (
            <div className="text-center py-16">
              <div className="p-4 bg-white/5 rounded-full inline-block mb-4">
                <Music className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">No tracks generated yet</p>
              <Button
                onClick={() => setLocation("/create")}
                data-testid="button-go-create"
              >
                Create your first track
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {songs.map((song: any) => (
                <Card
                  key={song.id}
                  className={cn(
                    "p-4 cursor-pointer transition-all duration-200 border-white/5",
                    activeSong?.id === song.id
                      ? "border-primary/50 bg-primary/5"
                      : "hover-elevate"
                  )}
                  onClick={() => song.status === "completed" && setCurrentSong(song)}
                  data-testid={`card-library-song-${song.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden",
                      song.status === "completed" ? "bg-primary/10" : "bg-white/5"
                    )}>
                      {song.imageUrl ? (
                        <img src={song.imageUrl} alt={song.title} className="w-10 h-10 object-cover" />
                      ) : song.status === "completed" ? (
                        <Play className="h-4 w-4 text-primary fill-current" />
                      ) : song.status === "processing" ? (
                        <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">
                        {song.variationLabel ? `${song.title || song.prompt} (${song.variationLabel})` : (song.title || song.prompt)}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>
                          {song.createdAt && formatDistanceToNow(new Date(song.createdAt), { addSuffix: true })}
                        </span>
                        {song.genre && <span>{song.genre}</span>}
                        {song.duration && <span>{Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, '0')}</span>}
                        {song.status === "processing" && (
                          <span className="text-yellow-500 animate-pulse">Processing</span>
                        )}
                        {song.status === "failed" && (
                          <span className="text-destructive">Failed</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {song.status === "completed" && song.audioUrl && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-green-400"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`button-download-lib-${song.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem
                              onClick={() => {
                                const a = document.createElement("a");
                                a.href = `/api/songs/${song.id}/download?format=mp3`;
                                a.download = `${(song.title || "track").replace(/\s+/g, "_")}.mp3`;
                                a.click();
                              }}
                              data-testid={`button-download-mp3-${song.id}`}
                            >
                              Download MP3
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const a = document.createElement("a");
                                a.href = `/api/songs/${song.id}/download?format=wav`;
                                a.download = `${(song.title || "track").replace(/\s+/g, "_")}.wav`;
                                a.click();
                              }}
                              data-testid={`button-download-wav-${song.id}`}
                            >
                              Download WAV
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {song.status === "completed" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-purple-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDesignCoverFor(designCoverFor?.id === song.id ? null : song);
                          }}
                          title="Design Cover Art"
                          data-testid={`button-cover-lib-${song.id}`}
                        >
                          <Palette className="h-4 w-4" />
                        </Button>
                      )}
                      {song.status === "completed" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation("/studio");
                          }}
                          data-testid={`button-studio-lib-${song.id}`}
                        >
                          <Scissors className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSong(song.id);
                        }}
                        data-testid={`button-delete-lib-${song.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
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
                existingImageUrl={designCoverFor.imageUrl || undefined}
                onClose={() => setDesignCoverFor(null)}
                onApplied={() => setDesignCoverFor(null)}
                onSave={(dataUrl) => {
                  const link = document.createElement("a");
                  link.download = `${(designCoverFor.title || "cover").replace(/\s+/g, "_")}-cover.png`;
                  link.href = dataUrl;
                  link.click();
                  setDesignCoverFor(null);
                }}
              />
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {activeSong && activeSong.audioUrl && (
          <NowPlayingBanner
            song={activeSong}
            onClose={() => setCurrentSong(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
