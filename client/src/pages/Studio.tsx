import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSongs } from "@/hooks/use-songs";
import { useSongTracks, useSeparateStems, useUpdateTrack, useCreateTrack, useMasterSong, useDenoiseSong, useCoverSong, useTrimSong } from "@/hooks/use-tracks";
import { useAudioEngine } from "@/hooks/use-audio-engine";
import { useStripeSubscription } from "@/hooks/use-stripe";
import { useDawClips, useCreateDawClip, useUpdateDawClip, useDeleteDawClip, useRecordAudio, SNAP_VALUES } from "@/hooks/use-daw";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Scissors, Music, Plus, Piano, Mic, ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import JSZip from "jszip";

import { TransportBar } from "@/components/studio/TransportBar";
import { Toolbar } from "@/components/studio/Toolbar";
import { TimelineRuler } from "@/components/studio/TimelineRuler";
import { TrackLane } from "@/components/studio/TrackLane";
import { MixerConsole } from "@/components/studio/MixerConsole";
import { NewTrackModal } from "@/components/studio/NewTrackModal";
import { StudioSidebar } from "@/components/studio/StudioSidebar";
import { HEADER_WIDTH, PX_PER_MS, BACHATA_INSTRUMENTS } from "@/components/studio/constants";
import type { BachataInstrument } from "@/components/studio/constants";

export default function StudioPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: songs, isLoading: songsLoading } = useSongs();
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const { data: songTracks, isLoading: tracksLoading } = useSongTracks(selectedSongId);
  const { data: dawClips } = useDawClips(selectedSongId);
  const { mutate: createClip } = useCreateDawClip();
  const { mutate: updateClip } = useUpdateDawClip();
  const { mutate: deleteClip } = useDeleteDawClip();
  const { mutate: recordAudio, isPending: isRecordingSaving } = useRecordAudio();
  const { mutate: separateStems, isPending: isSeparating } = useSeparateStems();
  const { mutate: createTrack, isPending: isCreatingTrack } = useCreateTrack();
  const { mutate: updateTrack } = useUpdateTrack();
  const { mutate: masterSong, isPending: isMastering } = useMasterSong();
  const { mutate: denoiseSong, isPending: isDenoising } = useDenoiseSong();
  const { mutate: coverSong, isPending: isCovering } = useCoverSong();
  const { mutate: trimSong, isPending: isTrimming } = useTrimSong();
  const { data: subData } = useStripeSubscription();
  const userTier = subData?.tier || "free";
  const canUseStemSeparation = userTier === "pro" || userTier === "premium" || userTier === "producer" || user?.role === "super_admin" || user?.role === "admin";

  const engine = useAudioEngine();

  const [showMixer, setShowMixer] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [coverVoice, setCoverVoice] = useState("");
  const [trimStart, setTrimStart] = useState("");
  const [trimEnd, setTrimEnd] = useState("");
  const [bpm, setBpm] = useState(130);
  const [snapIndex, setSnapIndex] = useState(3);
  const snapMs = SNAP_VALUES[snapIndex]?.ms || 0;
  const [sidebarTab, setSidebarTab] = useState("instruments");
  const [activeTrackId, setActiveTrackId] = useState<number | null>(null);
  const [activeTool, setActiveTool] = useState("select");
  const [showNewTrackModal, setShowNewTrackModal] = useState(false);

  const completedSongs = songs?.filter((s) => s.status === "completed" && s.audioUrl) ?? [];
  const selectedSong = completedSongs.find((s) => s.id === selectedSongId);
  const hasTracks = songTracks && songTracks.length > 0;
  const completedTracks = songTracks?.filter((t) => t.status === "completed" && t.audioUrl) ?? [];
  const anySoloed = songTracks?.some((t) => t.isSolo) ?? false;
  const activeTrack = songTracks?.find((t) => t.id === activeTrackId);
  const activeEngineTrack = activeTrackId ? engine.tracks.get(activeTrackId) : null;

  const totalDurationMs = useMemo(() => {
    const trackDur = engine.transport.duration * 1000;
    const clipMaxMs = dawClips?.reduce((max, c) => Math.max(max, (c.startTimeMs || 0) + (c.durationMs || 0)), 0) || 0;
    return Math.max(trackDur, clipMaxMs, 30000);
  }, [engine.transport.duration, dawClips]);

  useEffect(() => {
    if (!completedTracks.length) return;
    completedTracks.forEach((track) => {
      if (track.audioUrl) {
        engine.loadTrack(track.id, track.audioUrl, track.name, track.type);
      }
    });
  }, [completedTracks.map((t) => `${t.id}:${t.audioUrl}`).join(",")]);

  useEffect(() => {
    if (activeTrackId && songTracks && !songTracks.find((t) => t.id === activeTrackId)) {
      setActiveTrackId(null);
    }
  }, [songTracks, activeTrackId]);

  const handleSeparate = useCallback(() => {
    if (selectedSongId) separateStems(selectedSongId);
  }, [selectedSongId, separateStems]);

  const handleAddInstrumentTrack = useCallback((instrument: BachataInstrument) => {
    if (!selectedSongId) return;
    createTrack({ songId: selectedSongId, name: instrument.name, type: instrument.type });
  }, [selectedSongId, createTrack]);

  const handleStartRecording = useCallback(async () => {
    try { await engine.startRecording(); } catch (err) { console.error("Failed to start recording:", err); }
  }, [engine]);

  const handleStopRecording = useCallback(async () => {
    if (!selectedSongId) return;
    try {
      const { blob, durationMs } = await engine.stopRecording();
      recordAudio({
        songId: selectedSongId,
        blob,
        name: `Grabación ${new Date().toLocaleTimeString()}`,
        laneIndex: songTracks?.length || 0,
        startTimeMs: Math.round(engine.transport.currentTime * 1000),
        durationMs,
      });
    } catch (err) { console.error("Failed to stop recording:", err); }
  }, [selectedSongId, engine, songTracks, recordAudio]);

  const handleDownloadAll = useCallback(async () => {
    if (completedTracks.length === 0 || !selectedSong) return;
    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();
      const songName = selectedSong.title.replace(/[^a-zA-Z0-9\s-]/g, "").trim() || "stems";
      for (const track of completedTracks) {
        if (!track.audioUrl) continue;
        const response = await fetch(track.audioUrl, { credentials: "include" });
        const blob = await response.blob();
        zip.file(`${songName}_${track.name}.wav`, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${songName}_stems.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) { console.error("Failed to download stems:", err); } finally { setIsDownloadingAll(false); }
  }, [completedTracks, selectedSong]);

  if (!user) return null;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] text-foreground font-sans overflow-hidden">
      <TransportBar
        songs={completedSongs}
        songsLoading={songsLoading}
        selectedSongId={selectedSongId}
        selectedSong={selectedSong}
        onSelectSong={(id) => { setSelectedSongId(id); setActiveTrackId(null); }}
        engine={engine}
        isRecording={engine.isRecording}
        isRecordingSaving={isRecordingSaving}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        bpm={bpm}
        onBpmChange={setBpm}
        snapIndex={snapIndex}
        onSnapChange={setSnapIndex}
        showMixer={showMixer}
        onToggleMixer={() => setShowMixer(!showMixer)}
        showSidePanel={showSidePanel}
        onToggleSidePanel={() => setShowSidePanel(!showSidePanel)}
      />

      {selectedSong && (
        <Toolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          snapEnabled={snapMs > 0}
          onToggleSnap={() => setSnapIndex(snapMs > 0 ? 0 : 3)}
          hasSelection={!!activeTrackId}
          onImportAudio={() => { setShowSidePanel(true); setSidebarTab("instruments"); }}
          onExport={handleDownloadAll}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto" data-testid="timeline-area">
            {!selectedSong ? (
              <WelcomeScreen
                songsLoading={songsLoading}
                completedSongsCount={completedSongs.length}
                onGoCreate={() => setLocation("/create")}
              />
            ) : (
              <div className="flex flex-col h-full">
                <div style={{ paddingLeft: HEADER_WIDTH }}>
                  <TimelineRuler
                    durationMs={totalDurationMs}
                    currentTimeMs={engine.transport.currentTime * 1000}
                    bpm={bpm}
                    pxPerMs={PX_PER_MS}
                  />
                </div>

                <ScrollArea className="flex-1">
                  <div>
                    {tracksLoading ? (
                      <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : !hasTracks ? (
                      <NoTracksPrompt
                        songTitle={selectedSong.title}
                        canUseStemSeparation={canUseStemSeparation}
                        isSeparating={isSeparating}
                        onSeparate={handleSeparate}
                        onOpenInstruments={() => setSidebarTab("instruments")}
                        onStartRecording={handleStartRecording}
                      />
                    ) : (
                      <>
                        {songTracks?.map((track) => (
                          <TrackLane
                            key={track.id}
                            track={track}
                            clips={dawClips?.filter((c) => c.trackId === track.id) || []}
                            engine={engine}
                            pxPerMs={PX_PER_MS}
                            snapMs={snapMs}
                            anySoloed={anySoloed}
                            isActive={track.id === activeTrackId}
                            onSelect={() => setActiveTrackId(track.id === activeTrackId ? null : track.id)}
                            onUpdateClip={(clipId, data) => {
                              if (selectedSongId) updateClip({ id: clipId, songId: selectedSongId, ...data });
                            }}
                            onDeleteClip={(clipId) => {
                              if (selectedSongId) deleteClip({ id: clipId, songId: selectedSongId });
                            }}
                          />
                        ))}

                        <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center gap-2">
                          <Button
                            size="sm" variant="ghost"
                            className="gap-2 text-xs text-zinc-500"
                            onClick={() => setShowNewTrackModal(true)}
                            data-testid="button-add-track"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Nuevo Track
                          </Button>
                          {canUseStemSeparation && (
                            <Button
                              size="sm" variant="ghost"
                              className="gap-2 text-xs text-zinc-500"
                              onClick={handleSeparate}
                              disabled={isSeparating}
                              data-testid="button-separate-stems-inline"
                            >
                              {isSeparating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5" />}
                              Separar Stems
                            </Button>
                          )}
                        </div>

                        {activeTrack && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="px-4 py-1.5 bg-[#ff751f]/[0.04] border-b border-[#ff751f]/10 flex items-center gap-2"
                            data-testid="active-track-banner"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-[#ff751f] animate-pulse" />
                            <span className="text-[11px] text-zinc-400">Track activo: <strong className="text-[#ff751f]">{activeTrack.name}</strong></span>
                            <span className="text-[10px] text-zinc-600">— Panel FX a la derecha</span>
                          </motion.div>
                        )}
                      </>
                    )}
                  </div>
                </ScrollArea>

                {engine.transport.duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-[#ff751f]/70 pointer-events-none z-10"
                    style={{ left: HEADER_WIDTH + (engine.transport.currentTime * 1000) * PX_PER_MS }}
                  />
                )}
              </div>
            )}
          </div>

          <AnimatePresence>
            {showMixer && hasTracks && songTracks && (
              <MixerConsole
                tracks={songTracks}
                engine={engine}
                activeTrackId={activeTrackId}
                onSelectTrack={setActiveTrackId}
                onUpdateTrack={(data) => updateTrack(data)}
                onClose={() => setShowMixer(false)}
              />
            )}
          </AnimatePresence>
        </div>

        <NewTrackModal
          open={showNewTrackModal}
          onOpenChange={setShowNewTrackModal}
          onAddInstrument={handleAddInstrumentTrack}
          onStartRecording={handleStartRecording}
          isCreatingTrack={isCreatingTrack}
        />

        {showSidePanel && (
          <StudioSidebar
            sidebarTab={sidebarTab}
            onTabChange={setSidebarTab}
            selectedSong={!!selectedSong}
            selectedSongId={selectedSongId}
            hasTracks={!!hasTracks}
            isCreatingTrack={isCreatingTrack}
            onAddInstrument={handleAddInstrumentTrack}
            onGoToSampleLab={() => setLocation("/sample-lab")}
            activeTrack={activeTrack}
            activeTrackId={activeTrackId}
            activeEngineTrack={activeEngineTrack ?? undefined}
            engine={engine}
            onUpdateTrack={(data) => updateTrack(data)}
            onOpenMixer={() => setShowMixer(true)}
            canUseStemSeparation={canUseStemSeparation}
            isSeparating={isSeparating}
            isMastering={isMastering}
            isDenoising={isDenoising}
            isCovering={isCovering}
            isTrimming={isTrimming}
            isDownloadingAll={isDownloadingAll}
            coverVoice={coverVoice}
            trimStart={trimStart}
            trimEnd={trimEnd}
            hasCompletedTracks={completedTracks.length > 0}
            onCoverVoiceChange={setCoverVoice}
            onTrimStartChange={setTrimStart}
            onTrimEndChange={setTrimEnd}
            onSeparateStems={handleSeparate}
            onMaster={() => selectedSongId && masterSong(selectedSongId)}
            onDenoise={() => selectedSongId && denoiseSong(selectedSongId)}
            onCover={() => {
              if (selectedSongId && coverVoice.trim()) {
                coverSong({ songId: selectedSongId, voiceId: coverVoice });
                setCoverVoice("");
              }
            }}
            onTrim={() => {
              if (selectedSongId && trimStart && trimEnd) {
                trimSong({ songId: selectedSongId, startTimeMs: Number(trimStart), endTimeMs: Number(trimEnd) });
              }
            }}
            onDownloadAll={handleDownloadAll}
          />
        )}
      </div>
    </div>
  );
}

function WelcomeScreen({ songsLoading, completedSongsCount, onGoCreate }: {
  songsLoading: boolean;
  completedSongsCount: number;
  onGoCreate: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center h-full p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-lg">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#ff751f]/20 to-indigo-500/20 flex items-center justify-center mx-auto mb-6">
          <Music className="w-12 h-12 text-[#ff751f]/60" />
        </div>
        <h2 className="text-2xl font-bold mb-3" data-testid="text-studio-title">DA GRABA Studio DAW</h2>
        <p className="text-base text-muted-foreground mb-8">
          Selecciona una canción para comenzar a mezclar, editar y grabar.
        </p>

        <div className="space-y-4 text-left">
          {[
            { step: 1, title: "Selecciona una canción", desc: "Elige una canción completada del menú de arriba" },
            { step: 2, title: "Separa stems o agrega instrumentos", desc: "Divide la canción en tracks individuales o agrega instrumentos de Bachata" },
            { step: 3, title: "Mezcla, graba y aplica efectos", desc: "Ajusta volumen, EQ, reverb, graba voz y usa herramientas AI" },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-start gap-4 p-4 rounded-lg bg-white/[0.03] border border-white/5" data-testid={`flow-step-${step}`}>
              <div className="w-8 h-8 rounded-full bg-[#ff751f]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-bold text-[#ff751f]">{step}</span>
              </div>
              <div>
                <p className="font-medium text-sm">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {completedSongsCount === 0 && !songsLoading && (
          <div className="mt-8">
            <p className="text-sm text-muted-foreground mb-3">No tienes canciones todavía</p>
            <Button onClick={onGoCreate} className="gap-2 bg-[#ff751f] hover:bg-[#ff751f]/80" data-testid="button-go-create">
              <Plus className="w-4 h-4" />
              Crear mi primera canción
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function NoTracksPrompt({ songTitle, canUseStemSeparation, isSeparating, onSeparate, onOpenInstruments, onStartRecording }: {
  songTitle: string;
  canUseStemSeparation: boolean;
  isSeparating: boolean;
  onSeparate: () => void;
  onOpenInstruments: () => void;
  onStartRecording: () => void;
}) {
  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl mx-auto space-y-6">
        <div className="text-center mb-6">
          <h3 className="text-lg font-bold mb-2">"{songTitle}" está lista</h3>
          <p className="text-sm text-muted-foreground">Elige cómo quieres trabajar con esta canción:</p>
        </div>

        {canUseStemSeparation && (
          <button
            className="w-full p-5 rounded-xl border border-[#ff751f]/20 bg-gradient-to-r from-[#ff751f]/5 to-transparent hover:from-[#ff751f]/10 transition-all text-left group"
            onClick={onSeparate}
            disabled={isSeparating}
            data-testid="button-separate-stems"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#ff751f]/20 flex items-center justify-center flex-shrink-0">
                {isSeparating ? <Loader2 className="w-6 h-6 animate-spin text-[#ff751f]" /> : <Scissors className="w-6 h-6 text-[#ff751f]" />}
              </div>
              <div>
                <h4 className="font-bold text-base mb-1 group-hover:text-[#ff751f] transition-colors">Separar Stems con IA</h4>
                <p className="text-sm text-muted-foreground">
                  La IA separa la canción en tracks individuales: voces, batería, bajo y melodía. 
                  Podrás mezclar cada uno por separado.
                </p>
                {isSeparating && <p className="text-xs text-[#ff751f] mt-2 animate-pulse">Procesando separación de stems...</p>}
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-[#ff751f] flex-shrink-0 mt-1 transition-colors" />
            </div>
          </button>
        )}

        <button
          className="w-full p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-left group"
          onClick={onOpenInstruments}
          data-testid="button-add-instruments-flow"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#A78BFA]/20 flex items-center justify-center flex-shrink-0">
              <Piano className="w-6 h-6 text-[#A78BFA]" />
            </div>
            <div>
              <h4 className="font-bold text-base mb-1 group-hover:text-[#A78BFA] transition-colors">Agregar Instrumentos</h4>
              <p className="text-sm text-muted-foreground">
                Añade tracks de instrumentos de Bachata desde el panel lateral: Requinto, Bongo, Güira, Piano y más.
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-[#A78BFA] flex-shrink-0 mt-1 transition-colors" />
          </div>
        </button>

        <button
          className="w-full p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-left group"
          onClick={onStartRecording}
          data-testid="button-record-flow"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <Mic className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h4 className="font-bold text-base mb-1 group-hover:text-red-400 transition-colors">Grabar Voz</h4>
              <p className="text-sm text-muted-foreground">
                Graba tu voz directamente con el micrófono. La grabación se guardará como un nuevo track.
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-red-400 flex-shrink-0 mt-1 transition-colors" />
          </div>
        </button>
      </motion.div>
    </div>
  );
}
