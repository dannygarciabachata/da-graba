import Replicate from "replicate";
import { buildMusicGenPrompt, generateStructuredPrompt, type MusicPromptConfig } from "./prompt_engine";
import {
  startSongGeneration,
  pollSongUntilDone,
  buildBachataLyrics,
  buildMurekaPrompt,
} from "./mureka_engine";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export interface MusicGenerationResult {
  audioUrl: string;
  prompt: string;
  config: MusicPromptConfig;
  duration: number;
  provider: "mureka" | "replicate" | "kie";
}

function cleanPromptForMusicGen(rawPrompt: string): string {
  const parts = rawPrompt
    .replace(/high fidelity|masterpiece|studio quality|studio intimate/gi, "")
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  if (parts.length > 200) {
    return parts.substring(0, 200).replace(/,\s*$/, "").trim();
  }
  return parts;
}

async function generateWithReplicate(
  prompt: string,
  duration: number
): Promise<string> {
  const cleanPrompt = cleanPromptForMusicGen(prompt);
  console.log(`[MusicEngine] Using Replicate MusicGen (stereo-large)`);
  console.log(`[MusicEngine] Clean prompt: ${cleanPrompt}`);

  const output = await replicate.run(
    "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
    {
      input: {
        model_version: "stereo-large",
        prompt: cleanPrompt,
        duration: Math.min(duration, 30),
        temperature: 1.0,
        top_k: 250,
        top_p: 0.0,
        classifier_free_guidance: 3,
        output_format: "wav",
        normalization_strategy: "loudness",
      },
    }
  );

  return typeof output === "string" ? output : (output as any)?.audio || String(output);
}

async function generateWithMureka(
  prompt: string,
  style: string,
  lyrics?: string
): Promise<string> {
  console.log(`[MusicEngine] Using Mureka AI`);

  const finalLyrics = lyrics || buildBachataLyrics(prompt, style);
  const murekaPrompt = buildMurekaPrompt(prompt, style);

  const task = await startSongGeneration(finalLyrics, murekaPrompt, "auto");
  const completed = await pollSongUntilDone(task.id, 300000, 5000);

  if (!completed.choices || completed.choices.length === 0) {
    throw new Error("Mureka returned no audio choices");
  }

  return completed.choices[0].url;
}

export async function generateMusic(
  userPrompt: string,
  options: {
    isBachata?: boolean;
    style?: string;
    duration?: number;
    lyrics?: string;
  } = {}
): Promise<MusicGenerationResult> {
  const { isBachata = true, style = "heart-mula", duration = 15, lyrics } = options;

  const config = await generateStructuredPrompt(userPrompt);

  let finalPrompt: string;
  if (isBachata) {
    finalPrompt = buildMusicGenPrompt(userPrompt, style);
  } else {
    finalPrompt = userPrompt;
  }

  console.log(`[MusicEngine] Generating with prompt: ${finalPrompt}`);

  let audioUrl: string;
  let usedProvider: "mureka" | "replicate" | "kie";

  try {
    audioUrl = await generateWithMureka(userPrompt, style, lyrics);
    usedProvider = "mureka";
  } catch (err: any) {
    const msg = err.message || "";
    if (msg.includes("MUREKA_QUOTA_EXCEEDED") || msg.includes("MUREKA_AUTH_ERROR")) {
      console.log(`[MusicEngine] Mureka unavailable, falling back to Replicate`);
      try {
        audioUrl = await generateWithReplicate(finalPrompt, duration);
        usedProvider = "replicate";
      } catch (repErr: any) {
        throw new Error(
          "All music providers need credits. Add credits at platform.mureka.ai or replicate.com/account/billing"
        );
      }
    } else {
      throw err;
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
