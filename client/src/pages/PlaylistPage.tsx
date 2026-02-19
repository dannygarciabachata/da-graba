import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
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
  Music,
  ArrowLeft,
  Headphones,
  CheckCircle,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";

const GENRE_COLORS: Record<string, string> = {
  bachata: "from-orange-600 to-blue-800",
  bolero: "from-amber-700 to-red-900",
  "dgb_bachata": "from-cyan-500 to-blue-800",
  "dgb_bolero": "from-amber-500 to-rose-800",
  "hip-hop": "from-orange-600 to-red-700",
  pop: "from-green-500 to-teal-700",
  "r&b": "from-violet-600 to-indigo-800",
  edm: "from-blue-500 to-blue-700",
  reggaeton: "from-yellow-500 to-orange-700",
  salsa: "from-red-500 to-orange-700",
  merengue: "from-green-600 to-emerald-800",
  jazz: "from-indigo-500 to-blue-900",
  rock: "from-gray-600 to-slate-900",
  top100: "from-primary to-blue-700",
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

export default function PlaylistPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/discover/:genre");
  const genre = params?.genre ? decodeURIComponent(params.genre) : "top100";
  const isTop100 = genre === "top100";

  const [currentSong, setCurrentSong] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [likeStatus, setLikeStatus] = useState<{ likes: number; dislikes: number; userValue: number }>({ likes: 0, dislikes: 0, userValue: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSongRef = useRef<any>(null);
  const songsRef = useRef<any[]>([]);

  const limit = isTop100 ? 100 : 20;
  const apiUrl = isTop100 ? `/api/public/charts?limit=${limit}` : `/api/public/charts/${encodeURIComponent(genre)}?limit=${limit}`;

  const { data: songs, isLoading } = useQuery<any[]>({
    queryKey: [apiUrl],
  });

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

  useEffect(() => {
    songsRef.current = songs || [];
  }, [songs]);

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
    audio.addEventListener("loadedmetadata", () => setDur(audio.duration));
    audio.play().catch(() => setIsPlaying(false));
    audioRef.current = audio;
    setIsPlaying(true);
    setCurrentTime(0);
    setDur(0);
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
    queryClient.invalidateQueries({ queryKey: [apiUrl] });
  };

  const handleShare = () => {
    if (!currentSong) return;
    const url = `${window.location.origin}/discover/${encodeURIComponent(genre)}`;
    const text = `${currentSong.title} - ${currentSong.artistName || "DA GRABA"}`;
    if (navigator.share) {
      navigator.share({ title: text, url });
    } else {
      navigator.clipboard.writeText(`${text} ${url}`);
      toast({ title: t('discover.shared') });
    }
  };

  const formatCountdown = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `-${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const totalLikes = songs?.reduce((sum: number, s: any) => sum + (s.likes || 0), 0) || 0;
  const totalPlays = songs?.reduce((sum: number, s: any) => sum + (s.playCount || 0), 0) || 0;
  const gradientKey = genre.toLowerCase().replace(/\s+/g, "-");
  const gradient = GENRE_COLORS[gradientKey] || "from-slate-600 to-slate-900";
  const playlistTitle = isTop100 ? "Top 100" : genre;
  const subtitle = isTop100 ? t('discover.top100Subtitle') : `Top ${limit} · ${genre}`;

  return (
    <div className="h-full overflow-auto">
      <div className={`relative bg-gradient-to-br ${gradient} px-4 md:px-6 py-8`}>
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative max-w-5xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white mb-4"
            onClick={() => setLocation("/discover")}
            data-testid="button-back-discover"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('discover.backToDiscover')}
          </Button>

          <div className="flex items-end gap-5">
            <div className="w-40 h-40 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              {isTop100 ? (
                <Trophy className="h-16 w-16 text-white/80" />
              ) : (
                <Music className="h-16 w-16 text-white/80" />
              )}
            </div>
            <div>
              <Badge variant="secondary" className="mb-2 text-xs" data-testid="badge-playlist-type">
                {t('discover.playlist')}
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-1" data-testid="text-playlist-title">
                {playlistTitle}
              </h1>
              <p className="text-white/60 text-sm mb-3">{subtitle}</p>
              <div className="flex items-center gap-4 text-sm text-white/70">
                <span>{formatCount(totalLikes)} {t('discover.likes')}</span>
                <span>{formatCount(totalPlays)} {t('discover.plays')}</span>
                <span>{songs?.length || 0} {t('discover.tracks')}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <Button
              className="rounded-full px-6"
              onClick={() => songs?.[0] && handlePlay(songs[0])}
              data-testid="button-play-all"
            >
              <Play className="h-4 w-4 mr-2 fill-white" />
              {t('discover.playAll')}
            </Button>
            <div className="flex gap-2 ml-auto">
              <Badge variant="outline" className="text-white/60 border-white/20">
                <CheckCircle className="h-3 w-3 mr-1" />
                {t('discover.badges.noCopyright')}
              </Badge>
              <Badge variant="outline" className="text-white/60 border-white/20">
                <CheckCircle className="h-3 w-3 mr-1" />
                {t('discover.badges.royaltyFree')}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 bg-[#0a0a12]/95 rounded-xl my-2">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-16 bg-[#0d0d18]/80 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !songs?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <Music className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>{t('discover.noSongs')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {songs.map((song: any, idx: number) => {
              const isCurrent = currentSong?.id === song.id;
              return (
                <div
                  key={song.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#12121f]/90 transition-colors group ${isCurrent ? "bg-[#0d0d18]/90" : "bg-[#0d0d18]/60"}`}
                  data-testid={`row-song-${song.id}`}
                >
                  <span className="text-sm font-mono text-muted-foreground w-8 text-right" data-testid={`text-rank-${song.id}`}>
                    {idx + 1}
                  </span>

                  <div
                    className="relative w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 cursor-pointer"
                    onClick={() => handlePlay(song)}
                    data-testid={`button-play-${song.id}`}
                  >
                    {song.imageUrl ? (
                      <img src={song.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {isCurrent && isPlaying ? (
                        <Pause className="h-4 w-4 text-white" />
                      ) : (
                        <Play className="h-4 w-4 text-white fill-white" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-medium truncate ${isCurrent ? "text-primary" : ""}`} data-testid={`text-title-${song.id}`}>
                      {song.title}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {song.artistName || "DA GRABA"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Headphones className="h-3 w-3" />
                    <span data-testid={`text-plays-${song.id}`}>{formatCount(song.playCount || 0)}</span>
                  </div>

                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {formatDuration(song.duration)}
                  </span>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        if (!user) { toast({ title: t('discover.loginToLike') }); return; }
                        apiRequest("POST", `/api/songs/${song.id}/like`, { value: 1 }).then(() =>
                          queryClient.invalidateQueries({ queryKey: [apiUrl] })
                        );
                      }}
                      data-testid={`button-like-${song.id}`}
                    >
                      <Heart className="h-3.5 w-3.5" />
                    </Button>
                    {song.audioUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = song.audioUrl;
                          a.download = `${song.title}.mp3`;
                          a.click();
                        }}
                        data-testid={`button-download-${song.id}`}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                <p className="text-xs text-muted-foreground truncate">{currentSong.artistName || "DA GRABA"}</p>
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
                  max={dur || 1}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="flex-1"
                  data-testid="slider-seek"
                />
                <span className="text-xs text-muted-foreground font-mono w-14 text-right flex-shrink-0" data-testid="text-countdown">
                  {dur > 0 ? formatCountdown(dur - currentTime) : "--:--"}
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
