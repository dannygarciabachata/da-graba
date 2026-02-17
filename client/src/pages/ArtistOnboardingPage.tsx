import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Music,
  User,
  Shield,
  DollarSign,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Mic,
  Headphones,
  Radio,
  Store,
  Scissors,
  PartyPopper,
  Camera,
  Gamepad2,
  Crown,
} from "lucide-react";

const ARTIST_TYPES = [
  { value: "singer", icon: Mic, label: "artist.types.singer" },
  { value: "producer", icon: Headphones, label: "artist.types.producer" },
  { value: "independent", icon: Music, label: "artist.types.independent" },
  { value: "dj", icon: Radio, label: "artist.types.dj" },
  { value: "band", icon: Users2Icon, label: "artist.types.band" },
  { value: "restaurant", icon: Store, label: "artist.types.restaurant" },
  { value: "barbershop", icon: Scissors, label: "artist.types.barbershop" },
  { value: "nightclub", icon: PartyPopper, label: "artist.types.nightclub" },
  { value: "content_creator", icon: Camera, label: "artist.types.content_creator" },
  { value: "hobbyist", icon: Gamepad2, label: "artist.types.hobbyist" },
] as const;

function Users2Icon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 21a8 8 0 0 0-16 0" /><circle cx="10" cy="8" r="5" /><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
    </svg>
  );
}

const PRO_ENTITIES = ["none", "bmi", "ascap", "sesac", "socan", "prs", "gema", "sgae"];

const GENRES = [
  { value: "Bachata", label: "DAGRABACHATA" },
  { value: "Bolero", label: "DAGRABOLERO" },
  { value: "Salsa", label: "Salsa" },
  { value: "Merengue", label: "Merengue" },
  { value: "Reggaeton", label: "Reggaeton" },
  { value: "Latin Pop", label: "Latin Pop" },
  { value: "R&B", label: "R&B" },
  { value: "Hip Hop", label: "Hip Hop" },
  { value: "Pop", label: "Pop" },
  { value: "EDM", label: "EDM" },
  { value: "Rock", label: "Rock" },
  { value: "Jazz", label: "Jazz" },
  { value: "Classical", label: "Classical" },
  { value: "Other", label: "Other" },
];

const COUNTRIES = [
  "Dominican Republic", "United States", "Puerto Rico", "Colombia",
  "Mexico", "Spain", "Cuba", "Argentina", "Chile", "Venezuela",
  "Other",
];

export default function ArtistOnboardingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);

  const { data: existingProfile } = useQuery<any>({
    queryKey: ["/api/artist/profile"],
  });

  const [form, setForm] = useState({
    artistName: "",
    artistType: "independent",
    genre: "Bachata",
    country: "Dominican Republic",
    bio: "",
    proEntity: "none",
    proMemberId: "",
    ipiNumber: "",
    monthlySubscriptionPrice: 299,
  });

  const isEditing = !!existingProfile;

  useEffect(() => {
    if (existingProfile) {
      setForm({
        artistName: existingProfile.artistName || "",
        artistType: existingProfile.artistType || "independent",
        genre: existingProfile.genre || "Bachata",
        country: existingProfile.country || "Dominican Republic",
        bio: existingProfile.bio || "",
        proEntity: existingProfile.proEntity || "none",
        proMemberId: existingProfile.proMemberId || "",
        ipiNumber: existingProfile.ipiNumber || "",
        monthlySubscriptionPrice: existingProfile.monthlySubscriptionPrice || 299,
      });
    }
  }, [existingProfile]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const method = isEditing ? "PATCH" : "POST";
      const res = await apiRequest(method, "/api/artist/profile", form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artist/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/artist/dashboard"] });
      toast({ title: isEditing ? t('artist.onboarding.updated') : t('artist.onboarding.created') });
      setLocation("/artist-dashboard");
    },
    onError: (err: any) => {
      toast({ title: t('common.error'), description: err.message, variant: "destructive" });
    },
  });

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const steps = [
    { title: t('artist.onboarding.step1'), icon: User },
    { title: t('artist.onboarding.step2'), icon: Music },
    { title: t('artist.onboarding.step3'), icon: Shield },
    { title: t('artist.onboarding.step4'), icon: DollarSign },
  ];

  const canNext = () => {
    if (step === 0) return form.artistName.trim().length >= 2;
    return true;
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold" data-testid="text-onboarding-title">
            {isEditing ? t('artist.onboarding.editTitle') : t('artist.onboarding.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('artist.onboarding.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2 justify-center mb-6">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                onClick={() => i <= step && setStep(i)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm transition-colors
                  ${i === step ? "bg-primary text-white" : i < step ? "bg-green-500/20 text-green-400" : "bg-white/[0.06] text-muted-foreground"}
                `}
                data-testid={`step-indicator-${i}`}
              >
                {i < step ? <CheckCircle className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              </button>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 ${i < step ? "bg-green-500/40" : "bg-white/10"}`} />
              )}
            </div>
          ))}
        </div>

        <Card className="bg-white/[0.03] border-white/[0.06] p-6">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">{t('artist.onboarding.identityTitle')}</h2>
              <div className="space-y-2">
                <Label>{t('artist.onboarding.artistName')}</Label>
                <Input
                  value={form.artistName}
                  onChange={(e) => update("artistName", e.target.value)}
                  placeholder={t('artist.onboarding.artistNamePlaceholder')}
                  className="bg-white/[0.03]"
                  data-testid="input-artist-name"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('artist.onboarding.artistType')}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ARTIST_TYPES.map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => update("artistType", value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors text-left border
                        ${form.artistType === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-white/10 bg-white/[0.02] text-muted-foreground hover:bg-white/[0.04]"
                        }`}
                      data-testid={`button-type-${value}`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {t(label)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('artist.onboarding.bio')}</Label>
                <Textarea
                  value={form.bio}
                  onChange={(e) => update("bio", e.target.value)}
                  placeholder={t('artist.onboarding.bioPlaceholder')}
                  className="bg-white/[0.03] min-h-[80px]"
                  data-testid="input-bio"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">{t('artist.onboarding.musicTitle')}</h2>
              <div className="space-y-2">
                <Label>{t('artist.onboarding.genre')}</Label>
                <Select value={form.genre} onValueChange={(v) => update("genre", v)}>
                  <SelectTrigger className="bg-white/[0.03]" data-testid="select-genre">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENRES.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('artist.onboarding.country')}</Label>
                <Select value={form.country} onValueChange={(v) => update("country", v)}>
                  <SelectTrigger className="bg-white/[0.03]" data-testid="select-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">{t('artist.onboarding.copyrightTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('artist.onboarding.copyrightDesc')}</p>
              <div className="space-y-2">
                <Label>{t('artist.onboarding.proEntity')}</Label>
                <Select value={form.proEntity} onValueChange={(v) => update("proEntity", v)}>
                  <SelectTrigger className="bg-white/[0.03]" data-testid="select-pro-entity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRO_ENTITIES.map((e) => (
                      <SelectItem key={e} value={e}>{e === "none" ? t('artist.onboarding.noPro') : e.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.proEntity !== "none" && (
                <>
                  <div className="space-y-2">
                    <Label>{t('artist.onboarding.proMemberId')}</Label>
                    <Input
                      value={form.proMemberId}
                      onChange={(e) => update("proMemberId", e.target.value)}
                      placeholder={t('artist.onboarding.proMemberIdPlaceholder')}
                      className="bg-white/[0.03]"
                      data-testid="input-pro-member-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('artist.onboarding.ipiNumber')}</Label>
                    <Input
                      value={form.ipiNumber}
                      onChange={(e) => update("ipiNumber", e.target.value)}
                      placeholder={t('artist.onboarding.ipiNumberPlaceholder')}
                      className="bg-white/[0.03]"
                      data-testid="input-ipi"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">{t('artist.onboarding.monetizationTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('artist.onboarding.monetizationDesc')}</p>

              <div className="space-y-2">
                <Label>{t('artist.onboarding.subscriptionPrice')}</Label>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-primary">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.99"
                    max="99.99"
                    value={(form.monthlySubscriptionPrice / 100).toFixed(2)}
                    onChange={(e) => update("monthlySubscriptionPrice", Math.round(parseFloat(e.target.value || "2.99") * 100))}
                    className="bg-white/[0.03] w-32"
                    data-testid="input-price"
                  />
                  <span className="text-muted-foreground text-sm">/ {t('artist.dashboard.perMonth')}</span>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/10 rounded-lg p-4 space-y-3">
                <h3 className="font-medium text-sm">{t('artist.onboarding.summaryTitle')}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">{t('artist.onboarding.artistName')}:</div>
                  <div className="font-medium">{form.artistName}</div>
                  <div className="text-muted-foreground">{t('artist.onboarding.artistType')}:</div>
                  <div className="font-medium">{t(`artist.types.${form.artistType}`)}</div>
                  <div className="text-muted-foreground">{t('artist.onboarding.genre')}:</div>
                  <div className="font-medium">{form.genre}</div>
                  <div className="text-muted-foreground">{t('artist.onboarding.proEntity')}:</div>
                  <div className="font-medium">{form.proEntity === "none" ? t('artist.onboarding.noPro') : form.proEntity.toUpperCase()}</div>
                  <div className="text-muted-foreground">{t('artist.onboarding.subscriptionPrice')}:</div>
                  <div className="font-medium text-primary">${(form.monthlySubscriptionPrice / 100).toFixed(2)}/mo</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
            <Button
              variant="ghost"
              onClick={() => step > 0 ? setStep(step - 1) : setLocation("/artist-dashboard")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {step > 0 ? t('common.back') : t('common.cancel')}
            </Button>

            {step < steps.length - 1 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                data-testid="button-next"
              >
                {t('common.next')} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !canNext()}
                className="bg-gradient-to-r from-primary to-purple-600"
                data-testid="button-submit"
              >
                {createMutation.isPending ? t('common.loading') : isEditing ? t('artist.onboarding.updateButton') : t('artist.onboarding.createButton')}
                <CheckCircle className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
