import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSamples, useUploadSample, useRecordSample, useTransformSample, useDeleteSample, useDetectKeyBPM } from "@/hooks/use-samples";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Mic, MicOff, Upload, Play, Pause, Square, Trash2,
  Wand2, Loader2, Music, FileAudio, Clock, ChevronRight, Volume2,
  SkipBack, SkipForward, Repeat
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import type { Sample } from "@shared/schema";

const STYLE_OPTIONS = [
  { value: "heart-mula", label: "DGB Studio Signature" },
  { value: "bachata-romantic", label: "Romantic" },
  { value: "bachata-dance", label: "Dance" },
  { value: "bachata-bolero", label: "Bolero" },
  { value: "bachata-urbana", label: "Urbana" },
  { value: "trio-serenade", label: "Serenade" },
];

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AudioRecorder({ onSave }: { onSave: (audioData: string, duration: number) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close();
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            onSave(reader.result as string, elapsed);
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      setIsRecording(true);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);

      const updateLevel = () => {
        if (analyserRef.current) {
          const data = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setAudioLevel(avg / 255);
        }
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  }, [onSave, elapsed]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <motion.div
          className={cn(
            "w-24 h-24 rounded-full flex items-center justify-center transition-colors cursor-pointer",
            isRecording
              ? "bg-red-500/20 border-2 border-red-500"
              : "bg-primary/10 border-2 border-primary/30"
          )}
          animate={isRecording ? { scale: [1, 1.05 + audioLevel * 0.1, 1] } : {}}
          transition={{ repeat: Infinity, duration: 0.5 }}
          onClick={isRecording ? stopRecording : startRecording}
          data-testid="button-record-toggle"
        >
          {isRecording ? (
            <Square className="h-8 w-8 text-red-500" />
          ) : (
            <Mic className="h-8 w-8 text-primary" />
          )}
        </motion.div>
        {isRecording && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
            <span className="text-xs font-mono text-red-400 bg-black/60 px-2 py-0.5 rounded-full">
              {formatDuration(elapsed)}
            </span>
          </div>
        )}
      </div>
      {isRecording && (
        <div className="flex gap-0.5 items-end h-8">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-1 bg-red-500 rounded-full"
              animate={{ height: Math.max(4, audioLevel * 32 * Math.random()) }}
              transition={{ duration: 0.1 }}
            />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {isRecording ? "Recording... tap to stop" : "Tap to start recording"}
      </p>
    </div>
  );
}

function TransportControls({
  isPlaying,
  bpm,
  onPlayPause,
  onStop,
  onBpmChange,
}: {
  isPlaying: boolean;
  bpm: number;
  onPlayPause: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-black/30 border border-white/5 rounded-xl px-4 py-2">
      <Button size="icon" variant="ghost" onClick={onStop} data-testid="button-transport-stop">
        <Square className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" data-testid="button-transport-skipback">
        <SkipBack className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant={isPlaying ? "default" : "ghost"}
        onClick={onPlayPause}
        data-testid="button-transport-play"
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button size="icon" variant="ghost" data-testid="button-transport-skipfwd">
        <SkipForward className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" data-testid="button-transport-loop">
        <Repeat className="h-4 w-4" />
      </Button>
      <div className="h-6 w-px bg-white/10" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">BPM</span>
        <Input
          type="number"
          value={bpm}
          onChange={(e) => onBpmChange(Number(e.target.value) || 120)}
          className="w-16 h-7 text-xs text-center bg-black/30 border-white/10"
          min={40}
          max={240}
          data-testid="input-bpm"
        />
      </div>
    </div>
  );
}

function SampleCard({
  sample,
  isSelected,
  onSelect,
  onDelete,
  onPlay,
  playingSampleId,
}: {
  sample: Sample;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onPlay: () => void;
  playingSampleId: number | null;
}) {
  const isPlaying = playingSampleId === sample.id;
  const isProcessing = sample.status === "processing";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "group relative p-3 rounded-xl border cursor-pointer transition-all",
        isSelected
          ? "bg-primary/10 border-primary/30"
          : "bg-white/[0.02] border-white/5 hover-elevate"
      )}
      onClick={onSelect}
      data-testid={`card-sample-${sample.id}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
            sample.sourceType === "recording" ? "bg-red-500/10" :
            sample.sourceType === "ai-transform" ? "bg-purple-500/10" :
            "bg-primary/10"
          )}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : sample.sourceType === "recording" ? (
            <Mic className="h-4 w-4 text-red-400" />
          ) : sample.sourceType === "ai-transform" ? (
            <Wand2 className="h-4 w-4 text-purple-400" />
          ) : (
            <FileAudio className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" data-testid={`text-sample-name-${sample.id}`}>
            {sample.name}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="capitalize">{sample.sourceType?.replace("-", " ") || "upload"}</span>
            {sample.duration && (
              <>
                <span className="opacity-30">|</span>
                <Clock className="h-3 w-3" />
                <span>{formatDuration(sample.duration)}</span>
              </>
            )}
            {sample.bpm && (
              <>
                <span className="opacity-30">|</span>
                <span>{sample.bpm} BPM</span>
              </>
            )}
            {sample.key && (
              <>
                <span className="opacity-30">|</span>
                <span>Key: {sample.key}</span>
              </>
            )}
            {sample.status === "failed" && (
              <span className="text-red-400 text-[10px]">Failed</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {sample.audioUrl && sample.status === "ready" && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
              data-testid={`button-play-sample-${sample.id}`}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground invisible group-hover:visible"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            data-testid={`button-delete-sample-${sample.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function ClipTimeline({ samples, selectedId }: { samples: Sample[]; selectedId: number | null }) {
  const readySamples = samples.filter((s) => s.audioUrl && s.status === "ready");
  const totalDuration = 30;
  const pixelsPerSecond = 40;

  return (
    <div className="bg-black/20 border border-white/5 rounded-xl p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Clip Timeline</h4>
        <span className="text-xs text-muted-foreground font-mono">{totalDuration}s</span>
      </div>

      <div className="relative overflow-x-auto">
        <div
          className="relative h-auto min-h-[120px]"
          style={{ width: `${totalDuration * pixelsPerSecond}px` }}
        >
          <div className="absolute top-0 left-0 right-0 flex border-b border-white/5 pb-1 mb-2">
            {Array.from({ length: totalDuration + 1 }).map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 text-[10px] text-muted-foreground/50 font-mono"
                style={{ width: `${pixelsPerSecond}px` }}
              >
                {i}s
              </div>
            ))}
          </div>

          <div className="pt-6 space-y-2">
            {readySamples.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/50">
                Record or upload samples to see them here
              </div>
            ) : (
              readySamples.map((sample, idx) => {
                const dur = sample.duration || 5;
                const pos = (sample.position || 0);
                const width = dur * pixelsPerSecond;
                const left = pos * pixelsPerSecond;
                const colors = ["bg-primary/20 border-primary/30", "bg-purple-500/20 border-purple-500/30", "bg-red-500/20 border-red-500/30", "bg-emerald-500/20 border-emerald-500/30"];
                return (
                  <div
                    key={sample.id}
                    className={cn(
                      "relative h-10 rounded-md border flex items-center px-2 cursor-pointer transition-all",
                      colors[idx % colors.length],
                      selectedId === sample.id && "ring-1 ring-primary"
                    )}
                    style={{ width: `${Math.max(width, 60)}px`, marginLeft: `${left}px` }}
                    data-testid={`clip-sample-${sample.id}`}
                  >
                    <span className="text-[10px] font-medium truncate">{sample.name}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SampleLab() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { data: samples = [], isLoading } = useSamples();
  const uploadMutation = useUploadSample();
  const recordMutation = useRecordSample();
  const transformMutation = useTransformSample();
  const deleteMutation = useDeleteSample();
  const detectKeyBPMMutation = useDetectKeyBPM();

  const [selectedSampleId, setSelectedSampleId] = useState<number | null>(null);
  const [playingSampleId, setPlayingSampleId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"record" | "upload" | "transform">("record");
  const [transformPrompt, setTransformPrompt] = useState("");
  const [transformStyle, setTransformStyle] = useState("heart-mula");
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingName, setRecordingName] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedSample = samples.find((s) => s.id === selectedSampleId) || null;

  if (!user) return null;

  const handleRecordSave = (audioData: string, duration: number) => {
    recordMutation.mutate({
      audioData,
      name: recordingName || `Recording ${new Date().toLocaleTimeString()}`,
      duration,
    });
    setRecordingName("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("audio", file);
    formData.append("name", file.name.replace(/\.[^.]+$/, ""));
    uploadMutation.mutate(formData);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTransform = () => {
    if (!selectedSample || !transformPrompt.trim()) return;
    transformMutation.mutate({
      sampleId: selectedSample.id,
      prompt: transformPrompt,
      style: transformStyle,
      duration: 15,
    });
    setTransformPrompt("");
  };

  const handlePlaySample = (sample: Sample) => {
    if (playingSampleId === sample.id) {
      audioRef.current?.pause();
      setPlayingSampleId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(sample.audioUrl!);
    audio.onended = () => setPlayingSampleId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingSampleId(sample.id);
  };

  const mobileTab = activeTab;

  return (
    <div className="h-full bg-background text-foreground flex flex-col font-sans overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Music className="h-5 w-5 text-purple-400" />
          <div>
            <h1 className="text-lg font-bold" data-testid="text-samplelab-title">
              Sample Lab
              <span className="text-purple-400 text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 ml-1.5">BETA</span>
            </h1>
            <p className="text-xs text-muted-foreground">Record, upload & transform audio with AI</p>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-white/5 flex flex-col bg-black/20">
          <div className="p-4 border-b border-white/5">
            <div className="flex gap-1 bg-white/5 rounded-lg p-1">
              {(["record", "upload", "transform"] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? "default" : "ghost"}
                  size="sm"
                  className="flex-1 text-xs capitalize gap-1"
                  onClick={() => setActiveTab(tab)}
                  data-testid={`button-tab-${tab}`}
                >
                  {tab === "record" && <Mic className="h-3 w-3" />}
                  {tab === "upload" && <Upload className="h-3 w-3" />}
                  {tab === "transform" && <Wand2 className="h-3 w-3" />}
                  {tab}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <AnimatePresence mode="wait">
              {activeTab === "record" && (
                <motion.div
                  key="record"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <Input
                    placeholder="Recording name..."
                    value={recordingName}
                    onChange={(e) => setRecordingName(e.target.value)}
                    className="bg-black/30 border-white/10 text-sm"
                    data-testid="input-recording-name"
                  />
                  <AudioRecorder onSave={handleRecordSave} />
                  {recordMutation.isPending && (
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving...
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "upload" && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileUpload}
                    data-testid="input-file-upload"
                  />
                  <div
                    className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors hover:border-primary/30"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-upload-area"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground text-center">
                      Drop audio file here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground/50">
                      WAV, MP3, OGG, M4A, FLAC (max 50MB)
                    </p>
                  </div>
                  {uploadMutation.isPending && (
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Uploading...
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "transform" && (
                <motion.div
                  key="transform"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {selectedSample ? (
                    <>
                      <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Source sample</p>
                        <p className="text-sm font-medium">{selectedSample.name}</p>
                      </div>
                      <Textarea
                        placeholder="Describe what you want the AI to transform this into... (e.g., 'romantic bachata guitar melody')"
                        value={transformPrompt}
                        onChange={(e) => setTransformPrompt(e.target.value)}
                        className="bg-black/30 border-white/10 text-sm min-h-[80px]"
                        data-testid="input-transform-prompt"
                      />
                      <Select value={transformStyle} onValueChange={setTransformStyle}>
                        <SelectTrigger className="bg-black/30 border-white/10" data-testid="select-transform-style">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STYLE_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        className="w-full gap-2"
                        onClick={handleTransform}
                        disabled={transformMutation.isPending || !transformPrompt.trim()}
                        data-testid="button-transform"
                      >
                        {transformMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                        Remix with AI
                      </Button>

                      <div className="border-t border-white/5 pt-3">
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <div>
                            <p className="text-sm font-medium">Key & BPM Detection</p>
                            <p className="text-[10px] text-muted-foreground">AI-powered musical analysis</p>
                          </div>
                          {(selectedSample.key || selectedSample.bpm) && (
                            <div className="flex items-center gap-2 text-xs">
                              {selectedSample.key && (
                                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono" data-testid="text-detected-key">
                                  {selectedSample.key}
                                </span>
                              )}
                              {selectedSample.bpm && (
                                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono" data-testid="text-detected-bpm">
                                  {selectedSample.bpm} BPM
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => detectKeyBPMMutation.mutate(selectedSample.id)}
                          disabled={detectKeyBPMMutation.isPending || selectedSample.status === "processing"}
                          data-testid="button-detect-key-bpm"
                        >
                          {detectKeyBPMMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Music className="h-4 w-4" />
                          )}
                          {detectKeyBPMMutation.isPending ? "Analyzing..." : "Detect Key & BPM"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Wand2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Select a sample from the library to transform it with AI</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-center">
            <TransportControls
              isPlaying={isPlaying}
              bpm={bpm}
              onPlayPause={() => setIsPlaying(!isPlaying)}
              onStop={() => {
                setIsPlaying(false);
                if (audioRef.current) {
                  audioRef.current.pause();
                  audioRef.current.currentTime = 0;
                }
                setPlayingSampleId(null);
              }}
              onBpmChange={setBpm}
            />
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            <ClipTimeline samples={samples} selectedId={selectedSampleId} />

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Sample Library
                </h3>
                <span className="text-xs text-muted-foreground">{samples.length} samples</span>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : samples.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Music className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No samples yet</p>
                  <p className="text-xs mt-1">Record or upload audio to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <AnimatePresence>
                    {samples.map((sample) => (
                      <SampleCard
                        key={sample.id}
                        sample={sample}
                        isSelected={selectedSampleId === sample.id}
                        onSelect={() => setSelectedSampleId(sample.id)}
                        onDelete={() => deleteMutation.mutate(sample.id)}
                        onPlay={() => handlePlaySample(sample)}
                        playingSampleId={playingSampleId}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 lg:hidden overflow-auto pb-20">
        <div className="p-4 border-b border-white/5 flex justify-center">
          <TransportControls
            isPlaying={isPlaying}
            bpm={bpm}
            onPlayPause={() => setIsPlaying(!isPlaying)}
            onStop={() => {
              setIsPlaying(false);
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
              }
              setPlayingSampleId(null);
            }}
            onBpmChange={setBpm}
          />
        </div>

        <div className="p-4 space-y-4">
          {mobileTab === "record" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <Input
                placeholder="Recording name..."
                value={recordingName}
                onChange={(e) => setRecordingName(e.target.value)}
                className="bg-black/30 border-white/10 text-sm"
              />
              <AudioRecorder onSave={handleRecordSave} />
              {recordMutation.isPending && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </div>
              )}
            </motion.div>
          )}

          {mobileTab === "upload" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div
                className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">Tap to upload audio</p>
                <p className="text-xs text-muted-foreground/50">WAV, MP3, OGG, M4A, FLAC</p>
              </div>
              {uploadMutation.isPending && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Uploading...
                </div>
              )}
            </motion.div>
          )}

          {mobileTab === "transform" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {selectedSample ? (
                <>
                  <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Source</p>
                    <p className="text-sm font-medium">{selectedSample.name}</p>
                  </div>
                  <Textarea
                    placeholder="Describe the AI transformation..."
                    value={transformPrompt}
                    onChange={(e) => setTransformPrompt(e.target.value)}
                    className="bg-black/30 border-white/10 text-sm min-h-[80px]"
                  />
                  <Select value={transformStyle} onValueChange={setTransformStyle}>
                    <SelectTrigger className="bg-black/30 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STYLE_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full gap-2"
                    onClick={handleTransform}
                    disabled={transformMutation.isPending || !transformPrompt.trim()}
                  >
                    {transformMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    Transform
                  </Button>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Wand2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select a sample first</p>
                </div>
              )}
            </motion.div>
          )}

          <ClipTimeline samples={samples} selectedId={selectedSampleId} />

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Samples ({samples.length})
            </h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : samples.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Music className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No samples yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {samples.map((sample) => (
                    <SampleCard
                      key={sample.id}
                      sample={sample}
                      isSelected={selectedSampleId === sample.id}
                      onSelect={() => setSelectedSampleId(sample.id)}
                      onDelete={() => deleteMutation.mutate(sample.id)}
                      onPlay={() => handlePlaySample(sample)}
                      playingSampleId={playingSampleId}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10 safe-area-bottom" data-testid="nav-mobile-bottom-samplelab">
        <div className="flex items-center justify-around px-2 py-1">
          {([
            { id: "record" as const, label: "Record", icon: Mic },
            { id: "upload" as const, label: "Upload", icon: Upload },
            { id: "transform" as const, label: "AI Magic", icon: Wand2 },
          ]).map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all min-w-[60px]",
                  isActive ? "text-purple-400" : "text-muted-foreground"
                )}
                data-testid={`button-mobile-tab-${item.id}`}
              >
                <item.icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]")} />
                <span className={cn("text-[10px] font-medium", isActive && "text-purple-400")}>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="samplelab-tab-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-purple-400 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
