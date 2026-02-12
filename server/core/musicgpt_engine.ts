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
}

interface MusicGPTStatusResponse {
  success: boolean;
  conversion?: MusicGPTConversion;
}

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

export async function submitMusicGPTGeneration(
  userPrompt: string,
  style: string,
  options: {
    lyrics?: string;
    duration?: number;
  } = {}
): Promise<MusicGPTSubmitResponse> {
  const apiKey = getApiKey();
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

  console.log(`[MusicGPT] Submitting generation request...`);
  console.log(`[MusicGPT] Prompt: ${prompt}`);
  console.log(`[MusicGPT] Style: ${music_style}, Duration: ${options.duration || "default"}s`);

  const response = await fetch(`${MUSICGPT_API_BASE}/MusicAI`, {
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
    console.error(`[MusicGPT] Error ${response.status}: ${errorMsg}`);

    if (response.status === 401 || response.status === 403) {
      throw new Error("MUSICGPT_AUTH_ERROR: Invalid API key");
    }
    if (response.status === 402) {
      throw new Error("MUSICGPT_QUOTA_EXCEEDED: Insufficient credits");
    }
    throw new Error(`MUSICGPT_ERROR: ${errorMsg}`);
  }

  const data = (await response.json()) as MusicGPTSubmitResponse;
  console.log(`[MusicGPT] Task submitted: ${data.task_id}, ETA: ${data.eta}s`);
  return data;
}

export async function pollMusicGPTStatus(
  taskId: string,
  timeoutMs: number = 600000,
  intervalMs: number = 8000
): Promise<string> {
  const apiKey = getApiKey();
  const startTime = Date.now();

  console.log(`[MusicGPT] Polling task ${taskId} (timeout: ${timeoutMs / 1000}s)...`);

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(
        `${MUSICGPT_API_BASE}/byId?task_id=${encodeURIComponent(taskId)}`,
        {
          method: "GET",
          headers: {
            Authorization: apiKey,
          },
        }
      );

      if (!response.ok) {
        console.log(`[MusicGPT] Poll response ${response.status}, retrying...`);
        await sleep(intervalMs);
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

          if (!audioUrl) {
            throw new Error("MusicGPT returned COMPLETED but no audio URL");
          }

          console.log(`[MusicGPT] Audio ready: ${audioUrl.substring(0, 120)}`);
          return audioUrl;
        }

        if (status === "FAILED") {
          throw new Error(`MusicGPT generation failed: ${data.conversion.status_msg || "Unknown error"}`);
        }
      }
    } catch (err: any) {
      if (err.message.includes("MusicGPT generation failed") || err.message.includes("COMPLETED but no audio")) {
        throw err;
      }
      console.log(`[MusicGPT] Poll error (will retry): ${err.message?.substring(0, 100)}`);
    }

    await sleep(intervalMs);

    const elapsed = Date.now() - startTime;
    if (elapsed > timeoutMs / 2) {
      intervalMs = Math.min(intervalMs * 1.5, 15000);
    }
  }

  throw new Error(`MusicGPT generation timed out after ${timeoutMs / 1000}s`);
}

export async function generateWithMusicGPT(
  userPrompt: string,
  style: string,
  options: {
    lyrics?: string;
    duration?: number;
  } = {}
): Promise<{ audioUrl: string; provider: "musicgpt" }> {
  const submitResult = await submitMusicGPTGeneration(userPrompt, style, options);
  const audioUrl = await pollMusicGPTStatus(submitResult.task_id);
  return { audioUrl, provider: "musicgpt" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
