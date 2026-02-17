import type { ApiProvider, ApiEndpoint } from "@shared/schema";
import type { ProviderAdapter, ProviderInput, ProviderResult } from "../provider_pipeline";
import { isServerlessConfigured, submitMusicGeneration, checkHealth } from "../runpod_serverless";
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

    const health = await checkHealth("music");
    if (!health.connected || health.workers === 0) {
      console.log(`[RunPodAdapter] Skipping - workers unhealthy/unavailable (connected: ${health.connected}, workers: ${health.workers}, error: ${health.error || "none"})`);
      throw new Error(`RunPod workers unavailable: ${health.error || "0 workers online"}`);
    }

    console.log(`[RunPodAdapter] Health OK (${health.workers} workers, ${health.queued} queued). Submitting song ${songId} (engine: sao, duration: ${duration}s)`);

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
