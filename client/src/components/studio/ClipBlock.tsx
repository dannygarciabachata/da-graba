import { useState, useRef } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { snapToGrid } from "@/hooks/use-daw";
import type { DawClip } from "@shared/schema";

interface ClipBlockProps {
  clip: DawClip;
  pxPerMs: number;
  snapMs: number;
  onUpdate: (data: Partial<DawClip>) => void;
  onDelete: () => void;
  color: string;
}

export function ClipBlock({ clip, pxPerMs, snapMs, onUpdate, onDelete, color }: ClipBlockProps) {
  const clipWidth = Math.max(30, (clip.durationMs || 2000) * pxPerMs);
  const clipLeft = (clip.startTimeMs || 0) * pxPerMs;
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, startTimeMs: 0 });

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, startTimeMs: clip.startTimeMs || 0 };

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStartRef.current.x;
      const newMs = Math.max(0, dragStartRef.current.startTimeMs + dx / pxPerMs);
      const snapped = snapToGrid(newMs, snapMs);
      onUpdate({ startTimeMs: Math.round(snapped) });
    };
    const handleUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 rounded-md border cursor-grab select-none flex items-center overflow-hidden group",
        isDragging && "opacity-70 cursor-grabbing z-20"
      )}
      style={{
        left: clipLeft,
        width: clipWidth,
        borderColor: `${color}60`,
        backgroundColor: `${color}20`,
      }}
      onMouseDown={handleDragStart}
      data-testid={`clip-block-${clip.id}`}
    >
      <div className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(135deg, ${color}40 0%, transparent 60%)` }} />
      <div className="flex items-center gap-1 px-1.5 relative z-10 min-w-0">
        <GripVertical className="w-3 h-3 flex-shrink-0 opacity-50" />
        <span className="text-[9px] font-medium truncate">{clip.name}</span>
      </div>
      <button
        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        data-testid={`button-delete-clip-${clip.id}`}
      >
        <Trash2 className="w-2.5 h-2.5 text-red-400" />
      </button>
    </div>
  );
}
