import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGenerateSong } from "@/hooks/use-songs";
import { useCredits } from "@/hooks/use-credits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Heart, Music, Layers, Sliders, Zap, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

const STYLE_OPTIONS = [
  { value: "heart-mula", labelKey: "common.engineSignature" },
  { value: "bachata-romantic", label: "Romantic DAGRABACHATA" },
  { value: "bachata-dance", label: "Dance DAGRABACHATA" },
  { value: "bachata-bolero", label: "DAGRABACHATA DAGRABOLERO" },
  { value: "trio-serenade", label: "Trio Serenade" },
  { value: "bachata-urbana", label: "DAGRABACHATA Urbana" },
];

const GENRE_OPTIONS = [
  { value: "Bachata", label: "DAGRABACHATA" },
  { value: "Merengue", label: "Merengue" },
  { value: "Salsa", label: "Salsa" },
  { value: "Reggaeton", label: "Reggaeton" },
  { value: "Bolero", label: "DAGRABOLERO" },
  { value: "Cumbia", label: "Cumbia" },
  { value: "Latin Pop", label: "Latin Pop" },
  { value: "R&B Latino", label: "R&B Latino" },
  { value: "Dembow", label: "Dembow" },
  { value: "Tropical", label: "Tropical" },
];

type GeneratorMode = "standard" | "aggregate";

export function MusicGenerator() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<GeneratorMode>("aggregate");
  const [, setLocation] = useLocation();

  const [prompt, setPrompt] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [isBachata, setIsBachata] = useState(true);
  const [style, setStyle] = useState("heart-mula");
  const [showLyrics, setShowLyrics] = useState(false);

  const [aggTitle, setAggTitle] = useState("");
  const [aggGenre, setAggGenre] = useState("Bachata");
  const [aggStyle, setAggStyle] = useState("heart-mula");

  const { mutate: generate, isPending } = useGenerateSong();
  const { data: creditsData } = useCredits();
  const noCredits = creditsData && !creditsData.isUnlimited && creditsData.credits <= 0;

  const handleStandardGenerate = () => {
    if (!prompt.trim()) return;
    generate({
      prompt,
      isBachata,
      style,
      mode: "standard",
      ...(showLyrics && lyrics.trim() ? { lyrics: lyrics.trim() } : {}),
    });
    setPrompt("");
    setLyrics("");
  };

  const handleAggregateGenerate = () => {
    if (!aggTitle.trim()) return;
    generate({
      prompt: aggTitle,
      title: aggTitle,
      genre: aggGenre,
      style: aggStyle,
      mode: "aggregate",
      isBachata: true,
    });
    setAggTitle("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl p-4 md:p-6 h-full flex flex-col"
    >
      <div className="flex items-center gap-3 mb-4 md:mb-5">
        <div className="p-2 bg-primary/10 rounded-lg relative">
          <Heart className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg md:text-xl font-bold font-display" data-testid="text-engine-title">{t('common.brandName')}</h2>
          <p className="text-xs md:text-sm text-muted-foreground">{t('common.musicEngine')}</p>
        </div>
        {creditsData && (
          <Badge
            className={`shrink-0 cursor-pointer ${noCredits ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-primary/10 text-primary border-primary/20'}`}
            onClick={() => setLocation("/pricing")}
            data-testid="badge-credits-generator"
          >
            <Zap className="h-3 w-3 mr-1" />
            {creditsData.isUnlimited ? "Unlimited" : `${creditsData.credits} credits`}
          </Badge>
        )}
      </div>
      {noCredits && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2" data-testid="alert-no-credits">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-400 font-medium">{t('musicGenerator.noCreditsTitle')}</p>
            <p className="text-[10px] text-red-400/70">{t('musicGenerator.noCreditsSubtitle')}</p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 text-xs border-red-500/30 text-red-400" onClick={() => setLocation("/pricing")} data-testid="button-upgrade-from-generator">
            {t('common.upgrade')}
          </Button>
        </div>
      )}

      <div className="flex gap-1 mb-4 bg-white/5 rounded-lg p-1">
        <Button
          variant={mode === "aggregate" ? "default" : "ghost"}
          size="sm"
          className="flex-1 gap-1.5 text-xs"
          onClick={() => setMode("aggregate")}
          data-testid="button-mode-aggregate"
        >
          <Layers className="h-3.5 w-3.5" />
          {t('musicGenerator.modes.aggregate')}
        </Button>
        <Button
          variant={mode === "standard" ? "default" : "ghost"}
          size="sm"
          className="flex-1 gap-1.5 text-xs"
          onClick={() => setMode("standard")}
          data-testid="button-mode-standard"
        >
          <Sliders className="h-3.5 w-3.5" />
          {t('musicGenerator.modes.standard')}
        </Button>
      </div>

      {mode === "aggregate" ? (
        <div className="flex-1 space-y-3 md:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agg-title" className="text-sm font-medium text-foreground/80">
              {t('musicGenerator.songTitle')}
            </Label>
            <Input
              id="agg-title"
              placeholder="Mi Corazón Latiendo..."
              value={aggTitle}
              onChange={(e) => setAggTitle(e.target.value)}
              className="bg-black/20 border-border focus:border-primary/50 focus:ring-primary/20 text-base"
              data-testid="input-aggregate-title"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground/80">{t('musicGenerator.genre')}</Label>
            <Select value={aggGenre} onValueChange={setAggGenre}>
              <SelectTrigger className="bg-black/20 border-white/10" data-testid="select-aggregate-genre">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENRE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} data-testid={`option-genre-${opt.value}`}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground/80">{t('musicGenerator.musicStyle')}</Label>
            <Select value={aggStyle} onValueChange={setAggStyle}>
              <SelectTrigger className="bg-black/20 border-white/10" data-testid="select-aggregate-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} data-testid={`option-agg-style-${opt.value}`}>
                    {'labelKey' in opt ? t(opt.labelKey as string) : opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 md:mt-6">
            <Button
              onClick={handleAggregateGenerate}
              disabled={isPending || !aggTitle.trim() || !!noCredits}
              className="w-full text-base font-semibold bg-primary text-black shadow-lg shadow-primary/25"
              data-testid="button-generate-aggregate"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t('musicGenerator.composing')}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  {t('musicGenerator.generateSong')}
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-3 md:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt" className="text-sm font-medium text-foreground/80">
              {t('musicGenerator.describeTrack')}
            </Label>
            <Textarea
              id="prompt"
              placeholder="A romantic melody under Caribbean moonlight, requinto crying softly..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="bg-black/20 border-border focus:border-primary/50 focus:ring-primary/20 min-h-[80px] md:min-h-[100px] resize-none text-base"
              data-testid="input-music-prompt"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <Label className="text-sm font-medium text-foreground/80">{t('musicGenerator.customLyrics')}</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLyrics(!showLyrics)}
                className="text-xs text-muted-foreground"
                data-testid="button-toggle-lyrics"
              >
                <Music className="w-3 h-3 mr-1" />
                {showLyrics ? t('musicGenerator.hideLyrics') : t('musicGenerator.addLyrics')}
              </Button>
            </div>
            {showLyrics && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Textarea
                  placeholder={"[Verse]\nBajo la luna de Santo Domingo\nTu mirada me tiene cautivo...\n\n[Chorus]\nBailamos bachata toda la noche..."}
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  className="bg-black/20 border-border focus:border-primary/50 focus:ring-primary/20 min-h-[100px] md:min-h-[120px] resize-none text-sm font-mono"
                  data-testid="input-music-lyrics"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for auto-generated DAGRABACHATA lyrics
                </p>
              </motion.div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground/80">{t('musicGenerator.stylePreset')}</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="bg-black/20 border-white/10" data-testid="select-music-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} data-testid={`option-style-${opt.value}`}>
                    {'labelKey' in opt ? t(opt.labelKey as string) : opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t('musicGenerator.bachataMode')}</Label>
              <p className="text-xs text-muted-foreground">{t('musicGenerator.forceDominican')}</p>
            </div>
            <Switch
              checked={isBachata}
              onCheckedChange={setIsBachata}
              className="data-[state=checked]:bg-primary"
              data-testid="switch-bachata-mode"
            />
          </div>

          <div className="mt-4 md:mt-6">
            <Button
              onClick={handleStandardGenerate}
              disabled={isPending || !prompt.trim() || !!noCredits}
              className="w-full text-base font-semibold bg-primary text-black shadow-lg shadow-primary/25"
              data-testid="button-generate-music"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t('musicGenerator.composing')}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  {t('musicGenerator.generateButton')}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
