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

const GENRE_INSTRUMENT_MAP: Record<string, string> = {
  "bachata": "requinto lead guitar melodic arpeggios, segunda rhythm guitar strumming, bongo drums syncopated pattern, güira metallic scraping percussion, electric bass groovy bassline, romantic Dominican bachata feel, warm tropical production, Latin rhythm guitar picking, 130 BPM, studio quality",
  "bolero": "nylon string guitar, soft piano, gentle strings, romantic slow ballad, 80 BPM, emotional and intimate",
  "salsa": "conga drums, timbales, brass section, piano montuno, energetic Latin dance rhythm, 180 BPM",
  "merengue": "tambora drum, güira, accordion, fast-paced Dominican dance rhythm, 160 BPM, upbeat and festive",
  "reggaeton": "dembow beat, 808 bass, hi-hats, synth pads, urban Latin rhythm, 90 BPM",
  "latin pop": "acoustic guitar, light percussion, pop drums, piano, catchy melodic Latin pop, 120 BPM",
  "cumbia": "accordion, cumbia drums, electric bass, guacharaca shaker, Colombian dance rhythm, 100 BPM",
  "edm": "synthesizer pads, electronic drums, bass drops, buildups, energetic dance music, 128 BPM",
  "r&b": "smooth electric piano, soft drums, bass guitar, soulful R&B groove, 85 BPM",
  "pop": "acoustic guitar, pop drums, synthesizer, catchy melody, upbeat pop production, 120 BPM",
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
          content: `You are a music production prompt engineer specializing in Latin music. Convert user music requests into concise English descriptions optimized for AI music generation models like MusicGen and Replicate.

Rules:
- Output ONLY the English music description, nothing else
- Describe specific instruments, tempo, mood, rhythm pattern, genre characteristics
- Keep under 250 characters
- Never include lyrics or singing instructions
- Focus on instrumental and production qualities: reverb, warmth, mixing style
- If the input is in Spanish or another language, translate the intent to English
- For Bachata: always emphasize requinto lead guitar picking, segunda rhythm guitar, bongo syncopation, güira percussion, and warm bass

Genre reference for this request: ${genreHints}`
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
