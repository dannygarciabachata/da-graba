import os
import uuid
import time
import json
import asyncio
import traceback
import threading
from typing import Optional, Dict, Any, List
from pathlib import Path
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
import requests
import subprocess

app = FastAPI(title="DGB Studio Training Server")

API_KEY = os.environ.get("DGB_API_KEY", "70729df4571a88c1339c81c96ec32db3d441adde93e3d58bbdcca786a1855bf0")
HF_TOKEN = os.environ.get("HF_TOKEN", "")
MODELS_DIR = Path("/opt/dgb-training/models")
AUDIO_DIR = Path("/opt/dgb-training/audio")
MODELS_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

if HF_TOKEN:
    os.environ["HF_TOKEN"] = HF_TOKEN
    os.environ["HUGGING_FACE_HUB_TOKEN"] = HF_TOKEN

jobs: Dict[str, Dict[str, Any]] = {}


def verify_api_key(x_dgb_api_key: Optional[str] = None, authorization: Optional[str] = None):
    key = x_dgb_api_key or (authorization.replace("Bearer ", "") if authorization else None)
    if not key or key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


class TrainKitRequest(BaseModel):
    kit_id: int
    training_config: Dict[str, Any]
    webhook_url: Optional[str] = None


class TrainRequest(BaseModel):
    kit_id: int
    instruments: Optional[List[Dict[str, Any]]] = None
    prompt: Optional[str] = None
    webhook_url: Optional[str] = None


class UploadInstrumentRequest(BaseModel):
    kit_id: int
    instrument_id: int
    audio_url: str
    name: str
    type: str


class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = "Low quality."
    duration_s: Optional[float] = 30.0
    steps: Optional[int] = 100
    cfg_scale: Optional[float] = 7.0
    kit_id: Optional[int] = None


@app.get("/api/health")
async def health():
    gpu_available = False
    gpu_info = "No GPU detected"
    try:
        result = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total,memory.free", "--format=csv,noheader"],
                                capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            gpu_available = True
            gpu_info = result.stdout.strip()
    except Exception:
        pass

    sat_available = False
    try:
        import stable_audio_tools
        sat_available = True
    except ImportError:
        pass

    return {
        "status": "healthy",
        "gpu_available": gpu_available,
        "gpu_info": gpu_info,
        "stable_audio_tools": sat_available,
        "hf_token_set": bool(HF_TOKEN),
        "active_jobs": len([j for j in jobs.values() if j.get("status") == "running"]),
        "total_jobs": len(jobs),
        "models_dir": str(MODELS_DIR),
    }


@app.post("/api/upload-instrument")
async def upload_instrument(req: UploadInstrumentRequest,
                            x_dgb_api_key: Optional[str] = Header(None),
                            authorization: Optional[str] = Header(None)):
    verify_api_key(x_dgb_api_key, authorization)

    kit_dir = AUDIO_DIR / str(req.kit_id)
    kit_dir.mkdir(parents=True, exist_ok=True)

    try:
        response = requests.get(req.audio_url, timeout=60)
        response.raise_for_status()
        ext = req.audio_url.rsplit(".", 1)[-1] if "." in req.audio_url else "wav"
        filename = f"{req.instrument_id}_{req.name}.{ext}"
        filepath = kit_dir / filename
        filepath.write_bytes(response.content)
        return {"status": "uploaded", "path": str(filepath), "size": len(response.content)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download: {str(e)}")


def download_instruments(kit_id: int, instruments: List[Dict], kit_audio_dir: Path) -> int:
    downloaded = 0
    for instr in instruments:
        audio_url = instr.get("audioUrl", "") or instr.get("audio_url", "")
        if not audio_url:
            continue
        try:
            if audio_url.startswith("/"):
                print(f"[Training] Skipping relative URL: {audio_url}")
                continue

            response = requests.get(audio_url, timeout=120)
            response.raise_for_status()
            ext = audio_url.rsplit(".", 1)[-1].split("?")[0] if "." in audio_url else "wav"
            if ext not in ["wav", "mp3", "flac", "ogg", "m4a"]:
                ext = "wav"
            name = instr.get("name", f"instrument_{instr.get('id', downloaded)}")
            name = "".join(c if c.isalnum() or c in "._- " else "_" for c in name)
            filepath = kit_audio_dir / f"{name}.{ext}"
            filepath.write_bytes(response.content)
            downloaded += 1
            print(f"[Training] Downloaded: {name}.{ext} ({len(response.content)} bytes)")
        except Exception as e:
            print(f"[Training] Failed to download {audio_url}: {e}")

    return downloaded


def analyze_audio_files(kit_audio_dir: Path) -> List[Dict]:
    audio_analysis = []
    try:
        import librosa
        import numpy as np

        for audio_file in sorted(kit_audio_dir.iterdir()):
            if audio_file.suffix.lower() not in [".wav", ".mp3", ".flac", ".ogg", ".m4a"]:
                continue
            try:
                y, sr = librosa.load(str(audio_file), sr=44100, mono=True, duration=120)
                duration = librosa.get_duration(y=y, sr=sr)
                tempo_arr, _ = librosa.beat.beat_track(y=y, sr=sr)
                tempo = float(tempo_arr) if np.isscalar(tempo_arr) else float(tempo_arr[0]) if len(tempo_arr) > 0 else 0
                chroma = librosa.feature.chroma_stft(y=y, sr=sr)
                key_idx = int(np.argmax(np.mean(chroma, axis=1)))
                key_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
                detected_key = key_names[key_idx]
                rms = float(np.mean(librosa.feature.rms(y=y)))
                spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
                zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))
                mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
                mfcc_means = [float(x) for x in np.mean(mfccs, axis=1)]

                analysis = {
                    "file": audio_file.name,
                    "duration_s": round(duration, 2),
                    "sample_rate": sr,
                    "bpm": round(tempo, 1),
                    "key": detected_key,
                    "rms_energy": round(rms, 6),
                    "spectral_centroid": round(spectral_centroid, 1),
                    "zero_crossing_rate": round(zcr, 6),
                    "mfcc_means": [round(x, 4) for x in mfcc_means],
                }
                audio_analysis.append(analysis)
                print(f"[Training] Analyzed: {audio_file.name} - {detected_key} {round(tempo,1)}bpm {round(duration,1)}s")
            except Exception as ae:
                print(f"[Training] Analysis error for {audio_file.name}: {ae}")

    except ImportError:
        print("[Training] librosa not available, skipping audio analysis")

    return audio_analysis


def generate_with_stable_audio_tools(prompt: str, model_output_dir: Path, duration_s: float = 30.0,
                                      steps: int = 100, cfg_scale: float = 7.0) -> bool:
    try:
        import torch
        import torchaudio
        from einops import rearrange
        from stable_audio_tools import get_pretrained_model
        from stable_audio_tools.inference.generation import generate_diffusion_cond

        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[SAO] Loading model via stable-audio-tools on {device}...")

        model, model_config = get_pretrained_model("stabilityai/stable-audio-open-1.0")
        sample_rate = model_config["sample_rate"]
        sample_size = model_config["sample_size"]

        model = model.to(device)

        conditioning = [{
            "prompt": prompt,
            "seconds_start": 0,
            "seconds_total": duration_s
        }]

        print(f"[SAO] Generating audio: '{prompt[:80]}...' ({duration_s}s, {steps} steps, cfg={cfg_scale})")

        output = generate_diffusion_cond(
            model,
            steps=steps,
            cfg_scale=cfg_scale,
            conditioning=conditioning,
            sample_size=sample_size,
            sigma_min=0.3,
            sigma_max=500,
            sampler_type="dpmpp-3m-sde",
            device=device
        )

        output = rearrange(output, "b d n -> d (b n)")
        output = output.to(torch.float32).div(torch.max(torch.abs(output))).clamp(-1, 1).mul(32767).to(torch.int16).cpu()

        ref_path = model_output_dir / "generated_reference.wav"
        torchaudio.save(str(ref_path), output, sample_rate)
        print(f"[SAO] Reference audio saved: {ref_path} ({ref_path.stat().st_size} bytes)")

        del model
        torch.cuda.empty_cache()
        return True

    except Exception as e:
        print(f"[SAO] stable-audio-tools generation failed: {e}")
        print(traceback.format_exc())
        return False


def generate_with_diffusers(prompt: str, model_output_dir: Path, duration_s: float = 30.0,
                             steps: int = 100) -> bool:
    try:
        import torch
        import soundfile as sf
        from diffusers import StableAudioPipeline

        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32
        print(f"[SAO-Diffusers] Loading model via diffusers on {device}...")

        hf_kwargs = {"torch_dtype": dtype}
        if HF_TOKEN:
            hf_kwargs["token"] = HF_TOKEN

        pipe = StableAudioPipeline.from_pretrained(
            "stabilityai/stable-audio-open-1.0",
            **hf_kwargs,
        )
        pipe = pipe.to(device)

        print(f"[SAO-Diffusers] Generating: '{prompt[:80]}...' ({duration_s}s, {steps} steps)")

        audio = pipe(
            prompt,
            negative_prompt="Low quality, noise, distorted",
            num_inference_steps=steps,
            audio_end_in_s=duration_s,
        ).audios[0]

        ref_path = model_output_dir / "generated_reference.wav"
        output = audio.T.float().cpu().numpy() if hasattr(audio, 'cpu') else audio.T if len(audio.shape) > 1 else audio
        sf.write(str(ref_path), output, pipe.vae.sampling_rate)
        print(f"[SAO-Diffusers] Reference audio saved: {ref_path}")

        del pipe
        torch.cuda.empty_cache()
        return True

    except Exception as e:
        print(f"[SAO-Diffusers] Diffusers generation failed: {e}")
        return False


def run_training(job_id: str, kit_id: int, training_config: Dict, webhook_url: Optional[str]):
    try:
        jobs[job_id]["status"] = "running"
        jobs[job_id]["started_at"] = time.time()

        dataset_config = training_config.get("dataset", {})
        instruments = dataset_config.get("instruments", [])

        kit_audio_dir = AUDIO_DIR / str(kit_id)
        kit_audio_dir.mkdir(parents=True, exist_ok=True)

        downloaded = download_instruments(kit_id, instruments, kit_audio_dir)

        if downloaded == 0:
            existing = list(kit_audio_dir.glob("*.*"))
            audio_exts = [".wav", ".mp3", ".flac", ".ogg", ".m4a"]
            existing_audio = [f for f in existing if f.suffix.lower() in audio_exts]
            if existing_audio:
                downloaded = len(existing_audio)
                print(f"[Training] Using {downloaded} previously downloaded instruments")
            else:
                raise Exception("No instrument audio files could be downloaded")

        jobs[job_id]["progress"] = 10
        print(f"[Training] {downloaded} instruments ready for kit {kit_id}")

        model_output_dir = MODELS_DIR / str(kit_id)
        model_output_dir.mkdir(parents=True, exist_ok=True)

        jobs[job_id]["progress"] = 15
        genre = training_config.get("genre", "") or training_config.get("kit", {}).get("genre", "bachata")
        kit_name = training_config.get("kit", {}).get("name", f"Kit {kit_id}")

        prompts = [instr.get("prompt", instr.get("generatedPrompt", "")) for instr in instruments if instr.get("prompt") or instr.get("generatedPrompt")]
        if not prompts:
            prompts = [f"Generate {genre} music"]

        combined_prompt = "; ".join(prompts[:5])
        final_prompt = f"{genre} style: {combined_prompt}"

        jobs[job_id]["progress"] = 20

        sao_success = generate_with_stable_audio_tools(
            final_prompt, model_output_dir, duration_s=30.0, steps=100, cfg_scale=7.0
        )

        if not sao_success:
            print("[Training] stable-audio-tools failed, trying diffusers fallback...")
            sao_success = generate_with_diffusers(
                final_prompt, model_output_dir, duration_s=30.0, steps=100
            )

        if sao_success:
            jobs[job_id]["progress"] = 60
            print(f"[Training] SAO reference audio generated for kit {kit_id}")
        else:
            jobs[job_id]["progress"] = 40
            print(f"[Training] SAO unavailable, proceeding with audio analysis only")

        audio_analysis = analyze_audio_files(kit_audio_dir)
        jobs[job_id]["progress"] = 80

        instrument_manifest = []
        for instr in instruments:
            entry = {
                "name": instr.get("name", "unknown"),
                "type": instr.get("type", "unknown"),
                "prompt": instr.get("prompt", ""),
            }
            meta = instr.get("metadata", {})
            if meta:
                entry["metadata"] = meta
            instrument_manifest.append(entry)

        model_config = {
            "kit_id": kit_id,
            "kit_name": kit_name,
            "genre": genre,
            "instruments_count": downloaded,
            "instruments": instrument_manifest,
            "training_prompt": final_prompt,
            "audio_analysis": audio_analysis,
            "sao_reference_generated": sao_success,
            "engine": "stable-audio-tools" if sao_success else "analysis-only",
            "created_at": time.time(),
            "status": "completed",
            "audio_dir": str(kit_audio_dir),
            "model_dir": str(model_output_dir),
        }

        config_path = model_output_dir / "training_config.json"
        config_path.write_text(json.dumps(model_config, indent=2))

        manifest_path = model_output_dir / "instrument_manifest.json"
        manifest_path.write_text(json.dumps(instrument_manifest, indent=2))

        if audio_analysis:
            analysis_path = model_output_dir / "audio_analysis.json"
            analysis_path.write_text(json.dumps(audio_analysis, indent=2))

        jobs[job_id]["progress"] = 90

        model_url = f"/api/models/{kit_id}/download"

        jobs[job_id]["status"] = "completed"
        jobs[job_id]["progress"] = 100
        jobs[job_id]["completed_at"] = time.time()
        jobs[job_id]["model_url"] = model_url
        jobs[job_id]["sao_generated"] = sao_success

        if webhook_url:
            try:
                requests.post(webhook_url, json={
                    "kitId": kit_id,
                    "status": "completed",
                    "modelUrl": model_url,
                    "jobId": job_id,
                    "saoGenerated": sao_success,
                }, headers={"X-DGB-API-Key": API_KEY}, timeout=30)
            except Exception as e:
                print(f"[Training] Webhook notification failed: {e}")

        print(f"[Training] Kit {kit_id} completed! SAO: {sao_success}, Instruments: {downloaded}, Analysis: {len(audio_analysis)}")

    except Exception as e:
        error_msg = str(e)
        print(f"[Training] Kit {kit_id} failed: {error_msg}")
        print(traceback.format_exc())
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = error_msg
        jobs[job_id]["completed_at"] = time.time()

        if webhook_url:
            try:
                requests.post(webhook_url, json={
                    "kitId": kit_id,
                    "status": "failed",
                    "error": error_msg,
                    "jobId": job_id,
                }, headers={"X-DGB-API-Key": API_KEY}, timeout=30)
            except Exception:
                pass


@app.post("/api/generate")
async def generate_audio(req: GenerateRequest,
                         x_dgb_api_key: Optional[str] = Header(None),
                         authorization: Optional[str] = Header(None)):
    verify_api_key(x_dgb_api_key, authorization)

    output_dir = MODELS_DIR / "generations" / str(int(time.time()))
    output_dir.mkdir(parents=True, exist_ok=True)

    success = generate_with_stable_audio_tools(
        req.prompt, output_dir, duration_s=req.duration_s or 30.0,
        steps=req.steps or 100, cfg_scale=req.cfg_scale or 7.0
    )

    if not success:
        success = generate_with_diffusers(
            req.prompt, output_dir, duration_s=req.duration_s or 30.0, steps=req.steps or 100
        )

    if not success:
        raise HTTPException(status_code=500, detail="Audio generation failed with all engines")

    ref_path = output_dir / "generated_reference.wav"
    return FileResponse(str(ref_path), filename="generated.wav", media_type="audio/wav")


@app.post("/api/train")
async def train(req: TrainRequest,
                x_dgb_api_key: Optional[str] = Header(None),
                authorization: Optional[str] = Header(None)):
    verify_api_key(x_dgb_api_key, authorization)

    job_id = f"train_{req.kit_id}_{uuid.uuid4().hex[:8]}"
    jobs[job_id] = {
        "status": "starting",
        "kit_id": req.kit_id,
        "started_at": time.time(),
    }

    training_config = {
        "dataset": {"instruments": req.instruments or []},
        "genre": "bachata",
    }

    thread = threading.Thread(target=run_training, args=(job_id, req.kit_id, training_config, req.webhook_url))
    thread.daemon = True
    thread.start()

    return {"status": "starting", "message": f"Training started for kit {req.kit_id}", "jobId": job_id}


@app.post("/api/train-kit")
async def train_kit(req: TrainKitRequest,
                    x_dgb_api_key: Optional[str] = Header(None),
                    authorization: Optional[str] = Header(None)):
    verify_api_key(x_dgb_api_key, authorization)

    job_id = f"train_{req.kit_id}_{uuid.uuid4().hex[:8]}"
    jobs[job_id] = {
        "status": "starting",
        "kit_id": req.kit_id,
        "started_at": time.time(),
    }

    thread = threading.Thread(target=run_training, args=(job_id, req.kit_id, req.training_config, req.webhook_url))
    thread.daemon = True
    thread.start()

    return {"status": "starting", "message": f"Training started for kit {req.kit_id}", "jobId": job_id}


@app.get("/api/jobs")
async def list_jobs(x_dgb_api_key: Optional[str] = Header(None),
                    authorization: Optional[str] = Header(None)):
    verify_api_key(x_dgb_api_key, authorization)
    return {"jobs": jobs}


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str,
                  x_dgb_api_key: Optional[str] = Header(None),
                  authorization: Optional[str] = Header(None)):
    verify_api_key(x_dgb_api_key, authorization)
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]


@app.get("/api/models")
async def list_models(x_dgb_api_key: Optional[str] = Header(None),
                      authorization: Optional[str] = Header(None)):
    verify_api_key(x_dgb_api_key, authorization)
    models = []
    if MODELS_DIR.exists():
        for kit_dir in MODELS_DIR.iterdir():
            if kit_dir.is_dir() and kit_dir.name != "generations":
                config_path = kit_dir / "training_config.json"
                if config_path.exists():
                    config = json.loads(config_path.read_text())
                    models.append(config)
    return {"models": models}


@app.get("/api/models/{kit_id}/download")
async def download_model(kit_id: int,
                         x_dgb_api_key: Optional[str] = Header(None),
                         authorization: Optional[str] = Header(None)):
    verify_api_key(x_dgb_api_key, authorization)
    model_path = MODELS_DIR / str(kit_id) / "generated_reference.wav"
    if not model_path.exists():
        raise HTTPException(status_code=404, detail="Model not found")
    return FileResponse(str(model_path), filename=f"kit_{kit_id}_model.wav")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
