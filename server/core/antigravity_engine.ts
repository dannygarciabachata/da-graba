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
  "bachata": "Format: Band | Subgenre: Dominican Bachata | Instruments: nylon requinto guitar melody, nylon segunda guitar rhythmic strumming, bongo drums, guira percussion, electric bass | Moods: romantic, warm, intimate | Set in D Minor at 130 BPM, professional studio recording, Latin tropical production",
  "bachata tradicional": "Format: Band | Subgenre: Traditional Dominican Bachata | Instruments: nylon requinto guitar melody with vibrato, nylon segunda guitar syncopated rhythm, bongo drums derecho, metal guira, upright bass walking lines | Moods: romantic, nostalgic, authentic | Set in A Minor at 128 BPM, warm studio recording",
  "bachata moderna": "Format: Band | Subgenre: Modern Bachata Fusion | Instruments: nylon requinto guitar contemporary phrasing, nylon segunda guitar, bongo drums, guira, electric bass with R&B influence, synth pad atmosphere, violin strings ensemble | Moods: smooth, sensual, polished | Set in G Minor at 125 BPM, modern pop-influenced Latin production, radio-ready mix",
  "bachata sensual": "Format: Band | Subgenre: Sensual Bachata | Instruments: soft nylon requinto guitar arpeggios, gentle segunda guitar, subtle bongo, electric bass prominent groove, lush synth pad layers, smooth violin and cello strings | Moods: sensual, intimate, dreamy | Set in E Minor at 115 BPM, slow-dance atmosphere, silky smooth production",
  "bachata urbana": "Format: Band | Subgenre: Urban Bachata | Instruments: nylon requinto guitar with delay effects, segunda guitar, bongo drums, electronic-enhanced percussion, punchy electric bass, synth pad, hi-hats | Moods: modern, urban, energetic | Set in C Minor at 120 BPM, contemporary urban Latin production, crisp mix",
  "bachata rosa": "Format: Band | Subgenre: Bachata Rosa Ballad | Instruments: delicate nylon requinto guitar melody, soft segunda guitar, gentle bongo, guira, warm electric bass, grand piano fills, lush violin and cello strings ensemble | Moods: tender, sweet, dreamy, romantic | Set in F Major at 118 BPM, orchestral Latin ballad production, beautiful arrangement",
  "bolero": "Format: Band | Subgenre: Latin Bolero Ballad | Instruments: nylon requinto guitar arpeggios melody, nylon segunda guitar harmonic support, soft bongo drums, upright bass quarter notes, grand piano chords, violin and cello strings legato | Moods: deeply romantic, emotional, intimate | Set in D Minor at 78 BPM, warm intimate studio recording, classic Latin ballad",
  "bolero romantico": "Format: Band | Subgenre: Romantic Bolero | Instruments: nylon requinto guitar tremolo melody, nylon segunda guitar gentle rhythm, soft bongo and conga, upright bass, rich grand piano voicings, full violin and cello strings orchestra | Moods: deeply emotional, sorrowful, passionate | Set in A Minor at 72 BPM, lush orchestral Latin ballad, cinematic intimate recording",
  "bolero moderno": "Format: Band | Subgenre: Modern Bolero | Instruments: nylon requinto guitar melodic phrasing, segunda guitar, electric bass, grand piano elegant voicings, atmospheric synth pad, cinematic string orchestra | Moods: contemporary, romantic, sophisticated | Set in G Minor at 80 BPM, polished modern Latin ballad production, professional studio quality",
  "bolero son": "Format: Band | Subgenre: Bolero-Son Fusion | Instruments: nylon requinto guitar, tres guitar guajeo pattern, bongo drums martillo, upright bass walking line, maracas | Moods: warm, Caribbean, romantic with groove | Set in C Major at 85 BPM, Afro-Cuban romance feel, organic warm recording",
  "salsa": "Format: Big Band | Subgenre: Salsa Dura | Instruments: grand piano montuno, trumpet section, trombone, timbales, congas, upright bass tumbao, bongo | Moods: energetic, fiery, danceable | Set in B-flat Major at 180 BPM, powerful Latin big band sound, live concert energy",
  "salsa romantica": "Format: Band | Subgenre: Salsa Romantica | Instruments: grand piano montuno, trumpet melody, trombone, congas, timbales, electric bass, synth strings | Moods: romantic, smooth, danceable | Set in D Minor at 170 BPM, polished Latin pop-salsa production",
  "salsa urbana": "Format: Band | Subgenre: Urban Salsa | Instruments: piano montuno, trumpet, electronic drums, electric bass, synth pad, congas | Moods: modern, urban, party | Set in A Minor at 175 BPM, contemporary Latin urban fusion",
  "merengue": "Format: Band | Subgenre: Merengue | Instruments: accordion melody, tambora drum driving pattern, guira metallic rhythm, electric bass, saxophone, congas | Moods: festive, energetic, joyful | Set in C Major at 160 BPM, upbeat Caribbean dance music, party production",
  "merengue tipico": "Format: Band | Subgenre: Merengue Tipico | Instruments: accordion lead melody, tambora drum, metal guira, upright bass, saxophone | Moods: authentic, traditional, festive | Set in G Major at 155 BPM, rural Dominican merengue, organic folk sound",
  "reggaeton": "Format: Electronic | Subgenre: Reggaeton | Instruments: deep 808 bass, crisp hi-hats, snare rolls, dembow drum pattern, synth lead, atmospheric pad | Moods: urban, aggressive, danceable | Set in F Minor at 92 BPM, modern Latin urban club production, heavy bass",
  "latin pop": "Format: Band | Subgenre: Latin Pop | Instruments: acoustic guitar strumming, electric guitar clean, drum kit pop beat, electric bass, synth pad, light strings | Moods: catchy, warm, upbeat | Set in C Major at 120 BPM, radio-ready Latin pop production, bright and polished",
  "cumbia": "Format: Band | Subgenre: Colombian Cumbia | Instruments: accordion melody, alegre drum, llamador drum, guacharaca scraper, electric bass, gaita flute | Moods: tropical, festive, danceable | Set in A Minor at 100 BPM, traditional Colombian folk dance groove",
  "vallenato": "Format: Band | Subgenre: Colombian Vallenato | Instruments: accordion lead melody, caja vallenata drum, guacharaca percussion, electric bass | Moods: romantic, storytelling, warm | Set in D Major at 120 BPM, authentic Colombian vallenato, heartfelt production",
  "son": "Format: Band | Subgenre: Cuban Son | Instruments: tres guitar guajeo, trumpet melody, bongo drums, upright bass tumbao, clave rhythm, maracas | Moods: warm, groovy, Caribbean | Set in G Major at 110 BPM, classic Havana son ensemble, organic vintage feel",
  "mambo": "Format: Big Band | Subgenre: Cuban Mambo | Instruments: trumpet section, trombone section, piano montuno, timbales, congas, upright bass, saxophone | Moods: powerful, high-energy, explosive | Set in B-flat Major at 170 BPM, big band Latin orchestra, concert hall power",
  "cha-cha-cha": "Format: Band | Subgenre: Cha-Cha-Cha Charanga | Instruments: flute melody, violin section, piano guajeo, timbales, guiro, upright bass | Moods: elegant, smooth, danceable | Set in F Major at 120 BPM, classic Cuban charanga style, refined production",
  "cha cha cha": "Format: Band | Subgenre: Cha-Cha-Cha Charanga | Instruments: flute melody, violin section, piano guajeo, timbales, guiro, upright bass | Moods: elegant, smooth, danceable | Set in F Major at 120 BPM, classic Cuban charanga style, refined production",
  "guaracha": "Format: Electronic | Subgenre: Modern Guaracha | Instruments: tribal percussion, electronic bass drop, synth lead stabs, clap samples, hi-hats | Moods: intense, high-energy, tribal | Set in E Minor at 130 BPM, modern Latin club production, festival energy",
  "dembow": "Format: Electronic | Subgenre: Dominican Dembow | Instruments: heavy 808 bass, Dominican tambora pattern, hi-hats, snare, synth lead | Moods: aggressive, bouncy, street | Set in G Minor at 115 BPM, hard-hitting Caribbean urban beat, crisp production",
  "plena": "Format: Band | Subgenre: Puerto Rican Plena | Instruments: pandereta drums trio, guiro scraper, brass trumpet and trombone, acoustic guitar | Moods: festive, communal, street celebration | Set in C Major at 110 BPM, traditional Puerto Rican street music",
  "bomba": "Format: Percussion Ensemble | Subgenre: Afro-Puerto Rican Bomba | Instruments: barrel drums buleador and subidor, cua sticks on wood, maracas, call-response vocals | Moods: powerful, ceremonial, spiritual | Set in D Minor at 100 BPM, polyrhythmic Afro-Caribbean drum ceremony",
  "punta": "Format: Band | Subgenre: Garifuna Punta | Instruments: turtle shell percussion, primero and segunda drums, acoustic guitar, maracas | Moods: celebratory, high-energy, festive | Set in A Minor at 150 BPM, Central American Garifuna dance music",
  "champeta": "Format: Electronic Band | Subgenre: Colombian Champeta | Instruments: electric guitar African-inspired riff, electronic drum machine, synthesizer bass, percussion | Moods: danceable, tropical, Afro-Caribbean | Set in E Minor at 110 BPM, Cartagena tropical urbano sound",
  "tropical": "Format: Band | Subgenre: Tropical Latin | Instruments: trumpet melody, piano, congas, timbales, electric bass, guiro | Moods: festive, warm, danceable | Set in C Major at 120 BPM, professional Latin tropical dance production",
  "edm": "Format: Electronic | Subgenre: EDM | Instruments: synthesizer supersaw lead, side-chain bass, kick drum four-on-floor, clap, hi-hats, atmospheric pad buildup | Moods: euphoric, energetic, powerful | Set in A Minor at 128 BPM, festival-ready electronic dance production",
  "r&b": "Format: Band | Subgenre: R&B | Instruments: warm Rhodes electric piano, finger-picked electric bass, soft drum kit with brushes, synth pad, light guitar | Moods: smooth, soulful, intimate | Set in E-flat Major at 85 BPM, polished R&B production, silky warm feel",
  "hip hop": "Format: Electronic | Subgenre: Boom Bap Hip Hop | Instruments: sampled drum break, deep 808 bass, vinyl crackle texture, Rhodes piano sample, hi-hats | Moods: gritty, urban, head-nodding | Set in D Minor at 90 BPM, classic boom bap hip hop beat, dusty vinyl feel",
  "pop": "Format: Band | Subgenre: Pop | Instruments: acoustic guitar strumming, modern drum kit, electric bass, synth chords, light piano | Moods: bright, catchy, upbeat | Set in G Major at 120 BPM, radio-ready pop production, clean and polished mix",
  "k-pop": "Format: Electronic Band | Subgenre: K-Pop | Instruments: synth hooks, programmed drum kit, electric bass, vocal chops sample, brass stabs, piano | Moods: glossy, energetic, catchy | Set in B Minor at 125 BPM, highly polished K-pop production, punchy modern arrangement",
  "afrobeat": "Format: Big Band | Subgenre: West African Afrobeat | Instruments: electric guitar riff, horn section trumpet and saxophone, polyrhythmic drum kit, shekere, congas, electric bass | Moods: groovy, warm, danceable | Set in E Minor at 110 BPM, Fela Kuti-inspired Afrobeat groove, organic warm recording",
  "jazz": "Format: Band | Subgenre: Smooth Jazz | Instruments: tenor saxophone melody, grand piano comping, upright bass walking line, jazz drum kit with brushes, vibraphone | Moods: sophisticated, intimate, mellow | Set in B-flat Major at 140 BPM, warm late-night jazz club atmosphere, analog recording",
  "rock": "Format: Band | Subgenre: Rock | Instruments: distorted electric guitar riffs, powerful drum kit, electric bass with overdrive, clean electric guitar arpeggios | Moods: energetic, raw, powerful | Set in E Minor at 130 BPM, driving rock band sound, loud professional studio recording",
  "synthwave": "Format: Electronic | Subgenre: Synthwave | Instruments: analog synthesizer pads, arpeggiator sequence, electronic drum machine, deep synth bass, bright lead synth | Moods: nostalgic, cinematic, retro-futuristic | Set in A Minor at 110 BPM, 1980s inspired electronic production, neon-lit atmosphere",
  "house": "Format: Electronic | Subgenre: Deep House | Instruments: four-on-floor kick drum, warm analog bass line, synth chord stabs, clap, hi-hats, atmospheric vocal chop | Moods: groovy, warm, hypnotic | Set in F Minor at 124 BPM, deep house club production, underground dance music",
  "soul": "Format: Band | Subgenre: Soul | Instruments: Hammond organ, smooth electric bass, drum kit, horn section, warm electric guitar | Moods: heartfelt, soulful, vintage | Set in A-flat Major at 95 BPM, classic Motown-inspired soul groove, vintage analog recording",
  "country": "Format: Band | Subgenre: Modern Country | Instruments: steel guitar pedal, acoustic guitar fingerpicking, steady drum kit, electric bass, fiddle | Moods: warm, authentic, heartfelt | Set in G Major at 110 BPM, Nashville studio country production, honest warm sound",
  "blues": "Format: Band | Subgenre: Blues | Instruments: expressive electric guitar with bends and vibrato, Hammond organ, upright bass, shuffle drum kit with brushes | Moods: raw, emotional, gritty | Set in E Minor at 90 BPM, 12-bar blues form, smoky juke joint atmosphere",
  "indie": "Format: Band | Subgenre: Indie Alternative | Instruments: jangly clean electric guitar, lo-fi drum machine, warm bass guitar, reverb-heavy synth pad, tambourine | Moods: dreamy, atmospheric, melancholic | Set in C Major at 115 BPM, indie bedroom recording aesthetic, warm lo-fi texture",
  "classical": "Format: Orchestra | Subgenre: Classical Orchestral | Instruments: full violin section, viola section, cello section, contrabass, flute, oboe, French horn | Moods: elegant, majestic, timeless | Set in D Major, orchestral classical arrangement, concert hall acoustic recording",
  "funk": "Format: Band | Subgenre: Funk | Instruments: slap electric bass, wah-wah electric guitar, clavinet, horn section stabs, tight drum kit groove | Moods: groovy, infectious, high-energy | Set in E Minor at 105 BPM, James Brown-inspired tight funk groove, punchy live recording",
  "drum & bass": "Format: Electronic | Subgenre: Drum and Bass | Instruments: fast breakbeat drums, deep reese sub-bass, atmospheric synth pad, chopped vocal sample, hi-hats | Moods: intense, dark, high-energy | Set in F Minor at 174 BPM, heavy drum and bass production, underground electronic",
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
          content: `You are a music prompt engineer for SAO-Instrumental-Finetune, a fine-tuned Stable Audio Open model optimized for instrumental music generation.

OUTPUT FORMAT (STRICT):
Produce ONE English prompt following this exact structure:
"Format: [Band/Orchestra/Electronic] | Subgenre: [specific subgenre] | Instruments: [list specific instruments with playing style] | Moods: [2-3 mood words] | Set in [Key] [Minor/Major] at [BPM] BPM, [production quality description]"

CRITICAL RULES:
1. MAX 280 characters total
2. ALWAYS include: Format, Subgenre, specific instrument names, Key, BPM
3. Name SPECIFIC instruments (e.g. "nylon requinto guitar melody" not just "guitar")
4. Describe instrument characteristics briefly (e.g. "walking upright bass", "soft bongo drums")
5. Include mood descriptors that match the genre feel
6. ALWAYS specify Key and BPM from the genre reference below
7. End with production quality description (e.g. "professional studio recording", "warm analog feel")
8. Translate any non-English input to English
9. NO lyrics, NO singing, NO vocals — INSTRUMENTAL ONLY
10. NO vague descriptions — be SPECIFIC about every instrument

GOOD EXAMPLES:
- "Format: Band | Subgenre: Dominican Bachata | Instruments: nylon requinto guitar melody, nylon segunda guitar rhythmic strumming, bongo drums, guira, electric bass | Moods: romantic, warm | Set in D Minor at 130 BPM, professional studio recording"
- "Format: Band | Subgenre: Latin Bolero Ballad | Instruments: nylon guitar arpeggios, upright bass, grand piano, violin and cello strings legato | Moods: deeply emotional, intimate | Set in A Minor at 75 BPM, warm intimate recording"
- "Format: Big Band | Subgenre: Salsa Dura | Instruments: grand piano montuno, trumpet section, timbales, congas, upright bass tumbao | Moods: energetic, fiery | Set in B-flat Major at 180 BPM, powerful Latin production"

BAD EXAMPLES (NEVER produce these):
- "a beautiful bachata with instruments playing together" (too vague, no specific instruments)
- "romantic groove with tight ensemble feel" (missing Format, Key, BPM, instrument names)
- "featuring vocals singing about love in Spanish" (has vocals — model is INSTRUMENTAL ONLY)

Genre reference: ${genreHints}`
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_completion_tokens: 250,
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
