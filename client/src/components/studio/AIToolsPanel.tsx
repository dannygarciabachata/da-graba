import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sparkles, Scissors, Shield, MicVocal, Loader2, Download,
} from "lucide-react";

interface AIToolsPanelProps {
  selectedSongId: number | null;
  canUseStemSeparation: boolean;
  isSeparating: boolean;
  isMastering: boolean;
  isDenoising: boolean;
  isCovering: boolean;
  isTrimming: boolean;
  isDownloadingAll: boolean;
  coverVoice: string;
  trimStart: string;
  trimEnd: string;
  hasCompletedTracks: boolean;
  onCoverVoiceChange: (v: string) => void;
  onTrimStartChange: (v: string) => void;
  onTrimEndChange: (v: string) => void;
  onSeparateStems: () => void;
  onMaster: () => void;
  onDenoise: () => void;
  onCover: () => void;
  onTrim: () => void;
  onDownloadAll: () => void;
}

export function AIToolsPanel({
  selectedSongId, canUseStemSeparation,
  isSeparating, isMastering, isDenoising, isCovering, isTrimming, isDownloadingAll,
  coverVoice, trimStart, trimEnd, hasCompletedTracks,
  onCoverVoiceChange, onTrimStartChange, onTrimEndChange,
  onSeparateStems, onMaster, onDenoise, onCover, onTrim, onDownloadAll,
}: AIToolsPanelProps) {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-[#ff751f]" />
        <span className="text-xs font-bold uppercase tracking-wider">Herramientas AI</span>
      </div>

      {!selectedSongId ? (
        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 text-center space-y-2">
          <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-xs text-muted-foreground">Selecciona una canción para usar las herramientas de IA</p>
        </div>
      ) : (
        <>
          {canUseStemSeparation && (
            <Card className="p-4 border-white/5 bg-[#111]" data-testid="ai-stem-separation">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#FF8C00]/10 flex items-center justify-center flex-shrink-0">
                  <Scissors className="w-5 h-5 text-[#FF8C00]" />
                </div>
                <div>
                  <span className="text-sm font-bold block">Separar Stems</span>
                  <span className="text-[11px] text-muted-foreground">Divide la canción en voces, batería, bajo y melodía</span>
                </div>
              </div>
              <Button size="sm" className="w-full gap-2 h-9 bg-[#FF8C00]/20 text-[#FF8C00] hover:bg-[#FF8C00]/30 border border-[#FF8C00]/20" disabled={isSeparating} onClick={onSeparateStems} data-testid="button-separate-stems-side">
                {isSeparating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
                {isSeparating ? "Procesando..." : "Separar Stems"}
              </Button>
            </Card>
          )}

          <Card className="p-4 border-white/5 bg-[#111]" data-testid="ai-master">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <span className="text-sm font-bold block">Masterizar</span>
                <span className="text-[11px] text-muted-foreground">Procesa el audio para calidad profesional de estudio</span>
              </div>
            </div>
            <Button size="sm" className="w-full gap-2 h-9 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/20" disabled={isMastering} onClick={onMaster} data-testid="button-master-song">
              {isMastering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isMastering ? "Procesando..." : "Masterizar Track"}
            </Button>
          </Card>

          <Card className="p-4 border-white/5 bg-[#111]" data-testid="ai-denoise">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <span className="text-sm font-bold block">Eliminar Ruido</span>
                <span className="text-[11px] text-muted-foreground">Remueve ruido de fondo y mejora la claridad del audio</span>
              </div>
            </div>
            <Button size="sm" className="w-full gap-2 h-9 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/20" disabled={isDenoising} onClick={onDenoise} data-testid="button-denoise-song">
              {isDenoising ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              {isDenoising ? "Procesando..." : "Eliminar Ruido"}
            </Button>
          </Card>

          <Card className="p-4 border-white/5 bg-[#111]" data-testid="ai-cover">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <MicVocal className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <span className="text-sm font-bold block">Cover con IA</span>
                <span className="text-[11px] text-muted-foreground">Re-canta tu canción con una voz generada por IA</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nombre de la voz..."
                value={coverVoice}
                onChange={(e) => onCoverVoiceChange(e.target.value)}
                className="flex-1 text-xs bg-black/20 border-white/10 h-9"
                data-testid="input-cover-voice"
              />
              <Button
                size="sm"
                className="flex-shrink-0 gap-1.5 h-9 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/20"
                disabled={isCovering || !coverVoice.trim() || !selectedSongId}
                onClick={onCover}
                data-testid="button-cover-song"
              >
                {isCovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <MicVocal className="w-4 h-4" />}
                Crear
              </Button>
            </div>
          </Card>

          <Card className="p-4 border-white/5 bg-[#111]" data-testid="ai-trim">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <Scissors className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <span className="text-sm font-bold block">Cortar Audio</span>
                <span className="text-[11px] text-muted-foreground">Recorta la canción a un rango específico en segundos</span>
              </div>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground block mb-1">Inicio (seg)</label>
                <Input type="number" placeholder="0" min="0" step="0.5" value={trimStart} onChange={(e) => onTrimStartChange(e.target.value)} className="text-xs bg-black/20 border-white/10 h-8" data-testid="input-trim-start" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground block mb-1">Fin (seg)</label>
                <Input type="number" placeholder="30" min="0.5" step="0.5" value={trimEnd} onChange={(e) => onTrimEndChange(e.target.value)} className="text-xs bg-black/20 border-white/10 h-8" data-testid="input-trim-end" />
              </div>
              <Button
                size="sm"
                className="flex-shrink-0 gap-1 h-8 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/20"
                disabled={isTrimming || !trimStart || !trimEnd || !selectedSongId}
                onClick={onTrim}
                data-testid="button-trim-song"
              >
                {isTrimming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5" />}
                Cortar
              </Button>
            </div>
          </Card>

          {hasCompletedTracks && (
            <Card className="p-4 border-white/5 bg-[#111]" data-testid="ai-download-all">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <Download className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <span className="text-sm font-bold block">Descargar Todo</span>
                  <span className="text-[11px] text-muted-foreground">Descarga todos los stems en un archivo ZIP</span>
                </div>
              </div>
              <Button size="sm" className="w-full gap-2 h-9 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/20" disabled={isDownloadingAll} onClick={onDownloadAll} data-testid="button-download-all">
                {isDownloadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isDownloadingAll ? "Empaquetando..." : "Descargar ZIP"}
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
