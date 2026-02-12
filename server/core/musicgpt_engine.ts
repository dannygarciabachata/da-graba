const MUSICGPT_API_BASE = "https://api.musicgpt.com/api/public/v1";

function getApiKey(): string {
  const key = process.env.MUSICGPT_API_KEY;
  if (!key) {
    throw new Error("MUSICGPT_AUTH_ERROR: MUSICGPT_API_KEY not set");
  }
  return key;
}

interface MusicGPTSubmitResponse {
  success: boolean;
  message: string;
  task_id: string;
  conversion_id_1: string;
  conversion_id_2: string;
  eta: number;
  credit_estimate?: number;
}

interface MusicGPTConversion {
  task_id: string;
  conversion_id: string;
  status: string;
  status_msg?: string;
  audio_url?: string;
  conversion_path?: string;
  conversion_path_wav?: string;
  conversion_cost?: number;
  title?: string;
  lyrics?: string;
  music_style?: string;
  vocals_url?: string;
  accompaniment_url?: string;
  key?: string;
  bpm?: number;
}

interface MusicGPTStatusResponse {
  success: boolean;
  conversion?: MusicGPTConversion;
}

export interface MusicGPTPollResult {
  audioUrl?: string;
  vocalsUrl?: string;
  accompanimentUrl?: string;
  key?: string;
  bpm?: number;
  raw: MusicGPTConversion;
}

export type MusicGPTEndpoint =
  | "MusicAI"
  | "Extraction"
  | "Remix"
  | "AudioMastering"
  | "Denoise"
  | "KeyBPMExtraction"
  | "Cover";

export function buildMusicGPTPrompt(userPrompt: string, style: string): { prompt: string; music_style: string } {
  const styleMap: Record<string, { prompt_suffix: string; music_style: string }> = {
    "heart-mula": {
      prompt_suffix: "Dominican Bachata, passionate nylon guitar, bongo drums, guira percussion, emotional male vocals in Spanish, 130 BPM",
      music_style: "Bachata",
    },
    "bachata-romantic": {
      prompt_suffix: "Romantic Dominican Bachata ballad, tender nylon guitar, bongo, guira, emotional male vocals in Spanish, intimate, 128 BPM",
      music_style: "Bachata",
    },
    "bachata-dance": {
      prompt_suffix: "Upbeat Dominican Bachata, energetic nylon guitar, fast bongo, guira, congas, male vocals in Spanish, dance party, 140 BPM",
      music_style: "Bachata",
    },
    "bachata-bolero": {
      prompt_suffix: "Slow Bachata Bolero, melancholic nylon guitar, piano, soft bongo, emotional male vocals in Spanish, nostalgic, 108 BPM",
      music_style: "Bachata",
    },
    "trio-serenade": {
      prompt_suffix: "Latin Bolero Trio Serenade, requinto guitar, nylon guitars, three-part male vocal harmony in Spanish, acoustic, intimate, 105 BPM",
      music_style: "Bolero",
    },
    "bachata-urbana": {
      prompt_suffix: "Modern Urban Bachata, electric guitar with reverb, bongo, trap hi-hats, 808 bass, R&B male vocals in Spanish, 138 BPM",
      music_style: "Bachata",
    },
  };

  const cfg = styleMap[style] || styleMap["heart-mula"];
  const prompt = `${userPrompt}. ${cfg.prompt_suffix}`.substring(0, 280);

  return { prompt, music_style: cfg.music_style };
}

export async function submitMusicGPTJob(
  endpoint: MusicGPTEndpoint,
  body: Record<string, any>
): Promise<MusicGPTSubmitResponse> {
  const apiKey = getApiKey();

  console.log(`[MusicGPT:${endpoint}] Submitting job...`);

  const response = await fetch(`${MUSICGPT_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorMsg = `MusicGPT API error: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMsg = errorData?.message || errorData?.error || JSON.stringify(errorData);
    } catch {
      const text = await response.text().catch(() => "");
      if (text) errorMsg = text.substring(0, 300);
    }
    console.error(`[MusicGPT:${endpoint}] Error ${response.status}: ${errorMsg}`);

    if (response.status === 401 || response.status === 403) {
      throw new Error("MUSICGPT_AUTH_ERROR: Invalid API key");
    }
    if (response.status === 402) {
      throw new Error("MUSICGPT_QUOTA_EXCEEDED: Insufficient credits");
    }
    throw new Error(`MUSICGPT_ERROR: ${errorMsg}`);
  }

  const data = (await response.json()) as MusicGPTSubmitResponse;
  console.log(`[MusicGPT:${endpoint}] Task submitted: ${data.task_id}, ETA: ${data.eta}s`);
  return data;
}

export async function pollMusicGPTJob(
  taskId: string,
  timeoutMs: number = 600000,
  intervalMs: number = 8000
): Promise<MusicGPTPollResult> {
  const apiKey = getApiKey();
  const startTime = Date.now();
  let currentInterval = intervalMs;

  console.log(`[MusicGPT] Polling task ${taskId} (timeout: ${timeoutMs / 1000}s)...`);

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(
        `${MUSICGPT_API_BASE}/byId?task_id=${encodeURIComponent(taskId)}`,
        {
          method: "GET",
          headers: { Authorization: apiKey },
        }
      );

      if (!response.ok) {
        console.log(`[MusicGPT] Poll response ${response.status}, retrying...`);
        await sleep(currentInterval);
        continue;
      }

      const data = (await response.json()) as MusicGPTStatusResponse;

      if (data.success && data.conversion) {
        const status = data.conversion.status?.toUpperCase();
        console.log(`[MusicGPT] Task ${taskId} status: ${status}`);

        if (status === "COMPLETED") {
          const audioUrl =
            data.conversion.audio_url ||
            data.conversion.conversion_path ||
            data.conversion.conversion_path_wav;

          console.log(`[MusicGPT] Task ${taskId} completed`);

          return {
            audioUrl: audioUrl || undefined,
            vocalsUrl: data.conversion.vocals_url,
            accompanimentUrl: data.conversion.accompaniment_url,
            key: data.conversion.key,
            bpm: data.conversion.bpm,
            raw: data.conversion,
          };
        }

        if (status === "FAILED") {
          throw new Error(`MusicGPT job failed: ${data.conversion.status_msg || "Unknown error"}`);
        }
      }
    } catch (err: any) {
      if (err.message.includes("MusicGPT job failed") || err.message.includes("COMPLETED but no audio")) {
        throw err;
      }
      console.log(`[MusicGPT] Poll error (will retry): ${err.message?.substring(0, 100)}`);
    }

    await sleep(currentInterval);

    const elapsed = Date.now() - startTime;
    if (elapsed > timeoutMs / 2) {
      currentInterval = Math.min(currentInterval * 1.5, 15000);
    }
  }

  throw new Error(`MusicGPT job timed out after ${timeoutMs / 1000}s`);
}

export async function submitMusicGPTGeneration(
  userPrompt: string,
  style: string,
  options: { lyrics?: string; duration?: number } = {}
): Promise<MusicGPTSubmitResponse> {
  const { prompt, music_style } = buildMusicGPTPrompt(userPrompt, style);

  const body: Record<string, any> = {
    prompt,
    music_style,
    make_instrumental: false,
    vocal_only: false,
  };

  if (options.lyrics && options.lyrics.length > 10) {
    body.lyrics = options.lyrics;
  }
  if (options.duration && options.duration > 0) {
    body.output_length = options.duration;
  }

  console.log(`[MusicGPT] Prompt: ${prompt}`);
  console.log(`[MusicGPT] Style: ${music_style}, Duration: ${options.duration || "default"}s`);

  return submitMusicGPTJob("MusicAI", body);
}

export async function pollMusicGPTStatus(
  taskId: string,
  timeoutMs: number = 600000,
  intervalMs: number = 8000
): Promise<string> {
  const result = await pollMusicGPTJob(taskId, timeoutMs, intervalMs);
  if (!result.audioUrl) {
    throw new Error("MusicGPT returned COMPLETED but no audio URL");
  }
  return result.audioUrl;
}

export async function generateWithMusicGPT(
  userPrompt: string,
  style: string,
  options: { lyrics?: string; duration?: number } = {}
): Promise<{ audioUrl: string; provider: "musicgpt" }> {
  const submitResult = await submitMusicGPTGeneration(userPrompt, style, options);
  const audioUrl = await pollMusicGPTStatus(submitResult.task_id);
  return { audioUrl, provider: "musicgpt" };
}

export async function submitExtraction(audioUrl: string): Promise<MusicGPTSubmitResponse> {
  return submitMusicGPTJob("Extraction", { audio_url: audioUrl });
}

export async function submitRemix(
  audioUrl: string,
  prompt: string,
  options: { music_style?: string; duration?: number } = {}
): Promise<MusicGPTSubmitResponse> {
  const body: Record<string, any> = {
    audio_url: audioUrl,
    prompt,
  };
  if (options.music_style) body.music_style = options.music_style;
  if (options.duration) body.output_length = options.duration;
  return submitMusicGPTJob("Remix", body);
}

export async function submitMastering(audioUrl: string): Promise<MusicGPTSubmitResponse> {
  return submitMusicGPTJob("AudioMastering", { audio_url: audioUrl });
}

export async function submitDenoise(audioUrl: string): Promise<MusicGPTSubmitResponse> {
  return submitMusicGPTJob("Denoise", { audio_url: audioUrl });
}

export async function submitKeyBPMExtraction(audioUrl: string): Promise<MusicGPTSubmitResponse> {
  return submitMusicGPTJob("KeyBPMExtraction", { audio_url: audioUrl });
}

export async function submitCover(
  audioUrl: string,
  voiceDescription: string
): Promise<MusicGPTSubmitResponse> {
  return submitMusicGPTJob("Cover", {
    audio_url: audioUrl,
    voice_description: voiceDescription,
  });
}

import fs from "fs";
import path from "path";
import crypto from "crypto";

const AUDIO_BASE_DIR = path.join(process.cwd(), "public", "audio");

export async function downloadMusicGPTFile(
  remoteUrl: string,
  subdir: string,
  label: string
): Promise<string> {
  const dir = path.join(AUDIO_BASE_DIR, subdir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`[MusicGPT] Downloading ${label} from: ${remoteUrl.substring(0, 120)}`);
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${label}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = remoteUrl.includes(".wav") ? ".wav" : ".mp3";
  const filename = `${crypto.randomUUID()}_${label}${ext}`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);

  console.log(`[MusicGPT] Saved ${label}: ${filePath} (${buffer.length} bytes)`);
  return `/audio/${subdir}/${filename}`;
}

export function resolveFullAudioUrl(localUrl: string): string {
  if (localUrl.startsWith("http")) return localUrl;
  const domain = process.env.REPLIT_DEV_DOMAIN;
  const base = domain ? `https://${domain}` : "http://localhost:5000";
  return `${base}${localUrl}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
