import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  Plus,
  Music,
  FileText,
  Download,
  Trash2,
  Edit,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  ArrowRight,
  ArrowLeft,
  Loader2,
  X,
  Send,
  ChevronRight,
} from "lucide-react";

interface Contributor {
  name: string;
  role: string;
  ipiNumber: string;
  proEntity: string;
  sharePercent: number;
  email: string;
}

interface WorkDetails {
  songId: number | null;
  workType: string;
  title: string;
  alternativeTitles: string;
  language: string;
  genre: string;
  copyrightYear: number;
  duration: string;
  isrcCode: string;
  iswcCode: string;
  publisher: string;
  publisherShare: number;
  proEntity: string;
}

const PRO_ENTITIES = ["ASCAP", "BMI", "SESAC", "SOCAN", "PRS", "GEMA", "SGAE"];
const CONTRIBUTOR_ROLES = ["writer", "composer", "lyricist", "arranger"];

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  submitted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  registered: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

const WORK_TYPE_STYLES: Record<string, string> = {
  composition: "bg-[#00C8FF]/20 text-[#00C8FF] border-[#00C8FF]/30",
  sound_recording: "bg-[#D946EF]/20 text-[#D946EF] border-[#D946EF]/30",
  both: "bg-gradient-to-r from-[#00C8FF]/20 to-[#D946EF]/20 text-white border-[#D946EF]/30",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

function WorkCard({ work, onDelete, t }: { work: any; onDelete: (id: number) => void; t: any }) {
  const handleExport = async () => {
    try {
      const res = await fetch(`/api/copyright/works/${work.id}/export`, { credentials: "include" });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `copyright_${work.title?.replace(/\s+/g, "_") || work.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  return (
    <Card className="bg-white/[0.03] border-white/[0.06] p-4" data-testid={`card-work-${work.id}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base truncate" data-testid={`text-work-title-${work.id}`}>{work.title}</h3>
            <Badge variant="outline" className={WORK_TYPE_STYLES[work.workType] || WORK_TYPE_STYLES.composition}>
              {t(`copyright.workType.${work.workType}`)}
            </Badge>
            <Badge variant="outline" className={STATUS_STYLES[work.status] || STATUS_STYLES.draft}>
              {t(`copyright.status.${work.status}`)}
            </Badge>
          </div>
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
            {work.publisher && <span>{work.publisher}</span>}
            {work.proEntity && <span>{work.proEntity}</span>}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {work.contributors?.length || 0} {t("copyright.contributors")}
            </span>
            {work.createdAt && <span>{formatDate(work.createdAt)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" data-testid={`button-edit-work-${work.id}`}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleExport} data-testid={`button-export-work-${work.id}`}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(work.id)} data-testid={`button-delete-work-${work.id}`}>
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DashboardTab({ t }: { t: any }) {
  const { data: works, isLoading } = useQuery<any[]>({
    queryKey: ["/api/copyright/works"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/copyright/works/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/copyright/works"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-white/[0.03] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!works || works.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00C8FF]/20 to-[#D946EF]/20 mx-auto flex items-center justify-center mb-4">
          <Shield className="h-8 w-8 text-[#00C8FF]/60" />
        </div>
        <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-state">{t("copyright.emptyState.title")}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">{t("copyright.emptyState.description")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {works.map((work: any) => (
        <WorkCard key={work.id} work={work} onDelete={(id) => deleteMutation.mutate(id)} t={t} />
      ))}
    </div>
  );
}

function StepIndicator({ currentStep, t }: { currentStep: number; t: any }) {
  const steps = [
    { key: "selectSong", num: 1 },
    { key: "workDetails", num: 2 },
    { key: "contributors", num: 3 },
    { key: "review", num: 4 },
  ];
  return (
    <div className="flex items-center gap-2 mb-6" data-testid="step-indicator">
      {steps.map((step, idx) => (
        <div key={step.key} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              currentStep === step.num
                ? "bg-[#00C8FF] text-black"
                : currentStep > step.num
                ? "bg-green-500/30 text-green-400"
                : "bg-white/[0.06] text-muted-foreground"
            }`}
            data-testid={`step-${step.num}`}
          >
            {currentStep > step.num ? <CheckCircle className="h-4 w-4" /> : step.num}
          </div>
          <span className={`text-xs hidden sm:inline ${currentStep === step.num ? "text-[#00C8FF] font-medium" : "text-muted-foreground"}`}>
            {t(`copyright.steps.${step.key}`)}
          </span>
          {idx < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}

function RegisterWizard({ t }: { t: any }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const [workDetails, setWorkDetails] = useState<WorkDetails>({
    songId: null,
    workType: "both",
    title: "",
    alternativeTitles: "",
    language: "es",
    genre: "",
    copyrightYear: new Date().getFullYear(),
    duration: "",
    isrcCode: "",
    iswcCode: "",
    publisher: "DGB Publishing",
    publisherShare: 50,
    proEntity: "",
  });

  const [contributors, setContributors] = useState<Contributor[]>([
    {
      name: user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "",
      role: "writer",
      ipiNumber: "",
      proEntity: "",
      sharePercent: 100,
      email: "",
    },
  ]);

  const { data: songs, isLoading: songsLoading } = useQuery<any[]>({
    queryKey: ["/api/copyright/songs"],
  });

  const { data: works } = useQuery<any[]>({
    queryKey: ["/api/copyright/works"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/copyright/works", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/copyright/works"] });
      setSubmitted(true);
      toast({ title: t("copyright.toast.created"), description: t("copyright.toast.createdDesc") });
    },
    onError: (error: Error) => {
      toast({ title: t("copyright.toast.error"), description: error.message, variant: "destructive" });
    },
  });

  const registeredSongIds = new Set((works || []).map((w: any) => w.songId).filter(Boolean));

  const totalSharePercent = contributors.reduce((sum, c) => sum + (c.sharePercent || 0), 0);

  const selectSong = (song: any) => {
    setWorkDetails((prev) => ({
      ...prev,
      songId: song.id,
      title: song.title || prev.title,
      genre: song.genre || prev.genre,
      duration: song.duration ? String(song.duration) : prev.duration,
    }));
    setCurrentStep(2);
  };

  const handleManualEntry = () => {
    setWorkDetails((prev) => ({ ...prev, songId: null }));
    setCurrentStep(2);
  };

  const addContributor = () => {
    setContributors((prev) => [
      ...prev,
      { name: "", role: "writer", ipiNumber: "", proEntity: "", sharePercent: 0, email: "" },
    ]);
  };

  const removeContributor = (idx: number) => {
    setContributors((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateContributor = (idx: number, field: keyof Contributor, value: string | number) => {
    setContributors((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const handleSubmit = () => {
    createMutation.mutate({
      ...workDetails,
      contributors,
    });
  };

  const handleExportJson = () => {
    const data = { ...workDetails, contributors };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `copyright_registration_${workDetails.title?.replace(/\s+/g, "_") || "work"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (submitted) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-500/20 mx-auto flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-green-400" />
        </div>
        <h3 className="text-xl font-bold" data-testid="text-success-title">{t("copyright.success.title")}</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{t("copyright.success.description")}</p>
        <Card className="bg-white/[0.03] border-white/[0.06] p-4 max-w-md mx-auto text-left">
          <h4 className="text-sm font-semibold mb-2">{t("copyright.success.nextSteps")}</h4>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li className="flex items-start gap-2">
              <ChevronRight className="h-3 w-3 mt-0.5 text-[#00C8FF]" />
              {t("copyright.success.step1")}
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-3 w-3 mt-0.5 text-[#00C8FF]" />
              {t("copyright.success.step2")}
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="h-3 w-3 mt-0.5 text-[#00C8FF]" />
              {t("copyright.success.step3")}
            </li>
          </ul>
        </Card>
        <Button
          onClick={() => {
            setSubmitted(false);
            setCurrentStep(1);
            setWorkDetails({
              songId: null,
              workType: "both",
              title: "",
              alternativeTitles: "",
              language: "es",
              genre: "",
              copyrightYear: new Date().getFullYear(),
              duration: "",
              isrcCode: "",
              iswcCode: "",
              publisher: "DGB Publishing",
              publisherShare: 50,
              proEntity: "",
            });
            setContributors([
              {
                name: user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "",
                role: "writer",
                ipiNumber: "",
                proEntity: "",
                sharePercent: 100,
                email: "",
              },
            ]);
          }}
          data-testid="button-register-another"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t("copyright.success.registerAnother")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <StepIndicator currentStep={currentStep} t={t} />

      {currentStep === 1 && (
        <div className="space-y-3" data-testid="step-select-song">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Music className="h-4 w-4 text-[#00C8FF]" />
              {t("copyright.step1.title")}
            </h3>
            <Button variant="outline" size="sm" onClick={handleManualEntry} data-testid="button-manual-entry">
              <FileText className="h-4 w-4 mr-1" />
              {t("copyright.step1.manualEntry")}
            </Button>
          </div>

          {songsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/[0.03] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !songs || songs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Music className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t("copyright.step1.noSongs")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {songs.map((song: any) => {
                const isRegistered = registeredSongIds.has(song.id);
                return (
                  <Card
                    key={song.id}
                    className={`bg-white/[0.03] border-white/[0.06] p-3 cursor-pointer transition-all ${
                      workDetails.songId === song.id ? "border-[#00C8FF]/50 bg-[#00C8FF]/5" : ""
                    }`}
                    onClick={() => selectSong(song)}
                    data-testid={`card-song-${song.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#00C8FF]/20 to-[#D946EF]/20 flex items-center justify-center flex-shrink-0">
                          <Music className="h-5 w-5 text-[#00C8FF]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" data-testid={`text-song-title-${song.id}`}>{song.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {song.genre && <span>{song.genre}</span>}
                            {song.duration && <span>{Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, "0")}</span>}
                          </div>
                        </div>
                      </div>
                      {isRegistered && (
                        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 flex-shrink-0">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {t("copyright.step1.registered")}
                        </Badge>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-4" data-testid="step-work-details">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#00C8FF]" />
            {t("copyright.step2.title")}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {["composition", "sound_recording", "both"].map((type) => (
              <button
                key={type}
                className={`p-3 rounded-lg border text-left transition-all ${
                  workDetails.workType === type
                    ? "border-[#00C8FF]/50 bg-[#00C8FF]/10"
                    : "border-white/10 bg-white/[0.02]"
                }`}
                onClick={() => setWorkDetails((p) => ({ ...p, workType: type }))}
                data-testid={`button-worktype-${type}`}
              >
                <p className="text-sm font-medium">{t(`copyright.workType.${type}`)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t(`copyright.workTypeDesc.${type}`)}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("copyright.field.title")}</Label>
              <Input
                value={workDetails.title}
                onChange={(e) => setWorkDetails((p) => ({ ...p, title: e.target.value }))}
                data-testid="input-work-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("copyright.field.alternativeTitles")}</Label>
              <Input
                value={workDetails.alternativeTitles}
                onChange={(e) => setWorkDetails((p) => ({ ...p, alternativeTitles: e.target.value }))}
                data-testid="input-alt-titles"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("copyright.field.language")}</Label>
              <Select value={workDetails.language} onValueChange={(v) => setWorkDetails((p) => ({ ...p, language: v }))}>
                <SelectTrigger data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Espa\u00f1ol</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="pt">Portugu\u00eas</SelectItem>
                  <SelectItem value="fr">Fran\u00e7ais</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("copyright.field.genre")}</Label>
              <Input
                value={workDetails.genre}
                onChange={(e) => setWorkDetails((p) => ({ ...p, genre: e.target.value }))}
                data-testid="input-genre"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("copyright.field.copyrightYear")}</Label>
              <Input
                type="number"
                value={workDetails.copyrightYear}
                onChange={(e) => setWorkDetails((p) => ({ ...p, copyrightYear: parseInt(e.target.value) || new Date().getFullYear() }))}
                data-testid="input-copyright-year"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("copyright.field.duration")}</Label>
              <Input
                value={workDetails.duration}
                onChange={(e) => setWorkDetails((p) => ({ ...p, duration: e.target.value }))}
                placeholder="3:30"
                data-testid="input-duration"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("copyright.field.isrc")}</Label>
              <Input
                value={workDetails.isrcCode}
                onChange={(e) => setWorkDetails((p) => ({ ...p, isrcCode: e.target.value }))}
                data-testid="input-isrc"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("copyright.field.iswc")}</Label>
              <Input
                value={workDetails.iswcCode}
                onChange={(e) => setWorkDetails((p) => ({ ...p, iswcCode: e.target.value }))}
                data-testid="input-iswc"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("copyright.field.publisher")}</Label>
              <Input
                value={workDetails.publisher}
                onChange={(e) => setWorkDetails((p) => ({ ...p, publisher: e.target.value }))}
                data-testid="input-publisher"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("copyright.field.publisherShare")}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={workDetails.publisherShare}
                onChange={(e) => setWorkDetails((p) => ({ ...p, publisherShare: parseInt(e.target.value) || 0 }))}
                data-testid="input-publisher-share"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>{t("copyright.field.proEntity")}</Label>
              <Select value={workDetails.proEntity} onValueChange={(v) => setWorkDetails((p) => ({ ...p, proEntity: v }))}>
                <SelectTrigger data-testid="select-pro-entity">
                  <SelectValue placeholder={t("copyright.field.selectPro")} />
                </SelectTrigger>
                <SelectContent>
                  {PRO_ENTITIES.map((pro) => (
                    <SelectItem key={pro} value={pro}>{pro}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-between gap-3 pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(1)} data-testid="button-back-step1">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("copyright.back")}
            </Button>
            <Button onClick={() => setCurrentStep(3)} disabled={!workDetails.title.trim()} data-testid="button-next-step3">
              {t("copyright.next")}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-4" data-testid="step-contributors">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-[#00C8FF]" />
              {t("copyright.step3.title")}
            </h3>
            <div className="flex items-center gap-3">
              <div className={`text-xs font-medium ${totalSharePercent === 100 ? "text-green-400" : "text-amber-400"}`} data-testid="text-total-share">
                {t("copyright.step3.totalShare")}: {totalSharePercent}%
                {totalSharePercent !== 100 && (
                  <span className="ml-1">
                    <AlertCircle className="h-3 w-3 inline" />
                  </span>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={addContributor} data-testid="button-add-contributor">
                <Plus className="h-4 w-4 mr-1" />
                {t("copyright.step3.addContributor")}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {contributors.map((contributor, idx) => (
              <Card key={idx} className="bg-white/[0.03] border-white/[0.06] p-4" data-testid={`card-contributor-${idx}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground font-medium">
                    {t("copyright.step3.contributor")} #{idx + 1}
                  </span>
                  {contributors.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeContributor(idx)} data-testid={`button-remove-contributor-${idx}`}>
                      <X className="h-4 w-4 text-red-400" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("copyright.field.name")}</Label>
                    <Input
                      value={contributor.name}
                      onChange={(e) => updateContributor(idx, "name", e.target.value)}
                      data-testid={`input-contributor-name-${idx}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("copyright.field.role")}</Label>
                    <Select value={contributor.role} onValueChange={(v) => updateContributor(idx, "role", v)}>
                      <SelectTrigger data-testid={`select-contributor-role-${idx}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTRIBUTOR_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>{t(`copyright.role.${role}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("copyright.field.ipiNumber")}</Label>
                    <Input
                      value={contributor.ipiNumber}
                      onChange={(e) => updateContributor(idx, "ipiNumber", e.target.value)}
                      data-testid={`input-contributor-ipi-${idx}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("copyright.field.proEntity")}</Label>
                    <Select value={contributor.proEntity} onValueChange={(v) => updateContributor(idx, "proEntity", v)}>
                      <SelectTrigger data-testid={`select-contributor-pro-${idx}`}>
                        <SelectValue placeholder={t("copyright.field.selectPro")} />
                      </SelectTrigger>
                      <SelectContent>
                        {PRO_ENTITIES.map((pro) => (
                          <SelectItem key={pro} value={pro}>{pro}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("copyright.field.sharePercent")}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={contributor.sharePercent}
                      onChange={(e) => updateContributor(idx, "sharePercent", parseInt(e.target.value) || 0)}
                      data-testid={`input-contributor-share-${idx}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("copyright.field.email")}</Label>
                    <Input
                      type="email"
                      value={contributor.email}
                      onChange={(e) => updateContributor(idx, "email", e.target.value)}
                      data-testid={`input-contributor-email-${idx}`}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex justify-between gap-3 pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(2)} data-testid="button-back-step2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("copyright.back")}
            </Button>
            <Button onClick={() => setCurrentStep(4)} disabled={totalSharePercent !== 100} data-testid="button-next-step4">
              {t("copyright.next")}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-4" data-testid="step-review">
          <h3 className="font-semibold flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-[#00C8FF]" />
            {t("copyright.step4.title")}
          </h3>

          <Card className="bg-white/[0.03] border-white/[0.06] p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">{t("copyright.field.title")}</span>
                <p className="font-medium" data-testid="review-title">{workDetails.title}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("copyright.field.workType")}</span>
                <p className="font-medium">{t(`copyright.workType.${workDetails.workType}`)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("copyright.field.genre")}</span>
                <p className="font-medium">{workDetails.genre || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("copyright.field.language")}</span>
                <p className="font-medium">{workDetails.language}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("copyright.field.copyrightYear")}</span>
                <p className="font-medium">{workDetails.copyrightYear}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("copyright.field.duration")}</span>
                <p className="font-medium">{workDetails.duration || "—"}</p>
              </div>
              {workDetails.isrcCode && (
                <div>
                  <span className="text-xs text-muted-foreground">{t("copyright.field.isrc")}</span>
                  <p className="font-medium">{workDetails.isrcCode}</p>
                </div>
              )}
              {workDetails.iswcCode && (
                <div>
                  <span className="text-xs text-muted-foreground">{t("copyright.field.iswc")}</span>
                  <p className="font-medium">{workDetails.iswcCode}</p>
                </div>
              )}
              <div>
                <span className="text-xs text-muted-foreground">{t("copyright.field.publisher")}</span>
                <p className="font-medium">{workDetails.publisher} ({workDetails.publisherShare}%)</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("copyright.field.proEntity")}</span>
                <p className="font-medium">{workDetails.proEntity || "—"}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-white/[0.03] border-white/[0.06] p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-[#D946EF]" />
              {t("copyright.step3.title")} ({contributors.length})
            </h4>
            <div className="space-y-2">
              {contributors.map((c, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white/[0.02] rounded-lg p-2.5 text-sm" data-testid={`review-contributor-${idx}`}>
                  <div>
                    <span className="font-medium">{c.name || t("copyright.unnamed")}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{t(`copyright.role.${c.role}`)}</span>
                  </div>
                  <Badge variant="outline" className="text-[#00C8FF] border-[#00C8FF]/30">{c.sharePercent}%</Badge>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(3)} data-testid="button-back-step3">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("copyright.back")}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleExportJson} data-testid="button-export-json">
                <Download className="h-4 w-4 mr-1" />
                {t("copyright.step4.export")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || !workDetails.title.trim()}
                className="bg-gradient-to-r from-[#00C8FF] to-[#D946EF] text-white border-0"
                data-testid="button-submit-work"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                {t("copyright.step4.submit")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CopyrightHubPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00C8FF] to-[#D946EF] flex items-center justify-center">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-copyright-hub-title">{t("copyright.pageTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("copyright.pageSubtitle")}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/[0.03]">
            <TabsTrigger value="dashboard" data-testid="tab-copyright-dashboard">
              <FileText className="h-4 w-4 mr-1" />
              {t("copyright.tabs.dashboard")}
            </TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-copyright-register">
              <Plus className="h-4 w-4 mr-1" />
              {t("copyright.tabs.register")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 mt-4">
            <DashboardTab t={t} />
          </TabsContent>

          <TabsContent value="register" className="mt-4">
            <RegisterWizard t={t} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
