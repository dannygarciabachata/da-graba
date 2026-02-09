import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Track } from "@shared/schema";

export function useSongTracks(songId: number | null) {
  return useQuery<Track[]>({
    queryKey: ["/api/songs", songId, "tracks"],
    enabled: !!songId,
    queryFn: async () => {
      if (!songId) return [];
      const res = await fetch(`/api/songs/${songId}/tracks`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tracks");
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.length === 0) return false;
      const hasPending = data.some((t) => t.status === "pending" || t.status === "processing");
      return hasPending ? 3000 : false;
    },
  });
}

export function useSeparateStems() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (songId: number) => {
      const res = await fetch(`/api/songs/${songId}/stems`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to start stem separation");
      }
      return res.json();
    },
    onSuccess: (_data, songId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs", songId, "tracks"] });
      toast({
        title: "Stem Separation Started",
        description: "AI is separating your track into individual stems (vocals, drums, bass, melody).",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Separation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateTrack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...settings }: { id: number; volume?: number; isMuted?: boolean; isSolo?: boolean }) => {
      const res = await fetch(`/api/tracks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update track");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs", data.songId, "tracks"] });
    },
  });
}
