import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Heart, Music, Users, Globe, Sparkles, ArrowRight,
  Mic2, Guitar, Drum, Piano
} from "lucide-react";
import daGrabaLogo from "@assets/Logomobil2_1771526285843.png";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.6 },
};

const TEAM_VALUES = [
  { icon: Heart, title: "Pasión por la Bachata", description: "Nacimos de la pasión por preservar y evolucionar el sonido auténtico de la Bachata dominicana." },
  { icon: Sparkles, title: "Innovación con IA", description: "Combinamos inteligencia artificial de última generación con el alma de la música latina." },
  { icon: Users, title: "Comunidad de Artistas", description: "Conectamos productores, compositores y artistas de todo el mundo con las raíces del género." },
  { icon: Globe, title: "Alcance Global", description: "Desde República Dominicana para el mundo, democratizando la creación musical profesional." },
];

const INSTRUMENTS = [
  { icon: Guitar, name: "Requinto", description: "El corazón melódico de la Bachata" },
  { icon: Guitar, name: "Segunda", description: "Guitarra rítmica que define el groove" },
  { icon: Drum, name: "Bongó", description: "Percusión esencial del ritmo bachatero" },
  { icon: Piano, name: "Piano", description: "Armonías que enriquecen cada canción" },
];

export default function AboutPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const handleAction = () => {
    if (user) {
      window.location.href = "/home";
    } else {
      window.location.href = "/api/login";
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-500/8 via-background to-background z-0 pointer-events-none" />

      <nav className="relative z-20 border-b border-white/[0.06] backdrop-blur-xl bg-background/70 sticky top-0" data-testid="nav-about">
        <div className="container mx-auto px-4 md:px-6 py-3 flex justify-between items-center">
          <a href="/" className="flex items-center">
            <img src={daGrabaLogo} alt="DA GRABA Studio" className="h-[60px] w-[180px] object-contain drop-shadow-[0_0_15px_rgba(255,117,31,0.3)]" data-testid="img-about-logo" />
          </a>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-sm text-white/70 hover:text-white" onClick={() => window.location.href = "/"} data-testid="link-back-home">
              {t('nav.home', 'Inicio')}
            </Button>
            <Button
              className="bg-gradient-to-r from-primary to-orange-500 text-white font-semibold text-sm px-5"
              onClick={handleAction}
              data-testid="button-about-cta"
            >
              {user ? t('nav.home', 'Inicio') : t('common.login', 'Iniciar Sesión')}
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        <section className="container mx-auto px-4 md:px-6 pt-16 md:pt-28 pb-16">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto space-y-6">
            <Badge className="bg-primary/10 text-primary border-primary/20">
              <Heart className="h-3 w-3 mr-1" />
              Sobre Nosotros
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight" data-testid="text-about-hero-title">
              La Pura Sangre de la{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-orange-500">
                Bachata
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed" data-testid="text-about-hero-subtitle">
              DA GRABA Studio nace de la visión de Danny Garcia — fusionando el ADN de los grandes músicos dominicanos con inteligencia artificial para crear la plataforma definitiva de producción musical latina.
            </p>
          </motion.div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-16">
          <motion.div {...fadeUp}>
            <div className="relative rounded-2xl overflow-hidden border border-white/10">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-primary/5 to-orange-600/5" />
              <div className="relative p-8 md:p-16 space-y-8">
                <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-orange-500/20 border border-primary/20 flex items-center justify-center">
                      <Music className="w-12 h-12 text-primary" />
                    </div>
                  </div>
                  <div className="text-center md:text-left space-y-4">
                    <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-about-mission-title">
                      Nuestra Misión
                    </h2>
                    <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">
                      Democratizar la producción musical de Bachata, Bolero, Merengue y Salsa, 
                      poniendo herramientas profesionales de IA al alcance de cada artista, 
                      compositor y productor del mundo.
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 pt-4">
                  <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                    <p className="text-3xl font-bold text-primary">20+</p>
                    <p className="text-sm text-muted-foreground mt-1">Géneros Musicales</p>
                  </div>
                  <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                    <p className="text-3xl font-bold text-primary">12</p>
                    <p className="text-sm text-muted-foreground mt-1">Instrumentos VST3</p>
                  </div>
                  <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                    <p className="text-3xl font-bold text-primary">$0</p>
                    <p className="text-sm text-muted-foreground mt-1">Costos de API</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-16">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-about-values-title">Nuestros Valores</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TEAM_VALUES.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}>
                  <Card className="bg-white/[0.02] border-white/5 hover:border-primary/20 transition-colors h-full" data-testid={`card-value-${i}`}>
                    <CardContent className="p-6 text-center space-y-4">
                      <div className="w-14 h-14 mx-auto rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Icon className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="font-bold text-base">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-16">
          <motion.div {...fadeUp} className="text-center mb-12">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              <Mic2 className="h-3 w-3 mr-1" />
              Instrumentos
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-about-instruments-title">
              Instrumentos Auténticos
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              Nuestro motor VST3 personalizado captura la esencia de cada instrumento bachatero.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {INSTRUMENTS.map((inst, i) => {
              const Icon = inst.icon;
              return (
                <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}>
                  <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-primary/20 transition-all text-center space-y-3" data-testid={`instrument-${i}`}>
                    <div className="w-12 h-12 mx-auto rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-orange-400" />
                    </div>
                    <h3 className="font-bold text-sm">{inst.name}</h3>
                    <p className="text-xs text-muted-foreground">{inst.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-16">
          <motion.div {...fadeUp}>
            <div className="relative rounded-2xl overflow-hidden border border-white/10">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-orange-600/10 to-orange-500/10" />
              <div className="relative p-8 md:p-16 text-center space-y-6">
                <h2 className="text-3xl md:text-4xl font-bold">
                  Comienza a Crear con DA GRABA
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto text-lg">
                  Únete a la comunidad de artistas que están definiendo el futuro de la música latina.
                </p>
                <Button
                  size="lg"
                  className="h-14 px-10 text-lg bg-gradient-to-r from-primary to-orange-500 text-white font-bold shadow-[0_0_30px_rgba(255,117,31,0.35)] gap-2"
                  onClick={handleAction}
                  data-testid="button-about-cta-bottom"
                >
                  {user ? 'Ir al Dashboard' : 'Crear Cuenta Gratis'}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      <Footer onLogin={handleAction} variant="landing" />
    </div>
  );
}
