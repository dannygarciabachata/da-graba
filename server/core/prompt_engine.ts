export const MUSIC_PROMPT = `
SYSTEM ROLE:
You are DGB STUDIO Heart Mula Music Engine.

TASK:
Generate a cohesive, professionally arranged and mixed Bachata song.
All instruments must play together as a tight ensemble — not separately.

STYLE: Romantic Dominican Bachata
MOOD: Emotional, intimate, nostalgic
TEMPO: 70–85 BPM
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
    "romantic Dominican bachata, tight acoustic guitar rhythm, requinto melody, bongo and guira groove locked together, smooth bass, soft piano chords, professionally mixed and balanced, cohesive ensemble, 75 BPM, A minor",
  "bachata-dance":
    "upbeat Dominican bachata, driving guitar strumming, guira and bongo locked in groove, conga accents, energetic bass, piano montuno fills, tight ensemble, well-mixed, 90 BPM, C major",
  "bachata-bolero":
    "slow bachata bolero, gentle acoustic guitar arpeggios, requinto crying melody, soft piano harmony, warm bass, gentle bongo keeping time, intimate and cohesive, professionally produced, 70 BPM, D minor",
  "trio-serenade":
    "Latin trio serenade, requinto lead guitar with two rhythm guitars in harmony, romantic bolero feel, tight three-guitar arrangement, balanced mix, 70 BPM, E minor",
  "heart-mula":
    "emotional Dominican bachata, acoustic guitar fingerpicking as foundation, requinto melody over top, bongo and guira locked rhythm, piano pads, warm bass groove, all instruments playing together as one cohesive band, professionally mixed, 72 BPM, D minor",
  "bachata-urbana":
    "modern urban bachata, electric guitar with reverb as lead, Dominican bongo and guira blended with subtle trap hi-hats, deep 808 bass, R&B vocal style, polished modern production, well-balanced mix, 85 BPM, G minor",
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
  let dynamics = "Gradual build from soft intro to emotional peak at final chorus, gentle fade. All instruments play as a tight cohesive ensemble.";

  if (isDance) {
    mood = "energetic, fun, party";
    tempo = "90";
    key = "C";
    dynamics = "High energy throughout with tight ensemble groove, build to dance break, instruments locked together";
  } else if (isSad) {
    mood = "melancholic, sorrowful, deep";
    tempo = "70";
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
