import { storage } from "../storage";
import { generateWithMusicGPT } from "../core/musicgpt_engine";
import { generateCreativeLyrics } from "../core/antigravity_engine";
import fs from "fs";
import path from "path";
import crypto from "crypto";

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

    // MusicGPT only - sole music generation provider
    console.log(`[Worker] Generating with MusicGPT...`);
    const mgptResult = await generateWithMusicGPT(finalPrompt, style, {
      lyrics: generatedLyrics || undefined,
      duration,
    });
    const localUrl = await downloadAndSaveAudio(mgptResult.audioUrl);
    result = { audioUrl: localUrl, provider: "musicgpt" };

    console.log(`[Worker] Music generated via ${result.provider} for song ${songId}: ${result.audioUrl}`);
    await storage.updateSongStatus(songId, "completed", result.audioUrl);
  } catch (err: any) {
    console.error(`[Worker] Music generation failed for song ${songId}:`, err);
    const errorMessage = err.message || "Generation failed";
    await storage.updateSongStatus(songId, "failed", undefined, errorMessage);
  }
}
