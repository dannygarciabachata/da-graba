import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Play,
  Pause,
  Heart,
  UserPlus,
  UserCheck,
  Users,
  Music,
  Headphones,
  ArrowLeft,
  CheckCircle,
  Crown,
  Globe,
  MapPin,
  Share2,
} from "lucide-react";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ArtistProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/artist/:id");
  const artistId = Number(params?.id);

  const [currentSong, setCurrentSong] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useState<HTMLAudioElement | null>(null);

  const { data: artist, isLoading } = useQuery<any>({
    queryKey: [`/api/public/artists/${artistId}`],
    enabled: !!artistId,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/artists/${artistId}/follow`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/public/artists/${artistId}`] });
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/artists/${artistId}/subscribe`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/public/artists/${artistId}`] });
      toast({ title: t('artist.profile.subscribed') });
    },
  });

  const handlePlay = (song: any) => {
    if (!song.audioUrl) return;
    if (currentSong?.id === song.id) {
      if (isPlaying) {
        audioRef[0]?.pause();
        setIsPlaying(false);
      } else {
        audioRef[0]?.play();
        setIsPlaying(true);
      }
      return;
    }
    if (audioRef[0]) {
      audioRef[0].pause();
    }
    const audio = new Audio(song.audioUrl);
    audio.play();
    audioRef[1](audio);
    setCurrentSong(song);
    setIsPlaying(true);
    audio.addEventListener("ended", () => setIsPlaying(false));
  };

  if (isLoading) {
    return (
      <div className="h-full overflow-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          <div className="h-48 bg-white/[0.03] rounded-xl animate-pulse" />
          <div className="h-32 bg-white/[0.03] rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="h-full overflow-auto flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Music className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>{t('artist.profile.notFound')}</p>
          <Button variant="ghost" onClick={() => setLocation("/discover")} className="mt-3">
            <ArrowLeft className="h-4 w-4 mr-1" /> {t('discover.backToDiscover')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="relative h-48 bg-gradient-to-br from-primary/30 to-purple-600/30 overflow-hidden">
        {artist.bannerUrl && (
          <img src={artist.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="sm" className="text-white/70 hover:text-white" onClick={() => setLocation("/discover")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('discover.backToDiscover')}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 -mt-16 relative z-10">
        <div className="flex items-end gap-5 mb-6">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary to-purple-600 border-4 border-background flex items-center justify-center overflow-hidden flex-shrink-0">
            {artist.avatarUrl ? (
              <img src={artist.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Music className="h-12 w-12 text-white" />
            )}
          </div>
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold" data-testid="text-artist-name">{artist.artistName}</h1>
              {artist.isVerified && <CheckCircle className="h-5 w-5 text-primary" />}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {artist.genre && <Badge variant="outline" className="text-xs">{artist.genre}</Badge>}
              {artist.country && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {artist.country}
                </span>
              )}
              {artist.proEntity && artist.proEntity !== "none" && (
                <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">
                  {artist.proEntity.toUpperCase()}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-4 text-sm text-muted-foreground mr-auto">
            <span data-testid="text-follower-count"><strong className="text-foreground">{formatCount(artist.followerCount || 0)}</strong> {t('artist.profile.followers')}</span>
            <span data-testid="text-subscriber-count"><strong className="text-foreground">{formatCount(artist.subscriberCount || 0)}</strong> {t('artist.profile.subscribers')}</span>
            <span><strong className="text-foreground">{artist.songs?.length || 0}</strong> {t('artist.profile.songs')}</span>
          </div>

          {user && (
            <>
              <Button
                variant={artist.isFollowing ? "secondary" : "outline"}
                size="sm"
                onClick={() => followMutation.mutate()}
                disabled={followMutation.isPending}
                data-testid="button-follow"
              >
                {artist.isFollowing ? <UserCheck className="h-4 w-4 mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
                {artist.isFollowing ? t('artist.profile.following') : t('artist.profile.follow')}
              </Button>
              {!artist.isSubscribed ? (
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-primary to-purple-600"
                  onClick={() => subscribeMutation.mutate()}
                  disabled={subscribeMutation.isPending}
                  data-testid="button-subscribe"
                >
                  <Crown className="h-4 w-4 mr-1" />
                  {t('artist.profile.subscribe')} · ${((artist.monthlySubscriptionPrice || 299) / 100).toFixed(2)}/mo
                </Button>
              ) : (
                <Badge className="bg-primary/20 text-primary">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {t('artist.profile.subscribedBadge')}
                </Badge>
              )}
            </>
          )}
        </div>

        {artist.bio && (
          <p className="text-sm text-muted-foreground mb-6 max-w-2xl">{artist.bio}</p>
        )}

        <div className="mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3" data-testid="text-songs-title">
            <Music className="h-5 w-5 text-primary" />
            {t('artist.profile.discography')}
          </h2>
        </div>

        {artist.songs?.length > 0 ? (
          <div className="space-y-1 mb-8">
            {artist.songs.map((song: any, idx: number) => {
              const isCurrent = currentSong?.id === song.id;
              return (
                <div
                  key={song.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors group ${isCurrent ? "bg-white/[0.06]" : ""}`}
                  data-testid={`row-song-${song.id}`}
                >
                  <span className="text-sm font-mono text-muted-foreground w-6 text-right">{idx + 1}</span>
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
                      {isCurrent && isPlaying ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white fill-white" />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-medium truncate ${isCurrent ? "text-primary" : ""}`}>{song.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{song.genre || "---"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Headphones className="h-3 w-3" />
                    {formatCount(song.playCount || 0)}
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">{formatDuration(song.duration)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Music className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t('artist.profile.noSongs')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
