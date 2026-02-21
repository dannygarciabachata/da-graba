import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Music,
  Heart,
  Share2,
  Download,
  Globe,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToggleSongLike } from "@/hooks/use-songs";
import { type PlayerSong } from "@/contexts/PlayerContext";
import { AudioSpectrum } from "@/components/AudioSpectrum";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface HistoryNowPlayingProps {
  song: PlayerSong;
  isPlaying: boolean;
}

export function HistoryNowPlaying({ song, isPlaying }: HistoryNowPlayingProps) {
  const { t } = useTranslation();
  const likeData = { likes: (song as any).likes || 0, dislikes: 0, userValue: (song as any).userLikeValue || 0 };
  const likeMutation = useToggleSongLike();
  const { toast } = useToast();
  const [showLyrics, setShowLyrics] = useState(false);
  const [isPublic, setIsPublic] = useState(song.isPublic ?? false);

  useEffect(() => {
    setIsPublic(song.isPublic ?? false);
  }, [song.id, song.isPublic]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/songs/${song.id}/publish`);
      return res.json();
    },
    onSuccess: (data: any) => {
      setIsPublic(data.isPublic);
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      toast({ title: data.isPublic ? t('create.published', 'Publicada') : t('create.unpublished', 'Despublicada') });
    },
  });

  const handlePublish = (e: React.MouseEvent) => {
    e.stopPropagation();
    publishMutation.mutate();
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = likeData.userValue === 1 ? -1 : 1;
    likeMutation.mutate({ songId: song.id, value: newValue as 1 | -1 });
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/discover?song=${song.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: t('create.linkCopied', 'Enlace copiado') });
    } catch {
      toast({ title: url, description: t('create.copyManually', 'Copia el enlace manualmente') });
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = song.audioUrl;
    a.download = `${song.title || "song"}.mp3`;
    a.click();
  };

  return (
    <div className="p-3 border-b border-white/5" data-testid="history-now-playing">
      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-white/5 mb-3">
        {song.imageUrl ? (
          <img src={song.imageUrl} alt={song.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-orange-500/20">
            <Music className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
        {isPlaying && (
          <div className="absolute bottom-2 left-2 right-2">
            <AudioSpectrum songId={song.id} />
          </div>
        )}
        {song.genre && (
          <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] bg-black/60 backdrop-blur-sm border-0">
            {song.genre}
          </Badge>
        )}
        {song.variationLabel && (
          <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] bg-black/60 backdrop-blur-sm border-0">
            {song.variationLabel}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-bold truncate" data-testid="text-now-playing-title">
            {song.title || song.prompt || t('create.untitledTrack')}
          </h3>
          <p className="text-xs text-muted-foreground truncate" data-testid="text-now-playing-artist">
            {song.artistName || song.copyrightHolder || "DA GRABA Studio"}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLike}
                className={cn(likeData.userValue === 1 && "text-primary")}
                data-testid="button-like-song"
              >
                <Heart className={cn("h-4 w-4", likeData.userValue === 1 && "fill-current")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('create.like', 'Me gusta')}{likeData.likes ? ` (${likeData.likes})` : ""}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleShare} data-testid="button-share-song">
                <Share2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('create.share', 'Compartir')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleDownload} data-testid="button-download-song">
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('create.download', 'Descargar')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePublish}
                className={cn(isPublic && "text-green-400")}
                data-testid="button-publish-song"
              >
                <Globe className={cn("h-4 w-4", isPublic && "fill-current")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isPublic ? t('create.unpublish', 'Despublicar') : t('create.publish', 'Publicar')}</TooltipContent>
          </Tooltip>

          {song.lyricsText && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); setShowLyrics(!showLyrics); }}
                  className={cn(showLyrics && "text-primary")}
                  data-testid="button-toggle-lyrics"
                >
                  <MessageSquare className={cn("h-4 w-4", showLyrics && "fill-current")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('create.lyrics', 'Letra')}</TooltipContent>
            </Tooltip>
          )}
        </div>

        <AnimatePresence>
          {showLyrics && song.lyricsText && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white/[0.03] rounded-lg p-3 max-h-40 overflow-y-auto">
                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed" data-testid="text-lyrics">
                  {song.lyricsText}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
