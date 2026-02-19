import { useAuth } from "@/hooks/use-auth";
import { CreatePanel } from "@/components/CreatePanel";
import { TrackList } from "@/components/TrackList";

export default function HomePage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8" data-testid="home-page">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <CreatePanel />
        <TrackList />
      </div>
    </div>
  );
}
