import { storage } from "../storage";
import {
  downloadFile, resolveFullAudioUrl, hasProviderForOperation,
} from "./generic_api_engine";
import {
  submitExtraction, pollMusicGPTJob, downloadMusicGPTFile,
} from "./musicgpt_engine";
import {
  canUseRunPodStems, submitRunPodStemSeparation,
} from "./runpod_stems_engine";
import { executeOperation, pollOperation } from "./provider_pipeline";

const STEM_TYPES = [
  { type: "vocals", name: "Vocals", icon: "mic" },
  { type: "drums", name: "Drums", icon: "drum" },
  { type: "bass", name: "Bass", icon: "bass" },
  { type: "other", name: "Other / Melody", icon: "music", apiKey: "instrumental" },
] as const;

export async function processStemSeparation(
  songId: number,
  audioUrl: string,
  userId: string,
  kieTaskId?: string | null,
  kieAudioId?: string | null
): Promise<void> {
  console.log(`[Stems] Starting stem separation for song ${songId}`);

  const trackRecords = [];
  for (const stem of STEM_TYPES) {
    const track = await storage.createTrack({
      songId,
      userId,
      name: stem.name,
      type: stem.type,
      volume: 100,
      isMuted: false,
      isSolo: false,
    });
    trackRecords.push(track);
  }

  try {
    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    console.log(`[Stems] Audio URL for extraction: ${fullAudioUrl}`);

    for (const track of trackRecords) {
      await storage.updateTrackStatus(track.id, "processing");
    }

    try {
      const submitResult = await executeOperation("stem_separation", {
        audioUrl: fullAudioUrl,
        songId,
        userId,
        kieTaskId: kieTaskId || undefined,
        kieAudioId: kieAudioId || undefined,
      });

      if (submitResult.stems && Object.keys(submitResult.stems).length > 0) {
        applyStemsToTracks(trackRecords, submitResult.stems, songId, submitResult.providerName);
        console.log(`[Stems] Stem separation completed for song ${songId} via ${submitResult.providerName}`);
        return;
      }

      if (submitResult.needsPolling && submitResult.pollConfig) {
        console.log(`[Stems] Polling ${submitResult.providerName} for stem results...`);
        const pollResult = await pollOperation("stem_separation", submitResult.pollConfig.taskId, {
          endpointId: submitResult.pollConfig.endpointId,
          adapterKey: submitResult.pollConfig.adapterKey,
          providerName: submitResult.pollConfig.providerName,
          maxWaitMs: 300000,
          intervalMs: 10000,
          input: { songId, audioUrl: fullAudioUrl },
        });

        if (pollResult.stems && Object.keys(pollResult.stems).length > 0) {
          applyStemsToTracks(trackRecords, pollResult.stems, songId, pollResult.providerName);
          console.log(`[Stems] Stem separation completed for song ${songId} via ${pollResult.providerName}`);
          return;
        }
      }

      console.log(`[Stems] Pipeline returned no stems, trying RunPod/MusicGPT fallback`);
    } catch (pipelineErr: any) {
      console.log(`[Stems] Pipeline failed: ${pipelineErr.message}, trying RunPod/MusicGPT fallback`);
    }

    if (canUseRunPodStems()) {
      console.log(`[Stems] Using cloud GPU (Demucs) for stem separation`);
      try {
        const result = await submitRunPodStemSeparation(songId, fullAudioUrl);
        if (result.success) {
          console.log(`[Stems] Cloud GPU job submitted: ${result.jobId} - waiting for webhook`);
          startStemTimeout(songId, fullAudioUrl, trackRecords, 300000);
          return;
        }
        console.log(`[Stems] Cloud GPU submission failed: ${result.error}, falling back`);
      } catch (gpuErr: any) {
        console.log(`[Stems] Cloud GPU error: ${gpuErr.message}, falling back`);
      }
    }

    const useGeneric = await hasProviderForOperation("stem_separation");
    if (useGeneric) {
      console.log(`[Stems] Using legacy generic API for stem separation`);
      const { submitGenericJob, pollGenericJob } = await import("./generic_api_engine");
      const stemsList = ["vocals", "drums", "bass", "instrumental"];
      const submitResult = await submitGenericJob("stem_separation", {
        audio_url: fullAudioUrl,
        stems: JSON.stringify(stemsList),
      });
      const pollResult = await pollGenericJob("stem_separation", submitResult.taskId!, 600000, 8000, submitResult.endpointId);
      const stems = extractLegacyStems(pollResult);
      applyStemsToTracks(trackRecords, stems, songId, "generic_api");
      return;
    }

    console.log(`[Stems] Using MusicGPT fallback engine for stem separation`);
    const stemsList = ["vocals", "drums", "bass", "instrumental"];
    const submitResult = await submitExtraction(fullAudioUrl, stemsList);
    const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "EXTRACTION");
    const stems = extractLegacyStems(pollResult);
    applyStemsToTracks(trackRecords, stems, songId, "musicgpt");

    console.log(`[Stems] Stem separation completed for song ${songId}`);
  } catch (err: any) {
    console.error(`[Stems] Stem separation failed for song ${songId}:`, err.message);
    for (const track of trackRecords) {
      await storage.updateTrackStatus(track.id, "failed", undefined, err.message);
    }
  }
}

async function applyStemsToTracks(
  trackRecords: any[],
  stems: Record<string, string>,
  songId: number,
  providerName: string
): Promise<void> {
  for (const trackRecord of trackRecords) {
    const stemDef = STEM_TYPES.find(s => s.type === trackRecord.type);
    const apiKey = (stemDef as any)?.apiKey || trackRecord.type;
    const stemUrl = stems[apiKey] || stems[trackRecord.type];

    if (stemUrl) {
      try {
        let localUrl = stemUrl;
        if (stemUrl.startsWith("http")) {
          localUrl = await downloadFile(stemUrl, "stems", `${songId}_${trackRecord.type}`);
        }
        await storage.updateTrackStatus(trackRecord.id, "completed", localUrl);
        console.log(`[Stems] ${trackRecord.type} stem completed via ${providerName}: ${localUrl}`);
      } catch (dlErr: any) {
        console.error(`[Stems] Failed to download ${trackRecord.type}:`, dlErr.message);
        await storage.updateTrackStatus(trackRecord.id, "failed", undefined, dlErr.message);
      }
    } else {
      await storage.updateTrackStatus(trackRecord.id, "completed", undefined);
      console.log(`[Stems] ${trackRecord.type} stem: no separate URL from ${providerName}`);
    }
  }
}

function extractLegacyStems(rawResult: any): Record<string, string> {
  let stemUrls: Record<string, string> = {};

  const replicateOutput = rawResult.raw?.output;
  if (replicateOutput && typeof replicateOutput === "object" && !Array.isArray(replicateOutput)) {
    if (replicateOutput.vocals) stemUrls.vocals = String(replicateOutput.vocals);
    if (replicateOutput.drums) stemUrls.drums = String(replicateOutput.drums);
    if (replicateOutput.bass) stemUrls.bass = String(replicateOutput.bass);
    if (replicateOutput.other) stemUrls.instrumental = String(replicateOutput.other);
  }

  if (Object.keys(stemUrls).length === 0) {
    const audioUrlField = rawResult.raw?.audio_url || rawResult.audioUrl;
    if (audioUrlField && typeof audioUrlField === "string") {
      try {
        stemUrls = JSON.parse(audioUrlField);
      } catch {}
    }
  }

  const rawAny = rawResult.raw as any;
  if (rawAny?.audio_url_wav && typeof rawAny.audio_url_wav === "string") {
    try {
      const wavUrls = JSON.parse(rawAny.audio_url_wav);
      for (const [key, url] of Object.entries(wavUrls)) {
        if (!stemUrls[key]) stemUrls[key] = url as string;
      }
    } catch {}
  }

  if (rawResult.vocalsUrl) stemUrls.vocals = stemUrls.vocals || rawResult.vocalsUrl;
  if (rawResult.accompanimentUrl) stemUrls.instrumental = stemUrls.instrumental || rawResult.accompanimentUrl;

  return stemUrls;
}

const pendingStemTimeouts = new Map<number, NodeJS.Timeout>();
const stemTaskToSongMap = new Map<string, number>();

export function registerStemTask(stemTaskId: string, songId: number): void {
  stemTaskToSongMap.set(stemTaskId, songId);
  console.log(`[Stems] Registered stem task ${stemTaskId} → song ${songId}`);
}

export function getSongIdForStemTask(stemTaskId: string): number | undefined {
  return stemTaskToSongMap.get(stemTaskId);
}

export function clearStemTask(stemTaskId: string): void {
  stemTaskToSongMap.delete(stemTaskId);
}

function startStemTimeout(songId: number, fullAudioUrl: string, trackRecords: any[], timeoutMs: number) {
  if (pendingStemTimeouts.has(songId)) {
    clearTimeout(pendingStemTimeouts.get(songId)!);
  }

  const timer = setTimeout(async () => {
    try {
      const tracks = await storage.getTracksBySongId(songId);
      const anyStillPending = tracks.some(t => t.status === "processing" || t.status === "pending");
      if (!anyStillPending) {
        pendingStemTimeouts.delete(songId);
        return;
      }

      console.log(`[Stems] Cloud GPU timed out for song ${songId} after ${timeoutMs / 1000}s, falling back via pipeline`);

      try {
        const submitResult = await executeOperation("stem_separation", {
          audioUrl: fullAudioUrl,
          songId,
        });

        if (submitResult.stems && Object.keys(submitResult.stems).length > 0) {
          for (const track of tracks) {
            if (track.status !== "processing" && track.status !== "pending") continue;
            const stemDef = STEM_TYPES.find(s => s.type === track.type);
            const apiKey = (stemDef as any)?.apiKey || track.type;
            const localUrl = submitResult.stems[apiKey] || submitResult.stems[track.type];
            if (localUrl) {
              await storage.updateTrackStatus(track.id, "completed", localUrl);
            } else {
              await storage.updateTrackStatus(track.id, "failed", undefined, "No stem data available from fallback");
            }
          }
          console.log(`[Stems] Timeout fallback completed for song ${songId}`);
          pendingStemTimeouts.delete(songId);
          return;
        }
      } catch (fallbackErr: any) {
        console.error(`[Stems] Timeout pipeline fallback failed: ${fallbackErr.message}`);
      }

      for (const track of tracks) {
        if (track.status === "processing" || track.status === "pending") {
          await storage.updateTrackStatus(track.id, "failed", undefined, "Cloud GPU timed out and no fallback available");
        }
      }
    } catch (err: any) {
      console.error(`[Stems] Timeout handler error for song ${songId}:`, err.message);
    }
    pendingStemTimeouts.delete(songId);
  }, timeoutMs);

  pendingStemTimeouts.set(songId, timer);
}

export function cancelStemTimeout(songId: number) {
  const timer = pendingStemTimeouts.get(songId);
  if (timer) {
    clearTimeout(timer);
    pendingStemTimeouts.delete(songId);
  }
}

export { STEM_TYPES };
