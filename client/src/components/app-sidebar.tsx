import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import dgbLogo from "@assets/DGB_studio_mobil_1771220799892.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Disc,
  Sparkles,
  Library,
  PenLine,
  HelpCircle,
  Scissors,
  Music,
  LogOut,
  Settings,
  CreditCard,
  Store,
  Zap,
  Infinity,
  Wrench,
  BookOpen,
  Palette,
  Globe,
  Crown,
  Shield,
  FileText,
  Lock,
} from "lucide-react";
import { useAdminCheck } from "@/hooks/use-admin";
import { useCredits } from "@/hooks/use-credits";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { titleKey: "nav.create", url: "/create", icon: Sparkles },
  { titleKey: "nav.discover", url: "/discover", icon: Disc },
  { titleKey: "nav.discography", url: "/discography", icon: Music },
  { titleKey: "nav.library", url: "/library", icon: Library },
  { titleKey: "nav.lyrics", url: "/lyrics", icon: PenLine },
  { titleKey: "nav.quiz", url: "/quiz", icon: HelpCircle },
];

const ARTIST_ITEMS = [
  { titleKey: "nav.artistDashboard", url: "/artist-dashboard", icon: Crown },
  { titleKey: "nav.copyright", url: "/copyright", icon: Shield },
];

const TOOLS_ITEMS = [
  { titleKey: "nav.studio", url: "/studio", icon: Scissors },
  { titleKey: "nav.sampleLab", url: "/sample-lab", icon: Music },
  { titleKey: "nav.audioTools", url: "/audio-tools", icon: Wrench },
  { titleKey: "nav.coverDesigner", url: "/cover-designer", icon: Palette },
  { titleKey: "nav.styleKits", url: "/style-kits", icon: Disc },
  { titleKey: "nav.producerStore", url: "/producer-store", icon: Store },
  { titleKey: "nav.blog", url: "/blog", icon: BookOpen },
  { titleKey: "nav.pricing", url: "/pricing", icon: CreditCard },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { data: adminCheck } = useAdminCheck();
  const { data: creditsData } = useCredits();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === "es" ? "en" : "es";
    i18n.changeLanguage(newLang);
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 pb-2">
        <div
          className="flex items-center justify-center cursor-pointer group"
          onClick={() => setLocation("/create")}
          data-testid="link-sidebar-logo"
        >
          <img
            src={dgbLogo}
            alt="DGB Studio"
            className="h-20 w-20 rounded-full drop-shadow-[0_0_20px_rgba(0,200,255,0.4)] group-hover:drop-shadow-[0_0_30px_rgba(217,70,239,0.5)] transition-all duration-300"
          />
        </div>
        <div className="h-px mt-2 bg-gradient-to-r from-transparent via-[#D946EF]/40 to-transparent" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#D946EF]/70 font-semibold uppercase tracking-wider text-[10px]">{t("nav.music")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.url || (item.url === "/create" && location === "/dashboard");
                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={isActive ? "bg-gradient-to-r from-[#00C8FF]/15 to-[#D946EF]/15 border-l-2 border-[#00C8FF] text-[#00C8FF]" : "hover:bg-gradient-to-r hover:from-[#00C8FF]/5 hover:to-[#D946EF]/5 transition-all duration-200"}
                      data-testid={`link-sidebar-${item.titleKey.split(".").pop()?.toLowerCase()}`}
                    >
                      <a
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault();
                          setLocation(item.url);
                        }}
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? "text-[#00C8FF]" : "text-[#D946EF]/60"}`} />
                        <span>{t(item.titleKey)}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-[#D946EF]/20 to-transparent" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[#D946EF]/70 font-semibold uppercase tracking-wider text-[10px]">{t("nav.artist")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ARTIST_ITEMS.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={isActive ? "bg-gradient-to-r from-[#00C8FF]/15 to-[#D946EF]/15 border-l-2 border-[#D946EF] text-[#D946EF]" : "hover:bg-gradient-to-r hover:from-[#00C8FF]/5 hover:to-[#D946EF]/5 transition-all duration-200"}
                      data-testid={`link-sidebar-${item.titleKey.split(".").pop()?.toLowerCase()}`}
                    >
                      <a
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault();
                          setLocation(item.url);
                        }}
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? "text-[#D946EF]" : "text-amber-400/70"}`} />
                        <span>{t(item.titleKey)}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-[#D946EF]/20 to-transparent" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[#D946EF]/70 font-semibold uppercase tracking-wider text-[10px]">{t("nav.tools")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {TOOLS_ITEMS.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={isActive ? "bg-gradient-to-r from-[#00C8FF]/15 to-[#D946EF]/15 border-l-2 border-[#D946EF] text-[#D946EF]" : "hover:bg-gradient-to-r hover:from-[#00C8FF]/5 hover:to-[#D946EF]/5 transition-all duration-200"}
                      data-testid={`link-sidebar-${item.titleKey.split(".").pop()?.toLowerCase()}`}
                    >
                      <a
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault();
                          setLocation(item.url);
                        }}
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? "text-[#D946EF]" : "text-[#00C8FF]/50"}`} />
                        <span>{t(item.titleKey)}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {adminCheck?.isAdmin && (
          <>
            <div className="mx-4 h-px bg-gradient-to-r from-transparent via-[#D946EF]/20 to-transparent" />
            <SidebarGroup>
              <SidebarGroupLabel className="text-[#D946EF]/70 font-semibold uppercase tracking-wider text-[10px]">{t("nav.admin")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/admin"}
                      className={location === "/admin" ? "bg-gradient-to-r from-[#00C8FF]/15 to-[#D946EF]/15 border-l-2 border-[#00C8FF] text-[#00C8FF]" : "hover:bg-gradient-to-r hover:from-[#00C8FF]/5 hover:to-[#D946EF]/5 transition-all duration-200"}
                      data-testid="link-sidebar-admin"
                    >
                      <a
                        href="/admin"
                        onClick={(e) => {
                          e.preventDefault();
                          setLocation("/admin");
                        }}
                      >
                        <Settings className={`h-4 w-4 ${location === "/admin" ? "text-[#00C8FF]" : "text-[#D946EF]/60"}`} />
                        <span>{t("nav.adminPanel")}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {user && (
        <SidebarFooter className="p-3 space-y-2">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#D946EF]/5 transition-colors"
            onClick={toggleLanguage}
            data-testid="button-language-toggle"
          >
            <Globe className="h-4 w-4 text-[#D946EF]/60 shrink-0" />
            <span className="text-xs text-muted-foreground">
              {t("language.label")}: {i18n.language === "es" ? t("language.es") : t("language.en")}
            </span>
          </div>
          {creditsData && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-[#00C8FF]/5 to-[#D946EF]/5 border border-[#D946EF]/15 cursor-pointer hover:from-[#00C8FF]/10 hover:to-[#D946EF]/10 transition-all duration-200"
              onClick={() => setLocation("/pricing")}
              data-testid="link-credits-display"
            >
              <Zap className="h-4 w-4 text-[#00C8FF] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">{t("common.credits")}</p>
                <p className="text-sm font-bold bg-gradient-to-r from-[#00C8FF] to-[#D946EF] bg-clip-text text-transparent" data-testid="text-credits-balance">
                  {creditsData.isUnlimited ? (
                    <span className="flex items-center gap-1"><Infinity className="h-4 w-4 text-[#00C8FF]" /> {t("common.unlimited")}</span>
                  ) : (
                    <span>{creditsData.credits} {t("common.remaining")}</span>
                  )}
                </p>
              </div>
              {!creditsData.isUnlimited && creditsData.credits <= 3 && creditsData.credits > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">{t("common.low")}</Badge>
              )}
              {!creditsData.isUnlimited && creditsData.credits === 0 && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">{t("common.upgrade")}</Badge>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-gradient-to-r from-[#00C8FF]/5 to-[#D946EF]/10 border border-white/5">
            <Avatar className="h-7 w-7 ring-1 ring-[#D946EF]/30">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs bg-gradient-to-br from-[#00C8FF] to-[#D946EF] text-white font-bold">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.firstName} {user.lastName}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              className="text-muted-foreground hover:text-[#D946EF]"
              data-testid="button-sidebar-logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center justify-center gap-3 px-2 pt-1">
            <a
              href="/terms"
              onClick={(e) => { e.preventDefault(); setLocation("/terms"); }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-[#00C8FF] transition-colors"
              data-testid="link-sidebar-terms"
            >
              <FileText className="h-3 w-3" />
              <span>{t("legal.terms")}</span>
            </a>
            <span className="text-muted-foreground/30 text-[10px]">|</span>
            <a
              href="/privacy"
              onClick={(e) => { e.preventDefault(); setLocation("/privacy"); }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-[#00C8FF] transition-colors"
              data-testid="link-sidebar-privacy"
            >
              <Lock className="h-3 w-3" />
              <span>{t("legal.privacy")}</span>
            </a>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
