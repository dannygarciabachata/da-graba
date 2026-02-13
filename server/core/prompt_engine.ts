export const MUSIC_PROMPT = `
SYSTEM ROLE:
You are DGB STUDIO Heart Mula Music Engine.

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
    "romantic Dominican Bachata, nylon guitar, bongo, guira, emotional male vocals in Spanish, Latin dance, 128 BPM, A minor",
  "bachata-dance":
    "upbeat Dominican Bachata, driving nylon guitar, fast bongo, guira, congas, male vocals in Spanish, Latin dance party, 140 BPM, C major",
  "bachata-bolero":
    "slow Bachata Bolero, arpeggiated nylon guitar, piano, soft bongo, emotional male vocals in Spanish, nostalgic Latin, 108 BPM, D minor",
  "trio-serenade":
    "Latin Bolero Trio Serenade, requinto guitar, nylon guitars, male vocal harmony in Spanish, acoustic intimate, 105 BPM, E minor",
  "heart-mula":
    "Dominican Bachata, passionate, nylon guitar, bongo drums, guira, emotional male vocals in Spanish, Latin dance rhythm, 130 BPM, D minor",
  "bachata-urbana":
    "modern Urban Bachata, electric guitar, bongo, trap hi-hats, 808 bass, R&B male vocals in Spanish, contemporary Latin, 138 BPM, G minor",
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
    romantic: `You are DGB STUDIO Heart Mula Music Engine — a legendary Bachata songwriter channeling Romeo Santos, Prince Royce, and the golden era of Dominican romance.
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

    dance: `You are DGB STUDIO Heart Mula Music Engine — an upbeat Bachata hitmaker in the spirit of Aventura and Grupo Extra.
Write fun, flirty, irresistible party lyrics in Spanish with catchy Spanglish hooks.
The lyrics should pull people to the dance floor and never let go.
Include call-and-response chants, rhythmic repetition, and singalong moments.
${formatRules}`,

    heartbreak: `You are DGB STUDIO Heart Mula Music Engine — an emotionally devastating songwriter in the tradition of Frank Reyes, El Principe de la Bachata.
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
  instruments: { name: string; type: string; description?: string | null }[]
): string {
  const instrumentNames = instruments.map((i) => i.name).join(", ");
  const genreLabel = genre.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  let prompt = `${userPrompt}, ${genreLabel} style, ${kitName}: ${instrumentNames}, studio quality`;

  if (prompt.length > 290) {
    prompt = `${userPrompt}, ${genreLabel}, ${kitName}, studio quality`;
  }
  if (prompt.length > 290) {
    prompt = `${userPrompt}, ${genreLabel}, studio quality`;
  }
  if (prompt.length > 290) {
    prompt = prompt.substring(0, 287) + "...";
  }

  return prompt;
}

export async function generateStructuredPrompt(userInput: string): Promise<MusicPromptConfig> {
  const isBachata = /bachata|bongo|guira|dominican|latino|requinto|heart mula/i.test(userInput);
  const isDance = /dance|party|fiesta|bailable|upbeat/i.test(userInput);
  const isSad = /sad|triste|heartbreak|llorar|dolor|cry/i.test(userInput);

  let mood = "emotional, intimate, nostalgic";
  let tempo = "128";
  let key = "Am";
  let dynamics = "Gradual build from soft intro to emotional peak at final chorus, gentle fade. All instruments play as a tight cohesive ensemble.";

  if (isDance) {
    mood = "energetic, fun, party";
    tempo = "140";
    key = "C";
    dynamics = "High energy throughout with tight ensemble groove, build to dance break, instruments locked together";
  } else if (isSad) {
    mood = "melancholic, sorrowful, deep";
    tempo = "108";
    key = "Dm";
    dynamics = "Start intimate and soft, instruments enter gradually and blend together, raw emotional peak at bridge";
  }

  return {
    genre: isBachata ? "Bachata / Latin Trio" : "Latin Pop / Bachata Fusion",
    mood,
    tempo: `${tempo} BPM`,
    key,
    structure: [
      "Intro - requinto solo with light guitar (4 bars)",
      "Verse 1 - guitar rhythm + bass + light bongo groove (8 bars)",
      "Chorus - full ensemble playing together cohesively (8 bars)",
      "Instrumental - requinto + piano melodic interplay (8 bars)",
      "Verse 2 - guitar rhythm + bass variation (8 bars)",
      "Chorus - emotional peak, all instruments balanced (8 bars)",
      "Outro - fade with guitar arpeggios (4 bars)",
    ],
    instrumentation: [
      "Acoustic guitar (rhythmic foundation)",
      "Requinto (melodic lead in breaks only)",
      "Piano (harmonic support pads)",
      "Bass (warm groove, locked with bongo)",
      "Bongo + Guira (steady rhythm section)",
    ],
    dynamics,
    notes: userInput,
  };
}
