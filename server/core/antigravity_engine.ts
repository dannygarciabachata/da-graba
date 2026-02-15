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
  style: "romantic" | "dance" | "heartbreak" = "romantic",
  genre?: string
): Promise<string> {
  const systemPrompt = buildLyricsSystemPrompt(style);
  const genreName = genre || "Bachata";

  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Write a short ${genreName} song (2 verses and 2 choruses only, 4 lines each section) about: ${theme}` },
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

const GENRE_INSTRUMENT_MAP: Record<string, string> = {
  "bachata": "tight Dominican bachata band playing together in perfect sync, warm nylon guitar rhythm with melodic picking, smooth Latin groove, romantic and intimate feel, professional studio recording, cohesive ensemble, 130 BPM",
  "bolero": "intimate romantic bolero ensemble, soft nylon guitar arpeggios with gentle piano chords, slow and emotional Latin ballad, warm and dreamy production, cohesive arrangement, 80 BPM",
  "salsa": "tight salsa band with driving piano montuno and brass hits, energetic Latin dance groove, professional big band sound, all instruments locked in together, 180 BPM",
  "merengue": "fast energetic merengue band, driving accordion melody with tight drum pattern, upbeat Caribbean dance music, cohesive festive sound, 160 BPM",
  "reggaeton": "modern reggaeton beat with deep bass and crisp hi-hats, urban Latin groove, polished club production, tight rhythm section, 90 BPM",
  "latin pop": "polished Latin pop production, acoustic guitar with light drums and melodic hooks, catchy and warm, radio-ready sound, 120 BPM",
  "cumbia": "traditional Colombian cumbia groove, accordion-driven melody with rhythmic percussion, tropical dance feel, tight band arrangement, 100 BPM",
  "edm": "electronic dance music with synthesizer pads and driving beats, professional club production with buildups and drops, 128 BPM",
  "r&b": "smooth R&B groove with warm electric piano and soft drums, soulful and intimate, polished production, 85 BPM",
  "hip hop": "hip hop beat with boom bap drums and 808 bass, sampled melodies, urban groove, crisp production, 90 BPM",
  "pop": "catchy pop production with acoustic guitar and modern drums, bright and upbeat, radio-ready mix, 120 BPM",
};

export async function enrichPromptForMusicGen(
  userPrompt: string,
  genre: string
): Promise<string> {
  try {
    const genreLower = genre.toLowerCase();
    const genreHints = GENRE_INSTRUMENT_MAP[genreLower] || GENRE_INSTRUMENT_MAP["bachata"];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a music prompt engineer for AI music generation models.

CRITICAL RULES:
- Output ONLY a short English music description (under 200 chars)
- ALWAYS START with the genre name and its signature rhythm feel (e.g. "bachata groove", "bolero ballad", "salsa dance")
- Describe the OVERALL SOUND as a cohesive band, NOT individual instruments
- Include the BPM and time signature from the genre reference
- Focus on FEEL (tight, warm, groovy, intimate, energetic) and RHYTHM PATTERN
- Translate Spanish/other languages to English
- NO lyrics, NO singing instructions, NO vocal descriptions

GOOD examples:
- "romantic bachata groove, tight Latin guitar rhythm with smooth percussion, warm intimate Dominican feel, syncopated rhythm, 130 BPM, studio quality"
- "slow bolero ballad, soft guitar arpeggios with gentle rhythmic accompaniment, intimate and emotional, 80 BPM, professional recording"
- "energetic salsa dance groove, tight horn section with driving piano rhythm, clave pattern, 180 BPM, professional big band sound"

BAD example: "requinto guitar arpeggios, segunda guitar strumming, bongo drums, guira scraping, electric bass" (too many separate instruments = messy output)

Genre reference: ${genreHints}`
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_completion_tokens: 150,
    });

    const enriched = completion.choices[0].message.content?.trim();
    if (enriched && enriched.length > 10) {
      console.log(`[PromptEnrich] "${userPrompt}" → "${enriched}"`);
      return enriched;
    }
  } catch (err: any) {
    console.log(`[PromptEnrich] OpenAI enrichment failed: ${err.message}, using fallback`);
  }

  const genreLower = genre.toLowerCase();
  const hints = GENRE_INSTRUMENT_MAP[genreLower] || GENRE_INSTRUMENT_MAP["bachata"];
  const fallback = `${genre} music, ${hints}`;
  console.log(`[PromptEnrich] Fallback prompt: "${fallback}"`);
  return fallback;
}
