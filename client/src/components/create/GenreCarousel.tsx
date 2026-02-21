import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { GENRE_CATEGORIES } from "./constants";

interface GenreCarouselProps {
  selectedGenre: string;
  onSelect: (value: string) => void;
}

export function GenreCarousel({ selectedGenre, onSelect }: GenreCarouselProps) {
  const [openCat, setOpenCat] = useState<string | null>(null);

  return (
    <div data-testid="genre-carousel">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {GENRE_CATEGORIES.map((cat) => (
          <Popover key={cat.category} open={openCat === cat.category} onOpenChange={(open) => setOpenCat(open ? cat.category : null)}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex-shrink-0 h-8 px-3 rounded-full border text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1.5",
                  cat.genres.some((g) => g.value === selectedGenre)
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20"
                )}
                data-testid={`genre-cat-${cat.category.replace(/\s+/g, "-").toLowerCase()}`}
              >
                <span>{cat.icon}</span>
                <span>{cat.category}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-2" sideOffset={8}>
              <div className="space-y-1">
                {cat.genres.map((genre) => (
                  <button
                    key={genre.value}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center justify-between",
                      selectedGenre === genre.value
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-white/5 text-foreground"
                    )}
                    onClick={() => {
                      onSelect(genre.value);
                      setOpenCat(null);
                    }}
                    data-testid={`genre-option-${genre.value}`}
                  >
                    <span>{genre.label}</span>
                    <span className="text-[10px] text-muted-foreground">{genre.likes}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}
