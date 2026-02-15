import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useSongs } from "@/hooks/use-songs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  MicVocal, Layers, Music, MessageSquare, Shield, Volume2,
  Waves, Sparkles, FileText, Disc, Shuffle, Scissors, Clock,
  Loader2, ArrowLeft, Headphones,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type ToolId =
  | "voice-convert" | "extraction" | "cover" | "tts" | "denoise"
  | "de-echo" | "de-reverb" | "sound-generator" | "transcription"
  | "mastering" | "remix" | "trim" | "speed";

interface ToolDef {
  id: ToolId;
  titleKey: string;
  descKey: string;
  icon: typeof MicVocal;
  needsSong: boolean;
}

const TOOLS: ToolDef[] = [
  { id: "voice-convert", titleKey: "audioTools.voiceConversion", descKey: "audioTools.voiceConversionDesc", icon: MicVocal, needsSong: true },
  { id: "extraction", titleKey: "audioTools.extraction", descKey: "audioTools.extractionDesc", icon: Layers, needsSong: true },
  { id: "cover", titleKey: "audioTools.cover", descKey: "audioTools.coverDesc", icon: Music, needsSong: true },
  { id: "tts", titleKey: "audioTools.tts", descKey: "audioTools.ttsDesc", icon: MessageSquare, needsSong: false },
  { id: "denoise", titleKey: "audioTools.denoise", descKey: "audioTools.denoiseDesc", icon: Shield, needsSong: true },
  { id: "de-echo", titleKey: "audioTools.deEcho", descKey: "audioTools.deEchoDesc", icon: Volume2, needsSong: true },
  { id: "de-reverb", titleKey: "audioTools.deReverb", descKey: "audioTools.deReverbDesc", icon: Waves, needsSong: true },
  { id: "sound-generator", titleKey: "audioTools.soundGenerator", descKey: "audioTools.soundGeneratorDesc", icon: Sparkles, needsSong: false },
  { id: "transcription", titleKey: "audioTools.transcription", descKey: "audioTools.transcriptionDesc", icon: FileText, needsSong: true },
  { id: "mastering", titleKey: "audioTools.mastering", descKey: "audioTools.masteringDesc", icon: Disc, needsSong: true },
  { id: "remix", titleKey: "audioTools.remix", descKey: "audioTools.remixDesc", icon: Shuffle, needsSong: true },
  { id: "trim", titleKey: "audioTools.trim", descKey: "audioTools.trimDesc", icon: Scissors, needsSong: true },
  { id: "speed", titleKey: "audioTools.speed", descKey: "audioTools.speedDesc", icon: Clock, needsSong: true },
];

function SongSelector({
  songId,
  onChange,
  songs,
  isLoading,
  toolId,
}: {
  songId: number | null;
  onChange: (id: number | null) => void;
  songs: any[];
  isLoading: boolean;
  toolId: string;
}) {
  const selected = songs.find((s: any) => s.id === songId);

  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t('audioTools.loadingSongs')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">{t('audioTools.sourceSong')}</label>
      <select
        value={songId ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        data-testid={`select-song-${toolId}`}
      >
        <option value="">{t('audioTools.selectSong')}</option>
        {songs.map((s: any) => (
          <option key={s.id} value={s.id}>{s.title}</option>
        ))}
      </select>
      {selected && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm truncate">{selected.title}</span>
          {selected.genre && <Badge variant="secondary" className="text-[10px]">{selected.genre}</Badge>}
        </div>
      )}
    </div>
  );
}

function ToolPanel({
  tool,
  songs,
  songsLoading,
}: {
  tool: ToolDef;
  songs: any[];
  songsLoading: boolean;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [songId, setSongId] = useState<number | null>(null);
  const [voiceId, setVoiceId] = useState("");
  const [pitch, setPitch] = useState(0);
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("en");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [startTimeMs, setStartTimeMs] = useState("");
  const [endTimeMs, setEndTimeMs] = useState("");
  const [speed, setSpeed] = useState(1.0);
  const [transcriptionResult, setTranscriptionResult] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      let res: Response;
      switch (tool.id) {
        case "voice-convert":
          res = await apiRequest("POST", `/api/songs/${songId}/voice-convert`, { voiceId, pitch });
          break;
        case "extraction":
          res = await apiRequest("POST", `/api/songs/${songId}/stems`);
          break;
        case "cover":
          res = await apiRequest("POST", `/api/songs/${songId}/cover`, { voiceId, pitch });
          break;
        case "tts":
          res = await apiRequest("POST", `/api/audio/tts`, { text, voiceId: voiceId || undefined, language });
          break;
        case "denoise":
          res = await apiRequest("POST", `/api/songs/${songId}/denoise`);
          break;
        case "de-echo":
          res = await apiRequest("POST", `/api/songs/${songId}/de-echo`);
          break;
        case "de-reverb":
          res = await apiRequest("POST", `/api/songs/${songId}/de-reverb`);
          break;
        case "sound-generator":
          res = await apiRequest("POST", `/api/audio/sound-generator`, { prompt, duration });
          break;
        case "transcription":
          res = await apiRequest("POST", `/api/songs/${songId}/transcribe`, { language });
          break;
        case "mastering":
          res = await apiRequest("POST", `/api/songs/${songId}/master`);
          break;
        case "remix":
          res = await apiRequest("POST", `/api/songs/${songId}/remix`, { prompt });
          break;
        case "trim":
          res = await apiRequest("POST", `/api/songs/${songId}/trim`, {
            startTimeMs: Number(startTimeMs),
            endTimeMs: Number(endTimeMs),
          });
          break;
        case "speed":
          res = await apiRequest("POST", `/api/songs/${songId}/speed`, { speed, pitch });
          break;
        default:
          throw new Error("Unknown tool");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      if (tool.id === "transcription" && data?.text) {
        setTranscriptionResult(data.text);
      }
      const toolTitle = t(tool.titleKey);
      toast({
        title: t('audioTools.toolStarted', { tool: toolTitle }),
        description: t('audioTools.toolStartedDesc', { tool: toolTitle }),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('audioTools.toolFailed', { tool: t(tool.titleKey) }),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canProcess = () => {
    if (tool.needsSong && !songId) return false;
    if (tool.id === "voice-convert" && !voiceId) return false;
    if (tool.id === "cover" && !voiceId) return false;
    if (tool.id === "tts" && !text.trim()) return false;
    if (tool.id === "sound-generator" && !prompt.trim()) return false;
    if (tool.id === "remix" && !prompt.trim()) return false;
    if (tool.id === "trim" && (!startTimeMs || !endTimeMs)) return false;
    return true;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-5"
    >
      {tool.needsSong && (
        <SongSelector
          songId={songId}
          onChange={setSongId}
          songs={songs}
          isLoading={songsLoading}
          toolId={tool.id}
        />
      )}

      {(tool.id === "voice-convert" || tool.id === "cover") && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{t('audioTools.voiceIdLabel')}</label>
            <Input
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder={t('audioTools.voiceIdPlaceholder')}
              className="bg-black/30 border-white/10"
              data-testid={`input-${tool.id}-voiceId`}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{t('audioTools.pitchLabel')}: {pitch}</label>
            <Slider
              value={[pitch]}
              min={-12}
              max={12}
              step={1}
              onValueChange={(v) => setPitch(v[0])}
              data-testid={`input-${tool.id}-pitch`}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>-12</span>
              <span>0</span>
              <span>+12</span>
            </div>
          </div>
        </>
      )}

      {tool.id === "tts" && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{t('audioTools.textLabel')}</label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('audioTools.textPlaceholder')}
              className="bg-black/30 border-white/10 min-h-[100px]"
              data-testid={`input-${tool.id}-text`}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{t('audioTools.voiceIdOptional')}</label>
            <Input
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder={t('audioTools.voiceIdOptionalPlaceholder')}
              className="bg-black/30 border-white/10"
              data-testid={`input-${tool.id}-voiceId`}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{t('audioTools.languageLabel')}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              data-testid={`input-${tool.id}-language`}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="pt">Portuguese</option>
              <option value="it">Italian</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="zh">Chinese</option>
            </select>
          </div>
        </>
      )}

      {tool.id === "sound-generator" && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{t('audioTools.promptLabel')}</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('audioTools.promptPlaceholder')}
              className="bg-black/30 border-white/10 min-h-[80px]"
              data-testid={`input-${tool.id}-prompt`}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{t('audioTools.durationLabel')}: {duration}s</label>
            <Slider
              value={[duration]}
              min={1}
              max={30}
              step={1}
              onValueChange={(v) => setDuration(v[0])}
              data-testid={`input-${tool.id}-duration`}
            />
          </div>
        </>
      )}

      {tool.id === "transcription" && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">{t('audioTools.languageOptional')}</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            data-testid={`input-${tool.id}-language`}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="pt">Portuguese</option>
            <option value="auto">{t('audioTools.autoDetect')}</option>
          </select>
        </div>
      )}

      {tool.id === "remix" && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">{t('audioTools.remixPromptLabel')}</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('audioTools.remixPromptPlaceholder')}
            className="bg-black/30 border-white/10 min-h-[80px]"
            data-testid={`input-${tool.id}-prompt`}
          />
        </div>
      )}

      {tool.id === "trim" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{t('audioTools.startMs')}</label>
            <Input
              type="number"
              value={startTimeMs}
              onChange={(e) => setStartTimeMs(e.target.value)}
              placeholder="0"
              className="bg-black/30 border-white/10"
              data-testid={`input-${tool.id}-startTimeMs`}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{t('audioTools.endMs')}</label>
            <Input
              type="number"
              value={endTimeMs}
              onChange={(e) => setEndTimeMs(e.target.value)}
              placeholder="30000"
              className="bg-black/30 border-white/10"
              data-testid={`input-${tool.id}-endTimeMs`}
            />
          </div>
        </div>
      )}

      {tool.id === "speed" && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{t('audioTools.speedLabel')}: {speed.toFixed(2)}x</label>
            <Slider
              value={[speed]}
              min={0.25}
              max={4.0}
              step={0.05}
              onValueChange={(v) => setSpeed(v[0])}
              data-testid={`input-${tool.id}-speed`}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0.25x</span>
              <span>1.0x</span>
              <span>4.0x</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{t('audioTools.pitchAdjust')}: {pitch}</label>
            <Slider
              value={[pitch]}
              min={-12}
              max={12}
              step={1}
              onValueChange={(v) => setPitch(v[0])}
              data-testid={`input-${tool.id}-pitch`}
            />
          </div>
        </>
      )}

      <Button
        onClick={() => mutation.mutate()}
        disabled={!canProcess() || mutation.isPending}
        className="w-full gap-2"
        data-testid={`button-process-${tool.id}`}
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('common.processing')}
          </>
        ) : (
          <>
            <tool.icon className="w-4 h-4" />
            {t('audioTools.processButton', { tool: t(tool.titleKey) })}
          </>
        )}
      </Button>

      {transcriptionResult && tool.id === "transcription" && (
        <Card className="p-4 bg-white/[0.03] border-white/5">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t('audioTools.transcriptionResult')}</p>
          <p className="text-sm whitespace-pre-wrap" data-testid="text-transcription-result">{transcriptionResult}</p>
        </Card>
      )}
    </motion.div>
  );
}

export default function AudioToolsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { data: songs, isLoading: songsLoading } = useSongs();
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  const completedSongs = songs?.filter((s: any) => s.status === "completed" && s.audioUrl) ?? [];
  const activeToolDef = TOOLS.find((td) => td.id === activeTool);

  if (!user) return null;

  return (
    <div className="h-full bg-background text-foreground flex flex-col font-sans overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Headphones className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold" data-testid="text-audiotools-title">{t('audioTools.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('audioTools.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <AnimatePresence mode="wait">
          {activeTool && activeToolDef ? (
            <motion.div
              key="detail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto"
            >
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 mb-4"
                onClick={() => setActiveTool(null)}
                data-testid="button-back-to-tools"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('audioTools.backToTools')}
              </Button>

              <Card className="p-5 md:p-6 bg-white/[0.03] border-white/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <activeToolDef.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{t(activeToolDef.titleKey)}</h2>
                    <p className="text-xs text-muted-foreground">{t(activeToolDef.descKey)}</p>
                  </div>
                </div>

                <ToolPanel
                  tool={activeToolDef}
                  songs={completedSongs}
                  songsLoading={songsLoading}
                />
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
            >
              {TOOLS.map((tool) => (
                <Card
                  key={tool.id}
                  className={cn(
                    "p-4 cursor-pointer transition-all duration-200 border bg-white/[0.03] border-white/5 hover-elevate",
                    activeTool === tool.id && "bg-primary/10 border-primary/50"
                  )}
                  onClick={() => setActiveTool(tool.id)}
                  data-testid={`tool-card-${tool.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <tool.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold mb-0.5">{t(tool.titleKey)}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{t(tool.descKey)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
