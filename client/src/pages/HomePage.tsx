import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCredits } from "@/hooks/use-credits";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import {
  Play,
  Pause,
  Music,
  TrendingUp,
  Sparkles,
  Mic2,
  Heart,
  Crown,
} from "lucide-react";
import { motion } from "framer-motion";

function HeroSection() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="text-center mb-10"
      data-testid="hero-banner"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h1
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 leading-tight"
          data-testid="text-hero-title"
        >
          {t("home.welcome", "Bienvenido a")}{" "}
          <span className="bg-gradient-to-r from-orange-400 to-orange-300 text-transparent bg-clip-text">
            DA GRABA
          </span>
        </h1>
        <p
          className="text-base sm:text-lg md:text-xl text-orange-300/80 mb-1"
          data-testid="text-hero-subtitle"
        >
          {t(
            "home.subtitle",
            "Crea música profesional con Inteligencia Artificial",
          )}
        </p>
        <p className="text-sm sm:text-base md:text-lg text-orange-300/60 mb-6">
          Create professional music with AI
        </p>
      </motion.div>

      <Button
        size="lg"
        className="bg-gradient-to-r from-orange-600 to-orange-500 text-white font-semibold rounded-xl px-6 sm:px-8 h-11 sm:h-12 text-base sm:text-lg shadow-lg shadow-orange-500/25"
        onClick={() => setLocation("/create")}
        data-testid="button-start-creating"
      >
        <Mic2 className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
        {user
          ? t("home.createNew", "Crear Nueva Pista")
          : t("home.startNow", "Comenzar Ahora")}
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

  const totalLikes =
    topSongs?.reduce((sum: number, s: any) => sum + (s.likes || 0), 0) || 0;

  return (
    <div
      className="grid grid-cols-3 gap-2 sm:gap-4 mb-8"
      data-testid="stats-cards"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-orange-500/20 rounded-xl p-3 sm:p-6 text-center"
        data-testid="stat-tracks"
      >
        <Music className="w-6 h-6 sm:w-8 sm:h-8 text-orange-400 mx-auto mb-1 sm:mb-2" />
        <div className="text-xl sm:text-3xl font-bold text-white mb-0.5 sm:mb-1">
          {userSongs?.length || 0}
        </div>
        <div className="text-[10px] sm:text-sm text-orange-300/60">
          {t("home.stat.tracks", "Pistas Creadas")}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-orange-500/20 rounded-xl p-3 sm:p-6 text-center"
        data-testid="stat-credits"
      >
        <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-orange-400 mx-auto mb-1 sm:mb-2" />
        <div className="text-xl sm:text-3xl font-bold text-white mb-0.5 sm:mb-1">
          {creditsData?.isUnlimited ? "∞" : (creditsData?.credits || 0)}
        </div>
        <div className="text-[10px] sm:text-sm text-orange-300/60">
          {t("home.stat.credits", "Créditos")}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-orange-500/20 rounded-xl p-3 sm:p-6 text-center"
        data-testid="stat-likes"
      >
        <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-orange-400 mx-auto mb-1 sm:mb-2" />
        <div className="text-xl sm:text-3xl font-bold text-white mb-0.5 sm:mb-1">
          {totalLikes}
        </div>
        <div className="text-[10px] sm:text-sm text-orange-300/60">
          {t("home.stat.likes", "Me Gusta")}
        </div>
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
      description: t(
        "home.card.createSub",
        "Genera canciones profesionales con solo texto",
      ),
      path: "/create",
      color: "from-orange-500 to-orange-600",
      testId: "card-create-music",
    },
    {
      icon: TrendingUp,
      title: t("home.card.explore", "Explorar"),
      description: t(
        "home.card.exploreSub",
        "Descubre música de la comunidad",
      ),
      path: "/discover",
      color: "from-indigo-500 to-indigo-600",
      testId: "card-explore",
    },
    {
      icon: Music,
      title: t("home.card.library", "Tu Biblioteca"),
      description: t(
        "home.card.librarySub",
        "Accede a todas tus creaciones",
      ),
      path: "/library",
      color: "from-purple-500 to-purple-600",
      testId: "card-library",
    },
    {
      icon: Crown,
      title: "Upgrade PRO",
      description: t(
        "home.card.proSub",
        "Desbloquea todas las funciones",
      ),
      path: "/pricing",
      color: "from-yellow-500 to-yellow-600",
      testId: "card-upgrade-pro",
    },
  ];

  return (
    <div className="mb-10" data-testid="action-cards">
      <h2
        className="text-lg sm:text-2xl font-bold text-white mb-4 sm:mb-6"
        data-testid="text-action-title"
      >
        {t("home.whatToDo", "¿Qué quieres hacer hoy?")} / What do you want to
        do today?
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
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
              <div className="bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-white/10 rounded-xl p-4 sm:p-6 transition-all duration-300 h-full">
                <div
                  className={`p-2.5 sm:p-3 rounded-xl bg-gradient-to-br ${feature.color} w-fit mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}
                >
                  <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <h3 className="text-white font-semibold mb-1 sm:mb-2 text-sm sm:text-lg">
                  {feature.title}
                </h3>
                <p className="text-orange-300/60 text-xs sm:text-sm">
                  {feature.description}
                </p>
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

  const handlePlayPause = useCallback(
    (track: any) => {
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
    },
    [playerState.currentSong?.id, togglePlayPause, globalPlay],
  );

  if (recentTracks.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="mb-10"
      data-testid="recent-tracks"
    >
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2
          className="text-lg sm:text-2xl font-bold text-white"
          data-testid="text-recent-title"
        >
          {t("home.recentCreations", "Tus Creaciones Recientes")} / Recent
          Creations
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-orange-400 text-xs sm:text-sm"
          onClick={() => setLocation("/library")}
          data-testid="button-view-all-recent"
        >
          {t("home.viewAll", "Ver Todas")} →
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {recentTracks.map((track: any, index: number) => {
          const isPlaying =
            playerState.currentSong?.id === track.id && playerState.isPlaying;

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
                    <Music className="w-8 h-8 sm:w-12 sm:h-12 text-white/30" />
                  </div>
                )}

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => handlePlayPause(track)}
                    disabled={!track.audioUrl}
                    className="p-3 sm:p-4 rounded-full bg-orange-500 transition-colors disabled:opacity-50 shadow-lg"
                    data-testid={`button-play-recent-${track.id}`}
                  >
                    {isPlaying ? (
                      <Pause
                        className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                        fill="white"
                      />
                    ) : (
                      <Play
                        className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                        fill="white"
                      />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3 sm:p-4">
                <h3
                  className="text-white font-semibold mb-0.5 sm:mb-1 truncate text-sm sm:text-base"
                  data-testid={`text-recent-title-${track.id}`}
                >
                  {track.title}
                </h3>
                <p className="text-orange-300/60 text-xs sm:text-sm truncate">
                  {track.genre}
                </p>
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
      description: t(
        "home.step1.desc",
        "Escribe en texto qué tipo de música quieres crear",
      ),
    },
    {
      step: 2,
      title: t("home.step2.title", "Genera con IA"),
      description: t(
        "home.step2.desc",
        "Nuestra IA crea música profesional en segundos",
      ),
    },
    {
      step: 3,
      title: t("home.step3.title", "Descarga y Usa"),
      description: t(
        "home.step3.desc",
        "Descarga tu música y úsala en tus proyectos",
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-8"
      data-testid="how-it-works"
    >
      <h2
        className="text-lg sm:text-2xl font-bold text-white mb-5 sm:mb-6 text-center"
        data-testid="text-how-title"
      >
        {t("home.howItWorks", "Cómo Funciona")} / How It Works
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
        {steps.map((s) => (
          <div key={s.step} className="text-center" data-testid={`step-${s.step}`}>
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white text-xl sm:text-2xl font-bold mx-auto mb-3 sm:mb-4">
              {s.step}
            </div>
            <h3 className="text-white font-semibold mb-1 sm:mb-2 text-sm sm:text-base">
              {s.title}
            </h3>
            <p className="text-orange-300/60 text-xs sm:text-sm">
              {s.description}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="h-full overflow-auto" data-testid="home-page">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <HeroSection />
        {user && <StatsCards />}
        <FeatureCards />
        {user && <RecentTracks />}
        <HowItWorks />
      </div>
    </div>
  );
}
