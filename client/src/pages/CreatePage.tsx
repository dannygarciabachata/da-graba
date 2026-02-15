import { useState, useEffect } from "react";
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

const CREATION_MODES = [
  { id: "song", label: "Create song", icon: Music, active: true },
  { id: "sound", label: "Create Sound", icon: FileAudio, active: true },
  { id: "speak", label: "Speak text", icon: Mic, active: true },
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

export default function CreatePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [currentSong, setCurrentSong] = useState<any>(null);
  const { toast } = useToast();

  const [prompt, setPrompt] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("Bachata");
  const [showProControls, setShowProControls] = useState(false);
  const [title, setTitle] = useState("");
  const [promptIntensity, setPromptIntensity] = useState([85]);
  const [lyricsIntensity, setLyricsIntensity] = useState([70]);
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [songDuration, setSongDuration] = useState(180);
  const [lyrics, setLyrics] = useState("");
  const [activeCreationMode, setActiveCreationMode] = useState("song");
  const [selectedStyleKit, setSelectedStyleKit] = useState<number | undefined>(undefined);
  const [artistName, setArtistName] = useState("");
  const [copyrightHolder, setCopyrightHolder] = useState("DGB Studio");

  const [soundPrompt, setSoundPrompt] = useState("");
  const [soundDuration, setSoundDuration] = useState([5]);

  const [ttsText, setTtsText] = useState("");
  const [ttsVoiceId, setTtsVoiceId] = useState("");
  const [ttsLanguage, setTtsLanguage] = useState("en");

  const { mutate: generate, isPending } = useGenerateSong();
  const { data: songs, isLoading: songsLoading } = useSongs();
  const { mutate: deleteSong } = useDeleteSong();
  const { data: styleKits } = useStyleKits();

  const { mutate: generateSound, isPending: isSoundPending } = useMutation({
    mutationFn: async (data: { prompt: string; duration: number }) => {
      const res = await apiRequest("POST", "/api/audio/sound-generator", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      toast({
        title: "Sound Effect Created",
        description: "Your sound effect is being generated.",
      });
      setSoundPrompt("");
    },
    onError: (error: Error) => {
      toast({
        title: "Sound Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { mutate: generateTTS, isPending: isTTSPending } = useMutation({
    mutationFn: async (data: { text: string; voiceId?: string; language: string }) => {
      const res = await apiRequest("POST", "/api/audio/tts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      toast({
        title: "Speech Generated",
        description: "Your text-to-speech audio is being created.",
      });
      setTtsText("");
    },
    onError: (error: Error) => {
      toast({
        title: "TTS Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lyricsParam = params.get("lyrics");
    const titleParam = params.get("title");
    const genreParam = params.get("genre");
    if (lyricsParam) {
      setLyrics(lyricsParam);
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
    const random = PROMPT_SUGGESTIONS[Math.floor(Math.random() * PROMPT_SUGGESTIONS.length)];
    setPrompt(random);
  };

  const isAnyPending = isPending || isSoundPending || isTTSPending;

  const canCreate =
    activeCreationMode === "song"
      ? !!(prompt.trim() || title.trim() || lyrics.trim())
      : activeCreationMode === "sound"
      ? !!soundPrompt.trim()
      : !!ttsText.trim();

  if (!user) return null;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col items-center w-full">
        <div className="w-full max-w-3xl px-4 py-6 md:py-10 mx-auto">

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-2xl md:text-3xl font-bold mb-1" data-testid="text-create-title">
              Create something new today
            </h1>
            <p className="text-sm text-muted-foreground">
              12 credits per song
            </p>
          </motion.div>

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {CREATION_MODES.map((m) => (
                <motion.div
                  key={m.id}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Badge
                    variant={activeCreationMode === m.id ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer text-xs gap-1.5 py-1 transition-all duration-200",
                      activeCreationMode === m.id
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "text-muted-foreground border-white/10"
                    )}
                    onClick={() => setActiveCreationMode(m.id)}
                    data-testid={`badge-mode-${m.id}`}
                  >
                    <m.icon className="h-3 w-3" />
                    {m.label}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {activeCreationMode === "song" && (
              <motion.div
                key="song-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6 space-y-3">
                  <div className="relative">
                    <Textarea
                      placeholder={`${selectedGenre} with vocals about...`}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="bg-card border-white/10 focus:border-primary/50 focus:ring-primary/20 min-h-[100px] resize-none text-base"
                      data-testid="input-prompt"
                      maxLength={500}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          handleGenerate();
                        }
                      }}
                    />
                    <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/60" data-testid="text-prompt-charcount">
                      {prompt.length}/500
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      className="text-muted-foreground gap-1.5"
                      onClick={handleRandomPrompt}
                      data-testid="button-random-prompt"
                    >
                      <Dices className="h-4 w-4" />
                      <span className="text-xs">Random</span>
                    </Button>
                    <Button
                      onClick={handleGenerate}
                      disabled={isPending || (!prompt.trim() && !title.trim() && !lyrics.trim())}
                      className={cn(
                        "bg-primary text-black gap-2 transition-all duration-300",
                        canCreate && !isPending && "shadow-[0_0_16px_rgba(0,243,255,0.3)]"
                      )}
                      data-testid="button-submit"
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>Create</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setShowProControls(!showProControls)}
                    data-testid="button-pro-controls"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Pro controls
                    {showProControls ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>
                  <Badge
                    variant={isInstrumental ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer text-xs gap-1 toggle-elevate",
                      isInstrumental && "toggle-elevated bg-primary/20 text-primary border-primary/30"
                    )}
                    onClick={() => setIsInstrumental(!isInstrumental)}
                    data-testid="badge-instrumental"
                  >
                    <Music className="h-3 w-3" />
                    Instrumental
                  </Badge>
                  <Badge
                    variant={!isInstrumental ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer text-xs gap-1 toggle-elevate",
                      !isInstrumental && "toggle-elevated bg-primary/20 text-primary border-primary/30"
                    )}
                    onClick={() => setIsInstrumental(false)}
                    data-testid="badge-lyrics-mode"
                  >
                    <Mic className="h-3 w-3" />
                    Lyrics
                  </Badge>
                </div>

                <AnimatePresence>
                  {showProControls && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-6"
                    >
                      <Card className="p-4 space-y-4 border-white/5">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            Title
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3" />
                              </TooltipTrigger>
                              <TooltipContent>Optional song title</TooltipContent>
                            </Tooltip>
                          </Label>
                          <Input
                            placeholder="Enter song title (optional)"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="bg-background border-white/10 focus:border-primary/50 text-sm"
                            data-testid="input-title"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <User className="h-3 w-3" />
                            Artist Name
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3" />
                              </TooltipTrigger>
                              <TooltipContent>Your artist or stage name for credits</TooltipContent>
                            </Tooltip>
                          </Label>
                          <Input
                            placeholder="Your artist/stage name"
                            value={artistName}
                            onChange={(e) => setArtistName(e.target.value)}
                            className="bg-background border-white/10 focus:border-primary/50 text-sm"
                            data-testid="input-artist-name"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Copyright className="h-3 w-3" />
                            Copyright Holder
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3" />
                              </TooltipTrigger>
                              <TooltipContent>Entity or person who owns the copyright</TooltipContent>
                            </Tooltip>
                          </Label>
                          <Input
                            placeholder="DGB Studio"
                            value={copyrightHolder}
                            onChange={(e) => setCopyrightHolder(e.target.value)}
                            className="bg-background border-white/10 focus:border-primary/50 text-sm"
                            data-testid="input-copyright-holder"
                          />
                        </div>

                        {styleKits && styleKits.length > 0 && (
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                              Style Kit
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3 w-3" />
                                </TooltipTrigger>
                                <TooltipContent>Use a custom instrument kit to define your song's style</TooltipContent>
                              </Tooltip>
                            </Label>
                            <select
                              className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
                              value={selectedStyleKit || ""}
                              onChange={(e) => setSelectedStyleKit(e.target.value ? Number(e.target.value) : undefined)}
                              data-testid="select-style-kit"
                            >
                              <option value="">None (default)</option>
                              {styleKits.map((kit) => (
                                <option key={kit.id} value={kit.id}>
                                  {kit.name} ({kit.genre.replace(/_/g, " ")}) — {kit.instruments.length} instruments
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            Song duration
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3" />
                              </TooltipTrigger>
                              <TooltipContent>Length of the generated song in seconds</TooltipContent>
                            </Tooltip>
                          </Label>
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

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            Prompt intensity
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3" />
                              </TooltipTrigger>
                              <TooltipContent>How closely the AI follows your prompt</TooltipContent>
                            </Tooltip>
                          </Label>
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
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            Lyrics intensity
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3" />
                              </TooltipTrigger>
                              <TooltipContent>Controls creativity vs. precision in lyrics</TooltipContent>
                            </Tooltip>
                          </Label>
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

                        {!isInstrumental && (
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Custom lyrics</Label>
                            <div className="relative">
                              <Textarea
                                placeholder={"[Verse]\nWrite your lyrics here...\n\n[Chorus]\nYour chorus..."}
                                value={lyrics}
                                onChange={(e) => setLyrics(e.target.value)}
                                className="bg-background border-white/10 focus:border-primary/50 min-h-[80px] resize-none text-sm font-mono"
                                data-testid="input-lyrics"
                                maxLength={3000}
                              />
                              <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/60" data-testid="text-lyrics-charcount">
                                {lyrics.length}/3000
                              </span>
                            </div>
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mb-8">
                  <ScrollArea className="w-full">
                    <div className="flex gap-2.5 pb-3">
                      {GENRE_CARDS.map((genre) => (
                        <Card
                          key={genre.value}
                          className={cn(
                            "p-3 cursor-pointer transition-all border-white/5 flex-shrink-0 w-[140px]",
                            selectedGenre === genre.value
                              ? "border-primary/50 bg-primary/5"
                              : "hover-elevate"
                          )}
                          onClick={() => setSelectedGenre(genre.value)}
                          data-testid={`card-genre-${genre.value}`}
                        >
                          <div className="text-sm font-medium mb-1 line-clamp-1">{genre.value}</div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ThumbsUp className="h-3 w-3" />
                            {genre.likes} Likes
                          </div>
                        </Card>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
              </motion.div>
            )}

            {activeCreationMode === "sound" && (
              <motion.div
                key="sound-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6 space-y-4">
                  <Card className="p-4 space-y-4 border-white/5">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <FileAudio className="h-3 w-3" />
                        Describe your sound effect
                      </Label>
                      <div className="relative">
                        <Textarea
                          placeholder="A thunderclap followed by heavy rain on a tin roof..."
                          value={soundPrompt}
                          onChange={(e) => setSoundPrompt(e.target.value)}
                          className="bg-background border-white/10 focus:border-primary/50 focus:ring-primary/20 min-h-[120px] resize-none text-base"
                          data-testid="input-sound-prompt"
                          maxLength={500}
                        />
                        <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/60" data-testid="text-sound-charcount">
                          {soundPrompt.length}/500
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        Duration: {soundDuration[0]}s
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
                      <div className="flex justify-between text-[10px] text-muted-foreground/60">
                        <span>1s</span>
                        <span>30s</span>
                      </div>
                    </div>
                  </Card>

                  <div className="flex items-center justify-end">
                    <Button
                      onClick={handleSoundGenerate}
                      disabled={isSoundPending || !soundPrompt.trim()}
                      className={cn(
                        "bg-primary text-black gap-2 transition-all duration-300",
                        soundPrompt.trim() && !isSoundPending && "shadow-[0_0_16px_rgba(0,243,255,0.3)]"
                      )}
                      data-testid="button-sound-submit"
                    >
                      {isSoundPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <FileAudio className="h-4 w-4" />
                          <span>Generate Sound</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeCreationMode === "speak" && (
              <motion.div
                key="speak-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6 space-y-4">
                  <Card className="p-4 space-y-4 border-white/5">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Mic className="h-3 w-3" />
                        Text to speak
                      </Label>
                      <div className="relative">
                        <Textarea
                          placeholder="Enter the text you want to convert to speech..."
                          value={ttsText}
                          onChange={(e) => setTtsText(e.target.value)}
                          className="bg-background border-white/10 focus:border-primary/50 focus:ring-primary/20 min-h-[120px] resize-none text-base"
                          data-testid="input-tts-text"
                          maxLength={2000}
                        />
                        <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/60" data-testid="text-tts-charcount">
                          {ttsText.length}/2000
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          Voice ID (optional)
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3" />
                            </TooltipTrigger>
                            <TooltipContent>Specific voice model ID for synthesis</TooltipContent>
                          </Tooltip>
                        </Label>
                        <Input
                          placeholder="Leave empty for default"
                          value={ttsVoiceId}
                          onChange={(e) => setTtsVoiceId(e.target.value)}
                          className="bg-background border-white/10 focus:border-primary/50 text-sm"
                          data-testid="input-tts-voice-id"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Language</Label>
                        <select
                          className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
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
                  </Card>

                  <div className="flex items-center justify-end">
                    <Button
                      onClick={handleTTSGenerate}
                      disabled={isTTSPending || !ttsText.trim()}
                      className={cn(
                        "bg-primary text-black gap-2 transition-all duration-300",
                        ttsText.trim() && !isTTSPending && "shadow-[0_0_16px_rgba(0,243,255,0.3)]"
                      )}
                      data-testid="button-tts-submit"
                    >
                      {isTTSPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Mic className="h-4 w-4" />
                          <span>Generate Speech</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isPending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-8"
            >
              <Card className="p-4 border-primary/20 bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Generando 2 versiones de tu track...</p>
                    <p className="text-xs text-muted-foreground">Elige la que más te guste. La primera vez puede tomar ~5-10 min</p>
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
                className="mb-8"
              >
                <AudioPlayer
                  url={activeSong.audioUrl}
                  title={activeSong.title || activeSong.prompt || "Untitled Track"}
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
                className="mb-8"
              >
                <Card className="p-4 border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activeSong.title || activeSong.prompt || "Track"}</p>
                      <p className="text-xs text-muted-foreground">Creando tu canción con IA en el GPU...</p>
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
                    <p className="text-[10px] text-muted-foreground text-right">Estimado ~3-5 min</p>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {recentGroups.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Recent Creations
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => setLocation("/library")}
                  data-testid="button-view-all"
                >
                  View All
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
                            2 versiones
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
                                : "hover-elevate"
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
                                  {song.variationLabel ? `Version ${song.variationLabel}` : (song.title || song.prompt)}
                                  {!song.variationLabel && ""}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  {song.genre && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10">
                                      {song.genre}
                                    </Badge>
                                  )}
                                  {song.status === "processing" || song.status === "pending" ? (
                                    <span className="text-[10px] text-primary">Generando...</span>
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
