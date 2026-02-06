import { useState } from "react";
import { useGenerateLyrics } from "@/hooks/use-lyrics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mic2, Copy } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export function LyricsGenerator() {
  const [theme, setTheme] = useState("");
  const [style, setStyle] = useState<"romantic" | "dance" | "heartbreak">("romantic");
  const [currentLyrics, setCurrentLyrics] = useState("");
  const { mutate: generate, isPending } = useGenerateLyrics();
  const { toast } = useToast();

  const handleGenerate = () => {
    if (!theme.trim()) return;
    generate({ theme, style }, {
      onSuccess: (data) => {
        setCurrentLyrics(data.content);
      }
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentLyrics);
    toast({ description: "Lyrics copied to clipboard" });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-panel rounded-2xl p-6 h-full flex flex-col"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-500/10 rounded-lg">
          <Mic2 className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-display">Smart Lyrics</h2>
          <p className="text-sm text-muted-foreground">GPT-4o Songwriter</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <Label>Theme / Mood</Label>
          <Input 
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Lost love..."
            className="bg-black/20 border-white/10"
          />
        </div>
        <div className="space-y-2">
          <Label>Style</Label>
          <Select value={style} onValueChange={(v: any) => setStyle(v)}>
            <SelectTrigger className="bg-black/20 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="romantic">Romantic</SelectItem>
              <SelectItem value="dance">Dance / Party</SelectItem>
              <SelectItem value="heartbreak">Heartbreak</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button 
        onClick={handleGenerate}
        disabled={isPending || !theme.trim()}
        className="w-full mb-6 bg-purple-600 hover:bg-purple-500 text-white"
      >
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Write Lyrics"}
      </Button>

      <div className="flex-1 relative min-h-0 bg-black/40 rounded-xl border border-white/5 overflow-hidden group">
        <ScrollArea className="h-full w-full p-4">
          {currentLyrics ? (
            <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
              {currentLyrics}
            </pre>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
              Generated lyrics will appear here...
            </div>
          )}
        </ScrollArea>
        
        {currentLyrics && (
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={copyToClipboard}
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
