const RUNPOD_API_KEY = () => process.env.RUNPOD_API_KEY || "";
const RUNPOD_ENDPOINT_MUSIC = () => process.env.RUNPOD_ENDPOINT_MUSIC || "";
const RUNPOD_ENDPOINT_TRAINING = () => process.env.RUNPOD_ENDPOINT_TRAINING || "";
const RUNPOD_ENDPOINT_STEMS = () => process.env.RUNPOD_ENDPOINT_STEMS || "";

const BASE_URL = "https://api.runpod.ai/v2";

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
    running: number;
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
): Promise<{ connected: boolean; workers: number; queued: number; error?: string }> {
  const endpointId = getEndpointId(endpointType);
  if (!endpointId) {
    return { connected: false, workers: 0, queued: 0, error: `Endpoint not configured for: ${endpointType}` };
  }

  try {
    const url = `${BASE_URL}/${endpointId}/health`;
    const res = await fetchWithTimeout(url, {
      method: "GET",
      headers: getHeaders(),
    }, 10000);

    if (!res.ok) {
      return { connected: false, workers: 0, queued: 0, error: `Status ${res.status}` };
    }

    const data: ServerlessHealthResponse = await res.json();
    const totalWorkers = (data.workers?.idle || 0) + (data.workers?.running || 0);
    const queued = data.jobs?.inQueue || 0;

    return {
      connected: true,
      workers: totalWorkers,
      queued,
    };
  } catch (err: any) {
    return { connected: false, workers: 0, queued: 0, error: err.message };
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
}): Promise<{ jobId: string; status: string }> {
  const webhookUrl = getWebhookUrl("/api/webhooks/runpod-serverless");

  const input: MusicGenerationInput = {
    action: "generate_music",
    engine: params.engine,
    song_id: params.songId,
    prompt: params.prompt,
    duration_seconds: params.duration,
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
