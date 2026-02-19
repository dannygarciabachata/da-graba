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
  Share2,
  Music,
  ArrowLeft,
  Headphones,
  Globe,
  Volume2,
  VolumeX,
  ListMusic,
  Loader2,
} from "lucide-react";

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `-${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function PublicPlaylistViewPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/playlist/:id");
  const playlistId = params?.id ? Number(params.id) : null;

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

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/public/user-playlists", playlistId],
    enabled: !!playlistId,
  });

  const playlist = data;
  const songs: any[] = data?.songs || [];

  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  const fetchLikeStatus = useCallback(async (songId: number) => {
    try {
      const res = await fetch(`/api/songs/${songId}/likes`);
      if (res.ok) {
        const data = await res.json();
        setLikeStatus(data);
      }
    } catch {}
  }, []);

  const playMutation = useMutation({
    mutationFn: async (songId: number) => {
      await apiRequest("POST", `/api/songs/${songId}/play`, {});
    },
  });

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

  const handleLike = async () => {
    if (!user) { toast({ title: t("discover.loginToLike") }); return; }
    if (!currentSong) return;
    await apiRequest("POST", `/api/songs/${currentSong.id}/like`, { value: 1 });
    fetchLikeStatus(currentSong.id);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/playlist/${playlistId}`;
    const text = playlist?.name || "Playlist";
    if (navigator.share) {
      navigator.share({ title: text, url });
    } else {
      navigator.clipboard.writeText(`${text} ${url}`);
      toast({ title: t("discover.shared") });
    }
  };

  const totalPlays = songs.reduce((sum: number, s: any) => sum + (s.playCount || 0), 0);

  return (
    <div className="h-full overflow-auto">
      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !playlist ? (
        <div className="text-center py-24 text-muted-foreground">
          <Music className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>{t("playlists.notFound")}</p>
        </div>
      ) : (
        <>
          <div className="relative bg-gradient-to-br from-primary/40 to-blue-900/60 px-4 md:px-6 py-8">
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
                {t("discover.backToDiscover")}
              </Button>

              <div className="flex items-end gap-5">
                <div className="w-40 h-40 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <ListMusic className="h-16 w-16 text-white/80" />
                </div>
                <div>
                  <Badge variant="secondary" className="mb-2 text-xs" data-testid="badge-playlist-type">
                    <Globe className="h-3 w-3 mr-1" />
                    {t("playlists.publicPlaylist")}
                  </Badge>
                  <h1 className="text-3xl md:text-4xl font-bold text-white mb-1" data-testid="text-public-playlist-title">
                    {playlist.name}
                  </h1>
                  {playlist.description && (
                    <p className="text-white/60 text-sm mb-2">{playlist.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-white/70">
                    <span>{songs.length} {t("playlists.songs")}</span>
                    <span>{formatCount(totalPlays)} {t("discover.plays")}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <Button
                  className="rounded-full px-6"
                  onClick={() => songs[0] && handlePlay(songs[0])}
                  data-testid="button-play-all"
                >
                  <Play className="h-4 w-4 mr-2 fill-white" />
                  {t("discover.playAll")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/70"
                  onClick={handleShare}
                  data-testid="button-share-playlist"
                >
                  <Share2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 bg-[#0a0a12]/80 rounded-xl my-2">
            {!songs.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <Music className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>{t("playlists.noSongsInPlaylist")}</p>
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
                      <span className="text-sm font-mono text-muted-foreground w-8 text-right">
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
                        <h3 className={`text-sm font-medium truncate ${isCurrent ? "text-primary" : ""}`}>
                          {song.title}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {song.artistName || "DA GRABA"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Headphones className="h-3 w-3" />
                        <span>{formatCount(song.playCount || 0)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {formatDuration(song.duration)}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (!user) { toast({ title: t("discover.loginToLike") }); return; }
                            apiRequest("POST", `/api/songs/${song.id}/like`, { value: 1 });
                          }}
                          data-testid={`button-like-${song.id}`}
                        >
                          <Heart className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

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
                <span className="text-xs text-muted-foreground font-mono w-14 text-right flex-shrink-0">
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
                  onClick={toggleMute}
                  data-testid="button-volume-toggle"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                {showVolume && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-background/95 border border-white/10 rounded-lg p-2 w-8 h-24">
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
                  className={`${likeStatus.userValue === 1 ? "text-primary" : ""}`}
                  onClick={handleLike}
                  data-testid="button-footer-like"
                >
                  <Heart className={`h-4 w-4 ${likeStatus.userValue === 1 ? "fill-primary" : ""}`} />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[1.5rem]">
                  {formatCount(likeStatus.likes || 0)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
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
