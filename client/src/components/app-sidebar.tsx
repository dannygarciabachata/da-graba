import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import dgbLogo from "@assets/Dgb_1771188880013.png";
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
} from "lucide-react";
import { useAdminCheck } from "@/hooks/use-admin";
import { useCredits } from "@/hooks/use-credits";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { titleKey: "nav.create", url: "/create", icon: Sparkles },
  { titleKey: "nav.discover", url: "/discover", icon: Disc },
  { titleKey: "nav.library", url: "/library", icon: Library },
  { titleKey: "nav.lyrics", url: "/lyrics", icon: PenLine },
  { titleKey: "nav.quiz", url: "/quiz", icon: HelpCircle },
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
      <SidebarHeader className="p-4">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => setLocation("/create")}
          data-testid="link-sidebar-logo"
        >
          <img src={dgbLogo} alt="DGB AUDIO" className="h-10 w-auto" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.music")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.url || (item.url === "/create" && location === "/dashboard");
                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`link-sidebar-${item.titleKey.split(".").pop()?.toLowerCase()}`}
                    >
                      <a
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault();
                          setLocation(item.url);
                        }}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{t(item.titleKey)}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.tools")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {TOOLS_ITEMS.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`link-sidebar-${item.titleKey.split(".").pop()?.toLowerCase()}`}
                    >
                      <a
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault();
                          setLocation(item.url);
                        }}
                      >
                        <item.icon className="h-4 w-4" />
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
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>{t("nav.admin")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/admin"}
                      data-testid="link-sidebar-admin"
                    >
                      <a
                        href="/admin"
                        onClick={(e) => {
                          e.preventDefault();
                          setLocation("/admin");
                        }}
                      >
                        <Settings className="h-4 w-4" />
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer hover-elevate"
            onClick={toggleLanguage}
            data-testid="button-language-toggle"
          >
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">
              {t("language.label")}: {i18n.language === "es" ? t("language.es") : t("language.en")}
            </span>
          </div>
          {creditsData && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => setLocation("/pricing")}
              data-testid="link-credits-display"
            >
              <Zap className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">{t("common.credits")}</p>
                <p className="text-sm font-bold" data-testid="text-credits-balance">
                  {creditsData.isUnlimited ? (
                    <span className="flex items-center gap-1"><Infinity className="h-4 w-4" /> {t("common.unlimited")}</span>
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
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-sidebar-accent/50">
            <Avatar className="h-7 w-7">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs bg-primary text-black font-bold">
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
              className="text-muted-foreground"
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
