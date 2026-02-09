import { useState } from "react";
import { useSongs, useDeleteSong } from "@/hooks/use-songs";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Play,
  Clock,
  AlertCircle,
  Trash2,
  Scissors,
  Loader2,
  Library,
  Music,
} from "lucide-react";
import { motion } from "framer-motion";

export default function LibraryPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: songs, isLoading } = useSongs();
  const { mutate: deleteSong } = useDeleteSong();
  const [currentSong, setCurrentSong] = useState<any>(null);

  if (!user) return null;

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
          {currentSong && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AudioPlayer
                url={currentSong.audioUrl}
                title={currentSong.title || "Untitled Track"}
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
                    currentSong?.id === song.id
                      ? "border-primary/50 bg-primary/5"
                      : "hover-elevate"
                  )}
                  onClick={() => song.status === "completed" && setCurrentSong(song)}
                  data-testid={`card-library-song-${song.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      song.status === "completed" ? "bg-primary/10" : "bg-white/5"
                    )}>
                      {song.status === "completed" ? (
                        <Play className="h-4 w-4 text-primary fill-current" />
                      ) : song.status === "processing" ? (
                        <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">{song.title || song.prompt}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>
                          {song.createdAt && formatDistanceToNow(new Date(song.createdAt), { addSuffix: true })}
                        </span>
                        {song.genre && <span>{song.genre}</span>}
                        {song.status === "processing" && (
                          <span className="text-yellow-500 animate-pulse">Processing</span>
                        )}
                        {song.status === "failed" && (
                          <span className="text-destructive">Failed</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
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
        </div>
      </div>
    </div>
  );
}
