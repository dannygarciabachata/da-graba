import type { ApiProvider, ApiEndpoint } from "@shared/schema";
import type { ProviderAdapter, ProviderInput, ProviderResult } from "../provider_pipeline";
import { canUseReplicate, separateStemsWithReplicate } from "../replicate_stems_engine";

const replicateStemAdapter: ProviderAdapter = {
  canUse: (provider: ApiProvider) => {
    return canUseReplicate();
  },

  submit: async (input: ProviderInput, provider: ApiProvider, endpoint: ApiEndpoint): Promise<ProviderResult> => {
    const audioUrl = input.audioUrl;
    const songId = input.songId;

    if (!audioUrl) {
      throw new Error("REPLICATE_MISSING_AUDIO: No audio URL provided for stem separation");
    }

    const result = await separateStemsWithReplicate(audioUrl, songId || 0);

    if (!result.success || Object.keys(result.stems).length === 0) {
      throw new Error(`REPLICATE_FAILED: ${result.error || "No stems returned"}`);
    }

    return {
      success: true,
      stems: result.stems,
      providerName: provider.name,
    };
  },
};

export { replicateStemAdapter };
