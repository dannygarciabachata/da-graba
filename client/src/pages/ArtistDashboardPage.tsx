import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function ArtistDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: dashboard, isLoading } = useQuery<any>({
    queryKey: ["/api/artist/dashboard"],
  });

  const { data: registrations } = useQuery<any[]>({
    queryKey: ["/api/artist/pro-registrations"],
  });

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
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-purple-600 mx-auto flex items-center justify-center">
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
            className="rounded-full px-8 bg-gradient-to-r from-primary to-purple-600"
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

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center overflow-hidden">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            <TabsTrigger value="copyright" data-testid="tab-copyright">
              <Shield className="h-4 w-4 mr-1" /> {t('artist.dashboard.tabs.copyright')}
            </TabsTrigger>
            <TabsTrigger value="monetization" data-testid="tab-monetization">
              <DollarSign className="h-4 w-4 mr-1" /> {t('artist.dashboard.tabs.monetization')}
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
        </Tabs>
      </div>
    </div>
  );
}
