import { useSongs, useDeleteSong } from "@/hooks/use-songs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Trash2, Clock, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface SongHistoryProps {
  currentSongId: number | null;
  onSelectSong: (song: any) => void;
}

export function SongHistory({ currentSongId, onSelectSong }: SongHistoryProps) {
  const { data: songs, isLoading } = useSongs();
  const { mutate: deleteSong } = useDeleteSong();

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  if (!songs?.length) {
    return (
      <div className="text-center p-8 text-muted-foreground text-sm">
        No tracks generated yet.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-3">
        {songs.map((song) => (
          <div 
            key={song.id}
            className={cn(
              "group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer",
              song.id === currentSongId 
                ? "bg-primary/10 border-primary/50 shadow-[0_0_15px_-5px_var(--primary)]" 
                : "bg-card border-white/5 hover:bg-white/5 hover:border-white/10"
            )}
            onClick={() => song.status === 'completed' && onSelectSong(song)}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-medium text-sm line-clamp-1 pr-8">{song.prompt}</h4>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-destructive absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSong(song.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">
                {song.createdAt && formatDistanceToNow(new Date(song.createdAt), { addSuffix: true })}
              </span>
              
              {song.status === 'completed' && (
                <div className="flex items-center text-primary gap-1">
                  <Play className="w-3 h-3 fill-current" />
                  Ready
                </div>
              )}
              
              {song.status === 'processing' && (
                <div className="flex items-center text-yellow-500 gap-1 animate-pulse">
                  <Clock className="w-3 h-3" />
                  Processing
                </div>
              )}
              
              {song.status === 'failed' && (
                <div className="flex items-center text-destructive gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Failed
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
