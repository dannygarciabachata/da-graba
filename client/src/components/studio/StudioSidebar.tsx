import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SlidersVertical } from "lucide-react";
import { InstrumentsPanel } from "./InstrumentsPanel";
import { EffectsPanel } from "./EffectsPanel";
import { AIToolsPanel } from "./AIToolsPanel";
import type { Track } from "@shared/schema";
import type { useAudioEngine } from "@/hooks/use-audio-engine";
import type { BachataInstrument } from "./constants";

interface StudioSidebarProps {
  sidebarTab: string;
  onTabChange: (tab: string) => void;
  selectedSong: boolean;
  selectedSongId: number | null;
  hasTracks: boolean;
  isCreatingTrack: boolean;
  onAddInstrument: (instrument: BachataInstrument) => void;
  onGoToSampleLab: () => void;
  activeTrack: Track | undefined;
  activeTrackId: number | null;
  activeEngineTrack: ReturnType<ReturnType<typeof useAudioEngine>["tracks"]["get"]>;
  engine: ReturnType<typeof useAudioEngine>;
  onUpdateTrack: (data: { id: number; volume?: number }) => void;
  onOpenMixer: () => void;
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

export function StudioSidebar(props: StudioSidebarProps) {
  return (
    <div className="w-[280px] border-l border-white/10 bg-[#0d0d0d] flex flex-col overflow-hidden flex-shrink-0" data-testid="studio-sidebar">
      <Tabs value={props.sidebarTab} onValueChange={props.onTabChange} className="flex flex-col h-full">
        <TabsList className="bg-transparent border-b border-white/10 rounded-none h-10 px-2 flex-shrink-0">
          <TabsTrigger value="instruments" className="text-xs px-3 h-8 data-[state=active]:bg-[#ff751f]/10 data-[state=active]:text-[#ff751f]" data-testid="tab-instruments">
            🎸 Instrumentos
          </TabsTrigger>
          <TabsTrigger value="effects" className="text-xs px-3 h-8 data-[state=active]:bg-[#ff751f]/10 data-[state=active]:text-[#ff751f]" data-testid="tab-effects">
            <SlidersVertical className="w-3.5 h-3.5 mr-1" />
            FX
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-xs px-3 h-8 data-[state=active]:bg-[#ff751f]/10 data-[state=active]:text-[#ff751f]" data-testid="tab-ai-tools">
            ✨ AI
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="instruments" className="m-0">
            <InstrumentsPanel
              selectedSong={props.selectedSong}
              isCreatingTrack={props.isCreatingTrack}
              onAddInstrument={props.onAddInstrument}
              onGoToSampleLab={props.onGoToSampleLab}
            />
          </TabsContent>

          <TabsContent value="effects" className="m-0">
            <EffectsPanel
              selectedSong={props.selectedSong}
              hasTracks={props.hasTracks}
              activeTrack={props.activeTrack}
              activeTrackId={props.activeTrackId}
              activeEngineTrack={props.activeEngineTrack}
              engine={props.engine}
              onUpdateTrack={props.onUpdateTrack}
              onOpenMixer={props.onOpenMixer}
            />
          </TabsContent>

          <TabsContent value="ai" className="m-0">
            <AIToolsPanel
              selectedSongId={props.selectedSongId}
              canUseStemSeparation={props.canUseStemSeparation}
              isSeparating={props.isSeparating}
              isMastering={props.isMastering}
              isDenoising={props.isDenoising}
              isCovering={props.isCovering}
              isTrimming={props.isTrimming}
              isDownloadingAll={props.isDownloadingAll}
              coverVoice={props.coverVoice}
              trimStart={props.trimStart}
              trimEnd={props.trimEnd}
              hasCompletedTracks={props.hasCompletedTracks}
              onCoverVoiceChange={props.onCoverVoiceChange}
              onTrimStartChange={props.onTrimStartChange}
              onTrimEndChange={props.onTrimEndChange}
              onSeparateStems={props.onSeparateStems}
              onMaster={props.onMaster}
              onDenoise={props.onDenoise}
              onCover={props.onCover}
              onTrim={props.onTrim}
              onDownloadAll={props.onDownloadAll}
            />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
