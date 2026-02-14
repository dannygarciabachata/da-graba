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

export type MusicEngine = "heartmula" | "sao";

export function getRunPodMusicWebhookUrl(): string {
  const replitDomains = process.env.REPLIT_DOMAINS?.split(",")[0];
  const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;
  const appDomain = process.env.APP_DOMAIN;
  const domain = replitDomains || replitDevDomain || appDomain;
  const base = domain
    ? (domain.startsWith("http") ? domain : `https://${domain}`)
    : "http://localhost:5000";
  const url = `${base.replace(/\/$/, "")}/api/webhooks/runpod-music`;
  console.log(`[Webhook] URL resolved to: ${url}`);
  return url;
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
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[SAO Music] Device: {device} | GPU: {torch.cuda.get_device_name(0) if device == 'cuda' else 'N/A'}")
    
    # Check for fine-tuned model first
    finetuned_model = None
    models_dir = "/workspace/trained_models"
    if os.path.exists(models_dir):
        kit_dirs = sorted([d for d in os.listdir(models_dir) if d.startswith("kit_")], reverse=True)
        for kd in kit_dirs:
            final_path_check = os.path.join(models_dir, kd, "final_model.pt")
            best_path_check = os.path.join(models_dir, kd, "best_model.pt")
            if os.path.exists(final_path_check):
                finetuned_model = final_path_check
                break
            elif os.path.exists(best_path_check):
                finetuned_model = best_path_check
                break
    
    print("[SAO Music] Loading Stable Audio Open model...")
    model, model_config = get_pretrained_model("stabilityai/stable-audio-open-1.0")
    sample_rate = model_config["sample_rate"]
    sample_size = model_config["sample_size"]
    model = model.to(device)
    
    if finetuned_model:
        try:
            print(f"[SAO Music] Loading fine-tuned weights from {finetuned_model}")
            checkpoint = torch.load(finetuned_model, map_location=device)
            state_dict = checkpoint.get("model_state_dict", checkpoint)
            model.load_state_dict(state_dict, strict=False)
            kit_name = checkpoint.get("kit_name", "custom")
            genre = checkpoint.get("genre", "unknown")
            print(f"[SAO Music] Fine-tuned model loaded: {kit_name} ({genre})")
        except Exception as e:
            print(f"[SAO Music] Could not load fine-tuned model, using base: {e}")
    else:
        print("[SAO Music] Using base Stable Audio Open model (no fine-tuned model found)")
    
    model.eval()
    
    conditioning = [{
        "prompt": prompt,
        "seconds_start": 0,
        "seconds_total": min(duration_seconds, 47)
    }]
    
    print(f"[SAO Music] Generating audio... prompt: {prompt[:150]}")
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

function buildHeartMuLaGenerationScript(
  songId: number,
  prompt: string,
  lyrics: string,
  tags: string,
  duration: number,
  webhookUrl: string
): string {
  const safePrompt = prompt.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
  const safeLyrics = lyrics.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
  const safeTags = tags.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
  const hfToken = process.env.HF_TOKEN || "";
  const durationMs = Math.min(duration * 1000, 240000);

  return `
import json
import os
import sys
import time
import subprocess
import requests

song_id = ${songId}
prompt = "${safePrompt}"
lyrics_text = """${safeLyrics}"""
tags_text = """${safeTags}"""
duration_ms = ${durationMs}
webhook_url = "${webhookUrl}"
hf_token = "${hfToken}"

if hf_token:
    os.environ["HF_TOKEN"] = hf_token
    os.environ["HUGGING_FACE_HUB_TOKEN"] = hf_token

print(f"[HeartMuLa] Starting generation for song {song_id}")
print(f"[HeartMuLa] Tags: {tags_text[:200]}")
print(f"[HeartMuLa] Lyrics: {lyrics_text[:200]}...")
print(f"[HeartMuLa] Duration: {duration_ms}ms")

output_dir = "/workspace/generated_music"
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, f"song_{song_id}_{int(time.time())}.mp3")

def send_result(audio_file, gen_time, device):
    import base64
    with open(audio_file, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode("utf-8")
    file_size = os.path.getsize(audio_file)
    result = {
        "songId": song_id,
        "status": "completed",
        "audioBase64": audio_b64,
        "audioFormat": "mp3",
        "sampleRate": 44100,
        "duration": duration_ms // 1000,
        "generationTime": round(gen_time, 1),
        "fileSize": file_size,
        "device": device,
        "engine": "heartmula"
    }
    print(f"[HeartMuLa] Sending webhook ({file_size / 1024 / 1024:.1f}MB)...")
    resp = requests.post(webhook_url, json=result, timeout=120, headers={"Content-Type": "application/json"})
    print(f"[HeartMuLa] Webhook response: {resp.status_code}")

def send_error(error_msg):
    try:
        requests.post(webhook_url, json={
            "songId": song_id,
            "status": "failed",
            "error": error_msg,
            "engine": "heartmula"
        }, timeout=30)
    except Exception as we:
        print(f"[HeartMuLa] Error webhook failed: {we}")

try:
    # === STEP 1: Ensure heartlib is installed ===
    try:
        from heartlib import HeartMuLaGenPipeline
        print("[HeartMuLa] heartlib already installed")
    except ImportError:
        print("[HeartMuLa] Installing heartlib...")
        heartlib_dir = "/workspace/heartlib"
        if not os.path.exists(heartlib_dir):
            subprocess.run(["git", "clone", "https://github.com/HeartMuLa/heartlib.git", heartlib_dir], check=True, timeout=120)
        subprocess.run([sys.executable, "-m", "pip", "install", "-e", heartlib_dir, "--quiet"], check=True, timeout=300)
        from heartlib import HeartMuLaGenPipeline
        print("[HeartMuLa] heartlib installed successfully")

    # === STEP 2: Download model checkpoints if needed ===
    ckpt_dir = "/workspace/heartmula_ckpt"
    mula_dir = os.path.join(ckpt_dir, "HeartMuLa-oss-3B")
    codec_dir = os.path.join(ckpt_dir, "HeartCodec-oss")
    gen_config = os.path.join(ckpt_dir, "gen_config.json")
    tokenizer = os.path.join(ckpt_dir, "tokenizer.json")

    if not os.path.exists(gen_config) or not os.path.exists(tokenizer):
        print("[HeartMuLa] Downloading base config files...")
        subprocess.run([
            sys.executable, "-m", "huggingface_hub", "download",
            "--local-dir", ckpt_dir,
            "HeartMuLa/HeartMuLaGen",
            "--include", "gen_config.json", "tokenizer.json"
        ], check=True, timeout=300)

    if not os.path.exists(mula_dir) or len(os.listdir(mula_dir)) < 2:
        print("[HeartMuLa] Downloading HeartMuLa-RL-oss-3B model...")
        os.makedirs(mula_dir, exist_ok=True)
        subprocess.run([
            sys.executable, "-m", "huggingface_hub", "download",
            "--local-dir", mula_dir,
            "HeartMuLa/HeartMuLa-RL-oss-3B-20260123"
        ], check=True, timeout=600)

    if not os.path.exists(codec_dir) or len(os.listdir(codec_dir)) < 2:
        print("[HeartMuLa] Downloading HeartCodec model...")
        os.makedirs(codec_dir, exist_ok=True)
        subprocess.run([
            sys.executable, "-m", "huggingface_hub", "download",
            "--local-dir", codec_dir,
            "HeartMuLa/HeartCodec-oss-20260123"
        ], check=True, timeout=600)

    print("[HeartMuLa] All checkpoints ready")

    # === STEP 3: Write lyrics and tags to temp files ===
    lyrics_file = os.path.join(output_dir, f"lyrics_{song_id}.txt")
    tags_file = os.path.join(output_dir, f"tags_{song_id}.txt")

    with open(lyrics_file, "w", encoding="utf-8") as f:
        f.write(lyrics_text)
    with open(tags_file, "w", encoding="utf-8") as f:
        f.write(tags_text)

    print(f"[HeartMuLa] Lyrics file: {lyrics_file}")
    print(f"[HeartMuLa] Tags file: {tags_file}")

    # === STEP 4: Load pipeline and generate ===
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[HeartMuLa] Device: {device} | GPU: {torch.cuda.get_device_name(0) if device == 'cuda' else 'N/A'}")

    print("[HeartMuLa] Loading HeartMuLa pipeline...")
    pipe = HeartMuLaGenPipeline.from_pretrained(
        ckpt_dir,
        device={
            "mula": torch.device(device),
            "codec": torch.device(device),
        },
        dtype={
            "mula": torch.bfloat16 if device == "cuda" else torch.float32,
            "codec": torch.float32,
        },
        version="3B",
        lazy_load=True,
    )
    print("[HeartMuLa] Pipeline loaded, starting generation...")

    gen_start = time.time()

    with torch.no_grad():
        pipe(
            {
                "lyrics": lyrics_file,
                "tags": tags_file,
            },
            max_audio_length_ms=duration_ms,
            save_path=output_path,
            topk=50,
            temperature=1.0,
            cfg_scale=1.5,
        )

    gen_time = time.time() - gen_start

    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
        print(f"[HeartMuLa] Generated audio in {gen_time:.1f}s ({os.path.getsize(output_path) / 1024 / 1024:.1f}MB)")
        send_result(output_path, gen_time, device)
    else:
        send_error("HeartMuLa generated empty output")

    # Cleanup temp files
    for f in [lyrics_file, tags_file]:
        try:
            os.remove(f)
        except:
            pass

    # Free GPU memory
    del pipe
    if device == "cuda":
        torch.cuda.empty_cache()

except Exception as e:
    print(f"[HeartMuLa] Generation failed: {e}")
    import traceback
    traceback.print_exc()
    send_error(str(e))

print(f"[HeartMuLa] Job complete for song {song_id}")
`;
}

export async function submitHeartMuLaGeneration(
  songId: number,
  prompt: string,
  lyrics: string,
  tags: string,
  duration: number
): Promise<RunPodMusicResult> {
  const server = await resolveJupyterServer();
  if (!server) {
    return { success: false, jobId: "", error: "No cloud server configured" };
  }
  const { base, token } = server;

  const webhookUrl = getRunPodMusicWebhookUrl();
  const script = buildHeartMuLaGenerationScript(songId, prompt, lyrics, tags, duration, webhookUrl);
  const jobId = `heartmula_${songId}_${Date.now()}`;

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

    console.log(`[HeartMuLa] Submitting generation for song ${songId}, kernel ${kernelId}`);

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

      const msgId = `heartmula_${Date.now()}_${Math.random().toString(36).substring(7)}`;
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
        console.log(`[HeartMuLa] Script sent to kernel`);
      });

      ws.on("message", (data: any) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.parent_header?.msg_id !== msgId) return;

          if (msg.msg_type === "stream") {
            const text = msg.content?.text || "";
            if (text.includes("[HeartMuLa]")) {
              console.log(`[HeartMuLa GPU] ${text.trim()}`);
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
            console.log(`[HeartMuLa] Kernel accepted job, script is running`);
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

    console.log(`[HeartMuLa] Job ${jobId} submitted successfully`);
    return { success: true, jobId };

  } catch (err: any) {
    console.error(`[HeartMuLa] Submission failed:`, err.message);
    return { success: false, jobId, error: err.message };
  }
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
        const token = process.env.RUNPOD_JUPYTER_TOKEN || stemServer.jupyterToken || "";
        return { base: buildJupyterUrl(stemServer.baseUrl, port), token };
      }
    }
    if (server && server.baseUrl) {
      const port = server.jupyterPort || 8888;
      const token = process.env.RUNPOD_JUPYTER_TOKEN || server.jupyterToken || "";
      return { base: buildJupyterUrl(server.baseUrl, port), token };
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
