import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGenerateSong } from "@/hooks/use-songs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Wand2, Music, Clock, Palette, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const GENRES = [
  { value: "Bachata", label: "DA GRABACHATA" },
  { value: "Bolero", label: "DA GRABOLERO" },
  { value: "Salsa", label: "Salsa" },
  { value: "Merengue", label: "Merengue" },
  { value: "Cumbia", label: "Cumbia" },
  { value: "Reggaeton", label: "Reggaeton" },
  { value: "Latin Pop", label: "Latin Pop" },
  { value: "Son", label: "Son" },
  { value: "R&B", label: "R&B" },
  { value: "Hip Hop", label: "Hip Hop" },
  { value: "EDM", label: "EDM" },
  { value: "Jazz", label: "Jazz" },
  { value: "Pop", label: "Pop" },
  { value: "Rock", label: "Rock" },
];

const MOODS = [
  { key: "upbeat", label: "Animado" },
  { key: "chill", label: "Relajado" },
  { key: "dark", label: "Oscuro" },
  { key: "energetic", label: "Energético" },
  { key: "melancholic", label: "Melancólico" },
  { key: "dreamy", label: "Soñador" },
];

export function CreatePanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const generateSong = useGenerateSong();
  const [prompt, setPrompt] = useState("");
  const [genre, setGenre] = useState("Bachata");
  const [mood, setMood] = useState("upbeat");
  const [duration, setDuration] = useState([180]);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    const moodText = MOODS.find(m => m.key === mood)?.label || mood;
    const enrichedPrompt = `${prompt} (${moodText})`;

    generateSong.mutate(
      {
        prompt: enrichedPrompt,
        genre,
        duration: duration[0],
      },
      {
        onSuccess: () => {
          toast({ title: "Generando tu música...", description: "Tu canción se está creando." });
          setPrompt("");
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message || "Error al generar música", variant: "destructive" });
        },
      }
    );
  };

  const isGenerating = generateSong.isPending;
  const durationMinutes = Math.floor(duration[0] / 60);
  const durationSeconds = duration[0] % 60;

  return (
    <div className="relative" data-testid="create-panel">
      <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-indigo-600 rounded-2xl blur-xl opacity-20" />

      <div className="relative bg-gradient-to-br from-slate-900/90 to-indigo-900/30 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <Wand2 className="w-5 h-5 text-orange-400" />
          <h2 className="text-xl font-semibold text-white" data-testid="text-create-title">Crea tu Sonido</h2>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium text-orange-300 flex items-center gap-2">
              <Music className="w-4 h-4" />
              {t("create.describeMusic", "Describe tu música")}
            </label>
            <div className="relative">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Una pista de bachata soñadora con requinto melódico, bongó suave y guitarra segunda..."
                className="min-h-[120px] bg-black/40 border-orange-500/30 text-white placeholder:text-orange-300/40 focus:border-orange-500/60 focus:ring-orange-500/20 rounded-xl resize-none"
                maxLength={500}
                data-testid="input-prompt"
              />
              <div className="absolute bottom-3 right-3 text-xs text-orange-300/40">
                {prompt.length}/500
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-orange-300 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              {t("create.genre", "Género")}
            </label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="bg-black/40 border-orange-500/30 text-white focus:border-orange-500/60 focus:ring-orange-500/20 rounded-xl" data-testid="select-genre">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-orange-500/30">
                {GENRES.map((g) => (
                  <SelectItem key={g.value} value={g.value} data-testid={`genre-option-${g.value}`}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-orange-300">
              {t("create.mood", "Estado de Ánimo")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMood(m.key)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    mood === m.key
                      ? "bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-500/30"
                      : "bg-black/40 text-orange-300 border border-orange-500/30 hover:border-orange-500/60"
                  }`}
                  data-testid={`mood-${m.key}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-orange-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t("create.duration", "Duración")}
              </span>
              <span className="text-orange-400" data-testid="text-duration">
                {durationMinutes}:{durationSeconds.toString().padStart(2, "0")}
              </span>
            </label>
            <Slider
              value={duration}
              onValueChange={setDuration}
              min={30}
              max={300}
              step={10}
              className="py-4"
              data-testid="slider-duration"
            />
            <div className="flex justify-between gap-2 text-xs text-orange-300/60 flex-wrap">
              <span>0:30</span>
              <span>5:00</span>
            </div>
          </div>

          <motion.button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-2xl hover:shadow-orange-500/50 transition-all relative overflow-hidden group"
            data-testid="button-generate"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Generando tu obra maestra...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Wand2 className="w-5 h-5" />
                Generar Música
              </span>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
