import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Play, Pause, Square, Music, SkipBack, SkipForward,
  Repeat, CircleDot, Grid3X3,
  SlidersVertical, PanelRightClose, PanelRightOpen,
  ChevronDown,
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
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0c0c0c] border-b border-white/[0.08] select-none" data-testid="studio-transport-bar">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff751f] to-[#ff751f]/60 flex items-center justify-center shadow-lg shadow-[#ff751f]/10">
          <Music className="w-4 h-4 text-white" />
        </div>
        <div className="relative">
          <select
            className="appearance-none bg-[#161616] border border-white/[0.08] rounded-lg px-3 pr-7 py-1.5 text-sm text-zinc-200 min-w-[180px] max-w-[260px] truncate cursor-pointer hover:border-white/15 transition-colors focus:outline-none focus:ring-1 focus:ring-[#ff751f]/40"
            value={selectedSongId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              engine.stopPlayback();
              onSelectSong(val ? Number(val) : null);
            }}
            data-testid="select-song"
          >
            <option value="">{songsLoading ? "Cargando..." : "Selecciona canción..."}</option>
            {songs.map((song) => (
              <option key={song.id} value={song.id}>{song.title}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
        </div>
      </div>

      {selectedSong && (
        <>
          <div className="h-6 w-px bg-white/[0.06] mx-1" />

          <div className="flex items-center gap-0.5 bg-[#161616] rounded-lg p-0.5 border border-white/[0.06]">
            <Button size="icon" variant="ghost" className="w-7 h-7 rounded-md text-zinc-400 hover:text-white hover:bg-white/5" onClick={() => { engine.stopPlayback(); engine.seekTo(0); }} data-testid="button-rewind">
              <SkipBack className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              className={cn(
                "w-8 h-8 rounded-md transition-all",
                engine.transport.isPlaying
                  ? "bg-[#ff751f] text-white hover:bg-[#ff751f]/80 shadow-md shadow-[#ff751f]/20"
                  : "bg-white/10 text-zinc-200 hover:bg-white/15"
              )}
              onClick={() => engine.togglePlayPause()}
              data-testid="button-play-pause"
            >
              {engine.transport.isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
            </Button>
            <Button size="icon" variant="ghost" className="w-7 h-7 rounded-md text-zinc-400 hover:text-white hover:bg-white/5" onClick={() => engine.stopPlayback()} data-testid="button-stop">
              <Square className="w-3 h-3 fill-current" />
            </Button>
            <Button size="icon" variant="ghost" className="w-7 h-7 rounded-md text-zinc-400 hover:text-white hover:bg-white/5" data-testid="button-skip-forward">
              <SkipForward className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="h-6 w-px bg-white/[0.06] mx-0.5" />

          <Button
            size="sm"
            className={cn(
              "gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md transition-all",
              isRecording
                ? "bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-600/20 animate-pulse"
                : "bg-[#1a1a1a] text-red-400 hover:bg-red-600/15 border border-red-600/20"
            )}
            onClick={isRecording ? onStopRecording : onStartRecording}
            disabled={!selectedSongId || isRecordingSaving}
            data-testid="button-record"
          >
            <CircleDot className="w-3 h-3" />
            {isRecording ? "Stop" : "REC"}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className={cn("w-7 h-7 rounded-md", engine.transport.loopEnabled && "bg-[#ff751f]/15 text-[#ff751f] ring-1 ring-[#ff751f]/20")}
            onClick={() => engine.setLoop(!engine.transport.loopEnabled)}
            data-testid="button-loop"
          >
            <Repeat className="w-3.5 h-3.5" />
          </Button>

          <div className="h-6 w-px bg-white/[0.06] mx-0.5" />

          <div className="flex items-center gap-2 bg-[#0a0a0a] rounded-lg px-3 py-1 border border-white/[0.06]" data-testid="text-time-display">
            <span className="font-mono text-sm text-[#ff751f] tabular-nums tracking-wider font-semibold">
              {formatTimeMs(engine.transport.currentTime * 1000)}
            </span>
          </div>

          <div className="h-6 w-px bg-white/[0.06] mx-0.5" />

          <div className="flex items-center gap-1 bg-[#161616] rounded-lg px-2 py-0.5 border border-white/[0.06]">
            <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">BPM</span>
            <Input
              type="number"
              value={bpm}
              onChange={(e) => onBpmChange(Math.max(30, Math.min(300, Number(e.target.value) || 130)))}
              className="w-12 h-6 text-xs text-center bg-transparent border-0 px-0 text-zinc-200 font-mono focus-visible:ring-0"
              data-testid="input-bpm"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#161616] rounded-lg px-2 py-0.5 border border-white/[0.06]">
            <Grid3X3 className="w-3 h-3 text-zinc-500" />
            <select
              className="bg-transparent border-0 text-[10px] text-zinc-300 cursor-pointer focus:outline-none pr-1"
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
          <Badge className="text-[10px] bg-[#ff751f]/10 text-[#ff751f] border-[#ff751f]/20 hover:bg-[#ff751f]/15" data-testid="badge-song-info">
            {GENRE_DISPLAY[selectedSong.genre || ""] || selectedSong.genre || "DA GRABACHATA"}
          </Badge>
        )}
        {isRecording && (
          <Badge variant="destructive" className="text-[10px] animate-pulse gap-1" data-testid="badge-recording">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            REC
          </Badge>
        )}
        <div className="h-6 w-px bg-white/[0.06] mx-0.5" />
        <Button
          size="icon" variant="ghost"
          className={cn("w-7 h-7 rounded-md", showMixer && "bg-white/5 text-[#ff751f]")}
          onClick={onToggleMixer}
          data-testid="button-toggle-mixer"
        >
          <SlidersVertical className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon" variant="ghost"
          className={cn("w-7 h-7 rounded-md", showSidePanel && "bg-white/5 text-[#ff751f]")}
          onClick={onToggleSidePanel}
          data-testid="button-toggle-side-panel"
        >
          {showSidePanel ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}
