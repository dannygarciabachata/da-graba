import { storage } from "../storage";
import { submitMusicGPTGeneration, getWebhookUrl, pollMusicGPTStatus, downloadMusicGPTFile } from "../core/musicgpt_engine";
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
    console.log(`[Worker] Prompt (${finalPrompt.length} chars): ${finalPrompt.substring(0, 150)}`);
    console.log(`[Worker] Style: ${style}, Duration: ${duration}s`);

    await storage.updateSongStatus(songId, "processing");

    const { generatedLyrics } = await generateSmartPrompt(finalPrompt, style, lyrics);

    if (generatedLyrics) {
      console.log(`[Worker] Lyrics ready (${generatedLyrics.length} chars)`);
    }

    const webhookUrl = getWebhookUrl();
    console.log(`[Worker] Submitting to MusicGPT with webhook: ${webhookUrl}`);

    const submitResult = await submitMusicGPTGeneration(finalPrompt, style, {
      lyrics: generatedLyrics || undefined,
      duration,
      webhookUrl,
    });

    await storage.updateSongTaskId(songId, submitResult.task_id);
    pendingTaskMap.set(submitResult.task_id, songId);
    console.log(`[Worker] Task ${submitResult.task_id} submitted for song ${songId}, waiting for webhook...`);

    startFallbackPoller(songId, submitResult.task_id);

  } catch (err: any) {
    console.error(`[Worker] Music generation failed for song ${songId}:`, err);
    const errorMessage = err.message || "Generation failed";
    await storage.updateSongStatus(songId, "failed", undefined, errorMessage);
  }
}

function startFallbackPoller(songId: number, taskId: string) {
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
      const audioUrl = await pollMusicGPTStatus(taskId, 5000, 5000).catch(() => null);
      if (audioUrl) {
        console.log(`[Fallback] Got audio via polling for song ${songId}`);
        const localUrl = await downloadMusicGPTFile(audioUrl, "songs", "song");
        await storage.updateSongStatus(songId, "completed", localUrl);
        clearInterval(timer);
      }
    } catch (err: any) {
      console.log(`[Fallback] Poll error for song ${songId}: ${err.message?.substring(0, 80)}`);
    }
  }, checkInterval);
}
