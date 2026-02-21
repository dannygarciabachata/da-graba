import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarNavItemProps {
  icon: any;
  label: string;
  href: string;
  active?: boolean;
  collapsed?: boolean;
}

export function SidebarNavItem({ icon: Icon, label, href, active, collapsed }: SidebarNavItemProps) {
  const [, setLocation] = useLocation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => setLocation(href)}
          className={cn(
            "w-full flex items-center rounded-lg font-medium transition-all",
            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2 text-[13px]",
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          )}
          data-testid={`nav-${href.replace("/", "")}`}
        >
          <Icon className={cn("flex-shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} />
          {!collapsed && label}
        </button>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">{label}</TooltipContent>}
    </Tooltip>
  );
}
