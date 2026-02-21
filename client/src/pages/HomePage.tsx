import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useCredits } from "@/hooks/use-credits";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { AudioSpectrum } from "@/components/AudioSpectrum";
import {
  Play,
  Pause,
  Heart,
  ChevronLeft,
  ChevronRight,
  Music,
  TrendingUp,
  Headphones,
  Sparkles,
  ListPlus,
  ListMusic,
  ArrowRight,
  Library,
  Crown,
  Mic2,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { motion } from "framer-motion";

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

function getGenreColor(genre: string): string {
  const key = genre.toLowerCase().replace(/\s+/g, "-");
  return GENRE_COLORS[key] || "from-slate-600 to-slate-900";
}

function HeroSection() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="text-center mb-12"
      data-testid="hero-banner"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4" data-testid="text-hero-title">
          {t("home.welcome", "Bienvenido a")}{" "}
          <span className="bg-gradient-to-r from-orange-400 to-orange-300 text-transparent bg-clip-text">
            DA GRABA
          </span>
        </h1>
        <p className="text-xl text-orange-300/80 mb-2" data-testid="text-hero-subtitle">
          {t("home.subtitle", "Crea música profesional con Inteligencia Artificial")}
        </p>
        <p className="text-lg text-orange-300/60 mb-8">
          Create professional music with AI
        </p>
      </motion.div>

      <Button
        size="lg"
        className="bg-gradient-to-r from-orange-600 to-orange-500 text-white font-semibold rounded-xl px-8 h-12 text-lg shadow-lg shadow-orange-500/25"
        onClick={() => setLocation("/create")}
        data-testid="button-start-creating"
      >
        <Mic2 className="w-6 h-6 mr-2" />
        {user ? t("home.createNew", "Crear Nueva Pista") : t("home.startNow", "Comenzar Ahora")}
      </Button>
    </motion.div>
  );
}

function StatsCards() {
  const { t } = useTranslation();
  const { data: creditsData } = useCredits();

  const { data: userSongs } = useQuery<any[]>({
    queryKey: ["/api/songs"],
  });

  const { data: topSongs } = useQuery<any[]>({
    queryKey: ["/api/public/charts"],
  });

  const totalLikes = topSongs?.reduce((sum: number, s: any) => sum + (s.likes || 0), 0) || 0;

  return (
    <div className="grid grid-cols-3 gap-4 mb-8" data-testid="stats-cards">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-orange-500/20 rounded-xl p-6 text-center"
        data-testid="stat-tracks"
      >
        <Music className="w-8 h-8 text-orange-400 mx-auto mb-2" />
        <div className="text-3xl font-bold text-white mb-1">{userSongs?.length || 0}</div>
        <div className="text-sm text-orange-300/60">{t("home.stat.tracks", "Pistas Creadas")}</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-orange-500/20 rounded-xl p-6 text-center"
        data-testid="stat-credits"
      >
        <Sparkles className="w-8 h-8 text-orange-400 mx-auto mb-2" />
        <div className="text-3xl font-bold text-white mb-1">
          {creditsData?.isUnlimited ? "∞" : creditsData?.credits || 0}
        </div>
        <div className="text-sm text-orange-300/60">{t("home.stat.credits", "Créditos")}</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-orange-500/20 rounded-xl p-6 text-center"
        data-testid="stat-likes"
      >
        <TrendingUp className="w-8 h-8 text-orange-400 mx-auto mb-2" />
        <div className="text-3xl font-bold text-white mb-1">{formatCount(totalLikes)}</div>
        <div className="text-sm text-orange-300/60">{t("home.stat.likes", "Me Gusta")}</div>
      </motion.div>
    </div>
  );
}

function FeatureCards() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const features = [
    {
      icon: Mic2,
      title: t("home.card.create", "Crear Música IA"),
      description: t("home.card.createSub", "Genera canciones profesionales con solo texto"),
      path: "/create",
      color: "from-orange-500 to-orange-600",
      testId: "card-create-music",
    },
    {
      icon: TrendingUp,
      title: t("home.card.explore", "Explorar"),
      description: t("home.card.exploreSub", "Descubre música de la comunidad"),
      path: "/discover",
      color: "from-indigo-500 to-indigo-600",
      testId: "card-explore",
    },
    {
      icon: Library,
      title: t("home.card.library", "Tu Biblioteca"),
      description: t("home.card.librarySub", "Accede a todas tus creaciones"),
      path: "/library",
      color: "from-purple-500 to-purple-600",
      testId: "card-library",
    },
    {
      icon: Crown,
      title: "Upgrade PRO",
      description: t("home.card.proSub", "Desbloquea todas las funciones"),
      path: "/pricing",
      color: "from-yellow-500 to-yellow-600",
      testId: "card-upgrade-pro",
    },
  ];

  return (
    <div className="mb-12" data-testid="action-cards">
      <h2 className="text-2xl font-bold text-white mb-6" data-testid="text-action-title">
        {t("home.whatToDo", "¿Qué quieres hacer hoy?")} / What do you want to do today?
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature, index) => (
          <motion.div
            key={feature.testId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
          >
            <div
              className="cursor-pointer group"
              onClick={() => setLocation(feature.path)}
              data-testid={feature.testId}
            >
              <div className="bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-white/10 rounded-xl p-6 transition-all duration-300 h-full">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${feature.color} w-fit mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-semibold mb-2 text-lg">{feature.title}</h3>
                <p className="text-orange-300/60 text-sm">{feature.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function RecentTracks() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { state: playerState, play: globalPlay, togglePlayPause } = usePlayer();

  const { data: userSongs } = useQuery<any[]>({
    queryKey: ["/api/songs"],
  });

  const recentTracks = (userSongs || []).slice(0, 4);

  const handlePlayPause = useCallback((track: any) => {
    if (!track.audioUrl) return;
    if (playerState.currentSong?.id === track.id) {
      togglePlayPause();
      return;
    }
    const playerSong: PlayerSong = {
      id: track.id,
      title: track.title || "Untitled",
      audioUrl: track.audioUrl,
      imageUrl: track.imageUrl,
      genre: track.genre,
      artistName: track.artistName || "DA GRABA",
      duration: track.duration,
    };
    globalPlay(playerSong);
  }, [playerState.currentSong?.id, togglePlayPause, globalPlay]);

  if (recentTracks.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="mb-12"
      data-testid="recent-tracks"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white" data-testid="text-recent-title">
          {t("home.recentCreations", "Tus Creaciones Recientes")} / Recent Creations
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-orange-400"
          onClick={() => setLocation("/library")}
          data-testid="button-view-all-recent"
        >
          {t("home.viewAll", "Ver Todas")} →
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {recentTracks.map((track: any, index: number) => {
          const isPlaying = playerState.currentSong?.id === track.id && playerState.isPlaying;

          return (
            <motion.div
              key={track.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 * index }}
              className="group bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden transition-all duration-300"
              data-testid={`card-recent-${track.id}`}
            >
              <div className="relative aspect-square">
                {track.imageUrl ? (
                  <img
                    src={track.imageUrl}
                    alt={track.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-600/30 to-indigo-600/30 flex items-center justify-center">
                    <Music className="w-12 h-12 text-white/30" />
                  </div>
                )}

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => handlePlayPause(track)}
                    disabled={!track.audioUrl}
                    className="p-4 rounded-full bg-orange-500 transition-colors disabled:opacity-50 shadow-lg"
                    data-testid={`button-play-recent-${track.id}`}
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6 text-white" fill="white" />
                    ) : (
                      <Play className="w-6 h-6 text-white" fill="white" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-4">
                <h3 className="text-white font-semibold mb-1 truncate" data-testid={`text-recent-title-${track.id}`}>{track.title}</h3>
                <p className="text-orange-300/60 text-sm truncate">{track.genre}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function HowItWorks() {
  const { t } = useTranslation();

  const steps = [
    {
      step: 1,
      title: t("home.step1.title", "Describe tu Canción"),
      description: t("home.step1.desc", "Escribe en texto qué tipo de música quieres crear"),
    },
    {
      step: 2,
      title: t("home.step2.title", "Genera con IA"),
      description: t("home.step2.desc", "Nuestra IA crea música profesional en segundos"),
    },
    {
      step: 3,
      title: t("home.step3.title", "Descarga y Usa"),
      description: t("home.step3.desc", "Descarga tu música y úsala en tus proyectos"),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-white/10 rounded-2xl p-8"
      data-testid="how-it-works"
    >
      <h2 className="text-2xl font-bold text-white mb-6 text-center" data-testid="text-how-title">
        {t("home.howItWorks", "Cómo Funciona")} / How It Works
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((s) => (
          <div key={s.step} className="text-center" data-testid={`step-${s.step}`}>
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
              {s.step}
            </div>
            <h3 className="text-white font-semibold mb-2">{s.title}</h3>
            <p className="text-orange-300/60 text-sm">{s.description}</p>
          </div>
        ))}
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
    <div className="relative mb-12" data-testid="genre-carousel">
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
                <div className="absolute inset-0 bg-black/20 pointer-events-none" />
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <HeroSection />

        <StatsCards />

        <FeatureCards />

        <GenreCarousel />

        <RecentTracks />

        <div className="mb-12">
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
              className="text-orange-400"
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

        <HowItWorks />

        <div className="flex justify-center py-8">
          <Badge variant="outline" className="text-muted-foreground text-xs py-1 px-3">
            {t("discover.badges.royaltyFree", "Royalty Free")} &bull; {t("discover.badges.noCopyright", "Sin Copyright")}
          </Badge>
        </div>
      </div>
    </div>
  );
}
