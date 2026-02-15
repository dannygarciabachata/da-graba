import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import dgbLogo from "@assets/Dgb_1771188880013.png";
import { MusicGenerator } from "@/components/MusicGenerator";
import { LyricsGenerator } from "@/components/LyricsGenerator";
import { AudioPlayer } from "@/components/AudioPlayer";
import { SongHistory } from "@/components/SongHistory";
import { BachataQuiz } from "@/components/BachataQuiz";
import { Button } from "@/components/ui/button";
import { LogOut, Disc, Music, PenLine, HelpCircle, Headphones, Sparkles, Scissors } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

type MobileTab = "studio" | "player" | "lyrics" | "quiz";
type RightPanelTab = "lyrics" | "quiz";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [currentSong, setCurrentSong] = useState<any>(null);
  const [rightTab, setRightTab] = useState<RightPanelTab>("lyrics");
  const [mobileTab, setMobileTab] = useState<MobileTab>("studio");

  if (!user) return null;

  const mobileNavItems = [
    { id: "studio" as MobileTab, label: t('dashboard.studio'), icon: Sparkles },
    { id: "player" as MobileTab, label: t('dashboard.player'), icon: Headphones },
    { id: "lyrics" as MobileTab, label: t('nav.lyrics'), icon: PenLine },
    { id: "quiz" as MobileTab, label: t('nav.quiz'), icon: HelpCircle },
  ];

  const handleOpenMultitrackStudio = () => setLocation("/studio");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans overflow-hidden">
      <header className="h-14 md:h-16 border-b border-white/5 bg-black/50 backdrop-blur-md px-4 md:px-6 flex items-center justify-between gap-2 z-50 sticky top-0">
        <div className="flex items-center gap-2 md:gap-3">
          <img src={dgbLogo} alt="DGB Studio" className="h-9 md:h-10 w-auto" />
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs hidden md:flex"
            onClick={() => setLocation("/sample-lab")}
            data-testid="button-open-samplelab"
          >
            <Music className="h-3.5 w-3.5" />
            {t('nav.sampleLab')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs hidden md:flex"
            onClick={() => setLocation("/studio")}
            data-testid="button-open-studio"
          >
            <Scissors className="h-3.5 w-3.5" />
            {t('nav.studio')}
          </Button>
          <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
            <Avatar className="h-6 w-6">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs bg-primary text-black font-bold">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hidden md:block">{user.firstName} {user.lastName}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => logout()} className="text-muted-foreground" data-testid="button-logout">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Desktop Layout */}
      <main className="hidden lg:grid flex-1 container max-w-[1600px] mx-auto p-6 grid-cols-12 gap-6 overflow-hidden h-[calc(100vh-4rem)]">
        <div className="col-span-3 flex flex-col gap-6 h-full overflow-hidden">
          <div className="flex-shrink-0">
            <MusicGenerator />
          </div>
          <div className="flex-1 min-h-0 glass-panel rounded-2xl p-4 flex flex-col">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4 px-2">{t('dashboard.recentTracks')}</h3>
            <SongHistory currentSongId={currentSong?.id} onSelectSong={setCurrentSong} />
          </div>
        </div>

        <div className="col-span-6 flex flex-col gap-6 justify-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.8 }}
            className="flex-1 flex flex-col justify-center"
          >
            <div className="aspect-video w-full rounded-3xl bg-gradient-to-br from-gray-900 to-black border border-white/5 shadow-2xl overflow-hidden relative group">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,243,255,0.1),transparent_70%)] animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                {currentSong?.imageUrl ? (
                  <img src={currentSong.imageUrl} alt="Album Art" className="w-64 h-64 rounded-xl shadow-2xl object-cover" />
                ) : (
                  <div className="w-64 h-64 rounded-full border-4 border-white/5 flex items-center justify-center animate-spin-slow">
                    <div className="w-56 h-56 rounded-full border-2 border-primary/20 border-dashed" />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
          <AudioPlayer
            url={currentSong?.audioUrl}
            title={currentSong?.title || t('create.untitledTrack')}
          />
        </div>

        <div className="col-span-3 h-full overflow-hidden flex flex-col">
          <div className="flex gap-1 mb-4 bg-white/5 rounded-lg p-1">
            <Button
              variant={rightTab === "lyrics" ? "default" : "ghost"}
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              onClick={() => setRightTab("lyrics")}
              data-testid="button-tab-lyrics"
            >
              <PenLine className="h-3.5 w-3.5" />
              {t('nav.lyrics')}
            </Button>
            <Button
              variant={rightTab === "quiz" ? "default" : "ghost"}
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              onClick={() => setRightTab("quiz")}
              data-testid="button-tab-quiz"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              {t('nav.quiz')}
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {rightTab === "lyrics" ? <LyricsGenerator /> : <BachataQuiz />}
          </div>
        </div>
      </main>

      {/* Mobile Layout */}
      <main className="flex-1 lg:hidden overflow-auto pb-20">
        <div className="p-4">
          {mobileTab === "studio" && (
            <motion.div
              key="studio"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <MusicGenerator />
              <div className="glass-panel rounded-2xl p-4">
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4 px-2">{t('dashboard.recentTracks')}</h3>
                <SongHistory currentSongId={currentSong?.id} onSelectSong={(song) => { setCurrentSong(song); setMobileTab("player"); }} />
              </div>
            </motion.div>
          )}

          {mobileTab === "player" && (
            <motion.div
              key="player"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="aspect-square max-h-[50vh] w-full rounded-2xl bg-gradient-to-br from-gray-900 to-black border border-white/5 shadow-2xl overflow-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,243,255,0.1),transparent_70%)] animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {currentSong?.imageUrl ? (
                    <img src={currentSong.imageUrl} alt="Album Art" className="w-40 h-40 rounded-xl shadow-2xl object-cover" />
                  ) : (
                    <div className="w-40 h-40 rounded-full border-4 border-white/5 flex items-center justify-center animate-spin-slow">
                      <div className="w-32 h-32 rounded-full border-2 border-primary/20 border-dashed" />
                    </div>
                  )}
                </div>
              </div>
              <AudioPlayer
                url={currentSong?.audioUrl}
                title={currentSong?.title || t('create.untitledTrack')}
              />
              <div className="glass-panel rounded-2xl p-4">
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4 px-2">{t('dashboard.recentTracks')}</h3>
                <SongHistory currentSongId={currentSong?.id} onSelectSong={setCurrentSong} />
              </div>
            </motion.div>
          )}

          {mobileTab === "lyrics" && (
            <motion.div
              key="lyrics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="min-h-[70vh]"
            >
              <LyricsGenerator />
            </motion.div>
          )}

          {mobileTab === "quiz" && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="min-h-[70vh]"
            >
              <BachataQuiz />
            </motion.div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10 safe-area-bottom" data-testid="nav-mobile-bottom">
        <div className="flex items-center justify-around px-2 py-1">
          {mobileNavItems.map((item) => {
            const isActive = mobileTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setMobileTab(item.id)}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all min-w-[60px]",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
                data-testid={`button-mobile-tab-${item.id}`}
              >
                <item.icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_rgba(0,243,255,0.5)]")} />
                <span className={cn("text-[10px] font-medium", isActive && "text-primary")}>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="mobile-tab-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
