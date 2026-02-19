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
  console.log(`[Webhook] Music URL resolved to: ${url}`);
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
import sys
import time
import requests
import subprocess

# Fix GPU device mapping (RunPod may assign as /dev/nvidia4 instead of /dev/nvidia0)
if not os.path.exists("/dev/nvidia0"):
    for i in range(8):
        dev = f"/dev/nvidia{i}"
        if os.path.exists(dev) and i != 0:
            try:
                os.symlink(dev, "/dev/nvidia0")
                print(f"[SAO Music] Created symlink /dev/nvidia0 -> {dev}")
            except OSError:
                pass
            break

# Add HeartMuse venv for correct PyTorch
hm_site = "/workspace/HeartMuse/venv/lib/python3.11/site-packages"
if os.path.exists(hm_site) and hm_site not in sys.path:
    sys.path.insert(0, hm_site)

os.environ["TMPDIR"] = "/workspace/tmp"
os.makedirs("/workspace/tmp", exist_ok=True)

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

def upload_audio(audio_file):
    upload_secret = os.environ.get("RUNPOD_UPLOAD_SECRET", "")
    upload_url_env = os.environ.get("RUNPOD_UPLOAD_URL", "")
    if upload_url_env:
        upload_url = upload_url_env
    else:
        base_url = webhook_url.rsplit("/api/", 1)[0]
        upload_url = f"{base_url}/api/upload/runpod-audio"
    file_size = os.path.getsize(audio_file) / 1024 / 1024
    print(f"[SAO Music] Uploading {file_size:.1f}MB to {upload_url}")
    for attempt in range(3):
        try:
            with open(audio_file, "rb") as f:
                data = {"song_id": str(song_id), "duration": str(duration_seconds), "engine": "sao"}
                if upload_secret:
                    data["upload_secret"] = upload_secret
                resp = requests.post(upload_url, files={"audio": (os.path.basename(audio_file), f, "audio/mpeg")}, data=data, timeout=180)
            if resp.status_code < 400:
                print(f"[SAO Music] Upload success: {resp.text[:200]}")
                return True
        except Exception as e:
            print(f"[SAO Music] Upload attempt {attempt+1} failed: {e}")
        if attempt < 2:
            time.sleep(5)
    return False

def send_result(audio_file, gen_time, device, sample_rate):
    if upload_audio(audio_file):
        print(f"[SAO Music] Delivered via file upload")
        return
    
    import base64
    file_size = os.path.getsize(audio_file)
    if file_size > 20 * 1024 * 1024:
        print(f"[SAO Music] File too large for base64 ({file_size / 1024 / 1024:.1f}MB) and upload failed")
        return
    with open(audio_file, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode("utf-8")
    
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
        "device": device,
        "engine": "sao"
    }
    
    print(f"[SAO Music] Fallback: sending base64 ({file_size / 1024 / 1024:.1f}MB)...")
    for attempt in range(3):
        try:
            resp = requests.post(webhook_url, json=result, timeout=120, headers={"Content-Type": "application/json"})
            print(f"[SAO Music] Webhook response: {resp.status_code}")
            if resp.status_code < 400:
                return
        except Exception as e:
            print(f"[SAO Music] Webhook attempt {attempt+1} failed: {e}")
        if attempt < 2:
            time.sleep(5)
    print("[SAO Music] WARNING: All delivery attempts failed, audio saved locally at: " + audio_file)

def send_error(error_msg):
    for attempt in range(3):
        try:
            resp = requests.post(webhook_url, json={
                "songId": song_id,
                "status": "failed",
                "error": error_msg,
                "engine": "sao"
            }, timeout=30)
            if resp.status_code < 400:
                return
        except Exception as we:
            print(f"[SAO Music] Error webhook attempt {attempt+1} failed: {we}")
        if attempt < 2:
            time.sleep(3)
    print(f"[SAO Music] WARNING: Could not report error to server: {error_msg}")

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
  const durationMs = Math.min(duration * 1000, 300000);

  return `
import gc
import json
import os
import sys
import time
import subprocess
import logging

logging.getLogger("torchtune.modules.attention").setLevel(logging.ERROR)

# === STEP 0: Fix GPU device mapping ===
# RunPod may assign GPU as /dev/nvidia4 instead of /dev/nvidia0
# Create symlink so CUDA can find the device
def fix_gpu_device():
    if os.path.exists("/dev/nvidia0"):
        return True
    for i in range(8):
        dev = f"/dev/nvidia{i}"
        if os.path.exists(dev) and i != 0:
            try:
                os.symlink(dev, "/dev/nvidia0")
                print(f"[HeartMuLa] Created symlink /dev/nvidia0 -> {dev}")
                return True
            except OSError:
                pass
    return False

fix_gpu_device()

# Add HeartMuse venv packages to path for correct PyTorch
hm_site = "/workspace/HeartMuse/venv/lib/python3.11/site-packages"
if os.path.exists(hm_site) and hm_site not in sys.path:
    sys.path.insert(0, hm_site)

# Also add heartlib
heartlib_src = "/workspace/HeartMuse/heartlib/src"
if os.path.exists(heartlib_src) and heartlib_src not in sys.path:
    sys.path.insert(0, heartlib_src)
heartlib_src2 = "/workspace/heartlib/src"
if os.path.exists(heartlib_src2) and heartlib_src2 not in sys.path:
    sys.path.insert(0, heartlib_src2)

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

os.environ["TMPDIR"] = "/workspace/tmp"
os.makedirs("/workspace/tmp", exist_ok=True)

print(f"[HeartMuLa] Starting generation for song {song_id}")
print(f"[HeartMuLa] Tags: {tags_text[:200]}")
print(f"[HeartMuLa] Lyrics: {lyrics_text[:200]}...")
print(f"[HeartMuLa] Duration: {duration_ms}ms")

output_dir = "/workspace/generated_music"
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, f"song_{song_id}_{int(time.time())}.mp3")

def upload_audio(audio_file):
    upload_secret = os.environ.get("RUNPOD_UPLOAD_SECRET", "")
    upload_url_env = os.environ.get("RUNPOD_UPLOAD_URL", "")
    if upload_url_env:
        upload_url = upload_url_env
    else:
        base_url = webhook_url.rsplit("/api/", 1)[0]
        upload_url = f"{base_url}/api/upload/runpod-audio"
    file_size = os.path.getsize(audio_file) / 1024 / 1024
    print(f"[HeartMuLa] Uploading {file_size:.1f}MB to {upload_url}")
    for attempt in range(3):
        try:
            with open(audio_file, "rb") as f:
                data = {"song_id": str(song_id), "duration": str(duration_ms // 1000), "engine": "heartmula"}
                if upload_secret:
                    data["upload_secret"] = upload_secret
                resp = requests.post(upload_url, files={"audio": (os.path.basename(audio_file), f, "audio/mpeg")}, data=data, timeout=180)
            if resp.status_code < 400:
                print(f"[HeartMuLa] Upload success: {resp.text[:200]}")
                return True
        except Exception as e:
            print(f"[HeartMuLa] Upload attempt {attempt+1} failed: {e}")
        if attempt < 2:
            time.sleep(5)
    return False

def send_result(audio_file, gen_time, device):
    if upload_audio(audio_file):
        print(f"[HeartMuLa] Delivered via file upload")
        return
    
    import base64
    file_size = os.path.getsize(audio_file)
    if file_size > 20 * 1024 * 1024:
        print(f"[HeartMuLa] File too large for base64 ({file_size / 1024 / 1024:.1f}MB) and upload failed")
        return
    with open(audio_file, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode("utf-8")
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
    print(f"[HeartMuLa] Fallback: sending base64 ({file_size / 1024 / 1024:.1f}MB)...")
    for attempt in range(3):
        try:
            resp = requests.post(webhook_url, json=result, timeout=120, headers={"Content-Type": "application/json"})
            print(f"[HeartMuLa] Webhook response: {resp.status_code}")
            if resp.status_code < 400:
                return
        except Exception as e:
            print(f"[HeartMuLa] Webhook attempt {attempt+1} failed: {e}")
        if attempt < 2:
            time.sleep(5 * (attempt + 1))
    print("[HeartMuLa] WARNING: All delivery attempts failed, audio saved locally at: " + audio_file)

def send_error(error_msg):
    for attempt in range(3):
        try:
            resp = requests.post(webhook_url, json={
                "songId": song_id,
                "status": "failed",
                "error": error_msg,
                "engine": "heartmula"
            }, timeout=30)
            if resp.status_code < 400:
                return
        except Exception as we:
            print(f"[HeartMuLa] Error webhook attempt {attempt+1} failed: {we}")
        if attempt < 2:
            time.sleep(3)
    print(f"[HeartMuLa] WARNING: Could not report error to server: {error_msg}")

pipe = None
try:
    # === STEP 1: Ensure heartlib is available ===
    try:
        from heartlib import HeartMuLaGenPipeline
        print("[HeartMuLa] heartlib available")
    except ImportError:
        print("[HeartMuLa] Installing heartlib...")
        heartlib_dir = "/workspace/heartlib"
        if not os.path.exists(heartlib_dir):
            subprocess.run(["git", "clone", "https://github.com/HeartMuLa/heartlib.git", heartlib_dir], check=True, timeout=120)
        subprocess.run([sys.executable, "-m", "pip", "install", "-e", heartlib_dir, "--quiet"], capture_output=True, text=True, timeout=300)
        src = os.path.join(heartlib_dir, "src")
        if os.path.exists(src) and src not in sys.path:
            sys.path.insert(0, src)
        from heartlib import HeartMuLaGenPipeline
        print("[HeartMuLa] heartlib installed")

    # === STEP 2: Resolve checkpoint directory ===
    # Check HeartMuse ckpt dir first (if HeartMuse was installed), then fallback
    ckpt_dir = None
    for candidate in ["/workspace/HeartMuse/ckpt", "/workspace/heartmula_ckpt"]:
        gen_cfg = os.path.join(candidate, "gen_config.json")
        tok = os.path.join(candidate, "tokenizer.json")
        if os.path.isfile(gen_cfg) and os.path.isfile(tok):
            ckpt_dir = candidate
            break

    if ckpt_dir is None:
        ckpt_dir = "/workspace/HeartMuse/ckpt"
        os.makedirs(ckpt_dir, exist_ok=True)

    # Use HeartMuLa 3B-RL variant (recommended by HeartMuse)
    model_version = "3B-RL"
    mula_dir = os.path.join(ckpt_dir, "HeartMuLa-oss-3B-RL")
    # Also check legacy directory name
    mula_dir_legacy = os.path.join(ckpt_dir, "HeartMuLa-oss-3B")
    codec_dir = os.path.join(ckpt_dir, "HeartCodec-oss")
    gen_config = os.path.join(ckpt_dir, "gen_config.json")
    tokenizer = os.path.join(ckpt_dir, "tokenizer.json")

    if not os.path.exists(gen_config) or not os.path.exists(tokenizer):
        print("[HeartMuLa] Downloading config files...")
        from huggingface_hub import hf_hub_download
        for fname in ["gen_config.json", "tokenizer.json"]:
            hf_hub_download("HeartMuLa/HeartMuLaGen", fname, local_dir=ckpt_dir)

    # Check if RL model exists (preferred), fallback to base
    if os.path.isdir(mula_dir) and len(os.listdir(mula_dir)) >= 2:
        print(f"[HeartMuLa] Using RL model from {mula_dir}")
    elif os.path.isdir(mula_dir_legacy) and len(os.listdir(mula_dir_legacy)) >= 2:
        print(f"[HeartMuLa] Using base model from {mula_dir_legacy}")
        model_version = "3B"
    else:
        print("[HeartMuLa] Downloading HeartMuLa-RL-oss-3B model...")
        os.makedirs(mula_dir, exist_ok=True)
        from huggingface_hub import snapshot_download
        snapshot_download(repo_id="HeartMuLa/HeartMuLa-RL-oss-3B-20260123", local_dir=mula_dir)

    if not os.path.isdir(codec_dir) or len(os.listdir(codec_dir)) < 2:
        print("[HeartMuLa] Downloading HeartCodec model...")
        os.makedirs(codec_dir, exist_ok=True)
        from huggingface_hub import snapshot_download
        snapshot_download(repo_id="HeartMuLa/HeartCodec-oss-20260123", local_dir=codec_dir)

    print(f"[HeartMuLa] Checkpoints ready (variant={model_version}, dir={ckpt_dir})")

    # === STEP 3: Write lyrics and tags to temp files ===
    lyrics_file = os.path.join(output_dir, f"lyrics_{song_id}.txt")
    tags_file = os.path.join(output_dir, f"tags_{song_id}.txt")

    with open(lyrics_file, "w", encoding="utf-8") as f:
        f.write(lyrics_text)
    with open(tags_file, "w", encoding="utf-8") as f:
        f.write(tags_text)

    # === STEP 4: Load pipeline and generate ===
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    gpu_name = "N/A"
    if device == "cuda":
        gpu_name = torch.cuda.get_device_name(0)
        props = torch.cuda.get_device_properties(0)
        vram = round(props.total_memory / 1024**3, 1)
        print(f"[HeartMuLa] GPU: {gpu_name} ({vram}GB VRAM)")
    else:
        print("[HeartMuLa] WARNING: CUDA not available, using CPU (very slow)")

    print(f"[HeartMuLa] Loading pipeline (version={model_version}, lazy_load=True)...")
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
        version=model_version,
        lazy_load=True,
    )
    print("[HeartMuLa] Pipeline loaded, generating...")

    gen_start = time.time()

    import random
    seed = random.randint(0, 2**32 - 1)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

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
        print(f"[HeartMuLa] Generated audio in {gen_time:.1f}s ({os.path.getsize(output_path) / 1024 / 1024:.1f}MB) seed={seed}")
        send_result(output_path, gen_time, device)
    else:
        send_error("HeartMuLa generated empty output")

    for f in [lyrics_file, tags_file]:
        try:
            os.remove(f)
        except:
            pass

except Exception as e:
    print(f"[HeartMuLa] Generation failed: {e}")
    import traceback
    traceback.print_exc()
    send_error(str(e))

finally:
    # Always free GPU memory
    try:
        if pipe is not None:
            del pipe
        gc.collect()
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except:
        pass

print(f"[HeartMuLa] Job complete for song {song_id}")
`;
}

async function ensureIdleKernel(base: string, headers: Record<string, string>): Promise<string> {
  const listRes = await fetchWithTimeout(`${base}/api/kernels`, { headers }, 15000);
  if (!listRes.ok) throw new Error(`Cannot list kernels: ${listRes.status}`);

  const kernels = await listRes.json();

  if (Array.isArray(kernels) && kernels.length > 0) {
    const kernel = kernels[0];
    if (kernel.execution_state === "busy") {
      console.log(`[GPU] Kernel ${kernel.id} is busy (stuck), restarting...`);
      const restartRes = await fetchWithTimeout(
        `${base}/api/kernels/${kernel.id}/restart`,
        { method: "POST", headers },
        20000
      );
      if (restartRes.ok) {
        console.log(`[GPU] Kernel restarted successfully`);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        console.log(`[GPU] Kernel restart failed (${restartRes.status}), deleting and creating new...`);
        await fetchWithTimeout(`${base}/api/kernels/${kernel.id}`, { method: "DELETE", headers }, 10000).catch(() => {});
        const createRes = await fetchWithTimeout(`${base}/api/kernels`, {
          method: "POST", headers, body: JSON.stringify({ name: "python3" }),
        }, 15000);
        if (!createRes.ok) throw new Error(`Failed to create kernel: ${createRes.status}`);
        const newKernel = await createRes.json();
        await new Promise(r => setTimeout(r, 2000));
        return newKernel.id;
      }
    }
    return kernel.id;
  }

  const createRes = await fetchWithTimeout(`${base}/api/kernels`, {
    method: "POST", headers, body: JSON.stringify({ name: "python3" }),
  }, 15000);
  if (!createRes.ok) throw new Error(`Failed to create kernel: ${createRes.status}`);
  const kernel = await createRes.json();
  return kernel.id;
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

    const kernelId = await ensureIdleKernel(base, headers);

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
            if (text.trim()) {
              console.log(`[HeartMuLa GPU] ${text.trim().substring(0, 500)}`);
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

    const kernelId = await ensureIdleKernel(base, headers);

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

export async function runGpuDiagnostics(): Promise<{output: string[], errors: string[], status: string}> {
  const server = await resolveJupyterServer();
  if (!server) return { output: [], errors: ["No GPU server configured"], status: "error" };
  const { base, token } = server;

  const diagLines = [
    "import json, os, sys, subprocess",
    "",
    "# Fix GPU device mapping (RunPod assigns /dev/nvidia4 instead of /dev/nvidia0)",
    "if not os.path.exists('/dev/nvidia0'):",
    "    for i in range(8):",
    "        dev = f'/dev/nvidia{i}'",
    "        if os.path.exists(dev) and i != 0:",
    "            try:",
    "                os.symlink(dev, '/dev/nvidia0')",
    "            except OSError:",
    "                pass",
    "            break",
    "",
    "# Use HeartMuse venv for correct PyTorch",
    "hm_site = '/workspace/HeartMuse/venv/lib/python3.11/site-packages'",
    "if os.path.exists(hm_site) and hm_site not in sys.path:",
    "    sys.path.insert(0, hm_site)",
    "",
    'result = {"packages": {}, "gpu": {}, "workspace": {}, "install_test": {}, "device_fix": {}}',
    "",
    "# Check GPU device mapping",
    'result["device_fix"]["nvidia0_exists"] = os.path.exists("/dev/nvidia0")',
    'result["device_fix"]["nvidia0_target"] = os.readlink("/dev/nvidia0") if os.path.islink("/dev/nvidia0") else "real_device"',
    'nvidia_devs = [f for f in os.listdir("/dev") if f.startswith("nvidia")]',
    'result["device_fix"]["all_nvidia_devs"] = sorted(nvidia_devs)',
    "",
    "try:",
    "    import torch",
    '    result["gpu"]["torch"] = torch.__version__',
    '    result["gpu"]["cuda_available"] = torch.cuda.is_available()',
    "    if torch.cuda.is_available():",
    '        result["gpu"]["device_name"] = torch.cuda.get_device_name(0)',
    '        result["gpu"]["memory_gb"] = round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 1)',
    '        result["gpu"]["arch_list"] = torch.cuda.get_arch_list()',
    "except Exception as e:",
    '    result["gpu"]["error"] = str(e)',
    "",
    'for pkg_name, import_name in [("heartlib", "heartlib"), ("stable_audio_tools", "stable_audio_tools"), ("torchaudio", "torchaudio"), ("diffusers", "diffusers"), ("huggingface_hub", "huggingface_hub"), ("soundfile", "soundfile")]:',
    "    try:",
    "        mod = __import__(import_name)",
    '        result["packages"][pkg_name] = getattr(mod, "__version__", "installed")',
    "    except ImportError as e:",
    '        result["packages"][pkg_name] = "MISSING: " + str(e)',
    "",
    'workspace = "/workspace"',
    "if os.path.exists(workspace):",
    '    result["workspace"]["contents"] = sorted(os.listdir(workspace))',
    '    for ckpt_name in ["HeartMuse/ckpt", "heartmula_ckpt"]:',
    '        ckpt_dir = os.path.join(workspace, ckpt_name)',
    "        if os.path.exists(ckpt_dir):",
    '            result["workspace"]["ckpt_dir"] = ckpt_dir',
    '            result["workspace"]["ckpt_contents"] = sorted(os.listdir(ckpt_dir))',
    '            for mula_name in ["HeartMuLa-oss-3B-RL", "HeartMuLa-oss-3B"]:',
    '                mula_dir = os.path.join(ckpt_dir, mula_name)',
    "                if os.path.exists(mula_dir):",
    '                    result["workspace"]["mula_model"] = mula_name',
    '                    result["workspace"]["mula_files"] = sorted(os.listdir(mula_dir))[:10]',
    "                    break",
    '            codec_dir = os.path.join(ckpt_dir, "HeartCodec-oss")',
    "            if os.path.exists(codec_dir):",
    '                result["workspace"]["codec_files"] = sorted(os.listdir(codec_dir))[:10]',
    "            break",
    '    hm_dir = os.path.join(workspace, "HeartMuse")',
    "    if os.path.exists(hm_dir):",
    '        result["workspace"]["heartmuse_installed"] = True',
    '        result["workspace"]["heartmuse_venv"] = os.path.exists(os.path.join(hm_dir, "venv"))',
    '    heartlib_dir = os.path.join(workspace, "heartlib")',
    "    if os.path.exists(heartlib_dir):",
    '        result["workspace"]["heartlib_dir"] = sorted(os.listdir(heartlib_dir))[:10]',
    "",
    "try:",
    '    r = subprocess.run([sys.executable, "-c", "import sys; sys.path.insert(0, \'/workspace/heartlib/src\'); from heartlib import HeartMuLaGenPipeline; print(\'OK\')"], capture_output=True, text=True, timeout=30)',
    '    result["install_test"]["heartlib_import"] = r.stdout.strip() if r.returncode == 0 else "FAILED"',
    "    if r.returncode != 0:",
    '        result["install_test"]["heartlib_error"] = r.stderr[-500:] if r.stderr else "unknown error"',
    "except Exception as e:",
    '    result["install_test"]["heartlib_error"] = str(e)',
    "",
    "result['python'] = sys.version",
    'result["pip_packages"] = subprocess.run([sys.executable, "-m", "pip", "list", "--format=columns"], capture_output=True, text=True, timeout=30).stdout[-2000:]',
    "",
    `webhook_test_url = "${getRunPodMusicWebhookUrl().replace('/api/webhooks/runpod-music', '/api/health')}"`,
    "try:",
    "    import requests as req",
    "    wr = req.get(webhook_test_url, timeout=10)",
    '    result["webhook_connectivity"] = {"url": webhook_test_url, "status": wr.status_code, "reachable": True}',
    "except Exception as we:",
    '    result["webhook_connectivity"] = {"url": webhook_test_url, "status": str(we), "reachable": False}',
    "",
    'print("DIAG_RESULT:" + json.dumps(result))',
  ];
  const diagScript = diagLines.join("\n");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "token " + token;

  let kernelId: string;
  try {
    kernelId = await ensureIdleKernel(base, headers);
  } catch (err: any) {
    return { output: [], errors: ["Cannot get idle kernel: " + err.message], status: "error" };
  }

  const wsProtocol = base.startsWith("https") ? "wss" : "ws";
  const wsBase = base.replace(/^https?/, wsProtocol);
  const tokenParam = token ? "?token=" + token : "";

  return new Promise((resolve) => {
    const output: string[] = [];
    const errors: string[] = [];
    const timeoutHandle = setTimeout(() => {
      try { ws.close(); } catch {}
      resolve({ output, errors: [...errors, "Diagnostics timed out after 120s"], status: "timeout" });
    }, 120000);

    let ws: any;
    try {
      ws = new WebSocket(wsBase + "/api/kernels/" + kernelId + "/channels" + tokenParam);
    } catch (err: any) {
      clearTimeout(timeoutHandle);
      resolve({ output: [], errors: ["WebSocket failed: " + err.message], status: "error" });
      return;
    }

    const msgId = "diag_" + Date.now();

    ws.on("open", () => {
      ws.send(JSON.stringify({
        header: { msg_id: msgId, msg_type: "execute_request", username: "dgb_studio", session: "session_" + Date.now(), date: new Date().toISOString(), version: "5.3" },
        parent_header: {}, metadata: {},
        content: { code: diagScript, silent: false, store_history: false, user_expressions: {}, allow_stdin: false, stop_on_error: true },
        channel: "shell", buffers: [],
      }));
    });

    ws.on("message", (data: any) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.parent_header?.msg_id !== msgId) return;

        if (msg.msg_type === "stream") {
          const text = msg.content?.text || "";
          output.push(text);
        }
        if (msg.msg_type === "error") {
          errors.push(msg.content?.evalue || "Unknown error");
        }
        if (msg.msg_type === "execute_reply") {
          clearTimeout(timeoutHandle);
          ws.close();
          resolve({ output, errors, status: msg.content?.status || "ok" });
        }
      } catch {}
    });

    ws.on("error", (err: any) => {
      clearTimeout(timeoutHandle);
      resolve({ output, errors: ["WebSocket error: " + err.message], status: "error" });
    });
  });
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
