import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import daIcon from "@assets/Icon_1771525459723.png";

import palettaBg from "@assets/palettabg_1771282011333.png";
import {
  Play, Pause, Mic2, Wand2, Music, Headphones, Sparkles, Scissors, Zap,
  Crown, Shield, Globe, Layers, ArrowRight, CheckCircle2, Star,
  Radio, Volume2, SlidersHorizontal, Palette, Upload, BookOpen, Clock, Heart,
  Church, Cake, Baby, Film, Megaphone, Youtube, Smartphone, Store,
  ChevronLeft, ChevronRight, Menu, X, MessageCircle, HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { usePublicSongs } from "@/hooks/use-songs";

const FEATURES_KEYS = ["aiMusic", "multitrack", "lyrics", "mastering", "sampleLab", "producerStore"];
const FEATURES_ICONS = [Sparkles, Scissors, Mic2, SlidersHorizontal, Volume2, Upload];

const HOW_IT_WORKS_KEYS = ["step1", "step2", "step3"];

const PLANS_KEYS = ["free", "basic", "pro", "premium"];
const PLANS_META = [
  { monthlyPrice: 0, annualDiscount: 0, credits: 12, highlight: false, isOneTime: true },
  { monthlyPrice: 6.99, annualDiscount: 20, credits: 1000, highlight: false, isOneTime: false },
  { monthlyPrice: 14.99, annualDiscount: 25, credits: 1500, highlight: false, isOneTime: false },
  { monthlyPrice: 29.99, annualDiscount: 30, credits: 3500, highlight: true, isOneTime: false },
];

const STATS_KEYS = ["genres", "stems", "credits", "apiCosts"];
const STATS_VALUES = ["20+", "4", "12", "0"];

const USE_CASE_KEYS = ["church", "birthday", "kids", "movies", "jingles", "youtube", "content", "restaurant"];
const USE_CASE_ICONS = [Church, Cake, Baby, Film, Megaphone, Youtube, Smartphone, Store];

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.6 },
};

const STEM_HEIGHTS = [
  [80, 50, 95, 65],
  [60, 90, 45, 75],
  [70, 55, 85, 40],
  [90, 70, 60, 80],
];

const STEM_KEYS = ["vocals", "drums", "bass", "melody"] as const;

function HeroSongCarousel({ songs }: { songs: any[] }) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const formatTime = useCallback((t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  const currentSong = songs[currentIndex];

  useEffect(() => {
    if (songs.length <= 1) return;
    const interval = setInterval(() => {
      if (!isPlaying) {
        setCurrentIndex((prev) => (prev + 1) % songs.length);
      }
    }, 35000);
    return () => clearInterval(interval);
  }, [songs.length, isPlaying]);

  useEffect(() => {
    if (!currentSong?.audioUrl || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    audioRef.current.src = currentSong.audioUrl;
    audioRef.current.load();
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, [currentIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    };
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      setCurrentIndex((prev) => (prev + 1) % songs.length);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [songs.length]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    const audio = audioRef.current;
    if (!bar || !audio || !audio.duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
  };

  const goTo = (dir: number) => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    setCurrentIndex((prev) => (prev + dir + songs.length) % songs.length);
  };

  if (!currentSong) return null;

  return (
    <div className="relative glass-panel rounded-2xl p-3 sm:p-6 border border-white/10 shadow-2xl" data-testid="hero-song-carousel">
      <audio ref={audioRef} preload="metadata" />
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSong.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.4 }}
        >
          <div className="rounded-xl bg-gradient-to-br from-gray-900 to-black overflow-hidden relative">
            <div className="relative aspect-[4/3] sm:aspect-square w-full overflow-hidden">
              {currentSong.imageUrl ? (
                <img
                  src={currentSong.imageUrl}
                  alt={currentSong.title}
                  className="w-full h-full object-cover"
                  data-testid="img-hero-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 to-orange-600/30 flex items-center justify-center">
                  <Music className="h-20 w-20 text-primary/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-[10px] text-primary font-medium">{t('common.aiGenerated')}</span>
              </div>

              <button
                onClick={togglePlay}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-primary/30 hover:border-primary/40 hover:shadow-[0_0_30px_rgba(0,243,255,0.3)]"
                data-testid="button-hero-play"
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 text-white" />
                ) : (
                  <Play className="w-7 h-7 text-white ml-0.5" />
                )}
              </button>

              <div className="absolute bottom-4 left-4 right-4">
                <p className="font-bold text-lg text-white drop-shadow-lg" data-testid="text-hero-song-title">
                  {currentSong.title || currentSong.prompt}
                </p>
                <p className="text-xs text-white/70">
                  {currentSong.artistName || "DA GRABA"} &middot; {currentSong.genre || ""}
                </p>
              </div>
            </div>

            <div className="px-4 pb-4 pt-3 space-y-3">
              <div className="w-full space-y-1">
                <div
                  ref={progressBarRef}
                  className="relative h-6 w-full cursor-pointer group flex items-center"
                  onClick={handleSeek}
                  data-testid="progress-hero"
                >
                  <div className="h-1.5 w-full bg-white/10 rounded-full pointer-events-none">
                    <div
                      className="h-full bg-gradient-to-r from-primary via-orange-400 to-orange-500 rounded-full relative transition-all duration-100"
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full">
                {STEM_KEYS.map((stem, i) => (
                  <div key={stem} className="flex-1 text-center p-1.5 rounded-lg bg-white/5 border border-white/5">
                    <div className="h-5 flex items-end justify-center gap-[2px]">
                      {STEM_HEIGHTS[i].map((h, j) => (
                        <div
                          key={j}
                          className={`w-[3px] rounded-full bg-primary/60 ${isPlaying ? "animate-pulse" : ""}`}
                          style={{ height: `${h}%`, animationDelay: `${j * 0.15}s` }}
                        />
                      ))}
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-1">{t(`landing.demoStems.${stem}`)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {songs.length > 1 && (
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goTo(-1)} data-testid="button-hero-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex gap-1">
              {songs.slice(0, Math.min(songs.length, 8)).map((_, i) => (
                <button
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIndex ? "bg-primary w-4" : "bg-white/20"}`}
                  onClick={() => { if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false); } setCurrentIndex(i); }}
                  data-testid={`dot-hero-${i}`}
                />
              ))}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goTo(1)} data-testid="button-hero-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Mic2 className="w-5 h-5 text-orange-400" />
            </div>
            <div className="text-left">
              <p className="text-xs text-muted-foreground">{t('common.poweredBy')}</p>
              <p className="text-sm font-bold">{t('common.engineName')}</p>
            </div>
          </div>
        </div>
      )}

      {songs.length <= 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Mic2 className="w-5 h-5 text-orange-400" />
            </div>
            <div className="text-left">
              <p className="text-xs text-muted-foreground">{t('common.poweredBy')}</p>
              <p className="text-sm font-bold">{t('common.engineName')}</p>
            </div>
          </div>
          <Wand2 className="w-5 h-5 text-white/20" />
        </div>
      )}
    </div>
  );
}

const DEMO_SONG = {
  id: 0,
  title: "Regreso al Edén",
  artistName: "DA GRABA AI",
  genre: "Bachata",
  audioUrl: "/audio/songs/ac1a3408-dc10-4b06-a8d4-39f0aebdf587_song.mp3",
  imageUrl: "https://lalals.s3.amazonaws.com/GenImages/1f6ff91d-a91e-4abc-87cd-f155ce2ea1fe.jpg",
};

export default function Landing() {
  const { user, isLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const { data: publicSongs } = usePublicSongs();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingAnnual, setBillingAnnual] = useState(false);

  useEffect(() => {
    return () => {};
  }, []);

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center text-primary" data-testid="loading-landing">{t('common.loading')}</div>;
  if (user) return <Redirect to="/dashboard" />;

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const heroSongs = publicSongs && publicSongs.length > 0
    ? publicSongs.filter((s: any) => s.audioUrl).slice(0, 8)
    : [DEMO_SONG];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-500/8 via-background to-background z-0" />
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-primary/5 via-orange-500/3 to-transparent z-0" />

      <nav className="relative z-20 border-b border-white/[0.06] backdrop-blur-xl bg-background/70 sticky top-0" data-testid="nav-landing">
        <div className="container mx-auto px-4 md:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <img src={daIcon} alt="DA GRABA Studio" className="h-10 sm:h-12 object-contain drop-shadow-[0_0_15px_rgba(255,117,31,0.3)]" data-testid="img-landing-logo" />
          </div>

          <div className="hidden md:flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-sm text-white/70 hover:text-white hover:bg-white/5" onClick={() => scrollTo("about")} data-testid="link-about">
              {t('landing.aboutTitle')}
            </Button>
            <Button variant="ghost" size="sm" className="text-sm text-white/70 hover:text-white hover:bg-white/5" onClick={() => scrollTo("use-cases")} data-testid="link-use-cases">
              {t('landing.useCases.title')}
            </Button>
            <Button variant="ghost" size="sm" className="text-sm text-white/70 hover:text-white hover:bg-white/5" onClick={() => scrollTo("features")} data-testid="link-features">
              {t('nav.features')}
            </Button>
            <Button variant="ghost" size="sm" className="text-sm text-white/70 hover:text-white hover:bg-white/5" onClick={() => scrollTo("pricing")} data-testid="link-pricing">
              {t('nav.pricing')}
            </Button>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1 text-white/60 hover:text-white"
              onClick={() => i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es')}
              data-testid="button-lang-toggle"
            >
              <Globe className="h-3.5 w-3.5" />
              {i18n.language === 'es' ? 'EN' : 'ES'}
            </Button>
            <Button
              className="ml-2 bg-gradient-to-r from-primary to-orange-500 text-white font-semibold text-sm px-5 shadow-[0_0_15px_rgba(255,117,31,0.25)]"
              onClick={handleLogin}
              data-testid="button-member-login"
            >
              {t('common.login')}
            </Button>
          </div>

          <div className="flex md:hidden items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es')}
              data-testid="button-lang-toggle-mobile"
            >
              <Globe className="h-3.5 w-3.5" />
              {i18n.language === 'es' ? 'EN' : 'ES'}
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="button-mobile-menu">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden border-t border-white/[0.06]"
            >
              <div className="px-4 py-4 space-y-1 bg-background/95 backdrop-blur-xl">
                <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => scrollTo("about")}>{t('landing.aboutTitle')}</Button>
                <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => scrollTo("use-cases")}>{t('landing.useCases.title')}</Button>
                <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => scrollTo("features")}>{t('nav.features')}</Button>
                <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => scrollTo("pricing")}>{t('nav.pricing')}</Button>
                <div className="pt-2">
                  <Button
                    className="w-full bg-gradient-to-r from-primary to-orange-500 text-white font-semibold"
                    onClick={() => { handleLogin(); setMobileMenuOpen(false); }}
                    data-testid="button-mobile-login"
                  >
                    {t('common.login')}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="relative z-10">
        <section className="container mx-auto px-4 md:px-6 pt-12 md:pt-24 pb-16 md:pb-32">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-6 md:space-y-8 text-center lg:text-left"
            >
              <div className="inline-block px-3 md:px-4 py-1 md:py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs md:text-sm font-medium mb-2 md:mb-4">
                {t('landing.badge')}
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight leading-tight" data-testid="text-hero-title">
                {t('landing.heroTitle')}{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-orange-500">
                  {t('landing.heroTitleHighlight')}
                </span>
              </h1>

              <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed mx-auto lg:mx-0" data-testid="text-hero-subtitle">
                {t('landing.heroSubtitle')}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center lg:justify-start pt-2 md:pt-4">
                <Button
                  size="lg"
                  className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg bg-gradient-to-r from-primary to-orange-500 text-white font-bold shadow-[0_0_25px_rgba(255,117,31,0.35)] gap-2"
                  onClick={handleLogin}
                  data-testid="button-start-creating"
                >
                  {t('landing.startCreating')}
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg border-white/10"
                  onClick={() => scrollTo("features")}
                  data-testid="button-explore-features"
                >
                  {t('landing.exploreFeatures')}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 justify-center lg:justify-start pt-2 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-400 shrink-0" />
                  <span>{t('landing.noCreditCard')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-400 shrink-0" />
                  <span>{t('landing.freeCredits')}</span>
                </div>
              </div>

            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="relative"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl animate-pulse hidden md:block" />
              <HeroSongCarousel songs={heroSongs} />
            </motion.div>
          </div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-12 md:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {STATS_KEYS.map((key, i) => (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}>
                <div className="text-center p-4 md:p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                  <p className="text-3xl md:text-4xl font-bold text-primary" data-testid={`text-stat-${i}`}>{STATS_VALUES[i]}</p>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">{t(`landing.stats.${key}`)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="about" className="container mx-auto px-4 md:px-6 py-16 md:py-24">
          <motion.div {...fadeUp}>
            <div className="relative rounded-2xl overflow-hidden border border-white/10">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-primary/5 to-orange-600/5" />
              <div className="relative p-6 sm:p-8 md:p-16">
                <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-orange-500/20 border border-primary/20 flex items-center justify-center">
                      <Heart className="w-10 h-10 md:w-12 md:h-12 text-primary" />
                    </div>
                  </div>
                  <div className="text-center md:text-left space-y-4">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-about-title">
                      {t('landing.aboutTitle')}
                    </h2>
                    <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-3xl" data-testid="text-about-description">
                      {t('landing.aboutText')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="use-cases" className="container mx-auto px-4 md:px-6 py-16 md:py-24">
          <motion.div {...fadeUp} className="text-center mb-12 md:mb-16">
            <Badge className="mb-4 bg-gradient-to-r from-primary/20 to-orange-500/20 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" />
              {t('landing.useCases.title')}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-use-cases-title">
              {t('landing.useCases.title')}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto text-base sm:text-lg">
              {t('landing.useCases.subtitle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            {USE_CASE_KEYS.map((key, i) => {
              const Icon = USE_CASE_ICONS[i];
              const gradients = [
                "from-amber-500/10 to-yellow-600/10 border-amber-500/20",
                "from-orange-400/10 to-orange-600/10 border-orange-400/20",
                "from-green-500/10 to-emerald-600/10 border-green-500/20",
                "from-orange-500/10 to-orange-600/10 border-orange-500/20",
                "from-orange-500/10 to-red-600/10 border-orange-500/20",
                "from-red-500/10 to-orange-500/10 border-red-500/20",
                "from-indigo-500/10 to-indigo-600/10 border-indigo-500/20",
                "from-cyan-500/10 to-teal-600/10 border-cyan-500/20",
              ];
              const iconColors = [
                "text-amber-400", "text-blue-400", "text-green-400", "text-blue-400",
                "text-orange-400", "text-red-400", "text-indigo-400", "text-cyan-400"
              ];
              return (
                <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.06 }}>
                  <Card className={`bg-gradient-to-br ${gradients[i]} hover:scale-[1.02] transition-all cursor-pointer h-full`} data-testid={`card-use-case-${key}`}>
                    <CardContent className="p-4 sm:p-5 text-center space-y-3">
                      <div className={`mx-auto w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center`}>
                        <Icon className={`h-6 w-6 ${iconColors[i]}`} />
                      </div>
                      <h3 className="font-bold text-sm">{t(`landing.useCases.${key}.title`)}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed hidden sm:block">{t(`landing.useCases.${key}.description`)}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section id="features" className="container mx-auto px-4 md:px-6 py-16 md:py-24">
          <motion.div {...fadeUp} className="text-center mb-12 md:mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">{t('nav.features')}</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-features-title">
              {t('landing.featuresTitle')}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              {t('landing.featuresSubtitle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            {FEATURES_KEYS.map((key, i) => {
              const Icon = FEATURES_ICONS[i];
              return (
                <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }}>
                  <Card className="bg-white/[0.02] border-white/5 hover:border-primary/20 transition-colors h-full" data-testid={`card-feature-${i}`}>
                    <CardContent className="p-5 md:p-6">
                      <div className="p-2.5 rounded-lg bg-primary/10 w-fit mb-4">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-bold text-base mb-2">{t(`landing.features.${key}.title`)}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{t(`landing.features.${key}.description`)}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-16 md:py-24">
          <motion.div {...fadeUp} className="text-center mb-12 md:mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">{t('landing.howItWorksBadge')}</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-how-title">
              {t('landing.howItWorksTitle')}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              {t('landing.howItWorksSubtitle')}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {HOW_IT_WORKS_KEYS.map((key, i) => (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.15 }}>
                <div className="text-center space-y-4 p-6" data-testid={`step-${i + 1}`}>
                  <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                    <span className="text-2xl font-bold text-primary">{i + 1}</span>
                  </div>
                  <h3 className="text-lg font-bold">{t(`landing.howItWorks.${key}.title`)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(`landing.howItWorks.${key}.description`)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="pricing" className="container mx-auto px-4 md:px-6 py-16 md:py-24">
          <motion.div {...fadeUp} className="text-center mb-12 md:mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">{t('nav.pricing')}</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-pricing-title">
              {t('landing.pricingTitle')}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              {t('landing.pricingSubtitle')}
            </p>

            <div className="flex items-center justify-center gap-3 mt-8" data-testid="billing-toggle">
              <span className={`text-sm font-medium transition-colors ${!billingAnnual ? "text-primary" : "text-muted-foreground"}`}>
                {t('landing.billingMonthly')}
              </span>
              <button
                onClick={() => setBillingAnnual(!billingAnnual)}
                className={`relative w-14 h-7 rounded-full transition-colors ${billingAnnual ? "bg-primary" : "bg-white/20"}`}
                data-testid="button-billing-toggle"
              >
                <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${billingAnnual ? "translate-x-7" : "translate-x-0.5"}`} />
              </button>
              <span className={`text-sm font-medium transition-colors ${billingAnnual ? "text-primary" : "text-muted-foreground"}`}>
                {t('landing.billingAnnual')}
              </span>
              {billingAnnual && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                  {t('landing.save')} 20-30%
                </Badge>
              )}
            </div>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
            {PLANS_KEYS.map((key, i) => {
              const meta = PLANS_META[i];
              const planFeatures = t(`landing.plans.${key}.features`, { returnObjects: true }) as string[];
              const planName = t(`landing.plans.${key}.name`);

              const monthlyPrice = meta.monthlyPrice;
              const annualMonthly = monthlyPrice > 0
                ? Number((monthlyPrice * (1 - meta.annualDiscount / 100)).toFixed(2))
                : 0;
              const annualTotal = Number((annualMonthly * 12).toFixed(2));
              const displayPrice = billingAnnual && !meta.isOneTime ? annualMonthly : monthlyPrice;
              const showDiscount = billingAnnual && !meta.isOneTime && meta.annualDiscount > 0;

              return (
                <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}>
                  <Card
                    className={`relative h-full ${meta.highlight ? "border-primary/50 shadow-lg shadow-primary/10" : "bg-white/[0.02] border-white/5"}`}
                    data-testid={`card-plan-preview-${key}`}
                  >
                    {meta.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-black font-semibold">{t('common.mostPopular')}</Badge>
                      </div>
                    )}
                    {showDiscount && (
                      <div className="absolute -top-3 right-3">
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                          -{meta.annualDiscount}%
                        </Badge>
                      </div>
                    )}
                    <CardContent className="p-3 sm:p-5 md:p-6 flex flex-col h-full">
                      <h3 className="font-bold text-sm sm:text-lg">{planName}</h3>
                      <div className="mt-1.5 sm:mt-2 mb-1">
                        {monthlyPrice === 0 ? (
                          <span className="text-2xl sm:text-3xl font-bold">$0</span>
                        ) : (
                          <>
                            <span className="text-2xl sm:text-3xl font-bold">${displayPrice.toFixed(2)}</span>
                            <span className="text-muted-foreground text-xs sm:text-sm">{t('common.perMonth')}</span>
                          </>
                        )}
                      </div>
                      {billingAnnual && !meta.isOneTime && monthlyPrice > 0 && (
                        <div className="mb-2">
                          <p className="text-[10px] sm:text-xs text-muted-foreground line-through">${monthlyPrice.toFixed(2)}{t('common.perMonth')}</p>
                          <p className="text-[10px] sm:text-xs text-green-400">${annualTotal.toFixed(2)}{t('landing.perYear')}</p>
                        </div>
                      )}
                      {!meta.isOneTime && (
                        <div className="mb-3 sm:mb-4">
                          <Badge variant="outline" className="text-[10px] border-primary/20 text-primary/80">
                            {meta.credits.toLocaleString()} {i18n.language === 'es' ? 'créditos/mes' : 'credits/mo'}
                          </Badge>
                        </div>
                      )}
                      {meta.isOneTime && <div className="mb-3 sm:mb-4" />}
                      <ul className="space-y-1.5 sm:space-y-2 flex-1">
                        {planFeatures.map((f, j) => (
                          <li key={j} className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm">
                            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">{f}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className={`w-full mt-4 sm:mt-6 text-xs sm:text-sm ${meta.highlight ? "bg-primary text-black" : ""}`}
                        variant={meta.highlight ? "default" : "outline"}
                        onClick={handleLogin}
                        data-testid={`button-plan-${key}`}
                      >
                        {monthlyPrice === 0 ? t('common.getStarted') : t('common.startTrial')}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.4 }}>
            <div className="mt-8 md:mt-12 max-w-2xl mx-auto">
              <Card className="bg-gradient-to-r from-primary/5 via-orange-600/5 to-orange-500/5 border-primary/20" data-testid="card-topup-info">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-bold text-sm sm:text-base">{t('landing.topUpTitle')}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">{t('landing.topUpDescription')}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline" className="text-xs border-primary/20 text-primary/80">
                          {t('landing.topUpBase')}
                        </Badge>
                        <Badge variant="outline" className="text-xs border-green-500/20 text-green-400/80">
                          {t('landing.topUpScaling')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-16 md:py-24">
          <motion.div {...fadeUp} className="text-center mb-12 md:mb-16">
            <Badge className="mb-4 bg-orange-500/10 text-orange-400 border-orange-500/20">
              <Clock className="h-3 w-3 mr-1" />
              {t('landing.comingSoonTitle')}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-coming-soon-title">
              {t('landing.comingSoonTitle')}
            </h2>
          </motion.div>

          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}>
            <Card className="bg-white/[0.02] border-white/5 hover:border-orange-500/20 transition-colors max-w-2xl mx-auto" data-testid="card-coming-soon-genre">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 shrink-0">
                    <BookOpen className="h-6 w-6 text-orange-400" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">{t('landing.comingSoonGenreHistory')}</h3>
                      <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[10px]">{t('landing.comingSoonTitle')}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t('landing.comingSoonGenreHistoryDesc')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </section>

        {publicSongs && publicSongs.length > 0 && (
          <section id="community" className="container mx-auto px-4 md:px-6 py-16 md:py-24">
            <motion.div {...fadeUp} className="text-center mb-10">
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
                <Globe className="h-3 w-3 mr-1" />
                {t('publicSongs.title')}
              </Badge>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-3" data-testid="text-community-title">
                {t('publicSongs.title')}
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
                {t('publicSongs.subtitle')}
              </p>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicSongs.slice(0, 6).map((song: any, idx: number) => (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                >
                  <Card className="bg-card/90 border-white/5 overflow-hidden group hover:border-primary/30 transition-all" data-testid={`card-public-song-${song.id}`}>
                    <div className="relative h-40 overflow-hidden">
                      {song.imageUrl ? (
                        <img src={song.imageUrl} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-orange-600/20 flex items-center justify-center">
                          <Music className="h-12 w-12 text-primary/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm truncate" data-testid={`text-public-song-title-${song.id}`}>{song.title || song.prompt}</h3>
                      <div className="flex items-center justify-between mt-1">
                        {song.genre && (
                          <Badge variant="outline" className="text-[10px] border-white/10">
                            {song.genre}
                          </Badge>
                        )}
                        {song.duration && (
                          <span className="text-[10px] text-muted-foreground">
                            {Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        <section className="container mx-auto px-4 md:px-6 py-16 md:py-24">
          <motion.div {...fadeUp}>
            <div className="relative rounded-2xl overflow-hidden border border-white/10">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-orange-600/10 to-orange-500/10" />
              <div className="relative p-6 sm:p-8 md:p-16 text-center space-y-4 sm:space-y-6">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-cta-title">
                  {t('landing.ctaTitle')}
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-lg">
                  {t('landing.ctaSubtitle')}
                </p>
                <Button
                  size="lg"
                  className="h-12 sm:h-14 px-6 sm:px-10 text-base sm:text-lg bg-gradient-to-r from-primary to-orange-500 text-white font-bold shadow-[0_0_30px_rgba(255,117,31,0.35)] gap-2"
                  onClick={handleLogin}
                  data-testid="button-cta-signup"
                >
                  {t('landing.ctaButton')}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      <footer
        className="border-t border-white/5 py-8 md:py-12 px-4 relative overflow-hidden"
        style={{
          backgroundImage: `url(${palettaBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center right",
        }}
        data-testid="footer-landing"
      >
        <div className="absolute inset-0 bg-background/95 pointer-events-none" />
        <div className="container mx-auto relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <div className="mb-4">
                <img src={daIcon} alt="DA GRABA Studio" className="h-10 object-contain drop-shadow-[0_0_12px_rgba(255,117,31,0.25)]" data-testid="img-footer-logo" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('landing.footer.footerDescription')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">{t('landing.footer.product')}</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="hover:text-foreground cursor-pointer transition-colors" onClick={() => scrollTo("features")}>{t('nav.features')}</li>
                <li className="hover:text-foreground cursor-pointer transition-colors" onClick={() => scrollTo("pricing")}>{t('nav.pricing')}</li>
                <li className="hover:text-foreground cursor-pointer transition-colors" onClick={() => handleLogin()}>{t('landing.footer.producerStore')}</li>
                <li className="hover:text-foreground cursor-pointer transition-colors" onClick={() => handleLogin()}>{t('landing.footer.styleKits')}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">{t('landing.footer.tools')}</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="hover:text-foreground cursor-pointer transition-colors" onClick={() => handleLogin()}>{t('landing.footer.aiMusicGenerator')}</li>
                <li className="hover:text-foreground cursor-pointer transition-colors" onClick={() => handleLogin()}>{t('landing.footer.stemSeparator')}</li>
                <li className="hover:text-foreground cursor-pointer transition-colors" onClick={() => handleLogin()}>{t('landing.footer.aiLyricsWriter')}</li>
                <li className="hover:text-foreground cursor-pointer transition-colors" onClick={() => handleLogin()}>{t('landing.footer.sampleLab')}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">{t('landing.footer.genres')}</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>{t('create.genres.bachata')}</li>
                <li>{t('create.genres.latinPop')}</li>
                <li>{t('create.genres.reggaeton')}</li>
                <li>{t('create.genres.bolero')} & {t('create.genres.salsa')}</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 mb-8">
            <h4 className="font-semibold text-sm mb-5 text-center">{t('landing.footer.faqTitle')}</h4>
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {(t('landing.footer.faq', { returnObjects: true }) as {q: string, a: string}[]).map((item, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/5" data-testid={`faq-item-${i}`}>
                  <p className="text-sm font-medium text-foreground mb-1.5">{item.q}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center mb-6">
            <p className="text-xs text-muted-foreground mb-2">{t('landing.footer.needHelp')}</p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
              onClick={handleLogin}
              data-testid="button-footer-support"
            >
              <MessageCircle className="h-4 w-4" />
              {t('landing.footer.chatSupport')}
            </Button>
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} {t('landing.footer.copyright')}</p>
            <div className="flex items-center gap-4">
              <a href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-terms">{t('landing.footer.termsLink')}</a>
              <span className="text-white/10">|</span>
              <a href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-privacy">{t('landing.footer.privacyLink')}</a>
              <span className="text-white/10">|</span>
              <a href="/cookies" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-cookies">{t('landing.footer.cookiesLink')}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
