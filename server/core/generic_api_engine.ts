import { storage } from "../storage";
import type { ApiProvider, ApiEndpoint, OperationType } from "@shared/schema";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const AUDIO_BASE_DIR = path.join(process.cwd(), "public", "audio");

export interface GenericSubmitResult {
  success: boolean;
  taskId?: string;
  conversionId?: string;
  eta?: number;
  audioUrl?: string;
  imageUrl?: string;
  data?: Record<string, any>;
  raw: any;
}

export interface GenericPollResult {
  status: string;
  audioUrl?: string;
  imageUrl?: string;
  vocalsUrl?: string;
  accompanimentUrl?: string;
  dominantKey?: string;
  keyChanges?: Record<string, string[]>;
  bpm?: number;
  outputFile?: string;
  data?: Record<string, any>;
  raw: any;
}

function resolveApiKey(provider: ApiProvider): string {
  if (provider.apiKeyEnvVar) {
    const envVal = process.env[provider.apiKeyEnvVar];
    if (envVal) return envVal;
  }
  if (provider.apiKeyValue) return provider.apiKeyValue;
  throw new Error(`No API key configured for provider "${provider.name}"`);
}

function buildAuthHeaders(provider: ApiProvider): Record<string, string> {
  const headers: Record<string, string> = {};
  
  if (provider.authType === "none") return headers;

  const apiKey = resolveApiKey(provider);
  const headerName = provider.authHeaderName || "Authorization";

  switch (provider.authType) {
    case "bearer":
      headers[headerName] = `Bearer ${apiKey}`;
      break;
    case "raw":
      headers[headerName] = apiKey;
      break;
    case "header":
      headers[headerName] = apiKey;
      break;
    default:
      headers[headerName] = apiKey;
  }

  if (provider.defaultHeaders) {
    Object.assign(headers, provider.defaultHeaders);
  }

  return headers;
}

function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== "object") {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function applyRequestMapping(
  mapping: Record<string, any> | null | undefined,
  inputParams: Record<string, any>
): Record<string, any> {
  if (!mapping) return inputParams;

  const result: Record<string, any> = {};

  for (const [apiParamName, mappingValue] of Object.entries(mapping)) {
    let resolvedValue: any = undefined;

    if (typeof mappingValue === "string") {
      if (mappingValue.startsWith("$")) {
        const inputKey = mappingValue.substring(1);
        if (inputParams[inputKey] !== undefined) {
          resolvedValue = inputParams[inputKey];
        }
      } else if (mappingValue.startsWith("@env:")) {
        const envKey = mappingValue.substring(5);
        const envVal = process.env[envKey];
        if (envVal) resolvedValue = envVal;
      } else {
        resolvedValue = mappingValue;
      }
    } else {
      resolvedValue = mappingValue;
    }

    if (resolvedValue !== undefined) {
      if (apiParamName.includes(".")) {
        setNestedValue(result, apiParamName, resolvedValue);
      } else {
        result[apiParamName] = resolvedValue;
      }
    }
  }

  for (const [key, value] of Object.entries(inputParams)) {
    if (!(key in result) && value !== undefined && value !== null) {
      if (!Object.keys(mapping).some(k => k === key || k.startsWith(key + "."))) {
        result[key] = value;
      }
    }
  }

  return result;
}

function extractFromResponse(
  responseMapping: Record<string, string> | null | undefined,
  rawResponse: any
): Record<string, any> {
  if (!responseMapping) return rawResponse;

  const result: Record<string, any> = {};

  for (const [internalKey, responsePath] of Object.entries(responseMapping)) {
    const value = getNestedValue(rawResponse, responsePath);
    if (value !== undefined) {
      result[internalKey] = value;
    }
  }

  return result;
}

function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

export async function submitGenericJob(
  operationType: OperationType,
  inputParams: Record<string, any>
): Promise<GenericSubmitResult> {
  const endpointConfig = await storage.getApiEndpointByOperation(operationType);

  if (!endpointConfig || !endpointConfig.provider) {
    throw new Error(`NO_PROVIDER: No active API provider configured for operation "${operationType}"`);
  }

  const { provider } = endpointConfig;
  const endpoint = endpointConfig as ApiEndpoint;

  console.log(`[GenericAPI:${operationType}] Using provider "${provider.name}" endpoint "${endpoint.name}"`);

  const headers = buildAuthHeaders(provider);
  const mappedParams = applyRequestMapping(endpoint.requestMapping, inputParams);

  const url = `${provider.baseUrl}${endpoint.path}`;

  let requestBody: any;
  if (endpoint.contentType === "json") {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(mappedParams);
  } else {
    const formData = new FormData();
    for (const [key, value] of Object.entries(mappedParams)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }
    requestBody = formData;
  }

  console.log(`[GenericAPI:${operationType}] ${endpoint.method} ${url} (${endpoint.contentType})`);
  console.log(`[GenericAPI:${operationType}] Params: ${Object.keys(mappedParams).join(", ")}`);

  const response = await fetch(url, {
    method: endpoint.method || "POST",
    headers,
    body: requestBody,
  });

  if (!response.ok) {
    let errorMsg = `API error: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMsg = errorData?.message || errorData?.error || JSON.stringify(errorData);
    } catch {
      const text = await response.text().catch(() => "");
      if (text) errorMsg = text.substring(0, 300);
    }
    console.error(`[GenericAPI:${operationType}] Error ${response.status}: ${errorMsg}`);

    if (response.status === 401 || response.status === 403) {
      throw new Error(`AUTH_ERROR: Invalid API key for ${provider.name}`);
    }
    if (response.status === 402) {
      throw new Error(`QUOTA_EXCEEDED: Insufficient credits for ${provider.name}`);
    }
    throw new Error(`API_ERROR: ${errorMsg}`);
  }

  const rawData = await response.json();
  const extracted = extractFromResponse(endpoint.responseMapping, rawData);

  console.log(`[GenericAPI:${operationType}] Response: task_id=${rawData.task_id || "N/A"}, success=${rawData.success}`);

  return {
    success: rawData.success !== false,
    taskId: extracted.taskId || rawData.task_id,
    conversionId: extracted.conversionId || rawData.conversion_id,
    eta: extracted.eta || rawData.eta,
    audioUrl: extracted.audioUrl || rawData.audio_url,
    imageUrl: extracted.imageUrl || rawData.image_url,
    data: extracted,
    raw: rawData,
  };
}

export async function pollGenericJob(
  operationType: OperationType,
  taskId: string,
  timeoutMs: number = 600000,
  intervalMs: number = 8000
): Promise<GenericPollResult> {
  const endpointConfig = await storage.getApiEndpointByOperation(operationType);

  if (!endpointConfig || !endpointConfig.provider) {
    throw new Error(`NO_PROVIDER: No active API provider configured for polling "${operationType}"`);
  }

  const { provider } = endpointConfig;
  const endpoint = endpointConfig as ApiEndpoint;

  if (endpoint.asyncPattern === "none") {
    return {
      status: "COMPLETED",
      raw: {},
    };
  }

  const headers = buildAuthHeaders(provider);
  const startTime = Date.now();
  let currentInterval = intervalMs;

  const pollPath = endpoint.pollPath || "/byId";
  let pollUrl: string;

  if (pollPath.includes("{taskId}")) {
    pollUrl = `${provider.baseUrl}${pollPath.replace("{taskId}", encodeURIComponent(taskId))}`;
  } else {
    pollUrl = `${provider.baseUrl}${pollPath}?task_id=${encodeURIComponent(taskId)}`;
    if (endpoint.conversionType) {
      pollUrl += `&conversionType=${encodeURIComponent(endpoint.conversionType)}`;
    }
  }

  console.log(`[GenericAPI:${operationType}] Polling ${pollUrl} (timeout: ${timeoutMs / 1000}s)`);

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(pollUrl, {
        method: endpoint.pollMethod || "GET",
        headers,
      });

      if (!response.ok) {
        console.log(`[GenericAPI:${operationType}] Poll response ${response.status}, retrying...`);
        await sleep(currentInterval);
        continue;
      }

      const rawData = await response.json();
      const extracted = extractFromResponse(endpoint.pollResponseMapping, rawData);

      const conversion = rawData.conversion || rawData;
      const rawStatus = (extracted.status || conversion.status || "").toUpperCase();

      const normalizedStatus = rawStatus === "SUCCEEDED" ? "COMPLETED" : rawStatus;

      console.log(`[GenericAPI:${operationType}] Task ${taskId} status: ${normalizedStatus}`);

      if (normalizedStatus === "COMPLETED") {
        const audioUrl = extracted.audioUrl || conversion.audio_url || conversion.conversion_path || conversion.conversion_path_wav || conversion.output_file;

        return {
          status: "COMPLETED",
          audioUrl: audioUrl || undefined,
          imageUrl: extracted.imageUrl || conversion.image_url,
          vocalsUrl: extracted.vocalsUrl || conversion.vocals_url,
          accompanimentUrl: extracted.accompanimentUrl || conversion.accompaniment_url,
          dominantKey: extracted.dominantKey || conversion.dominant_key,
          keyChanges: extracted.keyChanges || conversion.key_changes,
          bpm: extracted.bpm || conversion.bpm,
          outputFile: extracted.outputFile || conversion.output_file,
          data: extracted,
          raw: rawData,
        };
      }

      if (normalizedStatus === "FAILED" || normalizedStatus === "ERROR" || normalizedStatus === "CANCELED") {
        throw new Error(`Job failed: ${conversion.status_msg || rawData.error || extracted.error || "Unknown error"}`);
      }
    } catch (err: any) {
      if (err.message.includes("Job failed")) throw err;
      console.log(`[GenericAPI:${operationType}] Poll error (will retry): ${err.message?.substring(0, 100)}`);
    }

    await sleep(currentInterval);

    const elapsed = Date.now() - startTime;
    if (elapsed > timeoutMs / 2) {
      currentInterval = Math.min(currentInterval * 1.5, 15000);
    }
  }

  throw new Error(`Job timed out after ${timeoutMs / 1000}s`);
}

export function getWebhookUrl(): string {
  const appDomain = process.env.APP_DOMAIN || process.env.REPLIT_DEV_DOMAIN;
  const base = appDomain
    ? (appDomain.startsWith("http") ? appDomain : `https://${appDomain}`)
    : "http://localhost:5000";
  return `${base.replace(/\/$/, "")}/api/webhooks/musicgpt`;
}

export async function downloadFile(
  remoteUrl: string,
  subdir: string,
  label: string
): Promise<string> {
  const dir = path.join(AUDIO_BASE_DIR, subdir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`[GenericAPI] Downloading ${label} from: ${remoteUrl.substring(0, 120)}`);
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${label}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = remoteUrl.includes(".wav") ? ".wav" : remoteUrl.includes(".png") ? ".png" : remoteUrl.includes(".jpg") ? ".jpg" : ".mp3";
  const filename = `${crypto.randomUUID()}_${label}${ext}`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);

  console.log(`[GenericAPI] Saved ${label}: ${filePath} (${buffer.length} bytes)`);
  return `/audio/${subdir}/${filename}`;
}

export function resolveFullAudioUrl(localUrl: string): string {
  if (localUrl.startsWith("http")) return localUrl;
  const appDomain = process.env.APP_DOMAIN || process.env.REPLIT_DEV_DOMAIN;
  const base = appDomain
    ? (appDomain.startsWith("http") ? appDomain : `https://${appDomain}`)
    : "http://localhost:5000";
  return `${base.replace(/\/$/, "")}${localUrl}`;
}

export async function hasProviderForOperation(operationType: OperationType): Promise<boolean> {
  const config = await storage.getApiEndpointByOperation(operationType);
  return !!config;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
