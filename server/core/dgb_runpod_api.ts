import * as fs from "fs";
import * as path from "path";
import type { CloudServer } from "@shared/schema";

const AUDIO_BASE_DIR = path.join(process.cwd(), "public", "audio");

function getEnvFallbackServer(): { baseUrl: string; apiKey: string; webhookSecret: string } | null {
  const base = (process.env.RUNPOD_BASE_URL || "").replace(/\/lab\/.*$/, "").replace(/\/$/, "");
  const apiKey = process.env.DGB_API_KEY || "";
  if (!base || !apiKey) return null;
  const baseUrl = base.replace(/:8888$/, ":7860").replace(/-8888\./, "-7860.");
  return {
    baseUrl,
    apiKey,
    webhookSecret: process.env.TRAINING_WEBHOOK_SECRET || apiKey,
  };
}

interface ResolvedServer {
  baseUrl: string;
  apiKey: string;
  webhookSecret: string;
  authHeaderName: string;
  webhookHeaderName: string;
  healthEndpoint: string;
  uploadEndpoint: string;
  serverId?: number;
}

function resolveFromCloudServer(server: CloudServer): ResolvedServer {
  let baseUrl = server.baseUrl.replace(/\/$/, "");
  if (server.apiPort && !baseUrl.includes(`:${server.apiPort}`)) {
    const url = new URL(baseUrl);
    url.port = String(server.apiPort);
    baseUrl = url.toString().replace(/\/$/, "");
  }
  return {
    baseUrl,
    apiKey: server.apiKey || "",
    webhookSecret: server.webhookSecret || server.apiKey || "",
    authHeaderName: server.authHeaderName || "X-DGB-API-Key",
    webhookHeaderName: server.webhookHeaderName || "X-Webhook-Secret",
    healthEndpoint: server.healthEndpoint || "/api/health",
    uploadEndpoint: server.uploadEndpoint || "/api/upload-instrument",
    serverId: server.id,
  };
}

function resolveFromEnv(): ResolvedServer | null {
  const env = getEnvFallbackServer();
  if (!env) return null;
  return {
    baseUrl: env.baseUrl,
    apiKey: env.apiKey,
    webhookSecret: env.webhookSecret,
    authHeaderName: "X-DGB-API-Key",
    webhookHeaderName: "X-Webhook-Secret",
    healthEndpoint: "/api/health",
    uploadEndpoint: "/api/upload-instrument",
  };
}

export async function getActiveServer(storage: any, capability?: string): Promise<ResolvedServer | null> {
  try {
    const server = await storage.getActiveCloudServer(capability || "instrument_processing");
    if (server) return resolveFromCloudServer(server);
  } catch (err) {
    console.log("[Cloud] DB lookup failed, trying env fallback:", (err as Error).message);
  }
  return resolveFromEnv();
}

export function isDgbCloudConfigured(): boolean {
  return !!(process.env.RUNPOD_BASE_URL && process.env.DGB_API_KEY);
}

export async function isCloudConfigured(storage: any): Promise<boolean> {
  try {
    const server = await storage.getActiveCloudServer("instrument_processing");
    if (server) return true;
  } catch {}
  return isDgbCloudConfigured();
}

export function verifyWebhookSecret(headerValue: string, server?: CloudServer): boolean {
  if (server) {
    const secret = server.webhookSecret || server.apiKey || "";
    return !!secret && headerValue === secret;
  }
  const secret = process.env.TRAINING_WEBHOOK_SECRET || process.env.DGB_API_KEY || "";
  if (!secret) return false;
  return headerValue === secret;
}

export async function verifyWebhookFromAnyServer(headers: Record<string, string | undefined>, storage: any): Promise<boolean> {
  const webhookSecret = headers["x-webhook-secret"] || "";
  const apiKey = headers["x-dgb-api-key"] || "";

  try {
    const servers = await storage.getCloudServers();
    for (const server of servers) {
      if (webhookSecret && server.webhookSecret && webhookSecret === server.webhookSecret) return true;
      if (apiKey && server.apiKey && apiKey === server.apiKey) return true;
    }
  } catch {}

  if (webhookSecret) {
    const envSecret = process.env.TRAINING_WEBHOOK_SECRET || "";
    if (envSecret && webhookSecret === envSecret) return true;
  }
  if (apiKey) {
    const envKey = process.env.DGB_API_KEY || "";
    if (envKey && apiKey === envKey) return true;
  }

  return false;
}

export async function checkCloudHealth(resolved: ResolvedServer): Promise<{ connected: boolean; gpu?: boolean; error?: string }> {
  try {
    const url = `${resolved.baseUrl}${resolved.healthEndpoint}`;
    const res = await fetch(url, {
      headers: { [resolved.authHeaderName]: resolved.apiKey },
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

export async function checkDgbCloudHealth(): Promise<{ connected: boolean; gpu?: boolean; error?: string }> {
  const resolved = resolveFromEnv();
  if (!resolved) return { connected: false, error: "Not configured" };
  return checkCloudHealth(resolved);
}

export async function uploadInstrumentToCloud(
  instrumentId: number,
  kitId: number,
  instrumentName: string,
  audioFilePath: string,
  webhookUrl: string,
  serverOverride?: ResolvedServer
): Promise<{ success: boolean; error?: string }> {
  const fullPath = path.join(process.cwd(), "public", audioFilePath);
  if (!fs.existsSync(fullPath)) {
    return { success: false, error: `Audio file not found: ${audioFilePath}` };
  }

  const resolved = serverOverride || resolveFromEnv();
  if (!resolved) {
    return { success: false, error: "No cloud server configured" };
  }

  try {
    const apiUrl = `${resolved.baseUrl}${resolved.uploadEndpoint}`;

    const FormData = (await import("form-data")).default;
    const form = new FormData();
    form.append("audio", fs.createReadStream(fullPath));
    form.append("instrumentId", String(instrumentId));
    form.append("kitId", String(kitId));
    form.append("instrumentName", instrumentName);
    form.append("webhookUrl", webhookUrl);

    const headers = {
      ...form.getHeaders(),
      [resolved.authHeaderName]: resolved.apiKey,
    };

    const res = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: form as any,
      signal: AbortSignal.timeout(120000),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`[Cloud] Instrument ${instrumentId} uploaded: ${data.message}`);
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

  console.log(`[Cloud] MIDI saved for instrument ${instrumentId}: ${filePath} (${buffer.length} bytes)`);
  return `/audio/midi/${filename}`;
}
