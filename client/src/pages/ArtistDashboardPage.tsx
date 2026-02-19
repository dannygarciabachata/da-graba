import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  DollarSign,
  Users,
  Heart,
  Music,
  Headphones,
  TrendingUp,
  Crown,
  Shield,
  FileText,
  Plus,
  Settings,
  BarChart3,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  Gift,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Disc,
  Search,
  Upload,
  Trash2,
  Loader2,
  CreditCard,
  Building,
  Send,
  RefreshCw,
  LinkIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

export default function ArtistDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [spotifySearch, setSpotifySearch] = useState("");
  const [importingSpotify, setImportingSpotify] = useState(false);
  const [showAddAlbum, setShowAddAlbum] = useState(false);
  const [newAlbum, setNewAlbum] = useState({ title: "", albumType: "album", releaseDate: "", coverImageUrl: "", genre: "" });

  const { data: dashboard, isLoading } = useQuery<any>({
    queryKey: ["/api/artist/dashboard"],
  });

  const { data: registrations } = useQuery<any[]>({
    queryKey: ["/api/artist/pro-registrations"],
  });

  const { data: giftsData } = useQuery<any>({
    queryKey: ["/api/artist/gifts"],
  });

  const { data: albums, isLoading: albumsLoading } = useQuery<any[]>({
    queryKey: ["/api/artist/discography"],
  });

  const createAlbumMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/artist/discography/albums", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artist/discography"] });
      setShowAddAlbum(false);
      setNewAlbum({ title: "", albumType: "album", releaseDate: "", coverImageUrl: "", genre: "" });
      toast({ title: t('artist.discography.albumCreated') });
    },
  });

  const deleteAlbumMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/artist/discography/albums/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artist/discography"] });
      toast({ title: t('artist.discography.albumDeleted') });
    },
  });

  const spotifySearchMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("GET", `/api/artist/discography/spotify/search?q=${encodeURIComponent(query)}`);
      return res.json();
    },
  });

  const spotifyImportMutation = useMutation({
    mutationFn: async (spotifyArtistId: string) => {
      setImportingSpotify(true);
      const res = await apiRequest("POST", "/api/artist/discography/import/spotify", { spotifyArtistId });
      return res.json();
    },
    onSuccess: (data: any) => {
      setImportingSpotify(false);
      queryClient.invalidateQueries({ queryKey: ["/api/artist/discography"] });
      toast({ title: t('artist.discography.importSuccess'), description: `${data.count} albums imported` });
    },
    onError: () => setImportingSpotify(false),
  });

  const { data: connectStatus, isLoading: connectLoading, refetch: refetchConnect } = useQuery<any>({
    queryKey: ["/api/artist/connect/status"],
  });

  const { data: payoutsData, isLoading: payoutsLoading, refetch: refetchPayouts } = useQuery<any>({
    queryKey: ["/api/artist/payouts"],
  });

  const connectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/artist/connect/create"),
    onSuccess: async (res) => {
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const refreshConnectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/artist/connect/refresh"),
    onSuccess: async (res) => {
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    },
  });

  const dashboardLinkMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/artist/connect/login-link"),
    onSuccess: async (res) => {
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("bank_account");

  const payoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/artist/payouts", { 
      amountCents: Math.round(parseFloat(payoutAmount) * 100),
      method: payoutMethod
    }),
    onSuccess: async () => {
      toast({ title: "Payout Requested", description: "Your payout is being processed." });
      setPayoutAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/artist/payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/artist/connect/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/artist/dashboard"] });
    },
    onError: (err: any) => {
      toast({ title: "Payout Failed", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connect") === "complete") {
      refetchConnect();
      setActiveTab("payouts");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("connect") === "refresh") {
      refreshConnectMutation.mutate();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="h-full overflow-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white/[0.03] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!dashboard?.profile) {
    return (
      <div className="h-full overflow-auto">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-blue-600 mx-auto flex items-center justify-center">
            <Music className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold" data-testid="text-no-profile-title">
            {t('artist.noProfile.title')}
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            {t('artist.noProfile.subtitle')}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto text-sm">
            {["singer", "producer", "restaurant", "hobbyist"].map((type) => (
              <div key={type} className="bg-white/[0.03] border border-white/10 rounded-lg p-3 text-center">
                <p className="text-muted-foreground">{t(`artist.types.${type}`)}</p>
              </div>
            ))}
          </div>
          <Button
            size="lg"
            className="rounded-full px-8 bg-gradient-to-r from-primary to-blue-600"
            onClick={() => setLocation("/artist-onboarding")}
            data-testid="button-create-profile"
          >
            <Plus className="h-5 w-5 mr-2" />
            {t('artist.noProfile.createButton')}
          </Button>
        </div>
      </div>
    );
  }

  const { profile, isPro, platformFeePercent, subscribers, followers, totals, totalSongs, totalPlays } = dashboard;
  const wallet = giftsData?.wallet;
  const gifts = giftsData?.gifts || [];
  const transactions = giftsData?.transactions || [];

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center overflow-hidden">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Music className="h-7 w-7 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold" data-testid="text-artist-name">{profile.artistName}</h1>
                {profile.isVerified && <CheckCircle className="h-5 w-5 text-primary" />}
                {isPro && (
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0">
                    <Crown className="h-3 w-3 mr-1" /> PRO
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {t(`artist.types.${profile.artistType || 'independent'}`)}
                {profile.proEntity && profile.proEntity !== "none" && ` · ${profile.proEntity.toUpperCase()}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setLocation(`/artist/${profile.id}`)} data-testid="button-view-public">
              <ExternalLink className="h-4 w-4 mr-1" /> {t('artist.dashboard.viewPublic')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/artist-onboarding")} data-testid="button-edit-profile">
              <Settings className="h-4 w-4 mr-1" /> {t('artist.dashboard.editProfile')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-white/[0.03] border-white/[0.06] p-4" data-testid="stat-earnings">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              {t('artist.dashboard.totalEarnings')}
            </div>
            <p className="text-xl font-bold text-green-400">{formatCents(totals?.net || 0)}</p>
            {!isPro && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('artist.dashboard.platformFee', { percent: platformFeePercent })}
              </p>
            )}
          </Card>
          <Card className="bg-white/[0.03] border-white/[0.06] p-4" data-testid="stat-wallet">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Wallet className="h-3.5 w-3.5" />
              {t('artist.wallet.balance')}
            </div>
            <p className="text-xl font-bold text-pink-400">{formatCents(wallet?.balanceCents || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {gifts.filter((g: any) => g.status === "completed").length} {t('artist.gift.gifts')}
            </p>
          </Card>
          <Card className="bg-white/[0.03] border-white/[0.06] p-4" data-testid="stat-subscribers">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-3.5 w-3.5" />
              {t('artist.dashboard.subscribers')}
            </div>
            <p className="text-xl font-bold">{formatCount(subscribers || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCount(followers || 0)} {t('artist.dashboard.followers')}
            </p>
          </Card>
          <Card className="bg-white/[0.03] border-white/[0.06] p-4" data-testid="stat-songs">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Music className="h-3.5 w-3.5" />
              {t('artist.dashboard.totalSongs')}
            </div>
            <p className="text-xl font-bold">{totalSongs || 0}</p>
          </Card>
          <Card className="bg-white/[0.03] border-white/[0.06] p-4" data-testid="stat-plays">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Headphones className="h-3.5 w-3.5" />
              {t('artist.dashboard.totalPlays')}
            </div>
            <p className="text-xl font-bold">{formatCount(totalPlays || 0)}</p>
          </Card>
        </div>

        {!isPro && (
          <Card className="bg-gradient-to-r from-amber-500/10 to-orange-600/10 border-amber-500/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-6 w-6 text-amber-400" />
                <div>
                  <p className="font-medium">{t('artist.dashboard.upgradePro')}</p>
                  <p className="text-sm text-muted-foreground">{t('artist.dashboard.upgradeProDesc')}</p>
                </div>
              </div>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600" onClick={() => setLocation("/pricing")} data-testid="button-upgrade-pro">
                {t('artist.dashboard.upgradeButton')}
              </Button>
            </div>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/[0.03]">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="h-4 w-4 mr-1" /> {t('artist.dashboard.tabs.overview')}
            </TabsTrigger>
            <TabsTrigger value="gifts" data-testid="tab-gifts">
              <Gift className="h-4 w-4 mr-1" /> {t('artist.dashboard.tabs.gifts')}
            </TabsTrigger>
            <TabsTrigger value="copyright" data-testid="tab-copyright">
              <Shield className="h-4 w-4 mr-1" /> {t('artist.dashboard.tabs.copyright')}
            </TabsTrigger>
            <TabsTrigger value="monetization" data-testid="tab-monetization">
              <DollarSign className="h-4 w-4 mr-1" /> {t('artist.dashboard.tabs.monetization')}
            </TabsTrigger>
            <TabsTrigger value="discography" data-testid="tab-discography">
              <Disc className="h-4 w-4 mr-1" /> {t('artist.dashboard.tabs.discography')}
            </TabsTrigger>
            <TabsTrigger value="payouts" data-testid="tab-payouts">
              <Wallet className="h-4 w-4 mr-1" /> Payouts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <Card className="bg-white/[0.03] border-white/[0.06] p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                {t('artist.dashboard.revenueModel')}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 bg-white/[0.02] rounded-lg p-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">{t('artist.dashboard.howItWorks.title')}</p>
                    <p className="text-muted-foreground">{t('artist.dashboard.howItWorks.desc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white/[0.02] rounded-lg p-3">
                  <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                    <Gift className="h-4 w-4 text-pink-400" />
                  </div>
                  <div>
                    <p className="font-medium">{t('artist.dashboard.howItWorks.gifts')}</p>
                    <p className="text-muted-foreground">{t('artist.dashboard.howItWorks.giftsDesc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white/[0.02] rounded-lg p-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{t('artist.dashboard.howItWorks.subscribers')}</p>
                    <p className="text-muted-foreground">{t('artist.dashboard.howItWorks.subscribersDesc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white/[0.02] rounded-lg p-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Crown className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium">{t('artist.dashboard.howItWorks.proVsBasic')}</p>
                    <p className="text-muted-foreground">{t('artist.dashboard.howItWorks.proVsBasicDesc')}</p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="gifts" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="bg-gradient-to-br from-pink-500/10 to-blue-600/10 border-pink-500/20 p-4">
                <div className="flex items-center gap-2 text-pink-400 text-xs mb-1">
                  <Wallet className="h-3.5 w-3.5" />
                  {t('artist.wallet.availableBalance')}
                </div>
                <p className="text-2xl font-bold text-pink-400" data-testid="text-wallet-balance">
                  {formatCents(wallet?.balanceCents || 0)}
                </p>
              </Card>
              <Card className="bg-white/[0.03] border-white/[0.06] p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {t('artist.wallet.totalEarned')}
                </div>
                <p className="text-2xl font-bold text-green-400" data-testid="text-wallet-total">
                  {formatCents(wallet?.totalEarnedCents || 0)}
                </p>
              </Card>
              <Card className="bg-white/[0.03] border-white/[0.06] p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  {t('artist.wallet.totalFees')}
                </div>
                <p className="text-2xl font-bold text-red-400" data-testid="text-wallet-fees">
                  -{formatCents(wallet?.totalFeesPaidCents || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{t('artist.wallet.platformFeeRate')}</p>
              </Card>
            </div>

            <Card className="bg-white/[0.03] border-white/[0.06] p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Gift className="h-4 w-4 text-pink-400" />
                {t('artist.wallet.recentGifts')}
              </h3>
              {gifts.length > 0 ? (
                <div className="space-y-3">
                  {gifts.map((gift: any) => (
                    <div key={gift.id} className="flex items-center justify-between bg-white/[0.02] rounded-lg p-3" data-testid={`gift-row-${gift.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                          <Heart className="h-4 w-4 text-pink-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{gift.fanDisplayName || "Anonymous"}</p>
                          {gift.message && <p className="text-xs text-muted-foreground truncate max-w-xs">{gift.message}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-pink-400">{formatCents(gift.amountCents)}</p>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${gift.status === "completed" ? "text-green-400 border-green-400/30" : gift.status === "pending" ? "text-amber-400 border-amber-400/30" : "text-red-400 border-red-400/30"}`}
                          >
                            {gift.status === "completed" && <CheckCircle className="h-2.5 w-2.5 mr-0.5" />}
                            {gift.status === "pending" && <Clock className="h-2.5 w-2.5 mr-0.5" />}
                            {gift.status}
                          </Badge>
                          {gift.createdAt && <span className="text-[10px] text-muted-foreground">{timeAgo(gift.createdAt)}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Gift className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t('artist.wallet.noGifts')}</p>
                  <p className="text-xs mt-1">{t('artist.wallet.noGiftsDesc')}</p>
                </div>
              )}
            </Card>

            <Card className="bg-white/[0.03] border-white/[0.06] p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                {t('artist.wallet.transactionHistory')}
              </h3>
              {transactions.length > 0 ? (
                <div className="space-y-2">
                  {transactions.map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0" data-testid={`tx-row-${tx.id}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === "gift_received" ? "bg-green-500/20" : tx.type === "payout" ? "bg-amber-500/20" : "bg-red-500/20"}`}>
                          {tx.type === "gift_received" ? (
                            <ArrowDownRight className="h-3 w-3 text-green-400" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3 text-amber-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm">{tx.description || tx.type}</p>
                          {tx.createdAt && <p className="text-[10px] text-muted-foreground">{timeAgo(tx.createdAt)}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-mono font-medium ${tx.type === "gift_received" || tx.type === "subscription_income" ? "text-green-400" : "text-red-400"}`}>
                          {tx.type === "gift_received" || tx.type === "subscription_income" ? "+" : "-"}{formatCents(tx.netAmountCents || 0)}
                        </p>
                        {tx.platformFeeCents > 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            {t('artist.wallet.fee')}: -{formatCents(tx.platformFeeCents)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t('artist.wallet.noTransactions')}</p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="copyright" className="space-y-4 mt-4">
            <Card className="bg-white/[0.03] border-white/[0.06] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  {t('artist.dashboard.proStatus')}
                </h3>
                {profile.proEntity && profile.proEntity !== "none" ? (
                  <Badge variant="outline" className="text-green-400 border-green-400/30">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {profile.proEntity.toUpperCase()} · {profile.proMemberId || "---"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-400 border-amber-400/30">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {t('artist.dashboard.noProEntity')}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4">{t('artist.dashboard.proExplainer')}</p>

              {dashboard.registrations && dashboard.registrations.length > 0 ? (
                <div className="space-y-2">
                  {dashboard.registrations.map((reg: any) => (
                    <div key={reg.id} className="flex items-center justify-between bg-white/[0.02] rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{reg.workTitle}</p>
                          <p className="text-xs text-muted-foreground">{reg.proEntity?.toUpperCase()}</p>
                        </div>
                      </div>
                      <Badge variant={reg.registrationStatus === "registered" ? "default" : "outline"} className="text-xs">
                        {reg.registrationStatus === "registered" && <CheckCircle className="h-3 w-3 mr-1" />}
                        {reg.registrationStatus === "pending" && <Clock className="h-3 w-3 mr-1" />}
                        {reg.registrationStatus}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t('artist.dashboard.noRegistrations')}</p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="monetization" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="bg-white/[0.03] border-white/[0.06] p-4">
                <p className="text-xs text-muted-foreground mb-1">{t('artist.dashboard.grossRevenue')}</p>
                <p className="text-lg font-bold">{formatCents(totals?.gross || 0)}</p>
              </Card>
              <Card className="bg-white/[0.03] border-white/[0.06] p-4">
                <p className="text-xs text-muted-foreground mb-1">{t('artist.dashboard.platformFeeLabel')}</p>
                <p className="text-lg font-bold text-red-400">-{formatCents((totals?.gross || 0) - (totals?.net || 0))}</p>
              </Card>
              <Card className="bg-white/[0.03] border-white/[0.06] p-4">
                <p className="text-xs text-muted-foreground mb-1">{t('artist.dashboard.pendingPayout')}</p>
                <p className="text-lg font-bold text-amber-400">{formatCents(totals?.pending || 0)}</p>
              </Card>
            </div>

            <Card className="bg-white/[0.03] border-white/[0.06] p-5">
              <h3 className="font-semibold mb-3">{t('artist.dashboard.subscriptionPrice')}</h3>
              <p className="text-sm text-muted-foreground mb-2">{t('artist.dashboard.subscriptionPriceDesc')}</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">{formatCents(profile.monthlySubscriptionPrice || 299)}</span>
                <span className="text-muted-foreground text-sm">/ {t('artist.dashboard.perMonth')}</span>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="discography" className="space-y-4 mt-4">
            <Card className="bg-gradient-to-r from-green-500/10 to-emerald-600/10 border-green-500/20 p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Search className="h-4 w-4 text-green-400" />
                {t('artist.discography.importFromSpotify')}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {t('artist.discography.importDescription')}
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder={t('artist.discography.searchArtist')}
                  value={spotifySearch}
                  onChange={(e) => setSpotifySearch(e.target.value)}
                  className="bg-white/[0.05] border-white/10"
                  data-testid="input-spotify-search"
                />
                <Button
                  onClick={() => spotifySearchMutation.mutate(spotifySearch)}
                  disabled={!spotifySearch.trim() || spotifySearchMutation.isPending}
                  variant="default"
                  data-testid="button-spotify-search"
                >
                  {spotifySearchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              
              {spotifySearchMutation.data && (
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                  {(spotifySearchMutation.data as any[]).map((artist: any) => (
                    <div key={artist.id} className="flex items-center justify-between bg-white/[0.03] rounded-lg p-3" data-testid={`spotify-artist-${artist.id}`}>
                      <div className="flex items-center gap-3">
                        {artist.imageUrl ? (
                          <img src={artist.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Music className="h-5 w-5 text-green-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{artist.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {artist.genres?.slice(0, 3).join(", ")}
                            {artist.followers > 0 && ` · ${formatCount(artist.followers)} ${t('artist.profile.followers')}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => spotifyImportMutation.mutate(artist.id)}
                        disabled={importingSpotify}
                        variant="default"
                        data-testid={`button-import-${artist.id}`}
                      >
                        {importingSpotify ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                        {t('artist.discography.import')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="bg-white/[0.03] border-white/[0.06] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Disc className="h-4 w-4 text-primary" />
                  {t('artist.discography.yourAlbums')}
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddAlbum(!showAddAlbum)}
                  data-testid="button-add-album"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t('artist.discography.addAlbum')}
                </Button>
              </div>
              
              {showAddAlbum && (
                <div className="bg-white/[0.02] rounded-lg p-4 mb-4 space-y-3" data-testid="form-add-album">
                  <Input
                    placeholder={t('artist.discography.albumTitle')}
                    value={newAlbum.title}
                    onChange={(e) => setNewAlbum({...newAlbum, title: e.target.value})}
                    className="bg-white/[0.05] border-white/10"
                    data-testid="input-album-title"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={newAlbum.albumType} onValueChange={(val) => setNewAlbum({...newAlbum, albumType: val})} data-testid="select-album-type">
                      <SelectTrigger data-testid="select-album-type-trigger">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="album" data-testid="select-album-type-album">Album</SelectItem>
                        <SelectItem value="single" data-testid="select-album-type-single">Single</SelectItem>
                        <SelectItem value="ep" data-testid="select-album-type-ep">EP</SelectItem>
                        <SelectItem value="compilation" data-testid="select-album-type-compilation">Compilation</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      value={newAlbum.releaseDate}
                      onChange={(e) => setNewAlbum({...newAlbum, releaseDate: e.target.value})}
                      className="bg-white/[0.05] border-white/10"
                      data-testid="input-release-date"
                    />
                  </div>
                  <Input
                    placeholder={t('artist.discography.coverImageUrl')}
                    value={newAlbum.coverImageUrl}
                    onChange={(e) => setNewAlbum({...newAlbum, coverImageUrl: e.target.value})}
                    className="bg-white/[0.05] border-white/10"
                    data-testid="input-cover-url"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddAlbum(false)} data-testid="button-cancel-album">
                      {t('common.cancel')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => createAlbumMutation.mutate(newAlbum)}
                      disabled={!newAlbum.title.trim() || createAlbumMutation.isPending}
                      data-testid="button-save-album"
                    >
                      {createAlbumMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      {t('common.save')}
                    </Button>
                  </div>
                </div>
              )}
              
              {albumsLoading ? (
                <div className="text-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                </div>
              ) : albums && albums.length > 0 ? (
                <div className="space-y-3">
                  {albums.map((album: any) => (
                    <div key={album.id} className="flex items-center gap-4 bg-white/[0.02] rounded-lg p-3" data-testid={`album-row-${album.id}`}>
                      {album.coverImageUrl ? (
                        <img src={album.coverImageUrl} alt="" className="w-14 h-14 rounded object-cover" />
                      ) : (
                        <div className="w-14 h-14 rounded bg-white/[0.05] flex items-center justify-center">
                          <Disc className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{album.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {album.albumType} · {album.releaseDate || t('artist.discography.noDate')}
                          {album.tracksCount > 0 && ` · ${album.tracksCount} ${t('discography.tracks')}`}
                        </p>
                        {album.spotifyAlbumId && (
                          <Badge variant="outline" className="text-[10px] text-green-400 border-green-400/30 mt-1">
                            Spotify
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {album.spotifyUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={album.spotifyUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAlbumMutation.mutate(album.id)}
                          className="text-destructive"
                          data-testid={`button-delete-album-${album.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Disc className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t('artist.discography.noAlbums')}</p>
                  <p className="text-xs mt-1">{t('artist.discography.noAlbumsDesc')}</p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="payouts" className="space-y-4 mt-4">
            <Card className="bg-white/[0.03] border-white/[0.06] p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-primary" />
                Stripe Connect Account
              </h3>
              {connectLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : connectStatus?.connected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={connectStatus.payoutsEnabled ? "default" : "secondary"} data-testid="badge-connect-status">
                      {connectStatus.payoutsEnabled ? "Active" : connectStatus.detailsSubmitted ? "Restricted" : "Pending"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Account: {connectStatus.accountId?.slice(0, 12)}...</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Details Submitted</span>
                      <p className={connectStatus.detailsSubmitted ? "text-green-400" : "text-amber-400"}>
                        {connectStatus.detailsSubmitted ? "Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Payouts Enabled</span>
                      <p className={connectStatus.payoutsEnabled ? "text-green-400" : "text-amber-400"}>
                        {connectStatus.payoutsEnabled ? "Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Charges Enabled</span>
                      <p className={connectStatus.chargesEnabled ? "text-green-400" : "text-amber-400"}>
                        {connectStatus.chargesEnabled ? "Yes" : "No"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {!connectStatus.payoutsEnabled && (
                      <Button size="sm" onClick={() => refreshConnectMutation.mutate()} disabled={refreshConnectMutation.isPending} data-testid="button-complete-onboarding">
                        {refreshConnectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                        Complete Onboarding
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => dashboardLinkMutation.mutate()} disabled={dashboardLinkMutation.isPending} data-testid="button-stripe-dashboard">
                      <ExternalLink className="h-4 w-4 mr-1" /> Stripe Dashboard
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Connect your Stripe account to receive payouts from gifts, subscriptions, and platform earnings.
                  </p>
                  <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending} data-testid="button-connect-stripe">
                    {connectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <LinkIcon className="h-4 w-4 mr-1" />}
                    Connect Stripe Account
                  </Button>
                </div>
              )}
            </Card>

            {connectStatus?.connected && (
              <Card className="bg-white/[0.03] border-white/[0.06] p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  Request Payout
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <Card className="bg-white/[0.03] border-white/[0.06] p-3">
                    <p className="text-xs text-muted-foreground">Available Balance</p>
                    <p className="text-lg font-bold text-green-400" data-testid="text-available-balance">
                      {formatCents(payoutsData?.wallet?.balanceCents || 0)}
                    </p>
                  </Card>
                  <Card className="bg-white/[0.03] border-white/[0.06] p-3">
                    <p className="text-xs text-muted-foreground">Pending Payouts</p>
                    <p className="text-lg font-bold text-amber-400" data-testid="text-pending-payouts">
                      {formatCents(payoutsData?.wallet?.pendingBalanceCents || 0)}
                    </p>
                  </Card>
                  <Card className="bg-white/[0.03] border-white/[0.06] p-3">
                    <p className="text-xs text-muted-foreground">Lifetime Payouts</p>
                    <p className="text-lg font-bold" data-testid="text-lifetime-payouts">
                      {formatCents(payoutsData?.wallet?.lifetimePayoutsCents || 0)}
                    </p>
                  </Card>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Amount (USD)</label>
                    <Input
                      type="number"
                      placeholder="5.00"
                      min="5"
                      step="0.01"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      data-testid="input-payout-amount"
                    />
                  </div>
                  <div className="w-full sm:w-48">
                    <label className="text-xs text-muted-foreground mb-1 block">Payout Method</label>
                    <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                      <SelectTrigger data-testid="select-payout-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_account">
                          <span className="flex items-center gap-1"><Building className="h-3 w-3" /> Bank Account</span>
                        </SelectItem>
                        <SelectItem value="card_instant">
                          <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Instant Card</span>
                        </SelectItem>
                        <SelectItem value="stripe_connect">
                          <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> Stripe Connect</span>
                        </SelectItem>
                        <SelectItem value="paypal">
                          <span className="flex items-center gap-1"><Wallet className="h-3 w-3" /> PayPal (Manual)</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => payoutMutation.mutate()}
                    disabled={payoutMutation.isPending || !payoutAmount || parseFloat(payoutAmount) < 5 || (payoutMethod !== "paypal" && !connectStatus?.payoutsEnabled)}
                    data-testid="button-request-payout"
                  >
                    {payoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                    Request Payout
                  </Button>
                </div>
                {!connectStatus.payoutsEnabled && (
                  <p className="text-xs text-amber-400 mt-2">
                    Complete Stripe onboarding above to enable payouts.
                  </p>
                )}
              </Card>
            )}

            <Card className="bg-white/[0.03] border-white/[0.06] p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Payout History
              </h3>
              {payoutsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : !payoutsData?.payouts?.length ? (
                <p className="text-sm text-muted-foreground">No payout requests yet.</p>
              ) : (
                <div className="space-y-2">
                  {payoutsData.payouts.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-md bg-white/[0.02] border border-white/[0.04]" data-testid={`payout-row-${p.id}`}>
                      <div className="flex items-center gap-3">
                        {p.status === "paid" ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : p.status === "failed" ? (
                          <AlertCircle className="h-4 w-4 text-red-400" />
                        ) : p.status === "processing" ? (
                          <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{formatCents(p.amountCents)}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.method === "bank_account" ? "Bank Account" : p.method === "card_instant" ? "Instant Card" : p.method === "paypal" ? "PayPal" : "Stripe Connect"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary"}
                          data-testid={`badge-payout-status-${p.id}`}
                        >
                          {p.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">{p.createdAt ? timeAgo(p.createdAt) : ""}</p>
                        {p.failureReason && <p className="text-xs text-red-400">{p.failureReason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
