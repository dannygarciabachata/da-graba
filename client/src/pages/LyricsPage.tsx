import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { LyricsGenerator } from "@/components/LyricsGenerator";
import { PenLine } from "lucide-react";

export default function LyricsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  if (!user) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 md:px-6 py-6 border-b border-white/5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <PenLine className="h-5 w-5 text-blue-400" />
            <h1 className="text-xl font-bold" data-testid="text-lyrics-title">{t('lyricsGenerator.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-8">
            {t('lyricsGenerator.subtitle')}
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 h-[calc(100vh-12rem)]">
          <LyricsGenerator />
        </div>
      </div>
    </div>
  );
}
