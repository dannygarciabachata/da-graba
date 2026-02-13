import { storage } from "../storage";
import {
  submitGenericJob, pollGenericJob, downloadFile,
  resolveFullAudioUrl, hasProviderForOperation,
} from "./generic_api_engine";
import {
  submitExtraction, pollMusicGPTJob, downloadMusicGPTFile,
} from "./musicgpt_engine";

const STEM_TYPES = [
  { type: "vocals", name: "Vocals", icon: "mic" },
  { type: "drums", name: "Drums", icon: "drum" },
  { type: "bass", name: "Bass", icon: "bass" },
  { type: "other", name: "Other / Melody", icon: "music", apiKey: "instrumental" },
] as const;

export async function processStemSeparation(
  songId: number,
  audioUrl: string,
  userId: string
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

    const stemsList = ["vocals", "drums", "bass", "instrumental"];
    const useGeneric = await hasProviderForOperation("stem_separation");

    for (const track of trackRecords) {
      await storage.updateTrackStatus(track.id, "processing");
    }

    let rawResult: any;

    if (useGeneric) {
      console.log(`[Stems] Using generic API engine for stem separation`);
      const submitResult = await submitGenericJob("stem_separation", {
        audio_url: fullAudioUrl,
        stems: JSON.stringify(stemsList),
      });
      const pollResult = await pollGenericJob("stem_separation", submitResult.taskId!, 600000, 8000);
      rawResult = pollResult;
    } else {
      console.log(`[Stems] Using fallback engine for stem separation`);
      const submitResult = await submitExtraction(fullAudioUrl, stemsList);
      console.log(`[Stems] Extraction submitted, task_id: ${submitResult.task_id}`);
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "EXTRACTION");
      rawResult = pollResult;
    }

    console.log(`[Stems] Extraction completed, raw result keys:`, Object.keys(rawResult.raw || {}).join(", "));

    let stemUrls: Record<string, string> = {};

    const audioUrlField = rawResult.raw?.audio_url || rawResult.audioUrl;
    if (audioUrlField && typeof audioUrlField === "string") {
      try {
        stemUrls = JSON.parse(audioUrlField);
        console.log(`[Stems] Parsed stem URLs:`, Object.keys(stemUrls).join(", "));
      } catch {
        console.log(`[Stems] audio_url is not JSON, treating as single URL`);
        stemUrls = { vocals: audioUrlField };
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

    console.log(`[Stems] Available stems: ${Object.keys(stemUrls).join(", ")}`);

    for (const trackRecord of trackRecords) {
      const stemDef = STEM_TYPES.find(s => s.type === trackRecord.type);
      const apiKey = (stemDef as any)?.apiKey || trackRecord.type;
      const remoteUrl = stemUrls[apiKey] || stemUrls[trackRecord.type];

      if (remoteUrl) {
        try {
          const localUrl = await downloadFile(remoteUrl, "stems", `${songId}_${trackRecord.type}`);
          await storage.updateTrackStatus(trackRecord.id, "completed", localUrl);
          console.log(`[Stems] ${trackRecord.type} stem completed: ${localUrl}`);
        } catch (dlErr: any) {
          console.error(`[Stems] Failed to download ${trackRecord.type}:`, dlErr.message);
          await storage.updateTrackStatus(trackRecord.id, "failed", undefined, dlErr.message);
        }
      } else {
        await storage.updateTrackStatus(trackRecord.id, "completed", undefined);
        console.log(`[Stems] ${trackRecord.type} stem: no separate URL available`);
      }
    }

    console.log(`[Stems] Stem separation completed for song ${songId}`);
  } catch (err: any) {
    console.error(`[Stems] Stem separation failed for song ${songId}:`, err.message);
    for (const track of trackRecords) {
      await storage.updateTrackStatus(track.id, "failed", undefined, err.message);
    }
  }
}

export { STEM_TYPES };
