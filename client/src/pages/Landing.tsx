import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Play, Pause, Mic2, Wand2, Music, Headphones, Sparkles, Scissors, Zap,
  Crown, Shield, Globe, Layers, ArrowRight, CheckCircle2, Star,
  Radio, Volume2, SlidersHorizontal, Palette, Upload
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI Music Generation",
    description: "Create studio-quality tracks from text prompts. Powered by our private cloud GPU — no per-song API costs.",
  },
  {
    icon: Scissors,
    title: "Multitrack Studio",
    description: "Separate any song into Vocals, Drums, Bass & Melody stems with AI-powered Demucs technology.",
  },
  {
    icon: Mic2,
    title: "AI Lyrics Writer",
    description: "Generate romantic, dance, or heartbreak lyrics in seconds. Influenced by Frank Reyes & Romeo Santos.",
  },
  {
    icon: SlidersHorizontal,
    title: "AI Mastering & Denoise",
    description: "Professional-grade mastering and noise reduction. Make every track sound polished and radio-ready.",
  },
  {
    icon: Volume2,
    title: "Sample Lab",
    description: "Record, upload, remix, and analyze audio samples. Detect Key & BPM instantly with AI.",
  },
  {
    icon: Upload,
    title: "Producer Store",
    description: "Upload custom instrument kits, train AI with your sounds, and build a unique sonic library.",
  },
];

const HOW_IT_WORKS = [
  { step: "1", title: "Describe Your Track", description: "Type a prompt describing the music you want — genre, mood, instruments, and style." },
  { step: "2", title: "AI Creates Your Song", description: "Our cloud GPU engine generates a full track in seconds using Stable Audio Open technology." },
  { step: "3", title: "Refine & Export", description: "Use stems, mastering, and mixing tools to polish your track. Download in high quality." },
];

const PLANS_PREVIEW = [
  {
    name: "Free",
    price: "$0",
    highlight: false,
    features: ["12 credits to start", "AI music generation", "Basic stem separation", "AI lyrics generator"],
  },
  {
    name: "Pro",
    price: "$14.99",
    highlight: false,
    features: ["100 credits/month", "Priority processing", "AI mastering & denoise", "Advanced stem separation", "Sample Lab access"],
  },
  {
    name: "Producer",
    price: "$29.00",
    highlight: true,
    features: ["500 credits/month", "Everything in Pro", "Custom instrument kits", "AI training for your sounds", "Cloud GPU training", "Producer Store access"],
  },
  {
    name: "Premium",
    price: "$29.99",
    highlight: false,
    features: ["Unlimited credits", "All AI tools", "Priority support", "Custom voice models", "Commercial license"],
  },
];

const STATS = [
  { value: "20+", label: "Music Genres" },
  { value: "4", label: "AI Stems" },
  { value: "12", label: "Free Credits" },
  { value: "0", label: "API Costs" },
];

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.6 },
};

const DEMO_SONG = {
  title: "Regreso al Edén",
  artist: "DGB Studio AI",
  genre: "Bachata",
  url: "/audio/songs/ac1a3408-dc10-4b06-a8d4-39f0aebdf587_song.mp3",
};

const STEM_HEIGHTS = [
  [80, 50, 95, 65],
  [60, 90, 45, 75],
  [70, 55, 85, 40],
  [90, 70, 60, 80],
];

function DemoPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const formatTime = useCallback((t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    };
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => { setIsPlaying(false); setProgress(0); setCurrentTime(0); };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    const audio = audioRef.current;
    if (!bar || !audio || !audio.duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
  };

  return (
    <div className="relative glass-panel rounded-2xl p-6 border border-white/10 shadow-2xl">
      <audio ref={audioRef} src={DEMO_SONG.url} preload="metadata" />
      <div className="rounded-xl bg-gradient-to-br from-gray-900 to-black overflow-hidden relative p-6">
        <div className="flex flex-col items-center gap-5">
          <div className="flex items-center gap-2 text-xs text-primary/80">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Generated Demo</span>
          </div>

          <button
            onClick={togglePlay}
            className="w-20 h-20 rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/30 flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,243,255,0.3)]"
            data-testid="button-demo-play"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-primary" />
            ) : (
              <Play className="w-8 h-8 text-primary ml-1" />
            )}
          </button>

          <div className="text-center space-y-1">
            <p className="font-bold text-lg" data-testid="text-demo-title">{DEMO_SONG.title}</p>
            <p className="text-xs text-muted-foreground">{DEMO_SONG.artist} &middot; {DEMO_SONG.genre}</p>
          </div>

          <div className="w-full space-y-2">
            <div
              ref={progressBarRef}
              className="relative h-6 w-full cursor-pointer group flex items-center"
              onClick={handleSeek}
              data-testid="progress-demo"
            >
              <div className="h-1.5 w-full bg-white/10 rounded-full pointer-events-none">
                <div
                  className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full relative transition-all duration-100"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
                </div>
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span data-testid="text-demo-current">{formatTime(currentTime)}</span>
              <span data-testid="text-demo-duration">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full">
            {["Vocals", "Drums", "Bass", "Melody"].map((stem, i) => (
              <div key={stem} className="flex-1 text-center p-2 rounded-lg bg-white/5 border border-white/5">
                <div className="h-6 flex items-end justify-center gap-[2px]">
                  {STEM_HEIGHTS[i].map((h, j) => (
                    <div
                      key={j}
                      className={`w-[3px] rounded-full bg-primary/60 ${isPlaying ? "animate-pulse" : ""}`}
                      style={{ height: `${h}%`, animationDelay: `${j * 0.15}s` }}
                    />
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">{stem}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Mic2 className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-left">
            <p className="text-xs text-muted-foreground">Powered by</p>
            <p className="text-sm font-bold">DGB Studio Engine</p>
          </div>
        </div>
        <Wand2 className="w-5 h-5 text-white/20" />
      </div>
    </div>
  );
}

export default function Landing() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-primary" data-testid="loading-landing">Loading DGB Audio...</div>;
  if (user) return <Redirect to="/dashboard" />;

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background z-0" />
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-primary/5 to-transparent z-0" />

      <nav className="relative z-10 container mx-auto px-4 md:px-6 py-4 md:py-6 flex justify-between items-center" data-testid="nav-landing">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-tr from-primary to-blue-600 p-1.5 rounded-lg">
            <Radio className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold font-display tracking-tighter">DGB Audio</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="hidden sm:inline-flex text-sm" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} data-testid="link-features">
            Features
          </Button>
          <Button variant="ghost" className="hidden sm:inline-flex text-sm" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })} data-testid="link-pricing">
            Pricing
          </Button>
          <Button variant="outline" className="border-white/10" onClick={handleLogin} data-testid="button-member-login">
            Member Login
          </Button>
        </div>
      </nav>

      <main className="relative z-10">
        <section className="container mx-auto px-4 md:px-6 pt-12 md:pt-24 pb-16 md:pb-32">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-6 md:space-y-8 text-center lg:text-left"
            >
              <div className="inline-block px-3 md:px-4 py-1 md:py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs md:text-sm font-medium mb-2 md:mb-4">
                DGB Studio Engine
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight leading-tight" data-testid="text-hero-title">
                Create Music with{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">
                  AI Power
                </span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed mx-auto lg:mx-0" data-testid="text-hero-subtitle">
                Generate studio-quality tracks, separate stems, write lyrics, and master your music — all powered by your own private cloud GPU. No per-song API costs. Start with 12 free credits.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center lg:justify-start pt-2 md:pt-4">
                <Button
                  size="lg"
                  className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg bg-primary text-black font-bold shadow-[0_0_20px_rgba(0,243,255,0.3)] gap-2"
                  onClick={handleLogin}
                  data-testid="button-start-creating"
                >
                  Start Creating Free
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg border-white/10"
                  onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                  data-testid="button-explore-features"
                >
                  Explore Features
                </Button>
              </div>

              <div className="flex items-center gap-6 justify-center lg:justify-start pt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-green-400" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span>12 free credits</span>
                </div>
              </div>

            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="relative"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl animate-pulse hidden md:block" />
              <DemoPlayer />
            </motion.div>
          </div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-12 md:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {STATS.map((stat, i) => (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}>
                <div className="text-center p-4 md:p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                  <p className="text-3xl md:text-4xl font-bold text-primary" data-testid={`text-stat-${i}`}>{stat.value}</p>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="features" className="container mx-auto px-4 md:px-6 py-16 md:py-24">
          <motion.div {...fadeUp} className="text-center mb-12 md:mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Features</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-features-title">
              Everything You Need to Create
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              From AI-powered music generation to professional mastering tools, DGB Audio gives you a complete music production suite.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }}>
                <Card className="bg-white/[0.02] border-white/5 hover:border-primary/20 transition-colors h-full" data-testid={`card-feature-${i}`}>
                  <CardContent className="p-5 md:p-6">
                    <div className="p-2.5 rounded-lg bg-primary/10 w-fit mb-4">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-bold text-base mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-16 md:py-24">
          <motion.div {...fadeUp} className="text-center mb-12 md:mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">How It Works</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-how-title">
              From Idea to Finished Track
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              Three simple steps to create professional music with AI.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {HOW_IT_WORKS.map((item, i) => (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.15 }}>
                <div className="text-center space-y-4 p-6" data-testid={`step-${item.step}`}>
                  <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                    <span className="text-2xl font-bold text-primary">{item.step}</span>
                  </div>
                  <h3 className="text-lg font-bold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="pricing" className="container mx-auto px-4 md:px-6 py-16 md:py-24">
          <motion.div {...fadeUp} className="text-center mb-12 md:mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Pricing</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-pricing-title">
              Plans for Every Creator
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              Start free with 12 credits. Upgrade anytime for more power and features.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {PLANS_PREVIEW.map((plan, i) => (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}>
                <Card
                  className={`relative h-full ${plan.highlight ? "border-primary/50 shadow-lg shadow-primary/10" : "bg-white/[0.02] border-white/5"}`}
                  data-testid={`card-plan-preview-${plan.name.toLowerCase()}`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-black font-semibold">Most Popular</Badge>
                    </div>
                  )}
                  <CardContent className="p-5 md:p-6 flex flex-col h-full">
                    <h3 className="font-bold text-lg">{plan.name}</h3>
                    <div className="mt-2 mb-4">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      {plan.price !== "$0" && <span className="text-muted-foreground text-sm">/mo</span>}
                    </div>
                    <ul className="space-y-2 flex-1">
                      {plan.features.map((f, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full mt-6 ${plan.highlight ? "bg-primary text-black" : ""}`}
                      variant={plan.highlight ? "default" : "outline"}
                      onClick={handleLogin}
                      data-testid={`button-plan-${plan.name.toLowerCase()}`}
                    >
                      {plan.price === "$0" ? "Get Started Free" : "Start Trial"}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-16 md:py-24">
          <motion.div {...fadeUp}>
            <div className="relative rounded-2xl overflow-hidden border border-white/10">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-blue-600/10" />
              <div className="relative p-8 md:p-16 text-center space-y-6">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-cta-title">
                  Ready to Create Your First Track?
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto text-lg">
                  Join DGB Audio today and get 12 free credits to start making music with AI. No credit card needed.
                </p>
                <Button
                  size="lg"
                  className="h-14 px-10 text-lg bg-primary text-black font-bold shadow-[0_0_30px_rgba(0,243,255,0.3)] gap-2"
                  onClick={handleLogin}
                  data-testid="button-cta-signup"
                >
                  Create Your Free Account
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-8 md:py-12 px-4" data-testid="footer-landing">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-gradient-to-tr from-primary to-blue-600 p-1.5 rounded-lg">
                  <Radio className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold">DGB Audio</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                AI-powered music creation platform. Generate, mix, master, and publish your music from one place.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Product</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="hover:text-foreground cursor-pointer transition-colors" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>Features</li>
                <li className="hover:text-foreground cursor-pointer transition-colors" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>Pricing</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">Producer Store</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">Style Kits</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Tools</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="hover:text-foreground cursor-pointer transition-colors">AI Music Generator</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">Stem Separator</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">AI Lyrics Writer</li>
                <li className="hover:text-foreground cursor-pointer transition-colors">Sample Lab</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Genres</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>Bachata</li>
                <li>Latin Pop</li>
                <li>Reggaeton</li>
                <li>Bolero & Salsa</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} DGB Audio. All rights reserved.</p>
            <p className="text-xs text-muted-foreground">Powered by DGB Studio Engine</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
