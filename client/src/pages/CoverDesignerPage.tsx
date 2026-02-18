import { useState } from "react";
import { CoverArtDesigner } from "@/components/CoverArtDesigner";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, Search, Image, X, Disc3 } from "lucide-react";
import type { Song } from "@shared/schema";

export default function CoverDesignerPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: songs = [], isLoading: loadingSongs } = useQuery<Song[]>({
    queryKey: ["/api/songs"],
  });

  const completedSongs = songs.filter((s) => s.status === "completed" && s.audioUrl);

  const filteredSongs = searchQuery.trim()
    ? completedSongs.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.artistName && s.artistName.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (s.genre && s.genre.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : completedSongs;

  const handleSave = (dataUrl: string) => {
    const link = document.createElement("a");
    link.download = `${selectedSong?.title || "cover"}-art.png`;
    link.href = dataUrl;
    link.click();
    toast({ description: t('coverDesigner.downloaded') });
  };

  const handleApplied = () => {
    toast({ description: "Portada actualizada exitosamente." });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" data-testid="page-cover-designer">
      <div className="max-w-5xl mx-auto space-y-4">

        <Card data-testid="song-selector-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <Disc3 className="h-5 w-5 text-primary" />
                Seleccionar Canción
              </CardTitle>
              {selectedSong && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSong(null)}
                  data-testid="button-clear-song"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Deseleccionar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedSong ? (
              <div className="flex items-center gap-3 p-3 rounded-md border border-primary/30 bg-primary/5" data-testid="selected-song-display">
                {selectedSong.imageUrl ? (
                  <img
                    src={selectedSong.imageUrl}
                    alt={selectedSong.title}
                    className="w-12 h-12 rounded-md object-cover border border-white/10"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                    <Image className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" data-testid="text-selected-song-title">{selectedSong.title}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedSong.artistName && (
                      <span className="text-xs text-muted-foreground">{selectedSong.artistName}</span>
                    )}
                    {selectedSong.genre && (
                      <Badge variant="outline" className="text-[10px]">{selectedSong.genre}</Badge>
                    )}
                  </div>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Seleccionada</Badge>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por título, artista o género..."
                    className="pl-9 bg-black/20 border-white/10"
                    data-testid="input-search-songs"
                  />
                </div>

                {loadingSongs ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : filteredSongs.length === 0 ? (
                  <div className="text-center py-6">
                    <Music className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? "No se encontraron canciones" : "No tienes canciones completadas aún"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1" data-testid="song-list">
                    {filteredSongs.map((song) => (
                      <div
                        key={song.id}
                        className="flex items-center gap-3 p-2.5 rounded-md border border-transparent hover-elevate cursor-pointer transition-all"
                        onClick={() => {
                          setSelectedSong(song);
                          setSearchQuery("");
                        }}
                        data-testid={`song-item-${song.id}`}
                      >
                        {song.imageUrl ? (
                          <img
                            src={song.imageUrl}
                            alt={song.title}
                            className="w-10 h-10 rounded object-cover border border-white/10"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <Music className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{song.title}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {song.artistName && (
                              <span className="text-xs text-muted-foreground">{song.artistName}</span>
                            )}
                            {song.genre && (
                              <Badge variant="outline" className="text-[10px]">{song.genre}</Badge>
                            )}
                          </div>
                        </div>
                        {song.imageUrl ? (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Con portada</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-orange-400 border-orange-400/30">Sin portada</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <CoverArtDesigner
          songTitle={selectedSong?.title || ""}
          artistName={selectedSong?.artistName || ""}
          songId={selectedSong?.id}
          songGenre={selectedSong?.genre || undefined}
          existingImageUrl={selectedSong?.imageUrl || undefined}
          onSave={handleSave}
          onApplied={handleApplied}
        />
      </div>
    </div>
  );
}
