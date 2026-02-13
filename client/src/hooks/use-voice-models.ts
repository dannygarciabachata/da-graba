import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { VoiceModel, VoiceSample, StyleReference } from "@shared/schema";

export type VoiceModelWithSamples = VoiceModel & { samples?: VoiceSample[] };

export function useVoiceModels() {
  return useQuery<VoiceModel[]>({
    queryKey: ["/api/voice-models"],
    queryFn: async () => {
      const res = await fetch("/api/voice-models", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch voice models");
      return res.json();
    },
    retry: false,
  });
}

export function useVoiceModel(id: number) {
  return useQuery<VoiceModelWithSamples>({
    queryKey: ["/api/voice-models", id],
    queryFn: async () => {
      const res = await fetch(`/api/voice-models/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch voice model");
      return res.json();
    },
    enabled: id > 0,
    retry: false,
  });
}

export function useCreateVoiceModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; type?: string; provider?: string; gender?: string; language?: string; tags?: string; externalVoiceId?: string }) => {
      const res = await fetch("/api/voice-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to create voice model");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-models"] });
    },
  });
}

export function useUpdateVoiceModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<VoiceModel>) => {
      const res = await fetch(`/api/voice-models/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update voice model");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-models"] });
    },
  });
}

export function useDeleteVoiceModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/voice-models/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete voice model");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-models"] });
    },
  });
}

export function useUploadVoiceSample() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ voiceModelId, file, name }: { voiceModelId: number; file: File; name?: string }) => {
      const formData = new FormData();
      formData.append("audio", file);
      if (name) formData.append("name", name);

      const res = await fetch(`/api/voice-models/${voiceModelId}/samples`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload voice sample");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-models", variables.voiceModelId] });
      queryClient.invalidateQueries({ queryKey: ["/api/voice-models"] });
    },
  });
}

export function useTrainVoiceModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/voice-models/${id}/train`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to start training");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-models"] });
    },
  });
}

export function useStyleReferences() {
  return useQuery<StyleReference[]>({
    queryKey: ["/api/style-references"],
    queryFn: async () => {
      const res = await fetch("/api/style-references", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch style references");
      return res.json();
    },
    retry: false,
  });
}

export function useUploadStyleReference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, name }: { file: File; name?: string }) => {
      const formData = new FormData();
      formData.append("audio", file);
      if (name) formData.append("name", name);

      const res = await fetch("/api/style-references", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload style reference");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-references"] });
    },
  });
}

export function useDeleteStyleReference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/style-references/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete style reference");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-references"] });
    },
  });
}
