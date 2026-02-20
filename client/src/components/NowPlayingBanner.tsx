import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Music,
  Copyright,
  User,
  X,
  Heart,
  ThumbsDown,
  Share2,
  Download,
  Globe,
  Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NowPlayingBannerProps {
  song: {
    id: number;
    title: string;
    audioUrl: string | null;
    imageUrl?: string | null;
    genre?: string | null;
    artistName?: string | null;
    copyrightHolder?: string | null;
    lyricsText?: string | null;
    duration?: number | null;
    isPublic?: boolean;
    prompt?: string | null;
    variationLabel?: string | null;
  };
  onClose?: () => void;
  onTogglePublish?: (id: number) => void;
  onDownload?: (id: number, format: string) => void;
}

function parseLyricsLines(text: string): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function NowPlayingBanner({ song, onClose, onTogglePublish, onDownload }: NowPlayingBannerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [showLyrics, setShowLyrics] = useState(true);
  const lyricsRef = useRef<HTMLDivElement>(null);

  const lyricsLines = parseLyricsLines(song.lyricsText || "");
  const hasLyrics = lyricsLines.length > 0;

  const currentLineIndex = duration > 0 && hasLyrics
    ? Math.min(
        Math.floor((currentTime / duration) * lyricsLines.length),
        lyricsLines.length - 1
      )
    : -1;

  useEffect(() => {
    if (!song.audioUrl) return;

    const audio = new Audio();
    audio.preload = "auto";
    audio.src = song.audioUrl;
    audioRef.current = audio;

    const onCanPlay = () => setIsReady(true);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.src = "";
      audioRef.current = null;
    };
  }, [song.audioUrl]);

  useEffect(() => {
    if (lyricsRef.current && currentLineIndex >= 0) {
      const lineEl = lyricsRef.current.children[currentLineIndex] as HTMLElement;
      if (lineEl) {
        lineEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentLineIndex]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.source !== "now-playing-banner") {
        audioRef.current?.pause();
      }
    };
    window.addEventListener("dagraba:audio-exclusive", handler);
    return () => window.removeEventListener("dagraba:audio-exclusive", handler);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      window.dispatchEvent(new CustomEvent("dagraba:audio-exclusive", { detail: { source: "now-playing-banner" } }));
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, []);

  const handleSeek = useCallback(
    (val: number[]) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      audio.currentTime = val[0] * duration;
    },
    [duration]
  );

  const handleVolume = useCallback((val: number[]) => {
    const newVol = val[0];
    setVolume(newVol);
    if (audioRef.current) audioRef.current.volume = newVol;
  }, []);

  const toggleMute = useCallback(() => {
    if (volume > 0) {
      setVolume(0);
      if (audioRef.current) audioRef.current.volume = 0;
    } else {
      setVolume(1);
      if (audioRef.current) audioRef.current.volume = 1;
    }
  }, [volume]);

  const handleLike = () => {
    setLiked(!liked);
    if (disliked) setDisliked(false);
  };

  const handleDislike = () => {
    setDisliked(!disliked);
    if (liked) setLiked(false);
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${song.title} - DA GRABA Studio`, url: shareUrl });
      } catch {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied", description: "Share link copied to clipboard" });
    }
  };

  const handleDownload = (format: string) => {
    if (onDownload) {
      onDownload(song.id, format);
    } else {
      const songTitle = song.variationLabel
        ? `${song.title || song.prompt || "track"} (${song.variationLabel})`
        : (song.title || song.prompt || "track");
      const a = document.createElement("a");
      a.href = `/api/songs/${song.id}/download?format=${format}`;
      a.download = `${songTitle.replace(/\s+/g, "_")}.${format}`;
      a.click();
    }
  };

  const formatTime = (t: number) => {
    if (!t || !isFinite(t)) return "0:00";
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  if (!song.audioUrl) return null;

  const artistDisplay = song.artistName || "Unknown Artist";
  const copyrightDisplay = song.copyrightHolder || "Da Graba LLC";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed right-0 top-0 bottom-0 w-[340px] bg-background border-l border-white/5 flex flex-col z-40 shadow-2xl shadow-black/50"
      data-testid="now-playing-banner"
    >
      <div className="relative">
        <div className="h-[300px] w-full overflow-hidden">
          {song.imageUrl ? (
            <img
              src={song.imageUrl}
              alt={song.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-blue-600/20 flex items-center justify-center">
              <Music className="h-20 w-20 text-primary/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-3 right-3 bg-black/40 text-white"
          data-testid="button-close-banner"
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="absolute bottom-4 left-4 right-4">
          <h3
            className="text-lg font-bold text-white truncate"
            data-testid="text-banner-title"
          >
            {song.title || "Untitled Track"}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-sm text-white/70 flex items-center gap-1"
              data-testid="text-banner-artist"
            >
              <User className="h-3 w-3" />
              {artistDisplay}
            </span>
            {song.genre && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-white/20 text-white/60"
              >
                {song.genre}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-2 space-y-1">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlay}
            disabled={!isReady}
            className="h-8 w-8 rounded-full bg-white/10 text-white flex-shrink-0"
            data-testid="button-banner-play"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </Button>

          <div className="flex-1 min-w-0">
            <Slider
              value={[duration > 0 ? currentTime / duration : 0]}
              max={1}
              step={0.001}
              onValueChange={handleSeek}
              className="w-full"
              data-testid="slider-banner-seek"
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="text-muted-foreground flex-shrink-0"
            data-testid="button-banner-mute"
          >
            {volume === 0 ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground font-mono">
              {formatTime(currentTime)}
            </span>
            <span className="text-[10px] text-muted-foreground/50">/</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              -{formatTime(duration - currentTime)}
            </span>
          </div>

          <Slider
            value={[volume]}
            max={1}
            step={0.01}
            onValueChange={handleVolume}
            className="w-16"
            data-testid="slider-banner-volume"
          />
        </div>
      </div>

      <div className="px-4 py-1 flex items-center justify-between border-t border-white/5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLike}
            className={`h-8 w-8 ${liked ? "text-orange-500" : "text-muted-foreground"}`}
            data-testid="button-banner-like"
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDislike}
            className={`h-8 w-8 ${disliked ? "text-blue-400" : "text-muted-foreground"}`}
            data-testid="button-banner-dislike"
          >
            <ThumbsDown className={`h-4 w-4 ${disliked ? "fill-current" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="h-8 w-8 text-muted-foreground"
            data-testid="button-banner-share"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        <span
          className="text-[10px] text-muted-foreground flex items-center gap-1"
          data-testid="text-banner-copyright"
        >
          <Copyright className="h-3 w-3" />
          {copyrightDisplay}
        </span>
      </div>

      <div className="px-4 py-2 flex items-center gap-2 border-t border-white/5">
        <Button
          variant="outline"
          onClick={() => handleDownload("mp3")}
          className="flex-1 gap-1.5"
          data-testid="button-banner-download"
        >
          <Download className="h-3.5 w-3.5" />
          {t('songMenu.download')}
        </Button>
        {onTogglePublish && (
          <Button
            variant={song.isPublic ? "default" : "outline"}
            onClick={() => onTogglePublish(song.id)}
            className="flex-1 gap-1.5"
            data-testid="button-banner-publish"
          >
            {song.isPublic ? (
              <>
                <Globe className="h-3.5 w-3.5" />
                {t('songMenu.public')}
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" />
                {t('songMenu.private')}
              </>
            )}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-hidden border-t border-white/5">
        {hasLyrics && showLyrics ? (
          <div className="relative h-full">
            <div className="absolute inset-0 pointer-events-none z-10">
              <div className="h-8 bg-gradient-to-b from-background to-transparent" />
            </div>
            <div
              ref={lyricsRef}
              className="h-full overflow-y-auto px-4 py-6 space-y-3 scroll-smooth"
              data-testid="lyrics-sync-container"
            >
              {lyricsLines.map((line, idx) => {
                const isSection = line.startsWith("[") && line.endsWith("]");
                const isActive = idx === currentLineIndex;
                const isPast = idx < currentLineIndex;

                return (
                  <motion.p
                    key={idx}
                    animate={{
                      opacity: isActive ? 1 : isPast ? 0.25 : 0.4,
                      scale: isActive ? 1.05 : 1,
                      y: isActive ? -2 : 0,
                    }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className={`text-center leading-relaxed transition-colors ${
                      isSection
                        ? "text-primary/50 font-semibold text-[10px] uppercase tracking-widest mt-4"
                        : isActive
                          ? "text-white font-bold text-base drop-shadow-[0_0_10px_rgba(0,200,255,0.4)]"
                          : isPast
                            ? "text-white/20 text-sm"
                            : "text-white/40 text-sm"
                    }`}
                    data-testid={`lyrics-line-${idx}`}
                  >
                    {line}
                  </motion.p>
                );
              })}
            </div>
            <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10">
              <div className="h-8 bg-gradient-to-t from-background to-transparent" />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4 h-full">
            <p className="text-sm text-muted-foreground/50 text-center italic">
              {hasLyrics ? t('player.lyrics') : t('player.noLyrics')}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
