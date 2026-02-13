import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  useProducerKits,
  useCreateProducerKit,
  useDeleteProducerKit,
  useUploadProducerInstrument,
  useDeleteProducerInstrument,
  useAnalyzeKit,
  useTrainKit,
  useStyleKitMeta,
} from "@/hooks/use-style-kits";
import { useStripeSubscription } from "@/hooks/use-stripe";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Store,
  Plus,
  Upload,
  Trash2,
  Loader2,
  Cpu,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Pause,
  Music,
  AlertTriangle,
  CreditCard,
  Disc,
  Search,
  FileText,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import type { StyleKitInstrument } from "@shared/schema";

const GENRE_LABELS: Record<string, string> = {
  bachata: "Bachata",
  bolero: "Bolero",
  latin_pop: "Latin Pop",
  merengue: "Merengue",
  salsa: "Salsa",
  cumbia: "Cumbia",
  reggaeton: "Reggaeton",
  son: "Son",
  vallenato: "Vallenato",
  tropical: "Tropical",
};

const PIPELINE_STEPS = [
  { key: "upload", label: "Upload", icon: Upload, description: "Upload instrument audio files" },
  { key: "analyze", label: "Analyze", icon: Search, description: "AI analyzes your audio (key, BPM, energy)" },
  { key: "prompt", label: "Prompts", icon: FileText, description: "Generate training descriptions with AI" },
  { key: "train", label: "Train", icon: Cpu, description: "Fine-tune the model with your instruments" },
  { key: "ready", label: "Ready", icon: CheckCircle2, description: "Your AI model is trained and ready" },
];

function PipelineProgress({ currentStep, trainingStatus }: { currentStep: string; trainingStatus: string }) {
  const stepIndex = PIPELINE_STEPS.findIndex(s => s.key === currentStep);
  const isProcessing = ["analyzing", "prompting", "queued", "training"].includes(trainingStatus);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1" data-testid="pipeline-progress">
        {PIPELINE_STEPS.map((step, idx) => {
          const isComplete = idx < stepIndex || (idx === stepIndex && currentStep === "ready");
          const isCurrent = idx === stepIndex && currentStep !== "ready";
          const isActive = isComplete || isCurrent;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-full border transition-all ${
                      isComplete
                        ? "bg-green-500/20 border-green-500/50 text-green-400"
                        : isCurrent
                        ? `border-primary/50 text-primary ${isProcessing ? "animate-pulse bg-primary/10" : "bg-primary/10"}`
                        : "border-white/10 text-muted-foreground/40 bg-white/5"
                    }`}
                    data-testid={`pipeline-step-${step.key}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p className="font-medium">{step.label}</p>
                  <p className="text-muted-foreground">{step.description}</p>
                </TooltipContent>
              </Tooltip>
              {idx < PIPELINE_STEPS.length - 1 && (
                <ArrowRight className={`h-3 w-3 mx-0.5 ${isActive ? "text-primary/50" : "text-white/10"}`} />
              )}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

function InstrumentRow({
  instrument,
  kitId,
  onDelete,
  isDeleting,
}: {
  instrument: StyleKitInstrument;
  kitId: number;
  onDelete: (kitId: number, instrumentId: number) => void;
  isDeleting: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!instrument.audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(instrument.audioUrl);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const typeName = instrument.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const hasPrompt = !!(instrument as any).generatedPrompt;
  const analysisStatus = (instrument as any).analysisStatus || "pending";
  const detectedKey = (instrument as any).detectedKey;
  const detectedBpm = (instrument as any).detectedBpm;

  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
      data-testid={`producer-instrument-${instrument.id}`}
    >
      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Music className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{instrument.name}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{typeName}</span>
          {detectedKey && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/30 text-primary">
              {detectedKey}
            </Badge>
          )}
          {detectedBpm && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-blue-400/30 text-blue-400">
              {detectedBpm} BPM
            </Badge>
          )}
          {hasPrompt && (
            <Sparkles className="h-3 w-3 text-yellow-400" />
          )}
          {analysisStatus === "analyzing" && (
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {instrument.audioUrl && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={togglePlay}
            data-testid={`button-play-producer-instrument-${instrument.id}`}
          >
            {playing ? <Pause className="h-3.5 w-3.5 text-primary" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-400 opacity-0 group-hover:opacity-100"
          onClick={() => onDelete(kitId, instrument.id)}
          disabled={isDeleting}
          data-testid={`button-delete-producer-instrument-${instrument.id}`}
        >
          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function CreateKitDialog({ onCreated }: { onCreated?: () => void }) {
  const { toast } = useToast();
  const createKit = useCreateProducerKit();
  const { data: meta } = useStyleKitMeta();
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);

  const genres = meta?.genres || Object.keys(GENRE_LABELS);

  const handleSubmit = () => {
    if (!name.trim() || !genre) {
      toast({ title: "Missing fields", description: "Name and genre are required.", variant: "destructive" });
      return;
    }
    createKit.mutate(
      { name: name.trim(), genre, description: description.trim() || undefined },
      {
        onSuccess: () => {
          toast({ title: "Kit created!" });
          setName("");
          setGenre("");
          setDescription("");
          setOpen(false);
          onCreated?.();
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-kit">
          <Plus className="h-4 w-4 mr-1.5" />
          New Kit
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-create-kit">
        <DialogHeader>
          <DialogTitle>Create Instrument Kit</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input
            placeholder="Kit name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="input-kit-name"
          />
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger data-testid="select-kit-genre">
              <SelectValue placeholder="Select genre" />
            </SelectTrigger>
            <SelectContent>
              {genres.map((g) => (
                <SelectItem key={g} value={g}>
                  {GENRE_LABELS[g] || g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            data-testid="input-kit-description"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={createKit.isPending} data-testid="button-submit-create-kit">
            {createKit.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProducerStorePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: subscription } = useStripeSubscription();
  const { data: kits, isLoading } = useProducerKits();
  const deleteKit = useDeleteProducerKit();
  const uploadInstrument = useUploadProducerInstrument();
  const deleteInstrument = useDeleteProducerInstrument();
  const analyzeKit = useAnalyzeKit();
  const trainKit = useTrainKit();
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const tier = (subscription as any)?.tier || "free";
  const hasAccess = tier === "producer" || tier === "premium" || tier === "admin";

  if (!hasAccess) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto" data-testid="producer-store-locked">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Store className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Producer Store</h2>
            <p className="text-muted-foreground text-sm max-w-md">
              Upload your own instrument kits and train our AI to understand your unique sounds.
              Powered by Stable Audio Open fine-tuning pipeline.
              Available on the Producer plan and above.
            </p>
            <div className="flex items-center gap-4 py-2">
              {PIPELINE_STEPS.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex items-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{step.label}</span>
                    </div>
                    {idx < PIPELINE_STEPS.length - 1 && (
                      <ArrowRight className="h-3 w-3 mx-1 text-white/20 mb-4" />
                    )}
                  </div>
                );
              })}
            </div>
            <Button onClick={() => setLocation("/pricing")} data-testid="button-upgrade-producer">
              <CreditCard className="h-4 w-4 mr-1.5" />
              Upgrade to Producer - $29/mo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleUpload = (kitId: number) => {
    const input = fileInputRefs.current[kitId];
    if (input) input.click();
  };

  const handleFileSelected = (kitId: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const allowedTypes = ["audio/wav", "audio/mpeg", "audio/mp3", "audio/x-wav"];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(wav|mp3)$/i)) {
      toast({ title: "Invalid file", description: "Please upload a WAV or MP3 file.", variant: "destructive" });
      return;
    }
    const formData = new FormData();
    formData.append("audio", file);
    formData.append("name", file.name.replace(/\.[^.]+$/, ""));
    formData.append("type", "custom");
    uploadInstrument.mutate(
      { kitId, formData },
      {
        onSuccess: () => toast({ title: "Instrument uploaded!" }),
        onError: (err: any) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleDeleteInstrument = (kitId: number, instrumentId: number) => {
    deleteInstrument.mutate(
      { kitId, instrumentId },
      {
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleDeleteKit = (id: number) => {
    deleteKit.mutate(id, {
      onSuccess: () => toast({ title: "Kit deleted" }),
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  const handleAnalyze = (kitId: number) => {
    analyzeKit.mutate(kitId, {
      onSuccess: () => toast({ title: "Analysis complete!", description: "AI prompts have been generated for your instruments." }),
      onError: (err: any) => toast({ title: "Analysis failed", description: err.message, variant: "destructive" }),
    });
  };

  const handleTrain = (kitId: number) => {
    trainKit.mutate(kitId, {
      onSuccess: () => toast({ title: "Training queued!", description: "Your kit is being fine-tuned with the SAO pipeline." }),
      onError: (err: any) => toast({ title: "Training failed", description: err.message, variant: "destructive" }),
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6" data-testid="producer-store-page">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Store className="h-6 w-6 text-primary" />
            Producer Store
          </h1>
          <p className="text-muted-foreground text-sm">
            Upload instruments, analyze audio, generate AI prompts, and fine-tune your own model.
          </p>
        </div>
        <CreateKitDialog />
      </div>

      <Card className="bg-gradient-to-r from-primary/5 to-blue-500/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">SAO Training Pipeline</p>
              <p className="text-xs text-muted-foreground">
                Based on Stable Audio Open fine-tuning. Upload your WAV/MP3 instruments, 
                AI analyzes the audio characteristics, generates descriptive training prompts, 
                then fine-tunes the model to understand your unique sounds.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && (!kits || kits.length === 0) && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <Disc className="h-16 w-16 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No kits yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Create your first instrument kit to start the AI training pipeline.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2" data-testid="producer-kits-grid">
        {kits?.map((kit) => {
          const trainingStatus = (kit as any).trainingStatus || "pending";
          const trainingError = (kit as any).trainingError;
          const pipelineStep = (kit as any).pipelineStep || "upload";
          const trainingPrompt = (kit as any).trainingPrompt;
          const hasAudioInstruments = kit.instruments.some(i => i.audioUrl);
          const allHavePrompts = kit.instruments.filter(i => i.audioUrl).every(i => (i as any).generatedPrompt);
          const isProcessing = ["analyzing", "prompting", "queued", "training"].includes(trainingStatus);

          const canAnalyze = hasAudioInstruments && !isProcessing;
          const canTrain = hasAudioInstruments && allHavePrompts && !isProcessing && (pipelineStep === "train" || trainingStatus === "failed");
          const isReady = pipelineStep === "ready" || trainingStatus === "ready";

          return (
            <Card
              key={kit.id}
              className={`bg-white/5 border-white/10 hover:border-primary/30 transition-colors ${isReady ? "border-green-500/30" : ""}`}
              data-testid={`producer-kit-card-${kit.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{kit.name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {kit.description || "Custom instrument kit"}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    {GENRE_LABELS[kit.genre] || kit.genre}
                  </Badge>
                </div>
                <div className="mt-2">
                  <PipelineProgress currentStep={pipelineStep} trainingStatus={trainingStatus} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {kit.instruments.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {kit.instruments.map((instr) => (
                      <InstrumentRow
                        key={instr.id}
                        instrument={instr}
                        kitId={kit.id}
                        onDelete={handleDeleteInstrument}
                        isDeleting={deleteInstrument.isPending}
                      />
                    ))}
                  </div>
                )}

                {kit.instruments.length === 0 && (
                  <div className="text-center py-4">
                    <Upload className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground/50">Upload instrument audio files to begin</p>
                  </div>
                )}

                {trainingPrompt && (
                  <div className="p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                    <div className="flex items-start gap-2">
                      <FileText className="h-3.5 w-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-yellow-400 font-medium mb-0.5">Kit Training Prompt</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{trainingPrompt}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="file"
                    accept=".wav,.mp3,audio/wav,audio/mpeg"
                    className="hidden"
                    ref={(el) => { fileInputRefs.current[kit.id] = el; }}
                    onChange={(e) => handleFileSelected(kit.id, e.target.files)}
                    data-testid={`input-upload-instrument-${kit.id}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpload(kit.id)}
                    disabled={uploadInstrument.isPending || isProcessing}
                    data-testid={`button-upload-instrument-${kit.id}`}
                  >
                    {uploadInstrument.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 mr-1" />
                    )}
                    Upload
                  </Button>
                  <Button
                    variant={canAnalyze && pipelineStep === "upload" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleAnalyze(kit.id)}
                    disabled={!canAnalyze || analyzeKit.isPending}
                    data-testid={`button-analyze-kit-${kit.id}`}
                  >
                    {analyzeKit.isPending || trainingStatus === "analyzing" || trainingStatus === "prompting" ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5 mr-1" />
                    )}
                    {trainingStatus === "analyzing" ? "Analyzing..." : trainingStatus === "prompting" ? "Prompts..." : allHavePrompts ? "Re-analyze" : "Analyze"}
                  </Button>
                  <Button
                    variant={canTrain ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTrain(kit.id)}
                    disabled={!canTrain || trainKit.isPending}
                    data-testid={`button-train-kit-${kit.id}`}
                  >
                    {trainKit.isPending || trainingStatus === "queued" || trainingStatus === "training" ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Cpu className="h-3.5 w-3.5 mr-1" />
                    )}
                    {trainingStatus === "queued" || trainingStatus === "training" ? "Training..." : isReady ? "Retrain" : "Train"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400 ml-auto"
                    onClick={() => handleDeleteKit(kit.id)}
                    disabled={deleteKit.isPending}
                    data-testid={`button-delete-kit-${kit.id}`}
                  >
                    {deleteKit.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                {trainingStatus === "failed" && trainingError && (
                  <div className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-400">{trainingError}</p>
                  </div>
                )}

                {isReady && (
                  <div className="flex items-start gap-2 p-2 rounded bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-green-400">Model trained and ready! Your instruments are now part of the AI.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
