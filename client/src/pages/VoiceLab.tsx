import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import {
  useVoiceModels,
  useVoiceModel,
  useCreateVoiceModel,
  useUpdateVoiceModel,
  useDeleteVoiceModel,
  useUploadVoiceSample,
  useTrainVoiceModel,
  useStyleReferences,
  useUploadStyleReference,
  useDeleteStyleReference,
} from "@/hooks/use-voice-models";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Mic,
  Upload,
  Plus,
  Trash2,
  Play,
  Pause,
  Music,
  Brain,
  Globe,
  Lock,
  ChevronRight,
  Loader2,
  FileAudio,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function VoiceLab() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: voiceModels, isLoading } = useVoiceModels();
  const { data: styleRefs, isLoading: refsLoading } = useStyleReferences();
  const createModel = useCreateVoiceModel();
  const deleteModel = useDeleteVoiceModel();
  const updateModel = useUpdateVoiceModel();
  const uploadSample = useUploadVoiceSample();
  const trainModel = useTrainVoiceModel();
  const uploadRef = useUploadStyleReference();
  const deleteRef = useDeleteStyleReference();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [newModel, setNewModel] = useState({
    name: "",
    description: "",
    type: "uploaded" as string,
    provider: "custom" as string,
    gender: "" as string,
    language: "es",
    tags: "",
    externalVoiceId: "",
  });

  const sampleInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const handleCreateModel = () => {
    if (!newModel.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    createModel.mutate(
      {
        name: newModel.name,
        description: newModel.description || undefined,
        type: newModel.type,
        provider: newModel.provider,
        gender: newModel.gender || undefined,
        language: newModel.language,
        tags: newModel.tags || undefined,
        externalVoiceId: newModel.externalVoiceId || undefined,
      },
      {
        onSuccess: () => {
          toast({ title: "Voice model created" });
          setShowCreateForm(false);
          setNewModel({ name: "", description: "", type: "uploaded", provider: "custom", gender: "", language: "es", tags: "", externalVoiceId: "" });
        },
        onError: (err: any) => {
          toast({ title: "Failed to create model", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const handleUploadSample = (modelId: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      uploadSample.mutate(
        { voiceModelId: modelId, file, name: file.name },
        {
          onSuccess: () => toast({ title: `Sample "${file.name}" uploaded` }),
          onError: (err: any) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
        }
      );
    });
  };

  const handleUploadRef = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    uploadRef.mutate(
      { file, name: file.name },
      {
        onSuccess: () => toast({ title: `Reference "${file.name}" uploaded` }),
        onError: (err: any) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
      }
    );
  };

  const toggleAudio = (url: string) => {
    if (playingAudio === url) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      audioRef.current = audio;
      setPlayingAudio(url);
    }
  };

  const selectedModel = selectedModelId ? voiceModels?.find((m) => m.id === selectedModelId) : null;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-voicelab-title">{t('voiceLab.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('voiceLab.subtitle')}
          </p>
        </div>
      </div>

      <Tabs defaultValue="voices" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="voices" data-testid="tab-voices">
            <Mic className="h-4 w-4 mr-1.5" /> {t('voiceLab.voiceModels')}
          </TabsTrigger>
          <TabsTrigger value="references" data-testid="tab-references">
            <Music className="h-4 w-4 mr-1.5" /> {t('voiceLab.styleReferences')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="voices" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('voiceLab.voiceModelsDesc')}
            </p>
            <Button
              size="sm"
              onClick={() => setShowCreateForm(!showCreateForm)}
              data-testid="button-add-voice"
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('voiceLab.addVoice')}
            </Button>
          </div>

          <AnimatePresence>
            {showCreateForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Card className="p-4 space-y-3 border-primary/20">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('voiceLab.voiceName')} *</Label>
                      <Input
                        placeholder="e.g. Mi Voz Bachata"
                        value={newModel.name}
                        onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                        data-testid="input-voice-name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('voiceLab.type')}</Label>
                      <Select value={newModel.type} onValueChange={(v) => setNewModel({ ...newModel, type: v })}>
                        <SelectTrigger data-testid="select-voice-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="uploaded">{t('voiceLab.pretrained')}</SelectItem>
                          <SelectItem value="trained">{t('voiceLab.trainFromSamples')}</SelectItem>
                          <SelectItem value="cloned">{t('voiceLab.voiceClone')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('voiceLab.provider')}</Label>
                      <Select value={newModel.provider} onValueChange={(v) => setNewModel({ ...newModel, provider: v })}>
                        <SelectTrigger data-testid="select-voice-provider">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Custom / Own Model</SelectItem>
                          <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                          <SelectItem value="rvc">RVC (Retrieval Voice)</SelectItem>
                          <SelectItem value="so-vits">So-VITS-SVC</SelectItem>
                          <SelectItem value="openvoice">OpenVoice</SelectItem>
                          <SelectItem value="cloud_gpu">Cloud GPU Training</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('voiceLab.gender')}</Label>
                      <Select value={newModel.gender} onValueChange={(v) => setNewModel({ ...newModel, gender: v })}>
                        <SelectTrigger data-testid="select-voice-gender">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">{t('voiceLab.male')}</SelectItem>
                          <SelectItem value="female">{t('voiceLab.female')}</SelectItem>
                          <SelectItem value="neutral">{t('voiceLab.neutral')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Language</Label>
                      <Select value={newModel.language} onValueChange={(v) => setNewModel({ ...newModel, language: v })}>
                        <SelectTrigger data-testid="select-voice-language">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="pt">Portuguese</SelectItem>
                          <SelectItem value="multi">Multilingual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('voiceLab.externalVoiceId')}</Label>
                      <Input
                        placeholder={t('voiceLab.externalVoiceIdPlaceholder')}
                        value={newModel.externalVoiceId}
                        onChange={(e) => setNewModel({ ...newModel, externalVoiceId: e.target.value })}
                        data-testid="input-voice-external-id"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('voiceLab.description')}</Label>
                    <Textarea
                      placeholder={t('voiceLab.descriptionPlaceholder')}
                      value={newModel.description}
                      onChange={(e) => setNewModel({ ...newModel, description: e.target.value })}
                      className="h-16 resize-none"
                      data-testid="input-voice-description"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('voiceLab.tags')}</Label>
                    <Input
                      placeholder={t('voiceLab.tagsPlaceholder')}
                      value={newModel.tags}
                      onChange={(e) => setNewModel({ ...newModel, tags: e.target.value })}
                      data-testid="input-voice-tags"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)} data-testid="button-cancel-voice">
                      {t('common.cancel')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateModel}
                      disabled={createModel.isPending}
                      data-testid="button-save-voice"
                    >
                      {createModel.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                      {t('voiceLab.createVoiceModel')}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !voiceModels || voiceModels.length === 0 ? (
            <Card className="p-8 text-center">
              <Mic className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="font-semibold mb-1">{t('voiceLab.noVoiceModels')}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('voiceLab.noVoiceModelsDesc')}
              </p>
              <Button size="sm" onClick={() => setShowCreateForm(true)} data-testid="button-first-voice">
                <Plus className="h-4 w-4 mr-1" /> {t('voiceLab.addFirstVoice')}
              </Button>
            </Card>
          ) : (
            <div className="grid gap-3">
              {voiceModels.map((model) => (
                <VoiceModelCard
                  key={model.id}
                  model={model}
                  isSelected={selectedModelId === model.id}
                  onSelect={() => setSelectedModelId(selectedModelId === model.id ? null : model.id)}
                  onDelete={() => {
                    deleteModel.mutate(model.id, {
                      onSuccess: () => {
                        toast({ title: "Voice model deleted" });
                        if (selectedModelId === model.id) setSelectedModelId(null);
                      },
                    });
                  }}
                  onTogglePublic={() => {
                    updateModel.mutate({
                      id: model.id,
                      isPublic: !model.isPublic,
                    });
                  }}
                  onUploadSample={(files) => handleUploadSample(model.id, files)}
                  onTrain={() => {
                    trainModel.mutate(model.id, {
                      onSuccess: () => toast({ title: "Voice training started" }),
                      onError: (err: any) => toast({ title: "Training failed", description: err.message, variant: "destructive" }),
                    });
                  }}
                  isTraining={trainModel.isPending}
                  playingAudio={playingAudio}
                  onToggleAudio={toggleAudio}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="references" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('voiceLab.styleRefsDesc')}
            </p>
            <Button
              size="sm"
              onClick={() => refInputRef.current?.click()}
              disabled={uploadRef.isPending}
              data-testid="button-add-reference"
            >
              {uploadRef.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              {t('voiceLab.uploadReference')}
            </Button>
            <input
              ref={refInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => handleUploadRef(e.target.files)}
            />
          </div>

          {refsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !styleRefs || styleRefs.length === 0 ? (
            <Card className="p-8 text-center">
              <Music className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="font-semibold mb-1">{t('voiceLab.noStyleRefs')}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('voiceLab.noStyleRefsDesc')}
              </p>
              <Button size="sm" onClick={() => refInputRef.current?.click()} data-testid="button-first-reference">
                <Upload className="h-4 w-4 mr-1" /> {t('voiceLab.uploadFirstRef')}
              </Button>
            </Card>
          ) : (
            <div className="grid gap-2">
              {styleRefs.map((ref) => (
                <Card key={ref.id} className="p-3 flex items-center gap-3" data-testid={`card-reference-${ref.id}`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => ref.audioUrl && toggleAudio(ref.audioUrl)}
                    data-testid={`button-play-ref-${ref.id}`}
                  >
                    {playingAudio === ref.audioUrl ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`text-ref-name-${ref.id}`}>{ref.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {ref.detectedGenre && <Badge variant="outline" className="text-[10px]">{ref.detectedGenre}</Badge>}
                      {ref.detectedBpm && <span>{ref.detectedBpm} BPM</span>}
                      {ref.detectedKey && <span>Key: {ref.detectedKey}</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive/60 hover:text-destructive"
                    onClick={() => deleteRef.mutate(ref.id, { onSuccess: () => toast({ title: "Reference deleted" }) })}
                    data-testid={`button-delete-ref-${ref.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VoiceModelCard({
  model,
  isSelected,
  onSelect,
  onDelete,
  onTogglePublic,
  onUploadSample,
  onTrain,
  isTraining,
  playingAudio,
  onToggleAudio,
}: {
  model: any;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onTogglePublic: () => void;
  onUploadSample: (files: FileList | null) => void;
  onTrain: () => void;
  isTraining: boolean;
  playingAudio: string | null;
  onToggleAudio: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: modelDetail } = useVoiceModel(isSelected ? model.id : 0);

  const statusColor = {
    ready: "bg-green-500/15 text-green-400 border-green-500/20",
    pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    training: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    failed: "bg-red-500/15 text-red-400 border-red-500/20",
  }[model.trainingStatus] || "bg-muted text-muted-foreground";

  const providerLabel = {
    custom: "Custom",
    elevenlabs: "ElevenLabs",
    rvc: "RVC",
    "so-vits": "So-VITS",
    openvoice: "OpenVoice",
    cloud_gpu: "Cloud GPU",
  }[model.provider] || model.provider;

  return (
    <Card
      className={cn(
        "transition-all cursor-pointer",
        isSelected ? "border-primary/30 bg-primary/5" : "border-white/5 hover:border-white/10"
      )}
      data-testid={`card-voice-${model.id}`}
    >
      <div className="p-3 flex items-center gap-3" onClick={onSelect}>
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-blue-600/20 flex items-center justify-center shrink-0">
          <Mic className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate" data-testid={`text-voice-name-${model.id}`}>{model.name}</p>
            <Badge variant="outline" className={cn("text-[10px]", statusColor)}>
              {model.trainingStatus}
            </Badge>
            {model.isPublic ? (
              <Globe className="h-3 w-3 text-muted-foreground" />
            ) : (
              <Lock className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>{providerLabel}</span>
            {model.gender && <span>({model.gender})</span>}
            {model.language && <span>lang: {model.language}</span>}
          </div>
        </div>
        <ChevronRight className={cn("h-4 w-4 transition-transform text-muted-foreground", isSelected && "rotate-90")} />
      </div>

      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">
              {model.description && (
                <p className="text-xs text-muted-foreground">{model.description}</p>
              )}
              {model.externalVoiceId && (
                <p className="text-xs text-muted-foreground">External ID: {model.externalVoiceId}</p>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Training Samples</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                    data-testid={`button-upload-sample-${model.id}`}
                  >
                    <Upload className="h-3 w-3 mr-1" /> Upload Sample
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="audio/*"
                    multiple
                    className="hidden"
                    onChange={(e) => onUploadSample(e.target.files)}
                  />
                </div>

                {modelDetail?.samples && modelDetail.samples.length > 0 ? (
                  <div className="space-y-1">
                    {modelDetail.samples.map((sample: any) => (
                      <div
                        key={sample.id}
                        className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1.5"
                        data-testid={`sample-${sample.id}`}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); sample.audioUrl && onToggleAudio(sample.audioUrl); }}
                        >
                          {playingAudio === sample.audioUrl ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        </Button>
                        <FileAudio className="h-3 w-3 text-muted-foreground" />
                        <span className="flex-1 truncate">{sample.name}</span>
                        <Badge variant="outline" className="text-[10px]">{sample.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No samples uploaded yet</p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {model.type !== "uploaded" && (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); onTrain(); }}
                    disabled={isTraining || model.trainingStatus === "training"}
                    data-testid={`button-train-${model.id}`}
                  >
                    {model.trainingStatus === "training" ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Brain className="h-3 w-3 mr-1" />
                    )}
                    {model.trainingStatus === "training" ? "Training..." : "Train Voice"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={(e) => { e.stopPropagation(); onTogglePublic(); }}
                  data-testid={`button-toggle-public-${model.id}`}
                >
                  {model.isPublic ? <Globe className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                  {model.isPublic ? "Public" : "Private"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive/60 hover:text-destructive ml-auto"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  data-testid={`button-delete-voice-${model.id}`}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>

              {model.trainingError && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded p-2">{model.trainingError}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
