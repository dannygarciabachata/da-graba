import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Disc3,
  Music,
  Calendar,
  ExternalLink,
  Play,
  Clock,
  ChevronDown,
  ChevronUp,
  Globe,
  User,
} from "lucide-react";
import { SiSpotify, SiApplemusic, SiAmazon, SiYoutube, SiTidal } from "react-icons/si";

interface DiscographyTrack {
  id: number;
  albumId: number;
  title: string;
  trackNumber: number;
  durationSeconds: number | null;
  featuring: string | null;
  spotifyTrackId: string | null;
  previewUrl: string | null;
}

interface DiscographyAlbum {
  id: number;
  artistId: number;
  title: string;
  albumType: string;
  releaseDate: string | null;
  coverImageUrl: string | null;
  description: string | null;
  genre: string | null;
  tracksCount: number;
  spotifyUrl: string | null;
  appleMusicUrl: string | null;
  amazonMusicUrl: string | null;
  youtubeMusicUrl: string | null;
  deezerUrl: string | null;
  tidalUrl: string | null;
  tracks: DiscographyTrack[];
}

interface ArtistProfile {
  id: number;
  artistName: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  genre: string | null;
  country: string | null;
  website: string | null;
  socialLinks: any;
  isVerified: boolean;
}

interface DiscographyResponse {
  artist: ArtistProfile;
  albums: DiscographyAlbum[];
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatYear(date: string | null | undefined): string {
  if (!date) return "";
  return date.length >= 4 ? date.substring(0, 4) : date;
}

function StreamingLinks({ album }: { album: DiscographyAlbum }) {
  const links = [
    { url: album.spotifyUrl, icon: SiSpotify, label: "Spotify", color: "hover:text-green-400" },
    { url: album.appleMusicUrl, icon: SiApplemusic, label: "Apple Music", color: "hover:text-orange-400" },
    { url: album.amazonMusicUrl, icon: SiAmazon, label: "Amazon Music", color: "hover:text-orange-400" },
    { url: album.youtubeMusicUrl, icon: SiYoutube, label: "YouTube Music", color: "hover:text-red-400" },
    { url: album.deezerUrl, icon: Music, label: "Deezer", color: "hover:text-blue-400" },
    { url: album.tidalUrl, icon: SiTidal, label: "Tidal", color: "hover:text-cyan-300" },
  ].filter(l => l.url);

  if (links.length === 0) return null;

  return (
    <div className="flex gap-3 flex-wrap" data-testid="streaming-links">
      {links.map(({ url, icon: Icon, label, color }) => (
        <a
          key={label}
          href={url!}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-white/40 ${color} transition-colors`}
          title={label}
          data-testid={`link-streaming-${label.toLowerCase().replace(/\s/g, "-")}`}
        >
          <Icon className="w-5 h-5" />
        </a>
      ))}
    </div>
  );
}

function AlbumCard({ album, defaultExpanded }: { album: DiscographyAlbum; defaultExpanded?: boolean }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded || false);

  const albumTypeLabel = album.albumType === "single" ? "Single" :
    album.albumType === "ep" ? "EP" :
    album.albumType === "compilation" ? t("discography.compilation") : t("discography.albumLabel");

  return (
    <Card
      className="bg-white/[0.03] border-white/[0.06] overflow-hidden hover:bg-white/[0.05] transition-colors"
      data-testid={`card-album-${album.id}`}
    >
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        {album.coverImageUrl ? (
          <img
            src={album.coverImageUrl}
            alt={album.title}
            className="w-full sm:w-40 h-40 object-cover rounded-lg flex-shrink-0"
            data-testid={`img-album-cover-${album.id}`}
          />
        ) : (
          <div className="w-full sm:w-40 h-40 rounded-lg bg-gradient-to-br from-[#00C8FF]/20 to-[#3366FF]/20 flex items-center justify-center flex-shrink-0">
            <Disc3 className="w-16 h-16 text-[#00C8FF]/40" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-white" data-testid={`text-album-title-${album.id}`}>
                {album.title}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-[10px] border-[#00C8FF]/30 text-[#00C8FF]">
                  {albumTypeLabel}
                </Badge>
                {album.releaseDate && (
                  <span className="text-xs text-white/40 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatYear(album.releaseDate)}
                  </span>
                )}
                {album.genre && (
                  <Badge variant="secondary" className="text-[10px] bg-[#3366FF]/10 text-[#3366FF]/70">
                    {album.genre}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {album.description && (
            <p className="text-sm text-white/50 mt-2 line-clamp-2">{album.description}</p>
          )}

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/40 flex items-center gap-1">
                <Music className="w-3 h-3" />
                {album.tracksCount || album.tracks?.length || 0} {t("discography.tracks")}
              </span>
              <StreamingLinks album={album} />
            </div>
            {album.tracks && album.tracks.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="text-white/40 hover:text-white text-xs"
                data-testid={`button-toggle-tracks-${album.id}`}
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {expanded ? t("discography.hideTracks") : t("discography.showTracks")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {expanded && album.tracks && album.tracks.length > 0 && (
        <div className="border-t border-white/[0.06] px-4 pb-3" data-testid={`tracklist-${album.id}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/30 text-xs uppercase tracking-wider">
                <th className="py-2 px-2 text-left w-8">#</th>
                <th className="py-2 px-2 text-left">{t("discography.trackTitle")}</th>
                <th className="py-2 px-2 text-right w-16">
                  <Clock className="w-3 h-3 inline" />
                </th>
              </tr>
            </thead>
            <tbody>
              {album.tracks.map((track) => (
                <tr
                  key={track.id}
                  className="border-t border-white/[0.03] hover:bg-white/[0.03] transition-colors"
                  data-testid={`row-track-${track.id}`}
                >
                  <td className="py-2 px-2 text-white/30 text-xs">{track.trackNumber}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white/80" data-testid={`text-track-title-${track.id}`}>
                        {track.title}
                      </span>
                      {track.featuring && (
                        <span className="text-white/30 text-xs">feat. {track.featuring}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right text-white/30 text-xs">
                    {formatDuration(track.durationSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function DiscographyPage() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<DiscographyResponse[]>({
    queryKey: ["/api/public/discography"],
    select: (raw: any) => {
      if (Array.isArray(raw)) {
        const grouped = new Map<number, { artist: ArtistProfile; albums: DiscographyAlbum[] }>();
        for (const album of raw) {
          const artistId = album.artist?.id || album.artistId;
          if (!grouped.has(artistId)) {
            grouped.set(artistId, { artist: album.artist, albums: [] });
          }
          grouped.get(artistId)!.albums.push(album);
        }
        return Array.from(grouped.values());
      }
      return raw;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-discography">
        <div className="flex flex-col items-center gap-3">
          <Disc3 className="w-10 h-10 text-[#00C8FF] animate-spin" />
          <span className="text-white/50 text-sm">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 max-w-5xl mx-auto" data-testid="page-discography">
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#00C8FF] to-[#3366FF] bg-clip-text text-transparent" data-testid="text-discography-title">
          {t("discography.title")}
        </h1>
        <p className="text-white/50 mt-2 text-sm">{t("discography.subtitle")}</p>
      </div>

      {(!data || data.length === 0) ? (
        <div className="text-center py-20">
          <Disc3 className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <p className="text-white/30">{t("discography.noAlbums")}</p>
        </div>
      ) : (
        data.map((entry: any) => (
          <div key={entry.artist?.id || "unknown"} className="mb-12">
            {entry.artist && (
              <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]" data-testid={`artist-section-${entry.artist.id}`}>
                {entry.artist.avatarUrl ? (
                  <img
                    src={entry.artist.avatarUrl}
                    alt={entry.artist.artistName}
                    className="w-16 h-16 rounded-full object-cover border-2 border-[#00C8FF]/30"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00C8FF]/20 to-[#3366FF]/20 flex items-center justify-center">
                    <User className="w-8 h-8 text-[#00C8FF]/50" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white" data-testid={`text-artist-name-${entry.artist.id}`}>
                      {entry.artist.artistName}
                    </h2>
                    {entry.artist.isVerified && (
                      <Badge className="bg-[#00C8FF]/20 text-[#00C8FF] text-[10px]">
                        ✓ {t("discography.verified")}
                      </Badge>
                    )}
                  </div>
                  {entry.artist.bio && (
                    <p className="text-sm text-white/40 mt-1 line-clamp-3">{entry.artist.bio}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-white/30">
                    {entry.artist.genre && (
                      <span className="flex items-center gap-1">
                        <Music className="w-3 h-3" /> {entry.artist.genre}
                      </span>
                    )}
                    {entry.artist.country && (
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" /> {entry.artist.country}
                      </span>
                    )}
                    {entry.artist.website && (
                      <a
                        href={entry.artist.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-[#00C8FF] transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> {t("discography.website")}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <Disc3 className="w-5 h-5 text-[#3366FF]" />
              <h3 className="text-lg font-semibold text-white/80">
                {entry.albums?.length || 0} {entry.albums?.length === 1 ? t("discography.release") : t("discography.releases")}
              </h3>
            </div>

            <div className="space-y-4">
              {entry.albums?.map((album: DiscographyAlbum, idx: number) => (
                <AlbumCard key={album.id} album={album} defaultExpanded={idx === 0} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
