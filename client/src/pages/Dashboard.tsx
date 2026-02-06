import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { MusicGenerator } from "@/components/MusicGenerator";
import { LyricsGenerator } from "@/components/LyricsGenerator";
import { AudioPlayer } from "@/components/AudioPlayer";
import { SongHistory } from "@/components/SongHistory";
import { Button } from "@/components/ui/button";
import { LogOut, User, Disc } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [currentSong, setCurrentSong] = useState<any>(null);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-white/5 bg-black/50 backdrop-blur-md px-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-primary to-blue-600 p-2 rounded-lg">
            <Disc className="h-5 w-5 text-white animate-spin-slow" />
          </div>
          <span className="text-lg font-bold tracking-tight">DGB Audio <span className="text-primary text-xs font-normal px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">PRO</span></span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
            <Avatar className="h-6 w-6">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs bg-primary text-black font-bold">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hidden md:block">{user.firstName} {user.lastName}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => logout()} className="text-muted-foreground hover:text-white">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 container max-w-[1600px] mx-auto p-6 grid grid-cols-12 gap-6 overflow-hidden h-[calc(100vh-4rem)]">
        
        {/* Left Column - Generator & History */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-6 h-full overflow-hidden">
          <div className="flex-shrink-0">
            <MusicGenerator />
          </div>
          <div className="flex-1 min-h-0 glass-panel rounded-2xl p-4 flex flex-col">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4 px-2">Recent Tracks</h3>
            <SongHistory currentSongId={currentSong?.id} onSelectSong={setCurrentSong} />
          </div>
        </div>

        {/* Center Column - Player & Visualizer */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-6 justify-center">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.8 }}
            className="flex-1 flex flex-col justify-center"
          >
            <div className="aspect-video w-full rounded-3xl bg-gradient-to-br from-gray-900 to-black border border-white/5 shadow-2xl overflow-hidden relative group">
              {/* Dynamic Background Effect */}
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
            title={currentSong?.title || "Untitled Track"} 
          />
        </div>

        {/* Right Column - Lyrics */}
        <div className="col-span-12 lg:col-span-3 h-full overflow-hidden">
          <LyricsGenerator />
        </div>
      </main>
    </div>
  );
}
