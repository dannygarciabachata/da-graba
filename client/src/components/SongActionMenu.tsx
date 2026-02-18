import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useDeleteSong, useTogglePublish, useToggleSongLike, useSongLike, useStemSeparation } from "@/hooks/use-songs";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Download,
  Copy,
  Eye,
  Trash2,
  Lock,
  Globe,
  Link2,
  FileText,
  Music,
  Scissors,
  Palette,
  ThumbsUp,
  ThumbsDown,
  Crown,
  Mic,
  Guitar,
  Check,
  Zap,
  Shuffle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SongActionMenuProps {
  song: {
    id: number;
    title?: string | null;
    prompt?: string | null;
    audioUrl?: string | null;
    isPublic?: boolean | null;
    status?: string | null;
    lyricsText?: string | null;
    genre?: string | null;
    variationLabel?: string | null;
  };
  onDesignCover?: () => void;
  onOpenStudio?: () => void;
  onMashup?: () => void;
  showLikeButtons?: boolean;
  compact?: boolean;
}

export function SongActionMenu({ song, onDesignCover, onOpenStudio, onMashup, showLikeButtons = true, compact = false }: SongActionMenuProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { mutate: deleteSong } = useDeleteSong();
  const { mutate: togglePublish } = useTogglePublish();
  const { mutate: toggleLike } = useToggleSongLike();
  const { mutate: startStems, isPending: stemsLoading } = useStemSeparation();
  const { data: likeData } = useSongLike(showLikeButtons ? song.id : null);

  const isCompleted = song.status === "completed";
  const hasAudio = !!song.audioUrl;
  const isPro = user && (user as any).subscriptionTier !== "free";
  const songTitle = song.variationLabel
    ? `${song.title || song.prompt} (${song.variationLabel})`
    : (song.title || song.prompt || "track");

  const handleDownload = (format: string, type: "full" | "vocals" | "instrumental") => {
    if ((type === "vocals" || type === "instrumental") && !isPro) {
      toast({
        title: t("songMenu.proRequired"),
        description: t("songMenu.upgradeForStems"),
        variant: "destructive",
      });
      return;
    }
    const a = document.createElement("a");
    a.href = `/api/songs/${song.id}/download?format=${format}${type !== "full" ? `&type=${type}` : ""}`;
    a.download = `${songTitle.replace(/\s+/g, "_")}.${format}`;
    a.click();
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/song/${song.id}`;
    navigator.clipboard.writeText(url);
    toast({ title: t("songMenu.linkCopied") });
  };

  const handleCopyPrompt = () => {
    if (song.prompt) {
      navigator.clipboard.writeText(song.prompt);
      toast({ title: t("songMenu.promptCopied") });
    }
  };

  const handleCopyLyrics = () => {
    if (song.lyricsText) {
      navigator.clipboard.writeText(song.lyricsText);
      toast({ title: t("songMenu.lyricsCopied") });
    }
  };

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {showLikeButtons && isCompleted && (
        <>
          <Button
            size="icon"
            variant="ghost"
            className={cn("h-8 w-8", likeData?.userValue === 1 ? "text-primary" : "text-muted-foreground")}
            onClick={() => toggleLike({ songId: song.id, value: 1 })}
            data-testid={`button-like-${song.id}`}
          >
            <ThumbsUp className={cn("h-4 w-4", likeData?.userValue === 1 && "fill-current")} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={cn("h-8 w-8", likeData?.userValue === -1 ? "text-destructive" : "text-muted-foreground")}
            onClick={() => toggleLike({ songId: song.id, value: -1 })}
            data-testid={`button-dislike-${song.id}`}
          >
            <ThumbsDown className={cn("h-4 w-4", likeData?.userValue === -1 && "fill-current")} />
          </Button>
        </>
      )}

      {isCompleted && hasAudio && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-green-400"
          onClick={() => handleDownload("mp3", "full")}
          title={t("songMenu.download")}
          data-testid={`button-quick-download-${song.id}`}
        >
          <Download className="h-4 w-4" />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            data-testid={`button-song-menu-${song.id}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
          {isCompleted && hasAudio && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-testid={`submenu-download-${song.id}`}>
                <Download className="h-4 w-4 mr-2" />
                {t("songMenu.download")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => handleDownload("mp3", "full")} data-testid={`menu-download-full-${song.id}`}>
                  <Zap className="h-4 w-4 mr-2 text-primary" />
                  <div className="flex-1">
                    <span>{t("songMenu.fullSong")}</span>
                    <span className="text-xs text-muted-foreground ml-2">MP3</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("wav", "full")} data-testid={`menu-download-wav-${song.id}`}>
                  <Zap className="h-4 w-4 mr-2 text-primary" />
                  <div className="flex-1">
                    <span>{t("songMenu.fullSong")}</span>
                    <span className="text-xs text-muted-foreground ml-2">WAV</span>
                  </div>
                  {!isPro && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDownload("mp3", "vocals")} data-testid={`menu-download-vocals-${song.id}`}>
                  <Mic className="h-4 w-4 mr-2" />
                  <span className="flex-1">{t("songMenu.vocals")}</span>
                  {!isPro && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("mp3", "instrumental")} data-testid={`menu-download-instrumental-${song.id}`}>
                  <Guitar className="h-4 w-4 mr-2" />
                  <span className="flex-1">{t("songMenu.instrumental")}</span>
                  {!isPro && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid={`submenu-copy-${song.id}`}>
              <Copy className="h-4 w-4 mr-2" />
              {t("songMenu.copy")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={handleCopyLink} data-testid={`menu-copy-link-${song.id}`}>
                <Link2 className="h-4 w-4 mr-2" />
                {t("songMenu.link")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyPrompt} disabled={!song.prompt} data-testid={`menu-copy-prompt-${song.id}`}>
                <Zap className="h-4 w-4 mr-2" />
                {t("songMenu.prompt")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLyrics} disabled={!song.lyricsText} data-testid={`menu-copy-lyrics-${song.id}`}>
                <FileText className="h-4 w-4 mr-2" />
                {t("songMenu.lyrics")}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid={`submenu-visibility-${song.id}`}>
              <Eye className="h-4 w-4 mr-2" />
              {t("songMenu.visibility")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => !song.isPublic || togglePublish(song.id)} data-testid={`menu-visibility-private-${song.id}`}>
                <Lock className="h-4 w-4 mr-2" />
                <span className="flex-1">{t("songMenu.private")}</span>
                {!song.isPublic && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => song.isPublic || togglePublish(song.id)} data-testid={`menu-visibility-public-${song.id}`}>
                <Globe className="h-4 w-4 mr-2" />
                <span className="flex-1">{t("songMenu.public")}</span>
                {song.isPublic && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          {isCompleted && hasAudio && (
            <DropdownMenuItem
              onClick={() => startStems(song.id)}
              disabled={stemsLoading}
              data-testid={`menu-stems-${song.id}`}
            >
              <Scissors className="h-4 w-4 mr-2" />
              {t("songMenu.stems")}
            </DropdownMenuItem>
          )}

          {isCompleted && (
            <DropdownMenuItem
              onClick={() => {
                if (onDesignCover) onDesignCover();
              }}
              data-testid={`menu-design-cover-${song.id}`}
            >
              <Palette className="h-4 w-4 mr-2" />
              {t("songMenu.designCover")}
            </DropdownMenuItem>
          )}

          {isCompleted && (
            <DropdownMenuItem
              onClick={() => {
                if (onOpenStudio) onOpenStudio();
                else setLocation("/studio");
              }}
              data-testid={`menu-studio-${song.id}`}
            >
              <Music className="h-4 w-4 mr-2" />
              {t("songMenu.studio")}
            </DropdownMenuItem>
          )}

          {isCompleted && onMashup && (
            <DropdownMenuItem
              onClick={() => onMashup()}
              data-testid={`menu-mashup-${song.id}`}
            >
              <Shuffle className="h-4 w-4 mr-2" />
              {t("mashup.title", "Mashup")}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => {
              if (confirm(t("songMenu.deleteConfirm"))) {
                deleteSong(song.id);
              }
            }}
            data-testid={`menu-delete-${song.id}`}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("songMenu.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
