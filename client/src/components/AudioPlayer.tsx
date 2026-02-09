import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Download, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";

interface AudioPlayerProps {
  url: string | null;
  title: string;
}

export function AudioPlayer({ url, title }: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !url) return;

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

    wavesurfer.current.on('ready', () => setIsReady(true));
    wavesurfer.current.on('play', () => setIsPlaying(true));
    wavesurfer.current.on('pause', () => setIsPlaying(false));
    wavesurfer.current.on('finish', () => setIsPlaying(false));

    return () => {
      wavesurfer.current?.destroy();
    };
  }, [url]);

  const togglePlay = () => wavesurfer.current?.playPause();

  const handleVolume = (val: number[]) => {
    const newVol = val[0];
    setVolume(newVol);
    wavesurfer.current?.setVolume(newVol);
  };

  const toggleMute = () => {
    if (volume > 0) {
      setVolume(0);
      wavesurfer.current?.setVolume(0);
    } else {
      setVolume(1);
      wavesurfer.current?.setVolume(1);
    }
  };

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
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base md:text-xl font-bold truncate">{title}</h3>
          <p className="text-xs md:text-sm text-primary">Now Playing</p>
        </div>
        <Button size="icon" variant="ghost" onClick={handleDownload} className="text-muted-foreground flex-shrink-0" data-testid="button-download-track">
          <Download className="w-5 h-5" />
        </Button>
      </div>

      <div ref={containerRef} className="w-full opacity-0 transition-opacity duration-500" style={{ opacity: isReady ? 1 : 0 }} />
      {!isReady && (
        <div className="h-[80px] w-full flex items-center justify-center bg-black/20 rounded-lg">
          <span className="text-xs text-muted-foreground animate-pulse">Loading waveform...</span>
        </div>
      )}

      <div className="flex items-center gap-4 md:gap-6">
        <Button 
          size="icon" 
          onClick={togglePlay}
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
