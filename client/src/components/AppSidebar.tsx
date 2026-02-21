import { useLocation } from "wouter";
import { forwardRef, useCallback } from "react";
import { useAdminCheck } from "@/hooks/use-admin";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Sparkles,
  Library,
  Scissors,
  Mic,
  Settings,
  Store,
  Wrench,
  Palette,
  Crown,
  Shield,
  Disc,
  Headphones,
  Radio,
  Compass,
  Heart,
  User,
  Cpu,
  Home,
} from "lucide-react";

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
  const { data: adminCheck } = useAdminCheck();
  const { t } = useTranslation();

  const isActive = (path: string) => location === path || location.startsWith(path + "/");

  const mainItems: NavItem[] = [
    { title: t("nav.home", "Inicio"), icon: Home, path: "/home" },
    { title: t("nav.create", "Crear"), icon: Sparkles, path: "/create" },
    { title: t("nav.studio", "Studio DAW"), icon: Scissors, path: "/studio" },
    { title: t("nav.gpuManagement", "Gestión GPU"), icon: Cpu, path: "/admin" },
    { title: t("nav.discover", "Explorar"), icon: Compass, path: "/discover" },
  ];

  const libraryItems: NavItem[] = [
    { title: t("nav.library", "Biblioteca"), icon: Library, path: "/library" },
    { title: t("profile.myProfile", "Perfil"), icon: User, path: "/profile" },
    { title: t("nav.liked", "Me Gusta"), icon: Heart, path: "/my-playlists" },
  ];

  const toolsItems: NavItem[] = [
    { title: t("nav.sampleLab", "Laboratorio de Samples"), icon: Mic, path: "/sample-lab" },
    { title: "Stem Splitter", icon: Headphones, path: "/stem-splitter" },
    { title: "Voice Lab", icon: Radio, path: "/voice-lab" },
    { title: t("nav.audioTools", "Herramientas de Audio"), icon: Wrench, path: "/audio-tools" },
    { title: t("nav.coverDesigner", "Diseñador de Portadas"), icon: Palette, path: "/cover-designer" },
  ];

  const storeItems: NavItem[] = [
    { title: t("nav.styleKits", "Kits de Estilo"), icon: Disc, path: "/style-kits" },
    { title: t("nav.producerStore", "Tienda de Productor"), icon: Store, path: "/producer-store" },
  ];

  const artistItems: NavItem[] = [
    { title: t("nav.artistProfile", "Mi Perfil de Artista"), icon: Crown, path: "/artist-dashboard" },
    { title: t("nav.copyright", "Copyright & Publishing"), icon: Shield, path: "/copyright" },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-white/[0.06] top-14 h-[calc(100vh-3.5rem)]">
      <SidebarContent className="px-2 pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <NavSection items={mainItems} isActive={isActive} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-white/[0.06]" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-white/40 px-2 font-semibold">
            {t("nav.tools", "Herramientas")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <NavSection items={toolsItems} isActive={isActive} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-white/[0.06]" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-white/40 px-2 font-semibold">
            {t("nav.producerStore", "Tienda de Productor")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <NavSection items={storeItems} isActive={isActive} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-white/[0.06]" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-white/40 px-2 font-semibold">
            {t("nav.library", "Biblioteca")} / Library
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <NavSection items={libraryItems} isActive={isActive} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-white/[0.06]" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-white/40 px-2 font-semibold">
            {t("nav.artist", "Artista")}
          </SidebarGroupLabel>
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
    </Sidebar>
  );
}
