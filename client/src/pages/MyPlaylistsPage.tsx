import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ListMusic,
  Plus,
  Trash2,
  Music,
  Globe,
  Lock,
  Loader2,
} from "lucide-react";

export default function MyPlaylistsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const { data: playlists, isLoading } = useQuery<any[]>({
    queryKey: ["/api/playlists"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/playlists", {
        name,
        description,
        isPublic,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setShowCreate(false);
      setName("");
      setDescription("");
      setIsPublic(false);
      toast({ title: t("playlists.created") });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/playlists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      toast({ title: t("playlists.deleted") });
    },
  });

  if (!user) return null;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6 bg-[#0a0a12]/80 rounded-xl my-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <ListMusic className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-playlists-title">
                {t("playlists.title")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("playlists.subtitle")}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            data-testid="button-create-playlist"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("playlists.createNew")}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !playlists?.length ? (
          <div className="text-center py-16">
            <div className="p-4 bg-white/5 rounded-full inline-block mb-4">
              <Music className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">
              {t("playlists.empty")}
            </p>
            <Button
              onClick={() => setShowCreate(true)}
              data-testid="button-create-playlist-empty"
            >
              {t("playlists.createFirst")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {playlists.map((pl: any) => (
              <Card
                key={pl.id}
                className="bg-[#0d0d18]/90 border-white/[0.06] hover-elevate cursor-pointer"
                onClick={() => setLocation(`/my-playlists/${pl.id}`)}
                data-testid={`card-playlist-${pl.id}`}
              >
                <div className="p-4 flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <ListMusic className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className="text-sm font-medium truncate"
                        data-testid={`text-playlist-name-${pl.id}`}
                      >
                        {pl.name}
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        data-testid={`badge-playlist-visibility-${pl.id}`}
                      >
                        {pl.isPublic ? (
                          <>
                            <Globe className="h-3 w-3 mr-1" />
                            {t("playlists.public")}
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3 mr-1" />
                            {t("playlists.private")}
                          </>
                        )}
                      </Badge>
                    </div>
                    {pl.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {pl.description}
                      </p>
                    )}
                    <p
                      className="text-xs text-muted-foreground mt-1"
                      data-testid={`text-playlist-count-${pl.id}`}
                    >
                      {pl.songCount ?? 0} {t("playlists.songs")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(pl.id);
                    }}
                    data-testid={`button-delete-playlist-${pl.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#0d0d18] border-white/[0.06]">
          <DialogHeader>
            <DialogTitle>{t("playlists.createNew")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("playlists.name")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("playlists.namePlaceholder")}
                data-testid="input-playlist-name"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("playlists.description")}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("playlists.descriptionPlaceholder")}
                data-testid="input-playlist-description"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("playlists.makePublic")}</Label>
              <Switch
                checked={isPublic}
                onCheckedChange={setIsPublic}
                data-testid="switch-playlist-public"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowCreate(false)}
              data-testid="button-cancel-create"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || createMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t("playlists.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
