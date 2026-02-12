import { storage } from "../storage";
import {
  submitExtraction,
  pollMusicGPTJob,
  downloadMusicGPTFile,
  resolveFullAudioUrl,
} from "./musicgpt_engine";

const STEM_TYPES = [
  { type: "vocals", name: "Vocals", icon: "mic" },
  { type: "drums", name: "Drums", icon: "drum" },
  { type: "bass", name: "Bass", icon: "bass" },
  { type: "other", name: "Other / Melody", icon: "music" },
] as const;

export async function processStemSeparation(
  songId: number,
  audioUrl: string,
  userId: string
): Promise<void> {
  console.log(`[Stems] Starting MusicGPT stem separation for song ${songId}`);

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

  const fullAudioUrl = resolveFullAudioUrl(audioUrl);
  console.log(`[Stems] Audio URL for extraction: ${fullAudioUrl}`);

  for (const trackRecord of trackRecords) {
    try {
      console.log(`[Stems] Extracting ${trackRecord.type} stem for song ${songId}...`);
      await storage.updateTrackStatus(trackRecord.id, "processing");

      const submitResult = await submitExtraction(fullAudioUrl, trackRecord.type);
      console.log(`[Stems] ${trackRecord.type} submitted, task_id: ${submitResult.task_id}`);

      const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000);
      console.log(`[Stems] ${trackRecord.type} poll result keys:`, Object.keys(pollResult.raw || {}).join(", "));

      const remoteUrl = pollResult.audioUrl || pollResult.vocalsUrl || pollResult.accompanimentUrl
        || pollResult.raw?.audio_url || pollResult.raw?.vocals_url || pollResult.raw?.accompaniment_url
        || pollResult.raw?.conversion_path;

      if (remoteUrl) {
        const localUrl = await downloadMusicGPTFile(remoteUrl, "stems", `${songId}_${trackRecord.type}`);
        await storage.updateTrackStatus(trackRecord.id, "completed", localUrl);
        console.log(`[Stems] ${trackRecord.type} stem completed: ${localUrl}`);
      } else {
        await storage.updateTrackStatus(trackRecord.id, "completed", undefined);
        console.log(`[Stems] ${trackRecord.type} stem: no audio URL in response`);
      }
    } catch (err: any) {
      console.error(`[Stems] ${trackRecord.type} extraction failed:`, err.message);
      await storage.updateTrackStatus(trackRecord.id, "failed", undefined, err.message);
    }
  }

  console.log(`[Stems] Stem separation completed for song ${songId}`);
}

export { STEM_TYPES };
