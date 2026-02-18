import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSongs } from "@/hooks/use-songs";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Shuffle,
  Music,
  Check,
  Loader2,
  Search,
  X,
} from "lucide-react";

interface MashupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedSongId?: number;
}

export function MashupDialog({ open, onOpenChange, preSelectedSongId }: MashupDialogProps) {
  const { t } = useTranslation();
  const { data: songs } = useSongs();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSongs, setSelectedSongs] = useState<number[]>([]);

  useEffect(() => {
    if (open && preSelectedSongId) {
      setSelectedSongs([preSelectedSongId]);
    } else if (!open) {
      setSelectedSongs([]);
    }
  }, [open, preSelectedSongId]);
  const [mashupTitle, setMashupTitle] = useState("");
  const [mashupStyle, setMashupStyle] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const completedSongs = useMemo(() => {
    return (songs || []).filter((s: any) => s.status === "completed" && s.audioUrl);
  }, [songs]);

  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return completedSongs;
    const q = searchQuery.toLowerCase();
    return completedSongs.filter((s: any) =>
      (s.title || "").toLowerCase().includes(q) ||
      (s.genre || "").toLowerCase().includes(q) ||
      (s.artistName || "").toLowerCase().includes(q)
    );
  }, [completedSongs, searchQuery]);

  const mashupMutation = useMutation({
    mutationFn: async (data: { songId1: number; songId2: number; title?: string; style?: string; instrumental?: boolean; customMode?: boolean }) => {
      const res = await fetch("/api/songs/mashup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Mashup failed" }));
        throw new Error(err.error || err.message || "Mashup failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.songs.list.path] });
      toast({
        title: t("mashup.started", "Mashup Started"),
        description: t("mashup.startedDesc", "Your mashup is being generated. It will appear in your library when ready."),
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({
        title: t("mashup.error", "Mashup Error"),
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedSongs([]);
    setMashupTitle("");
    setMashupStyle("");
    setInstrumental(false);
    setSearchQuery("");
  };

  const toggleSong = (songId: number) => {
    setSelectedSongs(prev => {
      if (prev.includes(songId)) {
        return prev.filter(id => id !== songId);
      }
      if (prev.length >= 2) {
        return [prev[1], songId];
      }
      return [...prev, songId];
    });
  };

  const handleSubmit = () => {
    if (selectedSongs.length !== 2) return;
    mashupMutation.mutate({
      songId1: selectedSongs[0],
      songId2: selectedSongs[1],
      title: mashupTitle || undefined,
      style: mashupStyle || undefined,
      instrumental,
      customMode: true,
    });
  };

  const song1 = completedSongs.find((s: any) => s.id === selectedSongs[0]);
  const song2 = completedSongs.find((s: any) => s.id === selectedSongs[1]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shuffle className="h-5 w-5 text-primary" />
            {t("mashup.title", "Create Mashup")}
          </DialogTitle>
          <DialogDescription>
            {t("mashup.description", "Select two songs to blend into a new track using AI.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0">
          {selectedSongs.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {song1 && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1.5 py-1 px-2"
                  data-testid="badge-mashup-song-1"
                >
                  <span className="text-xs font-bold text-primary">1</span>
                  <span className="truncate max-w-[120px]">{song1.title || song1.prompt}</span>
                  <button onClick={() => toggleSong(song1.id)} className="ml-1 opacity-60 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {song2 && (
                <>
                  <span className="text-xs text-muted-foreground">x</span>
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1.5 py-1 px-2"
                    data-testid="badge-mashup-song-2"
                  >
                    <span className="text-xs font-bold text-[#FF8C00]">2</span>
                    <span className="truncate max-w-[120px]">{song2.title || song2.prompt}</span>
                    <button onClick={() => toggleSong(song2.id)} className="ml-1 opacity-60 hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </>
              )}
              {selectedSongs.length === 1 && (
                <span className="text-xs text-muted-foreground">
                  {t("mashup.selectSecond", "Select a second song")}
                </span>
              )}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("mashup.search", "Search your songs...")}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-mashup-search"
            />
          </div>

          <ScrollArea className="h-[200px] rounded-md border border-white/10">
            <div className="p-2 space-y-1">
              {filteredSongs.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Music className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  {t("mashup.noSongs", "No completed songs found")}
                </div>
              ) : (
                filteredSongs.map((song: any) => {
                  const isSelected = selectedSongs.includes(song.id);
                  const selectionIndex = selectedSongs.indexOf(song.id);
                  return (
                    <div
                      key={song.id}
                      onClick={() => toggleSong(song.id)}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "hover-elevate"
                      )}
                      data-testid={`mashup-song-option-${song.id}`}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded flex items-center justify-center flex-shrink-0 overflow-hidden",
                        isSelected ? "bg-primary/20" : "bg-white/5"
                      )}>
                        {isSelected ? (
                          <span className={cn(
                            "text-xs font-bold",
                            selectionIndex === 0 ? "text-primary" : "text-[#FF8C00]"
                          )}>
                            {selectionIndex + 1}
                          </span>
                        ) : song.imageUrl ? (
                          <img src={song.imageUrl} alt="" className="w-8 h-8 object-cover" />
                        ) : (
                          <Music className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {song.variationLabel
                            ? `${song.title || song.prompt} (${song.variationLabel})`
                            : song.title || song.prompt}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {song.genre || "Unknown"} {song.artistName ? `— ${song.artistName}` : ""}
                        </p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="space-y-3">
            <div>
              <Label htmlFor="mashup-title" className="text-xs text-muted-foreground mb-1 block">
                {t("mashup.mashupTitle", "Mashup Title (optional)")}
              </Label>
              <Input
                id="mashup-title"
                value={mashupTitle}
                onChange={e => setMashupTitle(e.target.value)}
                placeholder={
                  song1 && song2
                    ? `Mashup: ${(song1.title || "").substring(0, 20)} x ${(song2.title || "").substring(0, 20)}`
                    : t("mashup.titlePlaceholder", "Enter mashup title...")
                }
                data-testid="input-mashup-title"
              />
            </div>

            <div>
              <Label htmlFor="mashup-style" className="text-xs text-muted-foreground mb-1 block">
                {t("mashup.style", "Style (optional)")}
              </Label>
              <Input
                id="mashup-style"
                value={mashupStyle}
                onChange={e => setMashupStyle(e.target.value)}
                placeholder="Bachata, Bolero, Salsa..."
                data-testid="input-mashup-style"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="mashup-instrumental" className="text-sm">
                {t("mashup.instrumental", "Instrumental Only")}
              </Label>
              <Switch
                id="mashup-instrumental"
                checked={instrumental}
                onCheckedChange={setInstrumental}
                data-testid="switch-mashup-instrumental"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => { onOpenChange(false); resetForm(); }}
            data-testid="button-mashup-cancel"
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedSongs.length !== 2 || mashupMutation.isPending}
            className="bg-gradient-to-r from-[#FF1493] to-[#FF8C00]"
            data-testid="button-mashup-create"
          >
            {mashupMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("mashup.creating", "Creating...")}
              </>
            ) : (
              <>
                <Shuffle className="h-4 w-4 mr-2" />
                {t("mashup.create", "Create Mashup")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
