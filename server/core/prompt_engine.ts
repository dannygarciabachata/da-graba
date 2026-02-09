export const MUSIC_PROMPT = `
SYSTEM ROLE:
You are DGB STUDIO Heart Mula Music Engine.

TASK:
Generate structured musical instructions suitable for AI rendering.
This music will be rendered by an AI audio engine with high fidelity output.

STYLE: Romantic Latin Trio / Bachata Bolero
MOOD: Emotional, intimate, nostalgic
TEMPO: 70–85 BPM
KEY: Minor preferred

INSTRUMENTS:
- Acoustic guitars (main rhythm & arpeggios)
- Requinto (intro solos & instrumental breaks)
- Piano (soft harmonic pads & fills)
- Bass (warm, subtle, grounding the groove)
- Bongos (rhythmic drive, fills)
- Guira (signature metallic pulse)
- Conga (accents & counter-rhythms)
- Timbal (light ornamental rolls)

STRUCTURE:
1. Intro – requinto solo (4 bars, rubato feel)
2. Verse 1 – guitars + bass (8 bars, establishing groove)
3. Chorus – full harmony, all instruments (8 bars, emotional lift)
4. Instrumental – requinto + piano duet (8 bars, melodic peak)
5. Verse 2 – guitars + bass, slight variation (8 bars)
6. Chorus – emotional peak, layered harmonies (8 bars)
7. Outro – fade with guitar arpeggios + requinto whisper (4 bars)

DYNAMICS:
- Build intensity gradually from Intro to Chorus
- Instrumental break should feel like a musical conversation
- Final chorus should hit the emotional peak before the gentle fade

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
  "bachata-romantic": "romantic Dominican bachata, acoustic guitar, requinto melody, bongo, guira, smooth bass, piano, 75 BPM, A minor",
  "bachata-dance": "upbeat Dominican bachata, fast guitar strumming, guira, bongo slap, conga, energetic bass, piano montuno, 90 BPM, C major",
  "bachata-bolero": "slow bachata bolero, acoustic guitar arpeggios, requinto, soft piano chords, warm bass, gentle bongo, 70 BPM, D minor",
  "trio-serenade": "Latin trio serenade, requinto lead guitar, classical guitars, romantic bolero rhythm, 70 BPM, E minor",
  "heart-mula": "emotional Dominican bachata, acoustic guitar fingerpicking, requinto melody, bongo rhythm, guira, piano, warm bass, 72 BPM, D minor",
  "bachata-urbana": "modern urban bachata, electric guitar with reverb, Dominican percussion, trap hi-hats, 808 bass, R&B style, 85 BPM, G minor",
};

export function buildMusicGenPrompt(userPrompt: string, style: string = "bachata-romantic"): string {
  const baseDescriptors = PROMPT_VERSIONS[style] || PROMPT_VERSIONS["bachata-romantic"];
  return `${userPrompt}, ${baseDescriptors}`;
}

export function buildLyricsSystemPrompt(style: "romantic" | "dance" | "heartbreak"): string {
  const styleGuides: Record<string, string> = {
    romantic: `You are DGB STUDIO Heart Mula Music Engine — a legendary Bachata songwriter channeling Romeo Santos, Prince Royce, and the golden era of Dominican romance.
Write deeply romantic lyrics in Spanish with Spanglish phrases woven naturally.
The lyrics should evoke passion, tenderness, and yearning — like a whispered confession under Caribbean moonlight.
Use metaphors about the night sky, ocean waves, the warmth of a lover's skin, and the ache of distance.
Structure: Verse 1 (8 lines), Chorus (4 lines), Verse 2 (8 lines), Chorus (4 lines), Bridge (4 lines), Final Chorus (4 lines).`,
    
    dance: `You are DGB STUDIO Heart Mula Music Engine — an upbeat Bachata hitmaker in the spirit of Aventura and Grupo Extra.
Write fun, flirty, irresistible party lyrics in Spanish with catchy Spanglish hooks.
The lyrics should pull people to the dance floor and never let go.
Include call-and-response chants, rhythmic repetition, and singalong moments.
Structure: Intro Hook (2 lines), Verse 1 (6 lines), Chorus (4 lines), Verse 2 (6 lines), Chorus (4 lines), Dance Break Chant (4 lines), Final Chorus (4 lines).`,
    
    heartbreak: `You are DGB STUDIO Heart Mula Music Engine — an emotionally devastating songwriter in the tradition of Frank Reyes, El Principe de la Bachata.
Write deeply sorrowful lyrics in Spanish about lost love, betrayal, or the ghost of someone who left.
The lyrics should bring tears — raw, unfiltered, deeply human.
Paint vivid imagery: rain on empty streets, unanswered phone calls, fading perfume on a pillow, broken promises echoing in silence.
Structure: Verse 1 (8 lines), Chorus (4 lines), Verse 2 (8 lines), Chorus (4 lines), Spoken Word Bridge (4 lines), Final Chorus with Ad-libs (6 lines).`,
  };

  return styleGuides[style] || styleGuides.romantic;
}

export async function generateStructuredPrompt(userInput: string): Promise<MusicPromptConfig> {
  const isBachata = /bachata|bongo|guira|dominican|latino|requinto|heart mula/i.test(userInput);
  const isDance = /dance|party|fiesta|bailable|upbeat/i.test(userInput);
  const isSad = /sad|triste|heartbreak|llorar|dolor|cry/i.test(userInput);

  let mood = "emotional, intimate, nostalgic";
  let tempo = "75";
  let key = "Am";
  let dynamics = "Gradual build from soft intro to emotional peak at final chorus, gentle fade";

  if (isDance) {
    mood = "energetic, fun, party";
    tempo = "90";
    key = "C";
    dynamics = "High energy throughout, build to dance break, maintain intensity";
  } else if (isSad) {
    mood = "melancholic, sorrowful, deep";
    tempo = "70";
    key = "Dm";
    dynamics = "Start intimate and soft, build emotional weight through verses, raw peak at bridge";
  }

  return {
    genre: isBachata ? "Bachata / Latin Trio" : "Latin Pop / Bachata Fusion",
    mood,
    tempo: `${tempo} BPM`,
    key,
    structure: [
      "Intro - requinto solo (4 bars, rubato)",
      "Verse 1 - guitars + bass (8 bars)",
      "Chorus - full harmony (8 bars)",
      "Instrumental - requinto + piano duet (8 bars)",
      "Verse 2 - guitars + bass variation (8 bars)",
      "Chorus - emotional peak (8 bars)",
      "Outro - fade with guitar arpeggios (4 bars)",
    ],
    instrumentation: [
      "Acoustic guitars (main)",
      "Requinto (intro & instrumental break)",
      "Piano (soft harmony)",
      "Bass (warm, subtle)",
      "Bongos", "Guira", "Conga", "Timbal (light ornaments)",
    ],
    dynamics,
    notes: userInput,
  };
}
