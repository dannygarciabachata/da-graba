import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useAdminCheck } from "@/hooks/use-admin";
import { useCredits } from "@/hooks/use-credits";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  BookOpen,
  Palette,
  Globe,
  Crown,
  Shield,
  LogOut,
  Menu,
  Zap,
  Infinity,
  Disc,
  PenLine,
  HelpCircle,
  ListMusic,
  Home,
  ChevronDown,
  FileText,
  Lock,
} from "lucide-react";
import daGrabaLogo from "@assets/Logomobil2_1771526285843.png";
import { HeaderSpectrum } from "@/components/HeaderSpectrum";

export function AppHeader() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { data: adminCheck } = useAdminCheck();
  const { data: creditsData } = useCredits();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === "es" ? "en" : "es";
    i18n.changeLanguage(newLang);
  };

  const isActive = (path: string) => location === path || location.startsWith(path + "/");

  return (
    <header className="border-b border-white/10 backdrop-blur-xl bg-black/20 sticky top-0 z-50" data-testid="app-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => setLocation("/home")}
              data-testid="link-header-logo"
            >
              <img src={daGrabaLogo} alt="DA GRABA" className="h-[80px] w-[225px] object-contain drop-shadow-[0_0_12px_rgba(255,117,31,0.4)]" />
            </div>

            <div className="hidden sm:block" data-testid="header-spectrum-container">
              <HeaderSpectrum />
            </div>

            <nav className="hidden md:flex items-center gap-1" data-testid="nav-main">
              <button
                onClick={() => setLocation("/home")}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  isActive("/home") ? "text-white bg-white/10" : "text-orange-300/80 hover:text-white"
                }`}
                data-testid="nav-home"
              >
                {t("nav.home", "Inicio")}
              </button>
              <button
                onClick={() => setLocation("/create")}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  isActive("/create") ? "text-white bg-white/10" : "text-orange-300/80 hover:text-white"
                }`}
                data-testid="nav-create"
              >
                {t("nav.create", "Crear")}
              </button>
              <button
                onClick={() => setLocation("/discover")}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  isActive("/discover") ? "text-white bg-white/10" : "text-orange-300/80 hover:text-white"
                }`}
                data-testid="nav-discover"
              >
                {t("nav.discover", "Descubrir")}
              </button>
              <button
                onClick={() => setLocation("/library")}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  isActive("/library") ? "text-white bg-white/10" : "text-orange-300/80 hover:text-white"
                }`}
                data-testid="nav-library"
              >
                {t("nav.library", "Biblioteca")}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="px-3 py-1.5 rounded-full text-sm text-orange-300/80 hover:text-white transition-colors flex items-center gap-1"
                    data-testid="nav-more-menu"
                  >
                    {t("nav.more", "Más")}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 bg-slate-950/95 backdrop-blur-xl border-white/10">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-orange-400/70 text-[10px] uppercase tracking-wider">{t("nav.music", "Música")}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setLocation("/discography")} data-testid="menu-discography">
                      <Music className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.discography", "Discografía")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/my-playlists")} data-testid="menu-playlists">
                      <ListMusic className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.playlists", "Playlists")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/lyrics")} data-testid="menu-lyrics">
                      <PenLine className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.lyrics", "Letras")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/quiz")} data-testid="menu-quiz">
                      <HelpCircle className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.quiz", "Quiz")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-orange-400/70 text-[10px] uppercase tracking-wider">{t("nav.tools", "Herramientas")}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setLocation("/studio")} data-testid="menu-studio">
                      <Scissors className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.studio", "Studio")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/sample-lab")} data-testid="menu-sample-lab">
                      <Mic className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.sampleLab", "Sample Lab")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/audio-tools")} data-testid="menu-audio-tools">
                      <Wrench className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.audioTools", "Audio Tools")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/cover-designer")} data-testid="menu-cover-designer">
                      <Palette className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.coverDesigner", "Cover Designer")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/style-kits")} data-testid="menu-style-kits">
                      <Disc className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.styleKits", "Style Kits")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/producer-store")} data-testid="menu-producer-store">
                      <Store className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.producerStore", "Producer Store")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-orange-400/70 text-[10px] uppercase tracking-wider">{t("nav.artist", "Artista")}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setLocation("/artist-dashboard")} data-testid="menu-artist-dashboard">
                      <Crown className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.artistDashboard", "Artist Dashboard")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/copyright")} data-testid="menu-copyright">
                      <Shield className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.copyright", "Copyright")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  {adminCheck?.isAdmin && (
                    <>
                      <DropdownMenuSeparator className="bg-white/10" />
                      <DropdownMenuItem onClick={() => setLocation("/admin")} data-testid="menu-admin">
                        <Settings className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.adminPanel", "Admin")}
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={() => setLocation("/blog")} data-testid="menu-blog">
                    <BookOpen className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.blog", "Blog")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation("/terms")} data-testid="menu-terms">
                    <FileText className="w-4 h-4 mr-2 text-orange-400/60" />{t("legal.terms", "Terms")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation("/privacy")} data-testid="menu-privacy">
                    <Lock className="w-4 h-4 mr-2 text-orange-400/60" />{t("legal.privacy", "Privacy")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {creditsData && (
              <div
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => setLocation("/pricing")}
                data-testid="header-credits"
              >
                <Zap className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-medium text-orange-300">
                  {creditsData.isUnlimited ? (
                    <span className="flex items-center gap-1"><Infinity className="h-3.5 w-3.5" /></span>
                  ) : (
                    <span>{creditsData.credits}</span>
                  )}
                </span>
              </div>
            )}

            <Button
              onClick={() => setLocation("/pricing")}
              className="hidden sm:flex px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-600 to-orange-500 text-white text-sm font-medium hover:shadow-lg hover:shadow-orange-500/30 transition-all border-0"
              data-testid="button-upgrade"
            >
              {t("nav.pricing", "Mejorar Plan")}
            </Button>

            <button
              onClick={toggleLanguage}
              className="p-1.5 rounded-full text-orange-300/60 hover:text-orange-300 transition-colors"
              data-testid="button-language"
            >
              <Globe className="w-4 h-4" />
            </button>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full hover:bg-white/5 transition-colors p-1" data-testid="button-user-menu">
                    <Avatar className="h-8 w-8 ring-1 ring-orange-500/30">
                      <AvatarImage src={user.profileImageUrl || undefined} />
                      <AvatarFallback className="text-xs bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-slate-950/95 backdrop-blur-xl border-white/10">
                  <DropdownMenuLabel className="text-xs">
                    <span className="font-medium">{user.firstName} {user.lastName}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={() => setLocation("/pricing")} data-testid="user-menu-pricing">
                    <CreditCard className="w-4 h-4 mr-2" />{t("nav.pricing", "Pricing")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation("/artist-dashboard")} data-testid="user-menu-artist">
                    <Crown className="w-4 h-4 mr-2" />{t("nav.artistDashboard", "Artist")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={() => logout()} data-testid="user-menu-logout">
                    <LogOut className="w-4 h-4 mr-2" />{t("common.logout", "Logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="md:hidden p-2 rounded-lg text-orange-300 hover:bg-white/10 transition-colors" data-testid="button-mobile-menu">
                  <Menu className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-slate-950/95 backdrop-blur-xl border-white/10 md:hidden">
                <DropdownMenuItem onClick={() => setLocation("/home")} data-testid="mobile-home">
                  <Home className="w-4 h-4 mr-2" />{t("nav.home", "Inicio")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/create")} data-testid="mobile-create">
                  <Sparkles className="w-4 h-4 mr-2" />{t("nav.create", "Crear")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/discover")} data-testid="mobile-discover">
                  <Disc className="w-4 h-4 mr-2" />{t("nav.discover", "Descubrir")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/library")} data-testid="mobile-library">
                  <Library className="w-4 h-4 mr-2" />{t("nav.library", "Biblioteca")}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={() => setLocation("/studio")} data-testid="mobile-studio">
                  <Scissors className="w-4 h-4 mr-2" />{t("nav.studio", "Studio")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/sample-lab")} data-testid="mobile-sample-lab">
                  <Mic className="w-4 h-4 mr-2" />{t("nav.sampleLab", "Sample Lab")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/pricing")} data-testid="mobile-pricing">
                  <CreditCard className="w-4 h-4 mr-2" />{t("nav.pricing", "Plan")}
                </DropdownMenuItem>
                {adminCheck?.isAdmin && (
                  <DropdownMenuItem onClick={() => setLocation("/admin")} data-testid="mobile-admin">
                    <Settings className="w-4 h-4 mr-2" />{t("nav.adminPanel", "Admin")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
