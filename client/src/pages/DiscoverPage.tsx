import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Play,
  Pause,
  Heart,
  ThumbsDown,
  Share2,
  Download,
  ChevronLeft,
  ChevronRight,
  Music,
  TrendingUp,
  Headphones,
  Compass,
  Volume2,
  VolumeX,
} from "lucide-react";

const GENRE_COLORS: Record<string, string> = {
  bachata: "from-pink-600 to-purple-800",
  bolero: "from-amber-700 to-red-900",
  "dgb_bachata": "from-cyan-500 to-blue-800",
  "dgb_bolero": "from-amber-500 to-rose-800",
  "hip-hop": "from-orange-600 to-red-700",
  pop: "from-green-500 to-teal-700",
  "r&b": "from-violet-600 to-indigo-800",
  edm: "from-blue-500 to-purple-700",
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
          const label = isTop100 ? "Top 100" : p.genre;
          const gradient = isTop100 ? "from-primary to-purple-700" : getGenreColor(p.genre);
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
  currentSongId: number | null;
  isPlaying: boolean;
}

function SongCard({ song, rank, onPlay, currentSongId, isPlaying }: SongCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const isCurrent = currentSongId === song.id;

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
    <Card className="bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] transition-colors group" data-testid={`card-song-${song.id}`}>
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
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {isCurrent && isPlaying ? (
              <Pause className="h-5 w-5 text-white" />
            ) : (
              <Play className="h-5 w-5 text-white fill-white" />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium truncate" data-testid={`text-song-title-${song.id}`}>{song.title}</h3>
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
          {song.audioUrl && (
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
  const [currentSong, setCurrentSong] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [likeStatus, setLikeStatus] = useState<{ likes: number; dislikes: number; userValue: number }>({ likes: 0, dislikes: 0, userValue: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSongRef = useRef<any>(null);
  const songsRef = useRef<any[]>([]);

  const playMutation = useMutation({
    mutationFn: async (songId: number) => {
      await apiRequest("POST", `/api/songs/${songId}/play`, {});
    },
  });

  const fetchLikeStatus = useCallback(async (songId: number) => {
    try {
      const res = await fetch(`/api/songs/${songId}/likes`);
      if (res.ok) {
        const data = await res.json();
        setLikeStatus(data);
      }
    } catch {}
  }, []);

  const { data: topSongs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/public/charts"],
  });

  useEffect(() => {
    songsRef.current = topSongs || [];
  }, [topSongs]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  const startPlayback = useCallback((song: any) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    const audio = new Audio(song.audioUrl);
    audio.volume = isMuted ? 0 : volume / 100;
    const onEnded = () => {
      const list = songsRef.current;
      const cur = currentSongRef.current;
      if (!list || list.length === 0) { setIsPlaying(false); return; }
      const idx = list.findIndex((s: any) => s.id === cur?.id);
      const nextIdx = (idx + 1) % list.length;
      const next = list[nextIdx];
      if (next?.audioUrl) {
        setCurrentSong(next);
        currentSongRef.current = next;
        playMutation.mutate(next.id);
        fetchLikeStatus(next.id);
        startPlayback(next);
      } else {
        setIsPlaying(false);
      }
    };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.play().catch(() => setIsPlaying(false));
    audioRef.current = audio;
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
  }, [isMuted, volume]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
      }
    };
  }, []);

  const handlePlay = (song: any) => {
    if (!song.audioUrl) return;
    if (currentSong?.id === song.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
      return;
    }
    setCurrentSong(song);
    currentSongRef.current = song;
    playMutation.mutate(song.id);
    fetchLikeStatus(song.id);
    startPlayback(song);
  };

  const handleSeek = (val: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = val[0];
      setCurrentTime(val[0]);
    }
  };

  const handleVolumeChange = (val: number[]) => {
    const v = val[0];
    setVolume(v);
    setIsMuted(v === 0);
    if (audioRef.current) audioRef.current.volume = v / 100;
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (audioRef.current) audioRef.current.volume = next ? 0 : volume / 100;
  };

  const handleFooterLike = async (value: 1 | -1) => {
    if (!user) { toast({ title: t('discover.loginToLike') }); return; }
    if (!currentSong) return;
    await apiRequest("POST", `/api/songs/${currentSong.id}/like`, { value });
    fetchLikeStatus(currentSong.id);
    queryClient.invalidateQueries({ queryKey: ["/api/public/charts"] });
  };

  const handleShare = () => {
    if (!currentSong) return;
    const url = `${window.location.origin}/discover`;
    const text = `${currentSong.title} - ${currentSong.artistName || "DGB AUDIO"}`;
    if (navigator.share) {
      navigator.share({ title: text, url });
    } else {
      navigator.clipboard.writeText(`${text} ${url}`);
      toast({ title: t('discover.shared') });
    }
  };

  const featured = topSongs?.slice(0, 20) || [];

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-8">
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
                <div key={i} className="h-16 bg-white/[0.03] rounded-lg animate-pulse" />
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
                  currentSongId={currentSong?.id}
                  isPlaying={isPlaying}
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

      {currentSong && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-white/10 z-50 px-4 py-2" data-testid="now-playing-bar">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                {currentSong.imageUrl ? (
                  <img src={currentSong.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 w-28">
                <p className="text-sm font-medium truncate" data-testid="text-now-playing-title">{currentSong.title}</p>
                <p className="text-xs text-muted-foreground truncate">{currentSong.artistName || "DGB AUDIO"}</p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => handlePlay(currentSong)}
                data-testid="button-now-playing-toggle"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
              </Button>

              <div className="flex-1 flex items-center gap-2 min-w-0">
                <Slider
                  value={[currentTime]}
                  max={duration || 1}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="flex-1"
                  data-testid="slider-seek"
                />
                <span className="text-xs text-muted-foreground font-mono w-14 text-right flex-shrink-0" data-testid="text-countdown">
                  {duration > 0 ? formatCountdown(duration - currentTime) : "--:--"}
                </span>
              </div>

              <div
                className="relative flex-shrink-0"
                onMouseEnter={() => setShowVolume(true)}
                onMouseLeave={() => setShowVolume(false)}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggleMute}
                  data-testid="button-volume-toggle"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                {showVolume && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-background/95 border border-white/10 rounded-lg p-2 w-8 h-24"
                    data-testid="volume-slider-popup"
                  >
                    <Slider
                      orientation="vertical"
                      value={[isMuted ? 0 : volume]}
                      max={100}
                      step={1}
                      onValueChange={handleVolumeChange}
                      className="h-full"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${likeStatus.userValue === 1 ? "text-primary" : ""}`}
                  onClick={() => handleFooterLike(1)}
                  data-testid="button-footer-like"
                >
                  <Heart className={`h-4 w-4 ${likeStatus.userValue === 1 ? "fill-primary" : ""}`} />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[1.5rem]" data-testid="text-like-count">
                  {formatCount(likeStatus.likes || 0)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${likeStatus.userValue === -1 ? "text-red-400" : ""}`}
                  onClick={() => handleFooterLike(-1)}
                  data-testid="button-footer-dislike"
                >
                  <ThumbsDown className={`h-4 w-4 ${likeStatus.userValue === -1 ? "fill-red-400" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleShare}
                  data-testid="button-footer-share"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
