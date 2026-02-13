import { isRunPodConfigured } from "./runpod_client";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import WebSocket from "ws";

const AUDIO_BASE_DIR = path.join(process.cwd(), "public", "audio");

interface RunPodMusicResult {
  success: boolean;
  jobId: string;
  error?: string;
}

export function getRunPodMusicWebhookUrl(): string {
  const appDomain = process.env.APP_DOMAIN || process.env.REPLIT_DEV_DOMAIN;
  const base = appDomain
    ? (appDomain.startsWith("http") ? appDomain : `https://${appDomain}`)
    : "http://localhost:5000";
  return `${base.replace(/\/$/, "")}/api/webhooks/runpod-music`;
}

export function canUseRunPodMusic(): boolean {
  return isRunPodConfigured();
}

function buildMusicGenerationScript(
  songId: number,
  prompt: string,
  duration: number,
  webhookUrl: string
): string {
  const safePrompt = prompt.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
  const hfToken = process.env.HF_TOKEN || "";

  return `
import json
import os
import time
import requests
import subprocess

song_id = ${songId}
prompt = "${safePrompt}"
duration_seconds = ${duration}
webhook_url = "${webhookUrl}"
hf_token = "${hfToken}"

if hf_token:
    os.environ["HF_TOKEN"] = hf_token
    os.environ["HUGGING_FACE_HUB_TOKEN"] = hf_token

print(f"[SAO Music] Starting generation for song {song_id}")
print(f"[SAO Music] Prompt: {prompt[:200]}")
print(f"[SAO Music] Duration: {duration_seconds}s")

output_dir = "/workspace/generated_music"
os.makedirs(output_dir, exist_ok=True)
wav_path = os.path.join(output_dir, f"song_{song_id}_{int(time.time())}.wav")
mp3_path = wav_path.replace(".wav", ".mp3")

def convert_to_mp3(wav_file, mp3_file):
    try:
        result = subprocess.run(
            ["ffmpeg", "-i", wav_file, "-codec:a", "libmp3lame", "-b:a", "192k", "-y", mp3_file],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode == 0 and os.path.exists(mp3_file):
            print(f"[SAO Music] Converted to MP3: {os.path.getsize(mp3_file) / 1024 / 1024:.1f}MB")
            return mp3_file
    except Exception as e:
        print(f"[SAO Music] MP3 conversion failed: {e}")
    return wav_file

def send_result(audio_file, gen_time, device, sample_rate):
    import base64
    with open(audio_file, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode("utf-8")
    
    file_size = os.path.getsize(audio_file)
    is_mp3 = audio_file.endswith(".mp3")
    
    result = {
        "songId": song_id,
        "status": "completed",
        "audioBase64": audio_b64,
        "audioFormat": "mp3" if is_mp3 else "wav",
        "sampleRate": sample_rate,
        "duration": duration_seconds,
        "generationTime": round(gen_time, 1),
        "fileSize": file_size,
        "device": device
    }
    
    print(f"[SAO Music] Sending webhook ({file_size / 1024 / 1024:.1f}MB, {'mp3' if is_mp3 else 'wav'})...")
    resp = requests.post(
        webhook_url,
        json=result,
        timeout=120,
        headers={"Content-Type": "application/json"}
    )
    print(f"[SAO Music] Webhook response: {resp.status_code}")

def send_error(error_msg):
    try:
        requests.post(webhook_url, json={
            "songId": song_id,
            "status": "failed",
            "error": error_msg
        }, timeout=30)
    except Exception as we:
        print(f"[SAO Music] Error webhook failed: {we}")

try:
    import torch
    import torchaudio
    from stable_audio_tools import get_pretrained_model
    from stable_audio_tools.inference.generation import generate_diffusion_cond
    
    print("[SAO Music] Loading Stable Audio Open model...")
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[SAO Music] Using device: {device}")
    
    model, model_config = get_pretrained_model("stabilityai/stable-audio-open-1.0")
    
    sample_rate = model_config["sample_rate"]
    sample_size = model_config["sample_size"]
    
    model = model.to(device)
    
    conditioning = [{
        "prompt": prompt,
        "seconds_start": 0,
        "seconds_total": min(duration_seconds, 47)
    }]
    
    print("[SAO Music] Generating audio...")
    gen_start = time.time()
    
    with torch.no_grad():
        output = generate_diffusion_cond(
            model,
            steps=100,
            cfg_scale=7,
            conditioning=conditioning,
            sample_size=sample_size,
            sigma_min=0.3,
            sigma_max=500,
            sampler_type="dpmpp-3m-sde",
            device=device
        )
    
    output = output.squeeze(0).cpu()
    if output.dim() == 1:
        output = output.unsqueeze(0)
    
    torchaudio.save(wav_path, output, sample_rate)
    gen_time = time.time() - gen_start
    print(f"[SAO Music] Generated WAV in {gen_time:.1f}s ({os.path.getsize(wav_path) / 1024 / 1024:.1f}MB)")
    
    final_path = convert_to_mp3(wav_path, mp3_path)
    send_result(final_path, gen_time, device, sample_rate)
    
except ImportError as e:
    print(f"[SAO Music] stable_audio_tools not available: {e}")
    print("[SAO Music] Attempting fallback with diffusers pipeline...")
    
    try:
        import torch
        from diffusers import StableAudioPipeline
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[SAO Music] Fallback using device: {device}")
        
        pipe = StableAudioPipeline.from_pretrained(
            "stabilityai/stable-audio-open-1.0",
            torch_dtype=torch.float16 if device == "cuda" else torch.float32
        )
        pipe = pipe.to(device)
        
        print("[SAO Music] Generating with diffusers pipeline...")
        gen_start = time.time()
        
        audio = pipe(
            prompt,
            negative_prompt="low quality, distorted, noise, static",
            num_inference_steps=100,
            audio_end_in_s=min(duration_seconds, 47),
            num_waveforms_per_prompt=1,
            guidance_scale=7.0
        ).audios
        
        import soundfile as sf
        output_audio = audio[0].T if audio[0].ndim > 1 else audio[0]
        sf.write(wav_path, output_audio, 44100)
        
        gen_time = time.time() - gen_start
        print(f"[SAO Music] Generated WAV in {gen_time:.1f}s ({os.path.getsize(wav_path) / 1024 / 1024:.1f}MB)")
        
        final_path = convert_to_mp3(wav_path, mp3_path)
        send_result(final_path, gen_time, device, 44100)
        
    except Exception as e2:
        print(f"[SAO Music] Diffusers fallback also failed: {e2}")
        send_error(f"SAO not available: {str(e)} | Diffusers: {str(e2)}")

except Exception as e:
    print(f"[SAO Music] Generation failed: {e}")
    import traceback
    traceback.print_exc()
    send_error(str(e))

print(f"[SAO Music] Job complete for song {song_id}")
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
    const server = await storage.getActiveCloudServer("music_generation");
    if (!server) {
      const stemServer = await storage.getActiveCloudServer("stem_separation");
      if (stemServer && stemServer.baseUrl) {
        const port = stemServer.jupyterPort || 8888;
        return { base: buildJupyterUrl(stemServer.baseUrl, port), token: stemServer.jupyterToken || process.env.RUNPOD_JUPYTER_TOKEN || "" };
      }
    }
    if (server && server.baseUrl) {
      const port = server.jupyterPort || 8888;
      return { base: buildJupyterUrl(server.baseUrl, port), token: server.jupyterToken || process.env.RUNPOD_JUPYTER_TOKEN || "" };
    }
  } catch {}
  const base = (process.env.RUNPOD_BASE_URL || "").replace(/\/lab\/.*$/, "").replace(/\/$/, "");
  const token = process.env.RUNPOD_JUPYTER_TOKEN || "";
  if (!base) return null;
  return { base, token };
}

export async function submitRunPodMusicGeneration(
  songId: number,
  prompt: string,
  duration: number
): Promise<RunPodMusicResult> {
  const server = await resolveJupyterServer();
  if (!server) {
    return { success: false, jobId: "", error: "No cloud server configured for music generation" };
  }
  const { base, token } = server;

  const webhookUrl = getRunPodMusicWebhookUrl();
  const script = buildMusicGenerationScript(songId, prompt, duration, webhookUrl);
  const jobId = `sao_music_${songId}_${Date.now()}`;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `token ${token}`;

    const listRes = await fetch(`${base}/api/kernels`, { headers });
    let kernelId: string;

    if (listRes.ok) {
      const kernels = await listRes.json();
      if (Array.isArray(kernels) && kernels.length > 0) {
        kernelId = kernels[0].id;
      } else {
        const createRes = await fetch(`${base}/api/kernels`, {
          method: "POST", headers, body: JSON.stringify({ name: "python3" }),
        });
        if (!createRes.ok) throw new Error(`Failed to create kernel: ${createRes.status}`);
        const kernel = await createRes.json();
        kernelId = kernel.id;
      }
    } else {
      throw new Error(`Cannot list kernels: ${listRes.status}`);
    }

    console.log(`[RunPod Music] Submitting generation for song ${songId}, kernel ${kernelId}`);

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

      const msgId = `sao_music_${Date.now()}_${Math.random().toString(36).substring(7)}`;
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
        console.log(`[RunPod Music] Script sent to kernel`);
      });

      ws.on("message", (data: any) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.parent_header?.msg_id !== msgId) return;

          if (msg.msg_type === "stream") {
            const text = msg.content?.text || "";
            if (text.includes("[SAO Music]")) {
              console.log(`[RunPod Music] ${text.trim()}`);
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
            console.log(`[RunPod Music] Kernel accepted job, script is running`);
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

    console.log(`[RunPod Music] Job ${jobId} submitted successfully`);
    return { success: true, jobId };

  } catch (err: any) {
    console.error(`[RunPod Music] Submission failed:`, err.message);
    return { success: false, jobId, error: err.message };
  }
}

export async function saveRunPodAudio(
  audioBase64: string,
  songId: number,
  format: string = "mp3"
): Promise<string> {
  const dir = path.join(AUDIO_BASE_DIR, "songs");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const ext = format === "wav" ? ".wav" : ".mp3";
  const filename = `${crypto.randomUUID()}_sao_song${ext}`;
  const filePath = path.join(dir, filename);

  const buffer = Buffer.from(audioBase64, "base64");
  fs.writeFileSync(filePath, buffer);

  console.log(`[RunPod Music] Saved audio for song ${songId}: ${filePath} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
  return `/audio/songs/${filename}`;
}
