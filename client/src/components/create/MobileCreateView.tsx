import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Sparkles,
  Music,
  Wand2,
  Clock,
  Dices,
  Guitar,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  type DnaFlow,
  type CreationMode,
  GENRE_CATEGORIES,
  GENRE_VALUE_TO_SLUG,
  GENRE_SLUG_TO_VALUE,
} from "./constants";

interface MobileCreateViewProps {
  prompt: string;
  setPrompt: (v: string) => void;
  selectedGenre: string;
  setSelectedGenre: (v: string) => void;
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
  dnaFlow: DnaFlow;
  setDnaFlow: (v: DnaFlow) => void;
  selectedSubStyle: string | null;
  setSelectedSubStyle: (v: string | null) => void;
  selectedOrchestration: Set<string>;
  setSelectedOrchestration: (v: Set<string>) => void;
  soundPrompt: string;
  setSoundPrompt: (v: string) => void;
  ttsText: string;
  setTtsText: (v: string) => void;
  placeholderIdx: number;
  activePromptSuggestions: string[];
  currentGenreSlug: string;
  currentGenreStyles: any[];
  styleKits: any[] | undefined;
  selectedStyleKit: number | undefined;
  setSelectedStyleKit: (v: number | undefined) => void;
  handleSubmit: () => void;
  handleRandomPrompt: () => void;
}

export function MobileCreateView(props: MobileCreateViewProps) {
  const { t } = useTranslation();
  const {
    prompt, setPrompt,
    selectedGenre, setSelectedGenre,
    isInstrumental, setIsInstrumental,
    songDuration, setSongDuration,
    lyrics, setLyrics,
    showLyrics, setShowLyrics,
    activeCreationMode, setActiveCreationMode,
    dnaFlow, setDnaFlow,
    selectedSubStyle, setSelectedSubStyle,
    selectedOrchestration, setSelectedOrchestration,
    soundPrompt, setSoundPrompt,
    ttsText, setTtsText,
    placeholderIdx, activePromptSuggestions,
    currentGenreSlug, currentGenreStyles,
    styleKits, selectedStyleKit, setSelectedStyleKit,
    handleSubmit, handleRandomPrompt,
  } = props;

  return (
    <div className="px-3 pt-3 pb-28 space-y-3" data-testid="mobile-create-view">
      <div className="flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold">{t('create.pageTitle')}</h2>
      </div>

      <div className="grid grid-cols-2 gap-2" data-testid="mobile-dna-flows">
        <button
          className={cn("rounded-lg p-2 text-center transition-all border", dnaFlow === "bachata" ? "border-primary bg-primary/15" : "border-white/15 bg-white/[0.04]")}
          onClick={() => { if (dnaFlow === "bachata") { setDnaFlow(null); setSelectedSubStyle(null); setSelectedStyleKit(undefined); } else { setDnaFlow("bachata"); setSelectedSubStyle(null); setSelectedGenre("Bachata"); const k = styleKits?.find(k => k.genre === "bachata"); if (k) setSelectedStyleKit(k.id); } }}
          data-testid="mobile-dna-bachata"
        >
          <div className="flex items-center justify-center gap-1.5"><Guitar className="h-3.5 w-3.5 text-primary" /><span className="text-[11px] font-bold text-primary">GRABACHATA</span></div>
        </button>
        <button
          className={cn("rounded-lg p-2 text-center transition-all border", dnaFlow === "bolero" ? "border-orange-400 bg-orange-500/15" : "border-white/15 bg-white/[0.04]")}
          onClick={() => { if (dnaFlow === "bolero") { setDnaFlow(null); setSelectedSubStyle(null); setSelectedStyleKit(undefined); } else { setDnaFlow("bolero"); setSelectedSubStyle(null); setSelectedGenre("Bolero"); const k = styleKits?.find(k => k.genre === "dgb_bolero"); if (k) setSelectedStyleKit(k.id); } }}
          data-testid="mobile-dna-bolero"
        >
          <div className="flex items-center justify-center gap-1.5"><Music className="h-3.5 w-3.5 text-orange-400" /><span className="text-[11px] font-bold text-orange-400">GRABOLERO</span></div>
        </button>
      </div>

      <AnimatePresence>
        {currentGenreStyles.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex gap-2 overflow-x-scroll pb-1 touch-pan-x" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as any}>
              {currentGenreStyles.map((style: any) => (
                <button key={style.slug} className={cn("flex-shrink-0 px-3 py-1.5 rounded-full border text-[11px] font-medium whitespace-nowrap", selectedSubStyle === style.slug ? (currentGenreSlug === "bachata" ? "border-primary/50 bg-primary/10 text-primary" : currentGenreSlug === "bolero" ? "border-orange-400/50 bg-orange-500/10 text-orange-300" : "border-primary/50 bg-primary/10 text-primary") : "border-white/15 text-muted-foreground")}
                  onClick={() => {
                    const des = selectedSubStyle === style.slug;
                    setSelectedSubStyle(des ? null : style.slug);
                    setSelectedOrchestration(new Set());
                    if (!des) { setSelectedGenre(`${GENRE_SLUG_TO_VALUE[currentGenreSlug] || selectedGenre} ${style.name}`); }
                    else { setSelectedGenre(GENRE_SLUG_TO_VALUE[currentGenreSlug] || selectedGenre.split(" ")[0]); }
                  }}
                  data-testid={`mobile-sub-style-${style.slug}`}
                >{style.name}</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeCreationMode === "song" && (
        <div data-testid="mobile-genre-carousel">
          <div className="flex gap-2 overflow-x-scroll pb-1.5 touch-pan-x" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as any}>
            {GENRE_CATEGORIES.flatMap((cat) => cat.genres).map((genre) => (
              <button
                key={genre.value}
                className={cn(
                  "flex-shrink-0 h-8 px-3 rounded-full border text-[11px] font-medium whitespace-nowrap transition-all",
                  selectedGenre === genre.value
                    ? (genre as any).accent
                      ? "border-primary bg-primary/20 text-primary shadow-[0_0_8px_rgba(255,117,31,0.3)]"
                      : "border-primary/60 bg-primary/10 text-primary"
                    : "border-white/15 bg-white/[0.04] text-muted-foreground"
                )}
                onClick={() => {
                  setSelectedGenre(genre.value);
                  setSelectedSubStyle(null);
                  setSelectedOrchestration(new Set());
                  const slug = GENRE_VALUE_TO_SLUG[genre.value];
                  if (slug === "bachata" || slug === "bolero") {
                    setDnaFlow(slug as "bachata" | "bolero");
                  } else {
                    setDnaFlow(null);
                  }
                }}
                data-testid={`mobile-genre-${genre.value}`}
              >
                {genre.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        {activeCreationMode === "song" && (
          <Textarea placeholder={activePromptSuggestions[placeholderIdx % activePromptSuggestions.length]} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="bg-white/[0.03] border-white/10 min-h-[90px] resize-none text-sm placeholder:text-muted-foreground/40" data-testid="mobile-input-prompt" maxLength={500} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }} />
        )}
        {activeCreationMode === "sound" && (
          <Textarea placeholder={t('create.soundPrompt.placeholder')} value={soundPrompt} onChange={(e) => setSoundPrompt(e.target.value)} className="bg-white/[0.03] border-white/10 min-h-[90px] resize-none text-sm placeholder:text-muted-foreground/40" data-testid="mobile-input-sound" maxLength={500} />
        )}
        {activeCreationMode === "speak" && (
          <Textarea placeholder={t('create.ttsPrompt.placeholder')} value={ttsText} onChange={(e) => setTtsText(e.target.value)} className="bg-white/[0.03] border-white/10 min-h-[90px] resize-none text-sm placeholder:text-muted-foreground/40" data-testid="mobile-input-tts" maxLength={2000} />
        )}
        {showLyrics && !isInstrumental && activeCreationMode === "song" && (
          <div className="mt-2">
            <Textarea placeholder={t('create.lyrics.lyricsPlaceholder')} value={lyrics} onChange={(e) => setLyrics(e.target.value)} className="bg-white/[0.03] border-white/10 min-h-[70px] resize-none text-sm font-mono" data-testid="mobile-input-lyrics" maxLength={3000} />
          </div>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-scroll touch-pan-x" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as any}>
        <button className={cn("flex-shrink-0 h-7 px-2.5 rounded-full border flex items-center gap-1 text-[11px] whitespace-nowrap", isInstrumental ? "border-primary/40 text-primary bg-primary/10" : "border-white/15 text-muted-foreground")} onClick={() => setIsInstrumental(!isInstrumental)} data-testid="mobile-btn-instrumental">
          <div className={cn("h-2.5 w-5 rounded-full relative transition-colors", isInstrumental ? "bg-primary" : "bg-white/20")}>
            <div className={cn("absolute top-0.5 h-1.5 w-1.5 rounded-full bg-white transition-all", isInstrumental ? "left-3" : "left-0.5")} />
          </div>
          {t('create.options.instrumental')}
        </button>
        <button className={cn("flex-shrink-0 h-7 px-2.5 rounded-full border flex items-center gap-1 text-[11px] whitespace-nowrap", showLyrics ? "border-primary/40 text-primary bg-primary/10" : "border-white/15 text-muted-foreground")} onClick={() => { setShowLyrics(!showLyrics); if (isInstrumental) setIsInstrumental(false); }} data-testid="mobile-btn-lyrics">
          +{t('create.lyrics.label')}
        </button>
        <button className="flex-shrink-0 h-7 px-2.5 rounded-full border border-white/15 flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap" onClick={handleRandomPrompt} data-testid="mobile-btn-random">
          <Dices className="h-3 w-3 text-orange-400" />{t('create.random')}
        </button>
        <button className={cn("flex-shrink-0 h-7 px-2.5 rounded-full border flex items-center gap-1 text-[11px] whitespace-nowrap", activeCreationMode === "sound" ? "border-primary/40 text-primary bg-primary/10" : "border-white/15 text-muted-foreground")} onClick={() => setActiveCreationMode(activeCreationMode === "sound" ? "song" : "sound")} data-testid="mobile-chip-sound">
          <Sparkles className="h-2.5 w-2.5" />{t('create.modes.sound')}
        </button>
        <button className={cn("flex-shrink-0 h-7 px-2.5 rounded-full border flex items-center gap-1 text-[11px] whitespace-nowrap", activeCreationMode === "speak" ? "border-primary/40 text-primary bg-primary/10" : "border-white/15 text-muted-foreground")} onClick={() => setActiveCreationMode(activeCreationMode === "speak" ? "song" : "speak")} data-testid="mobile-chip-speak">
          <MessageSquare className="h-2.5 w-2.5" />{t('create.modes.speak')}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <span className="text-[11px] text-muted-foreground flex-shrink-0">{Math.floor(songDuration / 60)}:{String(songDuration % 60).padStart(2, "0")}</span>
        <Slider value={[songDuration]} onValueChange={(v) => setSongDuration(v[0])} min={30} max={300} step={10} className="flex-1" data-testid="mobile-slider-duration" />
      </div>
    </div>
  );
}
