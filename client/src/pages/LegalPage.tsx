import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { ArrowLeft, Shield, Lock, Cookie, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

type LegalSection = "terms" | "privacy" | "cookies";

function TermsContent() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8" data-testid="terms-content">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">{t('legalPages.terms.mainTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('legalPages.terms.lastUpdated')}</p>
        <p className="text-sm text-muted-foreground">{t('legalPages.terms.operatedBy')}</p>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        {t('legalPages.terms.intro')}
      </p>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">{t('legalPages.terms.section1.title')}</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">{t('legalPages.terms.section1.activeMembership')}</strong> {t('legalPages.terms.section1.activeMembershipDesc')}</p>
          <p><strong className="text-foreground">{t('legalPages.terms.section1.freePlan')}</strong> {t('legalPages.terms.section1.freePlanDesc')}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">{t('legalPages.terms.section2.title')}</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">{t('legalPages.terms.section2.privateUse')}</strong> {t('legalPages.terms.section2.privateUseDesc')}</p>
          <p><strong className="text-foreground">{t('legalPages.terms.section2.thirdParty')}</strong> {t('legalPages.terms.section2.thirdPartyDesc')}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">{t('legalPages.terms.section3.title')}</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">{t('legalPages.terms.section3.originalInstruments')}</strong> {t('legalPages.terms.section3.originalInstrumentsDesc')}</p>
          <p><strong className="text-foreground">{t('legalPages.terms.section3.thirdPartyInstruments')}</strong> {t('legalPages.terms.section3.thirdPartyInstrumentsDesc')}</p>
          <p><strong className="text-foreground">{t('legalPages.terms.section3.creatorResponsibility')}</strong> {t('legalPages.terms.section3.creatorResponsibilityDesc')}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">{t('legalPages.terms.section4.title')}</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">{t('legalPages.terms.section4.designation')}</strong> {t('legalPages.terms.section4.designationDesc')}</p>
          <p><strong className="text-foreground">{t('legalPages.terms.section4.royaltySplits')}</strong> {t('legalPages.terms.section4.royaltySplitsDesc')}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">{t('legalPages.terms.section5.title')}</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>{t('legalPages.terms.section5.p1')}</p>
          <p>{t('legalPages.terms.section5.p2')}</p>
        </div>
      </section>
    </div>
  );
}

function PrivacyContent() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8" data-testid="privacy-content">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">{t('legalPages.privacy.mainTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('legalPages.privacy.subtitle')}</p>
        <p className="text-sm text-muted-foreground">{t('legalPages.privacy.lastUpdated')}</p>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">{t('legalPages.privacy.section1.title')}</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">{t('legalPages.privacy.section1.accountData')}</strong> {t('legalPages.privacy.section1.accountDataDesc')}</p>
          <p><strong className="text-foreground">{t('legalPages.privacy.section1.vocalDna')}</strong> {t('legalPages.privacy.section1.vocalDnaDesc')}</p>
          <p><strong className="text-foreground">{t('legalPages.privacy.section1.usageData')}</strong> {t('legalPages.privacy.section1.usageDataDesc')}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">{t('legalPages.privacy.section2.title')}</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">{t('legalPages.privacy.section2.privacyByDesign')}</strong> {t('legalPages.privacy.section2.privacyByDesignDesc')}</p>
          <p><strong className="text-foreground">{t('legalPages.privacy.section2.security')}</strong> {t('legalPages.privacy.section2.securityDesc')}</p>
          <p><strong className="text-foreground">{t('legalPages.privacy.section2.serviceImprovement')}</strong> {t('legalPages.privacy.section2.serviceImprovementDesc')}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">{t('legalPages.privacy.section3.title')}</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>{t('legalPages.privacy.section3.intro')}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('legalPages.privacy.section3.item1')}</li>
            <li>{t('legalPages.privacy.section3.item2')}</li>
            <li>{t('legalPages.privacy.section3.item3')}</li>
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">{t('legalPages.privacy.section4.title')}</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>{t('legalPages.privacy.section4.intro')}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">{t('legalPages.privacy.section4.deleteData')}</strong> {t('legalPages.privacy.section4.deleteDataDesc')}</li>
            <li><strong className="text-foreground">{t('legalPages.privacy.section4.portability')}</strong> {t('legalPages.privacy.section4.portabilityDesc')}</li>
            <li><strong className="text-foreground">{t('legalPages.privacy.section4.access')}</strong> {t('legalPages.privacy.section4.accessDesc')}</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function CookiesContent() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8" data-testid="cookies-content">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">{t('legalPages.cookies.mainTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('legalPages.cookies.subtitle')}</p>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">{t('legalPages.cookies.section1.title')}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t('legalPages.cookies.section1.description')}
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">{t('legalPages.cookies.section2.title')}</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">{t('legalPages.cookies.section2.essential')}</strong> {t('legalPages.cookies.section2.essentialDesc')}</p>
          <p><strong className="text-foreground">{t('legalPages.cookies.section2.performance')}</strong> {t('legalPages.cookies.section2.performanceDesc')}</p>
          <p><strong className="text-foreground">{t('legalPages.cookies.section2.functional')}</strong> {t('legalPages.cookies.section2.functionalDesc')}</p>
          <p><strong className="text-foreground">{t('legalPages.cookies.section2.analytics')}</strong> {t('legalPages.cookies.section2.analyticsDesc')}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">{t('legalPages.cookies.section3.title')}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t('legalPages.cookies.section3.description')}
        </p>
      </section>
    </div>
  );
}

const SECTION_ICONS: Record<LegalSection, typeof Shield> = {
  terms: FileText,
  privacy: Lock,
  cookies: Cookie,
};

export default function LegalPage({ section = "terms" }: { section?: LegalSection }) {
  const { t } = useTranslation();
  const Icon = SECTION_ICONS[section];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t('common.back')}
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t(`legalPages.titles.${section}`)}</h1>
        </div>

        <div className="flex gap-2 mb-8">
          <Link href="/terms">
            <Button variant={section === "terms" ? "default" : "outline"} size="sm" data-testid="button-tab-terms">
              <FileText className="w-3 h-3 mr-1" /> {t('legalPages.tabs.terms')}
            </Button>
          </Link>
          <Link href="/privacy">
            <Button variant={section === "privacy" ? "default" : "outline"} size="sm" data-testid="button-tab-privacy">
              <Lock className="w-3 h-3 mr-1" /> {t('legalPages.tabs.privacy')}
            </Button>
          </Link>
          <Link href="/cookies">
            <Button variant={section === "cookies" ? "default" : "outline"} size="sm" data-testid="button-tab-cookies">
              <Cookie className="w-3 h-3 mr-1" /> {t('legalPages.tabs.cookies')}
            </Button>
          </Link>
        </div>

        <div className="bg-card/50 border border-white/5 rounded-xl p-6 md:p-8">
          {section === "terms" && <TermsContent />}
          {section === "privacy" && <PrivacyContent />}
          {section === "cookies" && <CookiesContent />}
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} DGB STUDIO & ODGMUSIC LATIN WORLDWIDE PUBLISHING. {t('legalPages.footer')}
        </div>
      </div>
    </div>
  );
}
