import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Music,
  ChevronUp,
  ChevronDown,
  Copyright,
  User,
  X,
  FileText,
} from "lucide-react";

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
  };
  onClose?: () => void;
}

function parseLyricsLines(text: string): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function NowPlayingBanner({ song, onClose }: NowPlayingBannerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isReady, setIsReady] = useState(false);
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

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, []);

  const handleVolume = useCallback((val: number[]) => {
    const newVol = val[0];
    setVolume(newVol);
    if (audioRef.current) audioRef.current.volume = newVol;
  }, []);

  const handleSeek = useCallback(
    (val: number[]) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      audio.currentTime = val[0] * duration;
    },
    [duration]
  );

  const formatTime = (t: number) => {
    if (!t || !isFinite(t)) return "0:00";
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  if (!song.audioUrl) return null;

  const artistDisplay = song.artistName || "Unknown Artist";
  const copyrightDisplay = song.copyrightHolder || "DGB Studio";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed right-0 top-0 bottom-0 w-[340px] bg-[#0d0d0d] border-l border-white/5 flex flex-col z-40 shadow-2xl shadow-black/50"
      data-testid="now-playing-banner"
    >
      <div className="relative">
        <div className="h-[340px] w-full overflow-hidden">
          {song.imageUrl ? (
            <img
              src={song.imageUrl}
              alt={song.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center">
              <Music className="h-20 w-20 text-primary/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-transparent to-transparent" />
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

      <div className="px-4 py-3 space-y-3">
        <Slider
          value={[duration > 0 ? currentTime / duration : 0]}
          max={1}
          step={0.001}
          onValueChange={handleSeek}
          className="w-full"
          data-testid="slider-banner-seek"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (volume > 0) {
                setVolume(0);
                if (audioRef.current) audioRef.current.volume = 0;
              } else {
                setVolume(1);
                if (audioRef.current) audioRef.current.volume = 1;
              }
            }}
            className="text-muted-foreground"
            data-testid="button-banner-mute"
          >
            {volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>

          <Button
            size="icon"
            onClick={togglePlay}
            disabled={!isReady}
            className="h-12 w-12 rounded-full bg-white text-black shadow-lg shadow-white/10"
            data-testid="button-banner-play"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </Button>

          <Slider
            value={[volume]}
            max={1}
            step={0.01}
            onValueChange={handleVolume}
            className="w-20"
            data-testid="slider-banner-volume"
          />
        </div>
      </div>

      <div className="px-4 py-2 border-t border-white/5">
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] text-muted-foreground flex items-center gap-1"
            data-testid="text-banner-copyright"
          >
            <Copyright className="h-3 w-3" />
            {copyrightDisplay}
          </span>
          {hasLyrics && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLyrics(!showLyrics)}
              className="text-xs text-muted-foreground gap-1"
              data-testid="button-toggle-lyrics"
            >
              <FileText className="h-3 w-3" />
              Lyrics
              {showLyrics ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showLyrics && hasLyrics && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-1 overflow-hidden border-t border-white/5"
          >
            <div
              ref={lyricsRef}
              className="p-4 overflow-y-auto max-h-[300px] space-y-2"
              data-testid="lyrics-sync-container"
            >
              {lyricsLines.map((line, idx) => {
                const isSection = line.startsWith("[") && line.endsWith("]");
                const isActive = idx === currentLineIndex;

                return (
                  <motion.p
                    key={idx}
                    animate={{
                      opacity: isActive ? 1 : 0.4,
                      scale: isActive ? 1.02 : 1,
                    }}
                    transition={{ duration: 0.3 }}
                    className={`text-sm leading-relaxed transition-colors ${
                      isSection
                        ? "text-primary/60 font-semibold text-xs uppercase mt-3"
                        : isActive
                          ? "text-white font-medium"
                          : "text-white/40"
                    }`}
                    data-testid={`lyrics-line-${idx}`}
                  >
                    {line}
                  </motion.p>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!hasLyrics && (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground/50 text-center italic">
            No lyrics available for this track
          </p>
        </div>
      )}
    </motion.div>
  );
}
