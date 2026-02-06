import { useState } from "react";
import { useGenerateSong } from "@/hooks/use-songs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Music2 } from "lucide-react";
import { motion } from "framer-motion";

export function MusicGenerator() {
  const [prompt, setPrompt] = useState("");
  const [isBachata, setIsBachata] = useState(true);
  const { mutate: generate, isPending } = useGenerateSong();

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    generate({ prompt, isBachata });
    setPrompt(""); // Clear input after submit
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl p-6 h-full flex flex-col"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Music2 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-display">DGB Engine</h2>
          <p className="text-sm text-muted-foreground">AI Music Generation</p>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div className="space-y-3">
          <Label htmlFor="prompt" className="text-sm font-medium text-foreground/80">
            Describe your track
          </Label>
          <Textarea
            id="prompt"
            placeholder="A romantic melody with smooth guitar riffs..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="bg-black/20 border-border focus:border-primary/50 focus:ring-primary/20 min-h-[120px] resize-none text-base"
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Bachata Mode</Label>
            <p className="text-xs text-muted-foreground">Force Dominican style instruments</p>
          </div>
          <Switch
            checked={isBachata}
            onCheckedChange={setIsBachata}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>

      <div className="mt-8">
        <Button
          onClick={handleGenerate}
          disabled={isPending || !prompt.trim()}
          className="w-full h-12 text-base font-semibold bg-primary text-black hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
