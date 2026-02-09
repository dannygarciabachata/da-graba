import Replicate from "replicate";
import { buildMusicGenPrompt, generateStructuredPrompt, type MusicPromptConfig } from "./prompt_engine";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

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
  console.log(`[MusicEngine] Using Hugging Face MusicGen (free tier)`);
  console.log(`[MusicEngine] HF Prompt: ${prompt}`);

  const hfToken = process.env.HF_TOKEN;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (hfToken) {
    headers["Authorization"] = `Bearer ${hfToken}`;
  }

  const maxTokens = Math.min(Math.floor(duration * 50), 1500);

  const response = await fetch(
    "https://api-inference.huggingface.co/models/facebook/musicgen-small",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: maxTokens,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[MusicEngine] HF API error ${response.status}: ${errorText}`);

    if (response.status === 503) {
      const parsed = JSON.parse(errorText);
      const waitTime = parsed.estimated_time ? Math.ceil(parsed.estimated_time) : 30;
      throw new Error(`Model is loading, please try again in ~${waitTime} seconds`);
    }
    throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
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
        audioUrl = await generateWithHuggingFace(finalPrompt, Math.min(duration, 15));
        usedProvider = "huggingface";
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
