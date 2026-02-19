export const MUSIC_PROMPT = `
SYSTEM ROLE:
You are DAGRABA STUDIO Music Engine.

TASK:
Generate a cohesive, professionally arranged and mixed Bachata song.
All instruments must play together as a tight ensemble — not separately.

STYLE: Romantic Dominican Bachata
MOOD: Emotional, intimate, nostalgic
TEMPO: 105–140 BPM
KEY: Minor preferred

ARRANGEMENT RULES:
- Guitar provides the rhythmic foundation — consistent strumming or fingerpicking pattern throughout
- Requinto plays melodic lead ONLY during intro and instrumental breaks, otherwise silent
- Bass locks with the bongo to form the rhythmic backbone
- Bongo and guira maintain a steady groove — never overpower the guitars
- Piano adds subtle harmonic pads, NOT competing melodies
- All instruments follow the SAME chord progression and tempo

MIXING:
- Guitar and vocals are front and center
- Percussion (bongo, guira) sits behind the guitars in the mix
- Bass is warm and felt, not boomy
- Requinto solos are featured but blend back when vocals enter
- Professional studio production, balanced stereo mix

STRUCTURE:
1. Intro – requinto solo with light guitar (4 bars)
2. Verse 1 – guitar rhythm + bass + light bongo (8 bars)
3. Chorus – full ensemble, all instruments playing together cohesively (8 bars)
4. Instrumental – requinto + piano melodic interplay (8 bars)
5. Verse 2 – guitar rhythm + bass, slight variation (8 bars)
6. Chorus – emotional peak, layered but balanced (8 bars)
7. Outro – gentle fade, guitar arpeggios (4 bars)

OUTPUT FORMAT (JSON):
{
  "genre": "",
  "mood": "",
  "tempo": "",
  "key": "",
  "structure": [],
  "instrumentation": [],
  "dynamics": "",
  "notes": ""
}
`;

export interface MusicPromptConfig {
  genre: string;
  mood: string;
  tempo: string;
  key: string;
  structure: string[];
  instrumentation: string[];
  dynamics?: string;
  notes: string;
}

export const PROMPT_VERSIONS: Record<string, string> = {
  "bachata-romantic":
    "romantic Dominican bachata, tight guitar-driven Latin groove, warm and intimate feel, smooth rhythm section locked together, professional studio quality, 128 BPM, A minor",
  "bachata-dance":
    "upbeat Dominican bachata, energetic Latin dance groove, driving rhythm with tight percussion, lively and fun feel, polished mix, 140 BPM, C major",
  "bachata-bolero":
    "slow bachata bolero, gentle and emotional Latin ballad, soft guitar arpeggios with warm piano, dreamy intimate atmosphere, cohesive arrangement, 108 BPM, D minor",
  "trio-serenade":
    "Latin bolero trio serenade, intimate acoustic guitar ensemble with vocal harmony, warm romantic feel, tight acoustic arrangement, 105 BPM, E minor",
  "heart-mula":
    "passionate Dominican bachata, emotional Latin groove with warm guitar rhythm, tight band playing together, romantic and intense, 130 BPM, D minor",
  "bachata-urbana":
    "modern urban bachata, contemporary Latin R&B fusion, polished production with electronic elements and guitar, tight modern groove, 138 BPM, G minor",
};

export function buildMusicGenPrompt(userPrompt: string, style: string = "bachata-romantic"): string {
  const baseDescriptors = PROMPT_VERSIONS[style] || PROMPT_VERSIONS["bachata-romantic"];
  return `${userPrompt}, ${baseDescriptors}`;
}

export function buildLyricsSystemPrompt(style: "romantic" | "dance" | "heartbreak"): string {
  const formatRules = `

CRITICAL OUTPUT FORMAT RULES:
- Use ONLY these section markers on their own line: [verse], [chorus], [bridge]
- Section markers must be lowercase in square brackets exactly like: [verse] or [chorus] or [bridge]
- Do NOT number sections (no [Verse 1], no [Chorus 2])
- Do NOT use markdown formatting (no **, no ##, no bullet points)
- Do NOT include section descriptions like "(8 lines)" — just the lyrics
- Write EXACTLY 4 lines per section, each line is one short singable phrase
- Keep each line SHORT (under 12 words) so it fits naturally into the rhythm
- Write ONLY 4 sections total: [verse], [chorus], [verse], [chorus]
- Write lyrics ONLY — no titles, no explanations, no notes
- Language: Spanish with natural Spanglish phrases`;

  const styleGuides: Record<string, string> = {
    romantic: `You are DAGRABA STUDIO Music Engine — a legendary Bachata songwriter channeling Romeo Santos, Prince Royce, and the golden era of Dominican romance.
Write deeply romantic lyrics in Spanish with Spanglish phrases woven naturally.
The lyrics should evoke passion, tenderness, and yearning — like a whispered confession under Caribbean moonlight.
Use metaphors about the night sky, ocean waves, the warmth of a lover's skin, and the ache of distance.
${formatRules}

Example output format:
[verse]
Bajo la luna te pienso mi amor
Tu recuerdo me abraza el corazón
Las guitarras me cuentan tu historia
Y en cada nota vive tu memoria

[chorus]
Ven a bailar conmigo esta noche
Que la bachata nos une sin reproche
Tu mano en mi mano tu piel en mi piel
Este amor sabe a miel

[verse]
Tus ojos brillan como las estrellas
Iluminan mis noches más bellas
Con cada paso que damos bailando
Mi corazón se va enamorando

[chorus]
Ven a bailar conmigo esta noche
Que la bachata nos une sin reproche
Tu mano en mi mano tu piel en mi piel
Este amor sabe a miel`,

    dance: `You are DAGRABA STUDIO Music Engine — an upbeat Bachata hitmaker in the spirit of Aventura and Grupo Extra.
Write fun, flirty, irresistible party lyrics in Spanish with catchy Spanglish hooks.
The lyrics should pull people to the dance floor and never let go.
Include call-and-response chants, rhythmic repetition, and singalong moments.
${formatRules}`,

    heartbreak: `You are DAGRABA STUDIO Music Engine — an emotionally devastating songwriter in the tradition of Frank Reyes, El Principe de la Bachata.
Write deeply sorrowful lyrics in Spanish about lost love, betrayal, or the ghost of someone who left.
The lyrics should bring tears — raw, unfiltered, deeply human.
Paint vivid imagery: rain on empty streets, unanswered phone calls, fading perfume on a pillow, broken promises echoing in silence.
${formatRules}`,
  };

  return styleGuides[style] || styleGuides.romantic;
}

export function buildStyleKitPrompt(
  userPrompt: string,
  kitName: string,
  genre: string,
  instruments: { name: string; type: string; description?: string | null; generatedPrompt?: string | null }[],
  kitData?: { trainingPrompt?: string | null; description?: string | null }
): string {
  const genreLabel = genre.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const instrumentNames = instruments
    .map(i => i.generatedPrompt || i.name)
    .join(", ");

  const styleHint = kitData?.trainingPrompt || kitData?.description || "";
  const moodMatch = styleHint.match(/mood[s]?[:=]\s*([^.|\n]+)/i);
  const bpmMatch = styleHint.match(/(\d{2,3})\s*BPM/i);
  const keyMatch = styleHint.match(/(?:key|set in)\s*:?\s*([A-G][#b]?\s*(?:Minor|Major|minor|major))/i);

  const moods = moodMatch ? moodMatch[1].trim() : "warm, professional";
  const bpmPart = bpmMatch ? ` at ${bpmMatch[1]} BPM` : "";
  const keyPart = keyMatch ? `Set in ${keyMatch[1]}` : "";
  const technicalPart = keyPart && bpmPart ? `${keyPart}${bpmPart}` : keyPart ? keyPart : bpmPart ? `${bpmPart.trim()}` : "";

  let prompt = `Format: Band | Subgenre: ${genreLabel} ${kitName} | Instruments: ${instrumentNames} | Moods: ${moods}${technicalPart ? ` | ${technicalPart}` : ""}, professional studio recording`;

  if (prompt.length > 500) {
    const shortInstruments = instruments.slice(0, 5).map(i => i.name).join(", ");
    prompt = `Format: Band | Subgenre: ${genreLabel} | Instruments: ${shortInstruments} | Moods: ${moods}${technicalPart ? ` | ${technicalPart}` : ""}, studio quality`;
  }
  if (prompt.length > 500) {
    prompt = prompt.substring(0, 497) + "...";
  }

  return prompt;
}

export async function generateStructuredPrompt(userInput: string): Promise<MusicPromptConfig> {
  const isBachata = /bachata|bongo|guira|dominican|latino|requinto|heart mula/i.test(userInput);
  const isBolero = /bolero|ballad|slow.*romantic/i.test(userInput);
  const isSalsa = /salsa|montuno|tumbao/i.test(userInput);
  const isDance = /dance|party|fiesta|bailable|upbeat/i.test(userInput);
  const isSad = /sad|triste|heartbreak|llorar|dolor|cry/i.test(userInput);

  let mood = "romantic, warm, intimate";
  let tempo = "130";
  let key = "D Minor";
  let dynamics = "Intro with requinto melody, verse builds with full rhythm section, chorus at full intensity, instrumental break, emotional outro fade";

  if (isBolero) {
    mood = "deeply emotional, intimate, sorrowful";
    tempo = "75";
    key = "A Minor";
    dynamics = "Soft intro with guitar arpeggios, gradual string entry, emotional peak at bridge with full orchestra, gentle fade";
  } else if (isSalsa) {
    mood = "energetic, fiery, danceable";
    tempo = "180";
    key = "B-flat Major";
    dynamics = "Driving montuno intro, brass hits on chorus, percussion break, high-energy coda";
  } else if (isDance) {
    mood = "energetic, festive, joyful";
    tempo = "140";
    key = "C Major";
    dynamics = "High energy intro, build through verse, explosive chorus, dance break with percussion";
  } else if (isSad) {
    mood = "melancholic, sorrowful, deeply emotional";
    tempo = "78";
    key = "D Minor";
    dynamics = "Intimate soft intro, instruments enter gradually, raw emotional peak at bridge, gentle heartbreaking outro";
  }

  return {
    genre: isBolero ? "Bolero" : isSalsa ? "Salsa" : isBachata ? "Bachata" : "Latin Pop",
    mood,
    tempo: `${tempo} BPM`,
    key,
    structure: [
      "Intro - melodic lead with light accompaniment (4 bars)",
      "Verse 1 - full rhythm section enters (8 bars)",
      "Chorus - full band at intensity peak (8 bars)",
      "Instrumental break - solo/melodic interplay (8 bars)",
      "Verse 2 - rhythm variation (8 bars)",
      "Chorus - emotional peak, full arrangement (8 bars)",
      "Outro - melodic fade (4 bars)",
    ],
    instrumentation: isBolero ? [
      "Nylon requinto guitar (arpeggios melody)",
      "Nylon segunda guitar (harmonic rhythm)",
      "Upright bass (quarter note pulse)",
      "Grand piano (chord voicings)",
      "Violin and cello strings (legato sustain)",
      "Soft bongo drums (subtle rhythm)",
    ] : isSalsa ? [
      "Grand piano (montuno pattern)",
      "Trumpet section (melody and hits)",
      "Trombone (harmonic support)",
      "Timbales and congas (driving rhythm)",
      "Upright bass (tumbao pattern)",
    ] : [
      "Nylon requinto guitar (melodic lead)",
      "Nylon segunda guitar (rhythmic strumming)",
      "Bongo drums (derecho pattern)",
      "Guira (metallic pulse)",
      "Electric bass (walking line)",
    ],
    dynamics,
    notes: userInput,
  };
}
