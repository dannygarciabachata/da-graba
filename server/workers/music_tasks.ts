import Replicate from "replicate";
import { storage } from "../storage";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function generateWithReplicate(
  prompt: string,
  duration: number
): Promise<{ audioUrl: string; provider: "replicate" }> {
  console.log(`[Worker] Trying Replicate MusicGen...`);

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

  const audioUrl = typeof output === "string" ? output : (output as any)?.audio || String(output);
  return { audioUrl, provider: "replicate" };
}

async function generateWithHuggingFace(
  prompt: string,
  duration: number
): Promise<{ audioUrl: string; provider: "huggingface" }> {
  console.log(`[Worker] Using Hugging Face MusicGen (free tier)`);

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
    console.error(`[Worker] HF API error ${response.status}: ${errorText}`);

    if (response.status === 503) {
      let waitTime = 30;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.estimated_time) waitTime = Math.ceil(parsed.estimated_time);
      } catch {}
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

  console.log(`[Worker] HF audio saved: ${filepath} (${buffer.length} bytes)`);

  return { audioUrl: `/audio/${filename}`, provider: "huggingface" };
}

export async function processMusicGeneration(
  songId: number,
  finalPrompt: string,
  options: {
    isBachata?: boolean;
    style?: string;
    duration?: number;
  } = {}
): Promise<void> {
  const { duration = 15 } = options;

  try {
    console.log(`[Worker] Starting music generation for song ${songId}`);
    console.log(`[Worker] Prompt: ${finalPrompt}`);

    await storage.updateSongStatus(songId, "processing");

    let result: { audioUrl: string; provider: string };

    try {
      result = await generateWithReplicate(finalPrompt, duration);
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("402") || msg.includes("401") || msg.includes("Insufficient") || msg.includes("Unauthenticated")) {
        console.log(`[Worker] Replicate unavailable (${msg}), falling back to Hugging Face`);
        result = await generateWithHuggingFace(finalPrompt, Math.min(duration, 15));
      } else {
        throw err;
      }
    }

    console.log(`[Worker] Music generated via ${result.provider} for song ${songId}: ${result.audioUrl}`);

    await storage.updateSongStatus(songId, "completed", result.audioUrl);
  } catch (err: any) {
    console.error(`[Worker] Music generation failed for song ${songId}:`, err);
    let errorMessage = err.message || "Generation failed";
    if (errorMessage.includes("402") || errorMessage.includes("Insufficient credit")) {
      errorMessage = "Both Replicate and Hugging Face generation failed. Please try again in a moment.";
    } else if (errorMessage.includes("401") || errorMessage.includes("Unauthenticated")) {
      errorMessage = "API authentication failed. Please check your API tokens.";
    } else if (errorMessage.includes("Model is loading")) {
      errorMessage = errorMessage;
    }
    await storage.updateSongStatus(
      songId,
      "failed",
      undefined,
      errorMessage
    );
  }
}
