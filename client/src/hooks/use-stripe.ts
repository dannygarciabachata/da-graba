import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useStripeProducts() {
  return useQuery<any[]>({
    queryKey: ["/api/stripe/products"],
    retry: false,
  });
}

export function useStripeSubscription() {
  return useQuery<{
    subscription: {
      id: string;
      status: string;
      currentPeriodEnd: string;
      cancelAtPeriodEnd: boolean;
    } | null;
    tier: string;
  }>({
    queryKey: ["/api/stripe/subscription"],
    retry: false,
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: async (data: { priceId: string }) => {
      const res = await apiRequest("POST", "/api/stripe/checkout", data);
      return await res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
  });
}

export function usePortalSession() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/portal");
      return await res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
  });
}
