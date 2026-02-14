import { storage } from "../storage";
import { 
  submitGenericJob, pollGenericJob, downloadFile, getWebhookUrl, 
  hasProviderForOperation, resolveFullAudioUrl 
} from "../core/generic_api_engine";
import { 
  submitMusicGPTGeneration, pollMusicGPTStatus, downloadMusicGPTFile, 
  getWebhookUrl as getMusicGPTWebhookUrl 
} from "../core/musicgpt_engine";
import { generateCreativeLyrics, enrichPromptForMusicGen } from "../core/antigravity_engine";
import { canUseRunPodMusic, submitRunPodMusicGeneration, submitHeartMuLaGeneration } from "../core/runpod_music_engine";
import { generateImageBuffer } from "../replit_integrations/image/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export const pendingTaskMap = new Map<string, number>();
export const pendingRunPodSongs = new Map<number, NodeJS.Timeout>();

const AUDIO_BASE_DIR = path.join(process.cwd(), "public", "audio");

async function generateSongCoverImage(songId: number, prompt: string, genre: string): Promise<void> {
  try {
    console.log(`[Worker] Generating cover image for song ${songId}...`);
    const imagePrompt = `Album cover art for a ${genre} song about "${prompt}". Vibrant, artistic, music-themed digital illustration with warm tropical colors, musical instruments, abstract shapes. No text or words. Professional album artwork style.`;
    
    const imageBuffer = await generateImageBuffer(imagePrompt, "1024x1024");
    
    const imagesDir = path.join(AUDIO_BASE_DIR, "images");
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    const filename = `${crypto.randomUUID()}_cover.png`;
    const filePath = path.join(imagesDir, filename);
    fs.writeFileSync(filePath, imageBuffer);
    
    const imageUrl = `/audio/images/${filename}`;
    await storage.updateSongImage(songId, imageUrl);
    console.log(`[Worker] Cover image saved for song ${songId}: ${imageUrl}`);
  } catch (err: any) {
    console.log(`[Worker] Cover image generation failed for song ${songId}: ${err.message}`);
  }
}

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

function buildHeartMuLaTags(prompt: string, style: string): string {
  const genreTagMap: Record<string, string[]> = {
    bachata: ["bachata", "latin", "romantic", "guitar", "bongo", "guira", "tropical"],
    bolero: ["bolero", "latin", "romantic", "ballad", "nylon guitar", "soft", "intimate"],
    salsa: ["salsa", "latin", "energetic", "brass", "piano", "congas", "timbales"],
    merengue: ["merengue", "latin", "energetic", "accordion", "tambora", "dance"],
    cumbia: ["cumbia", "latin", "tropical", "accordion", "rhythmic", "dance"],
    reggaeton: ["reggaeton", "latin", "urban", "dembow", "808", "trap"],
    son: ["son cubano", "latin", "tres cubano", "bongo", "claves", "traditional"],
    latin_pop: ["latin pop", "pop", "modern", "piano", "acoustic guitar", "ballad"],
    vallenato: ["vallenato", "latin", "romantic", "accordion", "colombian"],
  };

  const normalizedStyle = style.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z_]/g, "");
  let tags = genreTagMap[normalizedStyle] || genreTagMap[normalizedStyle.replace(/_/g, "")] || genreTagMap["bachata"] || [];

  if (prompt.toLowerCase().includes("romantic") || prompt.toLowerCase().includes("amor")) {
    tags = [...tags, "romantic", "love song"];
  }
  if (prompt.toLowerCase().includes("dance") || prompt.toLowerCase().includes("bailar")) {
    tags = [...tags, "dance", "upbeat"];
  }

  return Array.from(new Set(tags)).join(", ");
}

export async function processMusicGeneration(
  songId: number,
  finalPrompt: string,
  options: {
    style?: string;
    duration?: number;
    lyrics?: string;
    instrumental?: boolean;
  } = {}
): Promise<void> {
  const { duration = 30, style = "Bachata", lyrics, instrumental = false } = options;

  try {
    console.log(`[Worker] Starting music generation for song ${songId}`);
    await storage.updateSongStatus(songId, "processing");

    const safePrompt = finalPrompt.length > 295 ? finalPrompt.substring(0, 292) + "..." : finalPrompt;
    console.log(`[Worker] Prompt: "${safePrompt.substring(0, 120)}"`);

    const enrichedPrompt = await enrichPromptForMusicGen(safePrompt, style);
    console.log(`[Worker] Enriched prompt: "${enrichedPrompt.substring(0, 150)}"`);

    // Priority 1: HeartMuLa — lyrics + vocals + Spanish support (unless instrumental-only)
    if (canUseRunPodMusic() && !instrumental) {
      console.log(`[Worker] Priority 1: HeartMuLa engine for song ${songId}`);

      let songLyrics = lyrics || "";
      if (!songLyrics) {
        try {
          const lyricsStyle = mapStyleToLyricsStyle(style);
          songLyrics = await generateCreativeLyrics(safePrompt, lyricsStyle);
          console.log(`[Worker] Generated ${songLyrics.length} chars of lyrics for HeartMuLa`);
        } catch (err: any) {
          console.log(`[Worker] Lyrics generation failed: ${err.message}, will generate without lyrics`);
        }
      }

      const tags = buildHeartMuLaTags(safePrompt, style);
      console.log(`[Worker] HeartMuLa tags: ${tags}`);

      const heartResult = await submitHeartMuLaGeneration(
        songId, enrichedPrompt, songLyrics, tags, duration
      );

      if (heartResult.success) {
        await storage.updateSongTaskId(songId, heartResult.jobId);
        console.log(`[Worker] HeartMuLa job ${heartResult.jobId} submitted for song ${songId}`);
        startRunPodTimeout(songId, 900000);
        generateSongCoverImage(songId, safePrompt, style).catch(() => {});
        return;
      } else {
        console.log(`[Worker] HeartMuLa failed: ${heartResult.error}, falling back to SAO...`);
      }
    }

    // Priority 2: SAO — instrumental generation on private GPU
    if (canUseRunPodMusic()) {
      console.log(`[Worker] Priority 2: SAO engine (instrumental) for song ${songId}`);

      const result = await submitRunPodMusicGeneration(songId, enrichedPrompt, duration);

      if (result.success) {
        await storage.updateSongTaskId(songId, result.jobId);
        console.log(`[Worker] RunPod SAO job ${result.jobId} submitted for song ${songId}`);
        startRunPodTimeout(songId, 300000);
        generateSongCoverImage(songId, safePrompt, style).catch(() => {});
        return;
      } else {
        console.log(`[Worker] SAO failed: ${result.error}, trying API fallback...`);
      }
    } else {
      console.log(`[Worker] Private GPU not configured, trying API fallback...`);
    }

    // Fallback: Generic API providers (only if private GPU fails)
    const useGeneric = await hasProviderForOperation("music_generation");

    if (useGeneric) {
      console.log(`[Worker] Fallback: Using API provider for music generation`);
      const webhookUrl = getWebhookUrl();

      const { generatedLyrics } = await generateSmartPrompt(finalPrompt, style, lyrics);

      const submitResult = await submitGenericJob("music_generation", {
        prompt: enrichedPrompt,
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
        console.log(`[Worker] Fallback task ${submitResult.taskId} submitted via ${submitResult.providerName}`);
        const needsImage = !submitResult.imageUrl;
        startFallbackPoller(songId, submitResult.taskId, true, submitResult.endpointId, needsImage ? { prompt: safePrompt, genre: style } : undefined);
        return;
      }
    }

    // Last resort: MusicGPT
    console.log(`[Worker] Last resort: MusicGPT fallback`);
    const webhookUrl = getMusicGPTWebhookUrl();
    const { generatedLyrics } = await generateSmartPrompt(finalPrompt, style, lyrics);

    const submitResult = await submitMusicGPTGeneration(safePrompt, style, {
      lyrics: generatedLyrics || undefined,
      duration,
      webhookUrl,
    });

    await storage.updateSongTaskId(songId, submitResult.task_id);
    pendingTaskMap.set(submitResult.task_id, songId);
    console.log(`[Worker] MusicGPT task ${submitResult.task_id} submitted for song ${songId}`);
    startFallbackPoller(songId, submitResult.task_id, false);
  } catch (err: any) {
    console.error(`[Worker] Music generation failed for song ${songId}:`, err);
    await storage.updateSongStatus(songId, "failed", undefined, err.message || "Generation failed");
  }
}

function startRunPodTimeout(songId: number, timeoutMs: number) {
  const timer = setTimeout(async () => {
    try {
      const song = await storage.getSong(songId);
      if (song && song.status === "processing") {
        console.log(`[RunPod Music] Song ${songId} timed out after ${timeoutMs / 1000}s`);
        await storage.updateSongStatus(songId, "failed", undefined, "Generation timed out - RunPod may still be processing");
      }
    } catch (err: any) {
      console.error(`[RunPod Music] Timeout check error for song ${songId}:`, err.message);
    }
    pendingRunPodSongs.delete(songId);
  }, timeoutMs);

  pendingRunPodSongs.set(songId, timer);
}

function startFallbackPoller(songId: number, taskId: string, useGeneric: boolean, endpointId?: number, imageContext?: { prompt: string; genre: string }) {
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
          const pollResult = await pollGenericJob("music_generation", taskId, 5000, 5000, endpointId);
          if (pollResult.status === "COMPLETED" && pollResult.audioUrl) {
            const localUrl = await downloadFile(pollResult.audioUrl, "songs", "song");
            const imageUrl = pollResult.imageUrl || undefined;
            await storage.updateSongStatus(songId, "completed", localUrl);
            if (imageUrl) {
              const localImageUrl = await downloadFile(imageUrl, "images", "cover");
              await storage.updateSongImage(songId, localImageUrl);
            } else if (imageContext) {
              await generateSongCoverImage(songId, imageContext.prompt, imageContext.genre);
            }
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
