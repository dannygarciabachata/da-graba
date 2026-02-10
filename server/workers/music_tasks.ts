import Replicate from "replicate";
import { storage } from "../storage";
import { generateWithElevenLabs } from "../core/elevenlabs_engine";
import {
  startSongGeneration,
  pollSongUntilDone,
  buildBachataLyrics,
  buildMurekaPrompt,
} from "../core/mureka_engine";
import { generateCreativeLyrics } from "../core/antigravity_engine";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const AUDIO_DIR = path.join(process.cwd(), "public", "audio");
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

function saveAudioFile(buffer: Buffer, extension: string = "mp3"): string {
  const filename = `${crypto.randomUUID()}.${extension}`;
  const filePath = path.join(AUDIO_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`[Worker] Saved audio file: ${filePath} (${buffer.length} bytes)`);
  return `/audio/${filename}`;
}

async function downloadAndSaveAudio(remoteUrl: string): Promise<string> {
  console.log(`[Worker] Downloading audio from: ${remoteUrl}`);
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = remoteUrl.includes(".wav") ? "wav" : "mp3";
  return saveAudioFile(buffer, ext);
}

function mapStyleToLyricsStyle(style: string): "romantic" | "dance" | "heartbreak" {
  if (style === "bachata-dance") return "dance";
  if (style === "bachata-bolero") return "heartbreak";
  return "romantic";
}

async function generateSmartPrompt(
  finalPrompt: string,
  style: string,
  userLyrics?: string
): Promise<{ enhancedPrompt: string; generatedLyrics: string }> {
  console.log(`[Worker] Using OpenAI to craft lyrics for the song...`);

  let generatedLyrics = userLyrics || "";

  if (!userLyrics) {
    try {
      const lyricsStyle = mapStyleToLyricsStyle(style);
      generatedLyrics = await generateCreativeLyrics(finalPrompt, lyricsStyle);
      console.log(`[Worker] OpenAI generated ${generatedLyrics.length} chars of lyrics`);
    } catch (err: any) {
      console.log(`[Worker] OpenAI lyrics generation failed: ${err.message}, using template lyrics`);
      generatedLyrics = "";
    }
  }

  return { enhancedPrompt: finalPrompt, generatedLyrics };
}

function buildAceStepTags(userPrompt: string, style: string): string {
  const styleTags: Record<string, string> = {
    "heart-mula":
      "bachata, Latin Caribbean, tropical, male vocal, Spanish lyrics, syncopated acoustic guitar strumming pattern, nylon string guitar, lead guitar melody, bongo hand drums, guira shaker percussion, bass guitar groove, warm piano chords, romantic, emotional, intimate, professional Latin production, 130 BPM, D minor",
    "bachata-romantic":
      "bachata, Latin Caribbean, tropical, male vocal, Spanish lyrics, fingerpicked nylon guitar, soft lead guitar melody, bongo hand drums, guira shaker, acoustic bass, tender, emotional, romantic ballad, intimate, warm reverb, professional Latin production, 128 BPM, A minor",
    "bachata-dance":
      "bachata, Latin Caribbean, tropical, male vocal, Spanish lyrics, driving nylon guitar strumming, energetic lead guitar riffs, fast bongo hand drums, loud guira shaker, punchy bass, congas, dance, party, upbeat, high energy, professional Latin production, 140 BPM, C major",
    "bachata-bolero":
      "bachata bolero, Latin Caribbean, tropical, male vocal, Spanish lyrics, slow arpeggiated nylon guitar, crying lead guitar melody, soft bongo brushes, gentle guira, piano ballad chords, deep emotional bass, sorrowful, nostalgic, intimate, professional Latin production, 108 BPM, D minor",
    "trio-serenade":
      "Latin bolero trio, Caribbean serenade, three-part male vocal harmony, Spanish lyrics, requinto lead guitar, two rhythm nylon guitars, romantic, intimate, acoustic, traditional Latin, professional production, 105 BPM, E minor",
    "bachata-urbana":
      "modern bachata, Latin urban, reggaeton fusion, male vocal, Spanish lyrics, electric guitar with reverb and delay, electronic bongo pattern, trap hi-hat rolls, deep 808 sub bass, R&B vocal style, polished contemporary production, 138 BPM, G minor",
  };

  return styleTags[style] || styleTags["heart-mula"];
}

function trimLyricsToFitDuration(lyrics: string, durationSec: number): string {
  const linesPerSection = 4;
  const sectionsFor30s = 2;
  const maxSections = Math.max(sectionsFor30s, Math.floor(durationSec / 20));

  const sections = lyrics.split(/(?=\[(verse|chorus|bridge)\])/gi).filter(s => s.trim());
  if (sections.length <= maxSections) return lyrics;

  const kept = sections.slice(0, maxSections);
  const result = kept.join("\n\n").trim();
  console.log(`[Worker] Trimmed lyrics from ${sections.length} sections to ${maxSections} for ${durationSec}s track`);
  return result;
}

function buildAceStepLyrics(userPrompt: string, style: string, generatedLyrics: string, durationSec: number = 30): string {
  if (generatedLyrics && generatedLyrics.length > 20) {
    let cleaned = generatedLyrics
      .replace(/\*\*[^*]*\*\*/g, "")
      .replace(/^#+\s.*/gm, "")
      .replace(/^\s*[-–—]\s*/gm, "")
      .replace(/\[Verse\s*\d*\]/gi, "[verse]")
      .replace(/\[Chorus\s*\d*\]/gi, "[chorus]")
      .replace(/\[Bridge\s*\d*\]/gi, "[bridge]")
      .replace(/\[Pre-Chorus\s*\d*\]/gi, "[verse]")
      .replace(/\[Intro\s*\d*\]/gi, "[verse]")
      .replace(/\[Outro\s*\d*\]/gi, "[chorus]")
      .replace(/\[Spoken\s*Word[^\]]*\]/gi, "[bridge]")
      .replace(/\[Final\s*Chorus[^\]]*\]/gi, "[chorus]")
      .replace(/\[Hook[^\]]*\]/gi, "[chorus]")
      .replace(/\[Dance\s*Break[^\]]*\]/gi, "[bridge]")
      .replace(/\[Ad[- ]?libs?[^\]]*\]/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s*\n/gm, "")
      .trim();

    const hasStructure = /\[(verse|chorus|bridge)/i.test(cleaned);
    if (hasStructure) return trimLyricsToFitDuration(cleaned, durationSec);
    const lines = cleaned.split("\n").filter(l => l.trim() && l.trim().length > 3);
    if (lines.length >= 4) {
      const maxLines = Math.max(8, Math.floor(durationSec / 4));
      const usedLines = lines.slice(0, maxLines);
      const half = Math.ceil(usedLines.length / 2);
      return `[verse]\n${usedLines.slice(0, half).join("\n")}\n\n[chorus]\n${usedLines.slice(half).join("\n")}`;
    }
  }

  const styleTemplates: Record<string, string> = {
    "heart-mula": `[verse]
Bajo la luna de Santo Domingo
Tu mirada me tiene cautivo
Cada latido es un ritmo que sigo
Heart Mula suena el amor es mi abrigo

[chorus]
Bailamos bachata corazon a corazon
Tu cuerpo y el mio una sola cancion
Heart Mula late con toda la pasion
Eres mi reina mi unica razon

[verse]
En la noche tu voz me acaricia
Como brisa del mar con delicia
Guitarra y bongo te hacen justicia
Y este ritmo convierte en noticia

[chorus]
Bailamos bachata corazon a corazon
Tu cuerpo y el mio una sola cancion
Heart Mula late con toda la pasion
Eres mi reina mi unica razon`,

    "bachata-romantic": `[verse]
En la noche callada te pienso
Tu recuerdo me abraza tan intenso
Las guitarras me cuentan tu historia
Y en cada nota vive tu memoria

[chorus]
Ven a bailar conmigo esta noche
Que la bachata nos une sin reproche
Tu mano en mi mano tu piel en mi piel
Este amor sabe a miel

[verse]
Tus ojos brillan como las estrellas
Iluminan mis noches mas bellas
Con cada paso que damos bailando
Mi corazon se va enamorando

[chorus]
Ven a bailar conmigo esta noche
Que la bachata nos une sin reproche
Tu mano en mi mano tu piel en mi piel
Este amor sabe a miel`,

    "bachata-dance": `[verse]
Suena la guira suena el bongo
La pista se enciende el ritmo es nuestro
Mueve la cintura siente la clave
Esta noche nadie nos para

[chorus]
Dale pa lante bachata en la sangre
Que la noche es joven y el ritmo no pare
Bongo y guitarra fuego en el aire
Esta fiesta es pa gozarla a lo grande

[verse]
Todo el mundo a la pista ahora
Que la bachata suena y enamora
Con los pies en el suelo y el alma volando
Toda la noche seguimos bailando

[chorus]
Dale pa lante bachata en la sangre
Que la noche es joven y el ritmo no pare
Bongo y guitarra fuego en el aire
Esta fiesta es pa gozarla a lo grande`,

    "bachata-bolero": `[verse]
En el silencio de esta noche triste
Recuerdo el dia que te fuiste
Las guitarras lloran tu ausencia
Y mi corazon busca tu presencia

[chorus]
Vuelve a mi mi amor perdido
Que sin ti me siento herido
El bolero canta nuestro dolor
Trae de vuelta nuestro amor

[verse]
Las calles vacias me hablan de ti
Cada esquina un recuerdo de abril
Tu perfume aun vive en mi almohada
Y tu ausencia me deja sin nada

[chorus]
Vuelve a mi mi amor perdido
Que sin ti me siento herido
El bolero canta nuestro dolor
Trae de vuelta nuestro amor`,

    "trio-serenade": `[verse]
Bajo tu ventana vengo a cantar
Con mi requinto y mi guitarra
Las estrellas brillan sobre el mar
Y este trio te entrega su serenata

[chorus]
Escucha mi serenata mi amor
Cada nota lleva mi corazon
Tres voces cantan con fervor
Esta cancion llena de pasion

[verse]
La brisa nocturna lleva mi voz
Hasta tu puerta con toda emocion
Tres guitarras suenan para los dos
Bajo la luna nuestra cancion

[chorus]
Escucha mi serenata mi amor
Cada nota lleva mi corazon
Tres voces cantan con fervor
Esta cancion llena de pasion`,

    "bachata-urbana": `[verse]
En la ciudad las luces brillan
Tu y yo en la calle nadie nos vigila
El beat urbano con guitarra real
Bachata nueva pero original

[chorus]
Somos fuego somos flow
Bachata urbana nuevo sabor
En cada paso siento tu calor
Baby tu eres mi mayor

[verse]
Las noches son nuestras el ritmo tambien
Mezclando lo nuevo con lo que esta bien
Guitarra electrica bajo profundo
Contigo conquistamos el mundo

[chorus]
Somos fuego somos flow
Bachata urbana nuevo sabor
En cada paso siento tu calor
Baby tu eres mi mayor`,
  };

  return styleTemplates[style] || styleTemplates["heart-mula"];
}

async function generateWithReplicate(
  prompt: string,
  duration: number,
  style: string = "heart-mula",
  lyrics: string = ""
): Promise<{ audioUrl: string; provider: "replicate" }> {
  const actualDuration = Math.min(Math.max(duration, 30), 180);
  const tags = buildAceStepTags(prompt, style);
  const aceStepLyrics = buildAceStepLyrics(prompt, style, lyrics, actualDuration);

  console.log(`[Worker] Generating audio with Replicate ACE-Step...`);
  console.log(`[Worker] Tags: ${tags}`);
  console.log(`[Worker] Lyrics (${aceStepLyrics.length} chars): ${aceStepLyrics.substring(0, 200)}...`);

  const input: Record<string, any> = {
    tags,
    lyrics: aceStepLyrics,
    duration: actualDuration,
    number_of_steps: 100,
    guidance_scale: 20,
  };

  const output = await replicate.run(
    "lucataco/ace-step:280fc4f9ee507577f880a167f639c02622421d8fecf492454320311217b688f1",
    { input }
  );

  let audioUrl: string;
  const result = Array.isArray(output) ? output[0] : output;

  console.log(`[Worker] ACE-Step raw output type: ${typeof result}, constructor: ${result?.constructor?.name}`);

  if (result && typeof result === "object" && typeof (result as any).url === "function") {
    audioUrl = String((result as any).url());
  } else if (result && typeof result === "object" && "url" in (result as any)) {
    audioUrl = String((result as any).url);
  } else if (typeof result === "string") {
    audioUrl = result;
  } else {
    audioUrl = String(result);
  }

  console.log(`[Worker] ACE-Step resolved URL: ${audioUrl.substring(0, 120)}...`);

  return { audioUrl, provider: "replicate" };
}

export async function processMusicGeneration(
  songId: number,
  finalPrompt: string,
  options: {
    isBachata?: boolean;
    style?: string;
    duration?: number;
    lyrics?: string;
  } = {}
): Promise<void> {
  const { duration = 30, style = "heart-mula", lyrics } = options;

  try {
    console.log(`[Worker] Starting music generation for song ${songId}`);
    console.log(`[Worker] Prompt (${finalPrompt.length} chars): ${finalPrompt.substring(0, 150)}`);
    console.log(`[Worker] Style: ${style}, Duration: ${duration}s`);

    await storage.updateSongStatus(songId, "processing");

    const { enhancedPrompt, generatedLyrics } = await generateSmartPrompt(
      finalPrompt,
      style,
      lyrics
    );

    console.log(`[Worker] Enhanced prompt: ${enhancedPrompt.substring(0, 200)}...`);
    if (generatedLyrics) {
      console.log(`[Worker] Lyrics ready (${generatedLyrics.length} chars)`);
    }

    let result: { audioUrl: string; provider: string };

    // 1. Try ElevenLabs (full song with vocals + lyrics)
    try {
      console.log(`[Worker] Trying ElevenLabs Music (primary)...`);
      const elResult = await generateWithElevenLabs(finalPrompt, style, {
        lyrics: generatedLyrics || undefined,
        durationMs: Math.max(duration * 1000, 30000),
      });
      const audioUrl = saveAudioFile(elResult.audioBuffer, "mp3");
      result = { audioUrl, provider: "elevenlabs" };
    } catch (elErr: any) {
      const elMsg = elErr.message || "";
      console.log(`[Worker] ElevenLabs unavailable: ${elMsg.substring(0, 120)}`);

      // 2. Try Mureka (full song with vocals)
      try {
        console.log(`[Worker] Trying Mureka AI (secondary)...`);
        const murekaLyrics = generatedLyrics || buildBachataLyrics(finalPrompt, style);
        const murekaPrompt = buildMurekaPrompt(finalPrompt, style);
        const task = await startSongGeneration(murekaLyrics, murekaPrompt, "auto");
        const completed = await pollSongUntilDone(task.id, 300000, 5000);
        if (!completed.choices || completed.choices.length === 0) {
          throw new Error("Mureka returned no audio choices");
        }
        const localUrl = await downloadAndSaveAudio(completed.choices[0].url);
        result = { audioUrl: localUrl, provider: "mureka" };
      } catch (muErr: any) {
        const muMsg = muErr.message || "";
        console.log(`[Worker] Mureka unavailable: ${muMsg.substring(0, 120)}`);

        // 3. Try Replicate ACE-Step (full song with vocals + lyrics)
        try {
          console.log(`[Worker] Using Replicate ACE-Step with lyrics...`);
          const repResult = await generateWithReplicate(enhancedPrompt, duration, style, generatedLyrics);
          const localUrl = await downloadAndSaveAudio(repResult.audioUrl);
          result = { audioUrl: localUrl, provider: "replicate" };
        } catch (repErr: any) {
          throw new Error(
            `All music providers failed. ElevenLabs: ${elMsg.substring(0, 80)}. Mureka: ${muMsg.substring(0, 80)}. Replicate: ${repErr.message?.substring(0, 80)}`
          );
        }
      }
    }

    console.log(`[Worker] Music generated via ${result.provider} for song ${songId}: ${result.audioUrl}`);
    await storage.updateSongStatus(songId, "completed", result.audioUrl);
  } catch (err: any) {
    console.error(`[Worker] Music generation failed for song ${songId}:`, err);
    const errorMessage = err.message || "Generation failed";
    await storage.updateSongStatus(songId, "failed", undefined, errorMessage);
  }
}
