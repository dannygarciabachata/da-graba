import { useEffect, useRef, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Download, Volume2, VolumeX, Music } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";

interface AudioPlayerProps {
  url: string | null;
  title: string;
  imageUrl?: string | null;
  genre?: string | null;
}

export function AudioPlayer({ url, title, imageUrl, genre }: AudioPlayerProps) {
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
    }
  };

  const formatTime = (t: number) => {
    if (!t || !isFinite(t)) return "0:00";
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
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
      className="glass-panel rounded-2xl p-4 md:p-6 space-y-4 md:space-y-6"
    >
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
          <div className="flex items-center gap-2 mt-0.5">
            {genre && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10">{genre}</Badge>
            )}
            <p className="text-xs text-muted-foreground">
              {hasError ? "Error loading audio" : isReady ? "Now Playing" : "Loading..."}
            </p>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={handleDownload} className="text-muted-foreground flex-shrink-0" data-testid="button-download-track">
          <Download className="w-5 h-5" />
        </Button>
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
            <span>{formatTime(duration)}</span>
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
    </motion.div>
  );
}
