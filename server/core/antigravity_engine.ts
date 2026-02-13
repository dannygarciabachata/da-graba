import OpenAI from "openai";
import { MUSIC_PROMPT, buildLyricsSystemPrompt, type MusicPromptConfig } from "./prompt_engine";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface CreativeOutput {
  lyrics: string;
  musicConfig: MusicPromptConfig | null;
}

export async function generateCreativeLyrics(
  theme: string,
  style: "romantic" | "dance" | "heartbreak" = "romantic"
): Promise<string> {
  const systemPrompt = buildLyricsSystemPrompt(style);

  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Write a short Bachata song (2 verses and 2 choruses only, 4 lines each section) about: ${theme}` },
    ],
    max_completion_tokens: 800,
  });

  return completion.choices[0].message.content || "Could not generate lyrics.";
}

export async function generateMusicConfig(userPrompt: string): Promise<MusicPromptConfig> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: MUSIC_PROMPT },
      { role: "user", content: `DGB Studio Music Engine — create a musical arrangement for: ${userPrompt}` },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 1024,
  });

  const content = completion.choices[0].message.content || "{}";
  return JSON.parse(content) as MusicPromptConfig;
}

export async function generateFullCreativePackage(
  theme: string,
  style: "romantic" | "dance" | "heartbreak" = "romantic"
): Promise<CreativeOutput> {
  const [lyrics, musicConfig] = await Promise.all([
    generateCreativeLyrics(theme, style),
    generateMusicConfig(theme),
  ]);

  return { lyrics, musicConfig };
}
