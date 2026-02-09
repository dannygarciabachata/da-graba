import Replicate from "replicate";
import { storage } from "../storage";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const HF_API_URL = "https://router.huggingface.co/hf-inference/models/facebook/musicgen-small";

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
  console.log(`[Worker] Using Hugging Face MusicGen`);

  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    throw new Error("HF_TOKEN not set");
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
        try {
          result = await generateWithHuggingFace(finalPrompt, Math.min(duration, 15));
        } catch (hfErr: any) {
          console.error(`[Worker] HF fallback also failed:`, hfErr.message);
          const hfMsg = hfErr.message || "";
          if (hfMsg.includes("404") || hfMsg.includes("410") || hfMsg.includes("HF_ENDPOINT_DEPRECATED")) {
            throw new Error(
              "Replicate needs credits (replicate.com/account/billing). Hugging Face free tier is currently unavailable."
            );
          }
          throw new Error(
            "Music generation failed. Add credits at replicate.com/account/billing"
          );
        }
      } else {
        throw err;
      }
    }

    console.log(`[Worker] Music generated via ${result.provider} for song ${songId}: ${result.audioUrl}`);

    await storage.updateSongStatus(songId, "completed", result.audioUrl);
  } catch (err: any) {
    console.error(`[Worker] Music generation failed for song ${songId}:`, err);
    let errorMessage = err.message || "Generation failed";
    await storage.updateSongStatus(
      songId,
      "failed",
      undefined,
      errorMessage
    );
  }
}
