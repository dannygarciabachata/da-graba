import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGenerateLyrics } from "@/hooks/use-lyrics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mic2, Copy, Sparkles, Lightbulb, ChevronRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const STYLE_OPTIONS = [
  { value: "romantic", label: "Romantic", genre: "Bachata", genreLabel: "DAGRABACHATA" },
  { value: "dance", label: "Dance / Party", genre: "Reggaeton", genreLabel: "Reggaeton" },
  { value: "heartbreak", label: "Heartbreak", genre: "Bolero", genreLabel: "DAGRABOLERO" },
  { value: "empowerment", label: "Empowerment", genre: "Pop", genreLabel: "Pop" },
  { value: "storytelling", label: "Storytelling", genre: "R&B", genreLabel: "R&B" },
  { value: "celebration", label: "Celebration", genre: "Latin Pop", genreLabel: "Latin Pop" },
  { value: "seduction", label: "Seduction", genre: "Bachata", genreLabel: "DAGRABACHATA" },
  { value: "nostalgia", label: "Nostalgia", genre: "Bolero", genreLabel: "DAGRABOLERO" },
];

export function LyricsGenerator() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("romantic");
  const [currentLyrics, setCurrentLyrics] = useState("");
  const [suggestedTitles, setSuggestedTitles] = useState<string[]>([]);
  const [selectedTitle, setSelectedTitle] = useState("");
  const { mutate: generate, isPending } = useGenerateLyrics();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const suggestTitlesMutation = useMutation({
    mutationFn: async (data: { lyrics: string; genre: string; description: string }) => {
      const res = await apiRequest("POST", "/api/ai/suggest-titles", data);
      return res.json();
    },
    onSuccess: (data) => {
      setSuggestedTitles(data.titles || []);
      toast({ description: "Title suggestions ready!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not generate title suggestions", variant: "destructive" });
    },
  });

  const handleGenerate = () => {
    if (!theme.trim() && !description.trim()) return;
    const fullTheme = description.trim()
      ? `${theme.trim()}. ${description.trim()}`
      : theme.trim();
    generate({ theme: fullTheme, style } as any, {
      onSuccess: (data) => {
        setCurrentLyrics(data.content);
        setSuggestedTitles([]);
        setSelectedTitle("");
      },
    });
  };

  const handleSuggestTitles = () => {
    if (!currentLyrics) return;
    const matchedStyle = STYLE_OPTIONS.find((s) => s.value === style);
    suggestTitlesMutation.mutate({
      lyrics: currentLyrics,
      genre: matchedStyle?.genre || "Bachata",
      description: description || theme,
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentLyrics);
    toast({ description: "Lyrics copied to clipboard" });
  };

  const handleCreateSong = () => {
    const matchedStyle = STYLE_OPTIONS.find((s) => s.value === style);
    const genre = matchedStyle?.genre || "Bachata";
    const finalTitle =
      selectedTitle ||
      theme
        .trim()
        .split(/\s+/)
        .slice(0, 5)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");

    const params = new URLSearchParams({
      lyrics: currentLyrics,
      title: finalTitle,
      genre,
    });
    setLocation(`/create?${params.toString()}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-panel rounded-2xl p-6 h-full flex flex-col"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Mic2 className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-display">{t('lyricsGenerator.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('lyricsGenerator.subtitle')}</p>
        </div>
      </div>

      <div className="space-y-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>{t('lyricsGenerator.theme')}</Label>
            <Input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder={t('lyricsGenerator.themePlaceholder')}
              className="bg-black/20 border-white/10"
              data-testid="input-lyrics-theme"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('lyricsGenerator.style')}</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="bg-black/20 border-white/10" data-testid="select-lyrics-style">
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
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-yellow-400" />
            {t('lyricsGenerator.detailedDescription')}
          </Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('lyricsGenerator.descriptionPlaceholder')}
            className="bg-black/20 border-white/10 min-h-[80px] resize-none text-sm"
            data-testid="input-lyrics-description"
          />
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={isPending || (!theme.trim() && !description.trim())}
        className="w-full mb-4 bg-blue-600 hover:bg-blue-500 text-white"
        data-testid="button-generate-lyrics"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('lyricsGenerator.generating')}
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            {t('lyricsGenerator.generate')}
          </>
        )}
      </Button>

      <div className="flex-1 relative min-h-0 bg-black/40 rounded-xl border border-white/5 overflow-hidden group">
        <ScrollArea className="h-full w-full p-4">
          {currentLyrics ? (
            <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-foreground/90" data-testid="text-lyrics-output">
              {currentLyrics}
            </pre>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
              {t('lyricsGenerator.lyricsPlaceholder')}
            </div>
          )}
        </ScrollArea>

        {currentLyrics && (
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              onClick={copyToClipboard}
              data-testid="button-copy-lyrics"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {currentLyrics && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSuggestTitles}
                disabled={suggestTitlesMutation.isPending}
                className="gap-1.5 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                data-testid="button-suggest-titles"
              >
                {suggestTitlesMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Lightbulb className="h-3 w-3" />
                )}
                {t('lyricsGenerator.suggestTitles')}
              </Button>
              {selectedTitle && (
                <Badge className="bg-primary/15 text-primary border-primary/30 text-xs gap-1">
                  <Check className="h-3 w-3" />
                  {selectedTitle}
                </Badge>
              )}
            </div>

            {suggestedTitles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap gap-2"
              >
                {suggestedTitles.map((title, i) => (
                  <Badge
                    key={i}
                    variant={selectedTitle === title ? "default" : "outline"}
                    className={`cursor-pointer text-xs py-1 px-2.5 transition-all ${
                      selectedTitle === title
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "border-white/10 hover:border-primary/30"
                    }`}
                    onClick={() => setSelectedTitle(title)}
                    data-testid={`badge-title-suggestion-${i}`}
                  >
                    {title}
                  </Badge>
                ))}
              </motion.div>
            )}

            <Button
              onClick={handleCreateSong}
              className="w-full bg-primary text-black font-semibold gap-2"
              data-testid="button-create-song-from-lyrics"
            >
              <Sparkles className="h-4 w-4" />
              {t('lyricsGenerator.use')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
