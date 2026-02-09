import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Sample } from "@shared/schema";

export function useSamples() {
  return useQuery<Sample[]>({
    queryKey: ["/api/samples"],
    refetchInterval: 5000,
  });
}

export function useUploadSample() {
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/samples/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      return res.json() as Promise<Sample>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/samples"] });
    },
  });
}

export function useRecordSample() {
  return useMutation({
    mutationFn: async (data: { audioData: string; name?: string; duration?: number }) => {
      const res = await apiRequest("POST", "/api/samples/record", data);
      return res.json() as Promise<Sample>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/samples"] });
    },
  });
}

export function useTransformSample() {
  return useMutation({
    mutationFn: async (data: { sampleId: number; prompt: string; style?: string; duration?: number }) => {
      const res = await apiRequest("POST", "/api/samples/transform", data);
      return res.json() as Promise<Sample>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/samples"] });
    },
  });
}

export function useDeleteSample() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/samples/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/samples"] });
    },
  });
}

export function useUpdateSample() {
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name?: string; bpm?: number; key?: string; position?: number }) => {
      const res = await apiRequest("PATCH", `/api/samples/${id}`, data);
      return res.json() as Promise<Sample>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/samples"] });
    },
  });
}
