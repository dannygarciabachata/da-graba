import { useState } from "react";
import { useGenerateSong } from "@/hooks/use-songs";
import { useSongs } from "@/hooks/use-songs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Sparkles,
  Heart,
  Music,
  Sliders,
  Layers,
  Play,
  Clock,
  AlertCircle,
  Trash2,
  Scissors,
  Dices,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useDeleteSong } from "@/hooks/use-songs";
import { AudioPlayer } from "@/components/AudioPlayer";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const STYLE_OPTIONS = [
  { value: "Bachata", label: "Bachata" },
  { value: "Pop", label: "Pop" },
  { value: "R&B", label: "R&B" },
  { value: "Hip-Hop", label: "Hip-Hop" },
  { value: "Rock", label: "Rock" },
  { value: "EDM", label: "EDM" },
  { value: "Jazz", label: "Jazz" },
  { value: "Reggaeton", label: "Reggaeton" },
  { value: "Country", label: "Country" },
  { value: "Lo-Fi", label: "Lo-Fi" },
  { value: "Classical", label: "Classical" },
  { value: "Blues", label: "Blues" },
  { value: "Funk", label: "Funk" },
  { value: "Ambient", label: "Ambient" },
  { value: "Latin Pop", label: "Latin Pop" },
  { value: "Reggae", label: "Reggae" },
  { value: "Metal", label: "Metal" },
  { value: "Indie", label: "Indie" },
  { value: "Synthwave", label: "Synthwave" },
  { value: "Folk", label: "Folk" },
];

const GENRE_OPTIONS = [
  { value: "Bachata", label: "Bachata" },
  { value: "Merengue", label: "Merengue" },
  { value: "Salsa", label: "Salsa" },
  { value: "Reggaeton", label: "Reggaeton" },
  { value: "Bolero", label: "Bolero" },
  { value: "Cumbia", label: "Cumbia" },
  { value: "Latin Pop", label: "Latin Pop" },
  { value: "R&B Latino", label: "R&B Latino" },
  { value: "Dembow", label: "Dembow" },
  { value: "Tropical", label: "Tropical" },
];

const PROMPT_SUGGESTIONS = [
  "A romantic bachata under the Caribbean moonlight",
  "Sensual dance track with güira and bongo grooves",
  "Heartbreak bolero with crying requinto guitar",
  "Upbeat merengue fusion with modern beats",
  "Trio serenade inspired by Frank Reyes",
  "Urban bachata with trap influences",
];

type GeneratorMode = "simple" | "custom";

export default function CreatePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<GeneratorMode>("simple");
  const [currentSong, setCurrentSong] = useState<any>(null);

  const [simplePrompt, setSimplePrompt] = useState("");
  const [simpleStyle, setSimpleStyle] = useState("Bachata");

  const [prompt, setPrompt] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [isBachata, setIsBachata] = useState(true);
  const [style, setStyle] = useState("Bachata");
  const [genre, setGenre] = useState("Bachata");
  const [title, setTitle] = useState("");

  const { mutate: generate, isPending } = useGenerateSong();
  const { data: songs, isLoading: songsLoading } = useSongs();
  const { mutate: deleteSong } = useDeleteSong();

  const recentSongs = songs?.slice(0, 6) ?? [];

  const handleSimpleGenerate = () => {
    if (!simplePrompt.trim()) return;
    generate({
      prompt: simplePrompt,
      isBachata: true,
      style: simpleStyle,
      mode: "standard",
    });
    setSimplePrompt("");
  };

  const handleCustomGenerate = () => {
    if (!prompt.trim() && !title.trim()) return;
    generate({
      prompt: prompt || title,
      title: title || undefined,
      genre,
      isBachata,
      style,
      mode: title ? "aggregate" : "standard",
      ...(lyrics.trim() ? { lyrics: lyrics.trim() } : {}),
    });
    setPrompt("");
    setTitle("");
    setLyrics("");
  };

  const handleRandomPrompt = () => {
    const random = PROMPT_SUGGESTIONS[Math.floor(Math.random() * PROMPT_SUGGESTIONS.length)];
    if (mode === "simple") {
      setSimplePrompt(random);
    } else {
      setPrompt(random);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col lg:flex-row h-full">
      <div className="flex-1 flex flex-col items-center justify-start overflow-auto">
        <div className="w-full max-w-2xl px-4 py-8 md:py-12 mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-4">
              <Heart className="h-3 w-3" />
              Heart Mula Music Engine
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2" data-testid="text-create-title">
              Create your next track
            </h1>
            <p className="text-sm text-muted-foreground">
              Describe your song and let the Heart Mula engine bring it to life
            </p>
          </motion.div>

          <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 max-w-xs mx-auto">
            <Button
              variant={mode === "simple" ? "default" : "ghost"}
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              onClick={() => setMode("simple")}
              data-testid="button-mode-simple"
            >
              <Layers className="h-3.5 w-3.5" />
              Simple
            </Button>
            <Button
              variant={mode === "custom" ? "default" : "ghost"}
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              onClick={() => setMode("custom")}
              data-testid="button-mode-custom"
            >
              <Sliders className="h-3.5 w-3.5" />
              Custom
            </Button>
          </div>

          <AnimatePresence mode="wait">
            {mode === "simple" ? (
              <motion.div
                key="simple"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="relative">
                  <Textarea
                    placeholder="Describe your song... e.g. A romantic bachata with soft requinto guitar under the moonlight"
                    value={simplePrompt}
                    onChange={(e) => setSimplePrompt(e.target.value)}
                    className="bg-card border-white/10 focus:border-primary/50 focus:ring-primary/20 min-h-[120px] resize-none text-base pr-10"
                    data-testid="input-simple-prompt"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 text-muted-foreground"
                    onClick={handleRandomPrompt}
                    data-testid="button-random-prompt"
                  >
                    <Dices className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Style:</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {STYLE_OPTIONS.map((opt) => (
                      <Badge
                        key={opt.value}
                        variant={simpleStyle === opt.value ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer text-xs transition-colors",
                          simpleStyle === opt.value
                            ? "bg-primary text-black"
                            : "border-white/10 text-muted-foreground"
                        )}
                        onClick={() => setSimpleStyle(opt.value)}
                        data-testid={`badge-style-${opt.value}`}
                      >
                        {opt.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleSimpleGenerate}
                  disabled={isPending || !simplePrompt.trim()}
                  className="w-full text-base font-semibold bg-primary text-black shadow-lg shadow-primary/25"
                  data-testid="button-create-simple"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Composing your track...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Create
                    </>
                  )}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="custom"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Song Title</Label>
                    <Input
                      placeholder="Mi Corazón Latiendo..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="bg-card border-white/10 focus:border-primary/50 text-sm"
                      data-testid="input-custom-title"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Genre</Label>
                    <Select value={genre} onValueChange={setGenre}>
                      <SelectTrigger className="bg-card border-white/10" data-testid="select-custom-genre">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GENRE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <Label className="text-xs text-muted-foreground">Describe your track</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground h-6 px-2"
                      onClick={handleRandomPrompt}
                      data-testid="button-random-custom"
                    >
                      <Dices className="h-3 w-3 mr-1" />
                      Random
                    </Button>
                  </div>
                  <Textarea
                    placeholder="A romantic melody under Caribbean moonlight, requinto crying softly..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="bg-card border-white/10 focus:border-primary/50 min-h-[80px] resize-none text-sm"
                    data-testid="input-custom-prompt"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Lyrics (optional)</Label>
                  <Textarea
                    placeholder={"[Verse]\nBajo la luna de Santo Domingo\nTu mirada me tiene cautivo...\n\n[Chorus]\nBailamos bachata toda la noche..."}
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    className="bg-card border-white/10 focus:border-primary/50 min-h-[100px] resize-none text-sm font-mono"
                    data-testid="input-custom-lyrics"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Style Preset</Label>
                  <Select value={style} onValueChange={setStyle}>
                    <SelectTrigger className="bg-card border-white/10" data-testid="select-custom-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STYLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-white/5">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Bachata Mode</Label>
                    <p className="text-xs text-muted-foreground">Force Dominican instruments</p>
                  </div>
                  <Switch
                    checked={isBachata}
                    onCheckedChange={setIsBachata}
                    className="data-[state=checked]:bg-primary"
                    data-testid="switch-bachata-mode"
                  />
                </div>

                <Button
                  onClick={handleCustomGenerate}
                  disabled={isPending || (!prompt.trim() && !title.trim())}
                  className="w-full text-base font-semibold bg-primary text-black shadow-lg shadow-primary/25"
                  data-testid="button-create-custom"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Composing your track...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Create
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {recentSongs.length > 0 && (
          <div className="w-full max-w-4xl px-4 pb-8 mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Creations</h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setLocation("/library")}
                data-testid="button-view-all"
              >
                View All
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentSongs.map((song: any) => (
                <Card
                  key={song.id}
                  className={cn(
                    "p-3 cursor-pointer transition-all duration-200 border-white/5",
                    currentSong?.id === song.id
                      ? "border-primary/50 bg-primary/5"
                      : "hover-elevate"
                  )}
                  onClick={() => song.status === "completed" && setCurrentSong(song)}
                  data-testid={`card-recent-song-${song.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-medium line-clamp-1 flex-1">
                      {song.title || song.prompt}
                    </h4>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {song.status === "completed" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-primary"
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
                        className="h-6 w-6 text-muted-foreground"
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
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {song.createdAt && formatDistanceToNow(new Date(song.createdAt), { addSuffix: true })}
                    </span>
                    {song.status === "completed" && (
                      <div className="flex items-center text-primary gap-1">
                        <Play className="w-3 h-3 fill-current" />
                        Ready
                      </div>
                    )}
                    {song.status === "processing" && (
                      <div className="flex items-center text-yellow-500 gap-1 animate-pulse">
                        <Clock className="w-3 h-3" />
                        Processing
                      </div>
                    )}
                    {song.status === "failed" && (
                      <div className="flex items-center text-destructive gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Failed
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {currentSong && (
          <div className="w-full max-w-2xl px-4 pb-8 mx-auto">
            <AudioPlayer
              url={currentSong.audioUrl}
              title={currentSong.title || "Untitled Track"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
