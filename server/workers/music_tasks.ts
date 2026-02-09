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

async function generateWithReplicate(
  prompt: string,
  duration: number
): Promise<{ audioUrl: string; provider: "replicate" }> {
  console.log(`[Worker] Generating audio with Replicate MusicGen...`);

  const output = await replicate.run(
    "meta/musicgen:b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38",
    {
      input: {
        model_version: "stereo-melody-large",
        prompt,
        duration,
      },
    }
  );

  const audioUrl = typeof output === "string" ? output : (output as any)?.audio || String(output);
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
    console.log(`[Worker] User prompt: ${finalPrompt}`);
    console.log(`[Worker] Style: ${style}`);

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

        // 3. Try Replicate (instrumental with OpenAI-enhanced prompt)
        try {
          console.log(`[Worker] Using Replicate MusicGen with AI-enhanced prompt...`);
          const repResult = await generateWithReplicate(enhancedPrompt, duration);
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
