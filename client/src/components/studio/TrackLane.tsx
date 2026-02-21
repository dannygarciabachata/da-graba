import { Loader2, Music } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { STEM_COLORS, STEM_ICONS, CLIP_COLORS, LANE_HEIGHT, HEADER_WIDTH } from "./constants";
import { VUMeter } from "./VUMeter";
import { MiniWaveform } from "./MiniWaveform";
import { ClipBlock } from "./ClipBlock";
import type { Track, DawClip } from "@shared/schema";
import type { useAudioEngine } from "@/hooks/use-audio-engine";

interface TrackLaneProps {
  track: Track;
  clips: DawClip[];
  engine: ReturnType<typeof useAudioEngine>;
  pxPerMs: number;
  snapMs: number;
  onUpdateClip: (clipId: number, data: Partial<DawClip>) => void;
  onDeleteClip: (clipId: number) => void;
  anySoloed: boolean;
  isActive: boolean;
  onSelect: () => void;
}

export function TrackLane({ track, clips, engine, pxPerMs, snapMs, onUpdateClip, onDeleteClip, anySoloed, isActive, onSelect }: TrackLaneProps) {
  const Icon = STEM_ICONS[track.type] || Music;
  const color = STEM_COLORS[track.type] || "#A78BFA";
  const isSoloedByOther = anySoloed && !track.isSolo;
  const isPending = track.status === "pending" || track.status === "processing";
  const buffer = track.status === "completed" ? engine.getTrackBuffer(track.id) : null;
  const engineTrack = engine.tracks.get(track.id);
  const vol = engineTrack?.volume ?? (track.volume ?? 100) / 100;

  return (
    <div
      className={cn(
        "flex border-b border-white/5 bg-[#111] overflow-visible relative cursor-pointer transition-colors",
        isSoloedByOther && !track.isMuted && "opacity-40",
        isActive && "ring-1 ring-[#ff751f]/50 bg-[#ff751f]/5"
      )}
      style={{ height: LANE_HEIGHT }}
      onClick={onSelect}
      data-testid={`track-lane-${track.id}`}
    >
      <div
        className="flex flex-col items-center justify-center gap-1 px-2 border-r border-white/5 flex-shrink-0"
        style={{ width: HEADER_WIDTH, backgroundColor: isActive ? `${color}15` : `${color}08` }}
      >
        <div className="flex items-center gap-1.5 w-full">
          <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-medium truncate block" data-testid={`text-track-name-${track.id}`}>
              {track.name}
            </span>
            <span className="text-[8px] text-muted-foreground">{track.type}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 w-full">
          <button
            className={cn("w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center transition-colors",
              track.isMuted ? "bg-red-500/80 text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            )}
            onClick={(e) => { e.stopPropagation(); engine.setTrackMute(track.id, !track.isMuted); }}
            data-testid={`button-mute-${track.id}`}
          >M</button>
          <button
            className={cn("w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center transition-colors",
              track.isSolo ? "bg-yellow-500/80 text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            )}
            onClick={(e) => { e.stopPropagation(); engine.setTrackSolo(track.id, !track.isSolo); }}
            data-testid={`button-solo-${track.id}`}
          >S</button>
          <div className="flex-1 mx-1">
            <Slider
              value={[vol * 100]}
              max={100}
              step={1}
              onValueChange={(v) => engine.setTrackVolume(track.id, v[0] / 100)}
              className="w-full"
              data-testid={`slider-track-vol-${track.id}`}
            />
          </div>
          <VUMeter getLevel={() => engine.getTrackMeter(track.id)} height={20} />
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {isPending ? (
          <div className="h-full flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Procesando...</span>
          </div>
        ) : buffer ? (
          <div className="absolute inset-0 opacity-30">
            <MiniWaveform buffer={buffer} color={color} width={800} height={LANE_HEIGHT - 8} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground/50">Sin audio - Genera o graba para este track</span>
          </div>
        )}

        {clips.map((clip) => (
          <ClipBlock
            key={clip.id}
            clip={clip}
            pxPerMs={pxPerMs}
            snapMs={snapMs}
            color={CLIP_COLORS[(clip.laneIndex || 0) % CLIP_COLORS.length]}
            onUpdate={(data) => onUpdateClip(clip.id, data)}
            onDelete={() => onDeleteClip(clip.id)}
          />
        ))}
      </div>
    </div>
  );
}
