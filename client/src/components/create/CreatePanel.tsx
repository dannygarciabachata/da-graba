import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Loader2,
  Sparkles,
  Music,
  Wand2,
  Clock,
  SlidersHorizontal,
  ChevronDown,
  Paperclip,
  Upload,
  MicIcon,
  Trash2,
  FileAudio,
  Dices,
  X,
  Guitar,
  Crown,
  Shield,
  User,
  Copyright,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { GenreCarousel } from "./GenreCarousel";
import {
  type DnaFlow,
  type CreationMode,
  TTS_LANGUAGES,
  GENRE_VALUE_TO_SLUG,
  GENRE_SLUG_TO_VALUE,
} from "./constants";

interface CreatePanelProps {
  prompt: string;
  setPrompt: (v: string) => void;
  selectedGenre: string;
  setSelectedGenre: (v: string) => void;
  showProControls: boolean;
  setShowProControls: (v: boolean) => void;
  title: string;
  setTitle: (v: string) => void;
  promptIntensity: number[];
  setPromptIntensity: (v: number[]) => void;
  lyricsIntensity: number[];
  setLyricsIntensity: (v: number[]) => void;
  isInstrumental: boolean;
  setIsInstrumental: (v: boolean) => void;
  songDuration: number;
  setSongDuration: (v: number) => void;
  lyrics: string;
  setLyrics: (v: string) => void;
  showLyrics: boolean;
  setShowLyrics: (v: boolean) => void;
  activeCreationMode: CreationMode;
  setActiveCreationMode: (v: CreationMode) => void;
  selectedStyleKit: number | undefined;
  setSelectedStyleKit: (v: number | undefined) => void;
  artistName: string;
  setArtistName: (v: string) => void;
  copyrightHolder: string;
  setCopyrightHolder: (v: string) => void;
  attachedFile: File | null;
  setAttachedFile: (v: File | null) => void;
  attachPopoverOpen: boolean;
  setAttachPopoverOpen: (v: boolean) => void;
  dnaFlow: DnaFlow;
  setDnaFlow: (v: DnaFlow) => void;
  selectedSubStyle: string | null;
  setSelectedSubStyle: (v: string | null) => void;
  selectedOrchestration: Set<string>;
  setSelectedOrchestration: (v: Set<string>) => void;
  soundPrompt: string;
  setSoundPrompt: (v: string) => void;
  soundDuration: number[];
  setSoundDuration: (v: number[]) => void;
  ttsText: string;
  setTtsText: (v: string) => void;
  ttsVoiceId: string;
  setTtsVoiceId: (v: string) => void;
  ttsLanguage: string;
  setTtsLanguage: (v: string) => void;
  placeholderIdx: number;
  activePromptSuggestions: string[];
  currentGenreSlug: string;
  currentGenreStyles: any[];
  selectedStyleData: any;
  styleKits: any[] | undefined;
  isAnyPending: boolean;
  canCreate: boolean;
  handleSubmit: () => void;
  handleRandomPrompt: () => void;
  handleFileAttach: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  setLocation: (path: string) => void;
}

export function CreatePanel(props: CreatePanelProps) {
  const { t } = useTranslation();
  const {
    prompt, setPrompt,
    selectedGenre, setSelectedGenre,
    showProControls, setShowProControls,
    title, setTitle,
    promptIntensity, setPromptIntensity,
    lyricsIntensity, setLyricsIntensity,
    isInstrumental, setIsInstrumental,
    songDuration, setSongDuration,
    lyrics, setLyrics,
    showLyrics, setShowLyrics,
    activeCreationMode, setActiveCreationMode,
    selectedStyleKit, setSelectedStyleKit,
    artistName, setArtistName,
    copyrightHolder, setCopyrightHolder,
    attachedFile, setAttachedFile,
    attachPopoverOpen, setAttachPopoverOpen,
    dnaFlow, setDnaFlow,
    selectedSubStyle, setSelectedSubStyle,
    selectedOrchestration, setSelectedOrchestration,
    soundPrompt, setSoundPrompt,
    soundDuration, setSoundDuration,
    ttsText, setTtsText,
    ttsVoiceId, setTtsVoiceId,
    ttsLanguage, setTtsLanguage,
    placeholderIdx, activePromptSuggestions,
    currentGenreSlug, currentGenreStyles, selectedStyleData,
    styleKits, isAnyPending, canCreate,
    handleSubmit, handleRandomPrompt, handleFileAttach, handleFileChange,
    fileInputRef, setLocation,
  } = props;

  return (
    <div className="relative" data-testid="creation-panel">
      <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-indigo-600 rounded-2xl blur-xl opacity-20 pointer-events-none" />
      <div className="relative bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-white/10 rounded-2xl p-8 overflow-y-auto max-h-[calc(100vh-180px)]">
        <div className="flex items-center gap-2 mb-6">
          <Wand2 className="h-5 w-5 text-orange-400" />
          <h2 className="text-xl font-semibold text-white" data-testid="text-create-heading">{t('create.pageTitle', 'Crea tu Sonido')}</h2>
        </div>

        <DnaFlowSelector
          dnaFlow={dnaFlow}
          setDnaFlow={setDnaFlow}
          setSelectedSubStyle={setSelectedSubStyle}
          setSelectedStyleKit={setSelectedStyleKit}
          setSelectedGenre={setSelectedGenre}
          styleKits={styleKits}
          currentGenreSlug={currentGenreSlug}
          currentGenreStyles={currentGenreStyles}
          selectedSubStyle={selectedSubStyle}
          selectedOrchestration={selectedOrchestration}
          setSelectedOrchestration={setSelectedOrchestration}
          selectedStyleData={selectedStyleData}
          selectedGenre={selectedGenre}
        />

        <div className="mb-4">
          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} data-testid="input-file-upload" />

          {activeCreationMode === "song" && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-orange-300 flex items-center gap-2">
                <Music className="w-4 h-4" />
                {t('create.describeMusic', 'Describe tu música')}
              </label>
              <div className="relative">
                <Textarea
                  placeholder={activePromptSuggestions[placeholderIdx % activePromptSuggestions.length]}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[120px] bg-black/40 border-orange-500/30 text-white placeholder:text-orange-300/40 focus:border-orange-500/60 focus:ring-orange-500/20 rounded-xl resize-none"
                  data-testid="input-prompt"
                  maxLength={500}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleSubmit();
                    }
                  }}
                />
                <div className="absolute bottom-3 right-3 text-xs text-orange-300/40">{prompt.length}/500</div>
              </div>
            </div>
          )}
          {activeCreationMode === "sound" && (
            <div className="space-y-3">
              <Textarea
                placeholder={t('create.soundPrompt.placeholder')}
                value={soundPrompt}
                onChange={(e) => setSoundPrompt(e.target.value)}
                className="bg-white/[0.03] border-white/10 focus:border-primary/40 min-h-[100px] resize-none text-sm placeholder:text-muted-foreground/40"
                data-testid="input-sound-prompt"
                maxLength={500}
              />
              <div className="flex items-center gap-3">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {soundDuration[0]}s
                </Label>
                <Slider value={soundDuration} onValueChange={setSoundDuration} min={1} max={30} step={1} className="flex-1 max-w-[200px]" data-testid="slider-sound-duration" />
              </div>
            </div>
          )}
          {activeCreationMode === "speak" && (
            <div className="space-y-3">
              <Textarea
                placeholder={t('create.ttsPrompt.placeholder')}
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                className="bg-white/[0.03] border-white/10 focus:border-primary/40 min-h-[100px] resize-none text-sm placeholder:text-muted-foreground/40"
                data-testid="input-tts-text"
                maxLength={2000}
              />
              <div className="flex items-center gap-3 flex-wrap">
                <Input placeholder={t('create.voiceDefault')} value={ttsVoiceId} onChange={(e) => setTtsVoiceId(e.target.value)} className="bg-background/50 border-white/10 text-xs w-[120px]" data-testid="input-tts-voice-id" />
                <select className="rounded-md border border-white/10 bg-background/50 px-2 py-1 text-xs" value={ttsLanguage} onChange={(e) => setTtsLanguage(e.target.value)} data-testid="select-tts-language">
                  {TTS_LANGUAGES.map((lang) => (<option key={lang.value} value={lang.value}>{lang.label}</option>))}
                </select>
              </div>
            </div>
          )}

          {attachedFile && (
            <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-primary/5 border border-primary/20">
              <FileAudio className="h-4 w-4 text-primary" />
              <span className="text-xs text-primary flex-1 truncate">{attachedFile.name}</span>
              <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => setAttachedFile(null)} data-testid="button-remove-file">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Popover open={attachPopoverOpen} onOpenChange={setAttachPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="h-8 px-3 rounded-full border border-white/10 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors" data-testid="button-attach-menu">
                <Paperclip className="h-3 w-3" />+Audio
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-52 p-1.5" sideOffset={8}>
              <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm transition-colors text-left" onClick={handleFileAttach} data-testid="menu-upload-file">
                <Upload className="h-4 w-4 text-muted-foreground" />{t('create.attach.uploadFile')}
              </button>
              <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm transition-colors text-left" onClick={() => { setAttachPopoverOpen(false); setLocation("/sample-lab"); }} data-testid="menu-record">
                <MicIcon className="h-4 w-4 text-muted-foreground" />{t('create.attach.record')}
              </button>
            </PopoverContent>
          </Popover>

          {activeCreationMode === "song" && (
            <button
              className={cn(
                "h-8 px-3 rounded-full border flex items-center gap-1.5 text-xs transition-colors",
                showLyrics ? "border-primary/40 text-primary bg-primary/10" : "border-white/10 text-muted-foreground"
              )}
              onClick={() => { setShowLyrics(!showLyrics); if (isInstrumental) setIsInstrumental(false); }}
              data-testid="button-add-lyrics"
            >
              +{t('create.lyrics.label')}
            </button>
          )}

          <div className="flex-1" />

          {activeCreationMode === "song" && (
            <button
              className={cn(
                "h-8 px-3.5 rounded-full border flex items-center gap-1.5 text-xs transition-colors",
                isInstrumental ? "border-primary/40 text-primary bg-primary/10" : "border-white/10 text-muted-foreground"
              )}
              onClick={() => setIsInstrumental(!isInstrumental)}
              data-testid="button-instrumental"
            >
              <div className={cn("h-3 w-6 rounded-full relative transition-colors", isInstrumental ? "bg-primary" : "bg-white/20")}>
                <div className={cn("absolute top-0.5 h-2 w-2 rounded-full bg-white transition-all", isInstrumental ? "left-3.5" : "left-0.5")} />
              </div>
              {t('create.options.instrumental')}
            </button>
          )}
        </div>

        {showLyrics && !isInstrumental && activeCreationMode === "song" && (
          <div className="mb-4">
            <Textarea
              placeholder={t('create.lyrics.lyricsPlaceholder')}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              className="bg-white/[0.03] border-white/10 focus:border-primary/40 min-h-[80px] resize-none text-sm font-mono"
              data-testid="input-lyrics"
              maxLength={3000}
            />
          </div>
        )}

        <div className="space-y-3 mb-4">
          <label className="text-sm font-medium text-orange-300 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('create.duration', 'Duración')}
            <span className="ml-auto text-orange-400">{Math.floor(songDuration / 60)}:{String(songDuration % 60).padStart(2, "0")}</span>
          </label>
          <Slider value={[songDuration]} onValueChange={(v) => setSongDuration(v[0])} min={30} max={300} step={10} className="py-2" data-testid="slider-duration" />
          <div className="flex justify-between text-xs text-orange-300/60"><span>0:30</span><span>5:00</span></div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span className="text-[10px] text-orange-300/60 uppercase tracking-wider mr-1">Inspiration</span>
          <span className="px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-[11px] text-orange-300 flex items-center gap-1.5">
            {selectedGenre}
            <button onClick={() => setSelectedGenre("Bachata")} className="text-orange-300/60">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
          <button
            className="px-2.5 py-1 rounded-full border border-dashed border-orange-500/30 text-[11px] text-orange-300/60 flex items-center gap-1 hover:border-orange-500/60 transition-colors"
            onClick={handleRandomPrompt}
            data-testid="chip-random"
          >
            <Dices className="h-2.5 w-2.5 text-orange-400" />+ random
          </button>
        </div>

        {activeCreationMode === "song" && (
          <div className="mb-4" data-testid="genre-carousel-left">
            <GenreCarousel selectedGenre={selectedGenre} onSelect={(g) => {
              setSelectedGenre(g);
              setSelectedSubStyle(null);
              setSelectedOrchestration(new Set());
              const slug = GENRE_VALUE_TO_SLUG[g];
              if (slug === "bachata" || slug === "bolero") {
                setDnaFlow(slug as "bachata" | "bolero");
              } else {
                setDnaFlow(null);
              }
            }} />
            <AnimatePresence>
              {!dnaFlow && currentGenreStyles.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-3"
                >
                  <div className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Tocadas / Estilos</div>
                  <div className="flex gap-2 flex-wrap" data-testid="carousel-sub-styles">
                    {currentGenreStyles.map((style: any) => (
                      <button
                        key={style.slug}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                          selectedSubStyle === style.slug
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-white/10 text-muted-foreground hover:border-white/20"
                        )}
                        onClick={() => {
                          const isDeselecting = selectedSubStyle === style.slug;
                          setSelectedSubStyle(isDeselecting ? null : style.slug);
                          setSelectedOrchestration(new Set());
                          if (!isDeselecting) {
                            const genreName = GENRE_SLUG_TO_VALUE[currentGenreSlug] || selectedGenre;
                            setSelectedGenre(`${genreName} ${style.name}`);
                          } else {
                            setSelectedGenre(GENRE_SLUG_TO_VALUE[currentGenreSlug] || selectedGenre.split(" ")[0]);
                          }
                        }}
                        data-testid={`carousel-sub-style-${style.slug}`}
                      >
                        {style.name}
                      </button>
                    ))}
                  </div>
                  {selectedStyleData && (selectedStyleData.baseInstruments?.length > 0 || selectedStyleData.extraInstruments?.length > 0) && (
                    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 mt-3">
                      {selectedStyleData.baseInstruments?.length > 0 && (
                        <div className="mb-2">
                          <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">{t('create.dnaFlow.orchestration.baseLabel')}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedStyleData.baseInstruments.map((instr: string) => (
                              <span key={instr} className="px-2 py-0.5 rounded-md bg-primary/15 border border-primary/20 text-[10px] text-primary" data-testid={`carousel-base-instr-${instr}`}>
                                {instr.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedStyleData.extraInstruments?.length > 0 && (
                        <div>
                          <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">{t('create.dnaFlow.orchestration.extrasLabel')}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedStyleData.extraInstruments.map((instr: string) => {
                              const isSelected = selectedOrchestration.has(instr);
                              return (
                                <button key={instr} className={cn("px-2.5 py-1 rounded-lg border text-[11px] transition-all", isSelected ? "border-primary/50 bg-primary/20 text-primary" : "border-white/10 text-muted-foreground hover:border-white/20")}
                                  onClick={() => { const next = new Set(selectedOrchestration); if (isSelected) next.delete(instr); else next.add(instr); setSelectedOrchestration(next); }}
                                  data-testid={`carousel-orch-${instr}`}
                                >
                                  {instr.replace(/_/g, " ")}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="flex items-center gap-2 mb-5 overflow-x-auto">
          <button
            className={cn("flex-shrink-0 h-7 px-3 rounded-full border flex items-center gap-1.5 text-[11px] transition-colors whitespace-nowrap", activeCreationMode === "sound" ? "border-primary/40 text-primary bg-primary/10" : "border-white/10 text-muted-foreground")}
            onClick={() => setActiveCreationMode(activeCreationMode === "sound" ? "song" : "sound")}
            data-testid="chip-create-sound"
          >
            <Sparkles className="h-2.5 w-2.5 text-orange-400" />{t('create.modes.sound')}
          </button>
          <button
            className={cn("flex-shrink-0 h-7 px-3 rounded-full border flex items-center gap-1.5 text-[11px] transition-colors whitespace-nowrap", activeCreationMode === "speak" ? "border-primary/40 text-primary bg-primary/10" : "border-white/10 text-muted-foreground")}
            onClick={() => setActiveCreationMode(activeCreationMode === "speak" ? "song" : "speak")}
            data-testid="chip-speak-text"
          >
            <MessageSquare className="h-2.5 w-2.5 text-orange-400" />{t('create.modes.speak')}
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isAnyPending || !canCreate}
          className={cn(
            "w-full py-4 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-2xl hover:shadow-orange-500/50 transition-all relative overflow-hidden flex items-center justify-center gap-2"
          )}
          data-testid="button-submit"
        >
          {isAnyPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
          {isAnyPending ? t('create.generating', 'Generando tu obra maestra...') : t('create.createButton', 'Generar Música')}
        </button>

        <div className="flex items-center gap-1.5 mt-3 mb-3">
          <Shield className="h-3 w-3 text-primary/60 flex-shrink-0" />
          <span className="text-[10px] text-muted-foreground/70">{t('create.adnProtegido', 'Usando instrumentos originales DGB — ADN Protegido')}</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "text-xs mb-2 px-0",
            showProControls ? "text-primary" : "text-muted-foreground"
          )}
          onClick={() => setShowProControls(!showProControls)}
          data-testid="button-pro-controls"
        >
          <SlidersHorizontal className="h-3 w-3" />
          {t('create.unlockCustomization')}
          <ChevronDown className={cn("h-3 w-3 transition-transform", showProControls && "rotate-180")} />
        </Button>

        <AnimatePresence>
          {showProControls && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-5"
            >
              <Card className="border-white/5 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-900/30 to-amber-800/20 border-b border-amber-500/20 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-400" />
                    <span className="text-sm text-amber-200/80">{t('create.unlockCustomization')}</span>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('create.title_field.label')}</Label>
                    <Input placeholder={t('create.title_field.inputPlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} className="bg-background/50 border-white/10" data-testid="input-title" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('create.promptIntensity')}</Label>
                    <div className="flex items-center gap-3">
                      <Slider value={promptIntensity} onValueChange={setPromptIntensity} min={0} max={100} step={1} className="flex-1" data-testid="slider-prompt-intensity" />
                      <span className="text-xs font-mono text-muted-foreground w-8 text-right">{promptIntensity[0]}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('create.lyricsIntensity')}</Label>
                    <div className="flex items-center gap-3">
                      <Slider value={lyricsIntensity} onValueChange={setLyricsIntensity} min={0} max={100} step={1} className="flex-1" data-testid="slider-lyrics-intensity" />
                      <span className="text-xs font-mono text-muted-foreground w-8 text-right">{lyricsIntensity[0]}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground" /><Label className="text-sm font-medium">{t('create.artistName')}</Label></div>
                    <Input placeholder={t('create.artistNamePlaceholder')} value={artistName} onChange={(e) => setArtistName(e.target.value)} className="bg-background/50 border-white/10" data-testid="input-artist-name" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2"><Copyright className="h-3.5 w-3.5 text-muted-foreground" /><Label className="text-sm font-medium">{t('create.copyrightHolder')}</Label></div>
                    <Input placeholder="Da Graba LLC" value={copyrightHolder} onChange={(e) => setCopyrightHolder(e.target.value)} className="bg-background/50 border-white/10" data-testid="input-copyright-holder" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-muted-foreground" /><Label className="text-sm font-medium">{t('create.songDuration')}</Label></div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[60, 120, 180, 240, 300].map((d) => (
                        <Badge key={d} variant={songDuration === d ? "default" : "outline"} className={cn("cursor-pointer text-xs py-1 px-2.5", songDuration === d ? "bg-primary/15 text-primary border-primary/30" : "text-muted-foreground border-white/10")} onClick={() => setSongDuration(d)} data-testid={`badge-duration-${d}`}>
                          {d >= 60 ? `${Math.floor(d / 60)}:${String(d % 60).padStart(2, "0")}` : `${d}s`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {styleKits && styleKits.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">{t('create.styleKit')}</Label>
                      <select className="w-full rounded-md border border-white/10 bg-background/50 px-3 py-2 text-sm" value={selectedStyleKit || ""} onChange={(e) => setSelectedStyleKit(e.target.value ? Number(e.target.value) : undefined)} data-testid="select-style-kit">
                        <option value="">{t('create.noneDefault')}</option>
                        {styleKits.map((kit) => (<option key={kit.id} value={kit.id}>{kit.name} ({kit.genre.replace(/_/g, " ")})</option>))}
                      </select>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DnaFlowSelector({
  dnaFlow, setDnaFlow,
  setSelectedSubStyle, setSelectedStyleKit, setSelectedGenre,
  styleKits, currentGenreSlug, currentGenreStyles,
  selectedSubStyle, selectedOrchestration, setSelectedOrchestration,
  selectedStyleData, selectedGenre,
}: {
  dnaFlow: DnaFlow;
  setDnaFlow: (v: DnaFlow) => void;
  setSelectedSubStyle: (v: string | null) => void;
  setSelectedStyleKit: (v: number | undefined) => void;
  setSelectedGenre: (v: string) => void;
  styleKits: any[] | undefined;
  currentGenreSlug: string;
  currentGenreStyles: any[];
  selectedSubStyle: string | null;
  selectedOrchestration: Set<string>;
  setSelectedOrchestration: (v: Set<string>) => void;
  selectedStyleData: any;
  selectedGenre: string;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-4" data-testid="dna-flows">
        <button
          className={cn(
            "rounded-lg p-2.5 text-left transition-all border",
            dnaFlow === "bachata"
              ? "border-primary bg-primary/10"
              : "border-white/10 bg-white/[0.03]"
          )}
          onClick={() => {
            if (dnaFlow === "bachata") {
              setDnaFlow(null);
              setSelectedSubStyle(null);
              setSelectedStyleKit(undefined);
            } else {
              setDnaFlow("bachata");
              setSelectedSubStyle(null);
              setSelectedGenre("Bachata");
              const bachataKit = styleKits?.find(k => k.genre === "bachata");
              if (bachataKit) setSelectedStyleKit(bachataKit.id);
            }
          }}
          data-testid="dna-flow-bachata"
        >
          <div className="flex items-center gap-1.5">
            <Guitar className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold">DA GRABACHATA</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{t('create.dnaFlow.bachataDesc')}</p>
        </button>

        <button
          className={cn(
            "rounded-lg p-2.5 text-left transition-all border",
            dnaFlow === "bolero"
              ? "border-orange-400 bg-orange-500/10"
              : "border-white/10 bg-white/[0.03]"
          )}
          onClick={() => {
            if (dnaFlow === "bolero") {
              setDnaFlow(null);
              setSelectedSubStyle(null);
              setSelectedStyleKit(undefined);
            } else {
              setDnaFlow("bolero");
              setSelectedSubStyle(null);
              setSelectedGenre("Bolero");
              const dgbBoleroKit = styleKits?.find(k => k.genre === "dgb_bolero");
              if (dgbBoleroKit) setSelectedStyleKit(dgbBoleroKit.id);
            }
          }}
          data-testid="dna-flow-bolero"
        >
          <div className="flex items-center gap-1.5">
            <Music className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-xs font-bold">DA GRABOLERO</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{t('create.dnaFlow.boleroDesc')}</p>
        </button>
      </div>

      <AnimatePresence>
        {dnaFlow && currentGenreStyles.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="flex gap-2 flex-wrap pb-1" data-testid="sub-styles">
              {currentGenreStyles.map((style: any) => {
                const isBachata = currentGenreSlug === "bachata";
                const isBolero = currentGenreSlug === "bolero";
                return (
                  <button
                    key={style.slug}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                      selectedSubStyle === style.slug
                        ? isBachata
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : isBolero
                            ? "border-orange-400/50 bg-orange-500/10 text-orange-300"
                            : "border-primary/50 bg-primary/10 text-primary"
                        : "border-white/10 text-muted-foreground hover:border-white/20"
                    )}
                    onClick={() => {
                      const isDeselecting = selectedSubStyle === style.slug;
                      setSelectedSubStyle(isDeselecting ? null : style.slug);
                      setSelectedOrchestration(new Set());
                      if (!isDeselecting) {
                        const genreName = GENRE_SLUG_TO_VALUE[currentGenreSlug] || selectedGenre;
                        setSelectedGenre(`${genreName} ${style.name}`);
                        if (style.styleKitId) setSelectedStyleKit(style.styleKitId);
                      } else {
                        setSelectedGenre(GENRE_SLUG_TO_VALUE[currentGenreSlug] || selectedGenre.split(" ")[0]);
                      }
                    }}
                    data-testid={`sub-style-${style.slug}`}
                  >
                    {style.name}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dnaFlow && selectedStyleData && (selectedStyleData.baseInstruments?.length > 0 || selectedStyleData.extraInstruments?.length > 0) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className={cn(
              "rounded-xl border p-4",
              currentGenreSlug === "bolero"
                ? "border-orange-400/20 bg-orange-500/[0.04]"
                : "border-primary/20 bg-primary/[0.04]"
            )} data-testid="orchestration-panel">
              <div className="flex items-center gap-2 mb-3">
                <SlidersHorizontal className={cn("h-3.5 w-3.5", currentGenreSlug === "bolero" ? "text-orange-400" : "text-primary")} />
                <span className={cn("text-xs font-semibold", currentGenreSlug === "bolero" ? "text-orange-300" : "text-primary")}>{t('create.dnaFlow.orchestration.title')}</span>
              </div>
              {selectedStyleData.baseInstruments?.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">{t('create.dnaFlow.orchestration.baseLabel')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedStyleData.baseInstruments.map((instr: string) => (
                      <span
                        key={instr}
                        className={cn(
                          "px-2 py-0.5 rounded-md border text-[10px]",
                          currentGenreSlug === "bolero"
                            ? "bg-orange-500/15 border-orange-400/20 text-orange-300"
                            : "bg-primary/15 border-primary/20 text-primary"
                        )}
                        data-testid={`base-instr-${instr}`}
                      >
                        {instr.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedStyleData.extraInstruments?.length > 0 && (
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">{t('create.dnaFlow.orchestration.extrasLabel')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedStyleData.extraInstruments.map((instr: string) => {
                      const isSelected = selectedOrchestration.has(instr);
                      return (
                        <button
                          key={instr}
                          className={cn(
                            "px-2.5 py-1 rounded-lg border text-[11px] transition-all",
                            isSelected
                              ? currentGenreSlug === "bolero"
                                ? "border-orange-400/50 bg-orange-500/20 text-orange-200"
                                : "border-primary/50 bg-primary/20 text-primary"
                              : "border-white/10 text-muted-foreground hover:border-white/20"
                          )}
                          onClick={() => {
                            const next = new Set(selectedOrchestration);
                            if (isSelected) next.delete(instr);
                            else next.add(instr);
                            setSelectedOrchestration(next);
                          }}
                          data-testid={`orch-${instr}`}
                        >
                          {instr.replace(/_/g, " ")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
