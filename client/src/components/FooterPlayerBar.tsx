import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Scissors, Music, Repeat, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface FooterPlayerBarProps {
  url: string;
  title: string;
  imageUrl?: string | null;
  genre?: string | null;
  onOpenStudio?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onShuffle?: () => void;
  onRepeat?: () => void;
  isShuffled?: boolean;
  isRepeating?: boolean;
}

export function FooterPlayerBar({
  url,
  title,
  imageUrl,
  genre,
  onOpenStudio,
  onNext,
  onPrev,
  onShuffle,
  onRepeat,
  isShuffled,
  isRepeating,
}: FooterPlayerBarProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  useEffect(() => {
    if (!url) return;

    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    const onCanPlay = () => setIsReady(true);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      if (onNextRef.current) onNextRef.current();
    };

    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    audio.volume = volume;
    audio.src = url;
    audio.load();

    return () => {
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.src = "";
      audio.removeAttribute("src");
    };
  }, [url]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !isReady) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
  }, [isPlaying, isReady]);

  const handleSeek = useCallback((val: number[]) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const seekTime = val[0] * duration;
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  }, [duration]);

  const handleVolume = useCallback((val: number[]) => {
    const v = val[0];
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
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

  const formatTime = (t: number) => {
    if (!t || !isFinite(t)) return "0:00";
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="h-[72px] bg-[#0a0a0a] border-t border-white/10 flex items-center px-3 gap-3" data-testid="footer-player-bar">
      <div className="flex items-center gap-3 w-[240px] min-w-0 flex-shrink-0">
        <div className="w-12 h-12 rounded-md bg-white/5 flex-shrink-0 flex items-center justify-center overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
          ) : (
            <Music className="w-5 h-5 text-primary/40" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate" data-testid="footer-player-title">{title}</p>
          {genre && (
            <p className="text-[11px] text-muted-foreground truncate">{genre}</p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center gap-1 max-w-[600px] mx-auto">
        <div className="flex items-center gap-2">
          {onShuffle && (
            <Button variant="ghost" size="icon" onClick={onShuffle} className={isShuffled ? 'text-primary' : 'text-muted-foreground'} data-testid="button-shuffle">
              <Shuffle className="w-3.5 h-3.5" />
            </Button>
          )}
          {onPrev && (
            <Button variant="ghost" size="icon" onClick={onPrev} className="text-muted-foreground" data-testid="button-prev">
              <SkipBack className="w-4 h-4" />
            </Button>
          )}
          <Button
            size="icon"
            onClick={togglePlay}
            disabled={!isReady}
            className="rounded-full bg-white text-black"
            data-testid="button-footer-play"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </Button>
          {onNext && (
            <Button variant="ghost" size="icon" onClick={onNext} className="text-muted-foreground" data-testid="button-next">
              <SkipForward className="w-4 h-4" />
            </Button>
          )}
          {onRepeat && (
            <Button variant="ghost" size="icon" onClick={onRepeat} className={isRepeating ? 'text-primary' : 'text-muted-foreground'} data-testid="button-repeat">
              <Repeat className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full">
          <span className="text-[10px] text-muted-foreground w-8 text-right tabular-nums">{formatTime(currentTime)}</span>
          <Slider
            value={[progress]}
            max={1}
            step={0.001}
            onValueChange={handleSeek}
            className="flex-1"
            data-testid="slider-footer-seek"
          />
          <span className="text-[10px] text-muted-foreground w-8 tabular-nums">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 w-[200px] justify-end flex-shrink-0">
        {onOpenStudio && (
          <Button variant="ghost" size="icon" onClick={onOpenStudio} className="text-muted-foreground" data-testid="button-footer-studio">
            <Scissors className="w-4 h-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={toggleMute} className="text-muted-foreground" data-testid="button-footer-mute">
          {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
        <Slider
          value={[volume]}
          max={1}
          step={0.01}
          onValueChange={handleVolume}
          className="w-20"
          data-testid="slider-footer-volume"
        />
      </div>
    </div>
  );
}
