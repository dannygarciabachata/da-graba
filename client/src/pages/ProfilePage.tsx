import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Crown,
  CreditCard,
  Music,
  Globe,
  Save,
  Shield,
  Zap,
  Camera,
  ExternalLink,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ProfileTab = "profile" | "artist" | "billing";

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLoc] = useLocation();

  const tabFromUrl = (() => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    return (params.get("tab") as ProfileTab) || "profile";
  })();
  const [activeTab, setActiveTab] = useState<ProfileTab>(tabFromUrl);

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");

  const { data: artistProfile } = useQuery<any>({
    queryKey: ["/api/artist/profile"],
  });

  const [artistName, setArtistName] = useState("");
  const [bio, setBio] = useState("");
  const [genre, setGenre] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [proEntity, setProEntity] = useState("");
  const [proMemberId, setProMemberId] = useState("");

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setProfileImageUrl(user.profileImageUrl || "");
    }
  }, [user]);

  useEffect(() => {
    if (artistProfile) {
      setArtistName(artistProfile.artistName || "");
      setBio(artistProfile.bio || "");
      setGenre(artistProfile.genre || "");
      setCountry(artistProfile.country || "");
      setWebsite(artistProfile.website || "");
      setProEntity(artistProfile.proEntity || "");
      setProMemberId(artistProfile.proMemberId || "");
    }
  }, [artistProfile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; profileImageUrl: string }) => {
      const res = await apiRequest("PATCH", "/api/auth/user", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: t("profile.saved", "Perfil actualizado") });
    },
    onError: () => {
      toast({ title: t("profile.error", "Error al guardar"), variant: "destructive" });
    },
  });

  const updateArtistMutation = useMutation({
    mutationFn: async (data: any) => {
      if (artistProfile) {
        const res = await apiRequest("PATCH", "/api/artist/profile", data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/artist/profile", data);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artist/profile"] });
      toast({ title: t("profile.artistSaved", "Perfil artístico actualizado") });
    },
    onError: () => {
      toast({ title: t("profile.error", "Error al guardar"), variant: "destructive" });
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({ firstName, lastName, profileImageUrl });
  };

  const handleSaveArtist = () => {
    updateArtistMutation.mutate({
      artistName: artistName || `${firstName} ${lastName}`.trim(),
      bio,
      genre,
      country,
      website,
      proEntity: proEntity || "none",
      proMemberId,
    });
  };

  if (!user) return null;

  const tabs: { id: ProfileTab; label: string; icon: any }[] = [
    { id: "profile", label: t("profile.myProfile", "Mi Perfil"), icon: User },
    { id: "artist", label: t("profile.artistProfile", "Perfil Artístico"), icon: Crown },
    { id: "billing", label: t("profile.billing", "Facturación"), icon: CreditCard },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 pb-28" data-testid="profile-page">
      <div className="flex items-center gap-4 mb-6">
        <Avatar className="h-16 w-16 sm:h-20 sm:w-20 ring-2 ring-orange-500/40 shadow-xl shadow-orange-500/10">
          <AvatarImage src={user.profileImageUrl || undefined} />
          <AvatarFallback className="text-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold">
            {user.firstName?.[0]}{user.lastName?.[0]}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="profile-name">{user.firstName} {user.lastName}</h1>
          <p className="text-sm text-muted-foreground" data-testid="profile-email">{user.email || t("profile.noEmail", "Sin email registrado")}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-300">
              {user.subscriptionTier === "free" ? "Free" : user.subscriptionTier?.toUpperCase()}
            </Badge>
            {artistProfile && (
              <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
                {t("profile.artist", "Artista")}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-white/10 overflow-x-auto" data-testid="profile-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            data-testid={`profile-tab-${tab.id}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "profile" && (
        <div className="space-y-6" data-testid="profile-tab-content-profile">
          <Card className="p-5 sm:p-6 bg-white/[0.03] border-white/10">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              {t("profile.personalInfo", "Información Personal")}
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 mb-4">
                <Avatar className="h-24 w-24 ring-2 ring-orange-500/30">
                  <AvatarImage src={profileImageUrl || undefined} />
                  <AvatarFallback className="text-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold">
                    {firstName?.[0]}{lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <p className="text-[11px] text-muted-foreground text-center">
                  {t("profile.photoNote", "Tu foto se obtiene de tu cuenta de Google, Apple, Facebook o X al iniciar sesión. También puedes pegar un enlace.")}
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">{t("profile.photoUrl", "URL de foto de perfil")}</Label>
                <Input
                  value={profileImageUrl}
                  onChange={(e) => setProfileImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-white/[0.03] border-white/10 mt-1"
                  data-testid="input-profile-image"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">{t("profile.firstName", "Nombre")}</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-white/[0.03] border-white/10 mt-1"
                    data-testid="input-first-name"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t("profile.lastName", "Apellido")}</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-white/[0.03] border-white/10 mt-1"
                    data-testid="input-last-name"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">{t("profile.email", "Email")}</Label>
                <Input
                  value={user.email || ""}
                  disabled
                  className="bg-white/[0.02] border-white/5 mt-1 text-muted-foreground"
                  data-testid="input-email"
                />
                <p className="text-[10px] text-muted-foreground mt-1">{t("profile.emailNote", "El email viene de tu proveedor de inicio de sesión")}</p>
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                className="bg-gradient-to-r from-orange-600 to-orange-500 hover:shadow-lg hover:shadow-orange-500/30"
                data-testid="button-save-profile"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateProfileMutation.isPending ? t("common.saving", "Guardando...") : t("profile.saveProfile", "Guardar Perfil")}
              </Button>
            </div>
          </Card>

          <Card className="p-5 sm:p-6 bg-white/[0.03] border-white/10">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              {t("profile.loginProvider", "Proveedor de Inicio de Sesión")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("profile.loginProviderDesc", "Tu cuenta está vinculada a través de Replit Auth. Puedes actualizar tu foto de perfil y nombre desde tu proveedor de identidad (Google, Apple, Facebook, X) o manualmente arriba.")}
            </p>
          </Card>
        </div>
      )}

      {activeTab === "artist" && (
        <div className="space-y-6" data-testid="profile-tab-content-artist">
          <Card className="p-5 sm:p-6 bg-white/[0.03] border-white/10">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              {t("profile.artistInfo", "Información Artística")}
            </h2>
            {!artistProfile && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 mb-4">
                <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <p className="text-xs text-orange-300">{t("profile.noArtistProfile", "No tienes perfil artístico aún. Completa los datos para crear uno.")}</p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">{t("profile.artistName", "Nombre Artístico")}</Label>
                <Input
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder={`${firstName} ${lastName}`.trim() || "Tu nombre artístico"}
                  className="bg-white/[0.03] border-white/10 mt-1"
                  data-testid="input-artist-name"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">{t("profile.bio", "Biografía")}</Label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t("profile.bioPlaceholder", "Cuéntale al mundo sobre tu música...")}
                  className="bg-white/[0.03] border-white/10 mt-1 min-h-[100px] resize-none"
                  data-testid="input-artist-bio"
                  maxLength={1000}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">{t("profile.genre", "Género Musical")}</Label>
                  <Input
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="Bachata, Bolero..."
                    className="bg-white/[0.03] border-white/10 mt-1"
                    data-testid="input-artist-genre"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t("profile.country", "País")}</Label>
                  <Input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="República Dominicana"
                    className="bg-white/[0.03] border-white/10 mt-1"
                    data-testid="input-artist-country"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">{t("profile.website", "Sitio Web")}</Label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://tumusica.com"
                  className="bg-white/[0.03] border-white/10 mt-1"
                  data-testid="input-artist-website"
                />
              </div>

              <Button
                onClick={handleSaveArtist}
                disabled={updateArtistMutation.isPending}
                className="bg-gradient-to-r from-orange-600 to-orange-500 hover:shadow-lg hover:shadow-orange-500/30"
                data-testid="button-save-artist"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateArtistMutation.isPending ? t("common.saving", "Guardando...") : t("profile.saveArtist", "Guardar Perfil Artístico")}
              </Button>
            </div>
          </Card>

          <Card className="p-5 sm:p-6 bg-white/[0.03] border-white/10">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              {t("profile.proRegistration", "Registro PRO / Copyright")}
            </h2>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">{t("profile.proEntity", "Entidad PRO")}</Label>
                <select
                  value={proEntity}
                  onChange={(e) => setProEntity(e.target.value)}
                  className="w-full mt-1 bg-white/[0.03] border border-white/10 rounded-md px-3 py-2 text-sm"
                  data-testid="select-pro-entity"
                >
                  <option value="none">{t("profile.noEntity", "Sin entidad PRO")}</option>
                  <option value="bmi">BMI</option>
                  <option value="ascap">ASCAP</option>
                  <option value="sesac">SESAC</option>
                  <option value="socan">SOCAN</option>
                  <option value="prs">PRS</option>
                  <option value="gema">GEMA</option>
                  <option value="sgae">SGAE</option>
                </select>
              </div>
              {proEntity && proEntity !== "none" && (
                <div>
                  <Label className="text-xs text-muted-foreground">{t("profile.proMemberId", "ID de Miembro PRO")}</Label>
                  <Input
                    value={proMemberId}
                    onChange={(e) => setProMemberId(e.target.value)}
                    placeholder="CAE/IPI#"
                    className="bg-white/[0.03] border-white/10 mt-1"
                    data-testid="input-pro-member-id"
                  />
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === "billing" && (
        <div className="space-y-6" data-testid="profile-tab-content-billing">
          <Card className="p-5 sm:p-6 bg-white/[0.03] border-white/10">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              {t("profile.currentPlan", "Plan Actual")}
            </h2>
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-orange-500/20">
              <div>
                <p className="font-semibold text-lg" data-testid="billing-plan-name">
                  {user.subscriptionTier === "free" ? "Free" : user.subscriptionTier?.charAt(0).toUpperCase() + (user.subscriptionTier?.slice(1) || "")}
                </p>
                <p className="text-xs text-muted-foreground">{t("profile.credits", "Créditos")}: {user.credits}</p>
              </div>
              <Button
                onClick={() => setLoc("/pricing")}
                variant="outline"
                className="border-orange-500/30 text-orange-300 hover:bg-orange-500/10"
                data-testid="button-upgrade-plan"
              >
                {t("profile.upgradePlan", "Mejorar Plan")}
              </Button>
            </div>
          </Card>

          <Card className="p-5 sm:p-6 bg-white/[0.03] border-white/10">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              {t("profile.paymentMethod", "Método de Pago")}
            </h2>
            {user.stripeCustomerId ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-sm font-medium">{t("profile.stripeConnected", "Stripe conectado")}</p>
                  <p className="text-xs text-muted-foreground">{t("profile.stripeConnectedDesc", "Tu método de pago está configurado a través de Stripe")}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <AlertCircle className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t("profile.noPayment", "Sin método de pago")}</p>
                  <p className="text-xs text-muted-foreground">{t("profile.noPaymentDesc", "Selecciona un plan para configurar tu método de pago")}</p>
                </div>
              </div>
            )}
          </Card>

          {artistProfile && (
            <Card className="p-5 sm:p-6 bg-white/[0.03] border-white/10">
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <Music className="w-4 h-4 text-primary" />
                {t("profile.artistPayouts", "Pagos de Artista")}
              </h2>
              {artistProfile.stripeConnectStatus === "not_connected" ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("profile.connectStripe", "Conecta tu cuenta de Stripe para recibir pagos de suscripciones y regalos de fans.")}
                  </p>
                  <Button
                    onClick={() => setLoc("/artist-dashboard")}
                    variant="outline"
                    className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                    data-testid="button-connect-stripe"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {t("profile.setupPayouts", "Configurar Pagos")}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-sm font-medium">{t("profile.payoutsActive", "Pagos activos")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("profile.totalEarnings", "Ganancias totales")}: ${((artistProfile.totalEarnings || 0) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
