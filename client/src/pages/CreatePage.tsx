import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useGenerateSong, useSongs } from "@/hooks/use-songs";
import { useStyleKits } from "@/hooks/use-style-kits";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Sparkles,
  Music,
  Wand2,
  Home,
  Disc3,
  Library,
  Headphones,
  Store,
  Mic2,
  Radio,
  LayoutDashboard,
  Settings,
  TrendingUp,
  PanelLeftClose,
  PanelLeftOpen,
  ListMusic,
  ChevronLeft,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useDeleteSong } from "@/hooks/use-songs";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

import {
  SidebarNavItem,
  HistoryNowPlaying,
  CreatePanel,
  SongListPanel,
  MobileCreateView,
  MobileSongsView,
  MobilePlayerView,
  GENRE_CARDS,
  PROMPT_SUGGESTIONS,
  BACHATA_SUGGESTIONS,
  BOLERO_SUGGESTIONS,
  GENRE_SLUG_TO_VALUE,
  GENRE_VALUE_TO_SLUG,
  type DnaFlow,
  type CreationMode,
} from "@/components/create";

export default function CreatePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { play: globalPlay, state: playerState } = usePlayer();
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
  const [copyrightHolder, setCopyrightHolder] = useState("Da Graba LLC");
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { mutate: generate, isPending } = useGenerateSong();
  const { data: songs, isLoading: songsLoading } = useSongs();
  const { mutate: deleteSong } = useDeleteSong();
  const { data: styleKits } = useStyleKits();
  const { data: genreStylesData } = useQuery<any[]>({ queryKey: ["/api/genre-styles"] });

  const genreStylesByGenre = useMemo(() => {
    const map: Record<string, any[]> = {};
    (genreStylesData || []).forEach((s: any) => {
      if (!s.isActive) return;
      if (!map[s.genre]) map[s.genre] = [];
      map[s.genre].push(s);
    });
    Object.values(map).forEach(arr => arr.sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0)));
    return map;
  }, [genreStylesData]);

  const currentGenreSlug = useMemo(() => {
    if (dnaFlow) return dnaFlow;
    return GENRE_VALUE_TO_SLUG[selectedGenre] || selectedGenre.toLowerCase().replace(/\s+/g, "_");
  }, [dnaFlow, selectedGenre]);

  const currentGenreStyles = genreStylesByGenre[currentGenreSlug] || [];

  const selectedStyleData = useMemo(() => {
    if (!selectedSubStyle || !currentGenreStyles.length) return null;
    return currentGenreStyles.find((s: any) => s.slug === selectedSubStyle) || null;
  }, [selectedSubStyle, currentGenreStyles]);

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
    let basePrompt = prompt || title;
    if (selectedStyleData?.promptHint) {
      basePrompt = `${basePrompt}. Style: ${selectedStyleData.promptHint}`;
    }
    const finalPrompt = isInstrumental
      ? `${basePrompt} (instrumental, no vocals)`
      : basePrompt;
    const orchestrationList = (() => {
      if (selectedStyleData) {
        return [...(selectedStyleData.baseInstruments || []), ...Array.from(selectedOrchestration)];
      }
      if (currentGenreStyles.length > 0 && !selectedSubStyle) {
        const defaultStyle = currentGenreStyles[0];
        if (defaultStyle?.baseInstruments?.length) {
          return [...defaultStyle.baseInstruments, ...Array.from(selectedOrchestration)];
        }
      }
      return undefined;
    })();
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
      ...(selectedSubStyle ? { genreStyleSlug: selectedSubStyle } : {}),
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
    if (window.innerWidth < 1024) {
      setMobileView("songs");
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

  const sharedCreatePanelProps = {
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
    placeholderIdx,
    activePromptSuggestions,
    currentGenreSlug,
    currentGenreStyles,
    selectedStyleData,
    styleKits,
    isAnyPending,
    canCreate,
    handleSubmit,
    handleRandomPrompt,
    handleFileAttach,
    handleFileChange,
    fileInputRef: fileInputRef as React.RefObject<HTMLInputElement>,
    setLocation,
  };

  return (
    <div className="h-full flex flex-col">

        {/* ====== DESKTOP: Nav + Create + Tracks layout ====== */}
        <div className="hidden lg:flex flex-1 overflow-hidden" data-testid="desktop-layout">

          {/* ===== NAV SIDEBAR ===== */}
          <motion.nav
            animate={{ width: sidebarCollapsed ? 64 : 200 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-shrink-0 border-r border-white/5 bg-black/20 overflow-y-auto overflow-x-hidden flex flex-col"
            data-testid="create-nav-sidebar"
          >
            <div className="flex items-center justify-center py-3 px-2 border-b border-white/5 mb-3">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                data-testid="button-toggle-sidebar"
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex-1 px-2 space-y-5">
              <div className="space-y-1">
                <SidebarNavItem icon={Home} label={t('nav.home', 'Inicio')} href="/home" collapsed={sidebarCollapsed} />
                <SidebarNavItem icon={Sparkles} label={t('nav.create', 'Crear')} href="/create" active collapsed={sidebarCollapsed} />
                <SidebarNavItem icon={Library} label={t('nav.library', 'Biblioteca')} href="/library" collapsed={sidebarCollapsed} />
                <SidebarNavItem icon={Disc3} label={t('nav.discover', 'Descubrir')} href="/discover" collapsed={sidebarCollapsed} />
                <SidebarNavItem icon={ListMusic} label={t('nav.playlists', 'Playlists')} href="/my-playlists" collapsed={sidebarCollapsed} />
              </div>
              {!sidebarCollapsed && <div className="text-[9px] uppercase tracking-widest text-muted-foreground/40 px-3">{t('nav.tools', 'Herramientas')}</div>}
              <div className="space-y-1">
                <SidebarNavItem icon={Headphones} label="Studio DAW" href="/studio" collapsed={sidebarCollapsed} />
                <SidebarNavItem icon={Mic2} label="Sample Lab" href="/sample-lab" collapsed={sidebarCollapsed} />
                <SidebarNavItem icon={Wand2} label={t('nav.lyrics', 'Letras AI')} href="/lyrics" collapsed={sidebarCollapsed} />
                <SidebarNavItem icon={Radio} label={t('nav.audioTools', 'Audio Tools')} href="/audio-tools" collapsed={sidebarCollapsed} />
              </div>
              {!sidebarCollapsed && <div className="text-[9px] uppercase tracking-widest text-muted-foreground/40 px-3">{t('nav.artist', 'Artista')}</div>}
              <div className="space-y-1">
                <SidebarNavItem icon={TrendingUp} label="Dashboard" href="/artist-dashboard" collapsed={sidebarCollapsed} />
                <SidebarNavItem icon={Store} label={t('nav.store', 'Tienda')} href="/producer-store" collapsed={sidebarCollapsed} />
                <SidebarNavItem icon={LayoutDashboard} label={t('nav.styleKits', 'Style Kits')} href="/style-kits" collapsed={sidebarCollapsed} />
              </div>
              {!sidebarCollapsed && <div className="text-[9px] uppercase tracking-widest text-muted-foreground/40 px-3">{t('nav.more', 'Más')}</div>}
              <div className="space-y-1">
                <SidebarNavItem icon={Settings} label={t('nav.pricing', 'Planes')} href="/pricing" collapsed={sidebarCollapsed} />
              </div>
            </div>
          </motion.nav>

          {/* ===== MAIN CONTENT ===== */}
          <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">

          <CreatePanel {...sharedCreatePanelProps} />

          {/* ===== RIGHT: Now Playing + Track List ===== */}
          <div className="space-y-6">
            {activeSong && (
              <div className="relative" data-testid="now-playing-panel">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-orange-600 rounded-2xl blur-xl opacity-20" />
                <div className="relative bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                  <HistoryNowPlaying song={activeSong as PlayerSong} isPlaying={playerState.isPlaying} />
                </div>
              </div>
            )}

          <SongListPanel
            groupedSongs={groupedSongs}
            allSongs={allSongs}
            songsLoading={songsLoading}
            isPending={isPending}
            playerState={playerState}
            onSongClick={handleSongClick}
            onDeleteSong={(id) => deleteSong(id)}
            onViewAll={() => setLocation("/library")}
          />
          </div>
          </div>
          </div>
          </div>
        </div>

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(249, 115, 22, 0.4); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(249, 115, 22, 0.6); }
        `}</style>

        {/* ====== MOBILE / TABLET LAYOUT ====== */}
        <ScrollArea className="lg:hidden flex-1">
        <div className="flex flex-col min-h-screen" data-testid="mobile-layout">
          {mobileView !== "player" && (
            <div className="flex border-b border-white/5 bg-background/80 sticky top-0 z-20">
              <button
                className={cn("flex-1 py-3.5 text-sm font-semibold text-center transition-colors relative", mobileView === "create" ? "text-primary" : "text-muted-foreground")}
                onClick={() => setMobileView("create")}
                data-testid="tab-create"
              >
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" />{t('create.tabCreate', 'Crear')}
                </div>
                {mobileView === "create" && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />}
              </button>
              <button
                className={cn("flex-1 py-3.5 text-sm font-semibold text-center transition-colors relative", mobileView === "songs" ? "text-primary" : "text-muted-foreground")}
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
            <MobileCreateView
              prompt={prompt} setPrompt={setPrompt}
              selectedGenre={selectedGenre} setSelectedGenre={setSelectedGenre}
              isInstrumental={isInstrumental} setIsInstrumental={setIsInstrumental}
              songDuration={songDuration} setSongDuration={setSongDuration}
              lyrics={lyrics} setLyrics={setLyrics}
              showLyrics={showLyrics} setShowLyrics={setShowLyrics}
              activeCreationMode={activeCreationMode} setActiveCreationMode={setActiveCreationMode}
              dnaFlow={dnaFlow} setDnaFlow={setDnaFlow}
              selectedSubStyle={selectedSubStyle} setSelectedSubStyle={setSelectedSubStyle}
              selectedOrchestration={selectedOrchestration} setSelectedOrchestration={setSelectedOrchestration}
              soundPrompt={soundPrompt} setSoundPrompt={setSoundPrompt}
              ttsText={ttsText} setTtsText={setTtsText}
              placeholderIdx={placeholderIdx}
              activePromptSuggestions={activePromptSuggestions}
              currentGenreSlug={currentGenreSlug}
              currentGenreStyles={currentGenreStyles}
              styleKits={styleKits}
              selectedStyleKit={selectedStyleKit}
              setSelectedStyleKit={setSelectedStyleKit}
              handleSubmit={handleSubmit}
              handleRandomPrompt={handleRandomPrompt}
            />
          )}

          {mobileView === "songs" && (
            <MobileSongsView
              groupedSongs={groupedSongs}
              allSongs={allSongs}
              isPending={isPending}
              playerState={playerState}
              onSongClick={handleSongClick}
            />
          )}

          {mobileView === "player" && (
            <MobilePlayerView
              activeSong={activeSong}
              playerState={playerState}
              onBack={() => setMobileView("songs")}
            />
          )}
        </div>
        </ScrollArea>
    </div>
  );
}
