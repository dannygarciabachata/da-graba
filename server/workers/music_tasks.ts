import Replicate from "replicate";
import { storage } from "../storage";
import {
  startSongGeneration,
  pollSongUntilDone,
  buildBachataLyrics,
  buildMurekaPrompt,
} from "../core/mureka_engine";
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

async function generateWithMureka(
  prompt: string,
  style: string
): Promise<{ audioUrl: string; provider: "mureka" }> {
  console.log(`[Worker] Using Mureka AI for song generation`);

  const lyrics = buildBachataLyrics(prompt, style);
  const murekaPrompt = buildMurekaPrompt(prompt, style);

  const task = await startSongGeneration(lyrics, murekaPrompt, "auto");

  const completed = await pollSongUntilDone(task.id, 300000, 5000);

  if (!completed.choices || completed.choices.length === 0) {
    throw new Error("Mureka returned no audio choices");
  }

  const audioUrl = completed.choices[0].url;
  console.log(`[Worker] Mureka audio URL: ${audioUrl}`);
  console.log(`[Worker] Mureka audio duration: ${completed.choices[0].duration}s`);

  return { audioUrl, provider: "mureka" };
}

export async function processMusicGeneration(
  songId: number,
  finalPrompt: string,
  options: {
    isBachata?: boolean;
    style?: string;
    duration?: number;
    lyrics?: string;
  } = {}
): Promise<void> {
  const { duration = 15, style = "heart-mula", lyrics } = options;

  try {
    console.log(`[Worker] Starting music generation for song ${songId}`);
    console.log(`[Worker] Prompt: ${finalPrompt}`);
    console.log(`[Worker] Style: ${style}`);

    await storage.updateSongStatus(songId, "processing");

    let result: { audioUrl: string; provider: string };

    try {
      if (lyrics) {
        const murekaPrompt = buildMurekaPrompt(finalPrompt, style);
        const task = await startSongGeneration(lyrics, murekaPrompt, "auto");
        const completed = await pollSongUntilDone(task.id, 300000, 5000);
        if (!completed.choices || completed.choices.length === 0) {
          throw new Error("Mureka returned no audio choices");
        }
        result = { audioUrl: completed.choices[0].url, provider: "mureka" };
      } else {
        result = await generateWithMureka(finalPrompt, style);
      }
    } catch (err: any) {
      const msg = err.message || "";
      console.log(`[Worker] Mureka failed: ${msg}`);

      if (msg.includes("MUREKA_QUOTA_EXCEEDED") || msg.includes("MUREKA_AUTH_ERROR")) {
        console.log(`[Worker] Mureka unavailable, falling back to Replicate`);
        try {
          result = await generateWithReplicate(finalPrompt, duration);
        } catch (repErr: any) {
          const repMsg = repErr.message || "";
          if (repMsg.includes("402") || repMsg.includes("401") || repMsg.includes("Insufficient")) {
            throw new Error(
              "All music providers need credits. Add credits at platform.mureka.ai (Mureka) or replicate.com/account/billing (Replicate)"
            );
          }
          throw repErr;
        }
      } else {
        throw err;
      }
    }

    console.log(`[Worker] Music generated via ${result.provider} for song ${songId}: ${result.audioUrl}`);

    await storage.updateSongStatus(songId, "completed", result.audioUrl);
  } catch (err: any) {
    console.error(`[Worker] Music generation failed for song ${songId}:`, err);
    const errorMessage = err.message || "Generation failed";
    await storage.updateSongStatus(songId, "failed", undefined, errorMessage);
  }
}
