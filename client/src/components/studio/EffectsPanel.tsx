import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { SlidersVertical, Waves, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@shared/schema";
import type { useAudioEngine } from "@/hooks/use-audio-engine";

interface EffectsPanelProps {
  selectedSong: boolean;
  hasTracks: boolean;
  activeTrack: Track | undefined;
  activeTrackId: number | null;
  activeEngineTrack: ReturnType<ReturnType<typeof useAudioEngine>["tracks"]["get"]>;
  engine: ReturnType<typeof useAudioEngine>;
  onUpdateTrack: (data: { id: number; volume?: number }) => void;
  onOpenMixer: () => void;
}

export function EffectsPanel({ selectedSong, hasTracks, activeTrack, activeTrackId, activeEngineTrack, engine, onUpdateTrack, onOpenMixer }: EffectsPanelProps) {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <SlidersVertical className="w-4 h-4 text-[#ff751f]" />
        <span className="text-xs font-bold uppercase tracking-wider">Efectos de Audio</span>
      </div>

      {!activeTrack ? (
        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 text-center space-y-2">
          <SlidersVertical className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-xs text-muted-foreground">
            {!selectedSong
              ? "Selecciona una canción y luego un track para aplicar efectos"
              : !hasTracks
                ? "Agrega tracks primero y luego selecciona uno para aplicar efectos"
                : "Haz clic en un track del timeline para seleccionarlo y aplicar efectos aquí"
            }
          </p>
        </div>
      ) : (
        <>
          <div className="p-2 rounded-lg bg-[#ff751f]/5 border border-[#ff751f]/20 flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#ff751f]" />
            <span className="text-xs font-medium">Track: <strong className="text-[#ff751f]">{activeTrack.name}</strong></span>
          </div>

          <Card className="p-3 border-white/5 bg-white/[0.02]" data-testid="fx-eq-panel">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <SlidersVertical className="w-3.5 h-3.5 text-[#ff751f]" />
                <span className="text-xs font-bold">EQ (3 bandas)</span>
              </div>
            </div>
            <div className="space-y-3">
              {(["low", "mid", "high"] as const).map((band) => (
                <div key={band} className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground w-8 uppercase font-mono">{band}</span>
                  <Slider
                    value={[activeEngineTrack?.eq?.[band] ?? 0]}
                    min={-12}
                    max={12}
                    step={0.5}
                    onValueChange={(v) => engine.setTrackEQ(activeTrackId!, band, v[0])}
                    className="flex-1"
                    data-testid={`slider-eq-${band}`}
                  />
                  <span className="text-[10px] text-muted-foreground w-10 text-right font-mono">
                    {(activeEngineTrack?.eq?.[band] ?? 0).toFixed(1)}dB
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-3 border-white/5 bg-white/[0.02]" data-testid="fx-compressor-panel">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <SlidersVertical className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold">Compressor</span>
              </div>
              <button
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold transition-colors",
                  activeEngineTrack?.compressorSettings?.enabled
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-white/5 text-muted-foreground"
                )}
                onClick={() => engine.setTrackCompressor(activeTrackId!, { enabled: !activeEngineTrack?.compressorSettings?.enabled })}
                data-testid="button-toggle-compressor"
              >
                {activeEngineTrack?.compressorSettings?.enabled ? "ON" : "OFF"}
              </button>
            </div>
            {activeEngineTrack?.compressorSettings?.enabled && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground w-12 font-mono">Thresh</span>
                  <Slider
                    value={[activeEngineTrack.compressorSettings.threshold]}
                    min={-60}
                    max={0}
                    step={1}
                    onValueChange={(v) => engine.setTrackCompressor(activeTrackId!, { threshold: v[0] })}
                    className="flex-1"
                    data-testid="slider-comp-threshold"
                  />
                  <span className="text-[10px] text-muted-foreground w-10 text-right font-mono">{activeEngineTrack.compressorSettings.threshold}dB</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground w-12 font-mono">Ratio</span>
                  <Slider
                    value={[activeEngineTrack.compressorSettings.ratio]}
                    min={1}
                    max={20}
                    step={0.5}
                    onValueChange={(v) => engine.setTrackCompressor(activeTrackId!, { ratio: v[0] })}
                    className="flex-1"
                    data-testid="slider-comp-ratio"
                  />
                  <span className="text-[10px] text-muted-foreground w-10 text-right font-mono">{activeEngineTrack.compressorSettings.ratio}:1</span>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-3 border-white/5 bg-white/[0.02]" data-testid="fx-reverb-panel">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Waves className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-bold">Reverb</span>
              </div>
              <button
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold transition-colors",
                  activeEngineTrack?.reverbSettings?.enabled
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-white/5 text-muted-foreground"
                )}
                onClick={() => engine.setTrackReverb(activeTrackId!, { enabled: !activeEngineTrack?.reverbSettings?.enabled })}
                data-testid="button-toggle-reverb"
              >
                {activeEngineTrack?.reverbSettings?.enabled ? "ON" : "OFF"}
              </button>
            </div>
            {activeEngineTrack?.reverbSettings?.enabled && (
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground w-8 font-mono">Mix</span>
                <Slider
                  value={[(activeEngineTrack.reverbSettings.mix ?? 0) * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(v) => engine.setTrackReverb(activeTrackId!, { mix: v[0] / 100 })}
                  className="flex-1"
                  data-testid="slider-reverb-mix"
                />
                <span className="text-[10px] text-muted-foreground w-10 text-right font-mono">{Math.round((activeEngineTrack.reverbSettings.mix ?? 0) * 100)}%</span>
              </div>
            )}
          </Card>

          <Card className="p-3 border-white/5 bg-white/[0.02]" data-testid="fx-quick-mixer">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="w-3.5 h-3.5 text-[#ff751f]" />
              <span className="text-xs font-bold">Volumen & Pan</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground w-8 font-mono">Vol</span>
                <Slider
                  value={[(activeEngineTrack?.volume ?? 1) * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(v) => {
                    engine.setTrackVolume(activeTrackId!, v[0] / 100);
                    onUpdateTrack({ id: activeTrackId!, volume: Math.round(v[0]) });
                  }}
                  className="flex-1"
                  data-testid="slider-fx-volume"
                />
                <span className="text-[10px] text-muted-foreground w-10 text-right font-mono">{Math.round((activeEngineTrack?.volume ?? 1) * 100)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground w-8 font-mono">Pan</span>
                <Slider
                  value={[(activeEngineTrack?.pan ?? 0) * 50 + 50]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(v) => engine.setTrackPan(activeTrackId!, (v[0] - 50) / 50)}
                  className="flex-1"
                  data-testid="slider-fx-pan"
                />
                <span className="text-[10px] text-muted-foreground w-10 text-right font-mono">
                  {(activeEngineTrack?.pan ?? 0) < -0.05 ? `L${Math.round(Math.abs(activeEngineTrack!.pan) * 100)}` :
                    (activeEngineTrack?.pan ?? 0) > 0.05 ? `R${Math.round(activeEngineTrack!.pan * 100)}` : "C"}
                </span>
              </div>
            </div>
          </Card>

          <Button size="sm" variant="outline" className="w-full gap-2 text-xs h-8 mt-2" onClick={onOpenMixer} data-testid="button-open-mixer-from-fx">
            <SlidersVertical className="w-3.5 h-3.5" />
            Abrir Mixer Completo
          </Button>
        </>
      )}
    </div>
  );
}
