import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Play,
  Pause,
  Trash2,
  Music,
  ArrowLeft,
  Globe,
  Lock,
  Edit2,
  Plus,
  Volume2,
  VolumeX,
  Loader2,
  Search,
} from "lucide-react";

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `-${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function MyPlaylistDetailPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/my-playlists/:id");
  const playlistId = params?.id ? Number(params.id) : null;

  const [currentSong, setCurrentSong] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSongRef = useRef<any>(null);
  const songsRef = useRef<any[]>([]);

  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPublic, setEditPublic] = useState(false);

  const [showAddSongs, setShowAddSongs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: playlist, isLoading: loadingPlaylist } = useQuery<any>({
    queryKey: ["/api/playlists", playlistId],
    enabled: !!playlistId,
  });

  const { data: songs, isLoading: loadingSongs } = useQuery<any[]>({
    queryKey: ["/api/playlists", playlistId, "songs"],
    enabled: !!playlistId,
  });

  const { data: mySongs } = useQuery<any[]>({
    queryKey: ["/api/songs"],
    enabled: showAddSongs,
  });

  useEffect(() => {
    songsRef.current = songs || [];
  }, [songs]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/playlists/${playlistId}`, {
        name: editName,
        description: editDescription,
        isPublic: editPublic,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists", playlistId] });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setShowEdit(false);
      toast({ title: t("playlists.updated") });
    },
  });

  const removeSongMutation = useMutation({
    mutationFn: async (songId: number) => {
      await apiRequest("DELETE", `/api/playlists/${playlistId}/songs/${songId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists", playlistId, "songs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
    },
  });

  const addSongMutation = useMutation({
    mutationFn: async (songId: number) => {
      await apiRequest("POST", `/api/playlists/${playlistId}/songs`, { songId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists", playlistId, "songs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      toast({ title: t("playlists.songAdded") });
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

  const openEdit = () => {
    if (playlist) {
      setEditName(playlist.name || "");
      setEditDescription(playlist.description || "");
      setEditPublic(playlist.isPublic || false);
      setShowEdit(true);
    }
  };

  const filteredMySongs = mySongs?.filter((s: any) => {
    if (!searchQuery) return s.status === "completed";
    const q = searchQuery.toLowerCase();
    return (
      s.status === "completed" &&
      ((s.title || "").toLowerCase().includes(q) ||
        (s.genre || "").toLowerCase().includes(q))
    );
  });

  const existingSongIds = new Set((songs || []).map((s: any) => s.id));

  if (!user) return null;

  return (
    <div className="h-full overflow-auto pb-20">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6 bg-[#0a0a12]/80 rounded-xl my-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/my-playlists")}
          data-testid="button-back-playlists"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("playlists.backToPlaylists")}
        </Button>

        {loadingPlaylist ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !playlist ? (
          <div className="text-center py-16 text-muted-foreground">
            {t("playlists.notFound")}
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Music className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold" data-testid="text-playlist-detail-name">
                    {playlist.name}
                  </h1>
                  {playlist.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {playlist.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px]">
                      {playlist.isPublic ? (
                        <>
                          <Globe className="h-3 w-3 mr-1" />
                          {t("playlists.public")}
                        </>
                      ) : (
                        <>
                          <Lock className="h-3 w-3 mr-1" />
                          {t("playlists.private")}
                        </>
                      )}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {songs?.length ?? 0} {t("playlists.songs")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={openEdit}
                  data-testid="button-edit-playlist"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setShowAddSongs(true)}
                  data-testid="button-add-songs"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("playlists.addSongs")}
                </Button>
              </div>
            </div>

            {loadingSongs ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 bg-[#0d0d18]/80 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : !songs?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Music className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>{t("playlists.noSongsInPlaylist")}</p>
                <Button
                  className="mt-4"
                  onClick={() => setShowAddSongs(true)}
                  data-testid="button-add-songs-empty"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("playlists.addSongs")}
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {songs.map((song: any, idx: number) => {
                  const isCurrent = currentSong?.id === song.id;
                  return (
                    <div
                      key={song.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#12121f]/90 transition-colors group ${isCurrent ? "bg-[#0d0d18]/90" : "bg-[#0d0d18]/60"}`}
                      data-testid={`row-playlist-song-${song.id}`}
                    >
                      <span className="text-sm font-mono text-muted-foreground w-6 text-right">
                        {idx + 1}
                      </span>
                      <div
                        className="relative w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 cursor-pointer"
                        onClick={() => handlePlay(song)}
                        data-testid={`button-play-song-${song.id}`}
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
                        <h3
                          className={`text-sm font-medium truncate ${isCurrent ? "text-primary" : ""}`}
                          data-testid={`text-song-title-${song.id}`}
                        >
                          {song.title || song.prompt}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {song.artistName || "DGB AUDIO"}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {formatDuration(song.duration)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeSongMutation.mutate(song.id)}
                        data-testid={`button-remove-song-${song.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {currentSong && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-white/10 z-50 px-4 py-2" data-testid="now-playing-bar">
          <div className="max-w-4xl mx-auto">
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
                <p className="text-sm font-medium truncate" data-testid="text-now-playing-title">
                  {currentSong.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentSong.artistName || "DGB AUDIO"}
                </p>
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
                  max={duration || 1}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="flex-1"
                  data-testid="slider-seek"
                />
                <span className="text-xs text-muted-foreground font-mono w-14 text-right flex-shrink-0">
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
            </div>
          </div>
        </div>
      )}

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="bg-[#0d0d18] border-white/[0.06]">
          <DialogHeader>
            <DialogTitle>{t("playlists.editPlaylist")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("playlists.name")}</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                data-testid="input-edit-playlist-name"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("playlists.description")}</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                data-testid="input-edit-playlist-description"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("playlists.makePublic")}</Label>
              <Switch
                checked={editPublic}
                onCheckedChange={setEditPublic}
                data-testid="switch-edit-playlist-public"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEdit(false)} data-testid="button-cancel-edit">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!editName.trim() || updateMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddSongs} onOpenChange={setShowAddSongs}>
        <DialogContent className="bg-[#0d0d18] border-white/[0.06] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("playlists.addSongs")}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("playlists.searchSongs")}
              className="pl-9"
              data-testid="input-search-songs"
            />
          </div>
          <div className="flex-1 overflow-auto space-y-1 min-h-0">
            {!filteredMySongs?.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {t("playlists.noSongsAvailable")}
              </div>
            ) : (
              filteredMySongs.map((song: any) => {
                const alreadyAdded = existingSongIds.has(song.id);
                return (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#0d0d18]/60 hover:bg-[#12121f]/90 transition-colors"
                    data-testid={`row-add-song-${song.id}`}
                  >
                    <div className="w-8 h-8 rounded-md overflow-hidden bg-white/5 flex-shrink-0">
                      {song.imageUrl ? (
                        <img src={song.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{song.title || song.prompt}</p>
                      <p className="text-xs text-muted-foreground truncate">{song.genre}</p>
                    </div>
                    <Button
                      variant={alreadyAdded ? "ghost" : "default"}
                      size="sm"
                      disabled={alreadyAdded || addSongMutation.isPending}
                      onClick={() => addSongMutation.mutate(song.id)}
                      data-testid={`button-add-song-${song.id}`}
                    >
                      {alreadyAdded ? t("playlists.added") : t("playlists.add")}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
