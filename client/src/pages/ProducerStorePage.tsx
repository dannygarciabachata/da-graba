import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  useProducerKits,
  useCreateProducerKit,
  useDeleteProducerKit,
  useUploadProducerInstrument,
  useDeleteProducerInstrument,
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

const TRAINING_STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: "Not Trained", icon: Clock, color: "text-muted-foreground" },
  queued: { label: "Queued", icon: Clock, color: "text-yellow-400" },
  training: { label: "Training...", icon: Cpu, color: "text-blue-400" },
  ready: { label: "Ready", icon: CheckCircle2, color: "text-green-400" },
  failed: { label: "Failed", icon: XCircle, color: "text-red-400" },
};

function TrainingBadge({ status, error }: { status: string; error?: string | null }) {
  const config = TRAINING_STATUS_CONFIG[status] || TRAINING_STATUS_CONFIG.pending;
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-1.5" data-testid={`training-status-${status}`}>
      <Icon className={`h-3.5 w-3.5 ${config.color} ${status === "training" ? "animate-pulse" : ""}`} />
      <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
      {error && status === "failed" && (
        <span className="text-xs text-red-400/70 truncate max-w-[150px]" title={error}>
          - {error}
        </span>
      )}
    </div>
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
        <p className="text-[11px] text-muted-foreground">{typeName}</p>
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
              Available on the Producer plan and above.
            </p>
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

  const handleTrain = (kitId: number) => {
    trainKit.mutate(kitId, {
      onSuccess: () => toast({ title: "Training queued!", description: "Your kit will be processed by our AI." }),
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
            Upload your instruments and train AI to learn your unique musical style.
          </p>
        </div>
        <CreateKitDialog />
      </div>

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
              Create your first instrument kit to start uploading sounds and training our AI.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2" data-testid="producer-kits-grid">
        {kits?.map((kit) => {
          const trainingStatus = (kit as any).trainingStatus || "pending";
          const trainingError = (kit as any).trainingError;
          const canTrain = kit.instruments.length > 0 && (trainingStatus === "pending" || trainingStatus === "failed");
          const isTraining = trainingStatus === "training" || trainingStatus === "queued";

          return (
            <Card
              key={kit.id}
              className="bg-white/5 border-white/10 hover:border-primary/30 transition-colors"
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {GENRE_LABELS[kit.genre] || kit.genre}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <TrainingBadge status={trainingStatus} error={trainingError} />
                  <div className="flex items-center gap-1">
                    <Music className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {kit.instruments.length} instrument{kit.instruments.length !== 1 ? "s" : ""}
                    </span>
                  </div>
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
                    <p className="text-xs text-muted-foreground/50">No instruments uploaded yet</p>
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
                    className="flex-1"
                    onClick={() => handleUpload(kit.id)}
                    disabled={uploadInstrument.isPending || isTraining}
                    data-testid={`button-upload-instrument-${kit.id}`}
                  >
                    {uploadInstrument.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Upload
                  </Button>
                  <Button
                    variant={canTrain ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => handleTrain(kit.id)}
                    disabled={!canTrain || trainKit.isPending}
                    data-testid={`button-train-kit-${kit.id}`}
                  >
                    {trainKit.isPending || isTraining ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Cpu className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {isTraining ? "Training..." : trainingStatus === "ready" ? "Retrain" : "Train AI"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400"
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
