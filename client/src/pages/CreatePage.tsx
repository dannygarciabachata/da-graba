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
  Pause,
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
  Shield,
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
  X,
  ChevronLeft,
  Download,
  Share2,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Globe,
  Lock,
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
  { value: "Bachata", label: "DAGRABACHATA", likes: "97K" },
  { value: "Salsa", label: "Salsa", likes: "72K" },
  { value: "Merengue", label: "Merengue", likes: "58K" },
  { value: "Cumbia", label: "Cumbia", likes: "54K" },
  { value: "Bolero", label: "DAGRABOLERO", likes: "42K" },
  { value: "Vallenato", label: "Vallenato", likes: "36K" },
  { value: "Reggaeton", label: "Reggaeton", likes: "65K" },
  { value: "Latin Pop", label: "Latin Pop", likes: "34K" },
  { value: "Son", label: "Son", likes: "22K" },
  { value: "Mambo", label: "Mambo", likes: "28K" },
  { value: "Cha-Cha-Chá", label: "Cha-Cha-Chá", likes: "24K" },
  { value: "Guaracha", label: "Guaracha", likes: "19K" },
  { value: "Dembow", label: "Dembow", likes: "31K" },
  { value: "Plena", label: "Plena", likes: "15K" },
  { value: "Bomba", label: "Bomba", likes: "14K" },
  { value: "Punta", label: "Punta", likes: "11K" },
  { value: "Champeta", label: "Champeta", likes: "13K" },
  { value: "Tropical", label: "Tropical", likes: "26K" },
  { value: "R&B", label: "R&B", likes: "48K" },
  { value: "Hip Hop", label: "Hip Hop", likes: "45K" },
  { value: "Pop", label: "Pop", likes: "32K" },
  { value: "EDM", label: "EDM", likes: "31K" },
  { value: "K-pop", label: "K-pop", likes: "38K" },
  { value: "Afrobeat", label: "Afrobeat", likes: "41K" },
  { value: "Jazz", label: "Jazz", likes: "13K" },
  { value: "Rock", label: "Rock", likes: "25K" },
  { value: "Synthwave", label: "Synthwave", likes: "27K" },
  { value: "House", label: "House", likes: "18K" },
  { value: "Soul", label: "Soul", likes: "23K" },
  { value: "Country", label: "Country", likes: "15K" },
  { value: "Blues", label: "Blues", likes: "12K" },
  { value: "Indie", label: "Indie", likes: "21K" },
  { value: "Classical", label: "Classical", likes: "9K" },
  { value: "Funk", label: "Funk", likes: "17K" },
  { value: "Drum & Bass", label: "Drum & Bass", likes: "14K" },
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
  const [mobileView, setMobileView] = useState<"create" | "songs" | "player">("songs");

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

  const handleSongClick = (song: any) => {
    setCurrentSong(song);
    setMobileView("player");
  };

  const creationPanel = (
    <div className="flex flex-col h-full" data-testid="creation-panel">
      <div className="p-3 border-b border-white/5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t('create.pageTitle')}
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2" data-testid="dna-flows">
            <button
              className={cn(
                "relative rounded-lg p-2.5 text-left transition-all border",
                dnaFlow === "bachata"
                  ? "border-primary bg-primary/10"
                  : "border-white/10 bg-white/[0.02]"
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
                <Guitar className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <div className="text-xs font-bold truncate">DAGRABACHATA</div>
              </div>
              {dnaFlow === "bachata" && (
                <div className="absolute top-1.5 right-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                </div>
              )}
            </button>

            <button
              className={cn(
                "relative rounded-lg p-2.5 text-left transition-all border",
                dnaFlow === "bolero"
                  ? "border-blue-400 bg-blue-500/10"
                  : "border-white/10 bg-white/[0.02]"
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
                <Music className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                <div className="text-xs font-bold truncate">DAGRABOLERO</div>
              </div>
              {dnaFlow === "bolero" && (
                <div className="absolute top-1.5 right-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
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
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-1.5 pb-1" data-testid="sub-styles">
                  {(dnaFlow === "bachata" ? BACHATA_STYLE_KEYS : BOLERO_STYLE_KEYS).map((styleKey) => (
                    <button
                      key={styleKey}
                      className={cn(
                        "px-2 py-1 rounded-md border text-[11px] transition-all",
                        selectedSubStyle === styleKey
                          ? dnaFlow === "bachata"
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-blue-400/50 bg-blue-500/10 text-blue-300"
                          : "border-white/10 text-muted-foreground"
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
                      {t(`create.dnaFlow.styles.${styleKey}.label`)}
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
                className="overflow-hidden"
              >
                <div className="rounded-lg border border-blue-400/20 bg-blue-500/[0.04] p-2.5" data-testid="orchestration-panel">
                  <div className="flex items-center gap-1.5 mb-2">
                    <SlidersHorizontal className="h-3 w-3 text-blue-400" />
                    <span className="text-[10px] font-semibold text-blue-300 uppercase">{t('create.dnaFlow.orchestration.title')}</span>
                  </div>
                  <div className="mb-2">
                    <div className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wider">{t('create.dnaFlow.orchestration.baseLabel')}</div>
                    <div className="flex flex-wrap gap-1">
                      {DGB_BOLERO_BASE_INSTRUMENTS.map((instr) => (
                        <span
                          key={instr}
                          className="px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-400/20 text-[9px] text-blue-300"
                          data-testid={`base-instr-${instr}`}
                        >
                          {t(`create.dnaFlow.orchestration.instruments.${instr}`)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wider">{t('create.dnaFlow.orchestration.extrasLabel')}</div>
                    <div className="flex flex-wrap gap-1">
                      {DGB_BOLERO_ORCHESTRATION.map((instr) => {
                        const isSelected = selectedOrchestration.has(instr);
                        return (
                          <button
                            key={instr}
                            className={cn(
                              "px-1.5 py-0.5 rounded border text-[10px] transition-all",
                              isSelected
                                ? "border-blue-400/50 bg-blue-500/20 text-blue-200"
                                : "border-white/10 text-muted-foreground"
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

          <div className="rounded-lg border border-white/10 bg-card/80 overflow-hidden">
            <div className="p-3">
              {activeCreationMode === "song" && (
                <Textarea
                  placeholder={activePromptSuggestions[placeholderIdx % activePromptSuggestions.length]}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="bg-transparent border-0 focus:ring-0 focus-visible:ring-0 min-h-[80px] resize-none text-sm p-0 placeholder:text-muted-foreground/40"
                  data-testid="input-prompt"
                  maxLength={500}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleSubmit();
                    }
                  }}
                />
              )}
              {activeCreationMode === "sound" && (
                <div className="space-y-2">
                  <Textarea
                    placeholder={t('create.soundPrompt.placeholder')}
                    value={soundPrompt}
                    onChange={(e) => setSoundPrompt(e.target.value)}
                    className="bg-transparent border-0 focus:ring-0 focus-visible:ring-0 min-h-[80px] resize-none text-sm p-0 placeholder:text-muted-foreground/40"
                    data-testid="input-sound-prompt"
                    maxLength={500}
                  />
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {soundDuration[0]}s
                    </Label>
                    <Slider
                      value={soundDuration}
                      onValueChange={setSoundDuration}
                      min={1}
                      max={30}
                      step={1}
                      className="flex-1"
                      data-testid="slider-sound-duration"
                    />
                  </div>
                </div>
              )}
              {activeCreationMode === "speak" && (
                <div className="space-y-2">
                  <Textarea
                    placeholder={t('create.ttsPrompt.placeholder')}
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value)}
                    className="bg-transparent border-0 focus:ring-0 focus-visible:ring-0 min-h-[80px] resize-none text-sm p-0 placeholder:text-muted-foreground/40"
                    data-testid="input-tts-text"
                    maxLength={2000}
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      placeholder={t('create.voiceDefault')}
                      value={ttsVoiceId}
                      onChange={(e) => setTtsVoiceId(e.target.value)}
                      className="bg-background/50 border-white/10 text-[10px] w-[80px]"
                      data-testid="input-tts-voice-id"
                    />
                    <select
                      className="rounded-md border border-white/10 bg-background/50 px-1.5 py-1 text-[10px]"
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
              )}

              {attachedFile && (
                <div className="flex items-center gap-2 mt-2 p-1.5 rounded-md bg-primary/5 border border-primary/20">
                  <FileAudio className="h-3 w-3 text-primary" />
                  <span className="text-[10px] text-primary flex-1 truncate">{attachedFile.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground h-6 w-6"
                    onClick={() => setAttachedFile(null)}
                    data-testid="button-remove-file"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </div>
              )}

              {showLyrics && !isInstrumental && activeCreationMode === "song" && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <Textarea
                    placeholder={t('create.lyrics.lyricsPlaceholder')}
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    className="bg-background/30 border-white/10 focus:border-primary/50 min-h-[60px] resize-none text-xs font-mono"
                    data-testid="input-lyrics"
                    maxLength={3000}
                  />
                </div>
              )}
            </div>

            <div className="border-t border-white/5 px-2.5 py-2">
              <div className="flex items-center gap-1 flex-wrap">
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
                      className="h-7 w-7 rounded-full border border-white/15 flex items-center justify-center text-muted-foreground transition-colors"
                      data-testid="button-attach-menu"
                    >
                      <Paperclip className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-48 p-1" sideOffset={8}>
                    <button
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors text-left"
                      onClick={handleFileAttach}
                      data-testid="menu-upload-file"
                    >
                      <Upload className="h-3 w-3 text-muted-foreground" />
                      {t('create.attach.uploadFile')}
                    </button>
                    <button
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors text-left"
                      onClick={() => { setAttachPopoverOpen(false); setLocation("/sample-lab"); }}
                      data-testid="menu-record"
                    >
                      <MicIcon className="h-3 w-3 text-muted-foreground" />
                      {t('create.attach.record')}
                    </button>
                  </PopoverContent>
                </Popover>

                <button
                  className={cn(
                    "h-7 w-7 rounded-full border flex items-center justify-center transition-colors",
                    showProControls
                      ? "border-primary/40 text-primary bg-primary/10"
                      : "border-white/15 text-muted-foreground"
                  )}
                  onClick={() => setShowProControls(!showProControls)}
                  data-testid="button-pro-controls"
                >
                  <SlidersHorizontal className="h-3 w-3" />
                </button>

                {activeCreationMode === "song" && (
                  <>
                    <button
                      className={cn(
                        "h-7 px-2.5 rounded-full border flex items-center gap-1 text-[10px] transition-colors",
                        isInstrumental
                          ? "border-primary/40 text-primary bg-primary/10"
                          : "border-white/15 text-muted-foreground"
                      )}
                      onClick={() => setIsInstrumental(!isInstrumental)}
                      data-testid="button-instrumental"
                    >
                      <div className={cn("h-2.5 w-2.5 rounded-full border", isInstrumental ? "border-primary bg-primary" : "border-muted-foreground/50")} />
                      {t('create.options.instrumental')}
                    </button>

                    <button
                      className={cn(
                        "h-7 px-2.5 rounded-full border flex items-center gap-1 text-[10px] transition-colors",
                        showLyrics
                          ? "border-primary/40 text-primary bg-primary/10"
                          : "border-white/15 text-muted-foreground"
                      )}
                      onClick={() => { setShowLyrics(!showLyrics); if (isInstrumental) setIsInstrumental(false); }}
                      data-testid="button-add-lyrics"
                    >
                      +{t('create.lyrics.label')}
                    </button>
                  </>
                )}

                <div className="flex-1" />

                <button
                  onClick={handleSubmit}
                  disabled={isAnyPending || !canCreate}
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300",
                    canCreate && !isAnyPending
                      ? "bg-gradient-to-r from-primary to-blue-500 text-black shadow-[0_0_12px_rgba(0,200,255,0.3)]"
                      : "bg-white/10 text-muted-foreground/50 cursor-not-allowed"
                  )}
                  data-testid="button-submit"
                >
                  {isAnyPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1 mt-1.5 overflow-x-auto">
                <button
                  className={cn(
                    "flex-shrink-0 h-6 px-2 rounded-full border flex items-center gap-1 text-[10px] transition-colors whitespace-nowrap",
                    activeCreationMode === "sound"
                      ? "border-primary/40 text-primary bg-primary/10"
                      : "border-white/15 text-muted-foreground"
                  )}
                  onClick={() => setActiveCreationMode(activeCreationMode === "sound" ? "song" : "sound")}
                  data-testid="chip-create-sound"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  {t('create.modes.sound')}
                </button>
                <button
                  className={cn(
                    "flex-shrink-0 h-6 px-2 rounded-full border flex items-center gap-1 text-[10px] transition-colors whitespace-nowrap",
                    activeCreationMode === "speak"
                      ? "border-primary/40 text-primary bg-primary/10"
                      : "border-white/15 text-muted-foreground"
                  )}
                  onClick={() => setActiveCreationMode(activeCreationMode === "speak" ? "song" : "speak")}
                  data-testid="chip-speak-text"
                >
                  <MessageSquare className="h-2.5 w-2.5" />
                  {t('create.modes.speak')}
                </button>
                <button
                  className="flex-shrink-0 h-6 px-2 rounded-full border border-white/15 flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap"
                  onClick={handleRandomPrompt}
                  data-testid="chip-random"
                >
                  <Dices className="h-2.5 w-2.5 text-orange-400" />
                  {t('create.random')}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 px-0.5">
            <Shield className="h-2.5 w-2.5 text-primary/60 flex-shrink-0" />
            <span className="text-[9px] text-muted-foreground/70">
              {t('create.adnProtegido', 'ADN Protegido — Instrumentos DGB')}
            </span>
          </div>

          <AnimatePresence>
            {showProControls && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Card className="border-white/5 overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-900/30 to-amber-800/20 border-b border-amber-500/20 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Crown className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-xs text-amber-200/80">{t('create.unlockCustomization')}</span>
                    </div>
                  </div>

                  <div className="p-3 space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">{t('create.title_field.label')}</Label>
                      <Input
                        placeholder={t('create.title_field.inputPlaceholder')}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="bg-background/50 border-white/10 text-xs"
                        data-testid="input-title"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">{t('create.promptIntensity')}</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={promptIntensity}
                          onValueChange={setPromptIntensity}
                          min={0}
                          max={100}
                          step={1}
                          className="flex-1"
                          data-testid="slider-prompt-intensity"
                        />
                        <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{promptIntensity[0]}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">{t('create.lyricsIntensity')}</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={lyricsIntensity}
                          onValueChange={setLyricsIntensity}
                          min={0}
                          max={100}
                          step={1}
                          className="flex-1"
                          data-testid="slider-lyrics-intensity"
                        />
                        <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{lyricsIntensity[0]}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <Label className="text-xs font-medium">{t('create.artistName')}</Label>
                      </div>
                      <Input
                        placeholder={t('create.artistNamePlaceholder')}
                        value={artistName}
                        onChange={(e) => setArtistName(e.target.value)}
                        className="bg-background/50 border-white/10 text-xs"
                        data-testid="input-artist-name"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Copyright className="h-3 w-3 text-muted-foreground" />
                        <Label className="text-xs font-medium">{t('create.copyrightHolder')}</Label>
                      </div>
                      <Input
                        placeholder="DGB AUDIO"
                        value={copyrightHolder}
                        onChange={(e) => setCopyrightHolder(e.target.value)}
                        className="bg-background/50 border-white/10 text-xs"
                        data-testid="input-copyright-holder"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <Label className="text-xs font-medium">{t('create.songDuration')}</Label>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[60, 120, 180, 240, 300].map((d) => (
                          <Badge
                            key={d}
                            variant={songDuration === d ? "default" : "outline"}
                            className={cn(
                              "cursor-pointer text-[10px] py-0 px-1.5",
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
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">{t('create.styleKit')}</Label>
                        <select
                          className="w-full rounded-md border border-white/10 bg-background/50 px-2 py-1.5 text-xs"
                          value={selectedStyleKit || ""}
                          onChange={(e) => setSelectedStyleKit(e.target.value ? Number(e.target.value) : undefined)}
                          data-testid="select-style-kit"
                        >
                          <option value="">{t('create.noneDefault')}</option>
                          {styleKits.map((kit) => (
                            <option key={kit.id} value={kit.id}>
                              {kit.name} ({kit.genre.replace(/_/g, " ")})
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
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 font-medium">
                {t('create.genre', 'Género')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {GENRE_CARDS.map((genre) => (
                  <button
                    key={genre.value}
                    className={cn(
                      "px-2 py-1 rounded-md border text-[10px] transition-all whitespace-nowrap",
                      selectedGenre === genre.value
                        ? "border-primary/50 bg-primary/10 text-primary font-medium"
                        : "border-white/5 text-muted-foreground"
                    )}
                    onClick={() => setSelectedGenre(genre.value)}
                    data-testid={`card-genre-${genre.value}`}
                  >
                    {genre.label || genre.value}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const songListPanel = (
    <div className="flex flex-col h-full" data-testid="song-list-panel">
      <div className="relative overflow-hidden">
        <div className="bg-gradient-to-br from-primary/20 via-blue-500/10 to-transparent p-4 md:p-6">
          <div className="relative z-10">
            <h1 className="text-lg md:text-xl font-bold mb-1" data-testid="text-create-title">
              DAGRABA Studio
            </h1>
            <p className="text-xs text-muted-foreground max-w-md">
              {t('create.pageTitle')} — La Pura Sangre de la Bachata
            </p>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-2xl" />
        </div>
      </div>

      {isPending && (
        <div className="px-4 py-3 border-b border-white/5">
          <Card className="p-3 border-primary/20 bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{t('create.generating2Versions')}</p>
                <p className="text-[10px] text-muted-foreground">{t('create.firstTimeTip')}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-3 md:p-4">
          {songsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : groupedSongs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Music className="h-8 w-8 text-primary/50" />
              </div>
              <h3 className="text-sm font-medium mb-1">{t('create.noSongsYet', 'No hay canciones aún')}</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                {t('create.noSongsDesc', 'Describe tu canción en el panel de la izquierda y presiona crear para empezar.')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {groupedSongs.map((group) => {
                const isPair = group.songs.length > 1;
                return (
                  <div key={group.pairId || group.songs[0]?.id} data-testid={`group-${group.pairId || group.songs[0]?.id}`}>
                    {isPair && (
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/30 text-primary">
                          <Zap className="h-2 w-2 mr-0.5" />
                          {t('create.twoVersions')}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {group.songs[0]?.title || group.songs[0]?.prompt}
                        </span>
                      </div>
                    )}
                    <div className="space-y-1">
                      {group.songs.map((song: any) => (
                        <div
                          key={song.id}
                          className={cn(
                            "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all",
                            currentSong?.id === song.id
                              ? "bg-primary/10 border border-primary/30"
                              : "border border-transparent hover:bg-white/[0.03]"
                          )}
                          onClick={() => handleSongClick(song)}
                          data-testid={`card-recent-song-${song.id}`}
                        >
                          <div className="h-10 w-10 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                            {song.imageUrl ? (
                              <img
                                src={song.imageUrl}
                                alt={song.title}
                                className="h-10 w-10 rounded-md object-cover"
                              />
                            ) : song.status === "processing" || song.status === "pending" ? (
                              <Loader2 className="h-4 w-4 text-primary animate-spin" />
                            ) : song.status === "completed" ? (
                              <Play className="h-4 w-4 text-primary fill-current" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            )}
                            {song.variationLabel && (
                              <span className="absolute -top-0.5 -left-0.5 h-4 w-4 rounded-full bg-primary text-black text-[8px] font-bold flex items-center justify-center">
                                {song.variationLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-medium truncate">
                              {song.variationLabel ? `${t('create.version')} ${song.variationLabel}` : (song.title || song.prompt || t('create.untitledTrack'))}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {song.genre && (
                                <span className="text-[9px] text-muted-foreground">{song.genre}</span>
                              )}
                              {(song.status === "processing" || song.status === "pending") ? (
                                <span className="text-[9px] text-primary">{t('create.generating')}</span>
                              ) : (
                                <span className="text-[9px] text-muted-foreground">
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
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLocation("/studio");
                                }}
                                data-testid={`button-studio-${song.id}`}
                              >
                                <Scissors className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSong(song.id);
                              }}
                              data-testid={`button-delete-${song.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const playerPanel = (
    <div className="flex flex-col h-full" data-testid="player-panel">
      <div className="p-3 border-b border-white/5 flex items-center gap-2">
        <button
          className="lg:hidden h-7 w-7 rounded-full border border-white/15 flex items-center justify-center text-muted-foreground"
          onClick={() => setMobileView("songs")}
          data-testid="button-back-to-songs"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {t('create.nowPlaying', 'Reproduciendo')}
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 md:p-4">
          {activeSong ? (
            <div className="space-y-4">
              <div className="aspect-square max-w-[280px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 via-blue-500/10 to-purple-500/10 flex items-center justify-center">
                {activeSong.imageUrl ? (
                  <img
                    src={activeSong.imageUrl}
                    alt={activeSong.title || "Cover"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Music className="h-16 w-16 text-primary/30" />
                    <span className="text-xs text-muted-foreground/50">{activeSong.genre || "DAGRABA"}</span>
                  </div>
                )}
              </div>

              <div className="text-center">
                <h3 className="text-base font-bold truncate px-2">
                  {activeSong.title || activeSong.prompt || t('create.untitledTrack')}
                </h3>
                <div className="flex items-center justify-center gap-2 mt-1">
                  {activeSong.genre && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10">
                      {activeSong.genre}
                    </Badge>
                  )}
                  {activeSong.artistName && (
                    <span className="text-xs text-muted-foreground">{activeSong.artistName}</span>
                  )}
                </div>
              </div>

              {activeSong.status === "completed" && activeSong.audioUrl && (
                <AudioPlayer
                  url={activeSong.audioUrl}
                  title={activeSong.title || activeSong.prompt || t('create.untitledTrack')}
                  imageUrl={null}
                  genre={activeSong.genre}
                  duration={activeSong.duration}
                  createdAt={activeSong.createdAt}
                  onOpenStudio={() => setLocation("/studio")}
                />
              )}

              {(activeSong.status === "processing" || activeSong.status === "pending") && (
                <Card className="p-4 border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-3 mb-3">
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{t('create.creatingWithAI')}</p>
                      <p className="text-[10px] text-muted-foreground">{activeSong.statusMessage || t('create.estimatedTime')}</p>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary/40 rounded-full"
                      animate={{ width: ["10%", "40%", "60%", "75%"] }}
                      transition={{ duration: 240, times: [0, 0.3, 0.6, 1], ease: "easeOut" }}
                    />
                  </div>
                </Card>
              )}

              {activeSong.status === "failed" && (
                <Card className="p-3 border-destructive/20 bg-destructive/5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    <p className="text-xs text-destructive">
                      {activeSong.statusMessage || t('create.generationFailed', 'La generación falló. Intenta de nuevo.')}
                    </p>
                  </div>
                </Card>
              )}

              {activeSong.lyricsText && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {t('create.lyrics.label')}
                  </h4>
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap bg-white/[0.02] rounded-lg p-3 border border-white/5 max-h-[200px] overflow-y-auto">
                    {activeSong.lyricsText}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                <Play className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('create.selectTrack', 'Selecciona una canción para reproducir')}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <>
      {/* DESKTOP LAYOUT: 3 columns */}
      <div className="hidden lg:flex h-full" data-testid="desktop-layout">
        <div className="w-[320px] xl:w-[360px] flex-shrink-0 border-r border-white/5 bg-background/50 overflow-hidden">
          {creationPanel}
        </div>
        <div className="flex-1 min-w-0 border-r border-white/5 overflow-hidden">
          {songListPanel}
        </div>
        <div className="w-[340px] xl:w-[380px] flex-shrink-0 overflow-hidden">
          {playerPanel}
        </div>
      </div>

      {/* MOBILE/TABLET LAYOUT: tab-based */}
      <div className="lg:hidden flex flex-col h-full" data-testid="mobile-layout">
        {mobileView !== "player" && (
          <div className="flex border-b border-white/5 px-2 bg-background/80 flex-shrink-0">
            <button
              className={cn(
                "flex-1 py-2.5 text-xs font-medium text-center transition-colors relative",
                mobileView === "create" ? "text-primary" : "text-muted-foreground"
              )}
              onClick={() => setMobileView("create")}
              data-testid="tab-create"
            >
              <div className="flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                {t('create.tabCreate', 'Crear')}
              </div>
              {mobileView === "create" && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
              )}
            </button>
            <button
              className={cn(
                "flex-1 py-2.5 text-xs font-medium text-center transition-colors relative",
                mobileView === "songs" ? "text-primary" : "text-muted-foreground"
              )}
              onClick={() => setMobileView("songs")}
              data-testid="tab-songs"
            >
              <div className="flex items-center justify-center gap-1.5">
                <Music className="h-3.5 w-3.5" />
                {t('create.tabSongs', 'Canciones')}
                {allSongs.length > 0 && (
                  <span className="text-[9px] bg-primary/20 text-primary px-1 rounded-full">{allSongs.length}</span>
                )}
              </div>
              {mobileView === "songs" && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {mobileView === "create" && creationPanel}
          {mobileView === "songs" && songListPanel}
          {mobileView === "player" && playerPanel}
        </div>
      </div>
    </>
  );
}
