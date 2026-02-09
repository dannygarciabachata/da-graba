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
      "meta/musicgen-large:1a581232847c94313f8c85848c41463e26466f8e77c5952d7e97f0a92e1062b8",
      {
        input: {
          model_version: "large",
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
    await storage.updateSongStatus(
      songId,
      "failed",
      undefined,
      err.message || "Generation failed"
    );
  }
}
