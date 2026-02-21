import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, Twitter, Instagram, Youtube } from "lucide-react";
import daGrabaLogo from "@assets/Logomobil2_1771526285843.png";

interface FooterProps {
  onLogin?: () => void;
  variant?: "landing" | "app";
}

export function Footer({ onLogin, variant = "landing" }: FooterProps) {
  const { t, i18n } = useTranslation();
  const year = new Date().getFullYear();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleAction = (action?: string) => {
    if (onLogin) onLogin();
  };

  return (
    <footer className="border-t border-white/[0.06] bg-black/40 backdrop-blur-sm relative" data-testid="footer">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 py-12 md:py-16">
          <div className="col-span-2 md:col-span-2">
            <div className="mb-5">
              <img
                src={daGrabaLogo}
                alt="DA GRABA Studio"
                className="h-14 w-auto max-w-[160px] object-contain drop-shadow-[0_0_12px_rgba(255,117,31,0.25)]"
                data-testid="img-footer-logo"
              />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-6">
              {t('landing.footer.footerDescription')}
            </p>
            <div className="flex items-center gap-3">
              <a href="https://twitter.com/dagraba" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-all" data-testid="social-twitter">
                <Twitter className="w-4 h-4 text-muted-foreground" />
              </a>
              <a href="https://instagram.com/dagraba" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-all" data-testid="social-instagram">
                <Instagram className="w-4 h-4 text-muted-foreground" />
              </a>
              <a href="https://youtube.com/@dagraba" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-all" data-testid="social-youtube">
                <Youtube className="w-4 h-4 text-muted-foreground" />
              </a>
              <a href="mailto:support@dagraba.studio" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-all" data-testid="social-email">
                <Mail className="w-4 h-4 text-muted-foreground" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-foreground mb-4">{t('landing.footer.product')}</h4>
            <ul className="space-y-2.5">
              {variant === "landing" ? (
                <>
                  <li><button onClick={() => scrollTo("features")} className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-features">{t('nav.features')}</button></li>
                  <li><button onClick={() => scrollTo("pricing")} className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-pricing">{t('nav.pricing')}</button></li>
                </>
              ) : (
                <>
                  <li><a href="/create" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-create">{t('nav.create', 'Crear')}</a></li>
                  <li><a href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-pricing">{t('nav.pricing')}</a></li>
                </>
              )}
              <li><button onClick={() => handleAction()} className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-store">{t('landing.footer.producerStore')}</button></li>
              <li><button onClick={() => handleAction()} className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-kits">{t('landing.footer.styleKits')}</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-foreground mb-4">{t('landing.footer.tools')}</h4>
            <ul className="space-y-2.5">
              <li><button onClick={() => handleAction()} className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-generator">{t('landing.footer.aiMusicGenerator')}</button></li>
              <li><button onClick={() => handleAction()} className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-stems">{t('landing.footer.stemSeparator')}</button></li>
              <li><button onClick={() => handleAction()} className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-lyrics">{t('landing.footer.aiLyricsWriter')}</button></li>
              <li><button onClick={() => handleAction()} className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-samplelab">{t('landing.footer.sampleLab')}</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-foreground mb-4">{t('landing.footer.genres')}</h4>
            <ul className="space-y-2.5">
              <li className="text-sm text-muted-foreground">{t('create.genres.bachata')}</li>
              <li className="text-sm text-muted-foreground">{t('create.genres.latinPop')}</li>
              <li className="text-sm text-muted-foreground">{t('create.genres.reggaeton')}</li>
              <li className="text-sm text-muted-foreground">{t('create.genres.bolero')} & {t('create.genres.salsa')}</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/[0.06] py-8">
          <h4 className="font-semibold text-sm mb-5 text-center">{t('landing.footer.faqTitle')}</h4>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {(t('landing.footer.faq', { returnObjects: true }) as {q: string, a: string}[]).map((item, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-colors" data-testid={`faq-item-${i}`}>
                <p className="text-sm font-medium text-foreground mb-1.5">{item.q}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/[0.06] py-6">
          <div className="text-center mb-5">
            <p className="text-xs text-muted-foreground mb-2">{t('landing.footer.needHelp')}</p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => handleAction()}
              data-testid="button-footer-support"
            >
              <MessageCircle className="h-4 w-4" />
              {t('landing.footer.chatSupport')}
            </Button>
          </div>
        </div>

        <div className="border-t border-white/[0.06] py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">&copy; {year} {t('landing.footer.copyright')}</p>
          <div className="flex items-center gap-4">
            <a href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-terms">{t('landing.footer.termsLink')}</a>
            <span className="text-white/10">|</span>
            <a href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-privacy">{t('landing.footer.privacyLink')}</a>
            <span className="text-white/10">|</span>
            <a href="/cookies" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-cookies">{t('landing.footer.cookiesLink')}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
