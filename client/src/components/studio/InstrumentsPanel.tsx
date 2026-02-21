import { Button } from "@/components/ui/button";
import { Piano, Volume2, Plus, Wand2 } from "lucide-react";
import { BACHATA_INSTRUMENTS } from "./constants";
import type { BachataInstrument } from "./constants";

interface InstrumentsPanelProps {
  selectedSong: boolean;
  isCreatingTrack: boolean;
  onAddInstrument: (instrument: BachataInstrument) => void;
  onGoToSampleLab: () => void;
}

export function InstrumentsPanel({ selectedSong, isCreatingTrack, onAddInstrument, onGoToSampleLab }: InstrumentsPanelProps) {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Piano className="w-4 h-4 text-[#ff751f]" />
        <span className="text-xs font-bold uppercase tracking-wider">DA GRABA Instrumentos</span>
      </div>

      {!selectedSong ? (
        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 text-center">
          <p className="text-xs text-muted-foreground">Selecciona una canción primero para agregar instrumentos</p>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            Haz clic en un instrumento para agregarlo como track a tu proyecto:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {BACHATA_INSTRUMENTS.map((inst) => (
              <button
                key={inst.name}
                className="p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.08] hover:border-[#ff751f]/30 transition-all text-left group active:scale-95"
                onClick={() => onAddInstrument(inst)}
                disabled={isCreatingTrack}
                data-testid={`sidebar-instrument-${inst.name.toLowerCase().replace(/\s/g, "-")}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{inst.icon}</span>
                  <div>
                    <span className="text-[11px] font-medium block leading-tight group-hover:text-[#ff751f] transition-colors">{inst.name}</span>
                    <span className="text-[9px] text-muted-foreground">VST3 · {inst.type}</span>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-[9px] text-[#ff751f]/60 group-hover:text-[#ff751f] transition-colors">
                  <Plus className="w-3 h-3" />
                  <span>Agregar track</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="pt-3 border-t border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-wider">Samples</span>
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">Graba y edita muestras de audio en el Sample Lab</p>
        <Button size="sm" variant="outline" className="w-full gap-2 text-xs h-8" onClick={onGoToSampleLab} data-testid="button-goto-sample-lab">
          <Wand2 className="w-3.5 h-3.5" />
          Abrir Sample Lab
        </Button>
      </div>
    </div>
  );
}
