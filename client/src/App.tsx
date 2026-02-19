import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { FooterPlayerBar } from "@/components/FooterPlayerBar";
import Landing from "@/pages/Landing";
import palettaBg from "@assets/palettabg_1771282011333.png";
import dgbLogo from "@assets/Logo_1771474005704.png";
import dgbMobileLogo from "@assets/Logomobil2_1771474745681.png";
import HomePage from "@/pages/HomePage";
import CreatePage from "@/pages/CreatePage";
import LibraryPage from "@/pages/LibraryPage";
import LyricsPage from "@/pages/LyricsPage";
import QuizPage from "@/pages/QuizPage";
import StudioPage from "@/pages/Studio";
import SampleLab from "@/pages/SampleLab";
import AdminPage from "@/pages/AdminPage";
import PricingPage from "@/pages/PricingPage";
import StyleKitsPage from "@/pages/StyleKitsPage";
import ProducerStorePage from "@/pages/ProducerStorePage";
import AudioToolsPage from "@/pages/AudioToolsPage";
import BlogPage from "@/pages/BlogPage";
import CoverDesignerPage from "@/pages/CoverDesignerPage";
import DiscoverPage from "@/pages/DiscoverPage";
import PlaylistPage from "@/pages/PlaylistPage";
import ArtistDashboardPage from "@/pages/ArtistDashboardPage";
import ArtistProfilePage from "@/pages/ArtistProfilePage";
import ArtistOnboardingPage from "@/pages/ArtistOnboardingPage";
import DiscographyPage from "@/pages/DiscographyPage";
import CopyrightHubPage from "@/pages/CopyrightHubPage";
import LegalPage from "@/pages/LegalPage";
import MyPlaylistsPage from "@/pages/MyPlaylistsPage";
import MyPlaylistDetailPage from "@/pages/MyPlaylistDetailPage";
import PublicPlaylistViewPage from "@/pages/PublicPlaylistViewPage";
import NotFound from "@/pages/not-found";
import SupportChat from "@/components/SupportChat";
import { useTranslation } from "react-i18next";
import { useLocation as useWouterLocation } from "wouter";

function useServiceContext(): string | undefined {
  const [location] = useWouterLocation();
  if (location.startsWith("/home")) return "home";
  if (location.startsWith("/create")) return "create";
  if (location.startsWith("/library")) return "library";
  if (location.startsWith("/my-playlists")) return "my-playlists";
  if (location.startsWith("/studio")) return "studio";
  if (location.startsWith("/sample-lab")) return "sample_lab";
  if (location.startsWith("/artist-dashboard")) return "artist_dashboard";
  if (location.startsWith("/artist/")) return "artist_profile";
  if (location.startsWith("/discover")) return "discover";
  if (location.startsWith("/discography")) return "discography";
  if (location.startsWith("/pricing")) return "pricing";
  if (location.startsWith("/blog")) return "blog";
  if (location.startsWith("/admin")) return "admin";
  if (location.startsWith("/style-kits")) return "style_kits";
  if (location.startsWith("/producer-store")) return "producer_store";
  return undefined;
}

function AuthenticatedLayout() {
  const serviceContext = useServiceContext();
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-14 flex items-center px-3 gap-3 border-b border-white/5 bg-background/90 backdrop-blur-md sticky top-0 z-40 lg:hidden">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <img src={dgbMobileLogo} alt="DA GRABA Studio" className="h-9 w-auto object-contain" data-testid="img-mobile-logo" />
          </header>
          <main
            className="flex-1 overflow-auto relative"
            style={{
              backgroundImage: `url(${palettaBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundAttachment: "fixed",
            }}
          >
            <div className="absolute inset-0 bg-[#0a0a12]/92 pointer-events-none" />
            <div className="relative z-10 min-h-full pb-[72px]">
            <Switch>
              <Route path="/home" component={HomePage} />
              <Route path="/create" component={CreatePage} />
              <Route path="/dashboard"><Redirect to="/home" /></Route>
              <Route path="/discover/:genre" component={PlaylistPage} />
              <Route path="/discover" component={DiscoverPage} />
              <Route path="/library" component={LibraryPage} />
              <Route path="/my-playlists/:id" component={MyPlaylistDetailPage} />
              <Route path="/my-playlists" component={MyPlaylistsPage} />
              <Route path="/lyrics" component={LyricsPage} />
              <Route path="/quiz" component={QuizPage} />
              <Route path="/studio" component={StudioPage} />
              <Route path="/sample-lab" component={SampleLab} />
              <Route path="/audio-tools" component={AudioToolsPage} />
              <Route path="/style-kits" component={StyleKitsPage} />
              <Route path="/producer-store" component={ProducerStorePage} />
              <Route path="/pricing" component={PricingPage} />
              <Route path="/blog/:slug" component={BlogPage} />
              <Route path="/blog" component={BlogPage} />
              <Route path="/cover-designer" component={CoverDesignerPage} />
              <Route path="/copyright" component={CopyrightHubPage} />
              <Route path="/artist-dashboard" component={ArtistDashboardPage} />
              <Route path="/artist-onboarding" component={ArtistOnboardingPage} />
              <Route path="/discography" component={DiscographyPage} />
              <Route path="/playlist/:id" component={PublicPlaylistViewPage} />
              <Route path="/artist/:id" component={ArtistProfilePage} />
              <Route path="/admin" component={AdminPage} />
              <Route path="/terms">{() => <LegalPage section="terms" />}</Route>
              <Route path="/privacy">{() => <LegalPage section="privacy" />}</Route>
              <Route path="/cookies">{() => <LegalPage section="cookies" />}</Route>
              <Route component={NotFound} />
            </Switch>
            <SupportChat serviceContext={serviceContext} />
            </div>
          </main>
          <div className="flex-shrink-0 sticky bottom-0 z-50">
            <FooterPlayerBar onOpenStudio={() => window.location.href = "/studio"} />
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-primary">
        {t('common.loading')}
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/discover/:genre" component={PlaylistPage} />
        <Route path="/discover" component={DiscoverPage} />
        <Route path="/playlist/:id" component={PublicPlaylistViewPage} />
        <Route path="/blog/:slug" component={BlogPage} />
        <Route path="/blog" component={BlogPage} />
        <Route path="/discography" component={DiscographyPage} />
        <Route path="/terms">{() => <LegalPage section="terms" />}</Route>
        <Route path="/privacy">{() => <LegalPage section="privacy" />}</Route>
        <Route path="/cookies">{() => <LegalPage section="cookies" />}</Route>
        <Route><Redirect to="/" /></Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/"><Redirect to="/home" /></Route>
      <Route>
        <AuthenticatedLayout />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PlayerProvider>
          <Router />
        </PlayerProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
