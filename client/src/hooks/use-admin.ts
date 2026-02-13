import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ApiProvider, ApiEndpoint, PlatformSetting, SupportTicket, SupportMessage } from "@shared/schema";

export function useAdminCheck() {
  return useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    retry: false,
  });
}

export function useAdminMeta() {
  return useQuery<{
    operationTypes: string[];
    providerCategories: string[];
    authTypes: string[];
  }>({
    queryKey: ["/api/admin/meta"],
    retry: false,
  });
}

export function useProviders() {
  return useQuery<ApiProvider[]>({
    queryKey: ["/api/admin/providers"],
    retry: false,
  });
}

export function useProvider(id: number) {
  return useQuery<ApiProvider>({
    queryKey: ["/api/admin/providers", id],
    enabled: id > 0,
    retry: false,
  });
}

export function useCreateProvider() {
  return useMutation({
    mutationFn: async (data: Partial<ApiProvider>) => {
      const res = await apiRequest("POST", "/api/admin/providers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
    },
  });
}

export function useUpdateProvider() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ApiProvider> }) => {
      const res = await apiRequest("PATCH", `/api/admin/providers/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
    },
  });
}

export function useDeleteProvider() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/providers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/endpoints"] });
    },
  });
}

export function useEndpoints(providerId?: number) {
  const url = providerId ? `/api/admin/endpoints?providerId=${providerId}` : "/api/admin/endpoints";
  return useQuery<ApiEndpoint[]>({
    queryKey: ["/api/admin/endpoints", providerId ?? "all"],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    retry: false,
  });
}

export function useCreateEndpoint() {
  return useMutation({
    mutationFn: async (data: Partial<ApiEndpoint>) => {
      const res = await apiRequest("POST", "/api/admin/endpoints", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/endpoints"] });
    },
  });
}

export function useUpdateEndpoint() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ApiEndpoint> }) => {
      const res = await apiRequest("PATCH", `/api/admin/endpoints/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/endpoints"] });
    },
  });
}

export function useDeleteEndpoint() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/endpoints/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/endpoints"] });
    },
  });
}

export function useTestEndpoint() {
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/endpoints/${id}/test`);
      return res.json();
    },
  });
}

export function useAdminStats() {
  return useQuery<{
    totalUsers: number;
    totalSongs: number;
    totalSamples: number;
    totalLyrics: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
  }>({
    queryKey: ["/api/admin/stats"],
    retry: false,
  });
}

export function useAdminUsers() {
  return useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
  });
}

export function useAdminSubscriptions() {
  return useQuery<any[]>({
    queryKey: ["/api/admin/subscriptions"],
    retry: false,
  });
}

export function useAdminProducts() {
  return useQuery<any[]>({
    queryKey: ["/api/admin/products"],
    retry: false,
  });
}

export function usePlatformSettings(category?: string) {
  const url = category ? `/api/admin/settings?category=${category}` : "/api/admin/settings";
  return useQuery<PlatformSetting[]>({
    queryKey: ["/api/admin/settings", category ?? "all"],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    retry: false,
  });
}

export function useUpsertSetting() {
  return useMutation({
    mutationFn: async (data: { key: string; value: string; category: string; description?: string }) => {
      const res = await apiRequest("PUT", "/api/admin/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
    },
  });
}

export function useBulkUpsertSettings() {
  return useMutation({
    mutationFn: async (settings: { key: string; value: string; category: string; description?: string }[]) => {
      const res = await apiRequest("PUT", "/api/admin/settings/bulk", { settings });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
    },
  });
}

export function useDeleteSetting() {
  return useMutation({
    mutationFn: async (key: string) => {
      await apiRequest("DELETE", `/api/admin/settings/${encodeURIComponent(key)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
    },
  });
}

export function useAnalytics() {
  return useQuery<{
    userGrowth: { date: string; count: number }[];
    songsByGenre: { genre: string; count: number }[];
    songsByStatus: { status: string; count: number }[];
    recentActivity: { date: string; songs: number; samples: number; lyrics: number }[];
    ticketStats: { open: number; inProgress: number; resolved: number; closed: number };
  }>({
    queryKey: ["/api/admin/analytics"],
    retry: false,
  });
}

export function useAdminTickets(status?: string) {
  const url = status ? `/api/admin/tickets?status=${status}` : "/api/admin/tickets";
  return useQuery<SupportTicket[]>({
    queryKey: ["/api/admin/tickets", status ?? "all"],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    retry: false,
  });
}

export function useAdminTicket(id: number | null) {
  return useQuery<SupportTicket & { messages: SupportMessage[] }>({
    queryKey: ["/api/admin/tickets", id],
    enabled: id !== null && id > 0,
    retry: false,
  });
}

export function useUpdateTicket() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SupportTicket> }) => {
      const res = await apiRequest("PATCH", `/api/admin/tickets/${id}`, data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets", variables.id] });
    },
  });
}

export function useReplyToTicket() {
  return useMutation({
    mutationFn: async ({ ticketId, content }: { ticketId: number; content: string }) => {
      const res = await apiRequest("POST", `/api/admin/tickets/${ticketId}/reply`, { content });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets", variables.ticketId] });
    },
  });
}
