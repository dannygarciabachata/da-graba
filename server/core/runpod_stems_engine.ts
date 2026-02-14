import { isRunPodConfigured } from "./runpod_client";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import WebSocket from "ws";

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

const AUDIO_BASE_DIR = path.join(process.cwd(), "public", "audio");

interface RunPodStemsResult {
  success: boolean;
  jobId: string;
  error?: string;
}

export function getStemsWebhookUrl(): string {
  const appDomain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || process.env.APP_DOMAIN;
  const base = appDomain
    ? (appDomain.startsWith("http") ? appDomain : `https://${appDomain}`)
    : "http://localhost:5000";
  return `${base.replace(/\/$/, "")}/api/webhooks/runpod-stems`;
}

export function getStemsWebhookSecret(): string {
  return process.env.TRAINING_WEBHOOK_SECRET || process.env.DGB_API_KEY || "";
}

export function canUseRunPodStems(): boolean {
  return isRunPodConfigured();
}

function buildStemSeparationScript(
  songId: number,
  audioUrl: string,
  webhookUrl: string,
  webhookSecret: string
): string {
  const safeUrl = audioUrl.replace(/'/g, "\\'").replace(/"/g, '\\"');

  return `
import json
import os
import time
import requests
import subprocess
import base64
import sys

song_id = ${songId}
audio_url = "${safeUrl}"
webhook_url = "${webhookUrl}"
webhook_secret = "${webhookSecret}"

print(f"[Demucs Stems] Starting stem separation for song {song_id}")
print(f"[Demucs Stems] Audio URL: {audio_url[:200]}")

work_dir = "/workspace/stem_separation"
os.makedirs(work_dir, exist_ok=True)
input_dir = os.path.join(work_dir, f"input_{song_id}")
output_dir = os.path.join(work_dir, f"output_{song_id}")
os.makedirs(input_dir, exist_ok=True)
os.makedirs(output_dir, exist_ok=True)

input_file = os.path.join(input_dir, f"song_{song_id}.mp3")

webhook_headers = {"Content-Type": "application/json"}
if webhook_secret:
    webhook_headers["X-Webhook-Secret"] = webhook_secret

def send_error(error_msg):
    try:
        requests.post(webhook_url, json={
            "songId": song_id,
            "status": "failed",
            "error": error_msg
        }, timeout=30, headers=webhook_headers)
    except Exception as we:
        print(f"[Demucs Stems] Error webhook failed: {we}")

def send_result(stem_data):
    try:
        payload = {
            "songId": song_id,
            "status": "completed",
            "stems": stem_data
        }
        resp = requests.post(
            webhook_url,
            json=payload,
            timeout=120,
            headers=webhook_headers
        )
        print(f"[Demucs Stems] Webhook response: {resp.status_code}")
    except Exception as e:
        print(f"[Demucs Stems] Webhook send failed: {e}")
        raise

try:
    print(f"[Demucs Stems] Downloading audio...")
    r = requests.get(audio_url, timeout=120)
    r.raise_for_status()
    with open(input_file, "wb") as f:
        f.write(r.content)
    file_size = os.path.getsize(input_file)
    print(f"[Demucs Stems] Downloaded: {file_size / 1024 / 1024:.1f}MB")
except Exception as e:
    print(f"[Demucs Stems] Download failed: {e}")
    send_error(f"Failed to download audio: {str(e)}")
    raise

try:
    import torch
    print(f"[Demucs Stems] PyTorch available, CUDA: {torch.cuda.is_available()}")
except ImportError:
    print("[Demucs Stems] PyTorch not found, installing...")
    subprocess.run([sys.executable, "-m", "pip", "install", "torch", "torchaudio", "--quiet"], check=False)

try:
    import demucs
    print(f"[Demucs Stems] Demucs available")
except ImportError:
    print("[Demucs Stems] Demucs not found, installing...")
    subprocess.run([sys.executable, "-m", "pip", "install", "demucs", "--quiet"], check=True)
    print("[Demucs Stems] Demucs installed")

try:
    print(f"[Demucs Stems] Running Demucs 4-stem separation...")
    start_time = time.time()

    result = subprocess.run(
        [sys.executable, "-m", "demucs", "-n", "htdemucs",
         "--out", output_dir, input_file],
        capture_output=True, text=True, timeout=600
    )

    if result.returncode != 0:
        print(f"[Demucs Stems] Demucs stderr: {result.stderr[:500]}")
        send_error(f"Demucs separation failed: {result.stderr[:300]}")
        raise Exception(f"Demucs failed with code {result.returncode}")

    elapsed = time.time() - start_time
    print(f"[Demucs Stems] Separation completed in {elapsed:.1f}s")

    stems_dir = None
    for model_name in ["htdemucs", "htdemucs_ft", "mdx_extra"]:
        candidate = os.path.join(output_dir, model_name, f"song_{song_id}")
        if os.path.isdir(candidate):
            stems_dir = candidate
            break
    
    if not stems_dir:
        for root, dirs, files in os.walk(output_dir):
            wav_files = [f for f in files if f.endswith('.wav')]
            if wav_files:
                stems_dir = root
                break

    if not stems_dir:
        send_error("No stem output files found after Demucs processing")
        raise Exception("No stem files found")

    print(f"[Demucs Stems] Stems directory: {stems_dir}")
    available_files = os.listdir(stems_dir)
    print(f"[Demucs Stems] Available files: {available_files}")

    stem_mapping = {
        "vocals": ["vocals.wav", "vocals.mp3"],
        "drums": ["drums.wav", "drums.mp3"],
        "bass": ["bass.wav", "bass.mp3"],
        "other": ["other.wav", "other.mp3", "no_vocals.wav"],
        "instrumental": ["no_vocals.wav", "other.wav"]
    }

    stem_data = {}
    for stem_name, possible_files in stem_mapping.items():
        for fname in possible_files:
            fpath = os.path.join(stems_dir, fname)
            if os.path.exists(fpath):
                with open(fpath, "rb") as sf:
                    audio_b64 = base64.b64encode(sf.read()).decode("utf-8")
                
                file_size = os.path.getsize(fpath)
                is_wav = fname.endswith(".wav")
                stem_data[stem_name] = {
                    "audioBase64": audio_b64,
                    "format": "wav" if is_wav else "mp3",
                    "fileSize": file_size
                }
                print(f"[Demucs Stems] {stem_name}: {fname} ({file_size / 1024 / 1024:.1f}MB)")
                break

    if not stem_data:
        send_error("No stem audio data could be extracted")
        raise Exception("No stem data")

    print(f"[Demucs Stems] Sending {len(stem_data)} stems via webhook...")
    send_result(stem_data)
    print(f"[Demucs Stems] Job complete for song {song_id} ({elapsed:.1f}s)")

except subprocess.TimeoutExpired:
    print("[Demucs Stems] Demucs timed out after 10 minutes")
    send_error("Stem separation timed out (10 min limit)")

except Exception as e:
    print(f"[Demucs Stems] Separation failed: {e}")
    import traceback
    traceback.print_exc()
    send_error(str(e))

finally:
    import shutil
    try:
        shutil.rmtree(input_dir, ignore_errors=True)
        shutil.rmtree(output_dir, ignore_errors=True)
    except:
        pass

print(f"[Demucs Stems] Job finished for song {song_id}")
`;
}

function buildJupyterUrl(baseUrl: string, jupyterPort: number): string {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const proxyMatch = cleanBase.match(/^(https?:\/\/)([a-z0-9]+)-\d+\.proxy\.runpod\.net/i);
  if (proxyMatch) {
    return `${proxyMatch[1]}${proxyMatch[2]}-${jupyterPort}.proxy.runpod.net`;
  }
  const url = new URL(cleanBase);
  url.port = String(jupyterPort);
  return url.toString().replace(/\/$/, "");
}

async function resolveJupyterServer(): Promise<{ base: string; token: string } | null> {
  try {
    const { storage } = await import("../storage");
    const server = await storage.getActiveCloudServer("stem_separation");
    if (server && server.baseUrl) {
      const port = server.jupyterPort || 8888;
      const base = buildJupyterUrl(server.baseUrl, port);
      const token = process.env.RUNPOD_JUPYTER_TOKEN || server.jupyterToken || "";
      return { base, token };
    }
  } catch {}
  const base = (process.env.RUNPOD_BASE_URL || "").replace(/\/lab\/.*$/, "").replace(/\/$/, "");
  const token = process.env.RUNPOD_JUPYTER_TOKEN || "";
  if (!base) return null;
  return { base, token };
}

export async function submitRunPodStemSeparation(
  songId: number,
  audioUrl: string
): Promise<RunPodStemsResult> {
  const server = await resolveJupyterServer();
  if (!server) {
    return { success: false, jobId: "", error: "No cloud server configured for stem separation" };
  }
  const { base, token } = server;

  const webhookUrl = getStemsWebhookUrl();
  const webhookSecret = getStemsWebhookSecret();
  const script = buildStemSeparationScript(songId, audioUrl, webhookUrl, webhookSecret);
  const jobId = `demucs_stems_${songId}_${Date.now()}`;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `token ${token}`;

    const listRes = await fetchWithTimeout(`${base}/api/kernels`, { headers }, 15000);
    let kernelId: string;

    if (listRes.ok) {
      const kernels = await listRes.json();
      if (Array.isArray(kernels) && kernels.length > 0) {
        kernelId = kernels[0].id;
      } else {
        const createRes = await fetchWithTimeout(`${base}/api/kernels`, {
          method: "POST", headers, body: JSON.stringify({ name: "python3" }),
        }, 15000);
        if (!createRes.ok) throw new Error(`Failed to create kernel: ${createRes.status}`);
        const kernel = await createRes.json();
        kernelId = kernel.id;
      }
    } else {
      throw new Error(`Cannot list kernels: ${listRes.status}`);
    }

    console.log(`[RunPod Stems] Submitting stem separation for song ${songId}, kernel ${kernelId}`);

    const wsProtocol = base.startsWith("https") ? "wss" : "ws";
    const wsBase = base.replace(/^https?/, wsProtocol);
    const tokenParam = token ? `?token=${token}` : "";

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { ws.close(); } catch {}
        resolve();
      }, 60000);

      let ws: any;
      try {
        ws = new WebSocket(`${wsBase}/api/kernels/${kernelId}/channels${tokenParam}`);
      } catch (err: any) {
        clearTimeout(timeout);
        reject(new Error(`WebSocket connection failed: ${err.message}`));
        return;
      }

      const msgId = `demucs_stems_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      let shellReplyReceived = false;

      ws.on("open", () => {
        ws.send(JSON.stringify({
          header: {
            msg_id: msgId,
            msg_type: "execute_request",
            username: "dgb_studio",
            session: `session_${Date.now()}`,
            date: new Date().toISOString(),
            version: "5.3",
          },
          parent_header: {},
          metadata: {},
          content: {
            code: script,
            silent: false,
            store_history: true,
            user_expressions: {},
            allow_stdin: false,
            stop_on_error: false,
          },
          channel: "shell",
          buffers: [],
        }));
        console.log(`[RunPod Stems] Script sent to kernel`);
      });

      ws.on("message", (data: any) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.parent_header?.msg_id !== msgId) return;

          if (msg.msg_type === "stream") {
            const text = msg.content?.text || "";
            if (text.includes("[Demucs Stems]")) {
              console.log(`[RunPod Stems] ${text.trim()}`);
            }
          }

          if (msg.msg_type === "error") {
            clearTimeout(timeout);
            ws.close();
            reject(new Error(msg.content?.evalue || "Execution error"));
            return;
          }

          if (msg.msg_type === "execute_reply") {
            shellReplyReceived = true;
            if (msg.content?.status === "error") {
              clearTimeout(timeout);
              ws.close();
              reject(new Error(msg.content?.evalue || "Execution failed"));
              return;
            }
          }

          if (msg.msg_type === "status" && msg.content?.execution_state === "busy" && !shellReplyReceived) {
            console.log(`[RunPod Stems] Kernel accepted job, script is running`);
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        } catch {}
      });

      ws.on("error", (err: any) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${err.message}`));
      });
    });

    console.log(`[RunPod Stems] Job ${jobId} submitted successfully`);
    return { success: true, jobId };

  } catch (err: any) {
    console.error(`[RunPod Stems] Submission failed:`, err.message);
    return { success: false, jobId, error: err.message };
  }
}

export async function saveStemAudio(
  audioBase64: string,
  songId: number,
  stemType: string,
  format: string = "wav"
): Promise<string> {
  const dir = path.join(AUDIO_BASE_DIR, "stems");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const ext = format === "mp3" ? ".mp3" : ".wav";
  const filename = `${songId}_${stemType}_${crypto.randomUUID().substring(0, 8)}${ext}`;
  const filePath = path.join(dir, filename);

  const buffer = Buffer.from(audioBase64, "base64");
  fs.writeFileSync(filePath, buffer);

  console.log(`[RunPod Stems] Saved ${stemType} stem for song ${songId}: ${filePath} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
  return `/audio/stems/${filename}`;
}
