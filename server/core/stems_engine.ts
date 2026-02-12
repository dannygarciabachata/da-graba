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

  try {
    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    console.log(`[Stems] Sending to MusicGPT Extraction: ${fullAudioUrl}`);

    const submitResult = await submitExtraction(fullAudioUrl);
    const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000);

    console.log(`[Stems] Extraction completed, raw result:`, JSON.stringify(pollResult.raw).substring(0, 500));

    const vocalsUrl = pollResult.vocalsUrl || pollResult.raw.vocals_url;
    const accompUrl = pollResult.accompanimentUrl || pollResult.raw.accompaniment_url;
    const mainAudioUrl = pollResult.audioUrl;

    for (const trackRecord of trackRecords) {
      try {
        let remoteUrl: string | undefined;

        if (trackRecord.type === "vocals" && vocalsUrl) {
          remoteUrl = vocalsUrl;
        } else if (trackRecord.type === "other" && accompUrl) {
          remoteUrl = accompUrl;
        } else if (trackRecord.type === "vocals" && mainAudioUrl && !vocalsUrl) {
          remoteUrl = mainAudioUrl;
        } else if ((trackRecord.type === "drums" || trackRecord.type === "bass") && accompUrl) {
          remoteUrl = accompUrl;
        }

        if (remoteUrl) {
          const localUrl = await downloadMusicGPTFile(remoteUrl, "stems", trackRecord.type);
          await storage.updateTrackStatus(trackRecord.id, "completed", localUrl);
          console.log(`[Stems] ${trackRecord.type} stem completed: ${localUrl}`);
        } else {
          await storage.updateTrackStatus(trackRecord.id, "completed", undefined);
          console.log(`[Stems] ${trackRecord.type} stem: no separate output available`);
        }
      } catch (dlErr: any) {
        console.error(`[Stems] Failed to process ${trackRecord.type}:`, dlErr.message);
        await storage.updateTrackStatus(trackRecord.id, "failed", undefined, dlErr.message);
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
