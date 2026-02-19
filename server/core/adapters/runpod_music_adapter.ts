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
    if (!health.connected) {
      console.log(`[RunPodAdapter] Cannot connect to RunPod API (error: ${health.error || "unknown"})`);
      throw new Error(`RunPod API unreachable: ${health.error || "connection failed"}`);
    }

    if (health.healthy) {
      console.log(`[RunPodAdapter] Health OK (${health.workers} workers ready, ${health.unhealthy} unhealthy, ${health.queued} queued). Submitting song ${songId}`);
    } else {
      console.log(`[RunPodAdapter] No workers ready yet (workers: ${health.workers}, unhealthy: ${health.unhealthy}, queued: ${health.queued}). Job will queue until a worker spins up.`);
    }

    const result = await submitMusicGeneration({
      songId,
      engine: "sao",
      prompt,
      duration,
      lyrics,
      tags,
      genre: style,
      saoModel: "instrumental_finetune",
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
