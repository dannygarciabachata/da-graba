import Replicate from "replicate";
import { storage } from "../storage";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function processHummingToMusic(
  sampleId: number,
  audioUrl: string,
  prompt: string,
  duration: number = 15
): Promise<void> {
  try {
    console.log(`[SampleWorker] Starting humming-to-music for sample ${sampleId}`);
    await storage.updateSample(sampleId, { status: "processing" });

    const fullAudioUrl = audioUrl.startsWith("http")
      ? audioUrl
      : `${process.env.REPLIT_DEV_DOMAIN ? "https://" + process.env.REPLIT_DEV_DOMAIN : "http://localhost:5000"}${audioUrl}`;

    const cleanPrompt = prompt
      .replace(/high fidelity|masterpiece|studio quality/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 200);

    console.log(`[SampleWorker] Using melody-conditioned generation with prompt: ${cleanPrompt}`);

    const output = await replicate.run(
      "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
      {
        input: {
          model_version: "stereo-melody-large",
          prompt: cleanPrompt,
          input_audio: fullAudioUrl,
          duration: Math.min(duration, 30),
          temperature: 1.0,
          top_k: 250,
          top_p: 0.0,
          classifier_free_guidance: 3,
          output_format: "wav",
          normalization_strategy: "loudness",
          continuation: false,
        },
      }
    );

    const resultUrl = typeof output === "string" ? output : (output as any)?.audio || String(output);
    console.log(`[SampleWorker] Got result URL: ${resultUrl}`);

    const response = await fetch(resultUrl);
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`);

    const audioDir = path.join(process.cwd(), "public", "audio");
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

    const fileName = `${uuidv4()}.wav`;
    const filePath = path.join(audioDir, fileName);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const newAudioUrl = `/audio/${fileName}`;
    await storage.updateSample(sampleId, {
      status: "ready",
      audioUrl: newAudioUrl,
      sourceType: "ai-transform",
    });

    console.log(`[SampleWorker] Humming-to-music complete for sample ${sampleId}`);
  } catch (err: any) {
    console.error(`[SampleWorker] Error for sample ${sampleId}:`, err.message || err);
    await storage.updateSample(sampleId, {
      status: "failed",
      error: err.message || "Humming-to-music generation failed",
    });
  }
}
