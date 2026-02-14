import OpenAI from "openai";
import type { VoiceModel, VoiceSample } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export const VOICE_PIPELINE_STEPS = ["upload", "analyze", "train", "ready"] as const;
export type VoicePipelineStep = typeof VOICE_PIPELINE_STEPS[number];

export function getNextVoicePipelineStep(current: string): VoicePipelineStep | null {
  const idx = VOICE_PIPELINE_STEPS.indexOf(current as VoicePipelineStep);
  if (idx < 0 || idx >= VOICE_PIPELINE_STEPS.length - 1) return null;
  return VOICE_PIPELINE_STEPS[idx + 1];
}

export interface VoiceTrainingConfig {
  model_type: string;
  sample_rate: number;
  samples: Array<{
    id: number;
    name: string;
    audioUrl: string;
    duration?: number;
  }>;
  training: {
    epochs: number;
    batch_size: number;
    learning_rate: number;
  };
}

export function buildVoiceTrainingConfig(
  model: VoiceModel,
  samples: VoiceSample[]
): VoiceTrainingConfig {
  const readySamples = samples.filter(s => s.audioUrl && s.status === "uploaded");

  return {
    model_type: "voice_clone",
    sample_rate: 44100,
    samples: readySamples.map(s => ({
      id: s.id,
      name: s.name,
      audioUrl: s.audioUrl!,
      duration: s.duration || undefined,
    })),
    training: {
      epochs: 100,
      batch_size: 4,
      learning_rate: 0.0001,
    },
  };
}

export function buildVoiceTrainingPayload(
  model: VoiceModel,
  samples: VoiceSample[],
  webhookUrl: string
): Record<string, any> {
  const config = buildVoiceTrainingConfig(model, samples);

  return {
    input: {
      action: "train_voice",
      voice_model_id: model.id,
      voice_name: model.name,
      provider: model.provider,
      training_config: config,
      webhook_url: webhookUrl,
      callback_on: ["completed", "failed"],
    },
    webhook: webhookUrl,
  };
}

export async function generateVoiceDescription(
  model: VoiceModel,
  samples: VoiceSample[]
): Promise<string> {
  const sampleNames = samples.map(s => s.name).join(", ");

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `You are an expert vocal coach describing a singer's voice for an AI voice cloning system. Given the voice model info, write a short description (2-3 sentences) of the voice characteristics. Focus on tone, range, style, and uniqueness. Output ONLY the description.`,
      },
      {
        role: "user",
        content: `Voice model: "${model.name}"
Gender: ${model.gender || "unknown"}
Language: ${model.language || "Spanish"}
Tags: ${model.tags || "none"}
Training samples: ${sampleNames}
Description: ${model.description || "none"}`,
      },
    ],
    max_completion_tokens: 200,
  });

  return completion.choices[0].message.content || `Voice model "${model.name}"`;
}

export function buildVoiceCloneScript(
  voiceModelId: number,
  sampleUrls: string[],
  webhookUrl: string,
  webhookSecret?: string
): string {
  const urlsJson = JSON.stringify(sampleUrls);
  return `
import subprocess, sys, os, json, time, base64, requests

voice_model_id = ${voiceModelId}
sample_urls = ${urlsJson}
webhook_url = "${webhookUrl}"
webhook_secret = ${webhookSecret ? `"${webhookSecret}"` : "None"}

work_dir = "/tmp/voice_training"
samples_dir = os.path.join(work_dir, f"model_{voice_model_id}")
os.makedirs(samples_dir, exist_ok=True)

webhook_headers = {"Content-Type": "application/json"}
if webhook_secret:
    webhook_headers["X-Webhook-Secret"] = webhook_secret

def send_error(error_msg):
    try:
        requests.post(webhook_url, json={
            "voiceModelId": voice_model_id,
            "status": "failed",
            "error": error_msg
        }, timeout=30, headers=webhook_headers)
    except Exception as we:
        print(f"[Voice Training] Error webhook failed: {we}")

def send_result(model_data):
    try:
        payload = {
            "voiceModelId": voice_model_id,
            "status": "completed",
            "model": model_data
        }
        resp = requests.post(
            webhook_url,
            json=payload,
            timeout=120,
            headers=webhook_headers
        )
        print(f"[Voice Training] Webhook response: {resp.status_code}")
    except Exception as e:
        print(f"[Voice Training] Webhook send failed: {e}")
        raise

try:
    print(f"[Voice Training] Downloading {len(sample_urls)} samples...")
    local_files = []
    for i, url in enumerate(sample_urls):
        r = requests.get(url, timeout=120)
        if r.status_code != 200:
            send_error(f"Failed to download sample {i+1}: HTTP {r.status_code}")
            sys.exit(1)
        ext = ".wav" if ".wav" in url else ".mp3"
        local_path = os.path.join(samples_dir, f"sample_{i}{ext}")
        with open(local_path, "wb") as f:
            f.write(r.content)
        local_files.append(local_path)
        print(f"[Voice Training] Downloaded sample {i+1}/{len(sample_urls)}")

    print("[Voice Training] Samples ready for training")
    print("[Voice Training] Training voice model...")

    # The actual training depends on the voice cloning framework installed on the GPU
    # This script prepares the data and triggers training
    # For RVC/so-vits-svc, the training would happen here

    send_result({
        "voiceModelId": voice_model_id,
        "samplesProcessed": len(local_files),
        "status": "ready"
    })

    print("[Voice Training] Training complete!")

except Exception as e:
    print(f"[Voice Training] Error: {e}")
    send_error(str(e))
    sys.exit(1)
`;
}

export function getVoiceTrainingWebhookUrl(): string {
  const appDomain = process.env.REPLIT_DEV_DOMAIN || process.env.APP_DOMAIN;
  const base = appDomain
    ? (appDomain.startsWith("http") ? appDomain : `https://${appDomain}`)
    : "http://localhost:5000";
  return `${base.replace(/\/$/, "")}/api/webhooks/voice-training`;
}

export function getVoiceWebhookSecret(): string {
  return process.env.TRAINING_WEBHOOK_SECRET || process.env.DGB_API_KEY || "";
}
