"""
DGB Studio - RunPod Serverless Handler for Stable Audio Open
This handler receives music generation jobs and returns base64 audio.
Deploy this on RunPod Serverless to enable zero-cost music generation.
"""

import runpod
import torch
import torchaudio
import base64
import os
import sys
import time
import subprocess
import json

# Global model cache
MODEL = None
MODEL_CONFIG = None

def load_model():
    """Load Stable Audio Open model (cached after first load)"""
    global MODEL, MODEL_CONFIG
    
    if MODEL is not None:
        return MODEL, MODEL_CONFIG
    
    print("[SAO] Loading Stable Audio Open model...")
    
    hf_token = os.environ.get("HF_TOKEN", "")
    if hf_token:
        os.environ["HUGGING_FACE_HUB_TOKEN"] = hf_token
    
    from stable_audio_tools import get_pretrained_model
    from stable_audio_tools.inference.generation import generate_diffusion_cond
    
    model, model_config = get_pretrained_model("stabilityai/stable-audio-open-1.0")
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device)
    
    MODEL = model
    MODEL_CONFIG = model_config
    
    print(f"[SAO] Model loaded on {device}")
    return model, model_config


def generate_audio(prompt, duration_s=30.0, negative_prompt="Low quality.", steps=100, cfg_scale=7.0):
    """Generate audio from a text prompt using Stable Audio Open"""
    from stable_audio_tools.inference.generation import generate_diffusion_cond
    
    model, model_config = load_model()
    device = next(model.parameters()).device
    sample_rate = model_config["sample_rate"]
    sample_size = model_config["sample_size"]
    
    conditioning = [{
        "prompt": prompt,
        "seconds_start": 0,
        "seconds_total": duration_s,
    }]
    
    if negative_prompt:
        negative_conditioning = [{
            "prompt": negative_prompt,
            "seconds_start": 0,
            "seconds_total": duration_s,
        }]
    else:
        negative_conditioning = None
    
    print(f"[SAO] Generating: '{prompt[:150]}' ({duration_s}s, {steps} steps)")
    
    output = generate_diffusion_cond(
        model,
        steps=steps,
        cfg_scale=cfg_scale,
        conditioning=conditioning,
        negative_conditioning=negative_conditioning,
        sample_size=sample_size,
        sigma_min=0.3,
        sigma_max=500,
        sampler_type="dpmpp-3m-sde",
        device=device,
    )
    
    output = output.squeeze(0).cpu()
    
    return output, sample_rate


def audio_to_base64(audio_tensor, sample_rate, output_format="mp3"):
    """Convert audio tensor to base64 string"""
    tmp_wav = f"/tmp/dgb_gen_{int(time.time())}.wav"
    tmp_out = tmp_wav.replace(".wav", f".{output_format}")
    
    try:
        torchaudio.save(tmp_wav, audio_tensor, sample_rate)
        
        if output_format == "mp3":
            result = subprocess.run(
                ["ffmpeg", "-i", tmp_wav, "-codec:a", "libmp3lame", "-b:a", "192k", "-y", tmp_out],
                capture_output=True, text=True, timeout=60
            )
            if result.returncode != 0:
                print(f"[SAO] FFmpeg failed, using WAV: {result.stderr[:200]}")
                tmp_out = tmp_wav
                output_format = "wav"
        else:
            tmp_out = tmp_wav
            output_format = "wav"
        
        with open(tmp_out, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode("utf-8")
        
        return audio_b64, output_format
        
    finally:
        for f in [tmp_wav, tmp_out]:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except:
                    pass


def handler(job):
    """RunPod Serverless Handler - processes music generation jobs"""
    job_input = job.get("input", {})
    
    prompt = job_input.get("prompt", "")
    duration_s = float(job_input.get("duration_s", job_input.get("duration", 30.0)))
    negative_prompt = job_input.get("negative_prompt", "Low quality.")
    steps = int(job_input.get("steps", 100))
    cfg_scale = float(job_input.get("cfg_scale", 7.0))
    song_id = job_input.get("song_id", None)
    output_format = job_input.get("output_format", "mp3")
    
    if not prompt:
        return {"error": "No prompt provided"}
    
    if duration_s > 47:
        duration_s = 47.0
    
    print(f"[SAO Handler] Job received - Song: {song_id}, Duration: {duration_s}s")
    start_time = time.time()
    
    try:
        audio_tensor, sample_rate = generate_audio(
            prompt=prompt,
            duration_s=duration_s,
            negative_prompt=negative_prompt,
            steps=steps,
            cfg_scale=cfg_scale,
        )
        
        audio_b64, final_format = audio_to_base64(audio_tensor, sample_rate, output_format)
        
        elapsed = time.time() - start_time
        print(f"[SAO Handler] Generation complete in {elapsed:.1f}s ({len(audio_b64)} bytes b64)")
        
        return {
            "audioBase64": audio_b64,
            "audioFormat": final_format,
            "songId": song_id,
            "durationSeconds": duration_s,
            "generationTimeSeconds": round(elapsed, 1),
        }
        
    except Exception as e:
        elapsed = time.time() - start_time
        error_msg = str(e)
        print(f"[SAO Handler] Error after {elapsed:.1f}s: {error_msg}")
        return {"error": error_msg, "songId": song_id}


# RunPod serverless entry point
runpod.serverless.start({"handler": handler})
