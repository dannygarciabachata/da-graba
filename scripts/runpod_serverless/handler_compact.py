"""DAGRABA Studio - Compact RunPod Serverless Handler"""
import os, sys, time, traceback, subprocess, json, uuid, shutil, requests
from pathlib import Path
try:
    import runpod
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "runpod"])
    import runpod

WS = Path("/runpod-volume") if Path("/runpod-volume").exists() else Path("/workspace")
MODELS = WS / "models"; OUTPUTS = WS / "outputs"; TMP = WS / "tmp"
for d in [MODELS, OUTPUTS, TMP]: d.mkdir(parents=True, exist_ok=True)
os.environ["TMPDIR"] = str(TMP)
HF_TOKEN = os.environ.get("HF_TOKEN", "")
if HF_TOKEN: os.environ["HUGGING_FACE_HUB_TOKEN"] = HF_TOKEN

import torch, torchaudio
print(f"[Init] PyTorch {torch.__version__} | CUDA: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    try: print(f"[Init] GPU: {torch.cuda.get_device_name(0)} | VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
    except: print(f"[Init] GPU: {torch.cuda.get_device_name(0)}")

SAO_FT_REPO = "santifiorino/SAO-Instrumental-Finetune"
SAO_FT_CKPT = "SAO_Instrumental_Finetune.ckpt"
SAO_FT_DIR = MODELS / "sao_instrumental_finetune"
SAO_FT_DIR.mkdir(parents=True, exist_ok=True)
SAO_FT_PATH = SAO_FT_DIR / SAO_FT_CKPT

def webhook(url, data):
    if not url: return
    try: requests.post(url, json=data, timeout=30)
    except: pass

def load_sao_model(model_variant="instrumental_finetune", kit_id=None):
    from stable_audio_tools import get_pretrained_model
    from stable_audio_tools.inference.generation import generate_diffusion_cond
    device = "cuda" if torch.cuda.is_available() else "cpu"
    kit_path = MODELS / f"kit_{kit_id}" / "model_final.pt" if kit_id else None
    if kit_path and kit_path.exists():
        print(f"[SAO] Loading kit {kit_id} weights")
        model, model_config = get_pretrained_model("stabilityai/stable-audio-open-1.0")
        checkpoint = torch.load(str(kit_path), map_location=device, weights_only=False)
        if "model_state_dict" in checkpoint:
            model.load_state_dict(checkpoint["model_state_dict"], strict=False)
        model = model.to(device)
        return model, model_config, device
    if model_variant == "instrumental_finetune":
        if not SAO_FT_PATH.exists():
            print(f"[SAO] Downloading SAO Instrumental Finetune from {SAO_FT_REPO}...")
            from huggingface_hub import hf_hub_download
            hf_hub_download(repo_id=SAO_FT_REPO, filename=SAO_FT_CKPT, local_dir=str(SAO_FT_DIR), token=HF_TOKEN or None)
        print(f"[SAO] Loading Instrumental Finetune checkpoint...")
        model, model_config = get_pretrained_model("stabilityai/stable-audio-open-1.0")
        ckpt = torch.load(str(SAO_FT_PATH), map_location=device, weights_only=False)
        if isinstance(ckpt, dict) and "model_state_dict" in ckpt:
            model.load_state_dict(ckpt["model_state_dict"], strict=False)
        elif isinstance(ckpt, dict) and "state_dict" in ckpt:
            sd = {k.replace("model.", "", 1): v for k, v in ckpt["state_dict"].items() if k.startswith("model.")}
            if sd: model.load_state_dict(sd, strict=False)
            else: model.load_state_dict(ckpt["state_dict"], strict=False)
        model = model.to(device)
        return model, model_config, device
    print("[SAO] Loading base SAO model...")
    model, model_config = get_pretrained_model("stabilityai/stable-audio-open-1.0")
    model = model.to(device)
    return model, model_config, device

def handle_generate(inp):
    sid = inp.get("song_id", 0)
    prompt = inp.get("prompt", "Bachata guitar melody")
    dur = min(inp.get("duration_seconds", 30), 47)
    kit_id = inp.get("style_kit_id")
    variant = inp.get("sao_model", "instrumental_finetune")
    wh = inp.get("webhook_url", "")
    print(f"[Gen] Song {sid} | {dur}s | kit={kit_id} | variant={variant}")
    webhook(wh, {"songId": sid, "status": "processing", "message": "Loading model..."})
    try:
        model, mc, device = load_sao_model(variant, kit_id)
        sr = mc.get("sample_rate", 44100)
        from stable_audio_tools.inference.generation import generate_diffusion_cond
        conditioning = [{"prompt": prompt, "seconds_start": 0, "seconds_total": dur}]
        webhook(wh, {"songId": sid, "status": "processing", "message": "Generating audio..."})
        with torch.no_grad():
            output = generate_diffusion_cond(model, conditioning=conditioning, sample_size=int(dur * sr), sample_rate=sr, device=device, steps=100)
        audio = output.squeeze(0).cpu()
        if audio.dim() == 1: audio = audio.unsqueeze(0)
        out_dir = OUTPUTS / "music" / f"song_{sid}"
        out_dir.mkdir(parents=True, exist_ok=True)
        wav_path = str(out_dir / f"{uuid.uuid4().hex[:8]}.wav")
        torchaudio.save(wav_path, audio, sr)
        print(f"[Gen] Saved WAV: {wav_path}")
        mp3_path = wav_path.replace(".wav", ".mp3")
        try:
            subprocess.run(["ffmpeg", "-y", "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", "320k", mp3_path], capture_output=True, timeout=60)
            if os.path.exists(mp3_path): print(f"[Gen] MP3: {mp3_path}")
        except: mp3_path = wav_path
        del model; torch.cuda.empty_cache()
        webhook(wh, {"songId": sid, "status": "completed", "audioPath": mp3_path if os.path.exists(mp3_path) else wav_path, "duration": dur})
        return {"status": "completed", "song_id": sid, "audio_path": mp3_path if os.path.exists(mp3_path) else wav_path, "duration": dur, "sample_rate": sr}
    except Exception as e:
        err = str(e); print(f"[Gen] Failed: {traceback.format_exc()}")
        if torch.cuda.is_available(): torch.cuda.empty_cache()
        webhook(wh, {"songId": sid, "status": "failed", "error": err})
        return {"status": "failed", "error": err, "song_id": sid}

def handle_train(inp):
    kit_id = inp.get("kit_id", 0)
    kit_name = inp.get("kit_name", f"kit_{kit_id}")
    genre = inp.get("genre", "bachata")
    instruments = inp.get("instruments", [])
    config = inp.get("training_config", {})
    wh = inp.get("webhook_url", "")
    epochs = config.get("epochs", 100)
    lr = config.get("learning_rate", 5e-5)
    print(f"[Train] Kit {kit_id} ({kit_name}) | {genre} | {len(instruments)} instruments | {epochs} epochs")
    webhook(wh, {"kitId": kit_id, "status": "training", "message": "Starting training..."})
    try:
        from stable_audio_tools import get_pretrained_model
        model, mc = get_pretrained_model("stabilityai/stable-audio-open-1.0")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)
        sr = mc.get("sample_rate", 44100)
        audio_data = []
        for inst in instruments:
            url = inst.get("audioUrl", "")
            if not url: continue
            tmp_path = str(TMP / f"inst_{inst.get('id', 0)}.wav")
            r = requests.get(url, timeout=120); r.raise_for_status()
            with open(tmp_path, "wb") as f: f.write(r.content)
            waveform, orig_sr = torchaudio.load(tmp_path)
            if orig_sr != sr: waveform = torchaudio.functional.resample(waveform, orig_sr, sr)
            if waveform.shape[0] == 1: waveform = waveform.repeat(2, 1)
            max_len = sr * 47
            if waveform.shape[1] > max_len: waveform = waveform[:, :max_len]
            audio_data.append({"waveform": waveform, "prompt": inst.get("prompt", f"{inst.get('name','')} {genre}")})
            print(f"[Train] Loaded {inst.get('name','')} ({waveform.shape})")
        if not audio_data: raise Exception("No valid audio data loaded")
        diffusion_model = None
        for name, module in model.named_modules():
            if "diffusion" in name.lower() and hasattr(module, "parameters"):
                diffusion_model = module; break
        if diffusion_model is None:
            for name, module in model.named_children():
                if hasattr(module, "parameters") and sum(p.numel() for p in module.parameters()) > 1e6:
                    diffusion_model = module; break
        if diffusion_model is None: diffusion_model = model
        trainable_params = [p for p in diffusion_model.parameters() if p.requires_grad]
        optimizer = torch.optim.AdamW(trainable_params, lr=lr, weight_decay=0.01)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
        scaler = torch.amp.GradScaler("cuda") if device == "cuda" else None
        model_save_dir = MODELS / f"kit_{kit_id}"
        model_save_dir.mkdir(parents=True, exist_ok=True)
        best_loss = float("inf")
        t0 = time.time()
        for epoch in range(epochs):
            eloss, nb = 0.0, 0
            for item in audio_data:
                ab = item["waveform"].unsqueeze(0).to(device)
                try:
                    noise = torch.randn_like(ab)
                    sigma = torch.rand(1, device=device) * 499.7 + 0.3
                    sigma = sigma.view(-1, 1, 1)
                    noisy = ab + noise * sigma
                    with torch.amp.autocast("cuda", enabled=device=="cuda"):
                        pred = diffusion_model(noisy, sigma.squeeze())
                        if pred.shape != ab.shape:
                            ml = min(pred.shape[-1], ab.shape[-1])
                            pred = pred[..., :ml]; noise = noise[..., :ml]
                        loss = torch.nn.functional.mse_loss(pred, noise[..., :pred.shape[-1]])
                    optimizer.zero_grad()
                    if scaler:
                        scaler.scale(loss).backward(); scaler.unscale_(optimizer)
                        torch.nn.utils.clip_grad_norm_(trainable_params, 1.0)
                        scaler.step(optimizer); scaler.update()
                    else:
                        loss.backward(); torch.nn.utils.clip_grad_norm_(trainable_params, 1.0); optimizer.step()
                    eloss += loss.item(); nb += 1
                except Exception as e:
                    print(f"[Train] Batch error epoch {epoch+1}: {e}"); continue
            scheduler.step()
            avg = eloss / max(nb, 1)
            if (epoch + 1) % 10 == 0 or epoch == 0:
                print(f"[Train] Epoch {epoch+1}/{epochs} | Loss: {avg:.6f} | Time: {time.time()-t0:.0f}s")
                webhook(wh, {"kitId": kit_id, "status": "training", "message": f"Epoch {epoch+1}/{epochs}, loss={avg:.6f}", "epoch": epoch+1, "loss": avg})
            if avg < best_loss and nb > 0:
                best_loss = avg
                torch.save({"model_state_dict": model.state_dict(), "epoch": epoch+1, "loss": best_loss, "kit_id": kit_id}, str(model_save_dir / "best_model.pt"))
        total = time.time() - t0
        final_path = str(model_save_dir / "model_final.pt")
        torch.save({"model_state_dict": model.state_dict(), "model_config": mc, "kit_id": kit_id, "kit_name": kit_name, "genre": genre, "training_time": total, "best_loss": best_loss, "epochs": epochs, "sample_rate": sr}, final_path)
        del model; torch.cuda.empty_cache()
        webhook(wh, {"kitId": kit_id, "status": "completed", "modelPath": final_path, "bestLoss": best_loss, "trainingTime": total, "epochs": epochs})
        return {"status": "completed", "kit_id": kit_id, "model_path": final_path, "best_loss": best_loss, "training_time": total}
    except Exception as e:
        err = str(e); print(f"[Train] Failed: {traceback.format_exc()}")
        if torch.cuda.is_available(): torch.cuda.empty_cache()
        webhook(wh, {"kitId": kit_id, "status": "failed", "error": err})
        return {"status": "failed", "error": err, "kit_id": kit_id}

def handle_stems(inp):
    sid = inp.get("song_id", 0)
    url = inp.get("audio_url", "")
    mdl = inp.get("model", "htdemucs")
    wh = inp.get("webhook_url", "")
    if not url: return {"status": "failed", "error": "No audio_url", "song_id": sid}
    try:
        sdir = OUTPUTS / "stems" / f"song_{sid}"
        sdir.mkdir(parents=True, exist_ok=True)
        inp_path = str(sdir / "input.wav")
        r = requests.get(url, timeout=120); r.raise_for_status()
        with open(inp_path, "wb") as f: f.write(r.content)
        result = subprocess.run([sys.executable, "-m", "demucs", "-n", mdl, "-o", str(sdir), inp_path], capture_output=True, text=True, timeout=600)
        if result.returncode != 0: raise Exception(f"Demucs failed: {result.stderr[:300]}")
        stems = {}
        for stem in ["vocals", "drums", "bass", "other"]:
            sf = sdir / mdl / "input" / f"{stem}.wav"
            if sf.exists(): stems[stem] = str(sf)
        if not stems:
            for p in sdir.rglob("*.wav"):
                if p.name != "input.wav": stems[p.stem] = str(p)
        webhook(wh, {"songId": sid, "status": "completed", "stems": stems, "model": mdl})
        return {"status": "completed", "song_id": sid, "stems": stems}
    except Exception as e:
        err = str(e); print(f"[Stems] Failed: {traceback.format_exc()}")
        webhook(wh, {"songId": sid, "status": "failed", "error": err})
        return {"status": "failed", "error": err, "song_id": sid}

def handler(job):
    try:
        inp = job.get("input", {})
        action = inp.get("action", "")
        print(f"[DAGRABA] Action: {action} | GPU: {torch.cuda.is_available()}")
        if action == "generate_music": return handle_generate(inp)
        elif action == "train_model": return handle_train(inp)
        elif action == "separate_stems": return handle_stems(inp)
        elif action == "health_check":
            return {"status": "healthy", "gpu": torch.cuda.is_available(), "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "N/A", "models": len(list(MODELS.glob("kit_*"))), "server": "dagraba-v2"}
        else: return {"status": "error", "error": f"Unknown action: {action}"}
    except Exception as e:
        print(f"[DAGRABA] CRITICAL: {traceback.format_exc()}")
        return {"status": "failed", "error": str(e)}

print("[DAGRABA] Starting handler...")
runpod.serverless.start({"handler": handler})
