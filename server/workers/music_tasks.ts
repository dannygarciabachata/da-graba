import { storage } from "../storage";
import { 
  submitGenericJob, pollGenericJob, downloadFile, getWebhookUrl, 
  hasProviderForOperation, resolveFullAudioUrl 
} from "../core/generic_api_engine";
import { 
  submitMusicGPTGeneration, pollMusicGPTStatus, downloadMusicGPTFile, 
  getWebhookUrl as getMusicGPTWebhookUrl 
} from "../core/musicgpt_engine";
import { generateCreativeLyrics } from "../core/antigravity_engine";

export const pendingTaskMap = new Map<string, number>();

function mapStyleToLyricsStyle(style: string): "romantic" | "dance" | "heartbreak" {
  const danceStyles = ["EDM", "Dance Pop", "Reggaeton", "Afrobeat", "House", "Drum & Bass"];
  const sadStyles = ["Blues", "Soul", "Bolero"];
  if (danceStyles.some(s => style.toLowerCase().includes(s.toLowerCase()))) return "dance";
  if (sadStyles.some(s => style.toLowerCase().includes(s.toLowerCase()))) return "heartbreak";
  return "romantic";
}

async function generateSmartPrompt(
  finalPrompt: string,
  style: string,
  userLyrics?: string
): Promise<{ enhancedPrompt: string; generatedLyrics: string }> {
  console.log(`[Worker] Using OpenAI to craft lyrics for the song...`);

  let generatedLyrics = userLyrics || "";

  if (!userLyrics) {
    try {
      const lyricsStyle = mapStyleToLyricsStyle(style);
      generatedLyrics = await generateCreativeLyrics(finalPrompt, lyricsStyle);
      console.log(`[Worker] OpenAI generated ${generatedLyrics.length} chars of lyrics`);
    } catch (err: any) {
      console.log(`[Worker] OpenAI lyrics generation failed: ${err.message}, using template lyrics`);
      generatedLyrics = "";
    }
  }

  return { enhancedPrompt: finalPrompt, generatedLyrics };
}

export async function processMusicGeneration(
  songId: number,
  finalPrompt: string,
  options: {
    style?: string;
    duration?: number;
    lyrics?: string;
  } = {}
): Promise<void> {
  const { duration = 30, style = "Bachata", lyrics } = options;

  try {
    console.log(`[Worker] Starting music generation for song ${songId}`);
    await storage.updateSongStatus(songId, "processing");

    const { generatedLyrics } = await generateSmartPrompt(finalPrompt, style, lyrics);

    const useGeneric = await hasProviderForOperation("music_generation");

    if (useGeneric) {
      console.log(`[Worker] Using generic API engine for music generation`);
      const webhookUrl = getWebhookUrl();

      const submitResult = await submitGenericJob("music_generation", {
        prompt: finalPrompt,
        music_style: style,
        lyrics: generatedLyrics || undefined,
        output_length: duration,
        make_instrumental: false,
        vocal_only: false,
        webhook_url: webhookUrl,
      });

      if (submitResult.taskId) {
        await storage.updateSongTaskId(songId, submitResult.taskId);
        pendingTaskMap.set(submitResult.taskId, songId);
        console.log(`[Worker] Task ${submitResult.taskId} submitted for song ${songId}`);
        startFallbackPoller(songId, submitResult.taskId, true);
      }
    } else {
      console.log(`[Worker] Using MusicGPT fallback for music generation`);
      const webhookUrl = getMusicGPTWebhookUrl();

      const submitResult = await submitMusicGPTGeneration(finalPrompt, style, {
        lyrics: generatedLyrics || undefined,
        duration,
        webhookUrl,
      });

      await storage.updateSongTaskId(songId, submitResult.task_id);
      pendingTaskMap.set(submitResult.task_id, songId);
      console.log(`[Worker] Task ${submitResult.task_id} submitted for song ${songId}`);
      startFallbackPoller(songId, submitResult.task_id, false);
    }
  } catch (err: any) {
    console.error(`[Worker] Music generation failed for song ${songId}:`, err);
    await storage.updateSongStatus(songId, "failed", undefined, err.message || "Generation failed");
  }
}

function startFallbackPoller(songId: number, taskId: string, useGeneric: boolean) {
  const checkInterval = 30000;
  const maxChecks = 40;
  let checks = 0;

  const timer = setInterval(async () => {
    checks++;
    try {
      const song = await storage.getSong(songId);
      if (!song || song.status === "completed" || song.status === "failed") {
        clearInterval(timer);
        return;
      }

      if (checks >= maxChecks) {
        console.log(`[Fallback] Song ${songId} timed out after ${maxChecks * checkInterval / 1000}s`);
        await storage.updateSongStatus(songId, "failed", undefined, "Generation timed out");
        clearInterval(timer);
        return;
      }

      console.log(`[Fallback] Check ${checks}/${maxChecks} for song ${songId} (task ${taskId})`);

      if (useGeneric) {
        try {
          const pollResult = await pollGenericJob("music_generation", taskId, 5000, 5000);
          if (pollResult.status === "COMPLETED" && pollResult.audioUrl) {
            const localUrl = await downloadFile(pollResult.audioUrl, "songs", "song");
            await storage.updateSongStatus(songId, "completed", localUrl);
            clearInterval(timer);
          }
        } catch {}
      } else {
        const audioUrl = await pollMusicGPTStatus(taskId, 5000, 5000).catch(() => null);
        if (audioUrl) {
          const localUrl = await downloadMusicGPTFile(audioUrl, "songs", "song");
          await storage.updateSongStatus(songId, "completed", localUrl);
          clearInterval(timer);
        }
      }
    } catch (err: any) {
      console.log(`[Fallback] Poll error for song ${songId}: ${err.message?.substring(0, 80)}`);
    }
  }, checkInterval);
}
