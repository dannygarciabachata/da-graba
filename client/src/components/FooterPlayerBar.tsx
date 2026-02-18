import { usePlayer } from "@/contexts/PlayerContext";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Scissors, Music, Repeat, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useEffect, useRef } from "react";

interface FooterPlayerBarProps {
  onOpenStudio?: () => void;
}

export function FooterPlayerBar({ onOpenStudio }: FooterPlayerBarProps) {
  const {
    state,
    analyserNode,
    togglePlayPause,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!state.isPlaying || !analyserNode || !canvasRef.current) {
      cancelAnimationFrame(rafRef.current);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyserNode.getByteFrequencyData(dataArray);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const barCount = 16;
      const gap = 1;
      const barW = Math.max(1, (w - gap * (barCount - 1)) / barCount);
      const step = Math.max(1, Math.floor(dataArray.length / barCount));
      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i * step] / 255;
        const barH = Math.max(1, val * h * 0.85);
        const x = i * (barW + gap);
        ctx.fillStyle = `hsl(330, 100%, ${55 + val * 20}%)`;
        ctx.fillRect(x, h - barH, barW, barH);
      }
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [state.isPlaying, analyserNode]);

  const formatTime = (t: number) => {
    if (!t || !isFinite(t)) return "0:00";
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = state.duration > 0 ? state.currentTime / state.duration : 0;

  if (!state.currentSong) return null;

  return (
    <div
      className="h-[72px] bg-[#0a0a0a]/95 backdrop-blur-lg border-t border-white/10 flex items-center px-3 gap-3"
      data-testid="footer-player-bar"
    >
      <div className="flex items-center gap-3 w-[240px] min-w-0 flex-shrink-0">
        <div className="relative w-12 h-12 rounded-md bg-white/5 flex-shrink-0 flex items-center justify-center overflow-hidden">
          {state.currentSong.imageUrl ? (
            <img src={state.currentSong.imageUrl} alt={state.currentSong.title} className="w-full h-full object-cover" />
          ) : (
            <Music className="w-5 h-5 text-primary/40" />
          )}
          {state.isPlaying && (
            <div className="absolute inset-0 bg-black/40 flex items-end justify-center pb-1">
              <canvas ref={canvasRef} width={40} height={24} className="w-[80%] h-[50%]" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate" data-testid="footer-player-title">{state.currentSong.title || state.currentSong.prompt || "Untitled"}</p>
          {state.currentSong.genre && (
            <p className="text-[11px] text-muted-foreground truncate">{state.currentSong.genre}</p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center gap-1 max-w-[600px] mx-auto">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleShuffle}
            className={state.isShuffled ? "text-primary" : "text-muted-foreground"}
            data-testid="button-shuffle"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={prev} className="text-muted-foreground" data-testid="button-prev">
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            onClick={togglePlayPause}
            disabled={!state.isReady}
            className="rounded-full bg-white text-black"
            data-testid="button-footer-play"
          >
            {state.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={next} className="text-muted-foreground" data-testid="button-next">
            <SkipForward className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleRepeat}
            className={state.isRepeating ? "text-primary" : "text-muted-foreground"}
            data-testid="button-repeat"
          >
            <Repeat className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full">
          <span className="text-[10px] text-muted-foreground w-8 text-right tabular-nums">{formatTime(state.currentTime)}</span>
          <Slider
            value={[progress]}
            max={1}
            step={0.001}
            onValueChange={(val) => seek(val[0])}
            className="flex-1"
            data-testid="slider-footer-seek"
          />
          <span className="text-[10px] text-muted-foreground w-8 tabular-nums">{formatTime(state.duration)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 w-[200px] justify-end flex-shrink-0">
        {onOpenStudio && (
          <Button variant="ghost" size="icon" onClick={onOpenStudio} className="text-muted-foreground" data-testid="button-footer-studio">
            <Scissors className="w-4 h-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={toggleMute} className="text-muted-foreground" data-testid="button-footer-mute">
          {state.volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
        <Slider
          value={[state.volume]}
          max={1}
          step={0.01}
          onValueChange={(val) => setVolume(val[0])}
          className="w-20"
          data-testid="slider-footer-volume"
        />
      </div>
    </div>
  );
}
