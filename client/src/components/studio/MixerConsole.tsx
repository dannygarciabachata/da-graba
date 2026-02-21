import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Volume2, VolumeX, Headphones } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { STEM_COLORS } from "./constants";
import { VUMeter } from "./VUMeter";
import type { Track } from "@shared/schema";
import type { useAudioEngine } from "@/hooks/use-audio-engine";

interface MixerConsoleProps {
  tracks: Track[];
  engine: ReturnType<typeof useAudioEngine>;
  activeTrackId: number | null;
  onSelectTrack: (id: number) => void;
  onUpdateTrack: (data: { id: number; volume?: number; isMuted?: boolean; isSolo?: boolean }) => void;
  onClose: () => void;
}

export function MixerConsole({ tracks, engine, activeTrackId, onSelectTrack, onUpdateTrack, onClose }: MixerConsoleProps) {
  return (
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: 240 }}
      exit={{ height: 0 }}
      className="border-t border-white/[0.08] bg-[#0a0a0a] overflow-hidden"
      data-testid="mixer-console"
    >
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-3 py-1 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Headphones className="w-3.5 h-3.5 text-[#ff751f]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">Mixer Console</span>
          </div>
          <Button size="icon" variant="ghost" className="w-6 h-6 rounded-md text-zinc-500" onClick={onClose} data-testid="button-hide-mixer">
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
        </div>
        <ScrollArea className="flex-1" data-testid="mixer-scroll">
          <div className="flex gap-0 p-2 h-full">
            {tracks.map((track) => {
              const color = STEM_COLORS[track.type] || "#A78BFA";
              const trackId = track.id;
              const engineTrack = engine.tracks.get(trackId);
              const vol = engineTrack?.volume ?? (track.volume ?? 100) / 100;
              const isActive = trackId === activeTrackId;

              return (
                <div
                  key={trackId}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 border-r border-white/[0.04] last:border-r-0 cursor-pointer transition-all rounded-md",
                    isActive ? "bg-white/[0.03] ring-1 ring-white/[0.08]" : "hover:bg-white/[0.02]"
                  )}
                  style={{ minWidth: 80 }}
                  onClick={() => onSelectTrack(trackId)}
                  data-testid={`mixer-strip-${track.id}`}
                >
                  <VUMeter getLevel={() => engine.getTrackMeter(trackId)} height={55} />
                  <div className="flex items-center gap-1" style={{ height: 55 }}>
                    <Slider
                      orientation="vertical"
                      value={[vol * 100]}
                      max={100}
                      step={1}
                      onValueChange={(v) => {
                        engine.setTrackVolume(trackId, v[0] / 100);
                        onUpdateTrack({ id: trackId, volume: Math.round(v[0]) });
                      }}
                      className="h-full"
                      data-testid={`slider-volume-${track.id}`}
                    />
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      className={cn("w-[18px] h-[18px] rounded text-[7px] font-bold flex items-center justify-center transition-all",
                        track.isMuted ? "bg-red-500/90 text-white" : "bg-white/[0.04] text-zinc-600 hover:bg-white/[0.08]"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateTrack({ id: trackId, isMuted: !track.isMuted });
                        engine.setTrackMute(trackId, !track.isMuted);
                      }}
                      data-testid={`mixer-mute-${track.id}`}
                    >M</button>
                    <button
                      className={cn("w-[18px] h-[18px] rounded text-[7px] font-bold flex items-center justify-center transition-all",
                        track.isSolo ? "bg-amber-500/90 text-white" : "bg-white/[0.04] text-zinc-600 hover:bg-white/[0.08]"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateTrack({ id: trackId, isSolo: !track.isSolo });
                        engine.setTrackSolo(trackId, !track.isSolo);
                      }}
                      data-testid={`mixer-solo-${track.id}`}
                    >S</button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[9px] font-medium truncate max-w-[60px] text-zinc-300" data-testid={`mixer-track-name-${track.id}`}>
                      {track.name}
                    </span>
                  </div>
                  <span className="text-[8px] text-zinc-600 font-mono tabular-nums">{Math.round(vol * 100)}%</span>
                </div>
              );
            })}

            <div className="flex flex-col items-center gap-1 px-4 border-l-2 border-[#ff751f]/20 ml-2 bg-[#ff751f]/[0.02] rounded-r-md" style={{ minWidth: 90 }}>
              <VUMeter getLevel={() => engine.getMasterMeter()} height={55} />
              <div className="flex items-center gap-1" style={{ height: 55 }}>
                <Slider
                  orientation="vertical"
                  value={[(engine.masterSettings?.volume ?? 1) * 100]}
                  max={100}
                  step={1}
                  onValueChange={(v) => engine.setMasterVolume(v[0] / 100)}
                  className="h-full"
                  data-testid="slider-master-volume"
                />
              </div>
              <button
                className="w-[18px] h-[18px] rounded flex items-center justify-center bg-white/[0.04] text-zinc-500 transition-all"
                onClick={() => engine.setMasterVolume((engine.masterSettings?.volume ?? 1) > 0 ? 0 : 1)}
                data-testid="mixer-master-mute"
              >
                {(engine.masterSettings?.volume ?? 1) === 0 ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              </button>
              <span className="text-[9px] font-bold text-[#ff751f] tracking-wide">MST</span>
              <span className="text-[8px] text-zinc-600 font-mono tabular-nums">{Math.round((engine.masterSettings?.volume ?? 1) * 100)}%</span>
            </div>
          </div>
        </ScrollArea>
      </div>
    </motion.div>
  );
}
