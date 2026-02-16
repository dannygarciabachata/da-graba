import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useGenerateSong, useSongs } from "@/hooks/use-songs";
import { useStyleKits } from "@/hooks/use-style-kits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Loader2,
  Sparkles,
  Music,
  Mic,
  FileAudio,
  Send,
  ChevronDown,
  ChevronRight,
  Dices,
  Play,
  Clock,
  AlertCircle,
  Trash2,
  Scissors,
  ThumbsUp,
  Zap,
  SlidersHorizontal,
  Info,
  User,
  Copyright,
  Paperclip,
  ArrowRight,
  Wrench,
  RefreshCw,
  Upload,
  MicIcon,
  Link2,
  History,
  MessageSquare,
  Wand2,
  Crown,
  RotateCw,
  Replace,
  ArrowRightToLine,
  MicVocal,
  Guitar,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useDeleteSong } from "@/hooks/use-songs";
import { AudioPlayer } from "@/components/AudioPlayer";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";


const GENRE_CARDS = [
  { value: "Bachata", likes: "97K" },
  { value: "R&B", likes: "48K" },
  { value: "Hip Hop", likes: "45K" },
  { value: "Pop", likes: "32K" },
  { value: "Reggaeton", likes: "29K" },
  { value: "EDM", likes: "31K" },
  { value: "K-pop", likes: "38K" },
  { value: "Afrobeat", likes: "41K" },
  { value: "Jazz", likes: "13K" },
  { value: "Rock", likes: "25K" },
  { value: "Synthwave", likes: "27K" },
  { value: "House", likes: "18K" },
  { value: "Soul", likes: "23K" },
  { value: "Country", likes: "15K" },
  { value: "Bolero", likes: "16K" },
  { value: "Blues", likes: "12K" },
  { value: "Indie", likes: "21K" },
  { value: "Classical", likes: "9K" },
  { value: "Funk", likes: "17K" },
  { value: "Latin Pop", likes: "34K" },
  { value: "Drum & Bass", likes: "14K" },
];

const PROMPT_SUGGESTIONS = [
  "R&B with female vocals about Los Angeles",
  "Upbeat pop anthem about summer freedom",
  "Romantic bachata under Caribbean moonlight",
  "Chill lo-fi hip hop beat for studying",
  "Energetic EDM drop with euphoric synths",
  "Soulful jazz ballad with saxophone",
  "Dark trap beat with heavy 808s",
  "Acoustic folk song about road trips",
];

const TTS_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
];

type DnaFlow = "bachata" | "bolero" | null;

const BACHATA_STYLE_KEYS = ["tradicional", "moderna", "sensual", "urbana", "rosa"] as const;
const BOLERO_STYLE_KEYS = ["romantico", "ranchero", "son", "moderno"] as const;

const DGB_BOLERO_BASE_INSTRUMENTS = [
  "bongo", "conga", "guira", "timbal", "campanas",
  "requinto", "segunda_guitarra", "bajo",
  "voz_principal", "duo_voz",
] as const;

const DGB_BOLERO_ORCHESTRATION = [
  "piano", "pad", "violines", "chelos", "coros",
] as const;

type CreationMode = "song" | "sound" | "speak";

export default function CreatePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [currentSong, setCurrentSong] = useState<any>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("Bachata");
  const [showProControls, setShowProControls] = useState(false);
  const [title, setTitle] = useState("");
  const [promptIntensity, setPromptIntensity] = useState([85]);
  const [lyricsIntensity, setLyricsIntensity] = useState([70]);
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [songDuration, setSongDuration] = useState(180);
  const [lyrics, setLyrics] = useState("");
  const [showLyrics, setShowLyrics] = useState(false);
  const [activeCreationMode, setActiveCreationMode] = useState<CreationMode>("song");
  const [selectedStyleKit, setSelectedStyleKit] = useState<number | undefined>(undefined);
  const [artistName, setArtistName] = useState("");
  const [copyrightHolder, setCopyrightHolder] = useState("DGB AUDIO");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachPopoverOpen, setAttachPopoverOpen] = useState(false);

  const [dnaFlow, setDnaFlow] = useState<DnaFlow>(null);
  const [selectedSubStyle, setSelectedSubStyle] = useState<string | null>(null);
  const [selectedOrchestration, setSelectedOrchestration] = useState<Set<string>>(new Set());

  const [soundPrompt, setSoundPrompt] = useState("");
  const [soundDuration, setSoundDuration] = useState([5]);

  const [ttsText, setTtsText] = useState("");
  const [ttsVoiceId, setTtsVoiceId] = useState("");
  const [ttsLanguage, setTtsLanguage] = useState("en");

  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  const { mutate: generate, isPending } = useGenerateSong();
  const { data: songs, isLoading: songsLoading } = useSongs();
  const { mutate: deleteSong } = useDeleteSong();
  const { data: styleKits } = useStyleKits();

  const BACHATA_SUGGESTIONS = [
    "Bachata romántica bajo la luna del Caribe",
    "Bachata moderna con fusión de R&B",
    "Bachata sensual con guitarra suave",
    "Bachata urbana con beats de trap",
    "Bachata tradicional dominicana con güira",
    "Bachata rosa sobre primer amor",
  ];
  const BOLERO_SUGGESTIONS = [
    "Bolero romántico de amor eterno",
    "Bolero con guitarra clásica de nylon",
    "Bolero ranchero con mariachi",
    "Bolero moderno con arreglos de cuerdas",
    "Bolero son con sabor cubano",
    "Balada bolero de desamor",
  ];

  const activePromptSuggestions = useMemo(() => {
    if (dnaFlow === "bachata") return BACHATA_SUGGESTIONS;
    if (dnaFlow === "bolero") return BOLERO_SUGGESTIONS;
    return PROMPT_SUGGESTIONS;
  }, [dnaFlow]);

  useEffect(() => {
    setPlaceholderIdx(0);
    const interval = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % activePromptSuggestions.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [activePromptSuggestions]);

  const { mutate: uploadSample, isPending: isUploadPending } = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));
      const res = await fetch("/api/samples/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/samples"] });
      toast({ title: t('create.toast.fileUploaded'), description: t('create.toast.fileUploadedDesc') });
      setAttachedFile(null);
    },
    onError: (error: Error) => {
      toast({ title: t('create.toast.uploadFailed'), description: error.message, variant: "destructive" });
    },
  });

  const { mutate: generateSound, isPending: isSoundPending } = useMutation({
    mutationFn: async (data: { prompt: string; duration: number }) => {
      const res = await apiRequest("POST", "/api/audio/sound-generator", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      toast({ title: t('create.toast.soundCreated'), description: t('create.toast.soundCreatedDesc') });
      setSoundPrompt("");
    },
    onError: (error: Error) => {
      toast({ title: t('create.toast.soundFailed'), description: error.message, variant: "destructive" });
    },
  });

  const { mutate: generateTTS, isPending: isTTSPending } = useMutation({
    mutationFn: async (data: { text: string; voiceId?: string; language: string }) => {
      const res = await apiRequest("POST", "/api/audio/tts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      toast({ title: t('create.toast.speechGenerated'), description: t('create.toast.speechGeneratedDesc') });
      setTtsText("");
    },
    onError: (error: Error) => {
      toast({ title: t('create.toast.ttsFailed'), description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lyricsParam = params.get("lyrics");
    const titleParam = params.get("title");
    const genreParam = params.get("genre");
    if (lyricsParam) {
      setLyrics(lyricsParam);
      setShowLyrics(true);
      setShowProControls(true);
    }
    if (titleParam) setTitle(titleParam);
    if (genreParam) {
      const match = GENRE_CARDS.find(
        (g) => g.value.toLowerCase() === genreParam.toLowerCase()
      );
      if (match) setSelectedGenre(match.value);
      else setSelectedGenre(genreParam);
    }
    if (lyricsParam || titleParam) {
      window.history.replaceState({}, "", "/create");
    }
  }, []);

  const allSongs = songs ?? [];
  const groupedSongs: { pairId: string | null; songs: any[] }[] = [];
  const seen = new Set<number>();
  for (const song of allSongs) {
    if (seen.has(song.id)) continue;
    seen.add(song.id);
    if (song.pairId) {
      const pair = allSongs
        .filter((s: any) => s.pairId === song.pairId)
        .sort((a: any, b: any) => (a.variationLabel || "").localeCompare(b.variationLabel || ""));
      pair.forEach((s: any) => seen.add(s.id));
      const existing = groupedSongs.find((g) => g.pairId === song.pairId);
      if (!existing) {
        groupedSongs.push({ pairId: song.pairId, songs: pair });
      }
    } else {
      groupedSongs.push({ pairId: null, songs: [song] });
    }
  }
  const recentGroups = groupedSongs.slice(0, 6);

  const activeSong = currentSong
    ? allSongs.find((s: any) => s.id === currentSong.id) || currentSong
    : null;

  const handleGenerate = () => {
    if (!prompt.trim() && !title.trim() && !lyrics.trim()) return;
    const finalPrompt = isInstrumental
      ? `${prompt || title} (instrumental, no vocals)`
      : prompt || title;
    const orchestrationList = dnaFlow === "bolero" && !selectedSubStyle
      ? [...DGB_BOLERO_BASE_INSTRUMENTS, ...Array.from(selectedOrchestration)]
      : undefined;
    generate({
      prompt: finalPrompt,
      title: title || undefined,
      style: selectedGenre,
      genre: selectedGenre,
      mode: title ? "aggregate" : "standard",
      duration: songDuration,
      make_instrumental: isInstrumental,
      artistName: artistName || undefined,
      copyrightHolder: copyrightHolder || undefined,
      ...(lyrics.trim() && !isInstrumental ? { lyrics: lyrics.trim() } : {}),
      ...(selectedStyleKit ? { styleKitId: selectedStyleKit } : {}),
      ...(orchestrationList ? { orchestration: orchestrationList } : {}),
    } as any);
    setPrompt("");
  };

  const handleSoundGenerate = () => {
    if (!soundPrompt.trim()) return;
    generateSound({ prompt: soundPrompt.trim(), duration: soundDuration[0] });
  };

  const handleTTSGenerate = () => {
    if (!ttsText.trim()) return;
    generateTTS({
      text: ttsText.trim(),
      ...(ttsVoiceId.trim() ? { voiceId: ttsVoiceId.trim() } : {}),
      language: ttsLanguage,
    });
  };

  const handleRandomPrompt = () => {
    const random = activePromptSuggestions[Math.floor(Math.random() * activePromptSuggestions.length)];
    setPrompt(random);
  };

  const handleFileAttach = () => {
    fileInputRef.current?.click();
    setAttachPopoverOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(file);
      toast({ title: t('create.toast.fileAttached'), description: t('create.toast.fileReadyToUpload', { name: file.name }) });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isAnyPending = isPending || isSoundPending || isTTSPending || isUploadPending;

  const hasPromptContent =
    activeCreationMode === "song"
      ? !!(prompt.trim() || title.trim() || lyrics.trim())
      : activeCreationMode === "sound"
      ? !!soundPrompt.trim()
      : !!ttsText.trim();

  const canCreate = hasPromptContent || !!attachedFile;

  const handleSubmit = () => {
    if (attachedFile) {
      uploadSample(attachedFile);
    }
    if (hasPromptContent) {
      if (activeCreationMode === "song") handleGenerate();
      else if (activeCreationMode === "sound") handleSoundGenerate();
      else if (activeCreationMode === "speak") handleTTSGenerate();
    }
  };

  const isPro = user && (user as any).subscriptionTier !== "free";

  if (!user) return null;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col items-center w-full min-h-full">
        <div className="w-full max-w-2xl px-4 py-6 md:py-10 mx-auto flex flex-col flex-1">

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6 md:mb-8"
          >
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold" data-testid="text-create-title">
              {t('create.pageTitle')}
            </h1>
          </motion.div>

          <div className="grid grid-cols-2 gap-3 mb-4" data-testid="dna-flows">
            <button
              className={cn(
                "relative overflow-hidden rounded-xl p-4 text-left transition-all border-2",
                dnaFlow === "bachata"
                  ? "border-primary bg-gradient-to-br from-primary/15 to-cyan-500/10 shadow-[0_0_20px_rgba(0,200,255,0.15)]"
                  : "border-white/10 hover:border-primary/30 bg-white/[0.03]"
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
              <div className="flex items-center gap-2 mb-1.5">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/30 to-cyan-400/20 flex items-center justify-center">
                  <Guitar className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-bold">DGB Bachata</div>
                  <div className="text-[10px] text-muted-foreground">{t('create.dnaFlow.bachataDesc')}</div>
                </div>
              </div>
              {dnaFlow === "bachata" && (
                <div className="absolute top-2 right-2">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                </div>
              )}
            </button>

            <button
              className={cn(
                "relative overflow-hidden rounded-xl p-4 text-left transition-all border-2",
                dnaFlow === "bolero"
                  ? "border-purple-400 bg-gradient-to-br from-purple-500/15 to-pink-500/10 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                  : "border-white/10 hover:border-purple-400/30 bg-white/[0.03]"
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
              <div className="flex items-center gap-2 mb-1.5">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500/30 to-pink-400/20 flex items-center justify-center">
                  <Music className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <div className="text-sm font-bold">DGB Bolero</div>
                  <div className="text-[10px] text-muted-foreground">{t('create.dnaFlow.boleroDesc')}</div>
                </div>
              </div>
              {dnaFlow === "bolero" && (
                <div className="absolute top-2 right-2">
                  <div className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
                </div>
              )}
            </button>
          </div>

          <AnimatePresence>
            {dnaFlow && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="flex gap-2 overflow-x-auto pb-1" data-testid="sub-styles">
                  {(dnaFlow === "bachata" ? BACHATA_STYLE_KEYS : BOLERO_STYLE_KEYS).map((styleKey) => (
                    <button
                      key={styleKey}
                      className={cn(
                        "flex-shrink-0 px-3 py-2 rounded-lg border text-left transition-all min-w-[120px]",
                        selectedSubStyle === styleKey
                          ? dnaFlow === "bachata"
                            ? "border-primary/50 bg-primary/10"
                            : "border-purple-400/50 bg-purple-500/10"
                          : "border-white/10 hover:border-white/20 bg-white/[0.02]"
                      )}
                      onClick={() => {
                        const isDeselecting = selectedSubStyle === styleKey;
                        setSelectedSubStyle(isDeselecting ? null : styleKey);
                        if (!isDeselecting) {
                          const genreName = dnaFlow === "bachata" ? "Bachata" : "Bolero";
                          setSelectedGenre(`${genreName} ${t(`create.dnaFlow.styles.${styleKey}.label`)}`);
                          if (dnaFlow === "bolero") {
                            const normalBoleroKit = styleKits?.find(k => k.genre === "bolero");
                            if (normalBoleroKit) setSelectedStyleKit(normalBoleroKit.id);
                          }
                        } else {
                          setSelectedGenre(dnaFlow === "bachata" ? "Bachata" : "Bolero");
                          if (dnaFlow === "bolero") {
                            const dgbKit = styleKits?.find(k => k.genre === "dgb_bolero");
                            if (dgbKit) setSelectedStyleKit(dgbKit.id);
                          }
                        }
                      }}
                      data-testid={`sub-style-${styleKey}`}
                    >
                      <div className="text-xs font-medium">{t(`create.dnaFlow.styles.${styleKey}.label`)}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{t(`create.dnaFlow.styles.${styleKey}.desc`)}</div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {dnaFlow === "bolero" && !selectedSubStyle && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="rounded-xl border border-purple-400/20 bg-purple-500/[0.04] p-3" data-testid="orchestration-panel">
                  <div className="flex items-center gap-2 mb-2.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-xs font-semibold text-purple-300">{t('create.dnaFlow.orchestration.title')}</span>
                  </div>

                  <div className="mb-2">
                    <div className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">{t('create.dnaFlow.orchestration.baseLabel')}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {DGB_BOLERO_BASE_INSTRUMENTS.map((instr) => (
                        <span
                          key={instr}
                          className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-400/20 text-[10px] text-purple-300"
                          data-testid={`base-instr-${instr}`}
                        >
                          {t(`create.dnaFlow.orchestration.instruments.${instr}`)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">{t('create.dnaFlow.orchestration.extrasLabel')}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {DGB_BOLERO_ORCHESTRATION.map((instr) => {
                        const isSelected = selectedOrchestration.has(instr);
                        return (
                          <button
                            key={instr}
                            className={cn(
                              "px-2.5 py-1 rounded-lg border text-[11px] transition-all",
                              isSelected
                                ? "border-purple-400/50 bg-purple-500/20 text-purple-200 shadow-[0_0_8px_rgba(168,85,247,0.15)]"
                                : "border-white/10 text-muted-foreground hover:border-purple-400/30 hover:text-purple-300"
                            )}
                            onClick={() => {
                              const next = new Set(selectedOrchestration);
                              if (isSelected) next.delete(instr);
                              else next.add(instr);
                              setSelectedOrchestration(next);
                            }}
                            data-testid={`orch-${instr}`}
                          >
                            {t(`create.dnaFlow.orchestration.instruments.${instr}`)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 flex flex-col"
          >
            <Card className="border-white/10 bg-card/80 backdrop-blur-sm overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="p-4 flex-1 flex flex-col min-h-0">
                {activeCreationMode === "song" && (
                  <div className="relative flex-1">
                    <Textarea
                      placeholder={activePromptSuggestions[placeholderIdx % activePromptSuggestions.length]}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="bg-transparent border-0 focus:ring-0 focus-visible:ring-0 min-h-[120px] sm:min-h-[160px] resize-none text-base sm:text-lg p-0 placeholder:text-muted-foreground/40 transition-all"
                      data-testid="input-prompt"
                      maxLength={500}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          handleSubmit();
                        }
                      }}
                    />
                  </div>
                )}

                {activeCreationMode === "sound" && (
                  <div className="space-y-3 flex-1">
                    <div className="relative flex-1">
                      <Textarea
                        placeholder={t('create.soundPrompt.placeholder')}
                        value={soundPrompt}
                        onChange={(e) => setSoundPrompt(e.target.value)}
                        className="bg-transparent border-0 focus:ring-0 focus-visible:ring-0 min-h-[120px] sm:min-h-[160px] resize-none text-base sm:text-lg p-0 placeholder:text-muted-foreground/40"
                        data-testid="input-sound-prompt"
                        maxLength={500}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {soundDuration[0]}s
                      </Label>
                      <Slider
                        value={soundDuration}
                        onValueChange={setSoundDuration}
                        min={1}
                        max={30}
                        step={1}
                        className="flex-1 max-w-[200px]"
                        data-testid="slider-sound-duration"
                      />
                    </div>
                  </div>
                )}

                {activeCreationMode === "speak" && (
                  <div className="space-y-3 flex-1">
                    <div className="relative flex-1">
                      <Textarea
                        placeholder={t('create.ttsPrompt.placeholder')}
                        value={ttsText}
                        onChange={(e) => setTtsText(e.target.value)}
                        className="bg-transparent border-0 focus:ring-0 focus-visible:ring-0 min-h-[120px] sm:min-h-[160px] resize-none text-base sm:text-lg p-0 placeholder:text-muted-foreground/40"
                        data-testid="input-tts-text"
                        maxLength={2000}
                      />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">{t('create.voiceId')}</Label>
                        <Input
                          placeholder={t('create.voiceDefault')}
                          value={ttsVoiceId}
                          onChange={(e) => setTtsVoiceId(e.target.value)}
                          className="bg-background/50 border-white/10 text-xs w-[120px]"
                          data-testid="input-tts-voice-id"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">{t('create.language')}</Label>
                        <select
                          className="rounded-md border border-white/10 bg-background/50 px-2 py-1 text-xs"
                          value={ttsLanguage}
                          onChange={(e) => setTtsLanguage(e.target.value)}
                          data-testid="select-tts-language"
                        >
                          {TTS_LANGUAGES.map((lang) => (
                            <option key={lang.value} value={lang.value}>
                              {lang.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {attachedFile && (
                  <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                    <FileAudio className="h-4 w-4 text-primary" />
                    <span className="text-xs text-primary flex-1 truncate">{attachedFile.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground"
                      onClick={() => setAttachedFile(null)}
                      data-testid="button-remove-file"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {showLyrics && !isInstrumental && activeCreationMode === "song" && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <Textarea
                      placeholder={t('create.lyrics.lyricsPlaceholder')}
                      value={lyrics}
                      onChange={(e) => setLyrics(e.target.value)}
                      className="bg-background/30 border-white/10 focus:border-primary/50 min-h-[80px] resize-none text-sm font-mono"
                      data-testid="input-lyrics"
                      maxLength={3000}
                    />
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 px-3 py-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileChange}
                    data-testid="input-file-upload"
                  />

                  <Popover open={attachPopoverOpen} onOpenChange={setAttachPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-white/30 transition-colors"
                        data-testid="button-attach-menu"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-52 p-1.5" sideOffset={8}>
                      <button
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-white/5 text-sm transition-colors text-left"
                        onClick={handleFileAttach}
                        data-testid="menu-upload-file"
                      >
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        {t('create.attach.uploadFile')}
                      </button>
                      <button
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-white/5 text-sm transition-colors text-left"
                        onClick={() => { setAttachPopoverOpen(false); setLocation("/sample-lab"); }}
                        data-testid="menu-record"
                      >
                        <MicIcon className="h-4 w-4 text-muted-foreground" />
                        {t('create.attach.record')}
                      </button>
                      <button
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-white/5 text-sm transition-colors text-left opacity-50 cursor-not-allowed"
                        disabled
                        data-testid="menu-youtube-link"
                      >
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                        {t('create.attach.youtubeLink')}
                      </button>
                      <button
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-white/5 text-sm transition-colors text-left"
                        onClick={() => { setAttachPopoverOpen(false); setLocation("/library"); }}
                        data-testid="menu-creations"
                      >
                        <History className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1">{t('create.attach.creations')}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                      </button>
                    </PopoverContent>
                  </Popover>

                  <button
                    className={cn(
                      "h-9 w-9 rounded-full border flex items-center justify-center transition-colors",
                      showProControls
                        ? "border-primary/40 text-primary bg-primary/10"
                        : "border-white/15 text-muted-foreground hover:text-foreground hover:border-white/30"
                    )}
                    onClick={() => setShowProControls(!showProControls)}
                    data-testid="button-pro-controls"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>

                  {activeCreationMode === "song" && (
                    <>
                      <button
                        className={cn(
                          "h-9 px-4 rounded-full border flex items-center gap-1.5 text-sm transition-colors",
                          isInstrumental
                            ? "border-primary/40 text-primary bg-primary/10"
                            : "border-white/15 text-muted-foreground hover:text-foreground hover:border-white/30"
                        )}
                        onClick={() => setIsInstrumental(!isInstrumental)}
                        data-testid="button-instrumental"
                      >
                        <div className={cn("h-3.5 w-3.5 rounded-full border-2", isInstrumental ? "border-primary bg-primary" : "border-muted-foreground/50")} />
                        {t('create.options.instrumental')}
                      </button>

                      <button
                        className={cn(
                          "h-9 px-4 rounded-full border flex items-center gap-1.5 text-sm transition-colors",
                          showLyrics
                            ? "border-primary/40 text-primary bg-primary/10"
                            : "border-white/15 text-muted-foreground hover:text-foreground hover:border-white/30"
                        )}
                        onClick={() => { setShowLyrics(!showLyrics); if (isInstrumental) setIsInstrumental(false); }}
                        data-testid="button-add-lyrics"
                      >
                        <span className="text-base leading-none">+</span>
                        {t('create.lyrics.label')}
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mt-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="h-9 px-4 rounded-full border border-white/15 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-white/30 transition-colors"
                        data-testid="button-tools-dropdown"
                      >
                        {t('create.tools')}
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64 p-1.5">
                      <DropdownMenuItem
                        className="flex items-center gap-3 py-2.5 px-3 rounded-md"
                        onClick={() => setActiveCreationMode("speak")}
                        data-testid="menu-tts"
                      >
                        <div className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{t('create.toolsMenu.tts')}</span>
                            <Badge className="bg-orange-500/20 text-orange-400 border-0 text-[10px] px-1.5 py-0">Pro</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{t('create.toolsMenu.ttsDesc')}</p>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="flex items-center gap-3 py-2.5 px-3 rounded-md"
                        onClick={() => toast({ title: t('create.toolsMenu.remix'), description: t('create.toolsMenu.comingSoon') })}
                        data-testid="menu-remix"
                      >
                        <div className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                          <RefreshCw className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{t('create.toolsMenu.remix')}</span>
                            <Badge className="bg-orange-500/20 text-orange-400 border-0 text-[10px] px-1.5 py-0">Pro</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{t('create.toolsMenu.remixDesc')}</p>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="flex items-center gap-3 py-2.5 px-3 rounded-md"
                        onClick={() => toast({ title: t('create.toolsMenu.replace'), description: t('create.toolsMenu.comingSoon') })}
                        data-testid="menu-replace"
                      >
                        <div className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                          <RotateCw className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{t('create.toolsMenu.replace')}</span>
                            <Badge className="bg-orange-500/20 text-orange-400 border-0 text-[10px] px-1.5 py-0">Pro</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{t('create.toolsMenu.replaceDesc')}</p>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="flex items-center gap-3 py-2.5 px-3 rounded-md"
                        onClick={() => toast({ title: t('create.toolsMenu.extend'), description: t('create.toolsMenu.comingSoon') })}
                        data-testid="menu-extend"
                      >
                        <div className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                          <ArrowRightToLine className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{t('create.toolsMenu.extend')}</span>
                            <Badge className="bg-orange-500/20 text-orange-400 border-0 text-[10px] px-1.5 py-0">Pro</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{t('create.toolsMenu.extendDesc')}</p>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="flex items-center gap-3 py-2.5 px-3 rounded-md"
                        onClick={() => toast({ title: t('create.toolsMenu.addVocals'), description: t('create.toolsMenu.comingSoon') })}
                        data-testid="menu-add-vocals"
                      >
                        <div className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                          <Mic className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{t('create.toolsMenu.addVocals')}</span>
                            <Badge className="bg-orange-500/20 text-orange-400 border-0 text-[10px] px-1.5 py-0">Pro</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{t('create.toolsMenu.addVocalsDesc')}</p>
                        </div>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="flex items-center gap-3 py-2.5 px-3 rounded-md"
                        onClick={() => toast({ title: t('create.toolsMenu.addInstrumental'), description: t('create.toolsMenu.comingSoon') })}
                        data-testid="menu-add-instrumental"
                      >
                        <div className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                          <Guitar className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{t('create.toolsMenu.addInstrumental')}</span>
                            <Badge className="bg-orange-500/20 text-orange-400 border-0 text-[10px] px-1.5 py-0">Pro</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{t('create.toolsMenu.addInstrumentalDesc')}</p>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="flex-1" />

                  <button
                    onClick={handleSubmit}
                    disabled={isAnyPending || !canCreate}
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300",
                      canCreate && !isAnyPending
                        ? "bg-gradient-to-r from-primary to-blue-500 text-black shadow-[0_0_20px_rgba(0,200,255,0.3)] hover:shadow-[0_0_30px_rgba(0,200,255,0.5)]"
                        : "bg-white/10 text-muted-foreground/50 cursor-not-allowed"
                    )}
                    data-testid="button-submit"
                  >
                    {isAnyPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </Card>

            <div className="mt-3 overflow-x-auto pb-1">
              <div className="flex gap-2 min-w-0">
                <button
                  className={cn(
                    "flex-shrink-0 h-9 px-4 rounded-full border flex items-center gap-2 text-sm transition-colors whitespace-nowrap",
                    activeCreationMode === "sound"
                      ? "border-primary/40 text-primary bg-primary/10"
                      : "border-white/15 text-muted-foreground hover:text-foreground hover:border-white/30"
                  )}
                  onClick={() => setActiveCreationMode(activeCreationMode === "sound" ? "song" : "sound")}
                  data-testid="chip-create-sound"
                >
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                  {t('create.modes.sound')}
                </button>
                <button
                  className={cn(
                    "flex-shrink-0 h-9 px-4 rounded-full border flex items-center gap-2 text-sm transition-colors whitespace-nowrap",
                    activeCreationMode === "speak"
                      ? "border-primary/40 text-primary bg-primary/10"
                      : "border-white/15 text-muted-foreground hover:text-foreground hover:border-white/30"
                  )}
                  onClick={() => setActiveCreationMode(activeCreationMode === "speak" ? "song" : "speak")}
                  data-testid="chip-speak-text"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
                  {t('create.modes.speak')}
                </button>
                <button
                  className="flex-shrink-0 h-9 px-4 rounded-full border border-white/15 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:border-white/30 transition-colors whitespace-nowrap"
                  onClick={handleFileAttach}
                  data-testid="chip-change-file"
                >
                  <Wand2 className="h-3.5 w-3.5 text-green-400" />
                  {t('create.changeFile')}
                </button>
                <button
                  className="flex-shrink-0 h-9 px-4 rounded-full border border-white/15 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:border-white/30 transition-colors whitespace-nowrap"
                  onClick={handleRandomPrompt}
                  data-testid="chip-random"
                >
                  <Dices className="h-3.5 w-3.5 text-orange-400" />
                  {t('create.random')}
                </button>
              </div>
            </div>
          </motion.div>

          <AnimatePresence>
            {showProControls && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-4"
              >
                <Card className="border-white/5 overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-900/30 to-amber-800/20 border-b border-amber-500/20 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-400" />
                      <span className="text-sm text-amber-200/80">{t('create.unlockCustomization')}</span>
                    </div>
                  </div>

                  <div className="p-4 space-y-5">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">{t('create.title_field.label')}</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground/50" />
                          </TooltipTrigger>
                          <TooltipContent>{t('create.title_field.tooltip')}</TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        placeholder={t('create.title_field.inputPlaceholder')}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="bg-background/50 border-white/10 focus:border-primary/50"
                        data-testid="input-title"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">{t('create.promptIntensity')}</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground/50" />
                          </TooltipTrigger>
                          <TooltipContent>{t('create.promptIntensityTooltip')}</TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={promptIntensity}
                          onValueChange={setPromptIntensity}
                          min={0}
                          max={100}
                          step={1}
                          className="flex-1"
                          data-testid="slider-prompt-intensity"
                        />
                        <span className="text-xs font-mono text-muted-foreground w-8 text-right">{promptIntensity[0]}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">{t('create.lyricsIntensity')}</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground/50" />
                          </TooltipTrigger>
                          <TooltipContent>{t('create.lyricsIntensityTooltip')}</TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={lyricsIntensity}
                          onValueChange={setLyricsIntensity}
                          min={0}
                          max={100}
                          step={1}
                          className="flex-1"
                          data-testid="slider-lyrics-intensity"
                        />
                        <span className="text-xs font-mono text-muted-foreground w-8 text-right">{lyricsIntensity[0]}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label className="text-sm font-medium">{t('create.artistName')}</Label>
                      </div>
                      <Input
                        placeholder={t('create.artistNamePlaceholder')}
                        value={artistName}
                        onChange={(e) => setArtistName(e.target.value)}
                        className="bg-background/50 border-white/10 focus:border-primary/50"
                        data-testid="input-artist-name"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Copyright className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label className="text-sm font-medium">{t('create.copyrightHolder')}</Label>
                      </div>
                      <Input
                        placeholder="DGB AUDIO"
                        value={copyrightHolder}
                        onChange={(e) => setCopyrightHolder(e.target.value)}
                        className="bg-background/50 border-white/10 focus:border-primary/50"
                        data-testid="input-copyright-holder"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label className="text-sm font-medium">{t('create.songDuration')}</Label>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {[60, 120, 180, 240, 300].map((d) => (
                          <Badge
                            key={d}
                            variant={songDuration === d ? "default" : "outline"}
                            className={cn(
                              "cursor-pointer text-xs py-1 px-2.5",
                              songDuration === d
                                ? "bg-primary/15 text-primary border-primary/30"
                                : "text-muted-foreground border-white/10"
                            )}
                            onClick={() => setSongDuration(d)}
                            data-testid={`badge-duration-${d}`}
                          >
                            {d >= 60 ? `${Math.floor(d / 60)}:${String(d % 60).padStart(2, "0")}` : `${d}s`}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {styleKits && styleKits.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t('create.styleKit')}</Label>
                        <select
                          className="w-full rounded-md border border-white/10 bg-background/50 px-3 py-2 text-sm"
                          value={selectedStyleKit || ""}
                          onChange={(e) => setSelectedStyleKit(e.target.value ? Number(e.target.value) : undefined)}
                          data-testid="select-style-kit"
                        >
                          <option value="">{t('create.noneDefault')}</option>
                          {styleKits.map((kit) => (
                            <option key={kit.id} value={kit.id}>
                              {kit.name} ({kit.genre.replace(/_/g, " ")}) — {kit.instruments.length} {t('create.instruments')}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {activeCreationMode === "song" && (
            <div className="mt-6 mb-4">
              <ScrollArea className="w-full">
                <div className="flex gap-2.5 pb-3">
                  {GENRE_CARDS.map((genre) => (
                    <Card
                      key={genre.value}
                      className={cn(
                        "p-3 cursor-pointer transition-all flex-shrink-0 w-[120px] sm:w-[130px]",
                        selectedGenre === genre.value
                          ? "border-primary/50 bg-gradient-to-br from-primary/10 to-purple-500/10"
                          : "border-white/5 hover:border-white/15"
                      )}
                      onClick={() => setSelectedGenre(genre.value)}
                      data-testid={`card-genre-${genre.value}`}
                    >
                      <div className="text-sm font-medium mb-1 line-clamp-1">{genre.value}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ThumbsUp className="h-3 w-3" />
                        {genre.likes}
                      </div>
                    </Card>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}

          {isPending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6"
            >
              <Card className="p-4 border-primary/20 bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t('create.generating2Versions')}</p>
                    <p className="text-xs text-muted-foreground">{t('create.firstTimeTip')}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          <AnimatePresence>
            {activeSong && activeSong.status === "completed" && activeSong.audioUrl && (
              <motion.div
                key={`player-${activeSong.id}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6"
              >
                <AudioPlayer
                  url={activeSong.audioUrl}
                  title={activeSong.title || activeSong.prompt || t('create.untitledTrack')}
                  imageUrl={activeSong.imageUrl}
                  genre={activeSong.genre}
                  duration={activeSong.duration}
                  createdAt={activeSong.createdAt}
                  onOpenStudio={() => setLocation("/studio")}
                />
              </motion.div>
            )}
            {activeSong && (activeSong.status === "processing" || activeSong.status === "pending") && (
              <motion.div
                key={`processing-${activeSong.id}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6"
              >
                <Card className="p-4 border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activeSong.title || activeSong.prompt || "Track"}</p>
                      <p className="text-xs text-muted-foreground">{t('create.creatingWithAI')}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary/40 rounded-full"
                        animate={{ width: ["10%", "40%", "60%", "75%"] }}
                        transition={{ duration: 240, times: [0, 0.3, 0.6, 1], ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-right">{t('create.estimatedTime')}</p>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {recentGroups.length > 0 && (
            <div className="mt-8 mb-8">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('create.recentCreations')}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => setLocation("/library")}
                  data-testid="button-view-all"
                >
                  {t('create.viewAll')}
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <div className="space-y-3">
                {recentGroups.map((group) => {
                  const isPair = group.songs.length > 1;
                  return (
                    <div key={group.pairId || group.songs[0]?.id} data-testid={`group-${group.pairId || group.songs[0]?.id}`}>
                      {isPair && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                            <Zap className="h-2.5 w-2.5 mr-1" />
                            {t('create.twoVersions')}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground line-clamp-1">
                            {group.songs[0]?.title || group.songs[0]?.prompt}
                          </span>
                        </div>
                      )}
                      <div className={cn("grid gap-2.5", isPair ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
                        {group.songs.map((song: any) => (
                          <Card
                            key={song.id}
                            className={cn(
                              "overflow-visible cursor-pointer transition-all border-white/5",
                              currentSong?.id === song.id
                                ? "border-primary/50 bg-primary/5"
                                : "hover:border-white/15"
                            )}
                            onClick={() => setCurrentSong(song)}
                            data-testid={`card-recent-song-${song.id}`}
                          >
                            <div className="flex items-start gap-3 p-3">
                              <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 relative">
                                {song.imageUrl ? (
                                  <img
                                    src={song.imageUrl}
                                    alt={song.title}
                                    className="h-12 w-12 rounded-md object-cover"
                                  />
                                ) : song.status === "processing" || song.status === "pending" ? (
                                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                                ) : song.status === "completed" ? (
                                  <Play className="h-5 w-5 text-primary fill-current" />
                                ) : (
                                  <AlertCircle className="h-5 w-5 text-destructive" />
                                )}
                                {song.variationLabel && (
                                  <span className="absolute -top-1.5 -left-1.5 h-5 w-5 rounded-full bg-primary text-black text-[10px] font-bold flex items-center justify-center">
                                    {song.variationLabel}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium line-clamp-1">
                                  {song.variationLabel ? `${t('create.version')} ${song.variationLabel}` : (song.title || song.prompt)}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  {song.genre && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10">
                                      {song.genre}
                                    </Badge>
                                  )}
                                  {song.status === "processing" || song.status === "pending" ? (
                                    <span className="text-[10px] text-primary">{t('create.generating')}</span>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">
                                      {song.createdAt && formatDistanceToNow(new Date(song.createdAt), { addSuffix: true })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                {song.status === "completed" && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLocation("/studio");
                                    }}
                                    data-testid={`button-studio-${song.id}`}
                                  >
                                    <Scissors className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-muted-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSong(song.id);
                                  }}
                                  data-testid={`button-delete-${song.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </ScrollArea>
  );
}
