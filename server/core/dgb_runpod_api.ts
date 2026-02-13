import * as fs from "fs";
import * as path from "path";

const AUDIO_BASE_DIR = path.join(process.cwd(), "public", "audio");

function getRunPodApiUrl(): string {
  const base = (process.env.RUNPOD_BASE_URL || "").replace(/\/lab\/.*$/, "").replace(/\/$/, "");
  return base.replace(/:8888$/, ":7860").replace(/-8888\./, "-7860.");
}

function getApiKey(): string {
  return process.env.DGB_API_KEY || "";
}

export function isDgbRunPodApiConfigured(): boolean {
  return !!(process.env.RUNPOD_BASE_URL && process.env.DGB_API_KEY);
}

export async function checkDgbRunPodHealth(): Promise<{ connected: boolean; gpu?: boolean; error?: string }> {
  try {
    const url = `${getRunPodApiUrl()}/api/health`;
    const res = await fetch(url, {
      headers: { "X-DGB-API-Key": getApiKey() },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      return { connected: true, gpu: data.gpu_available };
    }
    return { connected: false, error: `Status ${res.status}` };
  } catch (err: any) {
    return { connected: false, error: err.message };
  }
}

export async function uploadInstrumentToRunPod(
  instrumentId: number,
  kitId: number,
  instrumentName: string,
  audioFilePath: string,
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  const fullPath = path.join(process.cwd(), "public", audioFilePath);
  if (!fs.existsSync(fullPath)) {
    return { success: false, error: `Audio file not found: ${audioFilePath}` };
  }

  try {
    const apiUrl = `${getRunPodApiUrl()}/api/upload-instrument`;

    const FormData = (await import("form-data")).default;
    const form = new FormData();
    form.append("audio", fs.createReadStream(fullPath));
    form.append("instrumentId", String(instrumentId));
    form.append("kitId", String(kitId));
    form.append("instrumentName", instrumentName);
    form.append("webhookUrl", webhookUrl);

    const headers = {
      ...form.getHeaders(),
      "X-DGB-API-Key": getApiKey(),
    };

    const res = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: form as any,
      signal: AbortSignal.timeout(120000),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`[DGB RunPod] Instrument ${instrumentId} uploaded: ${data.message}`);
      return { success: true };
    } else {
      const errText = await res.text();
      return { success: false, error: `Upload failed: ${res.status} ${errText}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveMidiFile(
  midiBase64: string,
  instrumentId: number
): Promise<string> {
  const dir = path.join(AUDIO_BASE_DIR, "midi");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filename = `instrument_${instrumentId}_${Date.now()}.mid`;
  const filePath = path.join(dir, filename);
  const buffer = Buffer.from(midiBase64, "base64");
  fs.writeFileSync(filePath, buffer);

  console.log(`[DGB RunPod] MIDI saved for instrument ${instrumentId}: ${filePath} (${buffer.length} bytes)`);
  return `/audio/midi/${filename}`;
}
