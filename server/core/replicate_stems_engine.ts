import Replicate from "replicate";
import { downloadFile } from "./generic_api_engine";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export interface ReplicateStemsResult {
  success: boolean;
  stems: Record<string, string>;
  error?: string;
}

export function canUseReplicate(): boolean {
  return !!process.env.REPLICATE_API_TOKEN;
}

export async function separateStemsWithReplicate(
  audioUrl: string,
  songId: number
): Promise<ReplicateStemsResult> {
  console.log(`[ReplicateStems] Starting stem separation for song ${songId}`);
  console.log(`[ReplicateStems] Audio URL: ${audioUrl}`);

  try {
    const output = await replicate.run(
      "cjwbw/demucs:07afda2a068a69bafe901cd1e6a41e5e6e1c8fe8b101c89eb06488e7e38e1d56" as `${string}/${string}:${string}`,
      {
        input: {
          audio: audioUrl,
          model: "htdemucs",
          mp3: true,
          mp3_bitrate: 320,
        },
      }
    );

    console.log(`[ReplicateStems] Raw output:`, JSON.stringify(output).substring(0, 500));

    const stems: Record<string, string> = {};

    if (output && typeof output === "object") {
      const out = output as Record<string, any>;
      if (out.vocals) stems.vocals = String(out.vocals);
      if (out.drums) stems.drums = String(out.drums);
      if (out.bass) stems.bass = String(out.bass);
      if (out.other) stems.instrumental = String(out.other);
    }

    if (Object.keys(stems).length === 0) {
      return { success: false, stems: {}, error: "No stems returned from Replicate" };
    }

    console.log(`[ReplicateStems] Got stems: ${Object.keys(stems).join(", ")}`);

    const localStems: Record<string, string> = {};
    for (const [stemType, remoteUrl] of Object.entries(stems)) {
      try {
        const localUrl = await downloadFile(remoteUrl, "stems", `${songId}_${stemType}`);
        localStems[stemType] = localUrl;
        console.log(`[ReplicateStems] Downloaded ${stemType}: ${localUrl}`);
      } catch (dlErr: any) {
        console.error(`[ReplicateStems] Failed to download ${stemType}:`, dlErr.message);
      }
    }

    if (Object.keys(localStems).length === 0) {
      return { success: false, stems: {}, error: "All stem downloads failed" };
    }

    return { success: true, stems: localStems };
  } catch (err: any) {
    console.error(`[ReplicateStems] Error:`, err.message);
    return { success: false, stems: {}, error: err.message };
  }
}
