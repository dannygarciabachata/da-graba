export const MUSIC_PROMPT = `
SYSTEM ROLE:
You are DGB STUDIO Creative Engine.

TASK:
Generate structured musical instructions in JSON.
This music will be rendered by an AI audio engine.

STYLE: Romantic Latin Trio / Bachata Bolero
MOOD: Emotional, intimate, nostalgic
TEMPO: 70–85 BPM
KEY: Minor preferred

INSTRUMENTS:
- Acoustic guitars (main)
- Requinto (intro & instrumental break)
- Piano (soft harmony)
- Bass (warm, subtle)
- Percussion (bongos, guira, conga, timbal as light ornaments)

STRUCTURE:
1. Intro – requinto solo
2. Verse – guitars + bass
3. Chorus – full harmony
4. Instrumental – requinto + piano
5. Chorus – emotional peak
6. Outro – fade with guitar

OUTPUT FORMAT (JSON):
{
  "genre": "",
  "mood": "",
  "tempo": "",
  "key": "",
  "structure": [],
  "instrumentation": [],
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
  notes: string;
}

export const PROMPT_VERSIONS: Record<string, string> = {
  "bachata-romantic": "Dominican bachata guitar, requinto solo intro, bongo, guira, conga, smooth bassline, piano soft harmony, romantic emotional intimate, 75 BPM, minor key, high fidelity, studio quality",
  "bachata-dance": "Dominican bachata guitar, fast guira pattern, bongo slap, conga rhythm, energetic bassline, piano montuno, upbeat party dance, 90 BPM, major key, high fidelity",
  "bachata-bolero": "Romantic Latin Trio, requinto guitar intro, acoustic guitars main, soft piano harmony, warm subtle bass, bongos guira conga timbal light ornaments, emotional intimate nostalgic, 75 BPM, minor key, high fidelity",
  "trio-serenade": "Mexican trio style, requinto lead, classical guitars, romantic serenade, bolero rhythm, 70 BPM, minor key, intimate recording, high fidelity",
};

export function buildMusicGenPrompt(userPrompt: string, style: string = "bachata-romantic"): string {
  const baseDescriptors = PROMPT_VERSIONS[style] || PROMPT_VERSIONS["bachata-romantic"];
  return `${userPrompt}, ${baseDescriptors}`;
}

export function buildLyricsSystemPrompt(style: "romantic" | "dance" | "heartbreak"): string {
  const styleGuides: Record<string, string> = {
    romantic: `You are a legendary Bachata songwriter in the style of Romeo Santos and Prince Royce. 
Write deeply romantic lyrics in Spanish with some Spanglish phrases. 
The lyrics should evoke passion, tenderness, and longing.
Use metaphors about the night, the stars, and the warmth of a lover's embrace.
Structure: Verse 1 (8 lines), Chorus (4 lines), Verse 2 (8 lines), Chorus (4 lines), Bridge (4 lines), Final Chorus (4 lines).`,
    
    dance: `You are an upbeat Bachata songwriter in the style of Aventura and Grupo Extra.
Write fun, flirty party lyrics in Spanish with Spanglish hooks.
The lyrics should make people want to dance and sing along.
Include catchy repetitive phrases and call-and-response sections.
Structure: Intro Hook (2 lines), Verse 1 (6 lines), Chorus (4 lines), Verse 2 (6 lines), Chorus (4 lines), Dance Break Chant (4 lines), Final Chorus (4 lines).`,
    
    heartbreak: `You are an emotionally profound Bachata songwriter in the style of Frank Reyes (El Principe de la Bachata).
Write deeply sorrowful lyrics in Spanish about lost love, betrayal, or heartbreak.
The lyrics should bring tears and deep emotion.
Use vivid imagery of rain, empty rooms, fading memories, and broken promises.
Structure: Verse 1 (8 lines), Chorus (4 lines), Verse 2 (8 lines), Chorus (4 lines), Spoken Word Bridge (4 lines), Final Chorus with Ad-libs (6 lines).`,
  };

  return styleGuides[style] || styleGuides.romantic;
}

export async function generateStructuredPrompt(userInput: string): Promise<MusicPromptConfig> {
  const isBachata = /bachata|bongo|guira|dominican|latino|requinto/i.test(userInput);
  const isDance = /dance|party|fiesta|bailable|upbeat/i.test(userInput);
  const isSad = /sad|triste|heartbreak|llorar|dolor|cry/i.test(userInput);

  let mood = "emotional, intimate, nostalgic";
  let tempo = "75";
  let key = "Am";

  if (isDance) {
    mood = "energetic, fun, party";
    tempo = "90";
    key = "C";
  } else if (isSad) {
    mood = "melancholic, sorrowful, deep";
    tempo = "70";
    key = "Dm";
  }

  return {
    genre: isBachata ? "Bachata / Latin Trio" : "Latin Pop / Bachata Fusion",
    mood,
    tempo: `${tempo} BPM`,
    key,
    structure: [
      "Intro - requinto solo",
      "Verse - guitars + bass",
      "Chorus - full harmony",
      "Instrumental - requinto + piano",
      "Chorus - emotional peak",
      "Outro - fade with guitar",
    ],
    instrumentation: [
      "Acoustic guitars (main)",
      "Requinto (intro & instrumental break)",
      "Piano (soft harmony)",
      "Bass (warm, subtle)",
      "Bongos", "Guira", "Conga", "Timbal (light ornaments)",
    ],
    notes: userInput,
  };
}
