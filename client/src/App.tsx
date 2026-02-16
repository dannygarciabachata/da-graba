import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import Landing from "@/pages/Landing";
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
import NotFound from "@/pages/not-found";
import SupportChat from "@/components/SupportChat";
import { useTranslation } from "react-i18next";

function AuthenticatedLayout() {
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-12 flex items-center px-3 border-b border-white/5 bg-background/90 backdrop-blur-md sticky top-0 z-40 lg:hidden">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/create" component={CreatePage} />
              <Route path="/dashboard"><Redirect to="/create" /></Route>
              <Route path="/discover/:genre" component={PlaylistPage} />
              <Route path="/discover" component={DiscoverPage} />
              <Route path="/library" component={LibraryPage} />
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
              <Route path="/admin" component={AdminPage} />
              <Route component={NotFound} />
            </Switch>
            <SupportChat />
          </main>
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
        <Route path="/blog/:slug" component={BlogPage} />
        <Route path="/blog" component={BlogPage} />
        <Route><Redirect to="/" /></Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/"><Redirect to="/create" /></Route>
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
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
