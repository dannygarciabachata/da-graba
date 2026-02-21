import { Loader2, Music, Volume2, VolumeX } from "lucide-react";
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
  const isMuted = track.isMuted || (isSoloedByOther && !track.isMuted);

  return (
    <div
      className={cn(
        "flex border-b border-white/[0.04] overflow-visible relative cursor-pointer group transition-all",
        isSoloedByOther && !track.isMuted && "opacity-35",
        isActive ? "bg-[#ff751f]/[0.04]" : "bg-[#0e0e0e] hover:bg-[#121212]"
      )}
      style={{ height: LANE_HEIGHT }}
      onClick={onSelect}
      data-testid={`track-lane-${track.id}`}
    >
      <div
        className={cn(
          "flex flex-col justify-center gap-1.5 px-2.5 border-r border-white/[0.06] flex-shrink-0 transition-colors",
          isActive && "border-r-[#ff751f]/20"
        )}
        style={{ width: HEADER_WIDTH }}
      >
        <div className="flex items-center gap-2 w-full">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ backgroundColor: `${color}18`, border: `1px solid ${color}25` }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-medium truncate block leading-tight" data-testid={`text-track-name-${track.id}`}>
              {track.name}
            </span>
            <span className="text-[9px] text-zinc-600 uppercase tracking-wide">{track.type}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 w-full">
          <button
            className={cn(
              "w-[18px] h-[18px] rounded text-[7px] font-bold flex items-center justify-center transition-all",
              track.isMuted ? "bg-red-500/90 text-white shadow-sm shadow-red-500/20" : "bg-white/[0.04] text-zinc-600 hover:bg-white/[0.08] hover:text-zinc-400"
            )}
            onClick={(e) => { e.stopPropagation(); engine.setTrackMute(track.id, !track.isMuted); }}
            data-testid={`button-mute-${track.id}`}
          >M</button>
          <button
            className={cn(
              "w-[18px] h-[18px] rounded text-[7px] font-bold flex items-center justify-center transition-all",
              track.isSolo ? "bg-amber-500/90 text-white shadow-sm shadow-amber-500/20" : "bg-white/[0.04] text-zinc-600 hover:bg-white/[0.08] hover:text-zinc-400"
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
          <VUMeter getLevel={() => engine.getTrackMeter(track.id)} height={18} />
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {isActive && (
          <div className="absolute inset-0 border-l-2 pointer-events-none z-0" style={{ borderColor: `${color}40` }} />
        )}

        {isPending ? (
          <div className="h-full flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
            <span className="text-[11px] text-zinc-500 font-medium">Procesando...</span>
          </div>
        ) : buffer ? (
          <div className="absolute inset-0 opacity-25">
            <MiniWaveform buffer={buffer} color={color} width={800} height={LANE_HEIGHT - 8} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-[10px] text-zinc-700">Sin audio</span>
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
