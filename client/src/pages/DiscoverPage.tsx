import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { AudioSpectrum } from "@/components/AudioSpectrum";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Play,
  Pause,
  Heart,
  Share2,
  Download,
  ChevronLeft,
  ChevronRight,
  Music,
  TrendingUp,
  Headphones,
  Compass,
  ListPlus,
  ListMusic,
  Loader2,
} from "lucide-react";

const GENRE_COLORS: Record<string, string> = {
  bachata: "from-pink-600 to-blue-800",
  bolero: "from-amber-700 to-red-900",
  "dgb_bachata": "from-cyan-500 to-blue-800",
  "dgb_bolero": "from-amber-500 to-rose-800",
  "hip-hop": "from-orange-600 to-red-700",
  pop: "from-green-500 to-teal-700",
  "r&b": "from-violet-600 to-indigo-800",
  edm: "from-blue-500 to-blue-700",
  reggaeton: "from-yellow-500 to-orange-700",
  salsa: "from-red-500 to-pink-700",
  merengue: "from-green-600 to-emerald-800",
  jazz: "from-indigo-500 to-blue-900",
  rock: "from-gray-600 to-slate-900",
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getGenreColor(genre: string): string {
  const key = genre.toLowerCase().replace(/\s+/g, "-");
  return GENRE_COLORS[key] || "from-slate-600 to-slate-900";
}

function GenreCarousel() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: playlists } = useQuery<Array<{ genre: string; songCount: number; totalPlays: number; totalLikes: number }>>({
    queryKey: ["/api/public/playlists"],
  });

  const { data: topSongs } = useQuery<any[]>({
    queryKey: ["/api/public/charts"],
  });

  const totalLikes = topSongs?.reduce((sum: number, s: any) => sum + (s.likes || 0), 0) || 0;

  const allPlaylists = [
    { genre: "top100", songCount: topSongs?.length || 0, totalPlays: topSongs?.reduce((s: number, x: any) => s + (x.playCount || 0), 0) || 0, totalLikes: totalLikes },
    ...(playlists || []),
  ];

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <div className="relative" data-testid="genre-carousel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2" data-testid="text-playlist-section-title">
          <Headphones className="h-5 w-5 text-primary" />
          {t('discover.playlists')}
        </h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scroll(-1)} data-testid="button-carousel-left">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scroll(1)} data-testid="button-carousel-right">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory">
        {allPlaylists.map((p) => {
          const isTop100 = p.genre === "top100";
          const label = isTop100 ? "Top 100" : p.genre === "Bachata" ? "DAGRABACHATA" : p.genre === "Bolero" ? "DAGRABOLERO" : p.genre;
          const gradient = isTop100 ? "from-primary to-blue-700" : getGenreColor(p.genre);
          return (
            <div
              key={p.genre}
              className="min-w-[200px] snap-start cursor-pointer group"
              onClick={() => setLocation(isTop100 ? "/discover/top100" : `/discover/${encodeURIComponent(p.genre)}`)}
              data-testid={`card-playlist-${p.genre}`}
            >
              <div className={`relative h-[200px] rounded-xl bg-gradient-to-br ${gradient} overflow-hidden transition-transform group-hover:scale-[1.02]`}>
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  <h3 className="text-white font-bold text-lg leading-tight">{label}</h3>
                  <p className="text-white/70 text-sm mt-1">
                    {formatCount(p.totalLikes)} {t('discover.likes')}
                  </p>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-primary rounded-full p-2.5">
                    <Play className="h-4 w-4 text-white fill-white" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SongCardProps {
  song: any;
  rank?: number;
  onPlay: (song: any) => void;
}

function AddToPlaylistButton({ songId }: { songId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: playlists } = useQuery<any[]>({
    queryKey: ["/api/playlists"],
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: async (playlistId: number) => {
      await apiRequest("POST", `/api/playlists/${playlistId}/songs`, { songId });
    },
    onSuccess: () => {
      toast({ title: t("playlists.songAdded") });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => e.stopPropagation()}
          data-testid={`button-add-to-playlist-${songId}`}
        >
          <ListPlus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-2 bg-[#0d0d18] border-white/[0.06]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium text-muted-foreground px-2 py-1">
          {t("playlists.addToPlaylist")}
        </p>
        {!playlists?.length ? (
          <p className="text-xs text-muted-foreground px-2 py-3 text-center">
            {t("playlists.noPlaylistsYet")}
          </p>
        ) : (
          <div className="space-y-0.5 max-h-48 overflow-auto">
            {playlists.map((pl: any) => (
              <button
                key={pl.id}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-white/5 transition-colors text-left"
                onClick={() => addMutation.mutate(pl.id)}
                disabled={addMutation.isPending}
                data-testid={`button-select-playlist-${pl.id}`}
              >
                <ListMusic className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span className="truncate">{pl.name}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SongCard({ song, rank, onPlay }: SongCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { state: playerState } = usePlayer();
  const isCurrent = playerState.currentSong?.id === song.id;
  const isPlaying = isCurrent && playerState.isPlaying;

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/songs/${song.id}/like`, { value: 1 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/charts"] });
    },
  });

  return (
    <Card className="bg-[#0d0d18]/90 border-white/[0.06] hover:bg-[#12121f]/95 transition-colors group" data-testid={`card-song-${song.id}`}>
      <div className="flex items-center gap-3 p-3">
        {rank && (
          <span className="text-sm font-mono text-muted-foreground w-6 text-right" data-testid={`text-rank-${song.id}`}>
            {rank}
          </span>
        )}
        <div
          className="relative w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 cursor-pointer"
          onClick={() => onPlay(song)}
          data-testid={`button-play-${song.id}`}
        >
          {song.imageUrl ? (
            <img src={song.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <AudioSpectrum songId={song.id} barCount={5} />
          {!isPlaying && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {isCurrent ? (
                <Play className="h-5 w-5 text-white fill-white" />
              ) : (
                <Play className="h-5 w-5 text-white fill-white" />
              )}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-medium truncate ${isCurrent ? "text-primary" : ""}`} data-testid={`text-song-title-${song.id}`}>{song.title}</h3>
          <p className="text-xs text-muted-foreground truncate" data-testid={`text-song-artist-${song.id}`}>
            {song.artistName || "DGB AUDIO"}
          </p>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-plays-${song.id}`}>
          <Headphones className="h-3 w-3" />
          {formatCount(song.playCount || 0)}
        </div>

        <span className="text-xs text-muted-foreground w-12 text-right" data-testid={`text-duration-${song.id}`}>
          {formatDuration(song.duration)}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              if (!user) { toast({ title: t('discover.loginToLike') }); return; }
              likeMutation.mutate();
            }}
            data-testid={`button-like-${song.id}`}
          >
            <Heart className="h-4 w-4" />
          </Button>
          {user && <AddToPlaylistButton songId={song.id} />}
          {song.audioUrl && user && song.userId === (user as any).claims?.sub && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                const a = document.createElement("a");
                a.href = song.audioUrl;
                a.download = `${song.title}.mp3`;
                a.click();
              }}
              data-testid={`button-download-${song.id}`}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `-${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function DiscoverPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { state: playerState, play: globalPlay, togglePlayPause } = usePlayer();

  const { data: topSongs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/public/charts"],
  });

  const handlePlay = useCallback((song: any) => {
    if (!song.audioUrl) return;
    if (playerState.currentSong?.id === song.id) {
      togglePlayPause();
      return;
    }
    const allPlayable = (topSongs || []).filter((s: any) => s.audioUrl);
    const queue: PlayerSong[] = allPlayable.map((s: any) => ({
      id: s.id,
      title: s.title || "Untitled",
      audioUrl: s.audioUrl,
      imageUrl: s.imageUrl,
      genre: s.genre,
      artistName: s.artistName || "DGB AUDIO",
      duration: s.duration,
    }));
    const playerSong = queue.find(q => q.id === song.id) || queue[0];
    globalPlay(playerSong, queue);
  }, [playerState.currentSong?.id, togglePlayPause, topSongs, globalPlay]);

  const featured = topSongs?.slice(0, 20) || [];

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-8 bg-[#0a0a12]/80 rounded-xl my-2">
        <div className="flex items-center gap-3">
          <Compass className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-discover-title">{t('discover.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('discover.subtitle')}</p>
          </div>
        </div>

        <GenreCarousel />

        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold" data-testid="text-trending-title">{t('discover.trending')}</h2>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 bg-[#0d0d18]/80 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : featured.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Music className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>{t('discover.noSongs')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {featured.map((song: any, idx: number) => (
                <SongCard
                  key={song.id}
                  song={song}
                  rank={idx + 1}
                  onPlay={handlePlay}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-center pb-8">
          <Badge variant="outline" className="text-muted-foreground text-xs py-1 px-3">
            {t('discover.badges.royaltyFree')} &bull; {t('discover.badges.noCopyright')}
          </Badge>
        </div>
      </div>
    </div>
  );
}
