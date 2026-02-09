import { useState } from "react";
import { useGenerateSong } from "@/hooks/use-songs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Heart, Music } from "lucide-react";
import { motion } from "framer-motion";

const STYLE_OPTIONS = [
  { value: "heart-mula", label: "Heart Mula Signature" },
  { value: "bachata-romantic", label: "Romantic Bachata" },
  { value: "bachata-dance", label: "Dance Bachata" },
  { value: "bachata-bolero", label: "Bachata Bolero" },
  { value: "trio-serenade", label: "Trio Serenade" },
  { value: "bachata-urbana", label: "Bachata Urbana" },
];

export function MusicGenerator() {
  const [prompt, setPrompt] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [isBachata, setIsBachata] = useState(true);
  const [style, setStyle] = useState("heart-mula");
  const [showLyrics, setShowLyrics] = useState(false);
  const { mutate: generate, isPending } = useGenerateSong();

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    generate({
      prompt,
      isBachata,
      style,
      ...(showLyrics && lyrics.trim() ? { lyrics: lyrics.trim() } : {}),
    });
    setPrompt("");
    setLyrics("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl p-6 h-full flex flex-col"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg relative">
          <Heart className="w-6 h-6 text-primary" />
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-display" data-testid="text-engine-title">Heart Mula</h2>
          <p className="text-sm text-muted-foreground">DGB Studio Music Engine</p>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="prompt" className="text-sm font-medium text-foreground/80">
            Describe your track
          </Label>
          <Textarea
            id="prompt"
            placeholder="A romantic melody under Caribbean moonlight, requinto crying softly..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="bg-black/20 border-border focus:border-primary/50 focus:ring-primary/20 min-h-[100px] resize-none text-base"
            data-testid="input-music-prompt"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-foreground/80">Custom Lyrics</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLyrics(!showLyrics)}
              className="text-xs text-muted-foreground"
              data-testid="button-toggle-lyrics"
            >
              <Music className="w-3 h-3 mr-1" />
              {showLyrics ? "Hide" : "Add Lyrics"}
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
                className="bg-black/20 border-border focus:border-primary/50 focus:ring-primary/20 min-h-[120px] resize-none text-sm font-mono"
                data-testid="input-music-lyrics"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty for auto-generated Bachata lyrics
              </p>
            </motion.div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground/80">Style Preset</Label>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger className="bg-black/20 border-white/10" data-testid="select-music-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STYLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} data-testid={`option-style-${opt.value}`}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
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
      </div>

      <div className="mt-6">
        <Button
          onClick={handleGenerate}
          disabled={isPending || !prompt.trim()}
          className="w-full text-base font-semibold bg-primary text-black shadow-lg shadow-primary/25"
          data-testid="button-generate-music"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Composing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Generate Rhythm
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
