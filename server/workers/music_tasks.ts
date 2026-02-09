import Replicate from "replicate";
import { storage } from "../storage";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

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

    const output = await replicate.run(
      "meta/musicgen:b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38",
      {
        input: {
          model_version: "stereo-melody-large",
          prompt: finalPrompt,
          duration,
        },
      }
    );

    const audioUrl = typeof output === "string" ? output : (output as any)?.audio || String(output);

    console.log(`[Worker] Music generated for song ${songId}: ${audioUrl}`);

    await storage.updateSongStatus(songId, "completed", audioUrl);
  } catch (err: any) {
    console.error(`[Worker] Music generation failed for song ${songId}:`, err);
    let errorMessage = err.message || "Generation failed";
    if (errorMessage.includes("402") || errorMessage.includes("Insufficient credit")) {
      errorMessage = "Replicate account needs more credits. Please add funds at replicate.com/account/billing.";
    } else if (errorMessage.includes("401") || errorMessage.includes("Unauthenticated")) {
      errorMessage = "Replicate API token is invalid. Please update it in your project settings.";
    }
    await storage.updateSongStatus(
      songId,
      "failed",
      undefined,
      errorMessage
    );
  }
}
