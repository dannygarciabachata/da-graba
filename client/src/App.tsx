import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/AppSidebar";
import { TopHeaderBar } from "@/components/TopHeaderBar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { FooterPlayerBar } from "@/components/FooterPlayerBar";
import Landing from "@/pages/Landing";
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
import ProfilePage from "@/pages/ProfilePage";
import StemSplitterPage from "@/pages/StemSplitterPage";
import VoiceLab from "@/pages/VoiceLab";
import AboutPage from "@/pages/AboutPage";
import AffiliatePage from "@/pages/AffiliatePage";
import ProPage from "@/pages/ProPage";
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
  if (location.startsWith("/stem-splitter")) return "stem_splitter";
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
  if (location.startsWith("/voice-lab")) return "voice_lab";
  return undefined;
}

function AuthenticatedLayout() {
  const serviceContext = useServiceContext();

  const sidebarStyle = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      <TopHeaderBar />
      <SidebarProvider style={sidebarStyle as React.CSSProperties} defaultOpen={true}>
        <div className="flex flex-1 w-full">
          <AppSidebar />
          <SidebarInset className="flex flex-col flex-1 min-w-0">
            <main className="flex-1 overflow-auto pb-[80px]">
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
                <Route path="/stem-splitter" component={StemSplitterPage} />
                <Route path="/audio-tools" component={AudioToolsPage} />
                <Route path="/voice-lab" component={VoiceLab} />
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
                <Route path="/profile" component={ProfilePage} />
                <Route path="/admin" component={AdminPage} />
                <Route path="/about" component={AboutPage} />
                <Route path="/affiliate" component={AffiliatePage} />
                <Route path="/pro" component={ProPage} />
                <Route path="/terms">{() => <LegalPage section="terms" />}</Route>
                <Route path="/privacy">{() => <LegalPage section="privacy" />}</Route>
                <Route path="/cookies">{() => <LegalPage section="cookies" />}</Route>
                <Route component={NotFound} />
              </Switch>
              <SupportChat serviceContext={serviceContext} />
            </main>
            <div className="fixed bottom-0 left-0 right-0 z-50">
              <FooterPlayerBar onOpenStudio={() => window.location.href = "/studio"} />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}

function Router() {
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-orange-300/70">{t('common.loading')}</span>
        </div>
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
        <Route path="/about" component={AboutPage} />
        <Route path="/affiliate" component={AffiliatePage} />
        <Route path="/pro" component={ProPage} />
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
