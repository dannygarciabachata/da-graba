import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSongs } from "@/hooks/use-songs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Music,
  Play,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  Heart,
  Headphones,
  Scissors,
  Mic,
  Zap,
  ArrowRight,
  Star,
  Crown,
  Globe,
  Users,
  Guitar,
  Drum,
  Radio,
  Volume2,
  Disc,
  Music2,
  Waves,
  Flame,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import dgbLogo from "@assets/IMG_4933_1771383067858.png";

const HERO_SLIDES = [
  {
    id: 1,
    title: "DAGRABA Studio",
    subtitle: "La Pura Sangre de la Bachata con el ADN de Danny Garcia y los Grandes Músicos Dominicanos",
    cta: "Explorar Studio",
    ctaUrl: "/studio",
    cta2: "Crear Canción",
    cta2Url: "/create",
    gradient: "from-primary/30 via-pink-600/20 to-purple-600/10",
    accentColor: "primary",
  },
  {
    id: 2,
    title: "DAGRABACHATA",
    subtitle: "Crea bachata auténtica con instrumentos originales DGB — requinto, bongó, güira, y más. ADN Protegido.",
    cta: "Crear Bachata",
    ctaUrl: "/create?genre=Bachata",
    gradient: "from-pink-500/25 via-primary/15 to-pink-600/10",
    accentColor: "pink",
  },
  {
    id: 3,
    title: "DAGRABOLERO",
    subtitle: "Bolero con alma dominicana. Orquestación completa con piano, violines, cuerdas y voces armónicas.",
    cta: "Crear Bolero",
    ctaUrl: "/create?genre=Bolero",
    gradient: "from-pink-500/25 via-pink-500/15 to-purple-500/10",
    accentColor: "pink",
  },
  {
    id: 4,
    title: "35+ Géneros con IA",
    subtitle: "Desde Bachata y Salsa hasta K-pop, EDM y Afrobeat. Generación de música con inteligencia artificial de última generación.",
    cta: "Ver Géneros",
    ctaUrl: "/create",
    gradient: "from-amber-500/20 via-orange-500/15 to-red-500/10",
    accentColor: "amber",
  },
  {
    id: 5,
    title: "Monetiza tu Música",
    subtitle: "Registro de copyright, distribución, regalías y modelo de propiedad 60/40. Tu música, tus derechos.",
    cta: "Artist Dashboard",
    ctaUrl: "/artist-dashboard",
    gradient: "from-emerald-500/20 via-green-500/15 to-teal-500/10",
    accentColor: "emerald",
  },
];

const FEATURED_GENRES = [
  { name: "DAGRABACHATA", Icon: Guitar, color: "from-primary to-pink-400" },
  { name: "DAGRABOLERO", Icon: Music2, color: "from-pink-500 to-pink-400" },
  { name: "Salsa", Icon: Flame, color: "from-red-500 to-orange-400" },
  { name: "Merengue", Icon: Drum, color: "from-yellow-500 to-amber-400" },
  { name: "Reggaeton", Icon: Volume2, color: "from-purple-500 to-pink-400" },
  { name: "R&B", Icon: Mic, color: "from-rose-500 to-pink-400" },
  { name: "Hip Hop", Icon: Headphones, color: "from-gray-600 to-gray-400" },
  { name: "EDM", Icon: Waves, color: "from-pink-400 to-orange-300" },
];

const QUICK_ACTIONS = [
  { title: "Crear Canción", desc: "IA genera tu música", icon: Sparkles, url: "/create", color: "text-primary" },
  { title: "Studio", desc: "Edita y mezcla", icon: Scissors, url: "/studio", color: "text-pink-400" },
  { title: "Sample Lab", desc: "Graba y sube audio", icon: Mic, url: "/sample-lab", color: "text-purple-400" },
  { title: "Descubrir", desc: "Explora música", icon: Globe, url: "/discover", color: "text-emerald-400" },
];

export default function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: songs } = useSongs();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recentSongs = (songs ?? []).slice(0, 8);
  const completedSongs = (songs ?? []).filter((s: any) => s.status === "completed").slice(0, 6);

  useEffect(() => {
    if (!isAutoPlaying) return;
    slideTimerRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    };
  }, [isAutoPlaying]);

  const goToSlide = (idx: number) => {
    setCurrentSlide(idx);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 15000);
  };

  const nextSlide = () => goToSlide((currentSlide + 1) % HERO_SLIDES.length);
  const prevSlide = () => goToSlide((currentSlide - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);

  const slide = HERO_SLIDES[currentSlide];

  if (!user) return null;

  return (
    <ScrollArea className="h-full">
      <div className="min-h-full pb-8">

        {/* ===== HERO BANNER SLIDESHOW ===== */}
        <div className="relative overflow-hidden" data-testid="hero-slideshow">
          <div className="relative min-h-[280px] sm:min-h-[320px] lg:min-h-[360px] xl:min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={slide.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className={cn("absolute inset-0 bg-gradient-to-br", slide.gradient)}
              />
            </AnimatePresence>

            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,20,147,0.08),transparent_60%)]" />
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-primary/8 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-56 h-56 bg-gradient-to-tr from-pink-500/6 to-transparent rounded-full blur-3xl" />

            <div className="relative z-10 flex items-center min-h-[280px] sm:min-h-[320px] lg:min-h-[360px] xl:min-h-[400px]">
              <div className="w-full px-6 sm:px-8 lg:px-10 xl:px-12 py-8">
                <div className="flex items-start gap-6 lg:gap-10 max-w-5xl">
                  <div className="hidden sm:block flex-shrink-0">
                    <img
                      src={dgbLogo}
                      alt="DAGRABA"
                      className="h-24 w-24 lg:h-32 lg:w-32 xl:h-36 xl:w-36 object-contain drop-shadow-[0_0_30px_rgba(255,20,147,0.3)]"
                    />
                  </div>
                  <div className="flex-1">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={slide.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5 }}
                      >
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-3 lg:mb-4 leading-tight" data-testid="hero-title">
                          {slide.title}
                        </h1>
                        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-2xl mb-5 lg:mb-7 leading-relaxed" data-testid="hero-subtitle">
                          {slide.subtitle}
                        </p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <Button
                            variant="outline"
                            className="backdrop-blur-md bg-white/5 border-white/20"
                            onClick={() => setLocation(slide.cta2Url || slide.ctaUrl)}
                            data-testid="hero-cta-primary"
                          >
                            {slide.cta}
                          </Button>
                          {slide.cta2 && (
                            <Button
                              className="bg-gradient-to-r from-primary to-pink-500 text-white font-semibold shadow-[0_0_20px_rgba(255,20,147,0.25)]"
                              onClick={() => setLocation(slide.cta2Url!)}
                              data-testid="hero-cta-secondary"
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              {slide.cta2}
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>

            <Button
              size="icon"
              variant="ghost"
              onClick={prevSlide}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/30 border border-white/15 backdrop-blur-sm"
              data-testid="hero-prev"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={nextSlide}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/30 border border-white/15 backdrop-blur-sm"
              data-testid="hero-next"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2" data-testid="hero-dots">
              {HERO_SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === currentSlide ? "w-8 bg-primary" : "w-1.5 bg-white/30 hover:bg-white/50"
                  )}
                  data-testid={`hero-dot-${i}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-7 lg:px-10 xl:px-12 space-y-8 lg:space-y-10 mt-6 lg:mt-8">

          {/* ===== QUICK ACTIONS ===== */}
          <div data-testid="quick-actions">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {QUICK_ACTIONS.map((action) => (
                <Card
                  key={action.title}
                  className="p-4 cursor-pointer border-white/5 bg-white/[0.02] hover-elevate transition-all group"
                  onClick={() => setLocation(action.url)}
                  data-testid={`quick-action-${action.url.replace("/", "")}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center transition-colors">
                      <action.icon className={cn("h-5 w-5", action.color)} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold truncate">{action.title}</h4>
                      <p className="text-[11px] text-muted-foreground truncate">{action.desc}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* ===== 3-COLUMN CONTENT: For You, Trending, Quick Info ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_280px] xl:grid-cols-[1fr_1fr_320px] gap-6 lg:gap-8">

            {/* FOR YOU */}
            <div data-testid="section-for-you">
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Heart className="h-5 w-5 text-primary" />
                  For You
                </h2>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setLocation("/library")} data-testid="link-view-all-songs">
                  Ver Todo <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
              {recentSongs.length === 0 ? (
                <Card className="p-8 border-white/5 bg-white/[0.02] text-center">
                  <Music className="h-10 w-10 text-primary/20 mx-auto mb-3" />
                  <h3 className="text-sm font-medium mb-1">No hay canciones aún</h3>
                  <p className="text-xs text-muted-foreground mb-4">Crea tu primera canción con IA</p>
                  <Button size="sm" onClick={() => setLocation("/create")} data-testid="button-create-first-song">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />Crear
                  </Button>
                </Card>
              ) : (
                <div className="space-y-1.5">
                  {recentSongs.map((song: any, idx: number) => (
                    <div
                      key={song.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover-elevate cursor-pointer transition-colors group"
                      onClick={() => setLocation("/create")}
                      data-testid={`for-you-song-${song.id}`}
                    >
                      <span className="text-xs text-muted-foreground/50 w-5 text-right font-mono">{idx + 1}</span>
                      <div className="h-11 w-11 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {song.imageUrl ? (
                          <img src={song.imageUrl} alt="" className="h-11 w-11 object-cover rounded-lg" />
                        ) : (
                          <Music className="h-4 w-4 text-primary/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{song.title || song.prompt || "Untitled"}</h4>
                        <div className="flex items-center gap-2">
                          {song.genre && <span className="text-[10px] text-muted-foreground">{song.genre}</span>}
                          <span className="text-[10px] text-muted-foreground/50">{song.createdAt && formatDistanceToNow(new Date(song.createdAt), { addSuffix: true })}</span>
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="h-4 w-4 text-primary fill-current" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TRENDING */}
            <div data-testid="section-trending">
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                  Trending
                </h2>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-white/10 cursor-pointer toggle-elevate" data-testid="trending-filter-global">
                    <Globe className="h-3 w-3 mr-1" />Global
                  </Badge>
                </div>
              </div>
              {completedSongs.length === 0 ? (
                <Card className="p-8 border-white/5 bg-white/[0.02] text-center">
                  <TrendingUp className="h-10 w-10 text-emerald-400/20 mx-auto mb-3" />
                  <h3 className="text-sm font-medium mb-1">Trending próximamente</h3>
                  <p className="text-xs text-muted-foreground">Las canciones más populares aparecerán aquí</p>
                </Card>
              ) : (
                <div className="space-y-1.5">
                  {completedSongs.map((song: any, idx: number) => (
                    <div
                      key={song.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover-elevate cursor-pointer transition-colors group"
                      onClick={() => setLocation("/create")}
                      data-testid={`trending-song-${song.id}`}
                    >
                      <span className={cn(
                        "text-xs w-5 text-right font-bold",
                        idx === 0 ? "text-amber-400" : idx === 1 ? "text-gray-400" : idx === 2 ? "text-amber-600" : "text-muted-foreground/40"
                      )}>{idx + 1}</span>
                      <div className="h-11 w-11 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {song.imageUrl ? (
                          <img src={song.imageUrl} alt="" className="h-11 w-11 object-cover rounded-lg" />
                        ) : (
                          <Music className="h-4 w-4 text-primary/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{song.title || song.prompt || "Untitled"}</h4>
                        <div className="flex items-center gap-2">
                          {song.genre && <span className="text-[10px] text-muted-foreground">{song.genre}</span>}
                          {song.duration && <span className="text-[10px] text-muted-foreground/50">{Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, "0")}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                          <Headphones className="h-3 w-3" />
                          <span>{Math.floor(Math.random() * 5000) + 100}</span>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="h-4 w-4 text-primary fill-current" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR INFO */}
            <div className="space-y-5" data-testid="section-sidebar-info">
              <Card className="p-4 border-white/5 bg-gradient-to-br from-primary/5 to-pink-500/5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Crown className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Go Pro</h3>
                    <p className="text-[11px] text-muted-foreground">Más créditos, mejores modelos</p>
                  </div>
                </div>
                <Button size="sm" className="w-full bg-gradient-to-r from-primary to-pink-500 text-white font-semibold" onClick={() => setLocation("/pricing")} data-testid="button-go-pro">
                  Upgrade
                </Button>
              </Card>

              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-400" />
                  Géneros Destacados
                </h3>
                <div className="space-y-1.5">
                  {FEATURED_GENRES.map((genre) => (
                    <div
                      key={genre.name}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover-elevate cursor-pointer transition-colors"
                      onClick={() => setLocation(`/create?genre=${encodeURIComponent(genre.name)}`)}
                      data-testid={`featured-genre-${genre.name}`}
                    >
                      <div className={cn("h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center", genre.color)}>
                        <genre.Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{genre.name}</h4>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                  ))}
                </div>
              </div>

              <Card className="p-4 border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-pink-400" />
                  <h3 className="text-sm font-semibold">Comunidad</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Únete a artistas creando música con DAGRABA Studio</p>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setLocation("/discover")} data-testid="button-discover-community">
                  Descubrir Artistas
                </Button>
              </Card>
            </div>

          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
