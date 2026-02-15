import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useStyleKits, useStyleKitMeta } from "@/hooks/use-style-kits";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Music, Play, Pause, Volume2, Filter, Disc,
  Guitar, Drum, Piano, Mic, ChevronDown, Loader2,
} from "lucide-react";
import type { StyleKitInstrument } from "@shared/schema";

const GENRE_LABELS: Record<string, string> = {
  bachata: "Bachata",
  bolero: "Bolero",
  latin_pop: "Latin Pop",
  merengue: "Merengue",
  salsa: "Salsa",
  cumbia: "Cumbia",
  reggaeton: "Reggaeton",
  son: "Son",
  vallenato: "Vallenato",
  tropical: "Tropical",
};

const INSTRUMENT_ICONS: Record<string, typeof Music> = {
  guira: Disc,
  bongo: Drum,
  conga: Drum,
  timbal: Drum,
  requinto: Guitar,
  segunda_guitarra: Guitar,
  bass: Guitar,
  piano: Piano,
  vocals: Mic,
};

function InstrumentPlayer({ instrument }: { instrument: StyleKitInstrument }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!instrument.audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(instrument.audioUrl);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const Icon = INSTRUMENT_ICONS[instrument.type] || Music;
  const typeName = instrument.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
      data-testid={`instrument-${instrument.id}`}
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{instrument.name}</p>
        <p className="text-xs text-muted-foreground">{typeName}</p>
      </div>
      {instrument.audioUrl && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-60 group-hover:opacity-100 transition-opacity"
          onClick={togglePlay}
          data-testid={`button-play-instrument-${instrument.id}`}
        >
          {playing ? (
            <Pause className="h-4 w-4 text-primary" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      )}
      {!instrument.audioUrl && (
        <Volume2 className="h-4 w-4 text-muted-foreground/30" />
      )}
    </div>
  );
}

export default function StyleKitsPage() {
  const { t } = useTranslation();
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>(undefined);
  const [expandedKit, setExpandedKit] = useState<number | null>(null);
  const { data: meta } = useStyleKitMeta();
  const { data: kits, isLoading } = useStyleKits(selectedGenre);

  const genres = meta?.genres || Object.keys(GENRE_LABELS);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6" data-testid="style-kits-page">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
          <Disc className="h-6 w-6 text-primary" />
          {t('styleKits.title')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t('styleKits.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" data-testid="genre-filters">
        <Button
          variant={!selectedGenre ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedGenre(undefined)}
          data-testid="button-filter-all"
        >
          <Filter className="h-3.5 w-3.5 mr-1" /> {t('styleKits.all')}
        </Button>
        {genres.map((g) => (
          <Button
            key={g}
            variant={selectedGenre === g ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedGenre(selectedGenre === g ? undefined : g)}
            data-testid={`button-filter-${g}`}
          >
            {GENRE_LABELS[g] || g}
          </Button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16" data-testid="loading-kits">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && (!kits || kits.length === 0) && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Disc className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('styleKits.noKitsYet')}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t('styleKits.noKitsDesc')}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="kits-grid">
        {kits?.map((kit) => {
          const isExpanded = expandedKit === kit.id;
          return (
            <Card
              key={kit.id}
              className="bg-white/5 border-white/10 hover:border-primary/30 transition-colors"
              data-testid={`kit-card-${kit.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{kit.name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {kit.description || t('styleKits.instrumentKit')}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {GENRE_LABELS[kit.genre] || kit.genre}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Music className="h-3.5 w-3.5" />
                  <span>{t('styleKits.instrumentCount', { count: kit.instruments.length })}{kit.instruments.length !== 1 ? 's' : ''}</span>
                </div>

                {kit.instruments.length > 0 && (
                  <>
                    <div className="space-y-1">
                      {(isExpanded ? kit.instruments : kit.instruments.slice(0, 3)).map((instr) => (
                        <InstrumentPlayer key={instr.id} instrument={instr} />
                      ))}
                    </div>
                    {kit.instruments.length > 3 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setExpandedKit(isExpanded ? null : kit.id)}
                        data-testid={`button-expand-kit-${kit.id}`}
                      >
                        <ChevronDown className={`h-3.5 w-3.5 mr-1 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        {isExpanded ? t('styleKits.showLess') : t('styleKits.showMore', { count: kit.instruments.length - 3 })}
                      </Button>
                    )}
                  </>
                )}

                {kit.instruments.length === 0 && (
                  <p className="text-xs text-muted-foreground/50 text-center py-4">
                    {t('styleKits.noInstruments')}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
