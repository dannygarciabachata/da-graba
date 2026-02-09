import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Play, Mic2, Wand2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-primary">Loading DGB Audio...</div>;
  if (user) return <Redirect to="/dashboard" />;

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 relative overflow-hidden">
      
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background z-0" />
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/5 to-transparent z-0" />

      <nav className="relative z-10 container mx-auto px-4 md:px-6 py-4 md:py-6 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold font-display tracking-tighter">DGB Audio</h1>
        <Button variant="outline" className="border-white/10" onClick={handleLogin} data-testid="button-member-login">
          Member Login
        </Button>
      </nav>

      <main className="relative z-10 container mx-auto px-4 md:px-6 pt-12 md:pt-20 pb-16 md:pb-32 text-center lg:text-left">
        <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-center">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6 md:space-y-8"
          >
            <div className="inline-block px-3 md:px-4 py-1 md:py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs md:text-sm font-medium mb-2 md:mb-4">
              Heart Mula Music Engine
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight leading-tight">
              The Rhythm of <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500 text-glow">
                Danny Garcia
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed mx-auto lg:mx-0">
              Generate studio-quality Bachata tracks and romantic lyrics with the Heart Mula engine. Dominican soul, AI precision, DGB sound.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center lg:justify-start pt-2 md:pt-4">
              <Button 
                size="lg" 
                className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg bg-primary text-black font-bold shadow-[0_0_20px_rgba(0,243,255,0.3)]"
                onClick={handleLogin}
                data-testid="button-start-creating"
              >
                Start Creating
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg border-white/10"
                data-testid="button-listen-demos"
              >
                Listen to Demos
              </Button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="relative hidden md:block"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl animate-pulse" />
            
            <div className="relative glass-panel rounded-2xl p-6 border border-white/10 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
              <div className="aspect-square rounded-xl bg-gradient-to-br from-gray-900 to-black overflow-hidden relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                      <Play className="w-8 h-8 text-primary ml-1" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 w-32 bg-white/10 rounded-full mx-auto" />
                      <div className="h-2 w-24 bg-white/5 rounded-full mx-auto" />
                    </div>
                  </div>
                </div>
                
                <div className="absolute bottom-6 left-6 right-6 p-4 glass-panel rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Mic2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-muted-foreground">Lyrics Gen</p>
                      <p className="text-sm font-bold">Heart Mula AI</p>
                    </div>
                  </div>
                  <Wand2 className="w-5 h-5 text-white/20" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
      
      <footer className="border-t border-white/5 py-8 md:py-12 text-center text-muted-foreground text-sm px-4">
        <p>DGB Audio. All rights reserved.</p>
      </footer>
    </div>
  );
}
