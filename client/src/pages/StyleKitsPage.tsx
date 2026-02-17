import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useStyleKits, useStyleKitMeta } from "@/hooks/use-style-kits";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Music, Play, Pause, Volume2, Filter, Disc,
  Guitar, Drum, Piano, Mic, ChevronDown, Loader2,
  Upload, FileAudio, Trash2, CheckCircle2,
  Zap, AlertTriangle, CheckCircle, Server, ServerOff, RotateCcw,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { StyleKitInstrument } from "@shared/schema";

const GENRE_LABELS: Record<string, string> = {
  bachata: "DAGRABACHATA",
  bolero: "DAGRABOLERO",
  dgb_bolero: "DAGRABOLERO",
  latin_pop: "Latin Pop",
  merengue: "Merengue",
  salsa: "Salsa",
  cumbia: "Cumbia",
  reggaeton: "Reggaeton",
  son: "Son",
  vallenato: "Vallenato",
  tropical: "Tropical",
};

const INSTRUMENT_ICONS: Record<string, typeof Music> = {
  guira: Disc,
  bongo: Drum,
  conga: Drum,
  timbal: Drum,
  campana: Drum,
  requinto: Guitar,
  segunda_guitarra: Guitar,
  bass: Guitar,
  piano: Piano,
  vocal: Mic,
  choir: Mic,
  vocals: Mic,
  pad: Music,
  strings: Music,
};

function InstrumentRow({ instrument, kitId }: { instrument: StyleKitInstrument; kitId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const { mutate: uploadAudio, isPending } = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("audio", file);
      const res = await fetch(`/api/style-kits/instruments/${instrument.id}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-kits"] });
      toast({ title: t('styleKits.upload.success') });
    },
    onError: (err: Error) => {
      toast({ title: err.message || t('styleKits.upload.error'), variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAudio(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const Icon = INSTRUMENT_ICONS[instrument.type] || Music;
  const typeName = instrument.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg bg-white/5 group"
      data-testid={`instrument-${instrument.id}`}
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{instrument.name}</p>
        <p className="text-xs text-muted-foreground">{typeName}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {instrument.audioUrl ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-60 group-hover:opacity-100 transition-opacity"
              onClick={togglePlay}
              data-testid={`button-play-instrument-${instrument.id}`}
            >
              {playing ? (
                <Pause className="h-4 w-4 text-primary" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </>
        ) : (
          <Volume2 className="h-4 w-4 text-muted-foreground/30" />
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px] px-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending}
          data-testid={`button-upload-instrument-${instrument.id}`}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Upload className="h-3 w-3 mr-1" />
              {instrument.audioUrl ? t('styleKits.upload.replace') : t('styleKits.upload.upload')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ReferenceSection({ kit }: { kit: any }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { mutate: uploadRef, isPending } = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("audio", file);
      const res = await fetch(`/api/producer/kits/${kit.id}/reference`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-kits"] });
      toast({ title: t('styleKits.reference.uploaded') });
    },
    onError: () => {
      toast({ title: t('styleKits.reference.error'), variant: "destructive" });
    },
  });

  const { mutate: deleteRef, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/producer/kits/${kit.id}/reference`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-kits"] });
      toast({ title: t('styleKits.reference.removed') });
    },
  });

  const togglePlay = () => {
    if (!kit.referenceUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(kit.referenceUrl);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadRef(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="mt-3 p-3 rounded-lg border border-dashed border-purple-400/30 bg-purple-500/[0.04]" data-testid={`reference-section-${kit.id}`}>
      <div className="flex items-center gap-2 mb-2">
        <FileAudio className="h-3.5 w-3.5 text-purple-400" />
        <span className="text-xs font-semibold text-purple-300">{t('styleKits.reference.title')}</span>
      </div>
      <p className="text-[10px] text-muted-foreground mb-2">{t('styleKits.reference.desc')}</p>

      {kit.referenceUrl ? (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
          <span className="text-xs text-green-300 flex-1 truncate">{t('styleKits.reference.loaded')}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={togglePlay}
            data-testid={`button-play-reference-${kit.id}`}
          >
            {playing ? <Pause className="h-3.5 w-3.5 text-primary" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileSelect} />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            data-testid={`button-replace-reference-${kit.id}`}
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Upload className="h-3 w-3 mr-1" />{t('styleKits.upload.replace')}</>}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => deleteRef()}
            disabled={isDeleting}
            data-testid={`button-delete-reference-${kit.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div>
          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileSelect} />
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs border-dashed border-purple-400/30"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            data-testid={`button-upload-reference-${kit.id}`}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1.5" />
            )}
            {t('styleKits.reference.uploadBtn')}
          </Button>
        </div>
      )}
    </div>
  );
}

const PIPELINE_STEPS = ["upload", "analyze", "prompt", "train", "ready"] as const;
const READY_STATES = ["ready", "complete"];

function TrainingSection({ kit }: { kit: any }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isPolling, setIsPolling] = useState(false);

  const { data: trainingStatus, refetch } = useQuery({
    queryKey: ["/api/style-kits", kit.id, "training-status"],
    queryFn: async () => {
      const res = await fetch(`/api/style-kits/${kit.id}/training-status`);
      if (!res.ok) throw new Error("Failed to fetch training status");
      return res.json();
    },
    refetchInterval: isPolling ? 5000 : false,
  });

  useEffect(() => {
    if (trainingStatus) {
      const active = ["analyzing", "prompting", "queued", "training"].includes(trainingStatus.trainingStatus);
      setIsPolling(active);
    }
  }, [trainingStatus]);

  const { mutate: startTraining, isPending: isStarting } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/style-kits/${kit.id}/analyze`);
      return res.json();
    },
    onSuccess: (data) => {
      setIsPolling(true);
      queryClient.invalidateQueries({ queryKey: ["/api/style-kits"] });
      refetch();
      toast({ title: t("styleKits.training.startedSuccess") });
    },
    onError: (err: Error) => {
      toast({ title: err.message || t("styleKits.training.startError"), variant: "destructive" });
    },
  });

  const { mutate: submitTrain, isPending: isSubmitting } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/style-kits/${kit.id}/train`);
      return res.json();
    },
    onSuccess: () => {
      setIsPolling(true);
      queryClient.invalidateQueries({ queryKey: ["/api/style-kits"] });
      refetch();
      toast({ title: t("styleKits.training.startedSuccess") });
    },
    onError: (err: Error) => {
      toast({ title: err.message || t("styleKits.training.startError"), variant: "destructive" });
    },
  });

  const { mutate: resetTraining, isPending: isResetting } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/style-kits/${kit.id}/reset-training`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-kits"] });
      refetch();
      toast({ title: t("styleKits.training.resetSuccess", "Entrenamiento reiniciado") });
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Error resetting training", variant: "destructive" });
    },
  });

  if (!trainingStatus) return null;

  const { progress, pipelineStep, trainingStatus: status, trainingError, instruments, gpuConnected, trainedModelUrl, lastTrainedAt, isStuck } = trainingStatus;
  const isActive = ["analyzing", "prompting", "queued", "training"].includes(status) && !isStuck;
  const isReady = READY_STATES.includes(pipelineStep);
  const isFailed = status === "failed";
  const canStartAnalysis = instruments.withAudio === instruments.total && instruments.total > 0 && !isActive && pipelineStep === "upload";
  const canStartTraining = pipelineStep === "train" && !isActive && instruments.withPrompts > 0;

  const getStepStatus = (step: string) => {
    const stepIdx = PIPELINE_STEPS.indexOf(step as any);
    const normalizedStep = READY_STATES.includes(pipelineStep) ? "ready" : pipelineStep;
    const currentIdx = PIPELINE_STEPS.indexOf(normalizedStep as any);
    if (stepIdx < currentIdx) return "done";
    if (stepIdx === currentIdx) return isActive ? "active" : (isFailed ? "error" : "current");
    return "pending";
  };

  return (
    <div className="mt-3 p-3 rounded-lg border border-[#D946EF]/20 bg-gradient-to-r from-[#D946EF]/[0.04] to-[#00C8FF]/[0.04]" data-testid={`training-section-${kit.id}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-[#D946EF]" />
          <span className="text-xs font-semibold text-[#D946EF]">{t("styleKits.training.title")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {gpuConnected ? (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[9px] px-1.5 py-0" data-testid={`badge-gpu-${kit.id}`}>
              <Server className="h-2.5 w-2.5 mr-0.5" /> GPU
            </Badge>
          ) : (
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[9px] px-1.5 py-0" data-testid={`badge-gpu-${kit.id}`}>
              <ServerOff className="h-2.5 w-2.5 mr-0.5" /> {t("styleKits.training.gpuDisconnected")}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 mb-2">
        {PIPELINE_STEPS.map((step, idx) => {
          const stepStatus = getStepStatus(step);
          return (
            <div key={step} className="flex items-center gap-1 flex-1">
              <div
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  stepStatus === "done" ? "bg-[#00C8FF]" :
                  stepStatus === "active" ? "bg-[#D946EF] animate-pulse" :
                  stepStatus === "error" ? "bg-red-500" :
                  stepStatus === "current" ? "bg-[#D946EF]/50" :
                  "bg-white/10"
                }`}
                data-testid={`step-${step}-${kit.id}`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {PIPELINE_STEPS.map((step) => {
            const stepStatus = getStepStatus(step);
            return (
              <span key={step} className={`text-[8px] flex-1 text-center ${
                stepStatus === "done" ? "text-[#00C8FF]" :
                stepStatus === "active" || stepStatus === "current" ? "text-[#D946EF]" :
                stepStatus === "error" ? "text-red-400" :
                "text-muted-foreground/50"
              }`}>
                {t(`styleKits.training.steps.${step}`)}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">
            {t("styleKits.training.instrumentsReady", { count: instruments.withAudio, total: instruments.total })}
          </span>
          <span className="text-[10px] font-mono text-[#00C8FF]">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2 bg-white/5" data-testid={`progress-bar-${kit.id}`} />
      </div>

      {isActive && (
        <div className="flex items-center gap-2 p-2 rounded bg-[#D946EF]/10 border border-[#D946EF]/20 mb-2" data-testid={`training-active-${kit.id}`}>
          <Loader2 className="h-3.5 w-3.5 text-[#D946EF] animate-spin flex-shrink-0" />
          <span className="text-xs text-[#D946EF]">
            {status === "analyzing" ? t("styleKits.training.analyzing") :
             status === "training" ? t("styleKits.training.training") :
             t("styleKits.training.queued")}
          </span>
        </div>
      )}

      {isStuck && (
        <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20 mb-2" data-testid={`training-stuck-${kit.id}`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-yellow-400">{t("styleKits.training.stuck", "Entrenamiento detenido")}</span>
          </div>
          <p className="text-[10px] text-yellow-300/80">{t("styleKits.training.stuckDesc", "El servidor GPU no respondió. Puedes reintentar el entrenamiento.")}</p>
        </div>
      )}

      {isFailed && trainingError && (
        <div className="p-2 rounded bg-red-500/10 border border-red-500/20 mb-2" data-testid={`training-error-${kit.id}`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-red-400">{t("styleKits.training.failed")}</span>
          </div>
          <p className="text-[10px] text-red-300/80 break-all">{trainingError}</p>
        </div>
      )}

      {isReady && (
        <div className="p-2 rounded bg-green-500/10 border border-green-500/20 mb-2" data-testid={`training-ready-${kit.id}`}>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
            <span className="text-xs text-green-400">{t("styleKits.training.ready")}</span>
          </div>
          {lastTrainedAt && (
            <p className="text-[9px] text-muted-foreground mt-1">
              {t("styleKits.training.lastTrained")}: {new Date(lastTrainedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {canStartAnalysis && (
          <Button
            size="sm"
            className="flex-1 h-8 text-xs bg-gradient-to-r from-[#00C8FF] to-[#D946EF] text-white hover:opacity-90"
            onClick={() => startTraining()}
            disabled={isStarting}
            data-testid={`button-start-training-${kit.id}`}
          >
            {isStarting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Zap className="h-3.5 w-3.5 mr-1" />
            )}
            {t("styleKits.training.startTraining")}
          </Button>
        )}
        {canStartTraining && (
          <Button
            size="sm"
            className="flex-1 h-8 text-xs bg-gradient-to-r from-[#00C8FF] to-[#D946EF] text-white hover:opacity-90"
            onClick={() => submitTrain()}
            disabled={isSubmitting}
            data-testid={`button-submit-train-${kit.id}`}
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Zap className="h-3.5 w-3.5 mr-1" />
            )}
            {t("styleKits.train")}
          </Button>
        )}
        {isFailed && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
            onClick={() => startTraining()}
            disabled={isStarting}
            data-testid={`button-retry-training-${kit.id}`}
          >
            {isStarting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
            )}
            {t("styleKits.training.retryTraining")}
          </Button>
        )}
        {isStuck && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
            onClick={() => resetTraining()}
            disabled={isResetting}
            data-testid={`button-reset-training-${kit.id}`}
          >
            {isResetting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
            )}
            {t("styleKits.training.resetTraining", "Reiniciar Entrenamiento")}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function StyleKitsPage() {
  const { t } = useTranslation();
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>(undefined);
  const [expandedKit, setExpandedKit] = useState<number | null>(null);
  const { data: meta } = useStyleKitMeta();
  const { data: kits, isLoading } = useStyleKits(selectedGenre);

  const genres = meta?.genres || Object.keys(GENRE_LABELS);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6" data-testid="style-kits-page">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
          <Disc className="h-6 w-6 text-primary" />
          {t('styleKits.title')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t('styleKits.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" data-testid="genre-filters">
        <Button
          variant={!selectedGenre ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedGenre(undefined)}
          data-testid="button-filter-all"
        >
          <Filter className="h-3.5 w-3.5 mr-1" /> {t('styleKits.all')}
        </Button>
        {genres.map((g) => (
          <Button
            key={g}
            variant={selectedGenre === g ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedGenre(selectedGenre === g ? undefined : g)}
            data-testid={`button-filter-${g}`}
          >
            {GENRE_LABELS[g] || g}
          </Button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16" data-testid="loading-kits">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && (!kits || kits.length === 0) && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Disc className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('styleKits.noKitsYet')}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t('styleKits.noKitsDesc')}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="kits-grid">
        {kits?.map((kit) => {
          const isExpanded = expandedKit === kit.id;
          return (
            <Card
              key={kit.id}
              className="bg-white/5 border-white/10 hover:border-primary/30 transition-colors"
              data-testid={`kit-card-${kit.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{kit.name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {kit.description || t('styleKits.instrumentKit')}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {GENRE_LABELS[kit.genre] || kit.genre}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Music className="h-3.5 w-3.5" />
                  <span>{t('styleKits.instrumentCount', { count: kit.instruments.length })}{kit.instruments.length !== 1 ? 's' : ''}</span>
                </div>

                {kit.instruments.length > 0 && (
                  <>
                    <div className="space-y-1">
                      {(isExpanded ? kit.instruments : kit.instruments.slice(0, 3)).map((instr) => (
                        <InstrumentRow key={instr.id} instrument={instr} kitId={kit.id} />
                      ))}
                    </div>
                    {kit.instruments.length > 3 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground"
                        onClick={() => setExpandedKit(isExpanded ? null : kit.id)}
                        data-testid={`button-expand-kit-${kit.id}`}
                      >
                        <ChevronDown className={`h-3.5 w-3.5 mr-1 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        {isExpanded ? t('styleKits.showLess') : t('styleKits.showMore', { count: kit.instruments.length - 3 })}
                      </Button>
                    )}
                  </>
                )}

                {kit.instruments.length === 0 && (
                  <p className="text-xs text-muted-foreground/50 text-center py-4">
                    {t('styleKits.noInstruments')}
                  </p>
                )}

                <ReferenceSection kit={kit} />
                <TrainingSection kit={kit} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
