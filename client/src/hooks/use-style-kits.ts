import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { StyleKit, StyleKitInstrument } from "@shared/schema";

type StyleKitWithInstruments = StyleKit & { instruments: StyleKitInstrument[] };

export function useStyleKits(genre?: string) {
  const url = genre ? `/api/style-kits?genre=${genre}` : "/api/style-kits";
  return useQuery<StyleKitWithInstruments[]>({
    queryKey: ["/api/style-kits", genre ?? "all"],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    retry: false,
  });
}

export function useStyleKit(id: number) {
  return useQuery<StyleKitWithInstruments>({
    queryKey: ["/api/style-kits", id],
    queryFn: async () => {
      const res = await fetch(`/api/style-kits/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: id > 0,
    retry: false,
  });
}

export function useStyleKitMeta() {
  return useQuery<{ genres: string[]; instrumentTypes: string[] }>({
    queryKey: ["/api/style-kits/meta"],
    retry: false,
  });
}

export function useCreateStyleKit() {
  return useMutation({
    mutationFn: async (data: { name: string; genre: string; description?: string }) => {
      const res = await apiRequest("POST", "/api/style-kits", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-kits"] });
    },
  });
}

export function useUpdateStyleKit() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<StyleKit> }) => {
      const res = await apiRequest("PATCH", `/api/style-kits/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-kits"] });
    },
  });
}

export function useDeleteStyleKit() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/style-kits/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-kits"] });
    },
  });
}

export function useUploadInstrument() {
  return useMutation({
    mutationFn: async ({ kitId, formData }: { kitId: number; formData: FormData }) => {
      const res = await fetch(`/api/style-kits/${kitId}/instruments`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-kits"] });
    },
  });
}

export function useDeleteInstrument() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/style-kits/instruments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-kits"] });
    },
  });
}

export function useProducerKits() {
  return useQuery<StyleKitWithInstruments[]>({
    queryKey: ["/api/producer/kits"],
    queryFn: async () => {
      const res = await fetch("/api/producer/kits", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    retry: false,
  });
}

export function useCreateProducerKit() {
  return useMutation({
    mutationFn: async (data: { name: string; genre: string; description?: string }) => {
      const res = await apiRequest("POST", "/api/producer/kits", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/producer/kits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/style-kits"] });
    },
  });
}

export function useDeleteProducerKit() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/producer/kits/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/producer/kits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/style-kits"] });
    },
  });
}

export function useUploadProducerInstrument() {
  return useMutation({
    mutationFn: async ({ kitId, formData }: { kitId: number; formData: FormData }) => {
      const res = await fetch(`/api/producer/kits/${kitId}/instruments`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message || `Upload failed: ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/producer/kits"] });
    },
  });
}

export function useDeleteProducerInstrument() {
  return useMutation({
    mutationFn: async ({ kitId, instrumentId }: { kitId: number; instrumentId: number }) => {
      await apiRequest("DELETE", `/api/producer/kits/${kitId}/instruments/${instrumentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/producer/kits"] });
    },
  });
}

export function useAnalyzeKit() {
  return useMutation({
    mutationFn: async (kitId: number) => {
      const res = await apiRequest("POST", `/api/producer/kits/${kitId}/analyze`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/producer/kits"] });
    },
  });
}

export function useTrainKit() {
  return useMutation({
    mutationFn: async (kitId: number) => {
      const res = await apiRequest("POST", `/api/producer/kits/${kitId}/train`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/producer/kits"] });
    },
  });
}

export function useAdminAnalyzeKit() {
  return useMutation({
    mutationFn: async (kitId: number) => {
      const res = await apiRequest("POST", `/api/style-kits/${kitId}/analyze`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-kits"] });
    },
  });
}

export function useAdminTrainKit() {
  return useMutation({
    mutationFn: async (kitId: number) => {
      const res = await apiRequest("POST", `/api/style-kits/${kitId}/train`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-kits"] });
    },
  });
}
