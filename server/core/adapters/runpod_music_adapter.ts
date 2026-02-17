import type { ApiProvider, ApiEndpoint } from "@shared/schema";
import type { ProviderAdapter, ProviderInput, ProviderResult } from "../provider_pipeline";
import { isServerlessConfigured, submitMusicGeneration } from "../runpod_serverless";
import { buildHeartMuLaTags } from "../../workers/music_tasks";

const runpodMusicAdapter: ProviderAdapter = {
  canUse: (provider: ApiProvider) => {
    return isServerlessConfigured("music");
  },

  submit: async (input: ProviderInput, provider: ApiProvider, endpoint: ApiEndpoint): Promise<ProviderResult> => {
    const prompt = input.prompt || "";
    const style = input.style || "Bachata";
    const duration = input.duration || 180;
    const lyrics = input.lyrics || undefined;
    const songId = input.songId || 0;
    const tags = buildHeartMuLaTags(prompt, style);

    console.log(`[RunPodAdapter] Submitting music generation for song ${songId} (engine: sao, duration: ${duration}s)`);

    const result = await submitMusicGeneration({
      songId,
      engine: "sao",
      prompt,
      duration,
      lyrics,
      tags,
      genre: style,
    });

    console.log(`[RunPodAdapter] Job submitted: ${result.jobId} (status: ${result.status})`);

    return {
      success: true,
      taskId: result.jobId,
      providerName: provider.name,
      needsPolling: false,
    };
  },
};

export { runpodMusicAdapter };
