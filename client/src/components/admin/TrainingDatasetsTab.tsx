import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Upload, Loader2, Music, FileText,
  Play, CheckCircle, XCircle, Clock, ArrowLeft,
  Database, FolderOpen, Zap, ExternalLink, Search,
  Piano, HardDrive, RefreshCw, Download,
} from "lucide-react";
import type { TrainingDataset, TrainingFile } from "@shared/schema";

type View = "list" | "detail" | "create";

const STEP_LABELS: Record<string, string> = {
  pending: "Pendiente",
  running: "En progreso",
  completed: "Completado",
  failed: "Error",
};

const STEP_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
};

function StepBadge({ status }: { status: string }) {
  const Icon = STEP_ICONS[status] || Clock;
  const colors: Record<string, string> = {
    pending: "text-muted-foreground",
    running: "text-blue-500",
    completed: "text-green-500",
    failed: "text-red-500",
  };
  return (
    <Badge variant="outline" className="gap-1" data-testid={`badge-step-${status}`}>
      <Icon className={`h-3 w-3 ${colors[status] || ""} ${status === "running" ? "animate-spin" : ""}`} />
      {STEP_LABELS[status] || status}
    </Badge>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function TrainingDatasetsTab() {
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { toast } = useToast();

  if (view === "create") {
    return <CreateDatasetView onBack={() => setView("list")} />;
  }

  if (view === "detail" && selectedId) {
    return <DatasetDetailView id={selectedId} onBack={() => { setView("list"); setSelectedId(null); }} />;
  }

  return <DatasetListView onSelect={(id) => { setSelectedId(id); setView("detail"); }} onCreate={() => setView("create")} />;
}

function DatasetListView({ onSelect, onCreate }: { onSelect: (id: number) => void; onCreate: () => void }) {
  const { data: datasets, isLoading } = useQuery<TrainingDataset[]>({
    queryKey: ["/api/admin/training-datasets"],
  });

  const { data: pipelineInfo } = useQuery<any>({
    queryKey: ["/api/admin/training-pipeline-info"],
  });

  return (
    <div className="space-y-4" data-testid="training-datasets-tab">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">SAO Training Datasets</CardTitle>
            </div>
            <Button size="sm" onClick={onCreate} data-testid="button-create-dataset">
              <Plus className="h-4 w-4 mr-1" /> Nuevo Dataset
            </Button>
          </div>
          <CardDescription>
            Gestionar datasets de entrenamiento para SAO Instrumental Finetune. Pipeline: Clean MIDI → Metadata → Prompts → Render Audio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pipelineInfo?.sources && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Fuentes de datos disponibles:</p>
              <div className="flex flex-wrap gap-2">
                {pipelineInfo.sources.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Database className="h-3 w-3" />
                      {s.name}
                    </Badge>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !datasets?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay datasets creados.</p>
              <p className="text-xs mt-1">Crea uno nuevo para comenzar el pipeline de entrenamiento.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {datasets.map((ds) => (
                <div
                  key={ds.id}
                  className="border rounded-md p-3 hover-elevate cursor-pointer"
                  onClick={() => onSelect(ds.id)}
                  data-testid={`card-dataset-${ds.id}`}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h4 className="text-sm font-medium">{ds.name}</h4>
                      {ds.description && <p className="text-xs text-muted-foreground mt-0.5">{ds.description}</p>}
                    </div>
                    <Badge variant={ds.status === "completed" ? "default" : "outline"} className="text-xs">
                      {ds.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Music className="h-3 w-3" /> {ds.midiFileCount || 0} MIDI</span>
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {ds.promptFileCount || 0} Prompts</span>
                    <span className="flex items-center gap-1"><Play className="h-3 w-3" /> {ds.renderFileCount || 0} Renders</span>
                    <span>{formatBytes(ds.totalSizeBytes || 0)}</span>
                    <span>Fuente: {ds.sourceType === "million_song" ? "MSD" : ds.sourceType}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <StepBadge status={ds.stepCleanMidi || "pending"} />
                    <StepBadge status={ds.stepMetadata || "pending"} />
                    <StepBadge status={ds.stepPrompts || "pending"} />
                    <StepBadge status={ds.stepRendering || "pending"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pipelineInfo?.pipeline && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Pipeline de Entrenamiento</CardTitle>
            </div>
            <CardDescription>Pasos del pipeline SAO Dataset Creator (de santifiorino/SAO-Instrumental-Finetune)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {pipelineInfo.pipeline.map((step: any, i: number) => (
                <div key={step.id} className="border rounded-md p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-muted rounded-full w-5 h-5 flex items-center justify-center">{i + 1}</span>
                    <span className="text-sm font-medium">{step.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <InstrumentStatusCard />
      <EndpointConfigCard />
    </div>
  );
}

function InstrumentStatusCard() {
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [building, setBuilding] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [buildOutput, setBuildOutput] = useState<string | null>(null);
  const [installOutput, setInstallOutput] = useState<string | null>(null);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await apiRequest("GET", "/api/admin/gpu/instruments");
      const data = await res.json();
      setStatus(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const installInstruments = async () => {
    setInstalling(true);
    setInstallOutput(null);
    try {
      toast({ title: "Instalando...", description: "Instalando FluidSynth, SoundFont y SAO Finetune en RunPod. Esto puede tardar varios minutos." });
      const res = await apiRequest("POST", "/api/admin/gpu/setup");
      const data = await res.json();
      setInstallOutput(data.output);
      if (data.success) {
        toast({ title: "Instalacion Completa", description: "Todos los instrumentos virtuales fueron instalados exitosamente." });
        checkStatus();
      } else {
        toast({ title: "Instalacion Parcial", description: "Algunos componentes fallaron. Revisa el log.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setInstalling(false);
    }
  };

  const buildVst3 = async () => {
    setBuilding(true);
    setBuildOutput(null);
    try {
      const res = await apiRequest("POST", "/api/admin/gpu/build-vst3");
      const data = await res.json();
      setBuildOutput(data.output);
      if (data.success) {
        toast({ title: "VST3 Compilado", description: "DA GRABA Sampler compilado y desplegado exitosamente." });
        checkStatus();
      } else {
        toast({ title: "Error de Compilacion", description: "Revisa el log de salida para detalles.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBuilding(false);
    }
  };

  const anyBusy = checking || building || installing;

  return (
    <Card data-testid="card-instrument-status">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Piano className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Motor de Instrumentos</CardTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={checkStatus} disabled={anyBusy} data-testid="button-check-instruments">
              {checking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Verificar
            </Button>
            <Button size="sm" variant="outline" onClick={installInstruments} disabled={anyBusy} data-testid="button-install-instruments">
              {installing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
              {installing ? "Instalando..." : "GPU Setup"}
            </Button>
            <Button size="sm" onClick={buildVst3} disabled={anyBusy} data-testid="button-build-vst3">
              {building ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
              {building ? "Compilando..." : "Build VST3"}
            </Button>
          </div>
        </div>
        <CardDescription>
          FluidSynth (GM SoundFont) + SAO Instrumental Finetune + DA GRABA Sampler VST3
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!status ? (
          <div className="text-center py-4 text-muted-foreground">
            <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Pulsa &quot;Verificar&quot; para comprobar el estado de los instrumentos en RunPod Serverless.</p>
            <p className="text-xs mt-1">Pulsa &quot;GPU Setup&quot; para instalar FluidSynth, SoundFont y SAO Finetune.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="border rounded-md p-3 space-y-1">
                <div className="flex items-center gap-2">
                  {status.soundfontInstalled ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">FluidR3_GM.sf2</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {status.soundfontInstalled
                    ? `${(status.soundfontSize / 1e6).toFixed(0)} MB`
                    : "No instalado"}
                </p>
              </div>
              <div className="border rounded-md p-3 space-y-1">
                <div className="flex items-center gap-2">
                  {status.fluidsynthInstalled ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">FluidSynth</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {status.fluidsynthInstalled ? "Instalado" : "No instalado"}
                </p>
              </div>
              <div className="border rounded-md p-3 space-y-1">
                <div className="flex items-center gap-2">
                  {status.saoFinetuneInstalled ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-orange-500" />
                  )}
                  <span className="text-sm font-medium">SAO Finetune</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {status.saoFinetuneInstalled ? "Modelo cargado" : "No descargado"}
                </p>
              </div>
              <div className="border rounded-md p-3 space-y-1">
                <div className="flex items-center gap-2">
                  {status.vst3Installed ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">DA GRABA Sampler</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {status.vst3Installed ? "VST3 compilado" : "No compilado"}
                </p>
              </div>
              <div className="border rounded-md p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Samples</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {status.sampleDirs > 0
                    ? `${status.sampleDirs} instrumentos, ${status.sampleFiles || 0} WAVs`
                    : "Sin samples cargados"}
                </p>
              </div>
            </div>
            {status.details && (
              <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-32 whitespace-pre-wrap" data-testid="text-instrument-details">
                {status.details}
              </pre>
            )}
            {(!status.soundfontInstalled || !status.fluidsynthInstalled || !status.saoFinetuneInstalled) && (
              <p className="text-xs text-muted-foreground">
                Pulsa &quot;GPU Setup&quot; para instalar los componentes faltantes (FluidSynth, SoundFont, SAO Finetune).
              </p>
            )}
          </div>
        )}
        {installOutput && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Log de Instalacion:</p>
            <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-48 whitespace-pre-wrap" data-testid="text-install-output">
              {installOutput}
            </pre>
          </div>
        )}
        {buildOutput && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Log de Compilacion VST3:</p>
            <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-48 whitespace-pre-wrap" data-testid="text-build-output">
              {buildOutput}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EndpointConfigCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);
  const [config, setConfig] = useState<any>(null);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", "/api/admin/gpu/endpoint-config");
      const data = await res.json();
      setConfig(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (updates: Record<string, any>) => {
    setSaving(true);
    try {
      const res = await apiRequest("POST", "/api/admin/gpu/endpoint-config", updates);
      const data = await res.json();
      if (data.success) {
        toast({ title: "Configuracion Actualizada", description: "Los cambios se aplicaran en el proximo ciclo de workers." });
        loadConfig();
      } else {
        toast({ title: "Error", description: data.error || "No se pudo actualizar", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const purgeQueue = async () => {
    setPurging(true);
    try {
      const res = await apiRequest("POST", "/api/admin/gpu/purge-queue");
      const data = await res.json();
      toast({ title: "Cola Purgada", description: `${data.purged || 0} jobs eliminados de la cola.` });
      loadConfig();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPurging(false);
    }
  };

  const anyBusy = loading || saving || purging;
  const health = config?.health;
  const hasUnhealthy = health?.unhealthy > 0;
  const hasQueued = health?.queued > 0;

  return (
    <Card data-testid="card-endpoint-config">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">RunPod Serverless</CardTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={loadConfig} disabled={anyBusy} data-testid="button-load-endpoint-config">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Estado
            </Button>
            {hasQueued && (
              <Button size="sm" variant="outline" onClick={purgeQueue} disabled={anyBusy} data-testid="button-purge-queue">
                {purging ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Purgar Cola
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          Configuracion del endpoint serverless, workers y GPU
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!config ? (
          <div className="text-center py-4 text-muted-foreground">
            <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Pulsa &quot;Estado&quot; para ver la configuracion del endpoint.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {config.error && (
              <div className="text-sm text-red-500 border border-red-500/20 rounded-md p-2">
                {config.error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="border rounded-md p-3 space-y-1">
                <span className="text-xs text-muted-foreground">Endpoint ID</span>
                <p className="text-sm font-mono">{config.endpointId || "N/A"}</p>
              </div>
              <div className="border rounded-md p-3 space-y-1">
                <span className="text-xs text-muted-foreground">GPU</span>
                <p className="text-sm font-mono">{config.gpuIds || "N/A"}</p>
              </div>
              <div className="border rounded-md p-3 space-y-1">
                <span className="text-xs text-muted-foreground">Workers (min / max)</span>
                <p className="text-sm font-mono">{config.minWorkers} / {config.maxWorkers}</p>
              </div>
              <div className="border rounded-md p-3 space-y-1">
                <span className="text-xs text-muted-foreground">Idle Timeout</span>
                <p className="text-sm font-mono">{config.idleTimeout}s</p>
              </div>
            </div>

            {health && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="border rounded-md p-3 space-y-1">
                  <span className="text-xs text-muted-foreground">Workers Activos</span>
                  <p className="text-sm font-medium">{health.workers || 0}</p>
                </div>
                <div className="border rounded-md p-3 space-y-1">
                  <span className="text-xs text-muted-foreground">En Cola</span>
                  <p className={`text-sm font-medium ${health.queued > 0 ? "text-orange-500" : ""}`}>{health.queued || 0}</p>
                </div>
                <div className="border rounded-md p-3 space-y-1">
                  <span className="text-xs text-muted-foreground">No Saludables</span>
                  <p className={`text-sm font-medium ${health.unhealthy > 0 ? "text-red-500" : "text-green-500"}`}>{health.unhealthy || 0}</p>
                </div>
                <div className="border rounded-md p-3 space-y-1">
                  <span className="text-xs text-muted-foreground">Estado</span>
                  <div className="flex items-center gap-1">
                    {health.healthy ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">{health.healthy ? "Saludable" : "No Saludable"}</span>
                  </div>
                </div>
              </div>
            )}

            {hasUnhealthy && (
              <div className="text-xs border border-orange-500/20 rounded-md p-2 space-y-1">
                <p className="font-medium text-orange-500">Workers no saludables detectados</p>
                <p className="text-muted-foreground">
                  Posibles causas: handler.py desactualizado en el volume, dependencias rotas, o GPU sin stock.
                  Intenta: 1) Purgar la cola, 2) Actualizar handler.py en el volume, 3) Eliminar /runpod-volume/.deps_installed_v4 para forzar reinstalacion.
                </p>
              </div>
            )}

            <div className="border rounded-md p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Ajustar Configuracion</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Max Workers</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={config.maxWorkers || 3}
                      className="text-sm"
                      data-testid="input-max-workers"
                      id="input-max-workers"
                    />
                    <Button size="sm" variant="outline" disabled={anyBusy}
                      data-testid="button-save-max-workers"
                      onClick={() => {
                        const el = document.getElementById("input-max-workers") as HTMLInputElement;
                        if (el) saveConfig({ maxWorkers: parseInt(el.value) });
                      }}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">GPU IDs</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      defaultValue={config.gpuIds || ""}
                      placeholder="AMPERE_48,ADA_48_PRO"
                      className="text-sm"
                      data-testid="input-gpu-ids"
                      id="input-gpu-ids"
                    />
                    <Button size="sm" variant="outline" disabled={anyBusy}
                      data-testid="button-save-gpu-ids"
                      onClick={() => {
                        const el = document.getElementById("input-gpu-ids") as HTMLInputElement;
                        if (el) saveConfig({ gpuIds: el.value });
                      }}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Codigos GPU: AMPERE_16 (A4000), AMPERE_24 (RTX3090/A5000), AMPERE_48 (A40/A6000), AMPERE_80 (A100), ADA_24 (L4/4090), ADA_48_PRO (L40S)</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Idle Timeout (seg)</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={30}
                      max={3600}
                      defaultValue={config.idleTimeout || 300}
                      className="text-sm"
                      data-testid="input-idle-timeout"
                      id="input-idle-timeout"
                    />
                    <Button size="sm" variant="outline" disabled={anyBusy}
                      data-testid="button-save-idle-timeout"
                      onClick={() => {
                        const el = document.getElementById("input-idle-timeout") as HTMLInputElement;
                        if (el) saveConfig({ idleTimeout: parseInt(el.value) });
                      }}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateDatasetView({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState("custom");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/training-datasets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-datasets"] });
      toast({ title: "Dataset creado", description: "El dataset de entrenamiento fue creado exitosamente." });
      onBack();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4" data-testid="create-dataset-view">
      <Button variant="outline" size="sm" onClick={onBack} data-testid="button-back-datasets">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Crear Nuevo Dataset</CardTitle>
          <CardDescription>Define un nuevo dataset para entrenamiento del modelo SAO Instrumental</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Bachata Classics MIDI Collection"
              data-testid="input-dataset-name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Descripcion</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripcion del dataset..."
              data-testid="input-dataset-description"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Fuente</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "custom", label: "Custom Upload" },
                { id: "lakh_clean", label: "Lakh MIDI (Clean)" },
                { id: "million_song", label: "Million Song Dataset" },
                { id: "midi_dataset", label: "craffel/midi-dataset" },
              ].map((src) => (
                <Button
                  key={src.id}
                  variant={sourceType === src.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSourceType(src.id)}
                  className="toggle-elevate"
                  data-testid={`button-source-${src.id}`}
                >
                  {src.label}
                </Button>
              ))}
            </div>
            {sourceType === "million_song" && (
              <div className="mt-3 border rounded-md p-3 space-y-2 bg-muted/30" data-testid="msd-info-panel">
                <p className="text-xs font-medium text-primary">Million Song Dataset (MSD)</p>
                <p className="text-xs text-muted-foreground">300GB con instrumentos pre-entrenados y MIDIs via Lakh mapping.</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">AWS Snapshot:</span>
                    <span className="ml-1 font-mono">snap-5178cf30</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Subset:</span>
                    <span className="ml-1">10K songs (1.8 GB)</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Full:</span>
                    <span className="ml-1">272 GB (us-east-1)</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Formato:</span>
                    <span className="ml-1">HDF5 + SQLite</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Incluye: vectores timbre/chroma 12-dim por beat, metadata artistas, tags, similaridad, año.</p>
              </div>
            )}
          </div>
          <Button
            onClick={() => createMutation.mutate({ name, description, sourceType })}
            disabled={!name || createMutation.isPending}
            data-testid="button-submit-dataset"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Crear Dataset
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function DatasetDetailView({ id, onBack }: { id: number; onBack: () => void }) {
  const [fileFilter, setFileFilter] = useState<string>("");
  const [uploadExpanded, setUploadExpanded] = useState(false);
  const { toast } = useToast();

  const { data: dataset, isLoading } = useQuery<TrainingDataset & { files: TrainingFile[] }>({
    queryKey: ["/api/admin/training-datasets", id],
  });

  const { data: pipelineInfo } = useQuery<any>({
    queryKey: ["/api/admin/training-pipeline-info"],
  });

  const triggerStepMutation = useMutation({
    mutationFn: async (step: string) => {
      const res = await apiRequest("POST", `/api/admin/training-datasets/${id}/trigger-step`, { step });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-datasets", id] });
      toast({ title: "Step iniciado", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/admin/training-datasets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-datasets"] });
      toast({ title: "Dataset eliminado" });
      onBack();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      await apiRequest("DELETE", `/api/admin/training-files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-datasets", id] });
      toast({ title: "Archivo eliminado" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Dataset no encontrado.</p>
        <Button variant="outline" onClick={onBack} className="mt-2">Volver</Button>
      </div>
    );
  }

  const stepFields: Record<string, string> = {
    clean_midi: dataset.stepCleanMidi || "pending",
    metadata: dataset.stepMetadata || "pending",
    prompts: dataset.stepPrompts || "pending",
    rendering: dataset.stepRendering || "pending",
  };

  const files = dataset.files || [];
  const filteredFiles = fileFilter
    ? files.filter((f) => f.fileType === fileFilter)
    : files;

  return (
    <div className="space-y-4" data-testid="dataset-detail-view">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack} data-testid="button-back-detail">
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} data-testid="button-delete-dataset">
          <Trash2 className="h-4 w-4 mr-1" /> Eliminar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base">{dataset.name}</CardTitle>
              {dataset.description && <CardDescription>{dataset.description}</CardDescription>}
            </div>
            <Badge variant={dataset.sourceType === "million_song" ? "default" : "outline"}>{dataset.sourceType === "million_song" ? "MSD" : dataset.sourceType}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="border rounded-md p-3">
              <p className="text-xs text-muted-foreground">MIDI Files</p>
              <p className="text-lg font-semibold" data-testid="text-midi-count">{dataset.midiFileCount || 0}</p>
            </div>
            <div className="border rounded-md p-3">
              <p className="text-xs text-muted-foreground">Prompts</p>
              <p className="text-lg font-semibold" data-testid="text-prompt-count">{dataset.promptFileCount || 0}</p>
            </div>
            <div className="border rounded-md p-3">
              <p className="text-xs text-muted-foreground">Renders</p>
              <p className="text-lg font-semibold" data-testid="text-render-count">{dataset.renderFileCount || 0}</p>
            </div>
            <div className="border rounded-md p-3">
              <p className="text-xs text-muted-foreground">Total Size</p>
              <p className="text-lg font-semibold" data-testid="text-total-size">{formatBytes(dataset.totalSizeBytes || 0)}</p>
            </div>
          </div>

          {dataset.sourceType === "million_song" && (
            <div className="border rounded-md p-3 space-y-2 bg-muted/30" data-testid="msd-detail-panel">
              <p className="text-sm font-medium text-primary">Million Song Dataset</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">AWS Snapshot:</span>
                  <span className="ml-1 font-mono">snap-5178cf30</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Region:</span>
                  <span className="ml-1">us-east-1</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Full Size:</span>
                  <span className="ml-1">272 GB</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Subset:</span>
                  <span className="ml-1">10K songs (1.8 GB)</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Formato:</span>
                  <span className="ml-1">HDF5 + SQLite</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Lakh Mapping:</span>
                  <span className="ml-1">178K MIDIs</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Instrumentos pre-entrenados: vectores timbre/chroma 12-dim por beat, artist terms, MusicBrainz tags, similaridad, geo data.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Pipeline Steps</CardTitle>
          </div>
          <CardDescription>Ejecutar pasos del pipeline en el Cloud GPU</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {pipelineInfo?.pipeline?.map((step: any, i: number) => {
              const status = stepFields[step.id] || "pending";
              return (
                <div key={step.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono bg-muted rounded-full w-5 h-5 flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm font-medium">{step.name}</span>
                    </div>
                    <StepBadge status={status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                  <Button
                    size="sm"
                    variant={status === "completed" ? "outline" : "default"}
                    className="w-full"
                    disabled={triggerStepMutation.isPending || status === "running"}
                    onClick={() => triggerStepMutation.mutate(step.id)}
                    data-testid={`button-trigger-${step.id}`}
                  >
                    {status === "running" ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Play className="h-3 w-3 mr-1" />
                    )}
                    {status === "running" ? "Procesando..." : status === "completed" ? "Re-ejecutar" : "Ejecutar"}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Archivos ({files.length})</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {["", "midi", "audio", "prompt", "render"].map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant={fileFilter === type ? "default" : "outline"}
                    onClick={() => setFileFilter(type)}
                    data-testid={`button-filter-${type || "all"}`}
                  >
                    {type || "Todos"}
                  </Button>
                ))}
              </div>
              <Button size="sm" onClick={() => setUploadExpanded(!uploadExpanded)} data-testid="button-toggle-upload">
                <Upload className="h-4 w-4 mr-1" /> Subir
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {uploadExpanded && (
            <UploadSection datasetId={id} onUploaded={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/admin/training-datasets", id] });
              setUploadExpanded(false);
            }} />
          )}

          {filteredFiles.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay archivos{fileFilter ? ` de tipo "${fileFilter}"` : ""}.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {filteredFiles.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 border rounded-md p-2 text-sm" data-testid={`file-row-${f.id}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {f.fileType === "midi" ? <Music className="h-4 w-4 text-blue-500 shrink-0" /> :
                     f.fileType === "prompt" ? <FileText className="h-4 w-4 text-yellow-500 shrink-0" /> :
                     <Play className="h-4 w-4 text-green-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{f.fileName}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {f.artistName && <span>{f.artistName}</span>}
                        {f.songName && <span>- {f.songName}</span>}
                        {f.instrumentCode != null && <span>Code: {f.instrumentCode}</span>}
                        {f.fileSize ? <span>{formatBytes(f.fileSize)}</span> : null}
                      </div>
                      {f.promptText && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{f.promptText}</p>}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteFileMutation.mutate(f.id)}
                    disabled={deleteFileMutation.isPending}
                    data-testid={`button-delete-file-${f.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {dataset.errorLog && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive">Error Log</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap" data-testid="text-error-log">
              {dataset.errorLog}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UploadSection({ datasetId, onUploaded }: { datasetId: number; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [artistName, setArtistName] = useState("");
  const [songName, setSongName] = useState("");
  const { toast } = useToast();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);
      if (artistName) formData.append("artistName", artistName);
      if (songName) formData.append("songName", songName);

      try {
        const res = await fetch(`/api/admin/training-datasets/${datasetId}/files`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (res.ok) successCount++;
      } catch {
        // continue with rest
      }
    }

    setUploading(false);
    toast({
      title: `${successCount}/${files.length} archivos subidos`,
      description: successCount === files.length ? "Todos los archivos fueron subidos exitosamente." : "Algunos archivos fallaron.",
      variant: successCount > 0 ? "default" : "destructive",
    });
    onUploaded();
  }

  return (
    <div className="border rounded-md p-3 space-y-3 bg-muted/30" data-testid="upload-section">
      <p className="text-sm font-medium">Subir archivos MIDI / Audio</p>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Artista (opcional)" value={artistName} onChange={(e) => setArtistName(e.target.value)} data-testid="input-upload-artist" />
        <Input placeholder="Cancion (opcional)" value={songName} onChange={(e) => setSongName(e.target.value)} data-testid="input-upload-song" />
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept=".mid,.midi,.wav,.mp3,.flac,.ogg,.m4a,.aiff,.json"
          multiple
          onChange={handleUpload}
          disabled={uploading}
          data-testid="input-upload-file"
        />
        {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
      <p className="text-xs text-muted-foreground">
        Formatos soportados: MIDI (.mid, .midi), Audio (.wav, .mp3, .flac), Prompts (.json). Se pueden subir multiples archivos.
      </p>
    </div>
  );
}
