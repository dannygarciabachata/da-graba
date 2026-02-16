import type { ApiProvider, ApiEndpoint } from "@shared/schema";
import type { ProviderAdapter, ProviderInput, ProviderResult } from "../provider_pipeline";
import {
  canUseKie, submitKieMusicGeneration, pollKieTask,
  submitKieStemSeparation, pollKieStemTask, boostMusicStyle,
} from "../kie_engine";
import { downloadFile } from "../generic_api_engine";
import { registerStemTask } from "../stems_engine";

const kieMusicAdapter: ProviderAdapter = {
  canUse: (provider: ApiProvider) => {
    return canUseKie();
  },

  submit: async (input: ProviderInput, provider: ApiProvider, endpoint: ApiEndpoint): Promise<ProviderResult> => {
    const style = input.style || "Pop";
    const prompt = input.prompt || "";
    const lyrics = input.lyrics || "";
    const instrumental = input.instrumental === true;
    const title = input.title || `DGB AUDIO - ${style}`;

    const result = await submitKieMusicGeneration(prompt, style, {
      title,
      lyrics: lyrics || undefined,
      instrumental,
      vocalGender: input.vocalGender as "m" | "f" | undefined,
    });

    return {
      success: true,
      taskId: result.taskId,
      providerName: provider.name,
      needsPolling: true,
      pollConfig: {
        taskId: result.taskId,
        adapterKey: "kie_music",
        providerName: provider.name,
        endpointId: endpoint.id,
      },
    };
  },

  poll: async (taskId: string, provider: ApiProvider, endpoint: ApiEndpoint, input: ProviderInput): Promise<ProviderResult> => {
    const result = await pollKieTask(taskId, 300000, 10000);

    const audioUrl = result.audioUrl;
    let localAudioUrl: string | undefined;
    if (audioUrl && audioUrl.startsWith("http")) {
      localAudioUrl = await downloadFile(audioUrl, "songs", "song");
    }

    let localImageUrl: string | undefined;
    if (result.imageUrl) {
      try {
        localImageUrl = await downloadFile(result.imageUrl, "images", "cover");
      } catch {}
    }

    return {
      success: !!localAudioUrl,
      audioUrl: localAudioUrl,
      imageUrl: localImageUrl,
      kieAudioId: result.kieAudioId,
      providerName: provider.name,
    };
  },
};

const kieStemAdapter: ProviderAdapter = {
  canUse: (provider: ApiProvider) => {
    return canUseKie();
  },

  submit: async (input: ProviderInput, provider: ApiProvider, endpoint: ApiEndpoint): Promise<ProviderResult> => {
    const kieTaskId = input.kieTaskId;
    let kieAudioId = input.kieAudioId;

    if (!kieTaskId) {
      throw new Error("KIE_MISSING_TASK: No Kie.ai task ID available for stem separation");
    }

    if (!kieAudioId) {
      try {
        console.log(`[KieAdapter] No kieAudioId, re-polling task ${kieTaskId}`);
        const pollResult = await pollKieTask(kieTaskId, 5000, 5000);
        if (pollResult.kieAudioId) {
          kieAudioId = pollResult.kieAudioId;
        }
      } catch (e: any) {
        console.log(`[KieAdapter] Could not resolve kieAudioId: ${e.message}`);
      }
    }

    if (!kieAudioId) {
      throw new Error("KIE_MISSING_AUDIO: Could not resolve Kie.ai audio ID for stem separation");
    }

    const result = await submitKieStemSeparation(kieTaskId, kieAudioId, "split_stem");

    if (input.songId) {
      registerStemTask(result.taskId, input.songId);
    }

    return {
      success: true,
      taskId: result.taskId,
      providerName: provider.name,
      needsPolling: true,
      pollConfig: {
        taskId: result.taskId,
        adapterKey: "kie_stems",
        providerName: provider.name,
        endpointId: endpoint.id,
      },
    };
  },

  poll: async (taskId: string, provider: ApiProvider, endpoint: ApiEndpoint, input: ProviderInput): Promise<ProviderResult> => {
    const kieStems = await pollKieStemTask(taskId, 300000, 10000);

    const stems: Record<string, string> = {};
    const stemMap: Record<string, string> = {
      vocals: "vocals",
      drums: "drums",
      bass: "bass",
      other: "other",
      instrumental: "instrumental",
    };

    for (const [key, url] of Object.entries(kieStems.stems)) {
      if (url) {
        const normalizedKey = stemMap[key] || key;
        try {
          const localUrl = await downloadFile(url, "stems", `${input.songId || "unknown"}_${normalizedKey}`);
          stems[normalizedKey] = localUrl;
        } catch (dlErr: any) {
          console.error(`[KieAdapter] Failed to download ${key} stem:`, dlErr.message);
        }
      }
    }

    return {
      success: Object.keys(stems).length > 0,
      stems,
      providerName: provider.name,
    };
  },
};

export { kieMusicAdapter, kieStemAdapter };
