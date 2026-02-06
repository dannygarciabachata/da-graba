import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { GenerateLyricsRequest } from "@shared/schema";

export function useGenerateLyrics() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: GenerateLyricsRequest) => {
      const res = await fetch(api.lyrics.generate.path, {
        method: api.lyrics.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized");
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to generate lyrics");
      }
      
      return api.lyrics.generate.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      toast({
        title: "Lyrics Generated",
        description: "New verses added to the editor.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
