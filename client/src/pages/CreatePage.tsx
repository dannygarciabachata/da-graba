import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ChevronDown,
  ChevronRight,
  ChevronLeft,
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
  ArrowRightToLine,
  Guitar,
  X,
  Search,
  Filter,
  MoreHorizontal,
  Share2,
  Heart,
  Download,
  ThumbsDown,
  ListMusic,
  SkipBack,
  SkipForward,
  Pause,
  Repeat,
  Shuffle,
  CheckSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useDeleteSong, useSongLike, useToggleSongLike } from "@/hooks/use-songs";
import { AudioPlayer } from "@/components/AudioPlayer";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { AudioSpectrum } from "@/components/AudioSpectrum";
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
  { value: "Bachata", label: "DAGRABACHATA", likes: "97K", accent: true },
  { value: "Bolero", label: "DAGRABOLERO", likes: "42K", accent: true },
  { value: "Salsa", label: "Salsa", likes: "72K" },
  { value: "Merengue", label: "Merengue", likes: "58K" },
  { value: "Cumbia", label: "Cumbia", likes: "54K" },
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

function GenreCarousel({ selectedGenre, onSelect }: { selectedGenre: string; onSelect: (v: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.6;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className="relative group" data-testid="genre-carousel">
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-0 z-10 w-10 flex items-center justify-center bg-gradient-to-r from-background via-background/80 to-transparent"
          data-testid="genre-scroll-left"
        >
          <div className="h-8 w-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
            <ChevronLeft className="h-4 w-4" />
          </div>
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-0 z-10 w-10 flex items-center justify-center bg-gradient-to-l from-background via-background/80 to-transparent"
          data-testid="genre-scroll-right"
        >
          <div className="h-8 w-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
            <ChevronRight className="h-4 w-4" />
          </div>
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide py-1 px-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {GENRE_CARDS.map((genre) => (
          <button
            key={genre.value}
            className={cn(
              "flex-shrink-0 px-4 py-2 rounded-full border text-sm font-medium transition-all whitespace-nowrap",
              selectedGenre === genre.value
                ? (genre as any).accent
                  ? "border-primary bg-primary/15 text-primary shadow-[0_0_12px_rgba(255,20,147,0.15)]"
                  : "border-primary bg-primary/10 text-primary"
                : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground"
            )}
            onClick={() => onSelect(genre.value)}
            data-testid={`genre-chip-${genre.value}`}
          >
            {genre.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function HistoryNowPlaying({ song, isPlaying }: { song: PlayerSong; isPlaying: boolean }) {
  const { t } = useTranslation();
  const likeQuery = useSongLike(song.id);
  const likeMutation = useToggleSongLike();
  const { toast } = useToast();
  const [showLyrics, setShowLyrics] = useState(false);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = likeQuery.data?.userValue === 1 ? -1 : 1;
    likeMutation.mutate({ songId: song.id, value: newValue as 1 | -1 });
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/discover?song=${song.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: t('create.linkCopied', 'Enlace copiado') });
    } catch {
      toast({ title: url, description: t('create.copyManually', 'Copia el enlace manualmente') });
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = song.audioUrl;
    a.download = `${song.title || "song"}.mp3`;
    a.click();
  };

  return (
    <div className="p-3 border-b border-white/5" data-testid="history-now-playing">
      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-white/5 mb-3">
        {song.imageUrl ? (
          <img src={song.imageUrl} alt={song.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-orange-500/20">
            <Music className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
        {isPlaying && (
          <div className="absolute bottom-2 left-2 right-2">
            <AudioSpectrum songId={song.id} />
          </div>
        )}
        {song.genre && (
          <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] bg-black/60 backdrop-blur-sm border-0">
            {song.genre}
          </Badge>
        )}
        {song.variationLabel && (
          <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] bg-black/60 backdrop-blur-sm border-0">
            {song.variationLabel}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-bold truncate" data-testid="text-now-playing-title">
            {song.title || song.prompt || t('create.untitledTrack')}
          </h3>
          <p className="text-xs text-muted-foreground truncate" data-testid="text-now-playing-artist">
            {song.artistName || song.copyrightHolder || "DAGRABA Studio"}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLike}
                className={cn(likeQuery.data?.userValue === 1 && "text-primary")}
                data-testid="button-like-song"
              >
                <Heart className={cn("h-4 w-4", likeQuery.data?.userValue === 1 && "fill-current")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('create.like', 'Me gusta')}{likeQuery.data?.likes ? ` (${likeQuery.data.likes})` : ""}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleShare} data-testid="button-share-song">
                <Share2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('create.share', 'Compartir')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleDownload} data-testid="button-download-song">
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('create.download', 'Descargar')}</TooltipContent>
          </Tooltip>

          {song.lyricsText && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); setShowLyrics(!showLyrics); }}
                  className={cn(showLyrics && "text-primary")}
                  data-testid="button-toggle-lyrics"
                >
                  <MessageSquare className={cn("h-4 w-4", showLyrics && "fill-current")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('create.lyrics', 'Letra')}</TooltipContent>
            </Tooltip>
          )}
        </div>

        <AnimatePresence>
          {showLyrics && song.lyricsText && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white/[0.03] rounded-lg p-3 max-h-40 overflow-y-auto">
                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed" data-testid="text-lyrics">
                  {song.lyricsText}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function CreatePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { play: globalPlay, state: playerState, history, clearHistory } = usePlayer();
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
  const [mobileView, setMobileView] = useState<"create" | "songs" | "player">("create");

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

  const activeSong = playerState.currentSong
    ? allSongs.find((s: any) => s.id === playerState.currentSong?.id) || null
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

  const handleSongClick = (song: any) => {
    if (song.status === "completed" && song.audioUrl) {
      const playerSong: PlayerSong = {
        id: song.id,
        title: song.title || song.prompt || "Untitled",
        audioUrl: song.audioUrl,
        imageUrl: song.imageUrl,
        genre: song.genre,
        artistName: song.artistName,
        prompt: song.prompt,
        variationLabel: song.variationLabel,
        lyricsText: song.lyricsText,
        copyrightHolder: song.copyrightHolder,
        isPublic: song.isPublic,
        duration: song.duration,
      };
      const completedSongs = allSongs
        .filter((s: any) => s.status === "completed" && s.audioUrl)
        .map((s: any) => ({
          id: s.id,
          title: s.title || s.prompt || "Untitled",
          audioUrl: s.audioUrl,
          imageUrl: s.imageUrl,
          genre: s.genre,
          artistName: s.artistName,
          prompt: s.prompt,
          variationLabel: s.variationLabel,
          lyricsText: s.lyricsText,
          copyrightHolder: s.copyrightHolder,
          isPublic: s.isPublic,
          duration: s.duration,
        }));
      globalPlay(playerSong, completedSongs);
    }
    setMobileView("player");
  };

  if (!user) return null;

  return (
    <div className="h-full flex flex-col">

        {/* ====== LEFT + CENTER + RIGHT: 3-column desktop layout ====== */}
        <div className="hidden lg:grid lg:grid-cols-[320px_1fr_320px] flex-1 overflow-hidden" data-testid="desktop-layout">

          {/* ===== LEFT: Creation Panel (Suno-style) ===== */}
          <div className="border-r border-white/5 bg-background/50 overflow-y-auto" data-testid="creation-panel">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-5">
                <CheckSquare className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold" data-testid="text-create-heading">{t('create.pageTitle')}</h2>
              </div>

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
                    <span className="text-xs font-bold">DAGRABACHATA</span>
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
                    <span className="text-xs font-bold">DAGRABOLERO</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{t('create.dnaFlow.boleroDesc')}</p>
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
                    <div className="flex gap-2 flex-wrap pb-1" data-testid="sub-styles">
                      {(dnaFlow === "bachata" ? BACHATA_STYLE_KEYS : BOLERO_STYLE_KEYS).map((styleKey) => (
                        <button
                          key={styleKey}
                          className={cn(
                            "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                            selectedSubStyle === styleKey
                              ? dnaFlow === "bachata"
                                ? "border-primary/50 bg-primary/10 text-primary"
                                : "border-orange-400/50 bg-orange-500/10 text-orange-300"
                              : "border-white/10 text-muted-foreground hover:border-white/20"
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
                    className="overflow-hidden mb-4"
                  >
                    <div className="rounded-xl border border-orange-400/20 bg-orange-500/[0.04] p-4" data-testid="orchestration-panel">
                      <div className="flex items-center gap-2 mb-3">
                        <SlidersHorizontal className="h-3.5 w-3.5 text-orange-400" />
                        <span className="text-xs font-semibold text-orange-300">{t('create.dnaFlow.orchestration.title')}</span>
                      </div>
                      <div className="mb-3">
                        <div className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">{t('create.dnaFlow.orchestration.baseLabel')}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {DGB_BOLERO_BASE_INSTRUMENTS.map((instr) => (
                            <span
                              key={instr}
                              className="px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-400/20 text-[10px] text-orange-300"
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
                                    ? "border-orange-400/50 bg-orange-500/20 text-orange-200"
                                    : "border-white/10 text-muted-foreground hover:border-orange-400/30"
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

              <div className="mb-4">
                <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} data-testid="input-file-upload" />

                {activeCreationMode === "song" && (
                  <Textarea
                    placeholder={activePromptSuggestions[placeholderIdx % activePromptSuggestions.length]}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="bg-white/[0.03] border-white/10 focus:border-primary/40 min-h-[100px] resize-none text-sm placeholder:text-muted-foreground/40"
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

              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">Inspiration</span>
                <span className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[11px] text-foreground flex items-center gap-1.5">
                  {selectedGenre}
                  <button onClick={() => setSelectedGenre("Bachata")} className="text-muted-foreground">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
                <button
                  className="px-2.5 py-1 rounded-full border border-dashed border-white/15 text-[11px] text-muted-foreground flex items-center gap-1"
                  onClick={handleRandomPrompt}
                  data-testid="chip-random"
                >
                  <Dices className="h-2.5 w-2.5 text-orange-400" />+ random
                </button>
              </div>

              {activeCreationMode === "song" && (
                <div className="mb-4" data-testid="genre-carousel-left">
                  <GenreCarousel selectedGenre={selectedGenre} onSelect={setSelectedGenre} />
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

              <Button
                onClick={handleSubmit}
                disabled={isAnyPending || !canCreate}
                className={cn(
                  "w-full font-semibold text-sm",
                  canCreate && !isAnyPending
                    ? "bg-gradient-to-r from-primary to-pink-500 text-white border-primary shadow-[0_0_20px_rgba(255,20,147,0.25)]"
                    : ""
                )}
                size="lg"
                data-testid="button-submit"
              >
                {isAnyPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isAnyPending ? t('create.generating', 'Creating...') : t('create.createButton', 'Create')}
              </Button>

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
                          <Input placeholder="DGB AUDIO" value={copyrightHolder} onChange={(e) => setCopyrightHolder(e.target.value)} className="bg-background/50 border-white/10" data-testid="input-copyright-holder" />
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

          {/* ===== CENTER: Workspace ===== */}
          <div className="overflow-y-auto" data-testid="song-list-panel">
            <div className="border-b border-white/5 px-5 py-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span>Workspaces</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground font-medium">Mi Workspace</span>
              </div>
            </div>

            <div className="px-5 py-3 border-b border-white/5">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-[140px] relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search songs..."
                    className="bg-white/[0.03] border-white/10 text-sm pl-8"
                    data-testid="input-search-songs"
                  />
                </div>
                <Badge variant="outline" className="border-white/10 text-muted-foreground text-[11px] gap-1 cursor-pointer">
                  <Filter className="h-3 w-3" />Filters
                </Badge>
                <Badge variant="outline" className="border-white/10 text-muted-foreground text-[11px] gap-1 cursor-pointer">
                  Newest <ChevronDown className="h-3 w-3" />
                </Badge>
              </div>
            </div>

            {isPending && (
              <div className="px-5 py-3">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t('create.generating2Versions')}</p>
                    <p className="text-[11px] text-muted-foreground">{t('create.firstTimeTip')}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="px-5 py-3">
              {songsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              ) : groupedSongs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                    <Music className="h-8 w-8 text-muted-foreground/20" />
                  </div>
                  <h3 className="text-base font-medium mb-1">{t('create.noSongsYet', 'No hay canciones aún')}</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">{t('create.noSongsDesc', 'Describe tu canción en el panel de la izquierda y presiona crear para empezar.')}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {groupedSongs.map((group) => {
                    const isPair = group.songs.length > 1;
                    return (
                      <div key={group.pairId || group.songs[0]?.id} data-testid={`group-${group.pairId || group.songs[0]?.id}`}>
                        {isPair && (
                          <div className="flex items-center gap-2 mb-1 px-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                              <Zap className="h-2.5 w-2.5 mr-1" />{t('create.twoVersions')}
                            </Badge>
                            <span className="text-xs text-muted-foreground truncate">{group.songs[0]?.title || group.songs[0]?.prompt}</span>
                          </div>
                        )}
                        <div className="space-y-0.5">
                          {group.songs.map((song: any) => (
                            <div
                              key={song.id}
                              className={cn(
                                "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all group/song",
                                playerState.currentSong?.id === song.id
                                  ? "bg-primary/10 border border-primary/20"
                                  : "border border-transparent hover:bg-white/[0.03]"
                              )}
                              onClick={() => handleSongClick(song)}
                              data-testid={`card-recent-song-${song.id}`}
                            >
                              <div className="h-12 w-12 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                                {playerState.currentSong?.id === song.id && playerState.isPlaying ? (
                                  <AudioSpectrum songId={song.id} />
                                ) : song.imageUrl ? (
                                  <img src={song.imageUrl} alt={song.title} className="h-12 w-12 rounded-md object-cover" />
                                ) : song.status === "processing" || song.status === "pending" ? (
                                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                ) : song.status === "completed" ? (
                                  <Play className="h-4 w-4 text-primary fill-current" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                )}
                                {song.duration && song.status === "completed" && (
                                  <span className="absolute bottom-0.5 right-0.5 px-1 py-0 rounded text-[9px] font-mono bg-black/70 text-white">
                                    {formatDuration(song.duration)}
                                  </span>
                                )}
                                {song.variationLabel && (
                                  <span className="absolute top-0 left-0 h-4 w-4 rounded-br bg-primary text-black text-[9px] font-bold flex items-center justify-center">{song.variationLabel}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-medium truncate">
                                    {song.variationLabel ? `${t('create.version')} ${song.variationLabel}` : (song.title || song.prompt || t('create.untitledTrack'))}
                                  </h4>
                                  {song.engine && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-white/10 text-muted-foreground flex-shrink-0">
                                      {song.engine}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {song.genre && <span className="text-[10px] text-muted-foreground">{song.genre}</span>}
                                  {(song.status === "processing" || song.status === "pending") ? (
                                    <span className="text-[10px] text-primary animate-pulse">{t('create.generating')}</span>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground/60">{song.createdAt && formatDistanceToNow(new Date(song.createdAt), { addSuffix: true })}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0 invisible group-hover/song:visible">
                                <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-like-${song.id}`}>
                                  <ThumbsUp className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-dislike-${song.id}`}>
                                  <ThumbsDown className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-share-${song.id}`}>
                                  <Share2 className="h-3 w-3" />
                                </Button>
                                {song.status === "completed" && (
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setLocation("/studio"); }} data-testid={`button-studio-${song.id}`}>
                                    <Scissors className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={(e) => { e.stopPropagation(); deleteSong(song.id); }} data-testid={`button-delete-${song.id}`}>
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

              {groupedSongs.length > 0 && (
                <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-white/5 flex-wrap">
                  <span className="text-xs text-muted-foreground">{allSongs.length} {allSongs.length === 1 ? "song" : "songs"}</span>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setLocation("/library")} data-testid="button-view-all">
                    {t('create.viewAll')}<ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ===== RIGHT: History Panel ===== */}
          <div className="border-l border-white/5 overflow-y-auto bg-background/30 flex flex-col" data-testid="history-panel">
            <div className="p-3 border-b border-white/5 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{t('create.history', 'Historial')}</h2>
                {history.length > 0 && (
                  <span className="text-[10px] bg-white/5 text-muted-foreground px-1.5 rounded-full">{history.length}</span>
                )}
              </div>
              {history.length > 0 && (
                <Button variant="ghost" size="sm" className="text-[11px] text-muted-foreground" onClick={clearHistory} data-testid="button-clear-history">
                  <Trash2 className="h-3 w-3 mr-1" />{t('create.clearHistory', 'Borrar')}
                </Button>
              )}
            </div>

            {playerState.currentSong && (
              <HistoryNowPlaying song={playerState.currentSong} isPlaying={playerState.isPlaying} />
            )}

            <div className="flex-1 overflow-y-auto">
              <div className="p-3">
                {history.length > 0 ? (
                  <div className="space-y-0.5">
                    {history.map((entry) => (
                      <div
                        key={`${entry.song.id}-${entry.playedAt}`}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                          playerState.currentSong?.id === entry.song.id
                            ? "bg-primary/10 border border-primary/20"
                            : "border border-transparent hover:bg-white/[0.03]"
                        )}
                        onClick={() => {
                          const historyQueue = history.map(h => h.song);
                          globalPlay(entry.song, historyQueue);
                        }}
                        data-testid={`history-song-${entry.song.id}`}
                      >
                        <div className="h-10 w-10 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                          {playerState.currentSong?.id === entry.song.id && playerState.isPlaying ? (
                            <AudioSpectrum songId={entry.song.id} />
                          ) : entry.song.imageUrl ? (
                            <img src={entry.song.imageUrl} alt="" className="h-10 w-10 object-cover rounded-md" />
                          ) : (
                            <Music className="h-3.5 w-3.5 text-muted-foreground/30" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-medium truncate">{entry.song.title || entry.song.prompt || t('create.untitledTrack')}</h4>
                          <div className="flex items-center gap-1.5">
                            <p className="text-[10px] text-muted-foreground truncate">{entry.song.genre}</p>
                            <span className="text-[9px] text-muted-foreground/50">{formatDistanceToNow(new Date(entry.playedAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                      <Clock className="h-8 w-8 text-muted-foreground/20" />
                    </div>
                    <p className="text-xs text-muted-foreground">{t('create.noHistory', 'Tu historial aparecerá aquí')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ====== MOBILE / TABLET LAYOUT ====== */}
        <ScrollArea className="lg:hidden flex-1">
        <div className="flex flex-col min-h-screen" data-testid="mobile-layout">
          {mobileView !== "player" && (
            <div className="flex border-b border-white/5 bg-background/80 sticky top-0 z-20">
              <button
                className={cn("flex-1 py-3 text-sm font-medium text-center transition-colors relative", mobileView === "create" ? "text-primary" : "text-muted-foreground")}
                onClick={() => setMobileView("create")}
                data-testid="tab-create"
              >
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" />{t('create.tabCreate', 'Crear')}
                </div>
                {mobileView === "create" && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />}
              </button>
              <button
                className={cn("flex-1 py-3 text-sm font-medium text-center transition-colors relative", mobileView === "songs" ? "text-primary" : "text-muted-foreground")}
                onClick={() => setMobileView("songs")}
                data-testid="tab-songs"
              >
                <div className="flex items-center justify-center gap-2">
                  <Music className="h-4 w-4" />{t('create.tabSongs', 'Canciones')}
                  {allSongs.length > 0 && <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded-full font-bold">{allSongs.length}</span>}
                </div>
                {mobileView === "songs" && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />}
              </button>
            </div>
          )}

          {mobileView === "create" && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">{t('create.pageTitle')}</h2>
              </div>

              <div className="grid grid-cols-2 gap-2" data-testid="mobile-dna-flows">
                <button
                  className={cn("rounded-lg p-2.5 text-left transition-all border", dnaFlow === "bachata" ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.03]")}
                  onClick={() => { if (dnaFlow === "bachata") { setDnaFlow(null); setSelectedSubStyle(null); setSelectedStyleKit(undefined); } else { setDnaFlow("bachata"); setSelectedSubStyle(null); setSelectedGenre("Bachata"); const k = styleKits?.find(k => k.genre === "bachata"); if (k) setSelectedStyleKit(k.id); } }}
                  data-testid="mobile-dna-bachata"
                >
                  <div className="flex items-center gap-2"><Guitar className="h-4 w-4 text-primary" /><span className="text-xs font-bold">DAGRABACHATA</span></div>
                </button>
                <button
                  className={cn("rounded-lg p-2.5 text-left transition-all border", dnaFlow === "bolero" ? "border-orange-400 bg-orange-500/10" : "border-white/10 bg-white/[0.03]")}
                  onClick={() => { if (dnaFlow === "bolero") { setDnaFlow(null); setSelectedSubStyle(null); setSelectedStyleKit(undefined); } else { setDnaFlow("bolero"); setSelectedSubStyle(null); setSelectedGenre("Bolero"); const k = styleKits?.find(k => k.genre === "dgb_bolero"); if (k) setSelectedStyleKit(k.id); } }}
                  data-testid="mobile-dna-bolero"
                >
                  <div className="flex items-center gap-2"><Music className="h-4 w-4 text-orange-400" /><span className="text-xs font-bold">DAGRABOLERO</span></div>
                </button>
              </div>

              <AnimatePresence>
                {dnaFlow && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="flex gap-2 flex-wrap">
                      {(dnaFlow === "bachata" ? BACHATA_STYLE_KEYS : BOLERO_STYLE_KEYS).map((sk) => (
                        <button key={sk} className={cn("px-3 py-1.5 rounded-lg border text-xs", selectedSubStyle === sk ? (dnaFlow === "bachata" ? "border-primary/50 bg-primary/10 text-primary" : "border-orange-400/50 bg-orange-500/10 text-orange-300") : "border-white/10 text-muted-foreground")}
                          onClick={() => {
                            const des = selectedSubStyle === sk;
                            setSelectedSubStyle(des ? null : sk);
                            if (!des) { setSelectedGenre(`${dnaFlow === "bachata" ? "Bachata" : "Bolero"} ${t(`create.dnaFlow.styles.${sk}.label`)}`); }
                            else { setSelectedGenre(dnaFlow === "bachata" ? "Bachata" : "Bolero"); }
                          }}
                        >{t(`create.dnaFlow.styles.${sk}.label`)}</button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                {activeCreationMode === "song" && (
                  <Textarea placeholder={activePromptSuggestions[placeholderIdx % activePromptSuggestions.length]} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="bg-white/[0.03] border-white/10 min-h-[100px] resize-none text-sm placeholder:text-muted-foreground/40" data-testid="mobile-input-prompt" maxLength={500} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }} />
                )}
                {activeCreationMode === "sound" && (
                  <Textarea placeholder={t('create.soundPrompt.placeholder')} value={soundPrompt} onChange={(e) => setSoundPrompt(e.target.value)} className="bg-white/[0.03] border-white/10 min-h-[100px] resize-none text-sm placeholder:text-muted-foreground/40" data-testid="mobile-input-sound" maxLength={500} />
                )}
                {activeCreationMode === "speak" && (
                  <Textarea placeholder={t('create.ttsPrompt.placeholder')} value={ttsText} onChange={(e) => setTtsText(e.target.value)} className="bg-white/[0.03] border-white/10 min-h-[100px] resize-none text-sm placeholder:text-muted-foreground/40" data-testid="mobile-input-tts" maxLength={2000} />
                )}
                {showLyrics && !isInstrumental && activeCreationMode === "song" && (
                  <div className="mt-3">
                    <Textarea placeholder={t('create.lyrics.lyricsPlaceholder')} value={lyrics} onChange={(e) => setLyrics(e.target.value)} className="bg-white/[0.03] border-white/10 min-h-[80px] resize-none text-sm font-mono" data-testid="mobile-input-lyrics" maxLength={3000} />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button className={cn("h-8 px-3 rounded-full border flex items-center gap-1.5 text-xs", isInstrumental ? "border-primary/40 text-primary bg-primary/10" : "border-white/10 text-muted-foreground")} onClick={() => setIsInstrumental(!isInstrumental)} data-testid="mobile-btn-instrumental">
                  <div className={cn("h-3 w-6 rounded-full relative transition-colors", isInstrumental ? "bg-primary" : "bg-white/20")}>
                    <div className={cn("absolute top-0.5 h-2 w-2 rounded-full bg-white transition-all", isInstrumental ? "left-3.5" : "left-0.5")} />
                  </div>
                  {t('create.options.instrumental')}
                </button>
                <button className={cn("h-8 px-3 rounded-full border flex items-center gap-1.5 text-xs", showLyrics ? "border-primary/40 text-primary bg-primary/10" : "border-white/10 text-muted-foreground")} onClick={() => { setShowLyrics(!showLyrics); if (isInstrumental) setIsInstrumental(false); }} data-testid="mobile-btn-lyrics">
                  +{t('create.lyrics.label')}
                </button>
                <button className="h-8 px-3 rounded-full border border-white/10 flex items-center gap-1.5 text-xs text-muted-foreground" onClick={handleRandomPrompt} data-testid="mobile-btn-random">
                  <Dices className="h-3 w-3 text-orange-400" />{t('create.random')}
                </button>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isAnyPending || !canCreate}
                className={cn(
                  "w-full font-semibold text-sm",
                  canCreate && !isAnyPending
                    ? "bg-gradient-to-r from-primary to-pink-500 text-white border-primary shadow-[0_0_20px_rgba(255,20,147,0.25)]"
                    : ""
                )}
                size="lg"
                data-testid="mobile-btn-submit"
              >
                {isAnyPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isAnyPending ? t('create.generating', 'Creating...') : t('create.createButton', 'Create')}
              </Button>

              {activeCreationMode === "song" && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('create.genre', 'Género')}</h3>
                  <GenreCarousel selectedGenre={selectedGenre} onSelect={setSelectedGenre} />
                </div>
              )}
            </div>
          )}

          {mobileView === "songs" && (
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
                <span>Workspaces</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground font-medium">Mi Workspace</span>
              </div>

              {isPending && (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5 mb-4">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  <div><p className="text-sm font-medium">{t('create.generating2Versions')}</p><p className="text-xs text-muted-foreground">{t('create.firstTimeTip')}</p></div>
                </div>
              )}

              {groupedSongs.length === 0 ? (
                <div className="text-center py-16">
                  <Music className="h-12 w-12 text-primary/30 mx-auto mb-4" />
                  <h3 className="text-base font-medium mb-1">{t('create.noSongsYet', 'No hay canciones aún')}</h3>
                  <p className="text-sm text-muted-foreground">{t('create.noSongsDesc', 'Crea tu primera canción.')}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {groupedSongs.map((group) => {
                    const isPair = group.songs.length > 1;
                    return (
                      <div key={group.pairId || group.songs[0]?.id}>
                        {isPair && (
                          <div className="flex items-center gap-2 mb-1 px-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary"><Zap className="h-2.5 w-2.5 mr-0.5" />{t('create.twoVersions')}</Badge>
                          </div>
                        )}
                        {group.songs.map((song: any) => (
                          <div key={song.id} className={cn("flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all", playerState.currentSong?.id === song.id ? "bg-primary/10 border border-primary/20" : "border border-transparent")} onClick={() => handleSongClick(song)} data-testid={`mobile-song-${song.id}`}>
                            <div className="h-12 w-12 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                              {song.imageUrl ? <img src={song.imageUrl} alt="" className="h-12 w-12 object-cover rounded-md" /> : song.status === "completed" ? <Play className="h-4 w-4 text-primary fill-current" /> : <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                              {song.duration && song.status === "completed" && (
                                <span className="absolute bottom-0.5 right-0.5 px-1 py-0 rounded text-[9px] font-mono bg-black/70 text-white">
                                  {formatDuration(song.duration)}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium truncate">{song.title || song.prompt || t('create.untitledTrack')}</h4>
                              <p className="text-[10px] text-muted-foreground">{song.genre} {song.createdAt && `· ${formatDistanceToNow(new Date(song.createdAt), { addSuffix: true })}`}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  <div className="pt-3 mt-2 border-t border-white/5">
                    <span className="text-xs text-muted-foreground">{allSongs.length} {allSongs.length === 1 ? "song" : "songs"}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {mobileView === "player" && (
            <div className="p-4 sm:p-6">
              <button className="flex items-center gap-2 text-sm text-muted-foreground mb-4" onClick={() => setMobileView("songs")} data-testid="mobile-back-btn">
                <ChevronLeft className="h-4 w-4" />{t('create.tabSongs', 'Canciones')}
              </button>
              {activeSong && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15">
                    <div className="h-16 w-16 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {activeSong.imageUrl ? <img src={activeSong.imageUrl} alt="" className="h-16 w-16 object-cover rounded-lg" /> : <Music className="h-6 w-6 text-primary/25" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold truncate">{activeSong.title || activeSong.prompt || t('create.untitledTrack')}</h3>
                      <p className="text-xs text-muted-foreground">{activeSong.genre} {activeSong.artistName ? `· ${activeSong.artistName}` : ""}</p>
                    </div>
                  </div>
                  {activeSong.status === "completed" && activeSong.audioUrl && (
                    <AudioPlayer url={activeSong.audioUrl} title={activeSong.title || activeSong.prompt || ""} imageUrl={null} genre={activeSong.genre} duration={activeSong.duration} createdAt={activeSong.createdAt?.toString()} onOpenStudio={() => setLocation("/studio")} />
                  )}
                  {(activeSong.status === "processing" || activeSong.status === "pending") && (
                    <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                      <div className="flex items-center gap-3"><Loader2 className="h-5 w-5 text-primary animate-spin" /><p className="text-sm">{t('create.creatingWithAI')}</p></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        </ScrollArea>

        {activeSong && (activeSong.status === "processing" || activeSong.status === "pending") && (
          <div className="h-[72px] bg-[#0a0a0a] border-t border-white/10 flex items-center px-4 gap-3 flex-shrink-0" data-testid="footer-player-processing">
            <div className="w-12 h-12 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{activeSong.title || activeSong.prompt || t('create.untitledTrack')}</p>
              <p className="text-[11px] text-muted-foreground">{t('create.creatingWithAI')}</p>
            </div>
            <div className="w-40 h-1.5 bg-white/5 rounded-full overflow-hidden flex-shrink-0">
              <motion.div className="h-full bg-primary/40 rounded-full" animate={{ width: ["10%", "40%", "60%", "75%"] }} transition={{ duration: 240, times: [0, 0.3, 0.6, 1], ease: "easeOut" }} />
            </div>
          </div>
        )}

    </div>
  );
}
