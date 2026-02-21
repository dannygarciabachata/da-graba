import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Play, Pause, Square, Music, SkipBack,
  Repeat, CircleDot, Grid3X3,
  SlidersVertical, PanelRightClose, PanelRightOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SNAP_VALUES } from "@/hooks/use-daw";
import { GENRE_DISPLAY, formatTimeMs } from "./constants";
import type { useAudioEngine } from "@/hooks/use-audio-engine";

interface Song {
  id: number;
  title: string;
  genre?: string | null;
  status: string;
  audioUrl?: string | null;
}

interface TransportBarProps {
  songs: Song[];
  songsLoading: boolean;
  selectedSongId: number | null;
  selectedSong: Song | undefined;
  onSelectSong: (id: number | null) => void;
  engine: ReturnType<typeof useAudioEngine>;
  isRecording: boolean;
  isRecordingSaving: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  snapIndex: number;
  onSnapChange: (index: number) => void;
  showMixer: boolean;
  onToggleMixer: () => void;
  showSidePanel: boolean;
  onToggleSidePanel: () => void;
}

export function TransportBar({
  songs, songsLoading, selectedSongId, selectedSong, onSelectSong,
  engine, isRecording, isRecordingSaving, onStartRecording, onStopRecording,
  bpm, onBpmChange, snapIndex, onSnapChange,
  showMixer, onToggleMixer, showSidePanel, onToggleSidePanel,
}: TransportBarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#111] border-b border-white/10 flex-wrap" data-testid="studio-transport-bar">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded bg-[#ff751f]/20 flex items-center justify-center">
          <Music className="w-4 h-4 text-[#ff751f]" />
        </div>
        <select
          className="bg-[#1a1a1a] border border-white/10 rounded px-2 py-1.5 text-sm text-foreground min-w-[160px] max-w-[250px] truncate"
          value={selectedSongId ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            engine.stopPlayback();
            onSelectSong(val ? Number(val) : null);
          }}
          data-testid="select-song"
        >
          <option value="">{songsLoading ? "Cargando..." : "Selecciona una canción..."}</option>
          {songs.map((song) => (
            <option key={song.id} value={song.id}>{song.title}</option>
          ))}
        </select>
      </div>

      {selectedSong && (
        <>
          <div className="h-6 w-px bg-white/10" />

          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => { engine.stopPlayback(); engine.seekTo(0); }} data-testid="button-rewind">
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              className={cn("w-9 h-9 rounded-full", engine.transport.isPlaying ? "bg-[#ff751f] text-white hover:bg-[#ff751f]/80" : "bg-white/10 hover:bg-white/20")}
              onClick={() => engine.togglePlayPause()}
              data-testid="button-play-pause"
            >
              {engine.transport.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </Button>
            <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => engine.stopPlayback()} data-testid="button-stop">
              <Square className="w-4 h-4 fill-current" />
            </Button>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <Button
            size="sm"
            className={cn(
              "gap-1.5 h-8 px-3 font-medium",
              isRecording
                ? "bg-red-600 text-white hover:bg-red-700 animate-pulse"
                : "bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30"
            )}
            onClick={isRecording ? onStopRecording : onStartRecording}
            disabled={!selectedSongId || isRecordingSaving}
            data-testid="button-record"
          >
            <CircleDot className="w-3.5 h-3.5" />
            {isRecording ? "Parar Grabación" : "Grabar Voz"}
          </Button>

          <Button
            size="icon"
            variant={engine.transport.loopEnabled ? "default" : "ghost"}
            className={cn("w-8 h-8", engine.transport.loopEnabled && "bg-[#ff751f]/20 text-[#ff751f]")}
            onClick={() => engine.setLoop(!engine.transport.loopEnabled)}
            data-testid="button-loop"
          >
            <Repeat className="w-3.5 h-3.5" />
          </Button>

          <div className="h-6 w-px bg-white/10" />

          <div className="font-mono text-sm text-[#ff751f] tabular-nums bg-black/40 px-2 py-1 rounded" data-testid="text-time-display">
            {formatTimeMs(engine.transport.currentTime * 1000)}
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">BPM</span>
            <Input
              type="number"
              value={bpm}
              onChange={(e) => onBpmChange(Math.max(30, Math.min(300, Number(e.target.value) || 130)))}
              className="w-16 h-7 text-xs text-center bg-black/30 border-white/10 px-1"
              data-testid="input-bpm"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Grid3X3 className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              className="bg-black/30 border border-white/10 rounded px-2 py-1 text-[11px] text-foreground"
              value={snapIndex}
              onChange={(e) => onSnapChange(Number(e.target.value))}
              data-testid="select-snap"
            >
              {SNAP_VALUES.map((sv, i) => (
                <option key={i} value={i}>{sv.label}</option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="flex items-center gap-1 ml-auto">
        {selectedSong && (
          <Badge variant="secondary" className="text-xs" data-testid="badge-song-info">
            {GENRE_DISPLAY[selectedSong.genre || ""] || selectedSong.genre || "DA GRABACHATA"}
          </Badge>
        )}
        {isRecording && (
          <Badge variant="destructive" className="text-xs animate-pulse" data-testid="badge-recording">
            🔴 REC
          </Badge>
        )}
        <Button size="icon" variant="ghost" className="w-8 h-8" onClick={onToggleMixer} data-testid="button-toggle-mixer">
          <SlidersVertical className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" className="w-8 h-8" onClick={onToggleSidePanel} data-testid="button-toggle-side-panel">
          {showSidePanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
