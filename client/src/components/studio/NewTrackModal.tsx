import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Music, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { BACHATA_INSTRUMENTS } from "./constants";
import type { BachataInstrument } from "./constants";

interface NewTrackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddInstrument: (instrument: BachataInstrument) => void;
  onStartRecording: () => void;
  isCreatingTrack: boolean;
}

export function NewTrackModal({ open, onOpenChange, onAddInstrument, onStartRecording, isCreatingTrack }: NewTrackModalProps) {
  const [search, setSearch] = useState("");

  const filteredInstruments = BACHATA_INSTRUMENTS.filter((inst) =>
    inst.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-[#0e0e0e] border-white/[0.08]" data-testid="new-track-modal">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Nuevo Track</DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            Selecciona un instrumento para agregar un nuevo track
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Buscar instrumento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-[#161616] border-white/[0.08] text-sm"
              data-testid="input-search-instrument"
            />
          </div>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 bg-red-500/[0.06] border-red-500/20 text-red-400"
            onClick={() => { onStartRecording(); onOpenChange(false); }}
            data-testid="button-record-voice-modal"
          >
            <div className="w-8 h-8 rounded-md bg-red-500/20 flex items-center justify-center">
              <Mic className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium">Grabar Voz</div>
              <div className="text-[10px] text-zinc-500">Grabar desde micrófono</div>
            </div>
          </Button>

          <ScrollArea className="h-[280px]">
            <div className="grid grid-cols-2 gap-2">
              {filteredInstruments.map((instrument) => (
                <button
                  key={instrument.name}
                  className={cn(
                    "flex items-center gap-2.5 p-3 rounded-lg border transition-all text-left",
                    "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12]",
                    isCreatingTrack && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => { onAddInstrument(instrument); onOpenChange(false); }}
                  disabled={isCreatingTrack}
                  data-testid={`button-add-${instrument.name.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <div
                    className="w-9 h-9 rounded-md flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: `${instrument.color}15`, border: `1px solid ${instrument.color}25` }}
                  >
                    {instrument.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{instrument.name}</div>
                    <div className="text-[10px] text-zinc-600 uppercase tracking-wide">{instrument.type}</div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
