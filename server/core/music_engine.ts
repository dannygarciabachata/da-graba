import Replicate from "replicate";
import { buildMusicGenPrompt, generateStructuredPrompt, type MusicPromptConfig } from "./prompt_engine";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const HF_API_URL = "https://router.huggingface.co/hf-inference/models/facebook/musicgen-small";

export interface MusicGenerationResult {
  audioUrl: string;
  prompt: string;
  config: MusicPromptConfig;
  duration: number;
  provider: "replicate" | "huggingface";
}

async function generateWithHuggingFace(
  prompt: string,
  duration: number
): Promise<string> {
  console.log(`[MusicEngine] Using Hugging Face MusicGen`);
  console.log(`[MusicEngine] HF Prompt: ${prompt}`);

  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    throw new Error("HF_TOKEN not set. Add your Hugging Face token to use free music generation.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${hfToken}`,
  };

  const maxTokens = Math.min(Math.floor(duration * 50), 1500);

  const response = await fetch(HF_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: maxTokens,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[MusicEngine] HF API error ${response.status}: ${errorText}`);

    if (response.status === 503) {
      let waitTime = 30;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.estimated_time) waitTime = Math.ceil(parsed.estimated_time);
      } catch {}
      throw new Error(`Model is loading, please try again in ~${waitTime} seconds`);
    }
    if (response.status === 410) {
      throw new Error("HF_ENDPOINT_DEPRECATED");
    }
    throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("audio") && !contentType.includes("octet-stream")) {
    const text = await response.text();
    throw new Error(`Unexpected response type from HF: ${contentType} - ${text.substring(0, 200)}`);
  }

  const audioDir = path.join(process.cwd(), "public", "audio");
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  const filename = `hm_${crypto.randomBytes(8).toString("hex")}.wav`;
  const filepath = path.join(audioDir, filename);

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filepath, buffer);

  console.log(`[MusicEngine] HF audio saved: ${filepath} (${buffer.length} bytes)`);

  return `/audio/${filename}`;
}

async function generateWithReplicate(
  prompt: string,
  duration: number
): Promise<string> {
  console.log(`[MusicEngine] Using Replicate MusicGen`);

  const output = await replicate.run(
    "meta/musicgen:b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38",
    {
      input: {
        model_version: "stereo-melody-large",
        prompt,
        duration,
      },
    }
  );

  return typeof output === "string" ? output : (output as any)?.audio || String(output);
}

export async function generateMusic(
  userPrompt: string,
  options: {
    isBachata?: boolean;
    style?: string;
    duration?: number;
    provider?: "replicate" | "huggingface" | "auto";
  } = {}
): Promise<MusicGenerationResult> {
  const { isBachata = true, style = "bachata-romantic", duration = 15, provider = "auto" } = options;

  const config = await generateStructuredPrompt(userPrompt);

  let finalPrompt: string;
  if (isBachata) {
    finalPrompt = buildMusicGenPrompt(userPrompt, style);
  } else {
    finalPrompt = userPrompt;
  }

  console.log(`[MusicEngine] Generating with prompt: ${finalPrompt}`);
  console.log(`[MusicEngine] Config:`, JSON.stringify(config, null, 2));

  let audioUrl: string;
  let usedProvider: "replicate" | "huggingface";

  if (provider === "replicate") {
    audioUrl = await generateWithReplicate(finalPrompt, duration);
    usedProvider = "replicate";
  } else if (provider === "huggingface") {
    audioUrl = await generateWithHuggingFace(finalPrompt, duration);
    usedProvider = "huggingface";
  } else {
    try {
      audioUrl = await generateWithReplicate(finalPrompt, duration);
      usedProvider = "replicate";
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("402") || msg.includes("401") || msg.includes("Insufficient") || msg.includes("Unauthenticated")) {
        console.log(`[MusicEngine] Replicate unavailable (${msg}), falling back to Hugging Face`);
        try {
          audioUrl = await generateWithHuggingFace(finalPrompt, Math.min(duration, 15));
          usedProvider = "huggingface";
        } catch (hfErr: any) {
          console.error(`[MusicEngine] HF fallback also failed:`, hfErr.message);
          const hfMsg = hfErr.message || "";
          if (hfMsg.includes("HF_ENDPOINT_DEPRECATED") || hfMsg.includes("404") || hfMsg.includes("410")) {
            throw new Error(
              "Replicate needs credits (replicate.com/account/billing). Hugging Face free tier is currently unavailable for music generation."
            );
          }
          throw new Error(
            "Music generation failed. Please add credits to your Replicate account at replicate.com/account/billing"
          );
        }
      } else {
        throw err;
      }
    }
  }

  return {
    audioUrl,
    prompt: finalPrompt,
    config,
    duration,
    provider: usedProvider,
  };
}
