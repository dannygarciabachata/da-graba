import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import daIcon from "@assets/Icon_1771525459723.png";
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
  ListMusic,
  Home,
  Bell,
  Search,
  MoreHorizontal,
  Gift,
  Megaphone,
  Info,
  MessageSquare,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAdminCheck } from "@/hooks/use-admin";
import { useCredits } from "@/hooks/use-credits";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { titleKey: "nav.home", url: "/home", icon: Home },
  { titleKey: "nav.create", url: "/create", icon: Sparkles },
  { titleKey: "nav.discover", url: "/discover", icon: Disc },
  { titleKey: "nav.discography", url: "/discography", icon: Music },
  { titleKey: "nav.library", url: "/library", icon: Library },
  { titleKey: "nav.playlists", url: "/my-playlists", icon: ListMusic },
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
    <Sidebar
      className="relative overflow-hidden"
      style={{
        backgroundColor: "hsl(247, 82%, 18%)",
      }}
    >
      <SidebarHeader className="relative z-10 p-4 pb-2">
        <div
          className="flex items-center justify-center cursor-pointer group"
          onClick={() => setLocation("/home")}
          data-testid="link-sidebar-logo"
        >
          <img
            src={daIcon}
            alt="DA GRABA Studio"
            className="h-28 w-auto max-w-[180px] drop-shadow-[0_0_25px_rgba(255,117,31,0.4)] group-hover:drop-shadow-[0_0_35px_rgba(255,117,31,0.6)] transition-all duration-300 object-contain"
          />
        </div>
        <div className="h-px mt-2 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      </SidebarHeader>

      <SidebarContent className="relative z-10">
        <SidebarGroup>
          <SidebarGroupLabel className="text-primary/70 font-semibold uppercase tracking-wider text-[10px]">{t("nav.music")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.url || (item.url === "/create" && location === "/dashboard");
                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={isActive ? "bg-gradient-to-r from-[#ff751f]/15 to-[#FF8C00]/15 border-l-2 border-[#ff751f] text-[#ff751f]" : "hover:bg-gradient-to-r hover:from-[#ff751f]/5 hover:to-[#FF8C00]/5 transition-all duration-200"}
                      data-testid={`link-sidebar-${item.titleKey.split(".").pop()?.toLowerCase()}`}
                    >
                      <a
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault();
                          setLocation(item.url);
                        }}
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? "text-[#ff751f]" : "text-[#FF8C00]/60"}`} />
                        <span>{t(item.titleKey)}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-[#FF8C00]/20 to-transparent" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[#FF8C00]/70 font-semibold uppercase tracking-wider text-[10px]">{t("nav.artist")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ARTIST_ITEMS.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={isActive ? "bg-gradient-to-r from-[#ff751f]/15 to-[#FF8C00]/15 border-l-2 border-[#FF8C00] text-[#FF8C00]" : "hover:bg-gradient-to-r hover:from-[#ff751f]/5 hover:to-[#FF8C00]/5 transition-all duration-200"}
                      data-testid={`link-sidebar-${item.titleKey.split(".").pop()?.toLowerCase()}`}
                    >
                      <a
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault();
                          setLocation(item.url);
                        }}
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? "text-[#FF8C00]" : "text-amber-400/70"}`} />
                        <span>{t(item.titleKey)}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-[#FF8C00]/20 to-transparent" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[#FF8C00]/70 font-semibold uppercase tracking-wider text-[10px]">{t("nav.tools")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {TOOLS_ITEMS.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={isActive ? "bg-gradient-to-r from-[#ff751f]/15 to-[#FF8C00]/15 border-l-2 border-[#FF8C00] text-[#FF8C00]" : "hover:bg-gradient-to-r hover:from-[#ff751f]/5 hover:to-[#FF8C00]/5 transition-all duration-200"}
                      data-testid={`link-sidebar-${item.titleKey.split(".").pop()?.toLowerCase()}`}
                    >
                      <a
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault();
                          setLocation(item.url);
                        }}
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? "text-[#FF8C00]" : "text-[#ff751f]/50"}`} />
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
            <div className="mx-4 h-px bg-gradient-to-r from-transparent via-[#FF8C00]/20 to-transparent" />
            <SidebarGroup>
              <SidebarGroupLabel className="text-[#FF8C00]/70 font-semibold uppercase tracking-wider text-[10px]">{t("nav.admin")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/admin"}
                      className={location === "/admin" ? "bg-gradient-to-r from-[#ff751f]/15 to-[#FF8C00]/15 border-l-2 border-[#ff751f] text-[#ff751f]" : "hover:bg-gradient-to-r hover:from-[#ff751f]/5 hover:to-[#FF8C00]/5 transition-all duration-200"}
                      data-testid="link-sidebar-admin"
                    >
                      <a
                        href="/admin"
                        onClick={(e) => {
                          e.preventDefault();
                          setLocation("/admin");
                        }}
                      >
                        <Settings className={`h-4 w-4 ${location === "/admin" ? "text-[#ff751f]" : "text-[#FF8C00]/60"}`} />
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
        <SidebarFooter className="relative z-10 p-3 space-y-2">
          {creditsData && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-[#ff751f]/5 to-[#FF8C00]/5 border border-[#FF8C00]/15 cursor-pointer hover:from-[#ff751f]/10 hover:to-[#FF8C00]/10 transition-all duration-200"
              onClick={() => setLocation("/pricing")}
              data-testid="link-credits-display"
            >
              <Zap className="h-4 w-4 text-[#ff751f] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">{t("common.credits")}</p>
                <p className="text-sm font-bold bg-gradient-to-r from-[#ff751f] to-[#FF8C00] bg-clip-text text-transparent" data-testid="text-credits-balance">
                  {creditsData.isUnlimited ? (
                    <span className="flex items-center gap-1"><Infinity className="h-4 w-4 text-[#ff751f]" /> {t("common.unlimited")}</span>
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

          <SidebarMenu>
            <SidebarMenuItem>
              <Popover>
                <PopoverTrigger asChild>
                  <SidebarMenuButton
                    className="hover:bg-gradient-to-r hover:from-[#ff751f]/5 hover:to-[#FF8C00]/5 transition-all duration-200"
                    data-testid="button-sidebar-more"
                  >
                    <MoreHorizontal className="h-4 w-4 text-[#FF8C00]/60" />
                    <span>{t("nav.more", "More")}</span>
                  </SidebarMenuButton>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-56 p-1.5 bg-[#141414] border-white/10" sideOffset={8}>
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" className="justify-start gap-3 text-sm font-normal" onClick={() => setLocation("/pricing")} data-testid="more-earn-credits">
                      <Gift className="h-4 w-4 text-muted-foreground" />{t("nav.earnCredits", "Earn Credits")}
                    </Button>
                    <Button variant="ghost" className="justify-start gap-3 text-sm font-normal" onClick={() => setLocation("/blog")} data-testid="more-whats-new">
                      <Megaphone className="h-4 w-4 text-muted-foreground" />{t("nav.whatsNew", "What's New?")}
                    </Button>
                    <div className="h-px bg-white/5 my-1" />
                    <Button variant="ghost" className="justify-start gap-3 text-sm font-normal" onClick={() => setLocation("/support")} data-testid="more-help">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />{t("nav.help", "Help")}
                    </Button>
                    <Button variant="ghost" className="justify-start gap-3 text-sm font-normal" onClick={() => setLocation("/about")} data-testid="more-about">
                      <Info className="h-4 w-4 text-muted-foreground" />{t("nav.about", "About")}
                    </Button>
                    <Button variant="ghost" className="justify-start gap-3 text-sm font-normal" onClick={() => setLocation("/blog")} data-testid="more-blog">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />{t("nav.blog", "Blog")}
                    </Button>
                    <Button variant="ghost" className="justify-start gap-3 text-sm font-normal" data-testid="more-feedback">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />{t("nav.feedback", "Feedback")}
                    </Button>
                    <div className="h-px bg-white/5 my-1" />
                    <Button variant="ghost" className="justify-start gap-3 text-sm font-normal" onClick={() => setLocation("/terms")} data-testid="more-terms">
                      <FileText className="h-4 w-4 text-muted-foreground" />{t("legal.terms")}
                    </Button>
                    <Button variant="ghost" className="justify-start gap-3 text-sm font-normal" onClick={() => setLocation("/privacy")} data-testid="more-privacy">
                      <Lock className="h-4 w-4 text-muted-foreground" />{t("legal.privacy")}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </SidebarMenuItem>
          </SidebarMenu>

          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#FF8C00]/5 transition-colors"
            onClick={toggleLanguage}
            data-testid="button-language-toggle"
          >
            <Globe className="h-4 w-4 text-[#FF8C00]/60 shrink-0" />
            <span className="text-xs text-muted-foreground">
              {t("language.label")}: {i18n.language === "es" ? t("language.es") : t("language.en")}
            </span>
          </div>

          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-gradient-to-r from-[#ff751f]/5 to-[#FF8C00]/10 border border-white/5">
            <Avatar className="h-7 w-7 ring-1 ring-[#FF8C00]/30">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs bg-gradient-to-br from-[#ff751f] to-[#FF8C00] text-white font-bold">
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
              className="text-muted-foreground hover:text-[#FF8C00]"
              data-testid="button-sidebar-logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
