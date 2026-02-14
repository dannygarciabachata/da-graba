import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { GenerateSongRequest, SongResponse } from "@shared/schema";

export function useSongs() {
  return useQuery({
    queryKey: [api.songs.list.path],
    queryFn: async () => {
      const res = await fetch(api.songs.list.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch songs");
      return api.songs.list.responses[200].parse(await res.json());
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasPending = data.some((song: any) => song.status === 'pending' || song.status === 'processing');
      return hasPending ? 5000 : false;
    }
  });
}

export function useSong(id: number | null) {
  return useQuery({
    queryKey: [api.songs.get.path, id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error("ID required");
      const url = buildUrl(api.songs.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch song");
      return api.songs.get.responses[200].parse(await res.json());
    },
  });
}

export function useGenerateSong() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: GenerateSongRequest) => {
      const res = await fetch(api.songs.generate.path, {
        method: api.songs.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized");
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to generate song");
      }
      
      return api.songs.generate.responses[202].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.songs.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/credits"] });
      toast({
        title: "DGB Studio Activated",
        description: "Generando 2 versiones de tu track. Elige la mejor.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteSong() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.songs.delete.path, { id });
      const res = await fetch(url, {
        method: api.songs.delete.method,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to delete song");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.songs.list.path] });
      toast({
        title: "Song Deleted",
        description: "Track removed from your library.",
      });
    },
  });
}

export function useTogglePublish() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/songs/${id}/publish`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to toggle publish");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [api.songs.list.path] });
      toast({
        title: data.isPublic ? "Song Published" : "Song Unpublished",
        description: data.isPublic ? "Your track is now public." : "Your track is now private.",
      });
    },
  });
}
