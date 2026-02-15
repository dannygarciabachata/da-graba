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
import { canUseKie, submitKieMusicGeneration, pollKieTask } from "../core/kie_engine";
import { ensureGpuReady } from "../core/runpod_client";
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
    bachata: ["bachata", "latin", "romantic", "nylon guitar", "bongo", "guira", "bass guitar", "Dominican rhythm", "130 BPM", "4/4 time", "syncopated", "studio quality"],
    bolero: ["bolero", "latin", "romantic ballad", "nylon guitar arpeggios", "soft percussion", "intimate", "slow tempo", "80 BPM", "4/4 time", "emotional", "studio quality"],
    salsa: ["salsa", "latin", "energetic", "brass section", "piano montuno", "congas", "timbales", "clave rhythm", "180 BPM", "dance", "tight arrangement", "studio quality"],
    merengue: ["merengue", "latin", "energetic", "accordion", "tambora", "guira", "fast tempo", "160 BPM", "2/4 time", "Caribbean dance", "studio quality"],
    cumbia: ["cumbia", "latin", "tropical", "accordion", "rhythmic percussion", "dance groove", "100 BPM", "4/4 time", "Colombian", "studio quality"],
    reggaeton: ["reggaeton", "latin urban", "dembow beat", "deep 808 bass", "hi-hats", "trap influence", "90 BPM", "4/4 time", "club", "polished production"],
    son: ["son cubano", "latin", "tres cubano", "bongo", "claves", "maracas", "traditional Cuban", "moderate tempo", "studio quality"],
    latin_pop: ["latin pop", "pop", "modern production", "acoustic guitar", "piano", "melodic hooks", "radio-ready", "120 BPM", "catchy", "studio quality"],
    vallenato: ["vallenato", "latin", "romantic", "accordion melody", "caja vallenata", "guacharaca", "Colombian", "moderate tempo", "studio quality"],
    r_b: ["r&b", "smooth groove", "electric piano", "soft drums", "soulful", "intimate", "85 BPM", "4/4 time", "warm production"],
    hip_hop: ["hip hop", "boom bap", "808 bass", "crisp snares", "sampled melody", "90 BPM", "4/4 time", "urban"],
    pop: ["pop", "catchy melody", "modern drums", "acoustic guitar", "bright production", "120 BPM", "radio-ready", "upbeat"],
    edm: ["edm", "electronic", "synthesizer", "driving beat", "build-up", "drop", "128 BPM", "4/4 time", "club production"],
  };

  const normalizedStyle = style.toLowerCase().replace(/[&]/g, "_").replace(/\s+/g, "_").replace(/[^a-z_]/g, "");
  let tags = genreTagMap[normalizedStyle] || genreTagMap[normalizedStyle.replace(/_/g, "")] || genreTagMap["bachata"] || [];

  const lowerPrompt = prompt.toLowerCase();
  if (lowerPrompt.includes("romantic") || lowerPrompt.includes("amor") || lowerPrompt.includes("love")) {
    tags = [...tags, "romantic", "love song", "passionate"];
  }
  if (lowerPrompt.includes("dance") || lowerPrompt.includes("bailar") || lowerPrompt.includes("fiesta")) {
    tags = [...tags, "dance", "upbeat", "energetic"];
  }
  if (lowerPrompt.includes("sad") || lowerPrompt.includes("triste") || lowerPrompt.includes("heartbreak")) {
    tags = [...tags, "melancholic", "emotional", "minor key"];
  }
  if (lowerPrompt.includes("fast") || lowerPrompt.includes("rapido") || lowerPrompt.includes("upbeat")) {
    tags = [...tags, "fast tempo", "high energy"];
  }
  if (lowerPrompt.includes("slow") || lowerPrompt.includes("lento") || lowerPrompt.includes("chill")) {
    tags = [...tags, "slow tempo", "relaxed", "laid-back"];
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
  const { duration = 180, style = "Bachata", lyrics, instrumental = false } = options;

  try {
    console.log(`[Worker] Starting music generation for song ${songId}`);
    await storage.updateSongStatus(songId, "processing");

    const safePrompt = finalPrompt.length > 295 ? finalPrompt.substring(0, 292) + "..." : finalPrompt;
    console.log(`[Worker] Prompt: "${safePrompt.substring(0, 120)}"`);

    const enrichedPrompt = await enrichPromptForMusicGen(safePrompt, style);
    console.log(`[Worker] Enriched prompt: "${enrichedPrompt.substring(0, 150)}"`);

    // === PRIMARY ENGINE: Kie.ai (Suno V5) — $0.06/song ===
    if (canUseKie()) {
      console.log(`[Worker] Using Kie.ai (Suno V5) for song ${songId}`);
      try {
        let songLyrics = lyrics || "";
        if (!songLyrics && !instrumental) {
          try {
            const lyricsStyle = mapStyleToLyricsStyle(style);
            songLyrics = await generateCreativeLyrics(safePrompt, lyricsStyle, style);
            console.log(`[Worker] Generated ${songLyrics.length} chars of lyrics for Kie.ai`);
          } catch (err: any) {
            console.log(`[Worker] Lyrics generation failed: ${err.message}`);
          }
        }

        const kieResult = await submitKieMusicGeneration(enrichedPrompt, style, {
          title: `DGB AUDIO - ${style}`,
          lyrics: songLyrics || undefined,
          instrumental,
        });

        await storage.updateSongTaskId(songId, kieResult.taskId);
        console.log(`[Worker] Kie.ai task ${kieResult.taskId} submitted for song ${songId}, polling...`);

        startKiePoller(songId, kieResult.taskId, { prompt: safePrompt, genre: style });
        generateSongCoverImage(songId, safePrompt, style).catch(() => {});
        return;
      } catch (kieErr: any) {
        const msg = kieErr.message || "";
        console.log(`[Worker] Kie.ai failed: ${msg}`);
        if (msg.includes("CREDITS_EXHAUSTED") || msg.includes("QUOTA_EXCEEDED")) {
          await storage.updateSongStatus(songId, "failed", undefined, "Service credits exhausted. Contact admin to restore service.");
          return;
        }
      }
    }

    // === FALLBACK: HeartMuLa on private GPU (disabled — enable when GPU is available) ===
    // HeartMuLa and SAO are currently disabled to avoid conflicts.
    // To re-enable, uncomment the blocks below.
    /*
    if (canUseRunPodMusic()) {
      try {
        const gpuCheckPromise = ensureGpuReady();
        const gpuTimeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 30000));
        const gpuReady = await Promise.race([gpuCheckPromise, gpuTimeout]);
        if (gpuReady) {
          console.log(`[Worker] GPU confirmed ready for song ${songId}`);
        }
      } catch (err: any) {
        console.log(`[Worker] GPU readiness check failed: ${err.message}`);
      }
    }

    if (canUseRunPodMusic() && !instrumental) {
      try {
        console.log(`[Worker] Fallback: HeartMuLa engine for song ${songId}`);
        let songLyrics = lyrics || "";
        if (!songLyrics) {
          try {
            const lyricsStyle = mapStyleToLyricsStyle(style);
            songLyrics = await generateCreativeLyrics(safePrompt, lyricsStyle, style);
          } catch (err: any) {
            console.log(`[Worker] Lyrics generation failed: ${err.message}`);
          }
        }
        const tags = buildHeartMuLaTags(safePrompt, style);
        const heartResult = await submitHeartMuLaGeneration(songId, enrichedPrompt, songLyrics, tags, duration);
        if (heartResult.success) {
          await storage.updateSongTaskId(songId, heartResult.jobId);
          startRunPodTimeout(songId, 300000);
          generateSongCoverImage(songId, safePrompt, style).catch(() => {});
          return;
        }
        console.log(`[Worker] HeartMuLa failed: ${heartResult.error}`);
      } catch (heartErr: any) {
        console.log(`[Worker] HeartMuLa error: ${heartErr.message}, continuing...`);
      }
    }

    if (canUseRunPodMusic()) {
      try {
        console.log(`[Worker] Fallback: SAO engine for song ${songId}`);
        const result = await submitRunPodMusicGeneration(songId, enrichedPrompt, duration);
        if (result.success) {
          await storage.updateSongTaskId(songId, result.jobId);
          startRunPodTimeout(songId, 300000);
          generateSongCoverImage(songId, safePrompt, style).catch(() => {});
          return;
        }
        console.log(`[Worker] SAO failed: ${result.error}`);
      } catch (saoErr: any) {
        console.log(`[Worker] SAO error: ${saoErr.message}, continuing...`);
      }
    }
    */

    // === LAST RESORT: Generic API / MusicGPT (disabled) ===
    /*
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
        startFallbackPoller(songId, submitResult.taskId, true, submitResult.endpointId, { prompt: safePrompt, genre: style });
        return;
      }
    }

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
    startFallbackPoller(songId, submitResult.task_id, false);
    */

    throw new Error("No music generation engine available. Kie.ai API key required.");
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[Worker] Music generation failed for song ${songId}:`, msg);
    let userMsg = "Music generation failed. Please try again.";
    if (msg.includes("QUOTA_EXCEEDED")) userMsg = "AI service credits exhausted. Please contact admin to restore service.";
    else if (msg.includes("AUTH_ERROR")) userMsg = "AI service authentication failed. Please contact admin.";
    else if (msg.includes("No API key")) userMsg = "AI service not configured. Please contact admin.";
    await storage.updateSongStatus(songId, "failed", undefined, userMsg);
  }
}

export function startRunPodTimeout(songId: number, timeoutMs: number) {
  const timer = setTimeout(async () => {
    try {
      const song = await storage.getSong(songId);
      if (song && song.status === "processing") {
        console.log(`[RunPod Music] Song ${songId} timed out after ${timeoutMs / 1000}s, attempting API fallback...`);

        const useGeneric = await hasProviderForOperation("music_generation");
        if (useGeneric) {
          try {
            const prompt = song.prompt || "";
            const webhookUrl = getWebhookUrl();
            const submitResult = await submitGenericJob("music_generation", {
              prompt,
              music_style: song.genre || "Bachata",
              output_length: 180,
              make_instrumental: false,
              webhook_url: webhookUrl,
            });
            if (submitResult.taskId) {
              await storage.updateSongTaskId(songId, submitResult.taskId);
              pendingTaskMap.set(submitResult.taskId, songId);
              await storage.updateSongStatus(songId, "processing", undefined, "GPU timed out, trying backup engine...");
              console.log(`[RunPod Music] Fallback API submitted for song ${songId}: ${submitResult.taskId}`);
              startFallbackPoller(songId, submitResult.taskId, true, submitResult.endpointId, { prompt, genre: song.genre || "Bachata" });
              pendingRunPodSongs.delete(songId);
              return;
            }
          } catch (fallbackErr: any) {
            console.log(`[RunPod Music] API fallback failed: ${fallbackErr.message}`);
          }
        }

        await storage.updateSongStatus(songId, "failed", undefined, "La generación tardó demasiado. Intenta de nuevo.");
      }
    } catch (err: any) {
      console.error(`[RunPod Music] Timeout check error for song ${songId}:`, err.message);
    }
    pendingRunPodSongs.delete(songId);
  }, timeoutMs);

  pendingRunPodSongs.set(songId, timer);
}

function startKiePoller(songId: number, taskId: string, imageContext?: { prompt: string; genre: string }) {
  const checkInterval = 15000;
  const maxChecks = 30;
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
        console.log(`[Kie.ai] Song ${songId} timed out after ${maxChecks * checkInterval / 1000}s`);
        await storage.updateSongStatus(songId, "failed", undefined, "Generation timed out. Please try again.");
        clearInterval(timer);
        return;
      }

      console.log(`[Kie.ai] Poll ${checks}/${maxChecks} for song ${songId} (task ${taskId})`);

      try {
        const result = await pollKieTask(taskId, 14000, 14000);
        if (result.audioUrl) {
          const localUrl = await downloadFile(result.audioUrl, "songs", "song");
          await storage.updateSongStatus(songId, "completed", localUrl);
          if (result.kieAudioId) {
            try {
              await storage.updateSongKieAudioId(songId, result.kieAudioId);
              console.log(`[Kie.ai] Saved kieAudioId ${result.kieAudioId} for song ${songId}`);
            } catch (err: any) {
              console.log(`[Kie.ai] Failed to save kieAudioId: ${err.message}`);
            }
          }
          if (result.imageUrl) {
            try {
              const localImageUrl = await downloadFile(result.imageUrl, "images", "cover");
              await storage.updateSongImage(songId, localImageUrl);
            } catch {}
          } else if (imageContext) {
            await generateSongCoverImage(songId, imageContext.prompt, imageContext.genre);
          }
          console.log(`[Kie.ai] Song ${songId} completed successfully`);
          clearInterval(timer);
        }
      } catch (pollErr: any) {
        if (pollErr.message?.includes("failed") || pollErr.message?.includes("error")) {
          console.log(`[Kie.ai] Song ${songId} generation failed: ${pollErr.message}`);
          await storage.updateSongStatus(songId, "failed", undefined, "Music generation failed. Please try again.");
          clearInterval(timer);
        }
      }
    } catch (err: any) {
      console.log(`[Kie.ai] Poll error for song ${songId}: ${err.message?.substring(0, 80)}`);
    }
  }, checkInterval);
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
