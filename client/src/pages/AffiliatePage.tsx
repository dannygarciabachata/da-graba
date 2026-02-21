import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  DollarSign, Users, Share2, TrendingUp, ArrowRight, CheckCircle2,
  Gift, Percent, BarChart3, Link2
} from "lucide-react";
import daGrabaLogo from "@assets/Logomobil2_1771526285843.png";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.6 },
};

const BENEFITS = [
  { icon: Percent, title: "30% de Comisión", description: "Gana el 30% de cada suscripción referida durante el primer año completo." },
  { icon: DollarSign, title: "Pagos Mensuales", description: "Recibe tus comisiones cada mes directamente a tu cuenta bancaria o PayPal." },
  { icon: Link2, title: "Link Único", description: "Obtén tu enlace de referido personalizado y compártelo en tus redes sociales." },
  { icon: BarChart3, title: "Dashboard en Tiempo Real", description: "Monitorea tus referidos, conversiones y ganancias con estadísticas detalladas." },
];

const STEPS = [
  { step: "1", title: "Regístrate", description: "Crea tu cuenta de afiliado gratuita en menos de 2 minutos." },
  { step: "2", title: "Comparte tu Link", description: "Comparte tu enlace único en redes sociales, blogs o con tu audiencia." },
  { step: "3", title: "Gana Comisiones", description: "Recibe el 30% por cada usuario que se suscriba a través de tu enlace." },
];

const TIERS = [
  { name: "Starter", referrals: "1-10", commission: "25%", perks: ["Link personalizado", "Dashboard básico", "Pagos mensuales"] },
  { name: "Pro", referrals: "11-50", commission: "30%", perks: ["Todo de Starter", "Materiales de marketing", "Soporte prioritario", "Reportes avanzados"], highlight: true },
  { name: "Elite", referrals: "50+", commission: "35%", perks: ["Todo de Pro", "Manager dedicado", "Comisiones de por vida", "Early access a features"] },
];

export default function AffiliatePage() {
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

      <nav className="relative z-20 border-b border-white/[0.06] backdrop-blur-xl bg-background/70 sticky top-0" data-testid="nav-affiliate">
        <div className="container mx-auto px-4 md:px-6 py-3 flex justify-between items-center">
          <a href="/" className="flex items-center">
            <img src={daGrabaLogo} alt="DA GRABA Studio" className="h-[60px] w-[180px] object-contain drop-shadow-[0_0_15px_rgba(255,117,31,0.3)]" data-testid="img-affiliate-logo" />
          </a>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-sm text-white/70 hover:text-white" onClick={() => window.location.href = "/"} data-testid="link-back-home">
              {t('nav.home', 'Inicio')}
            </Button>
            <Button
              className="bg-gradient-to-r from-primary to-orange-500 text-white font-semibold text-sm px-5"
              onClick={handleAction}
              data-testid="button-affiliate-cta"
            >
              {user ? t('nav.home', 'Inicio') : t('common.login', 'Iniciar Sesión')}
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        <section className="container mx-auto px-4 md:px-6 pt-16 md:pt-28 pb-16">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto space-y-6">
            <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
              <DollarSign className="h-3 w-3 mr-1" />
              Programa de Afiliados
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight" data-testid="text-affiliate-hero-title">
              Gana Dinero{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-green-500">
                Compartiendo Música
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed" data-testid="text-affiliate-hero-subtitle">
              Únete al programa de afiliados de DA GRABA y gana comisiones recurrentes por cada artista que refieras a la plataforma.
            </p>
            <Button
              size="lg"
              className="h-14 px-8 text-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold shadow-[0_0_25px_rgba(34,197,94,0.35)] gap-2"
              onClick={handleAction}
              data-testid="button-affiliate-join"
            >
              Unirse al Programa
              <ArrowRight className="h-5 w-5" />
            </Button>
          </motion.div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-16">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-affiliate-benefits-title">¿Por qué ser Afiliado?</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {BENEFITS.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}>
                  <Card className="bg-white/[0.02] border-white/5 hover:border-green-500/20 transition-colors h-full" data-testid={`card-benefit-${i}`}>
                    <CardContent className="p-6 space-y-4">
                      <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-green-400" />
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
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Cómo Funciona</Badge>
            <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-affiliate-steps-title">3 Pasos Simples</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {STEPS.map((item, i) => (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.15 }}>
                <div className="text-center space-y-4 p-6" data-testid={`affiliate-step-${i}`}>
                  <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
                    <span className="text-2xl font-bold text-green-400">{item.step}</span>
                  </div>
                  <h3 className="text-lg font-bold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-16">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-affiliate-tiers-title">Niveles de Afiliado</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {TIERS.map((tier, i) => (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}>
                <Card className={`h-full ${tier.highlight ? "border-green-500/50 shadow-lg shadow-green-500/10" : "bg-white/[0.02] border-white/5"}`} data-testid={`card-tier-${i}`}>
                  {tier.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-green-500 text-white font-semibold">Recomendado</Badge>
                    </div>
                  )}
                  <CardContent className="p-6 space-y-4 relative">
                    <h3 className="font-bold text-lg">{tier.name}</h3>
                    <p className="text-sm text-muted-foreground">{tier.referrals} referidos</p>
                    <p className="text-4xl font-bold text-green-400">{tier.commission}</p>
                    <p className="text-xs text-muted-foreground">comisión por referido</p>
                    <ul className="space-y-2 pt-2">
                      {tier.perks.map((perk, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{perk}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full mt-4 ${tier.highlight ? "bg-green-500 text-white hover:bg-green-600" : ""}`}
                      variant={tier.highlight ? "default" : "outline"}
                      onClick={handleAction}
                      data-testid={`button-tier-${i}`}
                    >
                      Comenzar
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 md:px-6 py-16">
          <motion.div {...fadeUp}>
            <div className="relative rounded-2xl overflow-hidden border border-white/10">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-600/10 to-green-500/10" />
              <div className="relative p-8 md:p-16 text-center space-y-6">
                <Gift className="w-12 h-12 text-green-400 mx-auto" />
                <h2 className="text-3xl md:text-4xl font-bold">
                  ¿Listo para Empezar a Ganar?
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto text-lg">
                  Regístrate hoy y comienza a ganar comisiones compartiendo la mejor plataforma de producción musical latina.
                </p>
                <Button
                  size="lg"
                  className="h-14 px-10 text-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold shadow-[0_0_30px_rgba(34,197,94,0.35)] gap-2"
                  onClick={handleAction}
                  data-testid="button-affiliate-cta-bottom"
                >
                  Unirse Ahora
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
