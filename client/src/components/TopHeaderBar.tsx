import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useCredits } from "@/hooks/use-credits";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Globe,
  LogOut,
  Zap,
  Search,
  User,
  Receipt,
  Crown,
  CreditCard,
  Settings,
  BadgeCheck,
  Command,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAdminCheck } from "@/hooks/use-admin";
import daGrabaLogo from "@assets/Logomobil2_1771526285843.png";

export function TopHeaderBar() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { data: creditsData } = useCredits();
  const { data: adminCheck } = useAdminCheck();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "es" ? "en" : "es");
  };

  return (
    <header
      className="h-14 border-b border-white/[0.06] bg-[hsl(247,85%,8%)] flex items-center justify-between px-4 gap-4 sticky top-0 z-50"
      data-testid="top-header-bar"
    >
      <div className="flex items-center gap-2 flex-shrink-0">
        <SidebarTrigger className="md:hidden text-white/70" data-testid="mobile-menu-trigger" />
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setLocation("/home")}
          data-testid="header-logo"
        >
          <img
            src={daGrabaLogo}
            alt="DA GRABA"
            className="h-[40px] w-[140px] object-contain drop-shadow-[0_0_14px_rgba(255,117,31,0.45)]"
          />
        </div>
      </div>

      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            placeholder={`${t("common.search", "Buscar")}...`}
            className="pl-9 pr-10 h-9 bg-white/5 border-white/10 text-white/80 placeholder:text-white/30 rounded-lg focus-visible:ring-orange-500/40"
            data-testid="header-search"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-white/20">
            <kbd className="text-[10px] font-medium bg-white/10 rounded px-1 py-0.5">
              <Command className="inline w-2.5 h-2.5" />
            </kbd>
            <kbd className="text-[10px] font-medium bg-white/10 rounded px-1.5 py-0.5">K</kbd>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors text-sm"
          data-testid="header-language"
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{i18n.language === "es" ? "Español" : "English"}</span>
        </button>

        {creditsData && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-600/20 to-orange-500/10 border border-orange-500/30 cursor-pointer hover:from-orange-600/30 hover:to-orange-500/20 transition-colors"
            onClick={() => setLocation("/pricing")}
            data-testid="header-credits"
          >
            <Zap className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-sm font-semibold text-orange-300">
              {creditsData.isUnlimited ? "∞" : creditsData.credits}
            </span>
            <span className="text-xs text-orange-400/70 hidden sm:inline">{t("common.credits", "créditos")}</span>
          </div>
        )}

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-lg hover:bg-white/5 transition-colors p-1 pr-2"
                data-testid="header-user-menu"
              >
                <span className="text-sm font-medium text-white/80 hidden sm:block">
                  {user.firstName} {user.lastName}
                </span>
                {adminCheck?.isAdmin && (
                  <BadgeCheck className="w-4 h-4 text-orange-400 hidden sm:block" />
                )}
                <Avatar className="h-8 w-8 ring-2 ring-orange-500/40">
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback className="text-xs bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-slate-950/95 backdrop-blur-xl border-white/10"
            >
              <div className="px-3 py-2.5 flex items-center gap-3">
                <Avatar className="h-10 w-10 ring-2 ring-orange-500/30">
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback className="text-sm bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user.firstName} {user.lastName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{user.email || ""}</p>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={() => setLocation("/profile")} data-testid="header-menu-profile">
                <User className="w-4 h-4 mr-2 text-orange-400/60" />{t("profile.myProfile", "Mi Perfil")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/profile?tab=billing")} data-testid="header-menu-billing">
                <Receipt className="w-4 h-4 mr-2 text-orange-400/60" />{t("profile.billing", "Facturación")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/pricing")} data-testid="header-menu-pricing">
                <CreditCard className="w-4 h-4 mr-2 text-orange-400/60" />{t("nav.pricing", "Plan & Precios")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/profile?tab=artist")} data-testid="header-menu-artist">
                <Crown className="w-4 h-4 mr-2 text-orange-400/60" />{t("profile.artistProfile", "Perfil Artístico")}
              </DropdownMenuItem>
              {adminCheck?.isAdmin && (
                <>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={() => setLocation("/admin")} data-testid="header-menu-admin">
                    <Settings className="w-4 h-4 mr-2 text-orange-400/60" />Admin
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={toggleLanguage} data-testid="header-menu-language">
                <Globe className="w-4 h-4 mr-2 text-orange-400/60" />{i18n.language === "es" ? "English" : "Español"}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={() => logout()} className="text-red-400 focus:text-red-400" data-testid="header-menu-logout">
                <LogOut className="w-4 h-4 mr-2" />{t("common.logout", "Cerrar Sesión")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
