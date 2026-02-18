import { storage } from "../storage";
import {
  downloadFile, getWebhookUrl,
  hasProviderForOperation, resolveFullAudioUrl
} from "../core/generic_api_engine";
import { generateCreativeLyrics, enrichPromptForMusicGen } from "../core/antigravity_engine";
import { executeOperation, pollOperation } from "../core/provider_pipeline";
import { pollKieTask, submitKieMashup, canUseKie } from "../core/kie_engine";
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

export function buildHeartMuLaTags(prompt: string, style: string): string {
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
    mambo: ["mambo", "latin", "big band", "brass section", "piano montuno", "timbales", "high energy", "Cuban dance", "170 BPM", "4/4 time", "studio quality"],
    cha_cha_cha: ["cha-cha-chá", "latin", "charanga", "flute melody", "piano guajeo", "light percussion", "Cuban dance", "120 BPM", "4/4 time", "elegant", "studio quality"],
    chachacha: ["cha-cha-chá", "latin", "charanga", "flute melody", "piano guajeo", "light percussion", "Cuban dance", "120 BPM", "4/4 time", "elegant", "studio quality"],
    guaracha: ["guaracha", "latin", "tribal percussion", "electronic bass", "synth stabs", "modern Latin club", "high energy", "130 BPM", "dance", "studio quality"],
    dembow: ["dembow", "Dominican urban", "heavy 808 bass", "Dominican percussion", "Caribbean bounce", "aggressive", "club energy", "115 BPM", "4/4 time", "studio quality"],
    plena: ["plena", "latin", "Puerto Rican", "pandereta", "güiro", "brass", "festive", "street music", "call and response", "110 BPM", "studio quality"],
    bomba: ["bomba", "Afro-Puerto Rican", "barrel drums", "cuá sticks", "maracas", "polyrhythmic", "ceremonial dance", "100 BPM", "studio quality"],
    punta: ["punta", "Garifuna", "Central American", "turtle shell drums", "fast rhythm", "high energy dance", "150 BPM", "celebratory", "studio quality"],
    champeta: ["champeta", "Colombian", "African-inspired", "Cartagena sound", "tropical", "danceable", "Afro-Colombian", "110 BPM", "festive", "studio quality"],
    tropical: ["tropical", "latin", "warm percussion", "brass", "melodic hooks", "Caribbean groove", "dance", "120 BPM", "festive", "studio quality"],
    r_b: ["r&b", "smooth groove", "electric piano", "soft drums", "soulful", "intimate", "85 BPM", "4/4 time", "warm production"],
    hip_hop: ["hip hop", "boom bap", "808 bass", "crisp snares", "sampled melody", "90 BPM", "4/4 time", "urban"],
    pop: ["pop", "catchy melody", "modern drums", "acoustic guitar", "bright production", "120 BPM", "radio-ready", "upbeat"],
    edm: ["edm", "electronic", "synthesizer", "driving beat", "build-up", "drop", "128 BPM", "4/4 time", "club production"],
    k_pop: ["k-pop", "pop", "synth hooks", "tight drums", "energetic", "glossy production", "125 BPM", "modern", "studio quality"],
    kpop: ["k-pop", "pop", "synth hooks", "tight drums", "energetic", "glossy production", "125 BPM", "modern", "studio quality"],
    afrobeat: ["afrobeat", "West African", "polyrhythmic", "horn section", "guitar riffs", "danceable", "110 BPM", "4/4 time", "warm", "studio quality"],
    jazz: ["jazz", "saxophone", "trumpet", "piano comping", "walking bass", "sophisticated", "140 BPM", "swing", "studio quality"],
    rock: ["rock", "electric guitar", "power drums", "bass", "energetic", "raw", "130 BPM", "4/4 time", "studio quality"],
    synthwave: ["synthwave", "analog synth", "arpeggiator", "electronic drums", "80s retro", "cinematic", "110 BPM", "nostalgic", "studio quality"],
    house: ["house", "four-on-the-floor", "warm bassline", "synth chords", "club", "dance", "124 BPM", "4/4 time", "studio quality"],
    soul: ["soul", "warm organ", "smooth bass", "tight drums", "heartfelt", "vintage", "95 BPM", "4/4 time", "studio quality"],
    country: ["country", "steel guitar", "acoustic guitar", "steady drums", "Nashville", "authentic", "110 BPM", "4/4 time", "studio quality"],
    blues: ["blues", "electric guitar", "walking bass", "shuffle drums", "emotional", "12-bar", "90 BPM", "studio quality"],
    indie: ["indie", "jangly guitar", "lo-fi drums", "atmospheric", "dreamy", "115 BPM", "4/4 time", "studio quality"],
    classical: ["classical", "orchestral", "strings", "woodwinds", "dynamic expression", "elegant", "concert hall", "studio quality"],
    funk: ["funk", "slap bass", "wah guitar", "horn stabs", "infectious groove", "dance", "105 BPM", "4/4 time", "studio quality"],
    drum_bass: ["drum and bass", "breakbeat", "deep sub-bass", "atmospheric pads", "high energy", "174 BPM", "electronic", "studio quality"],
    drum_and_bass: ["drum and bass", "breakbeat", "deep sub-bass", "atmospheric pads", "high energy", "174 BPM", "electronic", "studio quality"],
    drumandbass: ["drum and bass", "breakbeat", "deep sub-bass", "atmospheric pads", "high energy", "174 BPM", "electronic", "studio quality"],
    r_and_b: ["r&b", "smooth groove", "electric piano", "soft drums", "soulful", "intimate", "85 BPM", "4/4 time", "warm production"],
    randb: ["r&b", "smooth groove", "electric piano", "soft drums", "soulful", "intimate", "85 BPM", "4/4 time", "warm production"],
  };

  const normalizedStyle = style.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "_and_")
    .replace(/-/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  let tags = genreTagMap[normalizedStyle]
    || genreTagMap[normalizedStyle.replace(/_/g, "")]
    || genreTagMap[normalizedStyle.replace(/_and_/g, "_")]
    || genreTagMap["bachata"] || [];

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

    let songLyrics = lyrics || "";
    if (!songLyrics && !instrumental) {
      try {
        const lyricsStyle = mapStyleToLyricsStyle(style);
        songLyrics = await generateCreativeLyrics(safePrompt, lyricsStyle, style);
        console.log(`[Worker] Generated ${songLyrics.length} chars of lyrics`);
      } catch (err: any) {
        console.log(`[Worker] Lyrics generation failed: ${err.message}`);
      }
    }

    const submitResult = await executeOperation("music_generation", {
      prompt: enrichedPrompt,
      lyrics: songLyrics || undefined,
      style,
      duration,
      instrumental,
      title: `DGB AUDIO - ${style}`,
      songId,
    });

    if (submitResult.taskId) {
      await storage.updateSongTaskId(songId, submitResult.taskId);
    }

    if (submitResult.audioUrl && !submitResult.needsPolling) {
      await storage.updateSongStatus(songId, "completed", submitResult.audioUrl);
      if (submitResult.imageUrl) {
        await storage.updateSongImage(songId, submitResult.imageUrl);
      } else {
        generateSongCoverImage(songId, safePrompt, style).catch(() => {});
      }
      if (submitResult.kieAudioId) {
        try {
          await storage.updateSongKieAudioId(songId, submitResult.kieAudioId);
        } catch {}
      }
      console.log(`[Worker] Song ${songId} completed immediately via ${submitResult.providerName}`);
      return;
    }

    if (submitResult.needsPolling && submitResult.pollConfig) {
      console.log(`[Worker] ${submitResult.providerName} task ${submitResult.taskId} submitted, starting poller for song ${songId}`);
      startUnifiedPoller(songId, submitResult.pollConfig, { prompt: safePrompt, genre: style });
      generateSongCoverImage(songId, safePrompt, style).catch(() => {});
      return;
    }

    if (submitResult.taskId && !submitResult.needsPolling && !submitResult.audioUrl) {
      console.log(`[Worker] ${submitResult.providerName} job ${submitResult.taskId} submitted for song ${songId} (webhook-based, awaiting callback)`);
      generateSongCoverImage(songId, safePrompt, style).catch(() => {});
      startRunPodWatchdog(songId, submitResult.taskId, 300000);
      return;
    }

    throw new Error("Provider returned no audio and no polling config");
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[Worker] Music generation failed for song ${songId}:`, msg);
    let userMsg = "Music generation failed. Please try again.";
    if (msg.includes("QUOTA_EXCEEDED") || msg.includes("CREDITS_EXHAUSTED")) userMsg = "AI service credits exhausted. Please contact admin to restore service.";
    else if (msg.includes("AUTH_ERROR")) userMsg = "AI service authentication failed. Please contact admin.";
    else if (msg.includes("No API key") || msg.includes("NO_PROVIDER")) userMsg = "AI service not configured. Please contact admin.";
    else if (msg.includes("ALL_PROVIDERS_FAILED")) userMsg = "All AI engines failed. Please try again or contact admin.";
    await storage.updateSongStatus(songId, "failed", undefined, userMsg);
  }
}

function startUnifiedPoller(
  songId: number,
  pollConfig: {
    taskId: string;
    endpointId?: number;
    adapterKey?: string;
    providerName: string;
  },
  imageContext?: { prompt: string; genre: string }
) {
  const checkInterval = 15000;
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
        console.log(`[Worker] Song ${songId} (${pollConfig.providerName}) timed out after ${maxChecks * checkInterval / 1000}s of polling`);
        await storage.updateSongStatus(songId, "failed", undefined, `Generación tardó demasiado (${pollConfig.providerName}). Intenta de nuevo.`);
        clearInterval(timer);
        return;
      }

      console.log(`[Worker] Poll ${checks}/${maxChecks} for song ${songId} (${pollConfig.providerName}, task ${pollConfig.taskId})`);

      try {
        const result = await pollOperation("music_generation", pollConfig.taskId, {
          endpointId: pollConfig.endpointId,
          adapterKey: pollConfig.adapterKey,
          providerName: pollConfig.providerName,
          maxWaitMs: 14000,
          intervalMs: 14000,
        });

        if (result.success && result.audioUrl) {
          await storage.updateSongStatus(songId, "completed", result.audioUrl);

          if (result.kieAudioId) {
            try {
              await storage.updateSongKieAudioId(songId, result.kieAudioId);
              console.log(`[Worker] Saved kieAudioId ${result.kieAudioId} for song ${songId}`);
            } catch (err: any) {
              console.log(`[Worker] Failed to save kieAudioId: ${err.message}`);
            }
          }

          if (result.imageUrl) {
            await storage.updateSongImage(songId, result.imageUrl);
          } else if (imageContext) {
            await generateSongCoverImage(songId, imageContext.prompt, imageContext.genre);
          }

          console.log(`[Worker] Song ${songId} completed via ${pollConfig.providerName}`);
          clearInterval(timer);
        }
      } catch (pollErr: any) {
        if (pollErr.message?.includes("failed") || pollErr.message?.includes("error")) {
          console.log(`[Worker] Song ${songId} generation failed: ${pollErr.message}`);
          await storage.updateSongStatus(songId, "failed", undefined, "Music generation failed. Please try again.");
          clearInterval(timer);
        }
      }
    } catch (err: any) {
      console.log(`[Worker] Poll error for song ${songId}: ${err.message?.substring(0, 80)}`);
    }
  }, checkInterval);
}

export function startRunPodWatchdog(songId: number, jobId: string, timeoutMs: number) {
  const checkInterval = 30000;
  const maxChecks = Math.floor(timeoutMs / checkInterval);
  let checks = 0;

  const timer = setInterval(async () => {
    checks++;
    try {
      const song = await storage.getSong(songId);
      if (!song || song.status === "completed" || song.status === "failed") {
        clearInterval(timer);
        pendingRunPodSongs.delete(songId);
        return;
      }

      if (checks >= maxChecks) {
        console.log(`[RunPod Watchdog] Song ${songId} timed out after ${timeoutMs / 1000}s, cancelling job and attempting fallback...`);
        clearInterval(timer);

        try {
          const { cancelJob } = await import("../core/runpod_serverless");
          await cancelJob("music", jobId);
          console.log(`[RunPod Watchdog] Cancelled RunPod job ${jobId} to stop GPU billing`);
        } catch (cancelErr: any) {
          console.log(`[RunPod Watchdog] Could not cancel job ${jobId}: ${cancelErr.message?.substring(0, 80)}`);
        }

        try {
          const fallbackPrompt = song.prompt || "";
          const fallbackStyle = song.genre || "Bachata";
          let fallbackLyrics = song.lyricsText || "";

          if (!fallbackLyrics) {
            try {
              const lyricsStyle = mapStyleToLyricsStyle(fallbackStyle);
              fallbackLyrics = await generateCreativeLyrics(fallbackPrompt, lyricsStyle, fallbackStyle);
              console.log(`[RunPod Watchdog] Generated ${fallbackLyrics.length} chars of lyrics for fallback`);
            } catch (lErr: any) {
              console.log(`[RunPod Watchdog] Lyrics generation failed for fallback: ${lErr.message}`);
            }
          }

          let enrichedPrompt = fallbackPrompt;
          try {
            enrichedPrompt = await enrichPromptForMusicGen(fallbackPrompt, fallbackStyle);
          } catch {}

          console.log(`[RunPod Watchdog] Attempting Kie.ai fallback for song ${songId} (hasLyrics: ${!!fallbackLyrics})`);

          const submitResult = await executeOperation("music_generation", {
            prompt: enrichedPrompt,
            lyrics: fallbackLyrics || undefined,
            style: fallbackStyle,
            duration: 180,
            title: song.title || `DGB AUDIO - ${fallbackStyle}`,
          }, { excludeAdapters: ["runpod_music"] });

          if (submitResult.taskId) {
            await storage.updateSongTaskId(songId, submitResult.taskId);
            await storage.updateSongStatus(songId, "processing", undefined, "Motor GPU tardó, probando motor de respaldo...");
            if (submitResult.pollConfig) {
              startUnifiedPoller(songId, submitResult.pollConfig, { prompt: fallbackPrompt, genre: fallbackStyle });
            }
            pendingRunPodSongs.delete(songId);
            return;
          }
        } catch (fallbackErr: any) {
          console.log(`[RunPod Watchdog] Pipeline fallback failed: ${fallbackErr.message}`);
        }

        await storage.updateSongStatus(songId, "failed", undefined, "La generación tardó demasiado. Intenta de nuevo.");
        pendingRunPodSongs.delete(songId);
        return;
      }

      try {
        const { getJobStatus } = await import("../core/runpod_serverless");
        const status = await getJobStatus("music", jobId);
        console.log(`[RunPod Watchdog] Check ${checks}/${maxChecks} for song ${songId}: job ${jobId} = ${status.status}`);

        if (status.status === "COMPLETED" && status.output) {
          const output = status.output;
          if (output.audioBase64) {
            const { saveRunPodAudio } = await import("../core/runpod_music_engine");
            const audioFormat = output.audioFormat || "mp3";
            const localUrl = await saveRunPodAudio(output.audioBase64, songId, audioFormat);
            await storage.updateSongStatus(songId, "completed", localUrl);
            console.log(`[RunPod Watchdog] Song ${songId} completed via status poll (webhook missed): ${localUrl}`);
          } else if (output.audioUrl || output.audio_url) {
            const audioUrl = output.audioUrl || output.audio_url;
            const { downloadFile } = await import("../core/generic_api_engine");
            const localUrl = await downloadFile(audioUrl, "songs", "song");
            await storage.updateSongStatus(songId, "completed", localUrl);
            console.log(`[RunPod Watchdog] Song ${songId} completed via status poll (URL): ${localUrl}`);
          }
          clearInterval(timer);
          pendingRunPodSongs.delete(songId);
          return;
        }

        if (status.status === "FAILED" || status.status === "CANCELLED" || status.status === "TIMED_OUT") {
          const errorMsg = status.error || `RunPod job ${status.status}`;
          console.log(`[RunPod Watchdog] Song ${songId} failed: ${errorMsg}`);
          await storage.updateSongStatus(songId, "failed", undefined, errorMsg.substring(0, 300));
          clearInterval(timer);
          pendingRunPodSongs.delete(songId);
          return;
        }
      } catch (pollErr: any) {
        console.log(`[RunPod Watchdog] Status check error for song ${songId}: ${pollErr.message?.substring(0, 80)}`);
      }
    } catch (err: any) {
      console.log(`[RunPod Watchdog] Error checking song ${songId}: ${err.message?.substring(0, 80)}`);
    }
  }, checkInterval);

  pendingRunPodSongs.set(songId, timer as any);
}

export function startRunPodTimeout(songId: number, timeoutMs: number) {
  const timer = setTimeout(async () => {
    try {
      const song = await storage.getSong(songId);
      if (song && song.status === "processing") {
        console.log(`[RunPod Music] Song ${songId} timed out after ${timeoutMs / 1000}s, attempting pipeline fallback (skipping RunPod)...`);

        try {
          const fallbackPrompt = song.prompt || "";
          const fallbackStyle = song.genre || "Bachata";
          let fallbackLyrics = song.lyricsText || "";

          if (!fallbackLyrics) {
            try {
              const lyricsStyle = mapStyleToLyricsStyle(fallbackStyle);
              fallbackLyrics = await generateCreativeLyrics(fallbackPrompt, lyricsStyle, fallbackStyle);
            } catch {}
          }

          let enrichedPrompt = fallbackPrompt;
          try {
            enrichedPrompt = await enrichPromptForMusicGen(fallbackPrompt, fallbackStyle);
          } catch {}

          console.log(`[RunPod Music] Fallback to Kie.ai for song ${songId} (hasLyrics: ${!!fallbackLyrics})`);

          const submitResult = await executeOperation("music_generation", {
            prompt: enrichedPrompt,
            lyrics: fallbackLyrics || undefined,
            style: fallbackStyle,
            duration: 180,
            title: song.title || `DGB AUDIO - ${fallbackStyle}`,
          }, { excludeAdapters: ["runpod_music"] });

          if (submitResult.taskId) {
            await storage.updateSongTaskId(songId, submitResult.taskId);
            await storage.updateSongStatus(songId, "processing", undefined, "Motor GPU tardó, probando motor de respaldo...");
            if (submitResult.pollConfig) {
              startUnifiedPoller(songId, submitResult.pollConfig, { prompt: fallbackPrompt, genre: fallbackStyle });
            }
            pendingRunPodSongs.delete(songId);
            return;
          }
        } catch (fallbackErr: any) {
          console.log(`[RunPod Music] Pipeline fallback failed: ${fallbackErr.message}`);
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

export async function processMashupGeneration(
  songId: number,
  audioUrl1: string,
  audioUrl2: string,
  options: {
    style?: string;
    title?: string;
    instrumental?: boolean;
    customMode?: boolean;
  }
) {
  try {
    console.log(`[Mashup Worker] Starting mashup for song ${songId}`);

    if (!canUseKie()) {
      console.error(`[Mashup Worker] Kie.ai not available for mashup`);
      await storage.updateSongStatus(songId, "failed", undefined, "Mashup service not available. Kie.ai API key not configured.");
      return;
    }

    const result = await submitKieMashup(audioUrl1, audioUrl2, {
      style: options.style || "Bachata",
      title: options.title || "DAGRABA Mashup",
      instrumental: options.instrumental ?? false,
      customMode: options.customMode ?? true,
      model: "V5",
    });

    console.log(`[Mashup Worker] Task ${result.taskId} submitted for song ${songId}`);
    await storage.updateSongTaskId(songId, result.taskId);

    const maxPolls = 40;
    const pollInterval = 15000;
    let pollCount = 0;

    const timer = setInterval(async () => {
      pollCount++;
      try {
        const song = await storage.getSong(songId);
        if (!song || song.status === "completed" || song.status === "failed") {
          clearInterval(timer);
          return;
        }

        if (pollCount >= maxPolls) {
          console.log(`[Mashup Worker] Song ${songId} timed out after ${maxPolls * pollInterval / 1000}s`);
          await storage.updateSongStatus(songId, "failed", undefined, "Mashup generation timed out. Please try again.");
          clearInterval(timer);
          return;
        }

        console.log(`[Mashup Worker] Poll ${pollCount}/${maxPolls} for song ${songId} task ${result.taskId}`);

        const pollResult = await pollKieTask(result.taskId, 14000, 14000);

        if (pollResult.audioUrl) {
          await storage.updateSongStatus(songId, "completed", pollResult.audioUrl);
          if (pollResult.imageUrl) {
            await storage.updateSongImage(songId, pollResult.imageUrl);
          }
          if (pollResult.kieAudioId) {
            try {
              await storage.updateSongKieAudioId(songId, pollResult.kieAudioId);
            } catch {}
          }
          console.log(`[Mashup Worker] Song ${songId} mashup completed`);
          clearInterval(timer);

          generateSongCoverImage(songId, `Mashup fusion ${options.style || "Bachata"}`, options.style || "Bachata").catch(() => {});
        }
      } catch (err: any) {
        console.error(`[Mashup Worker] Poll error for song ${songId}:`, err.message);
        if (pollCount >= maxPolls) {
          await storage.updateSongStatus(songId, "failed", undefined, "Mashup generation error. Please try again.");
          clearInterval(timer);
        }
      }
    }, pollInterval);

  } catch (err: any) {
    console.error(`[Mashup Worker] Mashup failed for song ${songId}:`, err.message);
    let userMsg = "Mashup generation failed. Please try again.";
    if (err.message.includes("CREDITS_EXHAUSTED")) {
      userMsg = "Mashup service credits exhausted. Please contact admin.";
    }
    await storage.updateSongStatus(songId, "failed", undefined, userMsg);
  }
}
