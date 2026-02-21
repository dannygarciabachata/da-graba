import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Crown, Zap, Infinity, Shield, ArrowRight, CheckCircle2,
  Sparkles, Music, Headphones, Mic2, Layers, Star
} from "lucide-react";
import daGrabaLogo from "@assets/Logomobil2_1771526285843.png";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.6 },
};

const PRO_FEATURES = [
  { icon: Infinity, title: "Créditos Ilimitados", description: "Genera toda la música que necesites sin límites mensuales." },
  { icon: Layers, title: "Separación de Stems", description: "Separa vocal, batería, bajo y melodía con precisión profesional." },
  { icon: Mic2, title: "Voice Lab Premium", description: "Clona y transforma voces con IA de última generación." },
  { icon: Headphones, title: "Calidad Lossless", description: "Exporta en WAV, FLAC y formatos de alta resolución." },
  { icon: Crown, title: "Style Kits Premium", description: "Accede a kits exclusivos de instrumentos profesionales." },
  { icon: Star, title: "Prioridad de GPU", description: "Tus generaciones se procesan primero en nuestros servidores." },
];

const COMPARISON = [
  { feature: "Generaciones/mes", free: "12", basic: "1,000", pro: "1,500", premium: "3,500" },
  { feature: "Separación de Stems", free: "---", basic: "50", pro: "200", premium: "Ilimitado" },
  { feature: "Calidad de Audio", free: "MP3", basic: "MP3/WAV", pro: "WAV/FLAC", premium: "Lossless" },
  { feature: "Voice Lab", free: "---", basic: "Básico", pro: "Avanzado", premium: "Premium" },
  { feature: "Style Kits", free: "3", basic: "10", pro: "Todos", premium: "Todos + Exclusivos" },
  { feature: "Soporte", free: "Chatbot", basic: "Email", pro: "Prioritario", premium: "Dedicado" },
  { feature: "Derechos Comerciales", free: "---", basic: "Limitado", pro: "Completo", premium: "Completo + Sync" },
  { feature: "DAW Studio", free: "2 pistas", basic: "8 pistas", pro: "Ilimitado", premium: "Ilimitado + Plugins" },
];

export default function ProPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const handleAction = () => {
    if (user) {
      window.location.href = "/pricing";
    } else {
      window.location.href = "/api/login";
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background z-0 pointer-events-none" />

      <nav className="relative z-20 border-b border-white/[0.06] backdrop-blur-xl bg-background/70 sticky top-0" data-testid="nav-pro">
        <div className="container mx-auto px-4 md:px-6 py-3 flex justify-between items-center">
          <a href="/" className="flex items-center">
            <img src={daGrabaLogo} alt="DA GRABA Studio" className="h-[60px] w-[180px] object-contain drop-shadow-[0_0_15px_rgba(255,117,31,0.3)]" data-testid="img-pro-logo" />
          </a>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-sm text-white/70 hover:text-white" onClick={() => window.location.href = "/"} data-testid="link-back-home">
              {t('nav.home', 'Inicio')}
            </Button>
            <Button
              className="bg-gradient-to-r from-primary to-orange-500 text-white font-semibold text-sm px-5"
              onClick={handleAction}
              data-testid="button-pro-cta"
            >
              {user ? 'Ver Planes' : t('common.login', 'Iniciar Sesión')}
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        <section className="container mx-auto px-4 md:px-6 pt-16 md:pt-28 pb-16">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto space-y-6">
            <Badge className="bg-gradient-to-r from-primary/20 to-orange-500/20 text-primary border-primary/20">
              <Crown className="h-3 w-3 mr-1" />
              DA GRABA PRO
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight" data-testid="text-pro-hero-title">
              Producción Musical{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-yellow-400">
                Sin Límites
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed" data-testid="text-pro-hero-subtitle">
              Desbloquea todo el potencial de DA GRABA Studio con herramientas profesionales, 
              créditos ilimitados y acceso prioritario a nuestros servidores GPU.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                className="h-14 px-8 text-lg bg-gradient-to-r from-primary to-orange-500 text-white font-bold shadow-[0_0_25px_rgba(255,117,31,0.35)] gap-2"
                onClick={handleAction}
                data-testid="button-pro-upgrade"
              >
                Actualizar a PRO
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-lg border-white/10"
                onClick={() => document.getElementById("compare")?.scrollIntoView({ behavior: "smooth" })}
                data-testid="button-pro-compare"
              >
                Comparar Planes
              </Button>
            </div>
          </motion.div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-16">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-pro-features-title">Funciones Premium</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">Todo lo que necesitas para producir música de nivel profesional.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRO_FEATURES.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }}>
                  <Card className="bg-white/[0.02] border-white/5 hover:border-primary/20 transition-colors h-full" data-testid={`card-pro-feature-${i}`}>
                    <CardContent className="p-6 space-y-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-primary" />
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

        <section id="compare" className="container mx-auto px-4 md:px-6 py-16">
          <motion.div {...fadeUp} className="text-center mb-12">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Comparación</Badge>
            <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-pro-compare-title">Compara los Planes</h2>
          </motion.div>
          <motion.div {...fadeUp}>
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full min-w-[600px]" data-testid="table-comparison">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Función</th>
                    <th className="p-4 text-sm font-medium text-center">Free</th>
                    <th className="p-4 text-sm font-medium text-center">Basic</th>
                    <th className="p-4 text-sm font-medium text-center text-primary">Pro</th>
                    <th className="p-4 text-sm font-medium text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Crown className="h-3.5 w-3.5 text-yellow-400" />
                        Premium
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-sm font-medium">{row.feature}</td>
                      <td className="p-4 text-sm text-center text-muted-foreground">{row.free}</td>
                      <td className="p-4 text-sm text-center text-muted-foreground">{row.basic}</td>
                      <td className="p-4 text-sm text-center text-primary font-medium">{row.pro}</td>
                      <td className="p-4 text-sm text-center text-yellow-400">{row.premium}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-16">
          <motion.div {...fadeUp}>
            <div className="relative rounded-2xl overflow-hidden border border-primary/20">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-orange-600/10 to-yellow-500/10" />
              <div className="relative p-8 md:p-16 text-center space-y-6">
                <Crown className="w-12 h-12 text-primary mx-auto" />
                <h2 className="text-3xl md:text-4xl font-bold">
                  Lleva tu Música al Siguiente Nivel
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto text-lg">
                  Únete a los productores profesionales que confían en DA GRABA PRO.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    className="h-14 px-10 text-lg bg-gradient-to-r from-primary to-orange-500 text-white font-bold shadow-[0_0_30px_rgba(255,117,31,0.35)] gap-2"
                    onClick={handleAction}
                    data-testid="button-pro-cta-bottom"
                  >
                    Empezar con PRO
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  <Shield className="h-3 w-3 inline mr-1" />
                  7 días de prueba gratis. Cancela cuando quieras.
                </p>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      <Footer onLogin={handleAction} variant="landing" />
    </div>
  );
}
