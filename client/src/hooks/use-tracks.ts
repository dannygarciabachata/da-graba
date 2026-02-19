import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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

export function useCreateTrack() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { songId: number; name: string; type: string }) => {
      const res = await apiRequest("POST", "/api/tracks", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs", data.songId, "tracks"] });
      toast({
        title: "Track creado",
        description: `"${data.name}" se añadió al proyecto.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear track",
        description: error.message,
        variant: "destructive",
      });
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
        description: "AI is separating your track into individual stems.",
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

export function useMasterSong() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (songId: number) => {
      const res = await apiRequest("POST", `/api/songs/${songId}/master`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      toast({
        title: "Mastering Started",
        description: "AI is mastering your track for professional quality audio.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Mastering Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDenoiseSong() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (songId: number) => {
      const res = await apiRequest("POST", `/api/songs/${songId}/denoise`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      toast({
        title: "Denoise Started",
        description: "AI is cleaning noise from your track.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Denoise Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCoverSong() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ songId, voiceId }: { songId: number; voiceId: string }) => {
      const res = await apiRequest("POST", `/api/songs/${songId}/cover`, { voiceId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      toast({
        title: "Cover Generation Started",
        description: "AI is creating a cover version with a new voice.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Cover Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useTrimSong() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ songId, startTimeMs, endTimeMs }: { songId: number; startTimeMs: number; endTimeMs: number }) => {
      const res = await apiRequest("POST", `/api/songs/${songId}/trim`, { startTimeMs, endTimeMs });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      toast({
        title: "Audio Trimming Started",
        description: "AI is trimming your track to the selected range.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Trim Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
