import OpenAI from "openai";
import type { StyleKit, StyleKitInstrument } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const INSTRUMENT_PROMPT_SYSTEM = `You are an expert audio engineer creating training prompts for a music AI model (Stable Audio Open).

Your task: Convert structured audio metadata into a short, descriptive paragraph that reads like a prompt a human would write to generate that instrument sound.

The prompt will be paired with the audio to fine-tune a generative music model, so the description must accurately reflect the metadata.

Rules:
1. If genre tags are provided, include one or two genres, not all
2. If acousticness/energy values are provided (0-1 scale): mention "acoustic" if acousticness > 0.7, "energetic" if energy > 0.7, "chill/quiet" if energy < 0.3
3. Always include the musical key, mode, and BPM if available (e.g., "in the key of G Major at 134 BPM")
4. Always list the instruments present
5. Use adjectives, not verbs. Not a question, not instructions
6. Keep it cohesive and short - not a list of parameters
7. Write what a human would say describing the track's vibe, style, and instrumentation

Output ONLY the prompt text, no explanations.

Examples:
- "A groovy blend of 70s pop, funk and jazz, with soul vibes, featuring a fingered electric bass and drums. Set in the key of F Major at 107 BPM, this track exudes a cool energy."
- "A smooth and relaxing Rhodes Piano cover in the key of F Major at 120 BPM. This rendition captures a chill 80s jazz vibe with a touch of Bossa Nova influence."
- "A moody indie track in D# Minor at 112 BPM featuring electric clean guitar, plucked electric bass, and drums. With elements of indie pop and bedroom pop, this song captures a chill and introspective vibe."`;

export interface InstrumentAnalysis {
  key?: string;
  mode?: string;
  bpm?: number;
  energy?: number;
  acousticness?: number;
  durationMs?: number;
  tags?: string[];
  instrumentName?: string;
  instrumentType?: string;
}

export interface TrainingConfig {
  model_type: string;
  sample_rate: number;
  audio_channels: number;
  dataset: {
    type: string;
    instruments: Array<{
      id: number;
      name: string;
      type: string;
      audioUrl: string;
      prompt: string;
      metadata: InstrumentAnalysis;
    }>;
  };
  training: {
    learning_rate: number;
    batch_size: number;
    epochs: number;
    use_ema: boolean;
    demo_every: number;
    demo_prompts: string[];
  };
  kit: {
    id: number;
    name: string;
    genre: string;
    description: string;
  };
}

export async function generateInstrumentPrompt(
  instrument: StyleKitInstrument,
  kitGenre: string
): Promise<string> {
  const metadata: Record<string, any> = {
    instrument_name: instrument.name,
    instrument_type: instrument.type,
    genre: kitGenre,
  };

  if (instrument.detectedKey) metadata.key = instrument.detectedKey;
  if (instrument.detectedBpm) metadata.tempo = instrument.detectedBpm;
  if (instrument.detectedEnergy !== null && instrument.detectedEnergy !== undefined)
    metadata.energy = instrument.detectedEnergy;
  if (instrument.detectedTags) {
    try {
      metadata.tags = JSON.parse(instrument.detectedTags);
    } catch {
      metadata.tags = instrument.detectedTags.split(",").map((t: string) => t.trim());
    }
  }
  if (instrument.durationMs) metadata.duration_ms = instrument.durationMs;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: INSTRUMENT_PROMPT_SYSTEM },
      { role: "user", content: JSON.stringify(metadata) },
    ],
    max_completion_tokens: 200,
  });

  return completion.choices[0].message.content?.trim() || `A ${kitGenre} ${instrument.type} instrument sample.`;
}

export async function generateKitTrainingPrompt(
  kit: StyleKit,
  instruments: StyleKitInstrument[]
): Promise<string> {
  const instrumentNames = instruments.map(i => i.name).join(", ");
  const instrumentTypes = Array.from(new Set(instruments.map(i => i.type))).join(", ");
  const keys = instruments.filter(i => i.detectedKey).map(i => i.detectedKey);
  const bpms = instruments.filter(i => i.detectedBpm).map(i => i.detectedBpm);

  const metadata: Record<string, any> = {
    kit_name: kit.name,
    genre: kit.genre,
    description: kit.description,
    instruments: instrumentNames,
    instrument_types: instrumentTypes,
    instrument_count: instruments.length,
  };

  if (keys.length > 0) metadata.detected_keys = keys;
  if (bpms.length > 0) metadata.detected_bpms = bpms;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `You are creating a master training prompt for an instrument kit used to fine-tune a music AI model. 
Describe the overall sound palette, genre characteristics, and musical identity of this kit in 2-3 sentences.
This prompt will guide the AI model during training to understand the musical context.
Output ONLY the prompt text.`,
      },
      { role: "user", content: JSON.stringify(metadata) },
    ],
    max_completion_tokens: 200,
  });

  return completion.choices[0].message.content?.trim() || `A ${kit.genre} instrument kit with ${instruments.length} instruments.`;
}

function resolveAudioUrl(audioUrl: string): string {
  if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
    return audioUrl;
  }
  const replitDomains = process.env.REPLIT_DOMAINS?.split(",")[0];
  const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;
  const domain = replitDomains || replitDevDomain;
  if (domain) {
    const base = domain.startsWith("http") ? domain : `https://${domain}`;
    return `${base.replace(/\/$/, "")}${audioUrl}`;
  }
  return `http://localhost:5000${audioUrl}`;
}

export function buildTrainingConfig(
  kit: StyleKit,
  instruments: StyleKitInstrument[]
): TrainingConfig {
  const readyInstruments = instruments.filter(i => i.audioUrl && i.generatedPrompt);

  const demoPrompts = readyInstruments
    .slice(0, 3)
    .map(i => i.generatedPrompt || `A ${kit.genre} ${i.type} instrument.`);

  return {
    model_type: "diffusion_cond",
    sample_rate: 44100,
    audio_channels: 2,
    dataset: {
      type: "audio_dir",
      instruments: readyInstruments.map(i => ({
        id: i.id,
        name: i.name,
        type: i.type,
        audioUrl: resolveAudioUrl(i.audioUrl!),
        prompt: i.generatedPrompt!,
        metadata: {
          key: i.detectedKey || undefined,
          bpm: i.detectedBpm || undefined,
          energy: i.detectedEnergy || undefined,
          durationMs: i.durationMs || undefined,
          instrumentName: i.name,
          instrumentType: i.type,
          tags: i.detectedTags ? (() => {
            try { return JSON.parse(i.detectedTags!); } catch { return i.detectedTags!.split(","); }
          })() : undefined,
        },
      })),
    },
    training: {
      learning_rate: 5e-5,
      batch_size: 1,
      epochs: 100,
      use_ema: true,
      demo_every: 1000,
      demo_prompts: demoPrompts,
    },
    kit: {
      id: kit.id,
      name: kit.name,
      genre: kit.genre,
      description: kit.description || "",
    },
  };
}

export function buildRunPodPayload(
  kit: StyleKit,
  instruments: StyleKitInstrument[],
  webhookUrl: string
): Record<string, any> {
  const config = buildTrainingConfig(kit, instruments);

  return {
    input: {
      action: "train",
      kit_id: kit.id,
      training_config: config,
      webhook_url: webhookUrl,
      callback_on: ["completed", "failed"],
    },
    webhook: webhookUrl,
  };
}

export const GENRE_STYLE_HINTS: Record<string, string> = {
  bachata: "Dominican bachata ensemble — requinto nylon guitar (melodic picking, arpeggios), segunda guitarra (syncopated rhythm strumming), bongó (derecho pattern, hand-played), güira metálica (scraping pulse), bajo eléctrico (walking lines), optional: piano, pad, violines, chelos. Tight cohesive band, warm romantic feel, 125-135 BPM, 4/4",
  bachata_tradicional: "Bachata tradicional dominicana — requinto melodic nylon with phrasing ornaments, segunda syncopated strumming, bongó derecho, güira metálica scraping, bajo eléctrico walking bass. Classic Dominican intimate sound, 130 BPM, 4/4",
  bachata_moderna: "Bachata moderna fusion — requinto over contemporary voicings, segunda with modern feel, bongó groove, güira, bajo with funk influence, pad atmospherics, violin strings. R&B-influenced production, 125 BPM, 4/4",
  bachata_sensual: "Bachata sensual — soft requinto arpeggios, gentle segunda, subtle bongó, light güira shimmer, prominent bass, warm pad layers, smooth violin strings. Slow intimate atmosphere, 115 BPM, 4/4",
  bachata_urbana: "Bachata urbana — requinto with effects, segunda over modern production, bongó electronic enhancement, punchy bass, synth pad, trap-influenced. Contemporary urban Latin, 120 BPM, 4/4",
  bachata_rosa: "Bachata rosa — delicate requinto melodic lines, soft segunda, gentle bongó, warm bass, lush violines y chelos, piano embellishments. Dreamy romantic ballad, 120 BPM, 4/4",
  bolero: "Bolero ensemble — expressive requinto (arpeggios, tremolo, vibrato), segunda warm support, soft bongó brushwork, conga gentle warmth, piano rich voicings, violines y chelos lush orchestral strings, pad atmosphere. Deeply emotional and intimate, 75-85 BPM, 4/4",
  bolero_romantico: "Bolero romántico clásico — requinto expressive tremolo, segunda harmonic support, soft bongó y conga, piano rich chords, full orchestral violines y chelos, pad. Intimate deeply emotional ballad, 75 BPM, 4/4",
  bolero_moderno: "Bolero moderno — requinto melodic phrasing, segunda support, piano elegant voicings, cinematic string section, atmospheric pad layers. Contemporary production maintaining romantic essence, 80 BPM, 4/4",
  dgb_bolero: "DGB Bolero complete orchestra — bongó, conga, güira, timbal completo, campanas, segunda guitarra, requinto, bajo, piano, pad, strings (violines + chelos). Danny Garcia signature sound with full vocal harmonies. Rich emotional depth, 78 BPM, 4/4",
  salsa: "Salsa dura — trompetas bright brass, piano montuno/guajeos, timbales cascara y campana, congas tumbaos y slaps, bajo contundente tumbao. Fania sound, clave 2-3, 180 BPM",
  salsa_romantica: "Salsa romántica — piano delicado, conga suave, timbal con escobillas, bajo melodic, violines lush strings, trompeta soft melody. Emotional salsera ballad, 160 BPM",
  merengue: "Merengue típico perico ripiao — acordeón de botones rapid melodic runs, tambora de madera derecho pattern, güira metálica rápida, bajo. Fast festive dance, 160 BPM, 2/4",
  merengue_tipico: "Merengue típico cibaeño — acordeón botones paseos, tambora madera, güira rápida, bajo. Authentic perico ripiao, 160 BPM, 2/4",
  merengue_de_salon: "Merengue de salón — orquesta completa, sección de cuerdas, metales, piano, percusión latina, arreglos sofisticados. Elegant ballroom, 140 BPM",
  cumbia: "Colombian cumbia — acordeón melodic phrases, guacharaca scraping rhythm, caja vallenata hand drums, bajo walking tropical bass. Warm festive groove, 100 BPM, 4/4",
  reggaeton: "Reggaetón — deep 808 sub-bass, crisp hi-hats trap rolls, synth leads catchy hooks, pad atmospherics. Dembow rhythm, 90-95 BPM",
  son: "Son cubano — tres guajeos y montunos, bongó martillo, claves 3-2, contrabajo walking, trumpet accents. Warm Havana groove, 110 BPM",
  latin_pop: "Latin pop — piano melodic hooks, guitarra acústica fingerpicked arpeggios, percusión suave, bajo melódico, pad warmth. Radio-ready, 120 BPM",
  vallenato: "Vallenato — acordeón expressive paseos, caja vallenata, guacharaca, bajo warm foundation. Romantic Colombian Caribbean, 120 BPM",
  tropical: "Tropical Latin — warm percussion with brass accents, melodic hooks, festive Caribbean groove. Professional Latin production, 120 BPM",
};

export const PIPELINE_STEPS = ["upload", "analyze", "prompt", "train", "ready"] as const;
export type PipelineStep = typeof PIPELINE_STEPS[number];

export function getNextPipelineStep(current: string): PipelineStep | null {
  const idx = PIPELINE_STEPS.indexOf(current as PipelineStep);
  if (idx < 0 || idx >= PIPELINE_STEPS.length - 1) return null;
  return PIPELINE_STEPS[idx + 1];
}
