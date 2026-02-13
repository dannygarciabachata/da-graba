import { useState } from "react";
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
  { id: "sound", label: "Create Sound", icon: FileAudio, active: false },
  { id: "speak", label: "Speak text", icon: Mic, active: false },
];

export default function CreatePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [currentSong, setCurrentSong] = useState<any>(null);

  const [prompt, setPrompt] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("Bachata");
  const [showProControls, setShowProControls] = useState(false);
  const [title, setTitle] = useState("");
  const [promptIntensity, setPromptIntensity] = useState([85]);
  const [lyricsIntensity, setLyricsIntensity] = useState([70]);
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [lyrics, setLyrics] = useState("");
  const [activeCreationMode, setActiveCreationMode] = useState("song");
  const [selectedStyleKit, setSelectedStyleKit] = useState<number | undefined>(undefined);

  const { mutate: generate, isPending } = useGenerateSong();
  const { data: songs, isLoading: songsLoading } = useSongs();
  const { mutate: deleteSong } = useDeleteSong();
  const { data: styleKits } = useStyleKits();

  const recentSongs = songs?.slice(0, 6) ?? [];

  const handleGenerate = () => {
    if (!prompt.trim() && !title.trim()) return;
    const finalPrompt = isInstrumental
      ? `${prompt || title} (instrumental, no vocals)`
      : prompt || title;
    generate({
      prompt: finalPrompt,
      title: title || undefined,
      style: selectedGenre,
      genre: selectedGenre,
      mode: title ? "aggregate" : "standard",
      ...(lyrics.trim() && !isInstrumental ? { lyrics: lyrics.trim() } : {}),
      ...(selectedStyleKit ? { styleKitId: selectedStyleKit } : {}),
    } as any);
    setPrompt("");
  };

  const handleRandomPrompt = () => {
    const random = PROMPT_SUGGESTIONS[Math.floor(Math.random() * PROMPT_SUGGESTIONS.length)];
    setPrompt(random);
  };

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
            <div className="relative">
              <Textarea
                placeholder={`${selectedGenre} with vocals about...`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="bg-card border-white/10 focus:border-primary/50 focus:ring-primary/20 min-h-[100px] resize-none text-base pr-24"
                data-testid="input-prompt"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleGenerate();
                  }
                }}
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={handleRandomPrompt}
                  data-testid="button-random-prompt"
                >
                  <Dices className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  onClick={handleGenerate}
                  disabled={isPending || (!prompt.trim() && !title.trim())}
                  className="bg-primary text-black"
                  data-testid="button-submit"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
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
                      <Textarea
                        placeholder={"[Verse]\nWrite your lyrics here...\n\n[Chorus]\nYour chorus..."}
                        value={lyrics}
                        onChange={(e) => setLyrics(e.target.value)}
                        className="bg-background border-white/10 focus:border-primary/50 min-h-[80px] resize-none text-sm font-mono"
                        data-testid="input-lyrics"
                      />
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {CREATION_MODES.map((m) => (
                <Badge
                  key={m.id}
                  variant={activeCreationMode === m.id ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer text-xs gap-1.5 py-1",
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
              ))}
            </div>
          </div>

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
                    <p className="text-sm font-medium">Generating your track...</p>
                    <p className="text-xs text-muted-foreground">This usually takes 30-60 seconds</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {recentSongs.length > 0 && (
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {recentSongs.map((song: any) => (
                  <Card
                    key={song.id}
                    className={cn(
                      "overflow-visible cursor-pointer transition-all border-white/5",
                      currentSong?.id === song.id
                        ? "border-primary/50 bg-primary/5"
                        : "hover-elevate"
                    )}
                    onClick={() => song.status === "completed" && setCurrentSong(song)}
                    data-testid={`card-recent-song-${song.id}`}
                  >
                    <div className="flex items-start gap-3 p-3">
                      <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {song.imageUrl ? (
                          <img
                            src={song.imageUrl}
                            alt={song.title}
                            className="h-12 w-12 rounded-md object-cover"
                          />
                        ) : song.status === "processing" ? (
                          <Loader2 className="h-5 w-5 text-primary animate-spin" />
                        ) : song.status === "completed" ? (
                          <Play className="h-5 w-5 text-primary fill-current" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium line-clamp-1">
                          {song.title || song.prompt}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          {song.genre && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10">
                              {song.genre}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {song.createdAt && formatDistanceToNow(new Date(song.createdAt), { addSuffix: true })}
                          </span>
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
          )}

          {currentSong && (
            <div className="mb-8">
              <AudioPlayer
                url={currentSong.audioUrl}
                title={currentSong.title || "Untitled Track"}
                imageUrl={currentSong.imageUrl}
                genre={currentSong.genre}
              />
            </div>
          )}

        </div>
      </div>
    </ScrollArea>
  );
}
