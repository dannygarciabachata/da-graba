import { useQuery } from "@tanstack/react-query";

interface CreditsData {
  credits: number;
  tier: string;
  isUnlimited: boolean;
}

export function useCredits() {
  return useQuery<CreditsData>({
    queryKey: ["/api/user/credits"],
    refetchInterval: 30000,
  });
}
