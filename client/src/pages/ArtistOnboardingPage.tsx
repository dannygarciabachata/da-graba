import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft,
  Mic,
  Headphones,
  Radio,
  Store,
  Scissors,
  PartyPopper,
  Camera,
  Gamepad2,
  Upload,
  X,
  ImageIcon,
  Link as LinkIcon,
  AtSign,
  Loader2,
  Save,
} from "lucide-react";
import { SiSpotify, SiSoundcloud, SiInstagram, SiYoutube } from "react-icons/si";

function Users2Icon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 21a8 8 0 0 0-16 0" /><circle cx="10" cy="8" r="5" /><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
    </svg>
  );
}

function XIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

const ARTIST_TYPES = [
  { value: "singer", icon: Mic, label: "Cantante" },
  { value: "producer", icon: Headphones, label: "Productor" },
  { value: "independent", icon: Music, label: "Independiente" },
  { value: "dj", icon: Radio, label: "DJ" },
  { value: "band", icon: Users2Icon, label: "Banda" },
  { value: "restaurant", icon: Store, label: "Restaurante" },
  { value: "barbershop", icon: Scissors, label: "Barbería" },
  { value: "nightclub", icon: PartyPopper, label: "Discoteca" },
  { value: "content_creator", icon: Camera, label: "Creador" },
  { value: "hobbyist", icon: Gamepad2, label: "Hobbyista" },
] as const;

const PRO_ENTITIES = ["none", "bmi", "ascap", "sesac", "socan", "prs", "gema", "sgae"];

const GENRES_LIST = [
  "Bachata", "Bolero", "Salsa", "Merengue", "Reggaeton",
  "Latin Pop", "R&B", "Hip Hop", "Pop", "EDM",
  "Rock", "Jazz", "Classical", "Son", "Cumbia",
  "Vallenato", "Dembow", "Urbano", "Tropical", "Other",
];

const COUNTRIES = [
  "Dominican Republic", "United States", "Puerto Rico", "Colombia",
  "Mexico", "Spain", "Cuba", "Argentina", "Chile", "Venezuela",
  "Other",
];

const BIO_MAX = 1200;

export default function ArtistOnboardingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { data: existingProfile, isLoading: profileLoading } = useQuery<any>({
    queryKey: ["/api/artist/profile"],
  });

  const isEditing = !!existingProfile;

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
    website: "",
    socialLinks: {} as Record<string, string>,
  });

  const [genres, setGenres] = useState<string[]>([]);
  const [genreInput, setGenreInput] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

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
        website: existingProfile.website || "",
        socialLinks: existingProfile.socialLinks || {},
      });
      if (existingProfile.avatarUrl) setAvatarPreview(existingProfile.avatarUrl);
      if (existingProfile.bannerUrl) setBannerPreview(existingProfile.bannerUrl);
      if (existingProfile.genre) {
        setGenres(existingProfile.genre.split(",").map((g: string) => g.trim()).filter(Boolean));
      }
    }
  }, [existingProfile]);

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));
  const updateSocial = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [key]: value },
    }));
  };

  const addGenre = (genre: string) => {
    const trimmed = genre.trim();
    if (!trimmed || genres.length >= 5 || genres.includes(trimmed)) return;
    setGenres([...genres, trimmed]);
    setGenreInput("");
  };

  const removeGenre = (genre: string) => {
    setGenres(genres.filter((g) => g !== genre));
  };

  const handleImageUpload = async (file: File, type: "avatar" | "banner") => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB", variant: "destructive" });
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Use JPEG, PNG, WEBP, or BMP", variant: "destructive" });
      return;
    }

    const localPreview = URL.createObjectURL(file);
    if (type === "avatar") {
      setAvatarPreview(localPreview);
      setUploadingAvatar(true);
    } else {
      setBannerPreview(localPreview);
      setUploadingBanner(true);
    }

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("type", type);
      const res = await fetch("/api/artist/profile/upload-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (type === "avatar") {
        setAvatarPreview(data.url);
      } else {
        setBannerPreview(data.url);
      }
      toast({ title: type === "avatar" ? "Profile picture updated" : "Cover image updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      if (type === "avatar") setAvatarPreview(existingProfile?.avatarUrl || null);
      else setBannerPreview(existingProfile?.bannerUrl || null);
    } finally {
      if (type === "avatar") setUploadingAvatar(false);
      else setUploadingBanner(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const method = isEditing ? "PATCH" : "POST";
      const payload = {
        ...form,
        genre: genres.length > 0 ? genres.join(", ") : form.genre,
      };
      const res = await apiRequest(method, "/api/artist/profile", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artist/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/artist/dashboard"] });
      toast({ title: isEditing ? "Profile updated" : "Profile created" });
      setLocation("/artist-dashboard");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (profileLoading) {
    return (
      <div className="h-full overflow-auto flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/artist-dashboard")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-page-title">
                {isEditing ? "Edit Profile" : "Create Artist Profile"}
              </h1>
              <p className="text-xs text-muted-foreground">Customize how your profile appears on DAGRABA</p>
            </div>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.artistName.trim()}
            data-testid="button-save-profile"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            {isEditing ? "Save Changes" : "Create Profile"}
          </Button>
        </div>

        {/* Cover Image / Banner */}
        <Card className="bg-white/[0.03] border-white/[0.06] overflow-hidden">
          <div className="p-4 pb-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              Cover Image
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG, WEBP. Max 5MB, recommended 1280x740</p>
          </div>
          <div
            className="relative mx-4 mb-4 h-44 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-blue-600/20 border border-white/[0.08] cursor-pointer group"
            onClick={() => bannerInputRef.current?.click()}
            data-testid="upload-banner"
          >
            {bannerPreview ? (
              <img src={bannerPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                <Upload className="h-8 w-8 mb-2 opacity-40" />
                <span className="text-sm">Click to upload cover image</span>
              </div>
            )}
            {uploadingBanner && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="h-6 w-6 text-white" />
            </div>
            {bannerPreview && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-black/50 text-white"
                onClick={(e) => { e.stopPropagation(); setBannerPreview(null); }}
                data-testid="button-remove-banner"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "banner")}
            data-testid="input-banner-file"
          />
        </Card>

        {/* Profile Picture & Display Name */}
        <Card className="bg-white/[0.03] border-white/[0.06] p-5">
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="flex flex-col items-center gap-2">
              <Label className="text-sm font-medium">Profile Picture</Label>
              <div
                className="relative w-28 h-28 rounded-full overflow-hidden bg-gradient-to-br from-primary/30 to-blue-600/30 border-2 border-white/[0.08] cursor-pointer group flex-shrink-0"
                onClick={() => avatarInputRef.current?.click()}
                data-testid="upload-avatar"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <User className="h-8 w-8 opacity-40" />
                  </div>
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                JPEG, PNG, WEBP, BMP<br />Max 5MB, 500x500
              </p>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/bmp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "avatar")}
                data-testid="input-avatar-file"
              />
            </div>

            <div className="flex-1 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Display Name</Label>
                <Input
                  value={form.artistName}
                  onChange={(e) => update("artistName", e.target.value)}
                  placeholder="Your artist or stage name"
                  className="bg-white/[0.03]"
                  data-testid="input-display-name"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                  Handle
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                  <Input
                    value={form.artistName.toLowerCase().replace(/[^a-z0-9_]/g, "")}
                    readOnly
                    className="bg-white/[0.03] pl-7 text-muted-foreground"
                    data-testid="input-handle"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Auto-generated from display name</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Bio */}
        <Card className="bg-white/[0.03] border-white/[0.06] p-5">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Bio</Label>
            <p className="text-xs text-muted-foreground">Tell fans about yourself and your music</p>
            <Textarea
              value={form.bio}
              onChange={(e) => {
                if (e.target.value.length <= BIO_MAX) update("bio", e.target.value);
              }}
              placeholder="Tell us about yourself, your music journey, and what inspires you..."
              className="bg-white/[0.03] min-h-[120px]"
              data-testid="input-bio"
            />
            <p className={`text-xs text-right ${form.bio.length > BIO_MAX * 0.9 ? "text-amber-400" : "text-muted-foreground"}`}>
              {form.bio.length}/{BIO_MAX}
            </p>
          </div>
        </Card>

        {/* Artist Type */}
        <Card className="bg-white/[0.03] border-white/[0.06] p-5">
          <Label className="text-sm font-medium mb-3 block">Artist Type</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {ARTIST_TYPES.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => update("artistType", value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left border
                  ${form.artistType === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-white/10 bg-white/[0.02] text-muted-foreground hover:bg-white/[0.04]"
                  }`}
                data-testid={`button-type-${value}`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Genres */}
        <Card className="bg-white/[0.03] border-white/[0.06] p-5">
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Genres</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Add up to 5 genres to describe your music style. If empty, genres will be inferred from your most popular songs.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <Badge key={g} variant="secondary" className="gap-1 py-1 px-2.5">
                  {g}
                  <button onClick={() => removeGenre(g)} className="ml-0.5" data-testid={`remove-genre-${g}`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            {genres.length < 5 && (
              <div className="flex gap-2">
                <Select value="" onValueChange={(v) => addGenre(v)}>
                  <SelectTrigger className="bg-white/[0.03] flex-1" data-testid="select-genre">
                    <SelectValue placeholder="Select a genre..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GENRES_LIST.filter((g) => !genres.includes(g)).map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Input
                    value={genreInput}
                    onChange={(e) => setGenreInput(e.target.value)}
                    placeholder="Or type custom..."
                    className="bg-white/[0.03] w-36"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGenre(genreInput); } }}
                    data-testid="input-custom-genre"
                  />
                </div>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">{genres.length}/5</p>
          </div>
        </Card>

        {/* Country & Primary Genre */}
        <Card className="bg-white/[0.03] border-white/[0.06] p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Country</Label>
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
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Website</Label>
              <Input
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
                placeholder="https://yoursite.com"
                className="bg-white/[0.03]"
                data-testid="input-website"
              />
            </div>
          </div>
        </Card>

        {/* Social Networks */}
        <Card className="bg-white/[0.03] border-white/[0.06] p-5">
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                Social Networks
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Add your social media profile links</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <SiSpotify className="h-5 w-5 text-green-500 flex-shrink-0" />
                <Input
                  value={form.socialLinks.spotify || ""}
                  onChange={(e) => updateSocial("spotify", e.target.value)}
                  placeholder="https://open.spotify.com/artist/your-id"
                  className="bg-white/[0.03]"
                  data-testid="input-social-spotify"
                />
              </div>
              <div className="flex items-center gap-3">
                <SiSoundcloud className="h-5 w-5 text-orange-500 flex-shrink-0" />
                <Input
                  value={form.socialLinks.soundcloud || ""}
                  onChange={(e) => updateSocial("soundcloud", e.target.value)}
                  placeholder="https://soundcloud.com/your-profile"
                  className="bg-white/[0.03]"
                  data-testid="input-social-soundcloud"
                />
              </div>
              <div className="flex items-center gap-3">
                <XIcon className="h-5 w-5 text-foreground flex-shrink-0" />
                <Input
                  value={form.socialLinks.twitter || ""}
                  onChange={(e) => updateSocial("twitter", e.target.value)}
                  placeholder="https://x.com/your-profile"
                  className="bg-white/[0.03]"
                  data-testid="input-social-twitter"
                />
              </div>
              <div className="flex items-center gap-3">
                <SiInstagram className="h-5 w-5 text-pink-500 flex-shrink-0" />
                <Input
                  value={form.socialLinks.instagram || ""}
                  onChange={(e) => updateSocial("instagram", e.target.value)}
                  placeholder="https://www.instagram.com/your-profile"
                  className="bg-white/[0.03]"
                  data-testid="input-social-instagram"
                />
              </div>
              <div className="flex items-center gap-3">
                <SiYoutube className="h-5 w-5 text-red-500 flex-shrink-0" />
                <Input
                  value={form.socialLinks.youtube || ""}
                  onChange={(e) => updateSocial("youtube", e.target.value)}
                  placeholder="https://www.youtube.com/your-channel"
                  className="bg-white/[0.03]"
                  data-testid="input-social-youtube"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Copyright & PRO */}
        <Card className="bg-white/[0.03] border-white/[0.06] p-5">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Copyright & PRO
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Performance rights organization details (optional)</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">PRO Entity</Label>
              <Select value={form.proEntity} onValueChange={(v) => update("proEntity", v)}>
                <SelectTrigger className="bg-white/[0.03]" data-testid="select-pro-entity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRO_ENTITIES.map((e) => (
                    <SelectItem key={e} value={e}>{e === "none" ? "None" : e.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.proEntity !== "none" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Member ID</Label>
                  <Input
                    value={form.proMemberId}
                    onChange={(e) => update("proMemberId", e.target.value)}
                    placeholder="Your member ID"
                    className="bg-white/[0.03]"
                    data-testid="input-pro-member-id"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">IPI Number</Label>
                  <Input
                    value={form.ipiNumber}
                    onChange={(e) => update("ipiNumber", e.target.value)}
                    placeholder="IPI number"
                    className="bg-white/[0.03]"
                    data-testid="input-ipi"
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Monetization / Subscription Price */}
        <Card className="bg-white/[0.03] border-white/[0.06] p-5">
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Subscription Price
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Monthly subscription price for fans to access exclusive content</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-primary">$</span>
              <Input
                type="number"
                step="0.01"
                min="0.99"
                max="99.99"
                value={(form.monthlySubscriptionPrice / 100).toFixed(2)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0.99 && val <= 99.99) {
                    update("monthlySubscriptionPrice", Math.round(val * 100));
                  }
                }}
                className="bg-white/[0.03] w-32"
                data-testid="input-price"
              />
              <span className="text-muted-foreground text-sm">/ month</span>
            </div>
          </div>
        </Card>

        {/* Save Button (bottom) */}
        <div className="flex items-center justify-between py-4 border-t border-white/10">
          <Button variant="ghost" onClick={() => setLocation("/artist-dashboard")} data-testid="button-cancel">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.artistName.trim()}
            className="bg-gradient-to-r from-primary to-blue-600"
            data-testid="button-save-bottom"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
            {isEditing ? "Save Changes" : "Create Profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}
