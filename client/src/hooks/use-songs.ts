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
      toast({
        title: "Generation Started",
        description: "Your track is being composed by the AI engine.",
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
