import { storage } from "../storage";
import type { ApiProvider, ApiEndpoint, OperationType } from "@shared/schema";
import {
  submitGenericJob, pollGenericJob, downloadFile,
  resolveFullAudioUrl, GenericSubmitResult, GenericPollResult,
} from "./generic_api_engine";

export interface ProviderInput {
  prompt?: string;
  lyrics?: string;
  style?: string;
  duration?: number;
  instrumental?: boolean;
  vocalGender?: string;
  title?: string;
  audioUrl?: string;
  songId?: number;
  userId?: string;
  kieTaskId?: string;
  kieAudioId?: string;
  [key: string]: any;
}

export interface ProviderResult {
  success: boolean;
  audioUrl?: string;
  imageUrl?: string;
  taskId?: string;
  kieAudioId?: string;
  stems?: Record<string, string>;
  providerName: string;
  adapterKey?: string;
  endpointId?: number;
  needsPolling?: boolean;
  pollConfig?: {
    taskId: string;
    endpointId?: number;
    adapterKey?: string;
    providerName: string;
  };
  raw?: any;
}

export type AdapterSubmitFn = (
  input: ProviderInput,
  provider: ApiProvider,
  endpoint: ApiEndpoint,
) => Promise<ProviderResult>;

export type AdapterPollFn = (
  taskId: string,
  provider: ApiProvider,
  endpoint: ApiEndpoint,
  input: ProviderInput,
) => Promise<ProviderResult>;

export interface ProviderAdapter {
  canUse: (provider: ApiProvider) => boolean;
  submit: AdapterSubmitFn;
  poll?: AdapterPollFn;
}

const adapterRegistry = new Map<string, ProviderAdapter>();

export function registerAdapter(key: string, adapter: ProviderAdapter): void {
  adapterRegistry.set(key, adapter);
  console.log(`[Pipeline] Registered adapter: ${key}`);
}

export function getAdapter(key: string): ProviderAdapter | undefined {
  return adapterRegistry.get(key);
}

export function listAdapters(): string[] {
  return Array.from(adapterRegistry.keys());
}

function getCallbackUrl(template?: string | null): string | undefined {
  if (!template) return undefined;
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || "dgb-studio.replit.app";
  return template.replace("{domain}", domain);
}

async function getProviderEndpoints(
  operationType: OperationType
): Promise<(ApiEndpoint & { provider: ApiProvider })[]> {
  const allEndpoints = await storage.getApiEndpointsByOperation(operationType);

  const withProvider = allEndpoints.filter(
    (ep): ep is ApiEndpoint & { provider: ApiProvider } => !!ep.provider
  );

  withProvider.sort((a, b) => {
    const pa = a.provider.priority ?? 50;
    const pb = b.provider.priority ?? 50;
    return pa - pb;
  });

  return withProvider.filter(ep => {
    if (!ep.isActive || !ep.provider.isActive) return false;

    const adapterKey = ep.provider.adapterKey;
    if (adapterKey) {
      const adapter = adapterRegistry.get(adapterKey);
      if (adapter && !adapter.canUse(ep.provider)) return false;
    }

    return true;
  });
}

export async function executeOperation(
  operationType: OperationType,
  input: ProviderInput,
): Promise<ProviderResult> {
  const endpoints = await getProviderEndpoints(operationType);

  if (endpoints.length === 0) {
    throw new Error(`NO_PROVIDER: No active provider configured for "${operationType}"`);
  }

  console.log(`[Pipeline:${operationType}] Found ${endpoints.length} provider(s) in priority order`);

  const errors: string[] = [];

  for (const endpoint of endpoints) {
    const provider = endpoint.provider;
    const adapterKey = provider.adapterKey;
    const providerName = provider.name;

    console.log(`[Pipeline:${operationType}] Trying "${providerName}" (priority: ${provider.priority}, adapter: ${adapterKey || "generic"})`);

    try {
      if (adapterKey && adapterRegistry.has(adapterKey)) {
        const adapter = adapterRegistry.get(adapterKey)!;
        const result = await adapter.submit(input, provider, endpoint);
        console.log(`[Pipeline:${operationType}] "${providerName}" submitted successfully`);
        return { ...result, providerName, adapterKey, endpointId: endpoint.id };
      }

      const callbackUrl = getCallbackUrl(endpoint.callbackUrlTemplate);
      const genericInput: Record<string, any> = { ...input };
      if (callbackUrl) {
        genericInput.callBackUrl = callbackUrl;
        genericInput.webhook_url = callbackUrl;
      }

      const submitResult = await submitGenericJob(operationType, genericInput);

      if (submitResult.audioUrl && endpoint.asyncPattern === "none") {
        return {
          success: true,
          audioUrl: submitResult.audioUrl,
          imageUrl: submitResult.raw?.image_url,
          taskId: submitResult.taskId,
          providerName,
          endpointId: endpoint.id,
          raw: submitResult.raw,
        };
      }

      if (submitResult.taskId) {
        return {
          success: true,
          taskId: submitResult.taskId,
          providerName,
          endpointId: endpoint.id,
          needsPolling: true,
          pollConfig: {
            taskId: submitResult.taskId,
            endpointId: endpoint.id,
            providerName,
          },
          raw: submitResult.raw,
        };
      }

      throw new Error("No taskId or audioUrl returned from provider");

    } catch (err: any) {
      const msg = err.message || "";
      console.log(`[Pipeline:${operationType}] "${providerName}" failed: ${msg}`);
      errors.push(`${providerName}: ${msg}`);

      if (msg.includes("CREDITS_EXHAUSTED") || msg.includes("QUOTA_EXCEEDED")) {
        continue;
      }
      if (msg.includes("AUTH_ERROR")) {
        continue;
      }
      continue;
    }
  }

  throw new Error(`ALL_PROVIDERS_FAILED: All ${endpoints.length} providers failed for "${operationType}": ${errors.join(" | ")}`);
}

export async function pollOperation(
  operationType: OperationType,
  taskId: string,
  options: {
    endpointId?: number;
    adapterKey?: string;
    providerName?: string;
    maxWaitMs?: number;
    intervalMs?: number;
    input?: ProviderInput;
  } = {},
): Promise<ProviderResult> {
  const { maxWaitMs = 300000, intervalMs = 10000, input = {} } = options;

  if (options.adapterKey && adapterRegistry.has(options.adapterKey)) {
    const adapter = adapterRegistry.get(options.adapterKey)!;
    if (adapter.poll) {
      let provider: ApiProvider | undefined;
      let endpoint: ApiEndpoint | undefined;

      if (options.endpointId) {
        const ep = await storage.getApiEndpoint(options.endpointId);
        if (ep) {
          endpoint = ep;
          const prov = await storage.getApiProvider(ep.providerId);
          if (prov) provider = prov;
        }
      }

      if (!provider || !endpoint) {
        const endpoints = await getProviderEndpoints(operationType);
        const match = endpoints.find(e => e.provider.adapterKey === options.adapterKey);
        if (match) {
          endpoint = match;
          provider = match.provider;
        }
      }

      if (provider && endpoint) {
        return adapter.poll(taskId, provider, endpoint, input);
      }
    }
  }

  const pollResult = await pollGenericJob(
    operationType,
    taskId,
    maxWaitMs,
    intervalMs,
    options.endpointId,
  );

  return {
    success: pollResult.status === "COMPLETED",
    audioUrl: pollResult.audioUrl,
    imageUrl: pollResult.raw?.image_url,
    stems: extractStems(pollResult),
    providerName: options.providerName || "generic",
    raw: pollResult.raw,
  };
}

function extractStems(pollResult: GenericPollResult): Record<string, string> {
  const stems: Record<string, string> = {};

  const output = pollResult.raw?.output;
  if (output && typeof output === "object" && !Array.isArray(output)) {
    if (output.vocals) stems.vocals = String(output.vocals);
    if (output.drums) stems.drums = String(output.drums);
    if (output.bass) stems.bass = String(output.bass);
    if (output.other) stems.other = String(output.other);
    if (output.instrumental) stems.instrumental = String(output.instrumental);
  }

  if (Object.keys(stems).length === 0) {
    const audioUrlField = pollResult.raw?.audio_url || pollResult.audioUrl;
    if (audioUrlField && typeof audioUrlField === "string") {
      try {
        const parsed = JSON.parse(audioUrlField);
        if (typeof parsed === "object") Object.assign(stems, parsed);
      } catch {}
    }
  }

  if (pollResult.vocalsUrl) stems.vocals = stems.vocals || pollResult.vocalsUrl;
  if (pollResult.accompanimentUrl) stems.instrumental = stems.instrumental || pollResult.accompanimentUrl;

  return stems;
}

export async function executeAndPoll(
  operationType: OperationType,
  input: ProviderInput,
  pollOptions: { maxWaitMs?: number; intervalMs?: number } = {},
): Promise<ProviderResult> {
  const submitResult = await executeOperation(operationType, input);

  if (submitResult.audioUrl && !submitResult.needsPolling) {
    return submitResult;
  }

  if (!submitResult.taskId && !submitResult.pollConfig?.taskId) {
    return submitResult;
  }

  const taskId = submitResult.pollConfig?.taskId || submitResult.taskId!;
  return pollOperation(operationType, taskId, {
    endpointId: submitResult.endpointId,
    adapterKey: submitResult.adapterKey,
    providerName: submitResult.providerName,
    input,
    ...pollOptions,
  });
}

export { downloadFile, resolveFullAudioUrl };
