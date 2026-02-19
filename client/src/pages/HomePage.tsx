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
  Play,
  Pause,
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight,
  Music,
  TrendingUp,
  Headphones,
  Sparkles,
  ListPlus,
  ListMusic,
  ArrowRight,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { motion } from "framer-motion";

const GENRE_COLORS: Record<string, string> = {
  bachata: "from-orange-600 to-blue-800",
  bolero: "from-amber-700 to-red-900",
  dgb_bachata: "from-cyan-500 to-blue-800",
  dgb_bolero: "from-amber-500 to-rose-800",
  salsa: "from-red-500 to-orange-700",
  merengue: "from-green-600 to-emerald-800",
  reggaeton: "from-yellow-500 to-orange-700",
  pop: "from-green-500 to-teal-700",
  "r&b": "from-violet-600 to-indigo-800",
  jazz: "from-indigo-500 to-blue-900",
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

function HeroBanner() {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative overflow-hidden rounded-2xl"
      data-testid="hero-banner"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[#160a72] via-[#1a0e8a] to-orange-900/60" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-40" />

      <div className="relative px-6 sm:px-10 py-10 sm:py-14">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-1.5 w-8 bg-orange-500 rounded-full" />
            <span className="text-orange-400 text-sm font-medium tracking-wide uppercase">La Pura Sangre de la Bachata</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4" data-testid="text-hero-title">
            Crea Música Latina<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-300">con Inteligencia Artificial</span>
          </h1>
          <p className="text-white/70 text-base sm:text-lg mb-6 max-w-lg" data-testid="text-hero-subtitle">
            Bachata, Bolero, Salsa, Merengue y más. Genera pistas profesionales con nuestros instrumentos exclusivos DA GRABA.
          </p>
          <Button
            size="lg"
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl px-8 h-12 text-base shadow-lg shadow-orange-500/25"
            onClick={() => setLocation("/create")}
            data-testid="button-start-creating"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Empieza a Crear
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
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
    { genre: "top100", songCount: topSongs?.length || 0, totalPlays: topSongs?.reduce((s: number, x: any) => s + (x.playCount || 0), 0) || 0, totalLikes },
    ...(playlists || []),
  ];

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <div className="relative" data-testid="genre-carousel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2" data-testid="text-genre-section-title">
          <Headphones className="h-5 w-5 text-primary" />
          {t("discover.playlists", "Playlists por Género")}
        </h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scroll(-1)} data-testid="button-genre-left">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scroll(1)} data-testid="button-genre-right">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory">
        {allPlaylists.map((p) => {
          const isTop100 = p.genre === "top100";
          const label = isTop100 ? "Top 100" : p.genre === "Bachata" ? "DA GRABACHATA" : p.genre === "Bolero" ? "DA GRABOLERO" : p.genre;
          const gradient = isTop100 ? "from-primary to-blue-700" : getGenreColor(p.genre);
          return (
            <div
              key={p.genre}
              className="min-w-[200px] snap-start cursor-pointer group"
              onClick={() => setLocation(isTop100 ? "/discover/top100" : `/discover/${encodeURIComponent(p.genre)}`)}
              data-testid={`card-genre-${p.genre}`}
            >
              <div className={`relative h-[180px] rounded-xl bg-gradient-to-br ${gradient} overflow-hidden transition-transform group-hover:scale-[1.02]`}>
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  <h3 className="text-white font-bold text-lg leading-tight">{label}</h3>
                  <p className="text-white/70 text-sm mt-1">
                    {formatCount(p.totalLikes)} {t("discover.likes", "likes")}
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
      toast({ title: t("playlists.songAdded", "Canción agregada") });
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
          {t("playlists.addToPlaylist", "Agregar a playlist")}
        </p>
        {!playlists?.length ? (
          <p className="text-xs text-muted-foreground px-2 py-3 text-center">
            {t("playlists.noPlaylistsYet", "No tienes playlists aún")}
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

function TrendingSongCard({ song, rank, onPlay }: { song: any; rank: number; onPlay: (s: any) => void }) {
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
    <Card className="bg-[#0d0d18]/90 border-white/[0.06] hover:bg-[#12121f]/95 transition-colors group" data-testid={`card-trending-${song.id}`}>
      <div className="flex items-center gap-3 p-3">
        <span className="text-sm font-mono text-muted-foreground w-6 text-right" data-testid={`text-rank-${song.id}`}>
          {rank}
        </span>
        <div
          className="relative w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 cursor-pointer"
          onClick={() => onPlay(song)}
          data-testid={`button-play-trending-${song.id}`}
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
              <Play className="h-5 w-5 text-white fill-white" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-medium truncate ${isCurrent ? "text-primary" : ""}`} data-testid={`text-trending-title-${song.id}`}>{song.title}</h3>
          <p className="text-xs text-muted-foreground truncate" data-testid={`text-trending-artist-${song.id}`}>
            {song.artistName || "DA GRABA"}
          </p>
        </div>

        <Badge variant="outline" className="text-xs hidden sm:inline-flex">
          {song.genre || "Latin"}
        </Badge>

        <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-plays-trending-${song.id}`}>
          <Headphones className="h-3 w-3" />
          {formatCount(song.playCount || 0)}
        </div>

        <span className="text-xs text-muted-foreground w-12 text-right hidden sm:block">
          {formatDuration(song.duration)}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              if (!user) { toast({ title: t("discover.loginToLike", "Inicia sesión para dar like") }); return; }
              likeMutation.mutate();
            }}
            data-testid={`button-like-trending-${song.id}`}
          >
            <Heart className="h-4 w-4" />
          </Button>
          {user && <AddToPlaylistButton songId={song.id} />}
        </div>
      </div>
    </Card>
  );
}

export default function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
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
      artistName: s.artistName || "DA GRABA",
      duration: s.duration,
    }));
    const playerSong = queue.find(q => q.id === song.id) || queue[0];
    globalPlay(playerSong, queue);
  }, [playerState.currentSong?.id, togglePlayPause, topSongs, globalPlay]);

  if (!user) return null;

  const featured = topSongs?.slice(0, 15) || [];

  return (
    <div className="h-full overflow-auto" data-testid="home-page">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-8">
        <HeroBanner />

        <GenreCarousel />

        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold" data-testid="text-trending-section-title">
                {t("discover.trending", "Trending")}
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-orange-400 hover:text-orange-300"
              onClick={() => setLocation("/discover")}
              data-testid="button-see-all-trending"
            >
              Ver todo
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 bg-[#0d0d18]/80 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : featured.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground" data-testid="text-no-trending">
              <Music className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>{t("discover.noSongs", "No hay canciones todavía")}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setLocation("/create")}
                data-testid="button-create-first"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Crea la primera canción
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {featured.map((song: any, idx: number) => (
                <TrendingSongCard
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
            {t("discover.badges.royaltyFree", "Royalty Free")} &bull; {t("discover.badges.noCopyright", "Sin Copyright")}
          </Badge>
        </div>
      </div>
    </div>
  );
}
