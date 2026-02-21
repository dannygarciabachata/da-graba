import { useLocation } from "wouter";
import { forwardRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAdminCheck } from "@/hooks/use-admin";
import { useCredits } from "@/hooks/use-credits";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sparkles,
  Library,
  Music,
  Scissors,
  Mic,
  Settings,
  CreditCard,
  Store,
  Wrench,
  Palette,
  Globe,
  Crown,
  Shield,
  LogOut,
  Zap,
  Infinity,
  Disc,
  PenLine,
  HelpCircle,
  ListMusic,
  Home,
  ChevronUp,
  Headphones,
  BookOpen,
  FileText,
  User,
  Receipt,
  Radio,
  Compass,
} from "lucide-react";
import daGrabaLogo from "@assets/Logomobil2_1771526285843.png";

const NavLink = forwardRef<HTMLAnchorElement, { href: string; children: React.ReactNode; className?: string; "data-testid"?: string }>(
  ({ href, children, className, ...props }, ref) => {
    const [, setLocation] = useLocation();
    const handleClick = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      setLocation(href);
    }, [href, setLocation]);
    return (
      <a ref={ref} href={href} onClick={handleClick} className={className} {...props}>{children}</a>
    );
  }
);
NavLink.displayName = "NavLink";

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

function NavSection({ items, isActive }: { items: NavItem[]; isActive: (path: string) => boolean }) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.path}>
          <SidebarMenuButton
            asChild
            isActive={isActive(item.path)}
            tooltip={item.title}
          >
            <NavLink href={item.path} data-testid={`sidebar-${item.path.slice(1)}`}>
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: adminCheck } = useAdminCheck();
  const { data: creditsData } = useCredits();
  const { t, i18n } = useTranslation();
  const { state } = useSidebar();

  const isActive = (path: string) => location === path || location.startsWith(path + "/");
  const isCollapsed = state === "collapsed";

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "es" ? "en" : "es");
  };

  const mainItems: NavItem[] = [
    { title: t("nav.home", "Inicio"), icon: Home, path: "/home" },
    { title: t("nav.create", "Crear"), icon: Sparkles, path: "/create" },
    { title: t("nav.discover", "Descubrir"), icon: Compass, path: "/discover" },
    { title: t("nav.library", "Biblioteca"), icon: Library, path: "/library" },
  ];

  const musicItems: NavItem[] = [
    { title: t("nav.discography", "Discografía"), icon: Music, path: "/discography" },
    { title: t("nav.playlists", "Playlists"), icon: ListMusic, path: "/my-playlists" },
    { title: t("nav.lyrics", "Letras"), icon: PenLine, path: "/lyrics" },
    { title: t("nav.quiz", "Quiz"), icon: HelpCircle, path: "/quiz" },
  ];

  const toolsItems: NavItem[] = [
    { title: t("nav.studio", "Studio DAW"), icon: Scissors, path: "/studio" },
    { title: t("nav.sampleLab", "Sample Lab"), icon: Mic, path: "/sample-lab" },
    { title: "Stem Splitter", icon: Headphones, path: "/stem-splitter" },
    { title: "Voice Lab", icon: Radio, path: "/voice-lab" },
    { title: t("nav.audioTools", "Audio Tools"), icon: Wrench, path: "/audio-tools" },
    { title: t("nav.coverDesigner", "Cover Designer"), icon: Palette, path: "/cover-designer" },
  ];

  const storeItems: NavItem[] = [
    { title: t("nav.styleKits", "Style Kits"), icon: Disc, path: "/style-kits" },
    { title: t("nav.producerStore", "Producer Store"), icon: Store, path: "/producer-store" },
  ];

  const artistItems: NavItem[] = [
    { title: t("nav.artistDashboard", "Dashboard"), icon: Crown, path: "/artist-dashboard" },
    { title: t("nav.copyright", "Copyright"), icon: Shield, path: "/copyright" },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-white/[0.06]">
      <SidebarHeader className="p-3">
        <NavLink href="/home" className="flex items-center gap-2" data-testid="sidebar-logo">
          <img
            src={daGrabaLogo}
            alt="DA GRABA"
            className={`object-contain drop-shadow-[0_0_14px_rgba(255,117,31,0.45)] transition-all ${
              isCollapsed ? "h-8 w-8" : "h-[44px] w-[150px]"
            }`}
          />
        </NavLink>

        {!isCollapsed && creditsData && (
          <NavLink
            href="/pricing"
            className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10"
            data-testid="sidebar-credits"
          >
            <Zap className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-medium text-orange-300">
              {creditsData.isUnlimited ? (
                <span className="flex items-center gap-1"><Infinity className="h-3.5 w-3.5" /></span>
              ) : (
                <span>{creditsData.credits} {t('common.credits', 'créditos')}</span>
              )}
            </span>
          </NavLink>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <NavSection items={mainItems} isActive={isActive} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-white/[0.06]" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-orange-400/60 px-2">{t("nav.music", "Música")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavSection items={musicItems} isActive={isActive} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-white/[0.06]" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-orange-400/60 px-2">{t("nav.tools", "Herramientas")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavSection items={toolsItems} isActive={isActive} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-white/[0.06]" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-orange-400/60 px-2">{t("nav.producerStore", "Tienda")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavSection items={storeItems} isActive={isActive} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-white/[0.06]" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-orange-400/60 px-2">{t("nav.artist", "Artista")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavSection items={artistItems} isActive={isActive} />
          </SidebarGroupContent>
        </SidebarGroup>

        {adminCheck?.isAdmin && (
          <>
            <SidebarSeparator className="bg-white/[0.06]" />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/admin")}
                      tooltip="Admin"
                    >
                      <NavLink href="/admin" data-testid="sidebar-admin">
                        <Settings className="h-4 w-4" />
                        <span>Admin</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleLanguage}
              tooltip={i18n.language === "es" ? "English" : "Español"}
              data-testid="sidebar-language"
            >
              <Globe className="h-4 w-4" />
              <span>{i18n.language === "es" ? "English" : "Español"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={t("nav.pricing", "Plan")}
            >
              <NavLink href="/pricing" data-testid="sidebar-pricing">
                <CreditCard className="h-4 w-4" />
                <span>{t("nav.pricing", "Mejorar Plan")}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator className="bg-white/[0.06] my-1" />

        {user && (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton data-testid="sidebar-user-menu">
                    <Avatar className="h-6 w-6 ring-1 ring-orange-500/40">
                      <AvatarImage src={user.profileImageUrl || undefined} />
                      <AvatarFallback className="text-[10px] bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{user.firstName} {user.lastName}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{user.email || ""}</span>
                    </div>
                    <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="start"
                  className="w-56 bg-slate-950/95 backdrop-blur-xl border-white/10"
                >
                  <DropdownMenuItem asChild>
                    <NavLink href="/profile" data-testid="sidebar-menu-profile">
                      <User className="w-4 h-4 mr-2 text-orange-400/60" />{t("profile.myProfile", "Mi Perfil")}
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <NavLink href="/profile?tab=billing" data-testid="sidebar-menu-billing">
                      <Receipt className="w-4 h-4 mr-2 text-orange-400/60" />{t("profile.billing", "Facturación")}
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <NavLink href="/profile?tab=artist" data-testid="sidebar-menu-artist">
                      <Crown className="w-4 h-4 mr-2 text-orange-400/60" />{t("profile.artistProfile", "Perfil Artístico")}
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem asChild>
                    <NavLink href="/blog" data-testid="sidebar-menu-blog">
                      <BookOpen className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.blog", "Blog")}
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <NavLink href="/terms" data-testid="sidebar-menu-terms">
                      <FileText className="w-4 h-4 mr-2 text-orange-400/60" />{t("legal.terms", "Terms")}
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={() => logout()} className="text-red-400 focus:text-red-400" data-testid="sidebar-menu-logout">
                    <LogOut className="w-4 h-4 mr-2" />{t("common.logout", "Cerrar Sesión")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
