import Replicate from "replicate";
import { storage } from "../storage";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const AUDIO_DIR = path.join(process.cwd(), "public", "audio", "stems");
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

const STEM_TYPES = [
  { type: "vocals", name: "Vocals", icon: "mic" },
  { type: "drums", name: "Drums", icon: "drum" },
  { type: "bass", name: "Bass", icon: "bass" },
  { type: "other", name: "Other / Melody", icon: "music" },
] as const;

async function downloadStemFile(remoteUrl: string, stemType: string): Promise<string> {
  console.log(`[Stems] Downloading ${stemType} stem from: ${remoteUrl}`);
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Failed to download stem: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = `${crypto.randomUUID()}_${stemType}.wav`;
  const filePath = path.join(AUDIO_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`[Stems] Saved ${stemType} stem: ${filePath} (${buffer.length} bytes)`);
  return `/audio/stems/${filename}`;
}

export async function processStemSeparation(
  songId: number,
  audioUrl: string,
  userId: string
): Promise<void> {
  console.log(`[Stems] Starting stem separation for song ${songId}`);

  const trackRecords = [];
  for (const stem of STEM_TYPES) {
    const track = await storage.createTrack({
      songId,
      userId,
      name: stem.name,
      type: stem.type,
      volume: 100,
      isMuted: false,
      isSolo: false,
    });
    trackRecords.push(track);
  }

  try {
    const fullAudioUrl = audioUrl.startsWith("http")
      ? audioUrl
      : `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000"}${audioUrl}`;

    console.log(`[Stems] Sending to Demucs: ${fullAudioUrl}`);

    const output = await replicate.run(
      "cjwbw/demucs:25a173108cff36ef9f80f854c162d01df9e6528be175794b81158fa03836d953",
      {
        input: {
          audio: fullAudioUrl,
          model: "htdemucs",
          stem: "all",
        },
      }
    );

    console.log(`[Stems] Demucs output:`, JSON.stringify(output).substring(0, 500));

    const stemOutput = output as Record<string, string>;

    for (const trackRecord of trackRecords) {
      const stemUrl = stemOutput[trackRecord.type];
      if (stemUrl) {
        try {
          const localUrl = await downloadStemFile(stemUrl, trackRecord.type);
          await storage.updateTrackStatus(trackRecord.id, "completed", localUrl);
          console.log(`[Stems] ${trackRecord.type} stem completed: ${localUrl}`);
        } catch (dlErr: any) {
          console.error(`[Stems] Failed to download ${trackRecord.type}:`, dlErr.message);
          await storage.updateTrackStatus(trackRecord.id, "failed", undefined, dlErr.message);
        }
      } else {
        await storage.updateTrackStatus(trackRecord.id, "failed", undefined, "Stem not found in output");
      }
    }

    console.log(`[Stems] Stem separation completed for song ${songId}`);
  } catch (err: any) {
    console.error(`[Stems] Stem separation failed for song ${songId}:`, err.message);
    for (const track of trackRecords) {
      await storage.updateTrackStatus(track.id, "failed", undefined, err.message);
    }
  }
}

export { STEM_TYPES };
