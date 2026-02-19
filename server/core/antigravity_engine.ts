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
  "bachata": "tight Dominican bachata band playing together in sync at 130 BPM 4/4, requinto guitar plays melodic phrases on top while segunda keeps the syncopated strumming pattern on every beat, bongó plays derecho groove locked with güira metallic pulse on the upbeats, bass walks quarter notes anchoring the harmony, all five instruments interlocking as one unified rhythm section, warm romantic intimate feel, professional studio recording",
  "bachata tradicional": "authentic Dominican bachata ensemble locked in groove at 130 BPM 4/4, requinto nylon guitar melodic phrasing over segunda syncopated rhythm strumming every beat, bongó derecho hand pattern synchronized with güira scraping on upbeats, bass walking lines following chord changes, all instruments playing as tight interlocking unit creating classic Dominican sound, warm romantic intimate feel, professional recording",
  "bachata moderna": "modern bachata fusion ensemble synchronized at 125 BPM 4/4, requinto guitar contemporary melodic lines over segunda modern rhythm, bongó groove locked with güira pulse, bass with funk-influenced walking lines, pad atmospherics and violin strings sustaining above the rhythm section, all instruments playing as one cohesive unit, polished R&B-influenced production",
  "bachata sensual": "slow sensual bachata ensemble breathing together at 115 BPM 4/4, requinto guitar soft arpeggios lead the melody, segunda gentle rhythm underneath, bongó subtle groove locked with bass prominent walking line, pad layers and smooth violin strings sustaining above, all instruments playing softly together as one intimate unit, romantic slow-dance atmosphere, professional recording",
  "bachata urbana": "urban bachata ensemble with modern production at 120 BPM 4/4, requinto guitar with effects over segunda rhythm pattern, bongó groove with electronic enhancement locked to punchy bass, synth pad atmosphere, all instruments synchronized as tight unit, contemporary Latin urban sound",
  "bachata rosa": "bachata rosa ballad ensemble at 120 BPM 4/4, delicate requinto guitar melodic lines over soft segunda strumming on every beat, gentle bongó locked with güira, warm bass walking underneath, piano fills between guitar phrases, lush violin and cello strings sustaining long notes above, all instruments playing gently together as one sweet tender unit, dreamy romantic atmosphere",
  "bolero": "intimate bolero ballad ensemble playing in sync at 78 BPM 4/4, requinto guitar leads the melody with arpeggios while segunda keeps steady harmonic rhythm underneath, bongó plays soft syncopated patterns locked to the bass walking quarter notes, piano fills harmonic spaces between guitar phrases, violins and cellos sustain long legato lines over the rhythm section, all instruments breathing together as one tight cohesive band, warm romantic studio recording",
  "bolero romantico": "classic romantic bolero ensemble locked together at 75 BPM 4/4, requinto guitar plays expressive tremolo melody on beats 1 and 3 while segunda strums gentle rhythm on every beat, bongó and conga play interlocking soft patterns following the bass pulse, piano provides rich chord voicings on beats 2 and 4 filling the space, full violin and cello strings sustain lush pads above the rhythm, all instruments perfectly synchronized creating one unified emotional sound, deeply intimate professional recording",
  "bolero moderno": "modern bolero ensemble tightly synchronized at 80 BPM 4/4, requinto guitar melodic phrasing over segunda steady support, piano elegant voicings locked to bass rhythm, atmospheric pad layers blending with cinematic strings, all instruments playing as one cohesive unit with clear musical arrangement, polished contemporary production maintaining romantic essence, professional studio quality",
  "bolero son": "bolero-son fusion ensemble locked in groove at 85 BPM 4/4, requinto guitar over tres-inspired guajeo pattern, bongó playing martillo synchronized with clave 3-2, bass walking line anchoring the whole ensemble, all instruments following the clave rhythm together as tight unit, warm Caribbean romantic feel with Afro-Cuban groove, cohesive band sound",
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
- Output ONLY a short English music description (max 250 chars)
- START with the genre name and rhythm feel (e.g. "bachata groove", "bolero ballad")
- MOST IMPORTANT: Describe instruments playing TOGETHER as ONE BAND, not separately
- Describe HOW instruments interact: "guitar melody OVER steady rhythm, percussion LOCKED WITH bass"
- Use ensemble language: "tight ensemble", "all instruments in sync", "locked together", "unified groove", "breathing as one band"
- Include BPM and time signature from the genre reference
- Focus on: GROOVE (how the rhythm feels), INTERACTION (how parts lock together), FEEL (warm, intimate, energetic)
- Translate Spanish/other languages to English
- NO lyrics, NO singing, NO vocal descriptions — this is INSTRUMENTAL ONLY
- NEVER list instruments separately — always describe them as interacting parts of ONE sound

GOOD examples:
- "romantic bachata groove, nylon guitar melody over syncopated rhythm section, percussion locked with walking bass, all instruments tight as one band, intimate Dominican feel, 130 BPM, studio quality"
- "slow bolero ballad, gentle guitar arpeggios leading while rhythm section pulses underneath, strings sustaining above the groove, all parts breathing together, deeply emotional, 78 BPM"
- "energetic salsa groove, piano montuno driving while percussion and brass lock together in clave, tight big band sound, 180 BPM"

BAD examples (DO NOT produce these):
- "requinto guitar arpeggios, segunda guitar strumming, bongo drums, guira scraping, electric bass" (instrument laundry list — sounds DISORGANIZED)
- "featuring bongos, congas, guitar, piano, strings" (listing parts — NOT describing a band)
- "a beautiful song with vocals singing about love" (has vocals — SAO is instrumental only)

Genre reference: ${genreHints}`
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_completion_tokens: 200,
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
