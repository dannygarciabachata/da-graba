import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
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
} from "lucide-react";
import { useAdminCheck } from "@/hooks/use-admin";

const NAV_ITEMS = [
  { title: "Create", url: "/create", icon: Sparkles },
  { title: "Library", url: "/library", icon: Library },
  { title: "Lyrics", url: "/lyrics", icon: PenLine },
  { title: "Quiz", url: "/quiz", icon: HelpCircle },
];

const TOOLS_ITEMS = [
  { title: "Multitrack Studio", url: "/studio", icon: Scissors },
  { title: "Sample Lab", url: "/sample-lab", icon: Music },
  { title: "Style Kits", url: "/style-kits", icon: Disc },
  { title: "Pricing", url: "/pricing", icon: CreditCard },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { data: adminCheck } = useAdminCheck();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => setLocation("/create")}
          data-testid="link-sidebar-logo"
        >
          <div className="bg-gradient-to-tr from-primary to-blue-600 p-1.5 rounded-lg">
            <Disc className="h-5 w-5 text-white animate-spin-slow" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight">DGB Audio</span>
            <span className="text-primary text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 ml-1.5">
              PRO
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Music</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.url || (item.url === "/create" && location === "/dashboard");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`link-sidebar-${item.title.toLowerCase()}`}
                    >
                      <a
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault();
                          setLocation(item.url);
                        }}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
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
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {TOOLS_ITEMS.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`link-sidebar-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <a
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault();
                          setLocation(item.url);
                        }}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
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
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
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
                        <span>API Providers</span>
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
        <SidebarFooter className="p-3">
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
