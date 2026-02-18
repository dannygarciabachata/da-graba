const RUNPOD_API_KEY = () => process.env.RUNPOD_API_KEY || "";

const BASE_URL = "https://api.runpod.ai/v2";

function extractEndpointId(raw: string): string {
  if (!raw) return "";
  const match = raw.match(/\/v2\/([a-zA-Z0-9]+)\/?$/);
  if (match) {
    console.log(`[RunPod] Extracted endpoint ID '${match[1]}' from full URL`);
    return match[1];
  }
  if (/^[a-zA-Z0-9]+$/.test(raw)) return raw;
  console.warn(`[RunPod] WARNING: Unexpected endpoint format: '${raw}'. Expected either a plain ID or full URL.`);
  return raw;
}

const RUNPOD_ENDPOINT_MUSIC = () => extractEndpointId(process.env.RUNPOD_ENDPOINT_MUSIC || "");
const RUNPOD_ENDPOINT_TRAINING = () => extractEndpointId(process.env.RUNPOD_ENDPOINT_TRAINING || "");
const RUNPOD_ENDPOINT_STEMS = () => extractEndpointId(process.env.RUNPOD_ENDPOINT_STEMS || "");

export interface ServerlessJobResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT";
  output?: any;
  error?: string;
  delayTime?: number;
  executionTime?: number;
}

export interface ServerlessHealthResponse {
  jobs: {
    completed: number;
    failed: number;
    inProgress: number;
    inQueue: number;
    retried: number;
  };
  workers: {
    idle: number;
    initializing: number;
    ready: number;
    running: number;
    throttled: number;
    unhealthy: number;
  };
}

function getHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${RUNPOD_API_KEY()}`,
  };
}

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export function isServerlessConfigured(type: "music" | "training" | "stems" = "music"): boolean {
  if (!RUNPOD_API_KEY()) return false;
  switch (type) {
    case "music": return !!RUNPOD_ENDPOINT_MUSIC();
    case "training": return !!RUNPOD_ENDPOINT_TRAINING();
    case "stems": return !!RUNPOD_ENDPOINT_STEMS();
  }
}

export function getEndpointId(type: "music" | "training" | "stems"): string {
  switch (type) {
    case "music": return RUNPOD_ENDPOINT_MUSIC();
    case "training": return RUNPOD_ENDPOINT_TRAINING();
    case "stems": return RUNPOD_ENDPOINT_STEMS();
  }
}

export async function submitJob(
  endpointType: "music" | "training" | "stems",
  input: Record<string, any>,
  webhook?: string
): Promise<ServerlessJobResponse> {
  const endpointId = getEndpointId(endpointType);
  if (!endpointId) {
    throw new Error(`RunPod Serverless endpoint not configured for: ${endpointType}`);
  }

  const url = `${BASE_URL}/${endpointId}/run`;
  const body: Record<string, any> = { input };
  if (webhook) {
    body.webhook = webhook;
  }

  console.log(`[RunPod Serverless] Submitting ${endpointType} job to ${endpointId}`);

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  }, 30000);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RunPod Serverless submit failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  console.log(`[RunPod Serverless] Job submitted: ${data.id} (status: ${data.status})`);
  return data;
}

export async function submitSyncJob(
  endpointType: "music" | "training" | "stems",
  input: Record<string, any>
): Promise<ServerlessJobResponse> {
  const endpointId = getEndpointId(endpointType);
  if (!endpointId) {
    throw new Error(`RunPod Serverless endpoint not configured for: ${endpointType}`);
  }

  const url = `${BASE_URL}/${endpointId}/runsync`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ input }),
  }, 90000);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RunPod Serverless sync failed (${res.status}): ${errText}`);
  }

  return res.json();
}

export async function getJobStatus(
  endpointType: "music" | "training" | "stems",
  jobId: string
): Promise<ServerlessJobResponse> {
  const endpointId = getEndpointId(endpointType);
  if (!endpointId) {
    throw new Error(`RunPod Serverless endpoint not configured for: ${endpointType}`);
  }

  const url = `${BASE_URL}/${endpointId}/status/${jobId}`;

  const res = await fetchWithTimeout(url, {
    method: "GET",
    headers: getHeaders(),
  }, 15000);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RunPod Serverless status check failed (${res.status}): ${errText}`);
  }

  return res.json();
}

export async function pollJobUntilDone(
  endpointType: "music" | "training" | "stems",
  jobId: string,
  timeoutMs: number = 120000,
  intervalMs: number = 3000
): Promise<ServerlessJobResponse> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await getJobStatus(endpointType, jobId);
    if (status.status === "COMPLETED" || status.status === "FAILED" || status.status === "CANCELLED" || status.status === "TIMED_OUT") {
      return status;
    }
    console.log(`[RunPod Poll] Job ${jobId}: ${status.status}, waiting ${intervalMs}ms...`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return { id: jobId, status: "TIMED_OUT", error: `Polling timeout after ${timeoutMs / 1000}s` };
}

export async function cancelJob(
  endpointType: "music" | "training" | "stems",
  jobId: string
): Promise<ServerlessJobResponse> {
  const endpointId = getEndpointId(endpointType);
  if (!endpointId) {
    throw new Error(`RunPod Serverless endpoint not configured for: ${endpointType}`);
  }

  const url = `${BASE_URL}/${endpointId}/cancel/${jobId}`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: getHeaders(),
  }, 15000);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RunPod Serverless cancel failed (${res.status}): ${errText}`);
  }

  return res.json();
}

export async function checkHealth(
  endpointType: "music" | "training" | "stems"
): Promise<{ connected: boolean; healthy: boolean; workers: number; queued: number; unhealthy: number; error?: string }> {
  const endpointId = getEndpointId(endpointType);
  if (!endpointId) {
    return { connected: false, healthy: false, workers: 0, queued: 0, unhealthy: 0, error: `Endpoint not configured for: ${endpointType}` };
  }

  try {
    const url = `${BASE_URL}/${endpointId}/health`;
    console.log(`[RunPod Health] Checking ${endpointType}: ${url}`);
    const res = await fetchWithTimeout(url, {
      method: "GET",
      headers: getHeaders(),
    }, 10000);

    if (!res.ok) {
      return { connected: false, healthy: false, workers: 0, queued: 0, unhealthy: 0, error: `Status ${res.status}` };
    }

    const data: ServerlessHealthResponse = await res.json();
    const readyWorkers = (data.workers?.idle || 0) + (data.workers?.ready || 0) + (data.workers?.running || 0);
    const initializingWorkers = data.workers?.initializing || 0;
    const unhealthyWorkers = data.workers?.unhealthy || 0;
    const queued = data.jobs?.inQueue || 0;
    const isHealthy = readyWorkers > 0;

    console.log(`[RunPod Health] ${endpointType}: ready=${readyWorkers} initializing=${initializingWorkers} unhealthy=${unhealthyWorkers} queued=${queued} healthy=${isHealthy}`);

    return {
      connected: true,
      healthy: isHealthy,
      workers: readyWorkers,
      queued,
      unhealthy: unhealthyWorkers,
    };
  } catch (err: any) {
    console.error(`[RunPod Health] ${endpointType} check failed: ${err.message}`);
    return { connected: false, healthy: false, workers: 0, queued: 0, unhealthy: 0, error: err.message };
  }
}

export async function purgeQueue(
  endpointType: "music" | "training" | "stems"
): Promise<{ purged: number; error?: string }> {
  const endpointId = getEndpointId(endpointType);
  if (!endpointId) {
    return { purged: 0, error: `Endpoint not configured for: ${endpointType}` };
  }

  try {
    const url = `${BASE_URL}/${endpointId}/purge-queue`;
    console.log(`[RunPod] Purging queue for ${endpointType}: ${url}`);
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: getHeaders(),
    }, 15000);

    if (!res.ok) {
      const errText = await res.text();
      return { purged: 0, error: `Status ${res.status}: ${errText}` };
    }

    const data = await res.json();
    console.log(`[RunPod] Queue purged for ${endpointType}:`, data);
    return { purged: data.removed || data.purged || 0 };
  } catch (err: any) {
    return { purged: 0, error: err.message };
  }
}

export async function getEndpointConfig(): Promise<{
  endpointId: string;
  gpuIds: string;
  maxWorkers: number;
  minWorkers: number;
  idleTimeout: number;
  error?: string;
}> {
  const endpointId = RUNPOD_ENDPOINT_MUSIC();
  if (!endpointId) {
    return { endpointId: "", gpuIds: "", maxWorkers: 0, minWorkers: 0, idleTimeout: 0, error: "Endpoint not configured" };
  }

  try {
    const apiKey = RUNPOD_API_KEY();
    const query = `query { myself { serverlessDiscount endpoints { id name gpuIds idleTimeout scalerType scalerValue workersMax workersMin templateId } } }`;
    const res = await fetchWithTimeout(`https://api.runpod.io/graphql?api_key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    }, 15000);

    if (!res.ok) {
      return { endpointId, gpuIds: "", maxWorkers: 0, minWorkers: 0, idleTimeout: 0, error: `API ${res.status}` };
    }

    const data = await res.json();
    const endpoints = data?.data?.myself?.endpoints || [];
    const ep = endpoints.find((e: any) => e.id === endpointId);
    if (!ep) {
      return { endpointId, gpuIds: "", maxWorkers: 0, minWorkers: 0, idleTimeout: 0, error: `Endpoint ${endpointId} not found in account` };
    }

    return {
      endpointId: ep.id,
      gpuIds: ep.gpuIds || "",
      maxWorkers: ep.workersMax || 0,
      minWorkers: ep.workersMin || 0,
      idleTimeout: ep.idleTimeout || 0,
    };
  } catch (err: any) {
    return { endpointId, gpuIds: "", maxWorkers: 0, minWorkers: 0, idleTimeout: 0, error: err.message };
  }
}

export async function updateEndpointConfig(params: {
  maxWorkers?: number;
  minWorkers?: number;
  idleTimeout?: number;
  gpuIds?: string;
}): Promise<{ success: boolean; error?: string }> {
  const endpointId = RUNPOD_ENDPOINT_MUSIC();
  if (!endpointId) {
    return { success: false, error: "Endpoint not configured" };
  }

  try {
    const apiKey = RUNPOD_API_KEY();
    const mutations: string[] = [];
    if (params.maxWorkers !== undefined) mutations.push(`workersMax: ${params.maxWorkers}`);
    if (params.minWorkers !== undefined) mutations.push(`workersMin: ${params.minWorkers}`);
    if (params.idleTimeout !== undefined) mutations.push(`idleTimeout: ${params.idleTimeout}`);
    if (params.gpuIds !== undefined) mutations.push(`gpuIds: "${params.gpuIds}"`);

    if (mutations.length === 0) {
      return { success: false, error: "No parameters to update" };
    }

    const query = `mutation { saveEndpoint(input: { id: "${endpointId}", ${mutations.join(", ")} }) { id gpuIds workersMax workersMin idleTimeout } }`;
    console.log(`[RunPod] Updating endpoint ${endpointId}: ${mutations.join(", ")}`);

    const res = await fetchWithTimeout(`https://api.runpod.io/graphql?api_key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    }, 15000);

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `API ${res.status}: ${errText}` };
    }

    const data = await res.json();
    if (data.errors) {
      return { success: false, error: data.errors[0]?.message || "GraphQL error" };
    }

    console.log(`[RunPod] Endpoint updated:`, data?.data?.saveEndpoint);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function getWebhookUrl(path: string): string {
  const replitDomains = process.env.REPLIT_DOMAINS?.split(",")[0];
  const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;
  const appDomain = process.env.APP_DOMAIN;
  const domain = replitDomains || replitDevDomain || appDomain;
  const base = domain
    ? (domain.startsWith("http") ? domain : `https://${domain}`)
    : "http://localhost:5000";
  const url = `${base.replace(/\/$/, "")}${path}`;
  console.log(`[RunPod Serverless] Webhook URL: ${url}`);
  return url;
}

export interface MusicGenerationInput {
  action: "generate_music";
  engine: "heartmula" | "sao";
  song_id: number;
  prompt: string;
  duration_seconds: number;
  lyrics?: string;
  tags?: string;
  style_kit_id?: number;
  genre?: string;
  sao_model?: "instrumental_finetune" | "base";
  webhook_url: string;
}

export interface TrainingInput {
  action: "train_model";
  kit_id: number;
  kit_name: string;
  genre: string;
  instruments: Array<{
    id: number;
    name: string;
    type: string;
    audioUrl: string;
    prompt: string;
  }>;
  training_config: {
    learning_rate: number;
    batch_size: number;
    epochs: number;
    use_ema: boolean;
  };
  webhook_url: string;
}

export interface StemSeparationInput {
  action: "separate_stems";
  song_id: number;
  audio_url: string;
  model?: string;
  webhook_url: string;
}

export async function submitMusicGeneration(params: {
  songId: number;
  engine: "heartmula" | "sao";
  prompt: string;
  duration: number;
  lyrics?: string;
  tags?: string;
  styleKitId?: number;
  genre?: string;
  saoModel?: "instrumental_finetune" | "base";
}): Promise<{ jobId: string; status: string }> {
  const webhookUrl = getWebhookUrl("/api/webhooks/runpod-serverless");

  const input: MusicGenerationInput = {
    action: "generate_music",
    engine: params.engine,
    song_id: params.songId,
    prompt: params.prompt,
    duration_seconds: params.duration,
    sao_model: params.saoModel || "instrumental_finetune",
    webhook_url: webhookUrl,
  };

  if (params.lyrics) input.lyrics = params.lyrics;
  if (params.tags) input.tags = params.tags;
  if (params.styleKitId) input.style_kit_id = params.styleKitId;
  if (params.genre) input.genre = params.genre;

  const result = await submitJob("music", input, webhookUrl);
  return { jobId: result.id, status: result.status };
}

export async function submitTraining(params: {
  kitId: number;
  kitName: string;
  genre: string;
  instruments: Array<{
    id: number;
    name: string;
    type: string;
    audioUrl: string;
    prompt: string;
  }>;
  config: {
    learningRate: number;
    batchSize: number;
    epochs: number;
    useEma: boolean;
  };
}): Promise<{ jobId: string; status: string }> {
  const webhookUrl = getWebhookUrl("/api/webhooks/runpod-serverless");

  const input: TrainingInput = {
    action: "train_model",
    kit_id: params.kitId,
    kit_name: params.kitName,
    genre: params.genre,
    instruments: params.instruments,
    training_config: {
      learning_rate: params.config.learningRate,
      batch_size: params.config.batchSize,
      epochs: params.config.epochs,
      use_ema: params.config.useEma,
    },
    webhook_url: webhookUrl,
  };

  const result = await submitJob("training", input, webhookUrl);
  return { jobId: result.id, status: result.status };
}

export async function submitStemSeparation(params: {
  songId: number;
  audioUrl: string;
  model?: string;
}): Promise<{ jobId: string; status: string }> {
  const webhookUrl = getWebhookUrl("/api/webhooks/runpod-serverless");

  const input: StemSeparationInput = {
    action: "separate_stems",
    song_id: params.songId,
    audio_url: params.audioUrl,
    model: params.model || "htdemucs",
    webhook_url: webhookUrl,
  };

  const result = await submitJob("stems", input, webhookUrl);
  return { jobId: result.id, status: result.status };
}
