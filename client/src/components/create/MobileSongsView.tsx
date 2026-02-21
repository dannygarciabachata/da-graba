import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Music,
  Play,
  Zap,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { type PlayerSong } from "@/contexts/PlayerContext";
import { formatDuration } from "./constants";

interface MobileSongsViewProps {
  groupedSongs: { pairId: string | null; songs: any[] }[];
  allSongs: any[];
  isPending: boolean;
  playerState: { currentSong: any; isPlaying: boolean };
  onSongClick: (song: any) => void;
}

export function MobileSongsView({
  groupedSongs, allSongs, isPending, playerState, onSongClick,
}: MobileSongsViewProps) {
  const { t } = useTranslation();

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
        <span>Workspaces</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">Mi Workspace</span>
      </div>

      {isPending && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5 mb-4">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <div><p className="text-sm font-medium">{t('create.generating2Versions')}</p><p className="text-xs text-muted-foreground">{t('create.firstTimeTip')}</p></div>
        </div>
      )}

      {groupedSongs.length === 0 ? (
        <div className="text-center py-16">
          <Music className="h-12 w-12 text-primary/30 mx-auto mb-4" />
          <h3 className="text-base font-medium mb-1">{t('create.noSongsYet', 'No hay canciones aún')}</h3>
          <p className="text-sm text-muted-foreground">{t('create.noSongsDesc', 'Crea tu primera canción.')}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {groupedSongs.map((group) => {
            const isPair = group.songs.length > 1;
            return (
              <div key={group.pairId || group.songs[0]?.id}>
                {isPair && (
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary"><Zap className="h-2.5 w-2.5 mr-0.5" />{t('create.twoVersions')}</Badge>
                  </div>
                )}
                {group.songs.map((song: any) => (
                  <div key={song.id} className={cn("flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all", playerState.currentSong?.id === song.id ? "bg-primary/10 border border-primary/20" : "border border-transparent")} onClick={() => onSongClick(song)} data-testid={`mobile-song-${song.id}`}>
                    <div className="h-12 w-12 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                      {song.imageUrl ? <img src={song.imageUrl} alt="" className="h-12 w-12 object-cover rounded-md" /> : song.status === "completed" ? <Play className="h-4 w-4 text-primary fill-current" /> : <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                      {song.duration && song.status === "completed" && (
                        <span className="absolute bottom-0.5 right-0.5 px-1 py-0 rounded text-[9px] font-mono bg-black/70 text-white">
                          {formatDuration(song.duration)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">{song.title || song.prompt || t('create.untitledTrack')}</h4>
                      <p className="text-[10px] text-muted-foreground">{song.genre} {song.createdAt && `· ${formatDistanceToNow(new Date(song.createdAt), { addSuffix: true })}`}</p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          <div className="pt-3 mt-2 border-t border-white/5">
            <span className="text-xs text-muted-foreground">{allSongs.length} {allSongs.length === 1 ? "song" : "songs"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface MobilePlayerViewProps {
  activeSong: any;
  playerState: { currentSong: any; isPlaying: boolean };
  onBack: () => void;
}

export function MobilePlayerView({ activeSong, playerState, onBack }: MobilePlayerViewProps) {
  const { t } = useTranslation();

  return (
    <div className="p-4 sm:p-6">
      <button className="flex items-center gap-2 text-sm text-muted-foreground mb-4" onClick={onBack} data-testid="mobile-back-btn">
        <ChevronLeft className="h-4 w-4" />{t('create.tabSongs', 'Canciones')}
      </button>
      {activeSong && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15">
            <div className="h-16 w-16 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {activeSong.imageUrl ? <img src={activeSong.imageUrl} alt="" className="h-16 w-16 object-cover rounded-lg" /> : <Music className="h-6 w-6 text-primary/25" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold truncate">{activeSong.title || activeSong.prompt || t('create.untitledTrack')}</h3>
              <p className="text-xs text-muted-foreground truncate">{activeSong.artistName || activeSong.copyrightHolder || "DA GRABA Studio"}</p>
              {activeSong.genre && <Badge variant="secondary" className="text-[10px] mt-1">{activeSong.genre}</Badge>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
