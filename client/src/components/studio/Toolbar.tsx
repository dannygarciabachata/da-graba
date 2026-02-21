import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  MousePointer2, Scissors, Copy, Clipboard, Trash2,
  ZoomIn, ZoomOut, Magnet, Undo2, Redo2,
  Upload, Download, Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onImportAudio?: () => void;
  onExport?: () => void;
  snapEnabled?: boolean;
  onToggleSnap?: () => void;
  hasSelection?: boolean;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
}

const TOOLS = [
  { id: "select", icon: MousePointer2, label: "Seleccionar", shortcut: "V" },
  { id: "cut", icon: Scissors, label: "Cortar", shortcut: "C" },
] as const;

function ToolbarButton({ icon: Icon, label, shortcut, active, disabled, onClick, testId }: {
  icon: typeof MousePointer2;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  testId: string;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "w-7 h-7 rounded-md",
              active ? "toggle-elevate toggle-elevated bg-[#ff751f]/15 text-[#ff751f] ring-1 ring-[#ff751f]/30" : "text-zinc-400"
            )}
            onClick={onClick}
            disabled={disabled}
            data-testid={testId}
          >
            <Icon className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {label}{shortcut && <span className="ml-2 text-zinc-500">({shortcut})</span>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function Toolbar({
  activeTool, onToolChange,
  canUndo, canRedo, onUndo, onRedo,
  onZoomIn, onZoomOut,
  onImportAudio, onExport,
  snapEnabled, onToggleSnap,
  hasSelection, onCut, onCopy, onPaste, onDelete,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1 bg-[#0f0f0f] border-b border-white/[0.06] select-none" data-testid="studio-toolbar">
      {TOOLS.map((tool) => (
        <ToolbarButton
          key={tool.id}
          icon={tool.icon}
          label={tool.label}
          shortcut={tool.shortcut}
          active={activeTool === tool.id}
          onClick={() => onToolChange(tool.id)}
          testId={`toolbar-tool-${tool.id}`}
        />
      ))}

      <Separator orientation="vertical" className="h-5 mx-1 bg-white/[0.06]" />

      <ToolbarButton icon={Undo2} label="Deshacer" shortcut="Ctrl+Z" disabled={!canUndo} onClick={onUndo} testId="toolbar-undo" />
      <ToolbarButton icon={Redo2} label="Rehacer" shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={onRedo} testId="toolbar-redo" />

      <Separator orientation="vertical" className="h-5 mx-1 bg-white/[0.06]" />

      <ToolbarButton icon={Copy} label="Copiar" shortcut="Ctrl+C" disabled={!hasSelection} onClick={onCopy} testId="toolbar-copy" />
      <ToolbarButton icon={Clipboard} label="Pegar" shortcut="Ctrl+V" onClick={onPaste} testId="toolbar-paste" />
      <ToolbarButton icon={Trash2} label="Eliminar" shortcut="Del" disabled={!hasSelection} onClick={onDelete} testId="toolbar-delete" />

      <Separator orientation="vertical" className="h-5 mx-1 bg-white/[0.06]" />

      <ToolbarButton icon={ZoomIn} label="Zoom In" shortcut="+" onClick={onZoomIn} testId="toolbar-zoom-in" />
      <ToolbarButton icon={ZoomOut} label="Zoom Out" shortcut="-" onClick={onZoomOut} testId="toolbar-zoom-out" />
      <ToolbarButton icon={Magnet} label="Ajuste Magnético" active={snapEnabled} onClick={onToggleSnap} testId="toolbar-snap" />

      <div className="flex-1" />

      <ToolbarButton icon={Upload} label="Importar Audio" onClick={onImportAudio} testId="toolbar-import" />
      <ToolbarButton icon={Download} label="Exportar" onClick={onExport} testId="toolbar-export" />
      <ToolbarButton icon={Settings2} label="Configuración" testId="toolbar-settings" />
    </div>
  );
}
