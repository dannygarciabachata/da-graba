import { useEffect, useRef, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Download, Volume2, VolumeX, Music, Share2, Globe, Lock, Scissors, Copy, Check, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface AudioPlayerProps {
  url: string | null;
  title: string;
  imageUrl?: string | null;
  genre?: string | null;
  duration?: number | null;
  createdAt?: string | null;
  isPublic?: boolean;
  onTogglePublic?: () => void;
  onOpenStudio?: () => void;
}

export function AudioPlayer({ url, title, imageUrl, genre, duration: songDuration, createdAt, isPublic, onTogglePublic, onOpenStudio }: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [waveformReady, setWaveformReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (!url) return;

    setIsReady(false);
    setWaveformReady(false);
    setHasError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const onCanPlay = () => setIsReady(true);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
      if (wavesurfer.current && audio.duration > 0) {
        const progress = audio.currentTime / audio.duration;
        wavesurfer.current.seekTo(progress);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    let retryCount = 0;
    const onError = () => {
      const err = audio.error;
      console.error("[AudioPlayer] HTML Audio error:", err?.code, err?.message, "url:", url);
      if (retryCount < 2) {
        retryCount++;
        console.log(`[AudioPlayer] Retrying load (${retryCount}/2)...`);
        setTimeout(() => {
          audio.src = url + (url.includes("?") ? "&" : "?") + "retry=" + retryCount;
          audio.load();
        }, 1000 * retryCount);
      } else {
        setHasError(true);
      }
    };

    audio.src = url;

    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    if (containerRef.current) {
      try {
        wavesurfer.current = WaveSurfer.create({
          container: containerRef.current,
          waveColor: '#333',
          progressColor: '#00F3FF',
          cursorColor: '#FFFFFF',
          barWidth: 2,
          barGap: 3,
          height: 80,
          normalize: true,
          url: url,
        });

        wavesurfer.current.on('ready', () => setWaveformReady(true));
        wavesurfer.current.on('interaction', (newTime: number) => {
          audio.currentTime = newTime;
        });
        wavesurfer.current.on('error', (err) => {
          console.warn("[AudioPlayer] WaveSurfer error (fallback to basic player):", err);
        });
      } catch (err) {
        console.warn("[AudioPlayer] WaveSurfer init failed, using basic player:", err);
      }
    }

    return () => {
      audio.pause();
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.src = "";
      audioRef.current = null;
      wavesurfer.current?.destroy();
      wavesurfer.current = null;
    };
  }, [url]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch((err) => {
        console.error("[AudioPlayer] Play failed:", err);
      });
    } else {
      audio.pause();
    }
  }, []);

  const handleVolume = useCallback((val: number[]) => {
    const newVol = val[0];
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
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

  const handleSeek = useCallback((val: number[]) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const seekTime = val[0] * duration;
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  }, [duration]);

  const handleDownload = () => {
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Download started", description: `${title}.mp3` });
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${title} - ${t('common.brandName')}`, url: shareUrl });
      } catch {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Link copied", description: "Share link copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    if (url) {
      const fullUrl = window.location.origin + url;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast({ title: "Audio link copied", description: "Direct audio link copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (t: number) => {
    if (!t || !isFinite(t)) return "0:00";
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (!url) {
    return (
      <div className="glass-panel rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center h-[180px] md:h-[300px] text-muted-foreground border-dashed border-2 border-white/5">
        <div className="p-3 md:p-4 bg-white/5 rounded-full mb-3 md:mb-4 animate-pulse">
          <Play className="w-6 h-6 md:w-8 md:h-8 opacity-50" />
        </div>
        <p className="text-sm md:text-base text-center">Select or generate a track to play</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-panel rounded-2xl overflow-hidden"
    >
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-start gap-3 md:gap-4">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg bg-primary/10 flex-shrink-0 flex items-center justify-center overflow-hidden">
            {imageUrl ? (
              <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
            ) : (
              <Music className="w-6 h-6 text-primary/50" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base md:text-lg font-bold truncate">{title}</h3>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              {genre && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10">{genre}</Badge>
              )}
              <p className="text-xs text-muted-foreground">
                {hasError ? "Error loading audio" : isReady ? (isPlaying ? "Now Playing" : "Ready") : "Loading..."}
              </p>
            </div>
          </div>
        </div>

        <div
          ref={containerRef}
          className="w-full transition-opacity duration-500"
          style={{ opacity: waveformReady ? 1 : 0, height: waveformReady ? 'auto' : 0 }}
        />
        {!waveformReady && !hasError && (
          <div className="w-full space-y-2">
            <Slider
              value={[duration > 0 ? currentTime / duration : 0]}
              max={1}
              step={0.001}
              onValueChange={handleSeek}
              className="w-full"
              data-testid="slider-seek"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>-{formatTime(duration - currentTime)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 md:gap-6">
          <Button 
            size="icon" 
            onClick={togglePlay}
            disabled={hasError || !isReady}
            className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-white text-black shadow-lg shadow-white/10"
            data-testid="button-play-pause"
          >
            {isPlaying ? <Pause className="w-5 h-5 md:w-6 md:h-6 fill-current" /> : <Play className="w-5 h-5 md:w-6 md:h-6 fill-current ml-0.5" />}
          </Button>

          <div className="flex-1 flex items-center gap-2 md:gap-3">
            <Button variant="ghost" size="icon" onClick={toggleMute} className="text-muted-foreground flex-shrink-0" data-testid="button-mute">
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Slider 
              value={[volume]} 
              max={1} 
              step={0.01} 
              onValueChange={handleVolume}
              className="flex-1 max-w-[150px]" 
            />
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {createdAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(createdAt)}
              </span>
            )}
            {(songDuration || duration > 0) && (
              <span className="ml-2">{formatTime(songDuration || duration)}</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleDownload} className="text-muted-foreground gap-1.5" data-testid="button-download-track">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={handleShare} className="text-muted-foreground gap-1.5" data-testid="button-share-track">
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={handleCopyLink} className="text-muted-foreground gap-1.5" data-testid="button-copy-link">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? "Copied" : "Copy Link"}</span>
            </Button>

            {onTogglePublic !== undefined && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onTogglePublic} 
                className={`gap-1.5 ${isPublic ? "text-green-400" : "text-muted-foreground"}`}
                data-testid="button-publish-track"
              >
                {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                <span className="hidden sm:inline">{isPublic ? "Public" : "Publish"}</span>
              </Button>
            )}

            {onOpenStudio && (
              <Button variant="ghost" size="sm" onClick={onOpenStudio} className="text-primary gap-1.5" data-testid="button-open-studio">
                <Scissors className="w-4 h-4" />
                <span className="hidden sm:inline">Studio</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
