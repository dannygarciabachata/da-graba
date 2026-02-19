"""
DAGRABA Studio - RunPod Serverless Handler
Handles music generation (HeartMuLa/SAO), model training, and stem separation.
Deploy this as a RunPod Serverless worker.
"""

import os
import sys
import json
import time
import uuid
import shutil
import subprocess
import traceback
from pathlib import Path

try:
    import runpod
except ImportError:
    print("[FATAL] runpod package not installed")
    sys.exit(1)

NETWORK_VOLUME = Path("/runpod-volume")
WORKSPACE = NETWORK_VOLUME if NETWORK_VOLUME.exists() else Path("/workspace")
MODELS_DIR = WORKSPACE / "models"
OUTPUTS_DIR = WORKSPACE / "outputs"
DATASETS_DIR = WORKSPACE / "datasets"
TMP_DIR = WORKSPACE / "tmp"

for d in [MODELS_DIR, OUTPUTS_DIR, DATASETS_DIR, TMP_DIR]:
    d.mkdir(parents=True, exist_ok=True)

print(f"[Init] Using workspace: {WORKSPACE} (network volume: {NETWORK_VOLUME.exists()})")

os.environ["TMPDIR"] = str(TMP_DIR)

HF_TOKEN = os.environ.get("HF_TOKEN", "")
if HF_TOKEN:
    os.environ["HUGGING_FACE_HUB_TOKEN"] = HF_TOKEN

TORCH_AVAILABLE = False
NUMPY_AVAILABLE = False

try:
    import torch
    import torchaudio
    TORCH_AVAILABLE = True
    print(f"[Init] PyTorch {torch.__version__} loaded | CUDA: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"[Init] GPU: {torch.cuda.get_device_name(0)} | VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
except ImportError as e:
    print(f"[Init] WARNING: PyTorch not available: {e}")

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError as e:
    print(f"[Init] WARNING: NumPy not available: {e}")

try:
    import requests
except ImportError:
    print("[Init] WARNING: requests not available, webhooks disabled")
    requests = None

print(f"[Init] Worker ready | torch={TORCH_AVAILABLE} | numpy={NUMPY_AVAILABLE}")
print(f"[Init] Workspace: {WORKSPACE} | Models: {MODELS_DIR}")

existing_models = list(MODELS_DIR.glob("kit_*"))
if existing_models:
    print(f"[Init] Found {len(existing_models)} fine-tuned model(s): {[m.name for m in existing_models]}")
else:
    print("[Init] No fine-tuned models found (will use base SAO model)")

SAO_FINETUNE_REPO = "santifiorino/SAO-Instrumental-Finetune"
SAO_FINETUNE_CKPT = "SAO_Instrumental_Finetune.ckpt"
SAO_FINETUNE_DIR = MODELS_DIR / "sao_instrumental_finetune"
SAO_FINETUNE_DIR.mkdir(parents=True, exist_ok=True)
SAO_FINETUNE_PATH = SAO_FINETUNE_DIR / SAO_FINETUNE_CKPT

if SAO_FINETUNE_PATH.exists():
    print(f"[Init] SAO Instrumental Finetune checkpoint found ({SAO_FINETUNE_PATH.stat().st_size / 1024**3:.1f} GB)")
else:
    print(f"[Init] SAO Instrumental Finetune NOT cached. Will download on first use from {SAO_FINETUNE_REPO}")


def send_webhook(url: str, data: dict, retries: int = 2):
    if not url or not requests:
        return
    for attempt in range(retries + 1):
        try:
            resp = requests.post(url, json=data, timeout=30)
            print(f"[Webhook] Sent to {url}: {resp.status_code}")
            return
        except Exception as e:
            print(f"[Webhook] Attempt {attempt + 1} failed: {e}")
            if attempt < retries:
                time.sleep(5)


def upload_audio_file(webhook_url: str, audio_path: str, song_id: int, duration: int, engine: str, retries: int = 3) -> bool:
    """Upload audio file directly to server via multipart POST (like Kie.ai pattern).
    This avoids base64 size limits in RunPod output and webhook payloads."""
    if not requests or not webhook_url:
        return False
    
    upload_url = os.environ.get("RUNPOD_UPLOAD_URL", "")
    if not upload_url:
        base_url = webhook_url.rsplit("/api/", 1)[0]
        upload_url = f"{base_url}/api/upload/runpod-audio"
    
    upload_secret = os.environ.get("RUNPOD_UPLOAD_SECRET", "")
    
    file_size = os.path.getsize(audio_path) / 1024 / 1024
    print(f"[Upload] Uploading {file_size:.1f}MB audio file for song {song_id} to {upload_url}")
    
    for attempt in range(retries):
        try:
            with open(audio_path, "rb") as f:
                files = {"audio": (os.path.basename(audio_path), f, "audio/mpeg")}
                data = {
                    "song_id": str(song_id),
                    "duration": str(duration),
                    "engine": engine,
                }
                if upload_secret:
                    data["upload_secret"] = upload_secret
                resp = requests.post(upload_url, files=files, data=data, timeout=180)
            
            print(f"[Upload] Response: {resp.status_code} - {resp.text[:200]}")
            if resp.status_code < 400:
                result = resp.json()
                if result.get("status") in ("ok", "already_completed"):
                    print(f"[Upload] Song {song_id} audio delivered successfully")
                    return True
            print(f"[Upload] Attempt {attempt + 1} failed: HTTP {resp.status_code}")
        except Exception as e:
            print(f"[Upload] Attempt {attempt + 1} error: {e}")
        
        if attempt < retries - 1:
            time.sleep(5 * (attempt + 1))
    
    print(f"[Upload] All {retries} upload attempts failed for song {song_id}")
    return False


def get_device():
    if not TORCH_AVAILABLE:
        print("[GPU] PyTorch not available, cannot use GPU")
        return "cpu"
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        vram = torch.cuda.get_device_properties(0).total_memory / 1024**3
        print(f"[GPU] {gpu_name} | VRAM: {vram:.1f} GB")
        return "cuda"
    print("[GPU] No GPU detected, using CPU")
    return "cpu"


def download_sao_finetune():
    """Download the SAO Instrumental Finetune checkpoint from HuggingFace if not cached."""
    if SAO_FINETUNE_PATH.exists():
        print(f"[SAO-FT] Checkpoint already cached: {SAO_FINETUNE_PATH}")
        return SAO_FINETUNE_PATH

    print(f"[SAO-FT] Downloading {SAO_FINETUNE_CKPT} from {SAO_FINETUNE_REPO}...")
    try:
        from huggingface_hub import hf_hub_download
        downloaded = hf_hub_download(
            repo_id=SAO_FINETUNE_REPO,
            filename=SAO_FINETUNE_CKPT,
            local_dir=str(SAO_FINETUNE_DIR),
            token=HF_TOKEN or None,
        )
        print(f"[SAO-FT] Downloaded: {downloaded} ({os.path.getsize(downloaded) / 1024**3:.1f} GB)")
        return Path(downloaded)
    except Exception as e:
        print(f"[SAO-FT] Failed to download from HuggingFace: {e}")
        raise Exception(
            f"Cannot download SAO Instrumental Finetune from {SAO_FINETUNE_REPO}. "
            f"Ensure HF_TOKEN is set or pre-download the checkpoint to {SAO_FINETUNE_PATH}. Error: {e}"
        )


def load_sao_model(sao_model_variant, style_kit_id, device):
    """
    Load a Stable Audio Open model variant.
    
    sao_model_variant: 'instrumental_finetune' (default), 'base', or 'kit'
    style_kit_id: optional kit ID for custom fine-tuned models
    
    Returns: (model, model_config, variant_used)
    """
    try:
        from stable_audio_tools import get_pretrained_model
        from stable_audio_tools.inference.generation import generate_diffusion_cond
    except ImportError as e:
        raise Exception(f"stable-audio-tools not installed: {e}. Rebuild Docker image with: pip install stable-audio-tools")

    base_model_id = "stabilityai/stable-audio-open-1.0"

    print(f"[SAO] Loading base architecture: {base_model_id}")
    try:
        model, model_config = get_pretrained_model(base_model_id)
    except Exception as e:
        error_msg = str(e)
        if "401" in error_msg or "token" in error_msg.lower() or "authorization" in error_msg.lower():
            raise Exception(f"HuggingFace authentication failed. Set HF_TOKEN env var. Error: {error_msg}")
        elif "404" in error_msg or "not found" in error_msg.lower():
            raise Exception(f"Model {base_model_id} not found on HuggingFace. Error: {error_msg}")
        else:
            raise Exception(f"Failed to load SAO model: {error_msg}")

    model = model.to(device)
    variant_used = "base"

    kit_model_path = None
    if style_kit_id:
        kit_model_path = MODELS_DIR / f"kit_{style_kit_id}" / "model_final.pt"
        if not kit_model_path.exists():
            best_path = MODELS_DIR / f"kit_{style_kit_id}" / "best_model.pt"
            if best_path.exists():
                kit_model_path = best_path
                print(f"[SAO] Using best_model.pt for kit {style_kit_id}")
            else:
                print(f"[SAO] Kit {style_kit_id} model not found at {kit_model_path}")
                kit_model_path = None

    kit_loaded = False
    if kit_model_path and kit_model_path.exists():
        try:
            checkpoint = torch.load(str(kit_model_path), map_location=device, weights_only=False)
            if "model_state_dict" in checkpoint:
                model.load_state_dict(checkpoint["model_state_dict"], strict=False)
            else:
                model.load_state_dict(checkpoint, strict=False)
            print(f"[SAO] Style Kit {style_kit_id} weights loaded")
            variant_used = f"kit_{style_kit_id}"
            kit_loaded = True
        except Exception as e:
            print(f"[SAO] WARNING: Failed to load kit {style_kit_id} weights: {e}")
            print("[SAO] Falling back to instrumental finetune or base")

    if not kit_loaded and sao_model_variant != "base":
        try:
            ckpt_path = download_sao_finetune()
            checkpoint = torch.load(str(ckpt_path), map_location=device, weights_only=False)
            if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
                model.load_state_dict(checkpoint["state_dict"], strict=False)
            elif isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
                model.load_state_dict(checkpoint["model_state_dict"], strict=False)
            else:
                model.load_state_dict(checkpoint, strict=False)
            print(f"[SAO] Instrumental Finetune weights loaded successfully")
            variant_used = "instrumental_finetune"
        except Exception as e:
            print(f"[SAO] WARNING: Could not load Instrumental Finetune: {e}")
            print("[SAO] Continuing with base SAO 1.0 model")
            variant_used = "base"

    model.eval()
    return model, model_config, variant_used


def generate_sao(song_id, prompt, duration, style_kit_id, device, wav_path, sao_model="instrumental_finetune"):
    if not TORCH_AVAILABLE:
        raise Exception("PyTorch is not installed on this worker. Cannot generate audio.")

    from stable_audio_tools.inference.generation import generate_diffusion_cond

    model, model_config, variant_used = load_sao_model(sao_model, style_kit_id, device)
    sample_rate = model_config["sample_rate"]

    print(f"[SAO] Generating {duration}s audio with variant={variant_used}...")
    print(f"[SAO] Prompt: {prompt[:300]}")
    try:
        with torch.no_grad():
            output = generate_diffusion_cond(
                model,
                steps=100,
                cfg_scale=7,
                conditioning=[{"prompt": prompt, "seconds_start": 0, "seconds_total": duration}],
                sample_size=int(sample_rate * duration),
                sigma_min=0.3,
                sigma_max=500,
                sampler_type="dpmpp-3m-sde",
                device=device,
            )
    except torch.cuda.OutOfMemoryError:
        torch.cuda.empty_cache()
        print(f"[SAO] OOM with {duration}s, retrying with shorter duration...")
        shorter = min(duration, 30)
        with torch.no_grad():
            output = generate_diffusion_cond(
                model,
                steps=80,
                cfg_scale=7,
                conditioning=[{"prompt": prompt, "seconds_start": 0, "seconds_total": shorter}],
                sample_size=int(sample_rate * shorter),
                sigma_min=0.3,
                sigma_max=500,
                sampler_type="dpmpp-3m-sde",
                device=device,
            )

    audio = output.squeeze(0).cpu()
    if audio.dim() == 1:
        audio = audio.unsqueeze(0)

    try:
        torchaudio.save(wav_path, audio, sample_rate, backend="soundfile")
    except Exception:
        import soundfile as sf
        import numpy as np
        audio_np = audio.numpy()
        if audio_np.ndim == 2:
            audio_np = audio_np.T
        sf.write(wav_path, audio_np, sample_rate)
    print(f"[SAO] Audio saved: {wav_path} (variant={variant_used})")

    del model, output, audio
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    return {"audio_path": wav_path, "sample_rate": sample_rate, "sao_variant": variant_used}


def generate_heartmula(song_id, prompt, duration, lyrics, tags, genre, device, wav_path):
    heartmula_dir = WORKSPACE / "HeartMuse"
    if not heartmula_dir.exists():
        heartmula_dir = Path("/workspace/HeartMuse")
    if not heartmula_dir.exists():
        raise Exception("HeartMuLa model not available on this worker. Attach a Network Volume with the HeartMuse model, or use engine='sao' instead.")

    venv_site = heartmula_dir / "venv" / "lib" / "python3.11" / "site-packages"
    if venv_site.exists() and str(venv_site) not in sys.path:
        sys.path.insert(0, str(venv_site))

    generation_prompt = prompt
    if lyrics:
        generation_prompt += f"\n\nLyrics:\n{lyrics}"
    if tags:
        generation_prompt += f"\n\nTags: {tags}"
    if genre:
        generation_prompt += f"\n\nGenre: {genre}"

    print(f"[HeartMuLa] Generating with prompt length: {len(generation_prompt)} chars")

    try:
        sys.path.insert(0, str(heartmula_dir))
        from inference import generate_audio

        result = generate_audio(
            prompt=generation_prompt,
            duration=duration,
            output_path=wav_path,
            device=device,
        )
        print(f"[HeartMuLa] Generated: {wav_path}")
        return result

    except ImportError:
        safe_prompt = generation_prompt.replace("'", "\\'")
        script = f"""
import sys
sys.path.insert(0, "{heartmula_dir}")
from inference import generate_audio
generate_audio(
    prompt='''{safe_prompt}''',
    duration={duration},
    output_path="{wav_path}",
    device="{device}",
)
print("DONE")
"""
        result = subprocess.run(
            [sys.executable, "-c", script],
            capture_output=True, text=True, timeout=600,
            cwd=str(heartmula_dir)
        )
        if result.returncode != 0:
            raise Exception(f"HeartMuLa generation failed: {result.stderr[:500]}")
        return {"audio_path": wav_path}


# ============================================================
# ACTION: generate_music (HeartMuLa / Stable Audio Open)
# ============================================================
def handle_generate_music(job_input: dict) -> dict:
    song_id = job_input.get("song_id", 0)
    prompt = job_input.get("prompt", "")
    duration = job_input.get("duration_seconds", 30)
    engine = job_input.get("engine", "sao")
    webhook_url = job_input.get("webhook_url", "")
    lyrics = job_input.get("lyrics", "")
    tags = job_input.get("tags", "")
    genre = job_input.get("genre", "")
    style_kit_id = job_input.get("style_kit_id")
    sao_model = job_input.get("sao_model", "instrumental_finetune")

    if not prompt:
        return {"status": "failed", "error": "No prompt provided", "song_id": song_id}

    print(f"[Music] Song {song_id} | Engine: {engine} | SAO Model: {sao_model} | Duration: {duration}s")
    print(f"[Music] Prompt: {prompt[:200]}")
    if style_kit_id:
        print(f"[Music] Style Kit: {style_kit_id}")

    device = get_device()
    output_dir = OUTPUTS_DIR / "music"
    output_dir.mkdir(parents=True, exist_ok=True)
    wav_path = str(output_dir / f"song_{song_id}_{int(time.time())}.wav")
    mp3_path = wav_path.replace(".wav", ".mp3")

    try:
        if engine == "heartmula":
            result = generate_heartmula(song_id, prompt, duration, lyrics, tags, genre, device, wav_path)
        else:
            result = generate_sao(song_id, prompt, duration, style_kit_id, device, wav_path, sao_model=sao_model)

        if os.path.exists(wav_path):
            try:
                subprocess.run(
                    ["ffmpeg", "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", "192k", "-y", mp3_path],
                    capture_output=True, text=True, timeout=120
                )
                if os.path.exists(mp3_path):
                    mp3_size = os.path.getsize(mp3_path) / 1024 / 1024
                    print(f"[Music] MP3 converted: {mp3_path} ({mp3_size:.1f} MB)")
                    if mp3_size > 45:
                        mp3_path_lo = wav_path.replace(".wav", "_lo.mp3")
                        subprocess.run(
                            ["ffmpeg", "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", "128k", "-y", mp3_path_lo],
                            capture_output=True, text=True, timeout=120
                        )
                        if os.path.exists(mp3_path_lo):
                            os.replace(mp3_path_lo, mp3_path)
                            print(f"[Music] Re-encoded at 128k ({os.path.getsize(mp3_path) / 1024 / 1024:.1f} MB)")
            except Exception as e:
                print(f"[Music] MP3 conversion failed: {e}")

        final_path = mp3_path if os.path.exists(mp3_path) else wav_path

        audio_format = "mp3" if final_path.endswith(".mp3") else "wav"
        file_size = os.path.getsize(final_path)

        result_data = {
            "status": "completed",
            "song_id": song_id,
            "audio_path": final_path,
            "engine": engine,
            "audioFormat": audio_format,
            "fileSize": file_size,
        }

        uploaded = upload_audio_file(webhook_url, final_path, song_id, duration, engine)

        if uploaded:
            print(f"[Music] Song {song_id} delivered via file upload ({file_size / 1024 / 1024:.1f}MB)")
            result_data["delivered"] = True
        else:
            print(f"[Music] File upload failed, trying base64 fallback...")
            import base64
            max_b64_size = 20 * 1024 * 1024
            if file_size < max_b64_size:
                with open(final_path, "rb") as f:
                    audio_b64 = base64.b64encode(f.read()).decode("utf-8")
                result_data["audioBase64"] = audio_b64
                send_webhook(webhook_url, {
                    "songId": song_id,
                    "status": "completed",
                    "audioBase64": audio_b64,
                    "engine": engine,
                    "duration": duration,
                    "audioFormat": audio_format,
                })
                print(f"[Music] Fallback: sent base64 via webhook ({file_size / 1024:.0f} KB)")
            else:
                send_webhook(webhook_url, {
                    "songId": song_id,
                    "status": "completed",
                    "audioPath": final_path,
                    "engine": engine,
                    "duration": duration,
                    "audioFormat": audio_format,
                    "needsUpload": True,
                })
                print(f"[Music] WARNING: File too large for both upload and base64 ({file_size / 1024 / 1024:.1f}MB)")

        return result_data

    except Exception as e:
        error_msg = str(e)
        print(f"[Music] Generation failed: {traceback.format_exc()}")

        if TORCH_AVAILABLE and torch.cuda.is_available():
            torch.cuda.empty_cache()

        send_webhook(webhook_url, {
            "songId": song_id,
            "status": "failed",
            "error": error_msg,
            "engine": engine,
        })
        return {"status": "failed", "error": error_msg, "song_id": song_id}


# ============================================================
# ACTION: train_model (Stable Audio Open fine-tuning)
# ============================================================
def handle_train_model(job_input: dict) -> dict:
    if not TORCH_AVAILABLE:
        return {"status": "failed", "error": "PyTorch not available on this worker"}

    kit_id = job_input["kit_id"]
    kit_name = job_input.get("kit_name", f"Kit {kit_id}")
    genre = job_input.get("genre", "bachata")
    instruments = job_input.get("instruments", [])
    training_config = job_input.get("training_config", {})
    webhook_url = job_input.get("webhook_url", "")

    lr = training_config.get("learning_rate", 5e-5)
    batch_size = training_config.get("batch_size", 1)
    epochs = training_config.get("epochs", 100)

    print(f"[Train] Kit {kit_id}: {kit_name} | Genre: {genre}")
    print(f"[Train] {len(instruments)} instruments | epochs={epochs}, lr={lr}, batch={batch_size}")

    device = get_device()

    try:
        send_webhook(webhook_url, {
            "kitId": kit_id,
            "status": "training",
            "jobId": f"sao_kit_{kit_id}_{int(time.time())}",
            "message": f"Downloading {len(instruments)} instrument samples...",
        })

        dataset_dir = DATASETS_DIR / f"kit_{kit_id}"
        dataset_dir.mkdir(parents=True, exist_ok=True)

        downloaded = []
        for inst in instruments:
            audio_url = inst.get("audioUrl", "")
            if not audio_url:
                continue
            try:
                safe_name = inst["name"].replace(" ", "_").replace("/", "_")
                ext = "wav"
                if "." in audio_url.split("?")[0]:
                    ext = audio_url.split("?")[0].rsplit(".", 1)[-1].lower()
                fname = f"{inst['id']}_{safe_name}.{ext}"
                fpath = dataset_dir / fname

                resp = requests.get(audio_url, timeout=120)
                resp.raise_for_status()
                fpath.write_bytes(resp.content)

                wav_path = dataset_dir / f"{inst['id']}_{safe_name}.wav"
                if ext != "wav":
                    try:
                        result = subprocess.run(
                            ["ffmpeg", "-i", str(fpath), "-ar", "44100", "-ac", "2", str(wav_path), "-y"],
                            capture_output=True, text=True, timeout=60
                        )
                        if result.returncode == 0:
                            os.remove(str(fpath))
                            fpath = wav_path
                    except Exception:
                        pass

                downloaded.append({
                    "path": str(fpath),
                    "prompt": inst.get("prompt", f"{safe_name} instrument sound"),
                    "name": inst.get("name", ""),
                })
                print(f"[Train] Downloaded: {inst['name']} ({len(resp.content)} bytes)")
            except Exception as e:
                print(f"[Train] Failed to download {inst.get('name', '?')}: {e}")

        if not downloaded:
            raise Exception("No instrument samples could be downloaded")

        send_webhook(webhook_url, {
            "kitId": kit_id,
            "status": "training",
            "message": f"Data ready. Loading model for fine-tuning ({len(downloaded)} samples)...",
        })

        from stable_audio_tools import get_pretrained_model

        print("[Train] Loading Stable Audio Open base model...")
        model, model_config = get_pretrained_model("stabilityai/stable-audio-open-1.0")
        sample_rate = model_config["sample_rate"]
        model = model.to(device)
        model.train()

        audio_data = []
        for item in downloaded:
            try:
                waveform, sr = torchaudio.load(item["path"])
                if sr != sample_rate:
                    waveform = torchaudio.functional.resample(waveform, sr, sample_rate)
                if waveform.shape[0] == 1:
                    waveform = waveform.repeat(2, 1)
                elif waveform.shape[0] > 2:
                    waveform = waveform[:2]
                max_samples = sample_rate * 47
                if waveform.shape[1] > max_samples:
                    waveform = waveform[:, :max_samples]
                else:
                    pad = max_samples - waveform.shape[1]
                    waveform = torch.nn.functional.pad(waveform, (0, pad))
                audio_data.append({"waveform": waveform, "prompt": item["prompt"]})
                print(f"[Train] Loaded: {item['name']} ({waveform.shape[1] / sample_rate:.1f}s)")
            except Exception as e:
                print(f"[Train] Failed to load {item['path']}: {e}")

        if not audio_data:
            raise Exception("No valid audio files for training")

        trainable_params = []
        for name, param in model.named_parameters():
            if any(k in name.lower() for k in ["diffusion", "unet", "denoise", "noise_pred"]):
                param.requires_grad = True
                trainable_params.append(param)
            else:
                param.requires_grad = False

        if not trainable_params:
            for param in model.parameters():
                param.requires_grad = True
                trainable_params.append(param)
            print(f"[Train] Full fine-tune: {len(trainable_params)} param groups")
        else:
            total = sum(p.numel() for p in model.parameters())
            trainable = sum(p.numel() for p in trainable_params)
            print(f"[Train] Partial fine-tune: {trainable:,}/{total:,} params ({100 * trainable / total:.1f}%)")

        optimizer = torch.optim.AdamW(trainable_params, lr=lr, weight_decay=0.01)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
        scaler = torch.amp.GradScaler("cuda", enabled=device == "cuda")

        model_save_dir = MODELS_DIR / f"kit_{kit_id}"
        model_save_dir.mkdir(parents=True, exist_ok=True)

        best_loss = float("inf")
        train_start = time.time()

        diffusion_model = None
        conditioner = None
        for attr in ["model", "diffusion", "backbone"]:
            if hasattr(model, attr):
                diffusion_model = getattr(model, attr)
                break
        if diffusion_model is None:
            diffusion_model = model
        for attr in ["conditioner", "conditioning", "cond_stage_model"]:
            if hasattr(model, attr):
                conditioner = getattr(model, attr)
                break

        for epoch in range(epochs):
            epoch_loss = 0.0
            n_batches = 0

            for item in audio_data:
                audio_batch = item["waveform"].unsqueeze(0).to(device)
                try:
                    noise = torch.randn_like(audio_batch)
                    sigma = torch.rand(1, device=device) * 499.7 + 0.3
                    sigma = sigma.view(-1, 1, 1)
                    noisy_audio = audio_batch + noise * sigma

                    cond_input = None
                    if conditioner is not None:
                        try:
                            cond_input = conditioner(
                                [{"prompt": item["prompt"], "seconds_start": 0, "seconds_total": 47}],
                                device=device
                            )
                        except Exception:
                            try:
                                cond_input = conditioner([item["prompt"]])
                            except Exception:
                                pass

                    with torch.amp.autocast("cuda", enabled=device == "cuda"):
                        try:
                            if cond_input is not None:
                                predicted = diffusion_model(noisy_audio, sigma.squeeze(), cond_input)
                            else:
                                predicted = diffusion_model(noisy_audio, sigma.squeeze())
                        except TypeError:
                            predicted = diffusion_model(noisy_audio, sigma.squeeze())

                        if predicted.shape != audio_batch.shape:
                            min_len = min(predicted.shape[-1], audio_batch.shape[-1])
                            predicted = predicted[..., :min_len]
                            noise = noise[..., :min_len]

                        loss = torch.nn.functional.mse_loss(predicted, noise[..., :predicted.shape[-1]])

                    optimizer.zero_grad()
                    scaler.scale(loss).backward()
                    scaler.unscale_(optimizer)
                    torch.nn.utils.clip_grad_norm_(trainable_params, 1.0)
                    scaler.step(optimizer)
                    scaler.update()

                    epoch_loss += loss.item()
                    n_batches += 1
                except Exception as e:
                    print(f"[Train] Batch error (epoch {epoch + 1}): {e}")
                    continue

            scheduler.step()
            avg_loss = epoch_loss / max(n_batches, 1)

            if (epoch + 1) % 10 == 0 or epoch == 0:
                elapsed = time.time() - train_start
                print(f"[Train] Epoch {epoch + 1}/{epochs} | Loss: {avg_loss:.6f} | Time: {elapsed:.0f}s")
                send_webhook(webhook_url, {
                    "kitId": kit_id,
                    "status": "training",
                    "message": f"Epoch {epoch + 1}/{epochs}, loss={avg_loss:.6f}",
                    "epoch": epoch + 1,
                    "loss": avg_loss,
                })

            if avg_loss < best_loss and n_batches > 0:
                best_loss = avg_loss
                torch.save({
                    "model_state_dict": model.state_dict(),
                    "epoch": epoch + 1,
                    "loss": best_loss,
                    "kit_id": kit_id,
                    "kit_name": kit_name,
                    "genre": genre,
                }, str(model_save_dir / "best_model.pt"))

        total_time = time.time() - train_start

        final_path = str(model_save_dir / "model_final.pt")
        torch.save({
            "model_state_dict": model.state_dict(),
            "model_config": model_config,
            "kit_id": kit_id,
            "kit_name": kit_name,
            "genre": genre,
            "training_time": total_time,
            "best_loss": best_loss,
            "epochs": epochs,
            "sample_rate": sample_rate,
        }, final_path)

        print(f"[Train] Complete! {epochs} epochs in {total_time:.0f}s, best_loss={best_loss:.6f}")

        del model
        torch.cuda.empty_cache()

        send_webhook(webhook_url, {
            "kitId": kit_id,
            "status": "completed",
            "modelPath": final_path,
            "bestLoss": best_loss,
            "trainingTime": total_time,
            "epochs": epochs,
        })

        return {
            "status": "completed",
            "kit_id": kit_id,
            "model_path": final_path,
            "best_loss": best_loss,
            "training_time": total_time,
        }

    except Exception as e:
        error_msg = str(e)
        print(f"[Train] Failed: {traceback.format_exc()}")

        if TORCH_AVAILABLE and torch.cuda.is_available():
            torch.cuda.empty_cache()

        send_webhook(webhook_url, {
            "kitId": kit_id,
            "status": "failed",
            "error": error_msg,
        })
        return {"status": "failed", "error": error_msg, "kit_id": kit_id}


# ============================================================
# ACTION: separate_stems (Demucs)
# ============================================================
def handle_separate_stems(job_input: dict) -> dict:
    song_id = job_input.get("song_id", 0)
    audio_url = job_input.get("audio_url", "")
    model_name = job_input.get("model", "htdemucs")
    webhook_url = job_input.get("webhook_url", "")

    if not audio_url:
        return {"status": "failed", "error": "No audio_url provided", "song_id": song_id}

    print(f"[Stems] Song {song_id} | Model: {model_name}")

    try:
        stems_dir = OUTPUTS_DIR / "stems" / f"song_{song_id}"
        stems_dir.mkdir(parents=True, exist_ok=True)

        input_path = str(stems_dir / "input.wav")
        print(f"[Stems] Downloading audio from {audio_url[:80]}...")
        resp = requests.get(audio_url, timeout=120)
        resp.raise_for_status()
        with open(input_path, "wb") as f:
            f.write(resp.content)
        print(f"[Stems] Downloaded: {len(resp.content)} bytes")

        print(f"[Stems] Running Demucs ({model_name})...")
        result = subprocess.run(
            [
                sys.executable, "-m", "demucs",
                "-n", model_name,
                "-o", str(stems_dir),
                input_path,
            ],
            capture_output=True, text=True, timeout=600,
        )

        if result.returncode != 0:
            print(f"[Stems] Demucs stderr: {result.stderr[:500]}")
            raise Exception(f"Demucs failed (exit {result.returncode}): {result.stderr[:300]}")

        stems_output = stems_dir / model_name / "input"
        stems = {}
        stem_names = ["vocals", "drums", "bass", "other"]

        for stem in stem_names:
            stem_file = stems_output / f"{stem}.wav"
            if stem_file.exists():
                stems[stem] = str(stem_file)
                print(f"[Stems] Found: {stem} ({stem_file.stat().st_size} bytes)")

        if not stems:
            for p in stems_dir.rglob("*.wav"):
                if p.name != "input.wav":
                    stem_name = p.stem.lower()
                    stems[stem_name] = str(p)
                    print(f"[Stems] Found (fallback): {stem_name}")

        if not stems:
            raise Exception("No stems produced by Demucs")

        send_webhook(webhook_url, {
            "songId": song_id,
            "status": "completed",
            "stems": stems,
            "model": model_name,
        })

        return {
            "status": "completed",
            "song_id": song_id,
            "stems": stems,
            "model": model_name,
        }

    except Exception as e:
        error_msg = str(e)
        print(f"[Stems] Failed: {traceback.format_exc()}")
        send_webhook(webhook_url, {
            "songId": song_id,
            "status": "failed",
            "error": error_msg,
        })
        return {"status": "failed", "error": error_msg, "song_id": song_id}


# ============================================================
# ACTION: check_instruments (check FluidSynth/VST3/samples status)
# ============================================================
def handle_check_instruments(job_input: dict) -> dict:
    print("[Instruments] Checking instrument status...")
    result = {
        "status": "completed",
        "soundfontInstalled": False,
        "fluidsynthInstalled": False,
        "soundfontPath": "/runpod-volume/instruments/soundfonts/FluidR3_GM.sf2",
        "soundfontSize": 0,
        "gmInstrumentsAvailable": 0,
        "vst3Installed": False,
        "vst3Path": "/runpod-volume/vst3/DAGRABA_Sampler.vst3",
        "sampleDirs": 0,
        "sampleFiles": 0,
        "details": "",
    }

    details = []

    sf_path = result["soundfontPath"]
    if os.path.exists(sf_path):
        size = os.path.getsize(sf_path)
        result["soundfontSize"] = size
        if size > 100_000_000:
            result["soundfontInstalled"] = True
            result["gmInstrumentsAvailable"] = 128
            details.append(f"FluidR3_GM.sf2: {size / 1e6:.0f} MB")
            details.append("128 GM melodic instruments + 47 percussion kits ready")
        else:
            details.append(f"FluidR3_GM.sf2: corrupt ({size} bytes)")
    else:
        details.append("FluidR3_GM.sf2: NOT INSTALLED")

    r = subprocess.run(["which", "fluidsynth"], capture_output=True, text=True, timeout=5)
    result["fluidsynthInstalled"] = r.returncode == 0
    if r.returncode == 0:
        details.append(f"FluidSynth binary: {r.stdout.strip()}")
    else:
        details.append("FluidSynth: NOT INSTALLED")

    try:
        subprocess.run([sys.executable, "-c", "import fluidsynth"], capture_output=True, text=True, timeout=10, check=True)
        details.append("pyfluidsynth: installed")
    except Exception:
        details.append("pyfluidsynth: NOT INSTALLED")

    vst3_path = result["vst3Path"]
    result["vst3Installed"] = os.path.exists(vst3_path)
    details.append("")
    details.append("=== VST3 Plugin ===")
    if result["vst3Installed"]:
        details.append(f"DAGRABA Sampler VST3: INSTALLED at {vst3_path}")
        so_files = []
        for root, dirs, files in os.walk(vst3_path):
            for f in files:
                if f.endswith(".so"):
                    fp = os.path.join(root, f)
                    so_files.append(f"{f} ({os.path.getsize(fp) / 1024:.0f} KB)")
        if so_files:
            details.append(f"  Binary: {', '.join(so_files)}")
    else:
        details.append("DAGRABA Sampler VST3: NOT BUILT")

    samples_dir = "/runpod-volume/vst3/samples"
    if os.path.exists(samples_dir):
        inst_dirs = [d for d in os.listdir(samples_dir) if os.path.isdir(os.path.join(samples_dir, d))]
        sample_count = 0
        for d in inst_dirs:
            wavs = [f for f in os.listdir(os.path.join(samples_dir, d)) if f.endswith(".wav")]
            sample_count += len(wavs)
        details.append(f"  Sample dirs: {len(inst_dirs)}, WAV files: {sample_count}")
        result["sampleDirs"] = len(inst_dirs)
        result["sampleFiles"] = sample_count
    else:
        details.append("  Samples directory: not created yet")

    sao_ft = SAO_FINETUNE_PATH
    details.append("")
    details.append("=== SAO Instrumental Finetune ===")
    if sao_ft.exists():
        details.append(f"  Checkpoint: PRESENT ({sao_ft.stat().st_size / 1024**3:.1f} GB)")
    else:
        details.append(f"  Checkpoint: NOT CACHED (will download on first use)")

    result["saoFinetuneInstalled"] = sao_ft.exists()
    result["details"] = "\n".join(details)
    print(f"[Instruments] Status check complete: SF={result['soundfontInstalled']}, FS={result['fluidsynthInstalled']}, VST3={result['vst3Installed']}, SAO-FT={result['saoFinetuneInstalled']}")
    return result


# ============================================================
# ACTION: install_instruments (install FluidSynth + SoundFont + deps)
# ============================================================
def handle_install_instruments(job_input: dict) -> dict:
    print("[Install] Starting instrument installation...")
    results = []

    try:
        r = subprocess.run(["which", "fluidsynth"], capture_output=True, text=True, timeout=5)
        if r.returncode == 0:
            results.append(f"FluidSynth: already installed ({r.stdout.strip()})")
        else:
            results.append("Installing FluidSynth...")
            subprocess.run(["apt-get", "update", "-qq"], capture_output=True, text=True, timeout=60)
            r = subprocess.run(["apt-get", "install", "-y", "-qq", "fluidsynth", "libfluidsynth-dev"],
                               capture_output=True, text=True, timeout=120)
            results.append(f"FluidSynth install: {'OK' if r.returncode == 0 else r.stderr[:200]}")

        pip_cmd = [sys.executable, "-m", "pip", "install", "--quiet", "--break-system-packages"]
        for pkg_import, pkg_pip in [("fluidsynth", "pyfluidsynth"), ("mido", "mido"), ("pyloudnorm", "pyloudnorm")]:
            r = subprocess.run([sys.executable, "-c", f"import {pkg_import}"], capture_output=True, text=True, timeout=10)
            if r.returncode == 0:
                results.append(f"{pkg_pip}: already installed")
            else:
                results.append(f"Installing {pkg_pip}...")
                r = subprocess.run(pip_cmd + [pkg_pip], capture_output=True, text=True, timeout=120)
                results.append(f"{pkg_pip}: {'OK' if r.returncode == 0 else r.stderr[:200]}")

        sf_dir = "/runpod-volume/instruments/soundfonts"
        sf_path = os.path.join(sf_dir, "FluidR3_GM.sf2")
        os.makedirs(sf_dir, exist_ok=True)
        if os.path.exists(sf_path) and os.path.getsize(sf_path) > 100_000_000:
            results.append(f"FluidR3_GM.sf2: already present ({os.path.getsize(sf_path) / 1e6:.0f} MB)")
        else:
            results.append("Downloading FluidR3_GM.sf2 (~141 MB)...")
            r = subprocess.run(["wget", "-q", "-O", sf_path,
                                "https://musical-artifacts.com/artifacts/738/FluidR3_GM.sf2"],
                               capture_output=True, text=True, timeout=300)
            if r.returncode == 0 and os.path.exists(sf_path) and os.path.getsize(sf_path) > 100_000_000:
                results.append(f"FluidR3_GM.sf2: downloaded ({os.path.getsize(sf_path) / 1e6:.0f} MB)")
            else:
                results.append(f"FluidR3_GM.sf2: download FAILED - {r.stderr[:200]}")

        download_sao = job_input.get("download_sao_finetune", True)
        if download_sao and not SAO_FINETUNE_PATH.exists():
            results.append(f"Downloading SAO Instrumental Finetune from {SAO_FINETUNE_REPO}...")
            try:
                download_sao_finetune()
                results.append(f"SAO Finetune: OK ({SAO_FINETUNE_PATH.stat().st_size / 1024**3:.1f} GB)")
            except Exception as e:
                results.append(f"SAO Finetune: FAILED - {str(e)[:200]}")
        elif SAO_FINETUNE_PATH.exists():
            results.append(f"SAO Finetune: already cached ({SAO_FINETUNE_PATH.stat().st_size / 1024**3:.1f} GB)")

        has_errors = any("FAILED" in r for r in results)
        output = "\n".join(results)
        print(f"[Install] Complete. Errors: {has_errors}")
        print(output)
        return {
            "status": "completed" if not has_errors else "partial",
            "success": not has_errors,
            "output": output,
        }

    except Exception as e:
        error_msg = str(e)
        print(f"[Install] Fatal error: {traceback.format_exc()}")
        results.append(f"FATAL: {error_msg}")
        return {
            "status": "failed",
            "success": False,
            "output": "\n".join(results),
            "error": error_msg,
        }


# ============================================================
# MAIN HANDLER (RunPod Serverless entry point)
# ============================================================
def handler(job):
    try:
        job_input = job.get("input", {})
        action = job_input.get("action", "")

        print(f"[DAGRABA Serverless] Job received | Action: {action}")
        print(f"[DAGRABA Serverless] GPU available: {torch.cuda.is_available() if TORCH_AVAILABLE else 'N/A (torch not loaded)'}")
        if TORCH_AVAILABLE and torch.cuda.is_available():
            print(f"[DAGRABA Serverless] GPU: {torch.cuda.get_device_name(0)}")

        if action == "generate_music":
            return handle_generate_music(job_input)
        elif action == "train_model":
            return handle_train_model(job_input)
        elif action == "separate_stems":
            return handle_separate_stems(job_input)
        elif action == "check_instruments":
            return handle_check_instruments(job_input)
        elif action == "install_instruments":
            return handle_install_instruments(job_input)
        elif action == "health_check":
            return {
                "status": "healthy",
                "gpu": torch.cuda.is_available() if TORCH_AVAILABLE else False,
                "gpu_name": torch.cuda.get_device_name(0) if (TORCH_AVAILABLE and torch.cuda.is_available()) else "N/A",
                "torch_available": TORCH_AVAILABLE,
                "models_found": len(list(MODELS_DIR.glob("kit_*"))),
                "server": "dagraba-runpod-serverless",
            }
        else:
            return {"status": "error", "error": f"Unknown action: {action}"}

    except Exception as e:
        print(f"[DAGRABA Serverless] CRITICAL handler error: {traceback.format_exc()}")
        return {"status": "failed", "error": f"Handler error: {str(e)}"}


print("[DAGRABA Serverless] Starting RunPod handler...")
runpod.serverless.start({"handler": handler})
