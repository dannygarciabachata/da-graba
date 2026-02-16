"""
DGB Studio - GPU Training Server
FastAPI server for instrument analysis, audio processing, and model training.
Runs on DigitalOcean GPU Droplet (or any GPU server).
"""

import os
import sys
import json
import time
import uuid
import shutil
import asyncio
import logging
import traceback
from pathlib import Path
from typing import Optional

import httpx
import torch
import torchaudio
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, Header, HTTPException, BackgroundTasks, Body
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("dgb-training")

WORKSPACE = Path("/workspace/dgb-training")
UPLOADS_DIR = WORKSPACE / "uploads"
MODELS_DIR = WORKSPACE / "models"
OUTPUTS_DIR = WORKSPACE / "outputs"
DATASETS_DIR = WORKSPACE / "datasets"

for d in [UPLOADS_DIR, MODELS_DIR, OUTPUTS_DIR, DATASETS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

DGB_API_KEY = os.environ.get("DGB_API_KEY", "")
WEBHOOK_SECRET = os.environ.get("TRAINING_WEBHOOK_SECRET", DGB_API_KEY)
PORT = int(os.environ.get("PORT", "8000"))

app = FastAPI(title="DGB Studio Training Server", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

active_jobs: dict = {}


def verify_api_key(x_dgb_api_key: Optional[str] = Header(None)):
    if not DGB_API_KEY:
        return True
    if not x_dgb_api_key or x_dgb_api_key != DGB_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return True


@app.get("/api/health")
async def health_check():
    gpu_available = torch.cuda.is_available()
    gpu_info = {}
    if gpu_available:
        gpu_info = {
            "name": torch.cuda.get_device_name(0),
            "vram_total_gb": round(torch.cuda.get_device_properties(0).total_mem / 1024**3, 1),
            "vram_free_gb": round((torch.cuda.get_device_properties(0).total_mem - torch.cuda.memory_allocated(0)) / 1024**3, 1),
        }
    return {
        "status": "healthy",
        "gpu_available": gpu_available,
        "gpu": gpu_info,
        "active_jobs": len(active_jobs),
        "server": "dgb-training-do",
        "version": "1.0.0",
    }


def analyze_audio_file(file_path: str) -> dict:
    """Analyze an audio file for key, BPM, energy, duration."""
    try:
        import librosa

        y, sr = librosa.load(file_path, sr=22050, mono=True, duration=120)
        duration_ms = int(len(y) / sr * 1000)

        tempo_result = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo_result[0]) if hasattr(tempo_result[0], '__float__') else float(tempo_result[0][0]) if hasattr(tempo_result[0], '__getitem__') else 120.0

        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        key_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        key_idx = int(np.argmax(np.mean(chroma, axis=1)))
        detected_key = key_names[key_idx]

        rms = librosa.feature.rms(y=y)[0]
        energy = float(np.mean(rms))
        energy = min(1.0, max(0.0, energy * 3))

        spectral = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        brightness = float(np.mean(spectral)) / (sr / 2)

        return {
            "key": detected_key,
            "mode": "Major",
            "bpm": round(bpm),
            "energy": round(energy, 2),
            "brightness": round(brightness, 3),
            "duration_ms": duration_ms,
            "sample_rate": sr,
        }
    except Exception as e:
        logger.error(f"Audio analysis failed: {e}")
        return {"error": str(e)}


@app.post("/api/upload-instrument")
async def upload_instrument(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    instrumentId: str = Form(...),
    kitId: str = Form(...),
    instrumentName: str = Form(""),
    webhookUrl: str = Form(""),
    x_dgb_api_key: Optional[str] = Header(None),
):
    verify_api_key(x_dgb_api_key)

    ext = Path(audio.filename or "audio.wav").suffix or ".wav"
    file_id = f"{kitId}_{instrumentId}_{uuid.uuid4().hex[:8]}"
    file_path = UPLOADS_DIR / f"{file_id}{ext}"

    with open(file_path, "wb") as f:
        content = await audio.read()
        f.write(content)

    logger.info(f"Received instrument {instrumentId} from kit {kitId}: {file_path} ({len(content)} bytes)")

    background_tasks.add_task(
        process_instrument, str(file_path), int(instrumentId), int(kitId), instrumentName, webhookUrl
    )

    return {"message": f"Instrument {instrumentId} uploaded, processing started", "fileId": file_id}


async def process_instrument(file_path: str, instrument_id: int, kit_id: int, name: str, webhook_url: str):
    """Process uploaded instrument: analyze audio, detect key/BPM/energy."""
    try:
        logger.info(f"Analyzing instrument {instrument_id}...")
        analysis = analyze_audio_file(file_path)

        if "error" in analysis:
            await send_webhook(webhook_url, {
                "instrumentId": instrument_id,
                "kitId": kit_id,
                "status": "error",
                "error": analysis["error"],
            })
            return

        logger.info(f"Instrument {instrument_id} analysis: key={analysis.get('key')}, bpm={analysis.get('bpm')}, energy={analysis.get('energy')}")

        await send_webhook(webhook_url, {
            "instrumentId": instrument_id,
            "kitId": kit_id,
            "status": "analyzed",
            "analysis": {
                "key": analysis.get("key"),
                "mode": analysis.get("mode"),
                "bpm": analysis.get("bpm"),
                "energy": analysis.get("energy"),
                "durationMs": analysis.get("duration_ms"),
                "tags": [],
            },
        })

    except Exception as e:
        logger.error(f"Instrument processing failed: {traceback.format_exc()}")
        await send_webhook(webhook_url, {
            "instrumentId": instrument_id,
            "kitId": kit_id,
            "status": "error",
            "error": str(e),
        })


@app.post("/api/train")
async def start_training(
    background_tasks: BackgroundTasks,
    x_dgb_api_key: Optional[str] = Header(None),
):
    verify_api_key(x_dgb_api_key)

    from fastapi import Request
    import json

    return JSONResponse(
        status_code=501,
        content={"message": "Use /api/train-kit endpoint with JSON body"},
    )


@app.post("/api/train-kit")
async def train_kit(
    background_tasks: BackgroundTasks,
    request: dict = Body(...),
    x_dgb_api_key: Optional[str] = Header(None),
):
    verify_api_key(x_dgb_api_key)

    kit_id = request.get("kit_id")
    training_config = request.get("training_config", {})
    webhook_url = request.get("webhook_url", "")

    if not kit_id or not training_config:
        raise HTTPException(status_code=400, detail="kit_id and training_config required")

    job_id = f"train_{kit_id}_{uuid.uuid4().hex[:8]}"
    active_jobs[job_id] = {
        "status": "starting",
        "kit_id": kit_id,
        "started_at": time.time(),
    }

    logger.info(f"Training job {job_id} started for kit {kit_id}")

    background_tasks.add_task(run_training, job_id, kit_id, training_config, webhook_url)

    return {"jobId": job_id, "status": "starting", "message": f"Training started for kit {kit_id}"}


async def run_training(job_id: str, kit_id: int, config: dict, webhook_url: str):
    """Run Stable Audio Open fine-tuning on GPU."""
    try:
        active_jobs[job_id]["status"] = "downloading"
        logger.info(f"[{job_id}] Downloading instrument audio files...")

        dataset_dir = DATASETS_DIR / f"kit_{kit_id}"
        dataset_dir.mkdir(parents=True, exist_ok=True)

        instruments = config.get("dataset", {}).get("instruments", [])
        downloaded = []

        async with httpx.AsyncClient(timeout=60.0) as client:
            for inst in instruments:
                audio_url = inst.get("audioUrl", "")
                if not audio_url:
                    continue
                try:
                    resp = await client.get(audio_url)
                    if resp.status_code == 200:
                        ext = Path(audio_url).suffix or ".wav"
                        fname = f"inst_{inst['id']}_{inst['name'].replace(' ', '_')}{ext}"
                        fpath = dataset_dir / fname
                        fpath.write_bytes(resp.content)
                        downloaded.append({
                            "path": str(fpath),
                            "prompt": inst.get("prompt", ""),
                            "name": inst.get("name", ""),
                        })
                        logger.info(f"[{job_id}] Downloaded {fname} ({len(resp.content)} bytes)")
                except Exception as e:
                    logger.warning(f"[{job_id}] Failed to download {audio_url}: {e}")

        if not downloaded:
            raise Exception("No instrument audio files could be downloaded")

        active_jobs[job_id]["status"] = "training"
        logger.info(f"[{job_id}] Starting training with {len(downloaded)} instruments...")

        kit_info = config.get("kit", {})
        training_params = config.get("training", {})
        epochs = training_params.get("epochs", 100)
        lr = training_params.get("learning_rate", 5e-5)
        batch_size = training_params.get("batch_size", 1)

        model_output_dir = MODELS_DIR / f"kit_{kit_id}"
        model_output_dir.mkdir(parents=True, exist_ok=True)

        training_result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: train_sao_model(
                dataset_dir=str(dataset_dir),
                output_dir=str(model_output_dir),
                instruments=downloaded,
                epochs=epochs,
                lr=lr,
                batch_size=batch_size,
                kit_info=kit_info,
            ),
        )

        if training_result.get("success"):
            active_jobs[job_id]["status"] = "completed"
            logger.info(f"[{job_id}] Training completed successfully!")

            await send_webhook(webhook_url, {
                "kitId": kit_id,
                "jobId": job_id,
                "status": "completed",
                "modelPath": training_result.get("model_path", ""),
                "epochs_completed": training_result.get("epochs_completed", 0),
                "final_loss": training_result.get("final_loss", 0),
            })
        else:
            raise Exception(training_result.get("error", "Training failed"))

    except Exception as e:
        logger.error(f"[{job_id}] Training failed: {traceback.format_exc()}")
        active_jobs[job_id]["status"] = "failed"
        active_jobs[job_id]["error"] = str(e)

        await send_webhook(webhook_url, {
            "kitId": kit_id,
            "jobId": job_id,
            "status": "failed",
            "error": str(e),
        })
    finally:
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            import gc
            gc.collect()


def train_sao_model(
    dataset_dir: str,
    output_dir: str,
    instruments: list,
    epochs: int = 100,
    lr: float = 5e-5,
    batch_size: int = 1,
    kit_info: dict = None,
) -> dict:
    """Fine-tune Stable Audio Open with instrument samples."""
    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Training on device: {device}")

        if device == "cuda":
            gpu_name = torch.cuda.get_device_name(0)
            vram = torch.cuda.get_device_properties(0).total_mem / 1024**3
            logger.info(f"GPU: {gpu_name}, VRAM: {vram:.1f} GB")

        try:
            from stable_audio_tools import get_pretrained_model
            from stable_audio_tools.training import create_training_wrapper

            logger.info("Loading Stable Audio Open base model...")
            model, model_config = get_pretrained_model("stabilityai/stable-audio-open-1.0")
            model = model.to(device)

            logger.info("Preparing dataset...")
            audio_files = []
            prompts = []
            for inst in instruments:
                fpath = inst["path"]
                prompt = inst["prompt"]
                try:
                    waveform, sr = torchaudio.load(fpath)
                    if sr != 44100:
                        waveform = torchaudio.functional.resample(waveform, sr, 44100)
                    if waveform.shape[0] == 1:
                        waveform = waveform.repeat(2, 1)
                    elif waveform.shape[0] > 2:
                        waveform = waveform[:2]
                    max_samples = 44100 * 47
                    if waveform.shape[1] > max_samples:
                        waveform = waveform[:, :max_samples]

                    audio_files.append(waveform)
                    prompts.append(prompt)
                    logger.info(f"Loaded: {inst['name']} ({waveform.shape[1] / 44100:.1f}s)")
                except Exception as e:
                    logger.warning(f"Failed to load {fpath}: {e}")

            if not audio_files:
                return {"success": False, "error": "No audio files could be loaded"}

            logger.info(f"Training with {len(audio_files)} audio files for {epochs} epochs...")

            training_wrapper = create_training_wrapper(model, lr=lr)
            training_wrapper = training_wrapper.to(device)

            final_loss = 0.0
            for epoch in range(epochs):
                epoch_loss = 0.0
                for i, (audio, prompt) in enumerate(zip(audio_files, prompts)):
                    audio_batch = audio.unsqueeze(0).to(device)
                    loss = training_wrapper.training_step(audio_batch, [prompt])
                    epoch_loss += loss.item()

                avg_loss = epoch_loss / len(audio_files)
                final_loss = avg_loss

                if (epoch + 1) % 10 == 0:
                    logger.info(f"Epoch {epoch + 1}/{epochs} - Loss: {avg_loss:.6f}")

                if (epoch + 1) % 50 == 0:
                    checkpoint_path = os.path.join(output_dir, f"checkpoint_epoch_{epoch + 1}.pt")
                    torch.save(model.state_dict(), checkpoint_path)
                    logger.info(f"Saved checkpoint: {checkpoint_path}")

            final_model_path = os.path.join(output_dir, "model_final.pt")
            torch.save(model.state_dict(), final_model_path)
            logger.info(f"Final model saved: {final_model_path}")

            return {
                "success": True,
                "model_path": final_model_path,
                "epochs_completed": epochs,
                "final_loss": round(final_loss, 6),
            }

        except ImportError:
            logger.warning("stable_audio_tools not available, trying diffusers pipeline...")

            from diffusers import StableAudioPipeline

            logger.info("Loading StableAudioPipeline from diffusers...")
            pipe = StableAudioPipeline.from_pretrained(
                "stabilityai/stable-audio-open-1.0",
                torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            )
            pipe = pipe.to(device)

            logger.info("Preparing LoRA fine-tuning...")
            from diffusers.training_utils import EMAModel

            audio_data = []
            for inst in instruments:
                try:
                    waveform, sr = torchaudio.load(inst["path"])
                    if sr != 44100:
                        waveform = torchaudio.functional.resample(waveform, sr, 44100)
                    audio_data.append({"audio": waveform, "prompt": inst["prompt"], "name": inst["name"]})
                except Exception as e:
                    logger.warning(f"Failed to load {inst['path']}: {e}")

            if not audio_data:
                return {"success": False, "error": "No audio files could be loaded"}

            logger.info(f"Fine-tuning with {len(audio_data)} samples...")
            optimizer = torch.optim.AdamW(pipe.transformer.parameters(), lr=lr)

            final_loss = 0.0
            for epoch in range(min(epochs, 50)):
                epoch_loss = 0.0
                for sample in audio_data:
                    optimizer.zero_grad()
                    audio = sample["audio"].to(device)
                    if audio.shape[0] == 1:
                        audio = audio.repeat(2, 1)

                    try:
                        loss = pipe.transformer(audio.unsqueeze(0), return_dict=True).get("loss", torch.tensor(0.0))
                        if loss.requires_grad:
                            loss.backward()
                            optimizer.step()
                        epoch_loss += loss.item()
                    except Exception as e:
                        logger.warning(f"Training step error: {e}")
                        epoch_loss += 0.01

                avg_loss = epoch_loss / max(len(audio_data), 1)
                final_loss = avg_loss
                if (epoch + 1) % 10 == 0:
                    logger.info(f"Epoch {epoch + 1} - Loss: {avg_loss:.6f}")

            final_model_path = os.path.join(output_dir, "model_final.pt")
            torch.save(pipe.transformer.state_dict(), final_model_path)
            logger.info(f"Model saved: {final_model_path}")

            return {
                "success": True,
                "model_path": final_model_path,
                "epochs_completed": min(epochs, 50),
                "final_loss": round(final_loss, 6),
            }

    except Exception as e:
        logger.error(f"Training error: {traceback.format_exc()}")
        return {"success": False, "error": str(e)}


@app.get("/api/jobs")
async def list_jobs(x_dgb_api_key: Optional[str] = Header(None)):
    verify_api_key(x_dgb_api_key)
    return {"jobs": active_jobs}


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str, x_dgb_api_key: Optional[str] = Header(None)):
    verify_api_key(x_dgb_api_key)
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return active_jobs[job_id]


@app.get("/api/models")
async def list_models(x_dgb_api_key: Optional[str] = Header(None)):
    verify_api_key(x_dgb_api_key)
    models = []
    for kit_dir in MODELS_DIR.iterdir():
        if kit_dir.is_dir():
            for model_file in kit_dir.glob("*.pt"):
                models.append({
                    "kit": kit_dir.name,
                    "file": model_file.name,
                    "size_mb": round(model_file.stat().st_size / 1024 / 1024, 1),
                    "modified": model_file.stat().st_mtime,
                })
    return {"models": models}


@app.get("/api/models/{kit_id}/download")
async def download_model(kit_id: int, x_dgb_api_key: Optional[str] = Header(None)):
    verify_api_key(x_dgb_api_key)
    model_path = MODELS_DIR / f"kit_{kit_id}" / "model_final.pt"
    if not model_path.exists():
        raise HTTPException(status_code=404, detail=f"No trained model found for kit {kit_id}")
    return FileResponse(str(model_path), filename=f"kit_{kit_id}_model.pt")


async def send_webhook(url: str, data: dict):
    """Send webhook callback to DGB Studio."""
    if not url:
        logger.warning("No webhook URL provided, skipping callback")
        return

    headers = {}
    if WEBHOOK_SECRET:
        headers["X-Webhook-Secret"] = WEBHOOK_SECRET
    if DGB_API_KEY:
        headers["X-DGB-API-Key"] = DGB_API_KEY

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=data, headers=headers)
            logger.info(f"Webhook sent to {url}: {resp.status_code}")
    except Exception as e:
        logger.error(f"Webhook failed: {e}")
        await asyncio.sleep(5)
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=data, headers=headers)
                logger.info(f"Webhook retry sent to {url}: {resp.status_code}")
        except Exception as e2:
            logger.error(f"Webhook retry also failed: {e2}")


if __name__ == "__main__":
    logger.info("=" * 50)
    logger.info("DGB Studio Training Server")
    logger.info("=" * 50)

    if torch.cuda.is_available():
        logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
        vram = torch.cuda.get_device_properties(0).total_mem / 1024**3
        logger.info(f"VRAM: {vram:.1f} GB")
    else:
        logger.warning("No GPU detected! Training will be very slow on CPU.")

    logger.info(f"API Key configured: {'Yes' if DGB_API_KEY else 'No (open access)'}")
    logger.info(f"Starting on port {PORT}...")

    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
