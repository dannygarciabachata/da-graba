import Replicate from "replicate";
import { buildMusicGenPrompt, generateStructuredPrompt, type MusicPromptConfig } from "./prompt_engine";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export interface MusicGenerationResult {
  audioUrl: string;
  prompt: string;
  config: MusicPromptConfig;
  duration: number;
}

export async function generateMusic(
  userPrompt: string,
  options: {
    isBachata?: boolean;
    style?: string;
    duration?: number;
  } = {}
): Promise<MusicGenerationResult> {
  const { isBachata = true, style = "bachata-romantic", duration = 15 } = options;

  const config = await generateStructuredPrompt(userPrompt);

  let finalPrompt: string;
  if (isBachata) {
    finalPrompt = buildMusicGenPrompt(userPrompt, style);
  } else {
    finalPrompt = userPrompt;
  }

  console.log(`[MusicEngine] Generating with prompt: ${finalPrompt}`);
  console.log(`[MusicEngine] Config:`, JSON.stringify(config, null, 2));

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

  return {
    audioUrl,
    prompt: finalPrompt,
    config,
    duration,
  };
}
