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
      { role: "user", content: `DGB AUDIO Music Engine — create a musical arrangement for: ${userPrompt}` },
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
  "vallenato": "authentic Colombian vallenato ensemble, accordion lead melody with caja vallenata and guacharaca percussion, romantic storytelling feel, warm tropical groove, 120 BPM",
  "son": "classic Cuban son ensemble, tres guitar with clave rhythm and trumpet accents, warm Havana groove, tight rhythmic feel, professional Afro-Cuban sound, 110 BPM",
  "mambo": "big band mambo orchestra, driving brass section with piano montuno and timbales, high-energy Cuban dance music, powerful rhythmic groove, 170 BPM",
  "cha-cha-chá": "elegant cha-cha-chá ensemble, flute melody with piano guajeo and light percussion, smooth Cuban dance rhythm, charanga style, polished production, 120 BPM",
  "cha cha cha": "elegant cha-cha-chá ensemble, flute melody with piano guajeo and light percussion, smooth Cuban dance rhythm, charanga style, polished production, 120 BPM",
  "guaracha": "high-energy guaracha beat, driving tribal percussion with electronic bass and synth stabs, modern Latin club sound, intense dance groove, 130 BPM",
  "dembow": "hard-hitting dembow beat, heavy 808 bass with Dominican percussion pattern, urban Caribbean bounce, aggressive club energy, crisp production, 115 BPM",
  "plena": "traditional Puerto Rican plena ensemble, pandereta drums with güiro and brass, festive street music groove, call-and-response energy, 110 BPM",
  "bomba": "Afro-Puerto Rican bomba drumming ensemble, barrel drums with cuá sticks and maracas, powerful polyrhythmic groove, ceremonial dance energy, 100 BPM",
  "punta": "Garifuna punta beat, fast-paced turtle shell and drum rhythms, high-energy Central American dance groove, celebratory feel, tight percussion, 150 BPM",
  "champeta": "Colombian champeta groove, African-inspired rhythm with electronic production, tropical Cartagena sound, danceable Afro-Colombian beat, warm and festive, 110 BPM",
  "tropical": "tropical Latin dance music, warm percussion with brass accents and melodic hooks, festive Caribbean groove, professional Latin production, 120 BPM",
  "edm": "electronic dance music with synthesizer pads and driving beats, professional club production with buildups and drops, 128 BPM",
  "r&b": "smooth R&B groove with warm electric piano and soft drums, soulful and intimate, polished production, 85 BPM",
  "hip hop": "hip hop beat with boom bap drums and 808 bass, sampled melodies, urban groove, crisp production, 90 BPM",
  "pop": "catchy pop production with acoustic guitar and modern drums, bright and upbeat, radio-ready mix, 120 BPM",
  "k-pop": "polished K-pop production, catchy synth hooks with tight drum programming, energetic and glossy, modern pop arrangement, 125 BPM",
  "afrobeat": "West African afrobeat groove, driving polyrhythmic percussion with horn section and guitar riffs, warm and danceable, Fela-inspired energy, 110 BPM",
  "jazz": "smooth jazz ensemble, warm saxophone or trumpet lead with piano comping and walking bass, intimate club atmosphere, sophisticated harmony, 140 BPM",
  "rock": "driving rock band, electric guitar riffs with powerful drums and bass, energetic and raw, professional studio sound, 130 BPM",
  "synthwave": "retro synthwave production, analog synth pads with arpeggiators and electronic drums, nostalgic 80s cinematic feel, 110 BPM",
  "house": "deep house groove, four-on-the-floor kick with warm bassline and synth chords, club-ready dance production, 124 BPM",
  "soul": "classic soul groove, warm organ with smooth bass and tight drums, heartfelt and soulful, vintage production feel, 95 BPM",
  "country": "modern country arrangement, steel guitar with acoustic strumming and steady drums, warm and authentic, Nashville studio sound, 110 BPM",
  "blues": "classic blues groove, expressive electric guitar with walking bass and shuffle drums, raw and emotional, 12-bar feel, 90 BPM",
  "indie": "indie alternative production, jangly guitars with lo-fi drums and warm textures, dreamy and atmospheric, 115 BPM",
  "classical": "orchestral classical arrangement, strings and woodwinds with dynamic expression, elegant and timeless, concert hall production",
  "funk": "tight funk groove, slap bass with wah guitar and horn stabs, infectious dance rhythm, James Brown-inspired energy, 105 BPM",
  "drum & bass": "fast drum and bass production, breakbeat drums with deep sub-bass and atmospheric pads, high-energy electronic, 174 BPM",
};

export async function enrichPromptForMusicGen(
  userPrompt: string,
  genre: string
): Promise<string> {
  try {
    const genreLower = genre.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/-/g, " ").trim();
    const genreHints = GENRE_INSTRUMENT_MAP[genreLower] || GENRE_INSTRUMENT_MAP[genreLower.replace(/\s+/g, "_")] || GENRE_INSTRUMENT_MAP["bachata"];

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

  const genreLower = genre.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, " ").trim();
  const hints = GENRE_INSTRUMENT_MAP[genreLower] || GENRE_INSTRUMENT_MAP[genreLower.replace(/\s+/g, "_")] || GENRE_INSTRUMENT_MAP["bachata"];
  const fallback = `${genre} music, ${hints}`;
  console.log(`[PromptEnrich] Fallback prompt: "${fallback}"`);
  return fallback;
}
