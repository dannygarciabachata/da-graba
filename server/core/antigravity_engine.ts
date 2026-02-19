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
  "bachata": "tight Dominican bachata band, warm nylon requinto guitar melodic picking over syncopated segunda rhythm, bongó derecho groove with güira metallic pulse, electric bass walking lines, romantic intimate feel, cohesive ensemble, professional studio, 130 BPM, 4/4",
  "bachata tradicional": "authentic Dominican bachata tradicional, requinto nylon guitar melodic phrasing, segunda guitarra syncopated strumming, bongó with hand-played derecho pattern, güira metallic scraping rhythm, electric bass walking lines, warm romantic intimate feel, classic Dominican sound, 130 BPM, 4/4",
  "bachata moderna": "modern bachata fusion with R&B influence, requinto guitar over contemporary chord voicings, segunda rhythm with modern feel, bongó groove, güira pulse, electric bass with funk influence, lush pad atmospherics, violin string arrangement, polished production, 125 BPM, 4/4",
  "bachata sensual": "slow sensual bachata, soft melodic requinto guitar arpeggios, gentle segunda rhythm, subtle bongó groove, light güira shimmer, prominent bass line, warm pad layers, smooth violin strings, intimate romantic atmosphere, slow tempo, 115 BPM, 4/4",
  "bachata urbana": "urban bachata with trap influence, requinto guitar with effects processing, segunda rhythm over modern production, bongó with electronic enhancement, punchy bass, synth pad atmosphere, contemporary Latin urban sound, 120 BPM, 4/4",
  "bachata rosa": "bachata rosa ballad, delicate requinto guitar melodic lines, soft segunda strumming, gentle bongó, light güira, warm bass, lush violin and cello strings, piano embellishments, dreamy romantic atmosphere, sweet and tender, 120 BPM, 4/4",
  "bolero": "intimate bolero ballad, expressive nylon requinto guitar arpeggios with tremolo, gentle segunda accompaniment, soft bongó brushwork, warm piano chords, lush violin and cello string arrangement, emotional and romantic, slow tempo, 78 BPM, 4/4",
  "bolero romantico": "classic romantic bolero, expressive requinto with vibrato and tremolo, segunda guitar warm harmonic support, soft bongó and conga, piano with rich voicings, full violin and cello orchestral strings, pad atmosphere, intimate and deeply emotional, 75 BPM, 4/4",
  "bolero moderno": "modern bolero with contemporary arrangement, requinto melodic phrasing, segunda support, piano with elegant voicings, cinematic string section, atmospheric pad layers, polished production maintaining romantic essence, 80 BPM, 4/4",
  "bolero son": "bolero with Cuban son flavor, requinto guitar over tres-inspired guajeo, bongó with martillo pattern, claves 3-2, bass walking line, warm Caribbean romantic feel, Afro-Cuban groove, 85 BPM, 4/4",
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

function resolveGenreHints(genre: string, substyle?: string): string {
  const genreLower = genre.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, " ").trim();

  if (substyle) {
    const substyleLower = substyle.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/-/g, " ").trim();
    const compositeKey = `${genreLower} ${substyleLower}`;
    if (GENRE_INSTRUMENT_MAP[compositeKey]) return GENRE_INSTRUMENT_MAP[compositeKey];
  }

  return GENRE_INSTRUMENT_MAP[genreLower]
    || GENRE_INSTRUMENT_MAP[genreLower.replace(/\s+/g, "_")]
    || GENRE_INSTRUMENT_MAP["bachata"];
}

export async function enrichPromptForMusicGen(
  userPrompt: string,
  genre: string,
  substyle?: string
): Promise<string> {
  try {
    const genreHints = resolveGenreHints(genre, substyle);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a music prompt engineer for Stable Audio Open (SAO), an AI music generation model trained on instrumental audio.

CRITICAL RULES:
- Output ONLY a short English music description (max 200 chars)
- START with the genre name and its signature rhythm feel (e.g. "bachata groove", "bolero ballad")
- Describe the OVERALL SOUND as a cohesive ensemble playing together
- Include BPM and time signature from the genre reference
- Focus on FEEL (tight, warm, groovy, intimate, energetic), TEXTURE (warm, bright, lush), and RHYTHM PATTERN
- Mention 2-3 key sonic elements that define the genre (e.g. "nylon guitar rhythm with hand percussion")
- Translate Spanish/other languages to English
- NO lyrics, NO singing, NO vocal descriptions — this is INSTRUMENTAL ONLY
- NO long instrument lists — describe the BAND SOUND, not individual parts

GOOD examples:
- "romantic bachata groove, warm nylon guitar rhythm with syncopated hand percussion, intimate Dominican feel, tight ensemble, 130 BPM, studio quality"
- "slow bolero ballad, gentle guitar arpeggios with lush string arrangement, deeply emotional and intimate, 78 BPM, professional orchestral recording"
- "energetic salsa dance groove, driving piano montuno with tight brass and percussion, clave rhythm, 180 BPM, big band sound"
- "sensual bachata, soft melodic guitar over gentle percussion groove, warm pad layers with smooth strings, intimate slow-dance feel, 115 BPM"

BAD examples:
- "requinto guitar arpeggios, segunda guitar strumming, bongo drums, guira scraping, electric bass" (instrument laundry list)
- "a beautiful song with vocals singing about love" (has vocals — SAO is instrumental only)

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
      console.log(`[PromptEnrich] "${userPrompt}" (${genre}${substyle ? '/' + substyle : ''}) → "${enriched}"`);
      return enriched;
    }
  } catch (err: any) {
    console.log(`[PromptEnrich] OpenAI enrichment failed: ${err.message}, using fallback`);
  }

  const hints = resolveGenreHints(genre, substyle);
  const fallback = `${genre} music, ${hints}`;
  console.log(`[PromptEnrich] Fallback prompt: "${fallback}"`);
  return fallback;
}
