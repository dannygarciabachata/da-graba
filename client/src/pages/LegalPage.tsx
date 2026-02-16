import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { ArrowLeft, Shield, Lock, Cookie, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

type LegalSection = "terms" | "privacy" | "cookies";

function TermsContent() {
  return (
    <div className="space-y-8" data-testid="terms-content">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">TÉRMINOS DE SERVICIO Y ACUERDO DE LICENCIA DE DGB STUDIO CLOUD ENGINE</h2>
        <p className="text-sm text-muted-foreground">Última actualización: 16 de febrero de 2026</p>
        <p className="text-sm text-muted-foreground">Operado por: DGB STUDIO & ODGMUSIC LATIN WORLDWIDE PUBLISHING</p>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        Al acceder o utilizar el servicio DGB STUDIO Cloud Engine, usted (el "Usuario") acepta estar legalmente vinculado por los siguientes términos. Si no está de acuerdo, no utilice el Servicio.
      </p>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">1. MODELO DE PROPIEDAD Y MEMBRESÍA (REGLA 60/40)</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">Usuarios con Membresía Activa:</strong> Los usuarios que mantengan una suscripción paga tienen plenos derechos comerciales sobre el contenido generado. La música es "Libre de Regalías" (Royalty Free) para el usuario bajo este plan.</p>
          <p><strong className="text-foreground">Usuarios sin Membresía (Plan Free):</strong> Para compensar el uso de nuestra infraestructura y librerías de instrumentos exclusivos, el Usuario acepta que DGB STUDIO / ODGMUSIC retendrá automáticamente el 60% de los derechos de autor y derechos conexos sobre cada obra generada.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">2. PRIVACIDAD DEL ADN VOCAL Y MODELOS RVC</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">Uso Privado:</strong> Los audios subidos para entrenar voces son procesados de forma encriptada. El modelo de voz resultante pertenece al Usuario y es estrictamente privado.</p>
          <p><strong className="text-foreground">Prohibición de Uso por Terceros:</strong> DGB STUDIO no compartirá, regalará ni utilizará su ADN vocal para otros usuarios sin su consentimiento expreso a través de la sección "Discover".</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">3. INSTRUMENTACIÓN Y ADN DE EJECUCIÓN (LÍMITE DE RESPONSABILIDAD)</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">Instrumentos Originales DGB:</strong> El sistema utiliza modelos entrenados con instrumentos reales grabados por Danny Garcia y maestros dominicanos.</p>
          <p><strong className="text-foreground">Instrumentos de Terceros:</strong> DGB STUDIO permite la integración de modelos externos. Sin embargo, el sistema no se responsabiliza si el audio generado infringe el "ADN de ejecución" de un músico real.</p>
          <p><strong className="text-foreground">Responsabilidad del Creador:</strong> Si un artista publica o distribuye una canción que genere reclamos de propiedad intelectual por su estilo de ejecución, la responsabilidad legal recae íntegramente sobre el Artista/Usuario, deslindando a DGB STUDIO de cualquier litigio.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">4. ACUERDO DE PUBLISHING Y DISTRIBUCIÓN (ODGMUSIC)</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">Designación:</strong> Al seleccionar la opción de "Distribución con nosotros", el Usuario designa a ODGMUSIC LATIN WORLDWIDE PUBLISHING (afiliada a ASCAP) como su administrador editorial exclusivo a nivel mundial.</p>
          <p><strong className="text-foreground">Reparto de Regalías (Splits):</strong> Se aplicará un contrato de administración con un reparto de 50% para el Artista y 50% para la Editora sobre los ingresos netos recaudados por explotación mecánica, sincronización y ventas digitales.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">5. USOS PROHIBIDOS</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>Queda prohibido el uso de sistemas automatizados (bots) para generar contenido de forma masiva que sature la infraestructura del Cloud Engine.</p>
          <p>No se permite la creación de contenido difamatorio, ilegal o que infrinja derechos de terceros utilizando voces sintéticas de figuras públicas sin autorización.</p>
        </div>
      </section>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-8" data-testid="privacy-content">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">POLÍTICA DE PRIVACIDAD</h2>
        <p className="text-sm text-muted-foreground">DGB STUDIO Cloud Engine & ODGMUSIC</p>
        <p className="text-sm text-muted-foreground">Última actualización: 16 de febrero de 2026</p>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">1.1. Información que Recopilamos</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">Datos de Cuenta:</strong> Correo electrónico, nombre artístico y datos de inicio de sesión (Google, Discord, etc.).</p>
          <p><strong className="text-foreground">ADN Vocal (Audios de Entrenamiento):</strong> Archivos .wav o .mp3 que subes para entrenar modelos RVC.</p>
          <p><strong className="text-foreground">Datos de Uso:</strong> Prompts de texto, registros de generación y archivos de audio creados.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">1.2. Uso de los Datos y "ADN Vocal"</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">Privacidad por Diseño:</strong> Tus audios de entrenamiento se utilizan exclusivamente para procesar tu modelo personal. DGB STUDIO no vende, regala ni utiliza tus voces para entrenar modelos públicos sin tu permiso expreso.</p>
          <p><strong className="text-foreground">Seguridad:</strong> Utilizamos cifrado de alto nivel para asegurar que tu modelo de voz solo sea accesible desde tu cuenta.</p>
          <p><strong className="text-foreground">Mejora del Servicio:</strong> Los datos de uso (no las voces) se analizan de forma anónima para optimizar nuestros servidores y algoritmos de bachata y bolero.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">1.3. Compartición de Datos</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>No compartimos tus datos con terceros, excepto:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Para procesar pagos (Stripe/PayPal).</li>
            <li>Para registros oficiales de Copyright y Publishing con ODGMUSIC / ASCAP (solo si eliges distribuir con nosotros).</li>
            <li>Por requerimiento legal de autoridades competentes.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">1.4. Tus Derechos</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>Como artista, tienes derecho a:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Eliminar tus datos:</strong> Puedes borrar tus modelos de voz y archivos en cualquier momento.</li>
            <li><strong className="text-foreground">Portabilidad:</strong> Solicitar una copia de tus creaciones.</li>
            <li><strong className="text-foreground">Acceso:</strong> Saber exactamente qué información tenemos almacenada.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function CookiesContent() {
  return (
    <div className="space-y-8" data-testid="cookies-content">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">POLÍTICA DE COOKIES</h2>
        <p className="text-sm text-muted-foreground">DGB STUDIO Cloud Engine</p>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">2.1. ¿Qué son las Cookies?</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Las cookies son pequeños archivos de texto que nos ayudan a que tu experiencia en el DGB STUDIO Cloud Engine sea fluida y profesional.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">2.2. Tipos de Cookies que Utilizamos</h3>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">Esenciales:</strong> Necesarias para que mantengas tu sesión abierta mientras entrenas tus modelos o generas música. Sin estas, el sistema no funcionaría.</p>
          <p><strong className="text-foreground">De Rendimiento:</strong> Nos ayudan a saber si el servidor está lento o si hay errores en el proceso de "Process Data" o "Train".</p>
          <p><strong className="text-foreground">Funcionales:</strong> Recuerdan tus preferencias, como el idioma o la configuración de tus modelos de IA favoritos.</p>
          <p><strong className="text-foreground">Analíticas:</strong> Nos permiten entender qué funciones son las más usadas por los bachateros para seguir mejorando el sistema.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">2.3. Control de Cookies</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Puedes desactivar las cookies desde la configuración de tu navegador. Sin embargo, ten en cuenta que funciones críticas como el entrenamiento de voces y el acceso a tu panel de ODGMUSIC podrían verse afectadas.
        </p>
      </section>
    </div>
  );
}

const SECTION_CONFIG: Record<LegalSection, { icon: typeof Shield; titleKey: string }> = {
  terms: { icon: FileText, titleKey: "Términos de Servicio" },
  privacy: { icon: Lock, titleKey: "Política de Privacidad" },
  cookies: { icon: Cookie, titleKey: "Política de Cookies" },
};

export default function LegalPage({ section = "terms" }: { section?: LegalSection }) {
  const { t } = useTranslation();
  const config = SECTION_CONFIG[section];
  const Icon = config.icon;

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
          <h1 className="text-2xl font-bold text-foreground">{config.titleKey}</h1>
        </div>

        <div className="flex gap-2 mb-8">
          <Link href="/terms">
            <Button variant={section === "terms" ? "default" : "outline"} size="sm" data-testid="button-tab-terms">
              <FileText className="w-3 h-3 mr-1" /> Términos
            </Button>
          </Link>
          <Link href="/privacy">
            <Button variant={section === "privacy" ? "default" : "outline"} size="sm" data-testid="button-tab-privacy">
              <Lock className="w-3 h-3 mr-1" /> Privacidad
            </Button>
          </Link>
          <Link href="/cookies">
            <Button variant={section === "cookies" ? "default" : "outline"} size="sm" data-testid="button-tab-cookies">
              <Cookie className="w-3 h-3 mr-1" /> Cookies
            </Button>
          </Link>
        </div>

        <div className="bg-card/50 border border-white/5 rounded-xl p-6 md:p-8">
          {section === "terms" && <TermsContent />}
          {section === "privacy" && <PrivacyContent />}
          {section === "cookies" && <CookiesContent />}
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} DGB STUDIO & ODGMUSIC LATIN WORLDWIDE PUBLISHING. Todos los derechos reservados.
        </div>
      </div>
    </div>
  );
}
