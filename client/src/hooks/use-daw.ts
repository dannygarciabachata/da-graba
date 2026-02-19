import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DawClip } from "@shared/schema";

export function useDawClips(songId: number | null) {
  return useQuery<DawClip[]>({
    queryKey: ["/api/songs", songId, "clips"],
    enabled: !!songId,
    queryFn: async () => {
      if (!songId) return [];
      const res = await fetch(`/api/songs/${songId}/clips`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clips");
      return res.json();
    },
  });
}

export function useCreateDawClip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      songId: number;
      trackId?: number | null;
      name: string;
      audioUrl?: string | null;
      startTimeMs?: number;
      durationMs?: number;
      offsetMs?: number;
      laneIndex?: number;
      color?: string;
      source?: string;
      volume?: number;
    }) => {
      const res = await apiRequest("POST", "/api/daw/clips", data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs", variables.songId, "clips"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateDawClip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, songId, ...data }: { id: number; songId: number } & Partial<DawClip>) => {
      const res = await apiRequest("PATCH", `/api/daw/clips/${id}`, data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs", variables.songId, "clips"] });
    },
  });
}

export function useDeleteDawClip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, songId }: { id: number; songId: number }) => {
      const res = await apiRequest("DELETE", `/api/daw/clips/${id}`);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs", variables.songId, "clips"] });
      toast({ title: "Clip eliminado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useRecordAudio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { songId: number; blob: Blob; name: string; laneIndex: number; startTimeMs: number; durationMs: number }) => {
      const formData = new FormData();
      formData.append("audio", data.blob, "recording.webm");
      formData.append("songId", String(data.songId));
      formData.append("name", data.name);
      formData.append("laneIndex", String(data.laneIndex));
      formData.append("startTimeMs", String(data.startTimeMs));
      formData.append("durationMs", String(data.durationMs));

      const res = await fetch("/api/daw/record", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Recording failed");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs", variables.songId, "clips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/songs", variables.songId, "tracks"] });
      toast({ title: "Grabación guardada", description: "Tu grabación se ha añadido al proyecto." });
    },
    onError: (error: Error) => {
      toast({ title: "Error de grabación", description: error.message, variant: "destructive" });
    },
  });
}

export const SNAP_VALUES = [
  { label: "Off", ms: 0 },
  { label: "1/16", ms: 125 },
  { label: "1/8", ms: 250 },
  { label: "1/4", ms: 500 },
  { label: "1/2", ms: 1000 },
  { label: "1 bar", ms: 2000 },
  { label: "2 bars", ms: 4000 },
];

export function snapToGrid(timeMs: number, snapMs: number): number {
  if (snapMs <= 0) return timeMs;
  return Math.round(timeMs / snapMs) * snapMs;
}

export function msToBeats(ms: number, bpm: number): number {
  return (ms / 60000) * bpm;
}

export function beatsToMs(beats: number, bpm: number): number {
  return (beats / bpm) * 60000;
}
