import { useSongs } from "@/hooks/use-songs";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { Play, Pause, Download, Share2, MoreVertical, Music, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

export function TrackList() {
  const { data: songs, isLoading } = useSongs();
  const { state, play, pause } = usePlayer();

  const tracks = (songs ?? []).slice(0, 20);

  const handlePlay = (song: any) => {
    if (!song.audioUrl) return;
    const playerSong: PlayerSong = {
      id: song.id,
      title: song.title || song.prompt || "Untitled",
      audioUrl: song.audioUrl,
      imageUrl: song.imageUrl || undefined,
      genre: song.genre || "DA GRABA",
    };
    play(playerSong);
  };

  const handleDownload = (song: any) => {
    if (!song.audioUrl) return;
    const a = document.createElement("a");
    a.href = song.audioUrl;
    a.download = `${song.title || "track"}.mp3`;
    a.click();
  };

  const isTrackPlaying = (songId: number) => {
    return state.currentSong?.id === songId && state.isPlaying;
  };

  return (
    <div className="relative" data-testid="track-list">
      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-orange-600 rounded-2xl blur-xl opacity-20" />

      <div className="relative bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
          <h2 className="text-xl font-semibold text-white" data-testid="text-tracks-title">Tus Creaciones</h2>
          <span className="text-sm text-orange-300/60" data-testid="text-track-count">{tracks.length} pistas</span>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-orange-300/60">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Cargando...
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-12 text-orange-300/60" data-testid="text-no-tracks">
              <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No hay pistas todavía.</p>
              <p className="text-xs mt-1">Crea tu primera canción con el panel de la izquierda.</p>
            </div>
          ) : (
            tracks.map((track: any, index: number) => {
              const playing = isTrackPlaying(track.id);
              return (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.05, 0.5) }}
                  className={`group relative rounded-xl overflow-hidden transition-all ${
                    playing
                      ? "bg-gradient-to-r from-orange-600/30 to-indigo-600/30 border border-orange-500/50"
                      : "bg-black/30 border border-white/10 hover:border-orange-500/30"
                  }`}
                  data-testid={`track-item-${track.id}`}
                >
                  <div className="flex items-center gap-4 p-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-orange-600/20 to-indigo-600/20 flex items-center justify-center overflow-hidden">
                        {track.imageUrl ? (
                          <img src={track.imageUrl} alt={track.title} className="w-14 h-14 rounded-lg object-cover" />
                        ) : (
                          <Music className="w-6 h-6 text-orange-400/40" />
                        )}
                      </div>
                      {track.audioUrl && (
                        <button
                          onClick={() => playing ? pause() : handlePlay(track)}
                          className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                          data-testid={`button-play-${track.id}`}
                        >
                          {playing ? (
                            <Pause className="w-5 h-5 text-white" fill="white" />
                          ) : (
                            <Play className="w-5 h-5 text-white" fill="white" />
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate text-sm" data-testid={`track-title-${track.id}`}>
                        {track.title || track.prompt || "Untitled"}
                      </h3>
                      <p className="text-xs text-orange-300/60 truncate">
                        {track.prompt ? track.prompt.substring(0, 60) : ""}
                      </p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {track.genre && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                            {track.genre}
                          </span>
                        )}
                        {track.duration && (
                          <span className="text-[10px] text-orange-300/60">
                            {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, "0")}
                          </span>
                        )}
                        {track.status && track.status !== "completed" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                            {track.status}
                          </span>
                        )}
                        {track.createdAt && (
                          <span className="text-[10px] text-orange-300/40">
                            {formatDistanceToNow(new Date(track.createdAt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {track.audioUrl && (
                        <button
                          onClick={() => handleDownload(track)}
                          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                          data-testid={`button-download-${track.id}`}
                        >
                          <Download className="w-4 h-4 text-orange-300" />
                        </button>
                      )}
                      <button className="p-2 rounded-lg hover:bg-white/10 transition-colors" data-testid={`button-share-${track.id}`}>
                        <Share2 className="w-4 h-4 text-orange-300" />
                      </button>
                    </div>
                  </div>

                  {playing && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-indigo-500">
                      <motion.div
                        className="h-full bg-white/50"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 3, repeat: Infinity }}
                      />
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(249, 115, 22, 0.4);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(249, 115, 22, 0.6);
        }
      `}</style>
    </div>
  );
}
