import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Music,
  Play,
  Pause,
  AlertCircle,
  Trash2,
  Zap,
  Share2,
  Download,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatDuration } from "./constants";

interface SongListPanelProps {
  groupedSongs: { pairId: string | null; songs: any[] }[];
  allSongs: any[];
  songsLoading: boolean;
  isPending: boolean;
  playerState: { currentSong: any; isPlaying: boolean };
  onSongClick: (song: any) => void;
  onDeleteSong: (id: number) => void;
  onViewAll: () => void;
}

export function SongListPanel({
  groupedSongs, allSongs, songsLoading, isPending,
  playerState, onSongClick, onDeleteSong, onViewAll,
}: SongListPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  return (
    <div className="relative" data-testid="song-list-panel">
      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-orange-600 rounded-2xl blur-xl opacity-20 pointer-events-none" />
      <div className="relative bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-h-[calc(100vh-180px)] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">{t('create.yourCreations', 'Tus Creaciones')}</h2>
          <span className="text-sm text-orange-300/60">{allSongs.length} {allSongs.length === 1 ? t('create.track', 'pista') : t('create.tracks', 'pistas')}</span>
        </div>

        {isPending && (
          <div className="mb-4">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-orange-500/30 bg-orange-600/10">
              <Loader2 className="h-5 w-5 text-orange-400 animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">{t('create.generating2Versions')}</p>
                <p className="text-[11px] text-orange-300/60">{t('create.firstTimeTip')}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
          {songsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
            </div>
          ) : groupedSongs.length === 0 ? (
            <div className="text-center py-12 text-orange-300/60">
              <Music className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{t('create.noSongsYet', 'No hay pistas todavía. ¡Crea tu primera!')}</p>
            </div>
          ) : (
            groupedSongs.map((group) => {
              const isPair = group.songs.length > 1;
              return (
                <div key={group.pairId || group.songs[0]?.id} data-testid={`group-${group.pairId || group.songs[0]?.id}`}>
                  {isPair && (
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                        <Zap className="h-2.5 w-2.5 inline mr-1" />{t('create.twoVersions')}
                      </span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {group.songs.map((song: any) => (
                      <div
                        key={song.id}
                        className={cn(
                          "group/song relative rounded-xl overflow-hidden transition-all cursor-pointer",
                          playerState.currentSong?.id === song.id
                            ? "bg-gradient-to-r from-orange-600/30 to-indigo-600/30 border border-orange-500/50"
                            : "bg-black/30 border border-white/10 hover:border-orange-500/30"
                        )}
                        onClick={() => onSongClick(song)}
                        data-testid={`card-recent-song-${song.id}`}
                      >
                        <div className="flex items-center gap-4 p-4">
                          <div className="relative flex-shrink-0">
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
                              {song.imageUrl ? (
                                <img src={song.imageUrl} alt={song.title} className="w-16 h-16 rounded-lg object-cover" />
                              ) : song.status === "processing" || song.status === "pending" ? (
                                <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />
                              ) : song.status === "completed" ? (
                                <Play className="h-5 w-5 text-white" />
                              ) : (
                                <AlertCircle className="h-5 w-5 text-destructive" />
                              )}
                            </div>
                            {song.status === "completed" && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover/song:opacity-100 transition-opacity rounded-lg">
                                {playerState.currentSong?.id === song.id && playerState.isPlaying ? (
                                  <Pause className="w-6 h-6 text-white" />
                                ) : (
                                  <Play className="w-6 h-6 text-white" />
                                )}
                              </div>
                            )}
                            {song.variationLabel && (
                              <span className="absolute top-0 left-0 h-5 w-5 rounded-br-lg rounded-tl-lg bg-orange-500 text-black text-[10px] font-bold flex items-center justify-center">{song.variationLabel}</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-medium truncate">
                              {song.variationLabel ? `${t('create.version')} ${song.variationLabel}` : (song.title || song.prompt || t('create.untitledTrack'))}
                            </h3>
                            <p className="text-sm text-orange-300/60 truncate">{song.prompt}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {song.genre && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                                  {song.genre}
                                </span>
                              )}
                              {song.duration && song.status === "completed" && (
                                <span className="text-xs text-orange-300/60">{formatDuration(song.duration)}</span>
                              )}
                              {(song.status === "processing" || song.status === "pending") ? (
                                <span className="text-xs text-orange-400 animate-pulse">{t('create.generating')}</span>
                              ) : (
                                <span className="text-xs text-orange-300/40">{song.createdAt && formatDistanceToNow(new Date(song.createdAt), { addSuffix: true })}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 opacity-0 group-hover/song:opacity-100 transition-opacity">
                            <button className="p-2 rounded-lg hover:bg-white/10 transition-colors" onClick={(e) => { e.stopPropagation(); const a = document.createElement("a"); a.href = song.audioUrl; a.download = `${song.title || "song"}.mp3`; a.click(); }} data-testid={`button-download-${song.id}`}>
                              <Download className="w-4 h-4 text-orange-300" />
                            </button>
                            <button className="p-2 rounded-lg hover:bg-white/10 transition-colors" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/discover?song=${song.id}`); toast({ title: t('create.linkCopied', 'Enlace copiado') }); }} data-testid={`button-share-${song.id}`}>
                              <Share2 className="w-4 h-4 text-orange-300" />
                            </button>
                            <button className="p-2 rounded-lg hover:bg-white/10 transition-colors" onClick={(e) => { e.stopPropagation(); onDeleteSong(song.id); }} data-testid={`button-delete-${song.id}`}>
                              <Trash2 className="w-4 h-4 text-orange-300" />
                            </button>
                          </div>
                        </div>

                        {playerState.currentSong?.id === song.id && playerState.isPlaying && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-indigo-500">
                            <motion.div className="h-full bg-white/50" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 3, repeat: Infinity }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {groupedSongs.length > 0 && (
          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-white/10">
            <span className="text-xs text-orange-300/60">{allSongs.length} {allSongs.length === 1 ? "song" : "songs"}</span>
            <button className="text-xs text-orange-300 hover:text-white transition-colors flex items-center gap-1" onClick={onViewAll} data-testid="button-view-all">
              {t('create.viewAll')}<ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
