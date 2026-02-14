import type { TrainingConfig } from "./sao_training_engine";
import WebSocket from "ws";

const RUNPOD_TOKEN = () => process.env.RUNPOD_JUPYTER_TOKEN || "";

interface RunPodJobResponse {
  success: boolean;
  jobId?: string;
  kernelId?: string;
  error?: string;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = RUNPOD_TOKEN();
  if (token) {
    headers["Authorization"] = `token ${token}`;
  }
  return headers;
}

function getBaseUrl(): string {
  const base = process.env.RUNPOD_BASE_URL || "";
  if (!base) throw new Error("RUNPOD_BASE_URL is not configured");
  return base.replace(/\/lab\/.*$/, "").replace(/\/$/, "");
}

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function getOrCreateKernel(): Promise<string> {
  const base = getBaseUrl();
  const headers = getHeaders();

  const listRes = await fetchWithTimeout(`${base}/api/kernels`, { headers }, 15000);
  if (listRes.ok) {
    const kernels = await listRes.json();
    if (Array.isArray(kernels) && kernels.length > 0) {
      return kernels[0].id;
    }
  }

  const createRes = await fetchWithTimeout(`${base}/api/kernels`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "python3" }),
  }, 15000);

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Failed to create Jupyter kernel: ${createRes.status} ${errorText}`);
  }

  const kernel = await createRes.json();
  return kernel.id;
}

async function executeCode(kernelId: string, code: string, timeoutMs: number = 60000): Promise<string> {
  const base = getBaseUrl();
  const token = RUNPOD_TOKEN();

  const wsProtocol = base.startsWith("https") ? "wss" : "ws";
  const wsBase = base.replace(/^https?/, wsProtocol);
  const tokenParam = token ? `?token=${token}` : "";

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      try { ws.close(); } catch {}
      resolve("execution_timeout_submitted");
    }, timeoutMs);

    let ws: any;

    try {
      ws = new WebSocket(
        `${wsBase}/api/kernels/${kernelId}/channels${tokenParam}`
      );
    } catch (err: any) {
      clearTimeout(timeout);
      reject(new Error(`WebSocket connection failed: ${err.message}`));
      return;
    }

    const msgId = `sao_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const sessionId = `session_${Date.now()}`;
    let output = "";
    let shellReplyReceived = false;

    ws.on("open", () => {
      ws.send(JSON.stringify({
        header: {
          msg_id: msgId,
          msg_type: "execute_request",
          username: "dgb_studio",
          session: sessionId,
          date: new Date().toISOString(),
          version: "5.3",
        },
        parent_header: {},
        metadata: {},
        content: {
          code,
          silent: false,
          store_history: true,
          user_expressions: {},
          allow_stdin: false,
          stop_on_error: true,
        },
        channel: "shell",
        buffers: [],
      }));
    });

    ws.on("message", (data: any) => {
      try {
        const msg = JSON.parse(data.toString());
        const parentMsgId = msg.parent_header?.msg_id;
        if (parentMsgId !== msgId) return;

        switch (msg.msg_type) {
          case "stream":
            output += msg.content?.text || "";
            break;

          case "execute_result":
            output += msg.content?.data?.["text/plain"] || "";
            break;

          case "display_data":
            output += msg.content?.data?.["text/plain"] || "";
            break;

          case "error":
            const traceback = msg.content?.traceback?.join("\n") || "";
            const ename = msg.content?.ename || "Error";
            const evalue = msg.content?.evalue || "Unknown error";
            clearTimeout(timeout);
            ws.close();
            reject(new Error(`${ename}: ${evalue}\n${traceback}`));
            return;

          case "execute_reply":
            shellReplyReceived = true;
            if (msg.content?.status === "error") {
              clearTimeout(timeout);
              ws.close();
              reject(new Error(msg.content?.evalue || "Execution failed"));
              return;
            }
            break;

          case "status":
            if (msg.content?.execution_state === "idle" && shellReplyReceived) {
              clearTimeout(timeout);
              ws.close();
              resolve(output || "executed");
              return;
            }
            break;
        }
      } catch {}
    });

    ws.on("error", (err: any) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${err.message}`));
    });

    ws.on("close", () => {
      clearTimeout(timeout);
      if (!shellReplyReceived) {
        resolve(output || "connection_closed");
      }
    });
  });
}

function buildTrainingScript(kitId: number, config: TrainingConfig, webhookUrl: string): string {
  const configJson = JSON.stringify(config, null, 2).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const hfToken = process.env.HF_TOKEN || "";

  return `
import json
import subprocess
import sys
import os
import time
import requests
import traceback

kit_id = ${kitId}
webhook_url = "${webhookUrl}"
hf_token = "${hfToken}"

if hf_token:
    os.environ["HF_TOKEN"] = hf_token
    os.environ["HUGGING_FACE_HUB_TOKEN"] = hf_token

training_config = json.loads('''${configJson}''')

config_path = f"/workspace/training_configs/kit_{kit_id}.json"
os.makedirs(os.path.dirname(config_path), exist_ok=True)
with open(config_path, "w") as f:
    json.dump(training_config, f, indent=2)

kit_name = training_config["kit"]["name"]
kit_genre = training_config["kit"]["genre"]
n_instruments = len(training_config["dataset"]["instruments"])
print(f"[SAO Train] Kit: {kit_name} | Genre: {kit_genre} | Instruments: {n_instruments}")

def send_webhook(status, message, extra=None):
    payload = {"kitId": kit_id, "status": status, "jobId": f"sao_kit_{kit_id}", "message": message}
    if extra:
        payload.update(extra)
    try:
        requests.post(webhook_url, json=payload, timeout=15)
    except:
        pass

send_webhook("training", f"Downloading {n_instruments} instrument samples...")

# === STEP 1: Download and prepare training data ===
import numpy as np
instrument_dir = f"/workspace/training_data/kit_{kit_id}"
os.makedirs(instrument_dir, exist_ok=True)

downloaded_files = {}
for instr in training_config["dataset"]["instruments"]:
    audio_url = instr["audioUrl"]
    safe_name = instr["name"].replace(" ", "_").replace("/", "_")
    filename = f"{instr['id']}_{safe_name}"
    src_ext = "wav"
    if "." in audio_url.split("?")[0]:
        src_ext = audio_url.split("?")[0].rsplit(".", 1)[-1].lower()
    src_path = os.path.join(instrument_dir, f"{filename}.{src_ext}")
    wav_path = os.path.join(instrument_dir, f"{filename}.wav")
    final_path = None
    try:
        r = requests.get(audio_url, timeout=120)
        r.raise_for_status()
        with open(src_path, "wb") as f:
            f.write(r.content)
        if src_ext != "wav":
            try:
                result = subprocess.run(
                    ["ffmpeg", "-i", src_path, "-ar", "44100", "-ac", "2", wav_path, "-y"],
                    capture_output=True, text=True, timeout=60
                )
                if result.returncode == 0:
                    os.remove(src_path)
                    final_path = wav_path
                else:
                    final_path = src_path
            except:
                final_path = src_path
        else:
            final_path = src_path
        print(f"[SAO Train] Downloaded: {instr['name']}")
    except Exception as e:
        print(f"[SAO Train] Failed: {instr['name']}: {e}")
    if final_path and os.path.exists(final_path):
        downloaded_files[instr["id"]] = {"path": final_path, "prompt": instr["prompt"]}

if len(downloaded_files) == 0:
    send_webhook("failed", "No instrument samples could be downloaded")
    raise Exception("No training data available")

metadata_path = os.path.join(instrument_dir, "metadata.json")
metadata = []
for instr in training_config["dataset"]["instruments"]:
    entry = downloaded_files.get(instr["id"])
    if not entry:
        continue
    metadata.append({"file": os.path.basename(entry["path"]), "prompt": entry["prompt"]})
with open(metadata_path, "w") as f:
    json.dump(metadata, f, indent=2)

print(f"[SAO Train] {len(downloaded_files)} samples ready for training")
send_webhook("training", f"Data ready. Loading Stable Audio Open model for fine-tuning...")

# === STEP 2: Install dependencies if needed ===
try:
    import torch
    import torchaudio
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "torch", "torchaudio", "--quiet"], check=True)
    import torch
    import torchaudio

try:
    from stable_audio_tools import get_pretrained_model
    from stable_audio_tools.inference.generation import generate_diffusion_cond
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "stable-audio-tools", "--quiet"], check=True)
    from stable_audio_tools import get_pretrained_model
    from stable_audio_tools.inference.generation import generate_diffusion_cond

try:
    import soundfile as sf
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "soundfile", "--quiet"], check=True)
    import soundfile as sf

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[SAO Train] Device: {device} | GPU: {torch.cuda.get_device_name(0) if device == 'cuda' else 'N/A'}")

# === STEP 3: Load base model ===
print("[SAO Train] Loading Stable Audio Open base model...")
model, model_config = get_pretrained_model("stabilityai/stable-audio-open-1.0")
sample_rate = model_config["sample_rate"]
model = model.to(device)
print(f"[SAO Train] Base model loaded (sample_rate={sample_rate})")

# === STEP 4: Prepare training dataset ===
print("[SAO Train] Preparing training dataset...")

class InstrumentDataset(torch.utils.data.Dataset):
    def __init__(self, metadata, data_dir, target_sr, max_len_s=47):
        self.items = []
        self.target_sr = target_sr
        self.max_samples = max_len_s * target_sr
        for entry in metadata:
            fpath = os.path.join(data_dir, entry["file"])
            if os.path.exists(fpath):
                self.items.append({"path": fpath, "prompt": entry["prompt"]})
    
    def __len__(self):
        return len(self.items) * 20
    
    def __getitem__(self, idx):
        item = self.items[idx % len(self.items)]
        waveform, sr = torchaudio.load(item["path"])
        if sr != self.target_sr:
            waveform = torchaudio.functional.resample(waveform, sr, self.target_sr)
        if waveform.shape[0] == 1:
            waveform = waveform.repeat(2, 1)
        elif waveform.shape[0] > 2:
            waveform = waveform[:2]
        if waveform.shape[1] > self.max_samples:
            start = torch.randint(0, waveform.shape[1] - self.max_samples, (1,)).item()
            waveform = waveform[:, start:start + self.max_samples]
        else:
            pad = self.max_samples - waveform.shape[1]
            waveform = torch.nn.functional.pad(waveform, (0, pad))
        return waveform, item["prompt"]

dataset = InstrumentDataset(metadata, instrument_dir, sample_rate)
print(f"[SAO Train] Dataset: {len(dataset)} training samples from {len(dataset.items)} audio files")

if len(dataset.items) == 0:
    send_webhook("failed", "No valid audio files for training")
    raise Exception("Empty dataset")

# === STEP 5: Fine-tune with LoRA-style parameter-efficient training ===
lr = training_config["training"]["learning_rate"]
epochs = training_config["training"]["epochs"]
batch_size = training_config["training"]["batch_size"]

print(f"[SAO Train] Starting fine-tuning: lr={lr}, epochs={epochs}, batch_size={batch_size}")
send_webhook("training", f"Fine-tuning started: {epochs} epochs, lr={lr}")

model.train()

trainable_params = []
for name, param in model.named_parameters():
    if any(k in name.lower() for k in ["diffusion", "unet", "denoise", "noise_pred"]):
        param.requires_grad = True
        trainable_params.append(param)
    else:
        param.requires_grad = False

if len(trainable_params) == 0:
    for name, param in model.named_parameters():
        param.requires_grad = True
        trainable_params.append(param)
    print(f"[SAO Train] Training ALL {len(trainable_params)} parameters (full fine-tune)")
else:
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in trainable_params)
    print(f"[SAO Train] Training {len(trainable_params)} param groups ({trainable:,}/{total:,} params, {100*trainable/total:.1f}%)")

optimizer = torch.optim.AdamW(trainable_params, lr=lr, weight_decay=0.01)
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

dataloader = torch.utils.data.DataLoader(dataset, batch_size=batch_size, shuffle=True, num_workers=0)

best_loss = float("inf")
model_save_dir = f"/workspace/trained_models/kit_{kit_id}"
os.makedirs(model_save_dir, exist_ok=True)
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

print(f"[SAO Train] Diffusion model type: {type(diffusion_model).__name__}")
if conditioner:
    print(f"[SAO Train] Conditioner type: {type(conditioner).__name__}")

scaler = torch.cuda.amp.GradScaler(enabled=device=="cuda")

for epoch in range(epochs):
    epoch_loss = 0.0
    n_batches = 0
    
    for batch_audio, batch_prompts in dataloader:
        batch_audio = batch_audio.to(device)
        
        try:
            noise = torch.randn_like(batch_audio)
            sigma = torch.rand(batch_audio.shape[0], device=device) * 499.7 + 0.3
            sigma = sigma.view(-1, 1, 1)
            
            noisy_audio = batch_audio + noise * sigma
            
            cond_input = None
            if conditioner is not None:
                try:
                    cond_input = conditioner([{"prompt": p, "seconds_start": 0, "seconds_total": 47} for p in batch_prompts], device=device)
                except Exception:
                    try:
                        cond_input = conditioner(batch_prompts)
                    except Exception as ce:
                        print(f"[SAO Train] Conditioner failed: {ce}, training without conditioning")
            
            with torch.cuda.amp.autocast(enabled=device=="cuda"):
                try:
                    if cond_input is not None:
                        predicted = diffusion_model(noisy_audio, sigma.squeeze(), cond_input)
                    else:
                        predicted = diffusion_model(noisy_audio, sigma.squeeze())
                except TypeError:
                    predicted = diffusion_model(noisy_audio, sigma.squeeze())
                
                if predicted.shape != batch_audio.shape:
                    min_len = min(predicted.shape[-1], batch_audio.shape[-1])
                    predicted = predicted[..., :min_len]
                    batch_audio_trimmed = batch_audio[..., :min_len]
                    noise_trimmed = noise[..., :min_len]
                else:
                    batch_audio_trimmed = batch_audio
                    noise_trimmed = noise
                
                loss = torch.nn.functional.mse_loss(predicted, noise_trimmed)
            
            optimizer.zero_grad()
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(trainable_params, 1.0)
            scaler.step(optimizer)
            scaler.update()
            
            epoch_loss += loss.item()
            n_batches += 1
            
        except Exception as e:
            print(f"[SAO Train] Batch error (epoch {epoch+1}): {e}")
            import traceback; traceback.print_exc()
            continue
    
    scheduler.step()
    avg_loss = epoch_loss / max(n_batches, 1)
    elapsed = time.time() - train_start
    
    if (epoch + 1) % 10 == 0 or epoch == 0:
        print(f"[SAO Train] Epoch {epoch+1}/{epochs} | Loss: {avg_loss:.6f} | Time: {elapsed:.0f}s")
        send_webhook("training", f"Epoch {epoch+1}/{epochs}, loss={avg_loss:.6f}", {"epoch": epoch+1, "loss": avg_loss})
    
    if avg_loss < best_loss and n_batches > 0:
        best_loss = avg_loss
        checkpoint_path = os.path.join(model_save_dir, "best_model.pt")
        torch.save({
            "model_state_dict": {k: v for k, v in model.state_dict().items() if any(kw in k.lower() for kw in ["diffusion", "unet", "denoise", "noise_pred"])},
            "optimizer_state_dict": optimizer.state_dict(),
            "epoch": epoch + 1,
            "loss": best_loss,
            "kit_id": kit_id,
            "kit_name": kit_name,
            "genre": kit_genre,
        }, checkpoint_path)

total_time = time.time() - train_start
print(f"[SAO Train] Training complete! {epochs} epochs in {total_time:.0f}s, best_loss={best_loss:.6f}")

# === STEP 6: Generate demo samples with fine-tuned model ===
model.eval()
demo_prompts = training_config["training"].get("demo_prompts", [f"A beautiful {kit_genre} track"])
demo_dir = os.path.join(model_save_dir, "demos")
os.makedirs(demo_dir, exist_ok=True)

for i, dp in enumerate(demo_prompts[:3]):
    try:
        with torch.no_grad():
            demo_output = generate_diffusion_cond(
                model,
                steps=100,
                cfg_scale=7,
                conditioning=[{"prompt": dp, "seconds_start": 0, "seconds_total": 30}],
                sample_size=model_config["sample_size"],
                sigma_min=0.3,
                sigma_max=500,
                sampler_type="dpmpp-3m-sde",
                device=device
            )
        demo_audio = demo_output.squeeze(0).cpu()
        if demo_audio.dim() == 1:
            demo_audio = demo_audio.unsqueeze(0)
        demo_path = os.path.join(demo_dir, f"demo_{i+1}.wav")
        torchaudio.save(demo_path, demo_audio, sample_rate)
        print(f"[SAO Train] Demo {i+1} saved: {demo_path}")
    except Exception as e:
        print(f"[SAO Train] Demo {i+1} failed: {e}")

final_checkpoint = os.path.join(model_save_dir, "final_model.pt")
torch.save({
    "model_state_dict": model.state_dict(),
    "model_config": model_config,
    "kit_id": kit_id,
    "kit_name": kit_name,
    "genre": kit_genre,
    "training_time": total_time,
    "best_loss": best_loss,
    "epochs": epochs,
    "sample_rate": sample_rate,
}, final_checkpoint)

print(f"[SAO Train] Final model saved: {final_checkpoint}")
send_webhook("completed", f"Training complete! {epochs} epochs, loss={best_loss:.6f}, time={total_time:.0f}s", {
    "modelPath": final_checkpoint,
    "bestLoss": best_loss,
    "trainingTime": total_time,
    "epochs": epochs
})

print(json.dumps({"status": "completed", "kit_id": kit_id, "model_path": final_checkpoint, "best_loss": best_loss}))
`;
}

function buildAnalysisScript(instrumentId: number, audioUrl: string, instrumentName: string, webhookUrl: string): string {
  const safeName = instrumentName.replace(/"/g, '\\"').replace(/'/g, "\\'");

  return `
import json
import os
import requests

instrument_id = ${instrumentId}
audio_url = "${audioUrl}"
instrument_name = "${safeName}"
webhook_url = "${webhookUrl}"

analysis_dir = "/workspace/analysis_temp"
os.makedirs(analysis_dir, exist_ok=True)

src_ext = "wav"
if "." in audio_url.split("?")[0]:
    src_ext = audio_url.split("?")[0].rsplit(".", 1)[-1].lower()
filepath = os.path.join(analysis_dir, f"instr_{instrument_id}.{src_ext}")

print(f"[SAO Analysis] Downloading {instrument_name}...")
try:
    r = requests.get(audio_url, timeout=120)
    r.raise_for_status()
    with open(filepath, "wb") as f:
        f.write(r.content)
    print(f"[SAO Analysis] Downloaded to {filepath}")
except Exception as e:
    print(f"[SAO Analysis] Download failed: {e}")
    try:
        requests.post(webhook_url, json={"instrumentId": instrument_id, "error": str(e)}, timeout=10)
    except:
        pass
    raise

result = {"instrumentId": instrument_id}

try:
    import librosa
    import numpy as np
    y, sr = librosa.load(filepath, sr=None)
    
    duration_ms = int(len(y) / sr * 1000)
    result["durationMs"] = duration_ms
    print(f"[SAO Analysis] Duration: {duration_ms}ms")
    
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    if hasattr(tempo, '__len__'):
        tempo = float(tempo[0]) if len(tempo) > 0 else 120.0
    result["bpm"] = round(float(tempo))
    print(f"[SAO Analysis] BPM: {result['bpm']}")
    
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    key_idx = int(chroma.mean(axis=1).argmax())
    
    chroma_mean = chroma.mean(axis=1)
    major_sum = sum(float(chroma_mean[(key_idx + i) % 12]) for i in [0, 4, 7])
    minor_sum = sum(float(chroma_mean[(key_idx + i) % 12]) for i in [0, 3, 7])
    mode = "Major" if major_sum >= minor_sum else "Minor"
    result["key"] = f"{key_names[key_idx]} {mode}"
    print(f"[SAO Analysis] Key: {result['key']}")
    
    rms = librosa.feature.rms(y=y)[0]
    rms_max = float(rms.max())
    energy = float(rms.mean()) / (rms_max + 1e-6) if rms_max > 0 else 0.5
    result["energy"] = round(min(max(energy, 0), 1), 2)
    print(f"[SAO Analysis] Energy: {result['energy']}")
    
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    avg_centroid = float(spectral_centroid.mean())
    
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    avg_zcr = float(zcr.mean())
    
    acousticness_score = max(0.0, min(1.0, 1.0 - (avg_centroid / 8000.0)))
    result["acousticness"] = round(acousticness_score, 2)
    print(f"[SAO Analysis] Acousticness: {result['acousticness']}")
    
    tags = []
    if avg_centroid < 2000:
        tags.extend(["warm", "bass-heavy"])
    elif avg_centroid < 4000:
        tags.extend(["balanced", "midrange"])
    else:
        tags.extend(["bright", "treble"])
    
    if result["energy"] > 0.7:
        tags.append("energetic")
    elif result["energy"] < 0.3:
        tags.extend(["soft", "ambient"])
    
    if acousticness_score > 0.7:
        tags.append("acoustic")
    
    if duration_ms < 5000:
        tags.append("short-sample")
    elif duration_ms > 30000:
        tags.append("full-track")
    
    result["tags"] = tags
    print(f"[SAO Analysis] Tags: {tags}")

except ImportError:
    print("[SAO Analysis] librosa not available, using basic analysis")
    try:
        import wave
        with wave.open(filepath, 'r') as wav:
            frames = wav.getnframes()
            rate = wav.getframerate()
            duration_ms = int(frames / rate * 1000)
            result["durationMs"] = duration_ms
            result["tags"] = ["audio-sample"]
    except:
        result["tags"] = ["audio-file"]

except Exception as e:
    print(f"[SAO Analysis] Analysis error: {e}")
    result["tags"] = ["analysis-partial"]
    result["error"] = str(e)

try:
    resp = requests.post(webhook_url, json=result, timeout=10)
    print(f"[SAO Analysis] Webhook sent: {resp.status_code}")
except Exception as e:
    print(f"[SAO Analysis] Webhook failed: {e}")

print(json.dumps(result))

try:
    os.remove(filepath)
except:
    pass
`;
}

export async function submitTrainingJob(
  kitId: number,
  config: TrainingConfig,
  webhookUrl: string
): Promise<RunPodJobResponse> {
  try {
    const kernelId = await getOrCreateKernel();
    const script = buildTrainingScript(kitId, config, webhookUrl);

    console.log(`[RunPod] Submitting training job for kit ${kitId} to kernel ${kernelId}`);
    const output = await executeCode(kernelId, script);
    console.log(`[RunPod] Training job submitted: ${output.substring(0, 200)}`);

    return {
      success: true,
      jobId: `sao_kit_${kitId}_${Date.now()}`,
      kernelId,
    };
  } catch (err: any) {
    console.error(`[RunPod] Training submission failed for kit ${kitId}:`, err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

export async function submitAnalysisJob(
  instrumentId: number,
  audioUrl: string,
  instrumentName: string,
  webhookUrl: string
): Promise<RunPodJobResponse> {
  try {
    const kernelId = await getOrCreateKernel();
    const script = buildAnalysisScript(instrumentId, audioUrl, instrumentName, webhookUrl);

    console.log(`[RunPod] Submitting analysis job for instrument ${instrumentId}`);
    const output = await executeCode(kernelId, script);
    console.log(`[RunPod] Analysis job submitted: ${output.substring(0, 200)}`);

    return {
      success: true,
      jobId: `analysis_${instrumentId}_${Date.now()}`,
      kernelId,
    };
  } catch (err: any) {
    console.error(`[RunPod] Analysis submission failed for instrument ${instrumentId}:`, err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

export function isRunPodConfigured(): boolean {
  return !!(process.env.RUNPOD_BASE_URL);
}

export async function checkRunPodConnection(): Promise<{ connected: boolean; kernels?: number; error?: string }> {
  try {
    const base = getBaseUrl();
    const headers = getHeaders();
    const kernelRes = await fetch(`${base}/api/kernels`, { headers, signal: AbortSignal.timeout(10000) });
    if (kernelRes.ok) {
      const kernels = await kernelRes.json();
      return { connected: true, kernels: Array.isArray(kernels) ? kernels.length : 0 };
    }

    const statusRes = await fetch(`${base}/api/status`, { headers, signal: AbortSignal.timeout(10000) });
    if (statusRes.ok) return { connected: true };

    return { connected: false, error: `Server responded with ${kernelRes.status}` };
  } catch (err: any) {
    return { connected: false, error: err.message };
  }
}

function getRunPodApiKey(): string {
  return process.env.RUNPOD_API_KEY || "";
}

function getRunPodPodId(): string {
  return process.env.RUNPOD_POD_ID || "";
}

export async function getGpuStatus(): Promise<{
  podId: string;
  podName: string;
  gpuCount: number;
  gpuName: string;
  status: string;
  cudaAvailable: boolean;
  installedPackages: string[];
  missingPackages: string[];
  error?: string;
}> {
  const podId = getRunPodPodId();
  const apiKey = getRunPodApiKey();
  const result: any = {
    podId,
    podName: "",
    gpuCount: 0,
    gpuName: "",
    status: "unknown",
    cudaAvailable: false,
    installedPackages: [],
    missingPackages: [],
  };

  if (apiKey && podId) {
    try {
      const res = await fetch(`https://api.runpod.io/graphql?api_key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query { pod(input: { podId: "${podId}" }) { id name gpuCount desiredStatus machine { gpuDisplayName } runtime { uptimeInSeconds gpus { id } } } }`,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (data?.data?.pod) {
        const pod = data.data.pod;
        result.podName = pod.name || "";
        result.gpuCount = pod.gpuCount || 0;
        result.gpuName = pod.machine?.gpuDisplayName || "";
        result.status = pod.desiredStatus || "unknown";
      }
    } catch (err: any) {
      result.error = `API: ${err.message}`;
    }
  }

  if (isRunPodConfigured()) {
    try {
      const conn = await checkRunPodConnection();
      if (conn.connected) {
        result.status = result.gpuCount > 0 ? "running_with_gpu" : "running_cpu_only";
        const kernelId = await getOrCreateKernel();
        const diagOutput = await executeCode(kernelId, `
import json, sys
pkgs = {}
for p in ["torch", "torchaudio", "diffusers", "transformers", "accelerate", "stable_audio_tools", "demucs", "librosa", "soundfile", "scipy"]:
    try:
        mod = __import__(p)
        pkgs[p] = getattr(mod, "__version__", "ok")
    except ImportError:
        pkgs[p] = None
cuda = False
try:
    import torch
    cuda = torch.cuda.is_available()
except: pass
print(json.dumps({"packages": pkgs, "cuda": cuda}))
`);
        try {
          const diag = JSON.parse(diagOutput.trim().split("\n").pop() || "{}");
          result.cudaAvailable = diag.cuda || false;
          for (const [pkg, ver] of Object.entries(diag.packages || {})) {
            if (ver) result.installedPackages.push(`${pkg}@${ver}`);
            else result.missingPackages.push(pkg);
          }
        } catch {}
      } else {
        result.status = "disconnected";
      }
    } catch (err: any) {
      result.status = "error";
      result.error = err.message;
    }
  }

  return result;
}

export async function resumeGpuPod(): Promise<{ success: boolean; message: string }> {
  const apiKey = getRunPodApiKey();
  const podId = getRunPodPodId();

  if (!apiKey || !podId) {
    return { success: false, message: "RunPod API key or Pod ID not configured" };
  }

  try {
    const res = await fetch(`https://api.runpod.io/graphql?api_key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation { podResume(input: { podId: "${podId}", gpuCount: 1 }) { id desiredStatus gpuCount } }`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();

    if (data?.data?.podResume) {
      return {
        success: true,
        message: `Pod resumed with ${data.data.podResume.gpuCount} GPU(s). Status: ${data.data.podResume.desiredStatus}`,
      };
    }

    const errMsg = data?.errors?.[0]?.message || "Unknown error";
    return { success: false, message: errMsg };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function stopGpuPod(): Promise<{ success: boolean; message: string }> {
  const apiKey = getRunPodApiKey();
  const podId = getRunPodPodId();

  if (!apiKey || !podId) {
    return { success: false, message: "RunPod API key or Pod ID not configured" };
  }

  try {
    const res = await fetch(`https://api.runpod.io/graphql?api_key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation { podStop(input: { podId: "${podId}" }) { id desiredStatus } }`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();

    if (data?.data?.podStop) {
      return { success: true, message: `Pod stopped. Status: ${data.data.podStop.desiredStatus}` };
    }

    const errMsg = data?.errors?.[0]?.message || "Unknown error";
    return { success: false, message: errMsg };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

let gpuSetupDone = false;
let gpuSetupRunning = false;

export async function ensureGpuReady(): Promise<boolean> {
  if (gpuSetupDone) return true;
  if (gpuSetupRunning) {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      if (gpuSetupDone) return true;
    }
    return false;
  }
  
  try {
    gpuSetupRunning = true;
    console.log("[GPU] Checking if dependencies are installed...");
    const kernelId = await getOrCreateKernel();
    
    const checkCode = `
import torch
missing = []
for mod in ['diffusers', 'stable_audio_tools', 'demucs', 'librosa', 'scipy', 'soundfile']:
    try:
        __import__(mod)
    except ImportError:
        missing.append(mod)
cuda_ok = torch.cuda.is_available()
if not missing and cuda_ok:
    print("GPU_READY")
else:
    print(f"MISSING:{','.join(missing)}")
    print(f"CUDA:{'OK' if cuda_ok else 'NO'}")
`;
    const checkResult = await executeCode(kernelId, checkCode);
    
    if (checkResult.includes("GPU_READY")) {
      console.log("[GPU] All dependencies ready, CUDA available");
      gpuSetupDone = true;
      gpuSetupRunning = false;
      return true;
    }
    
    console.log("[GPU] Missing dependencies, running auto-setup...");
    const result = await setupGpuEnvironment();
    gpuSetupDone = result.success;
    gpuSetupRunning = false;
    
    if (result.success) {
      console.log("[GPU] Auto-setup completed successfully");
    } else {
      console.log(`[GPU] Auto-setup failed: ${result.output.substring(0, 200)}`);
    }
    return result.success;
  } catch (err: any) {
    gpuSetupRunning = false;
    console.log(`[GPU] Setup check failed: ${err.message}`);
    return false;
  }
}

export function resetGpuSetupState() {
  gpuSetupDone = false;
  gpuSetupRunning = false;
}

export async function setupGpuEnvironment(): Promise<{ success: boolean; output: string }> {
  try {
    const kernelId = await getOrCreateKernel();
    const setupScript = `
import subprocess, sys, os

results = []

# Fix CUDA environment
os.environ["LD_LIBRARY_PATH"] = "/usr/local/cuda-12.4/compat:" + os.environ.get("LD_LIBRARY_PATH", "")
if "NVIDIA_CPU_ONLY" in os.environ:
    del os.environ["NVIDIA_CPU_ONLY"]

# Create NVIDIA device nodes if missing
if not os.path.exists("/dev/nvidia0"):
    os.system("mknod -m 666 /dev/nvidia0 c 195 0 2>/dev/null")
    os.system("mknod -m 666 /dev/nvidiactl c 195 255 2>/dev/null")
    os.system("mknod -m 666 /dev/nvidia-uvm c 507 0 2>/dev/null")
    results.append("Created NVIDIA device nodes")

# Symlink CUDA compat libs
import glob
compat = "/usr/local/cuda-12.4/compat"
if os.path.exists(compat):
    for dst_dir in ["/usr/local/nvidia/lib64", "/usr/lib/x86_64-linux-gnu"]:
        os.makedirs(dst_dir, exist_ok=True)
        for src in glob.glob(compat + "/lib*"):
            dst = os.path.join(dst_dir, os.path.basename(src))
            if not os.path.exists(dst):
                try:
                    os.symlink(src, dst)
                except: pass
    results.append("Symlinked CUDA compat libraries")

# Test CUDA
import torch
cuda_ok = torch.cuda.is_available()
results.append(f"CUDA: {'AVAILABLE' if cuda_ok else 'NOT AVAILABLE'}")
if cuda_ok:
    results.append(f"GPU: {torch.cuda.get_device_name(0)}")
    results.append(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

# Install ffmpeg if missing
try:
    subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5, check=True)
    results.append("ffmpeg: already installed")
except:
    results.append("Installing ffmpeg...")
    r = subprocess.run(["apt-get", "update", "-qq"], capture_output=True, text=True, timeout=60)
    r = subprocess.run(["apt-get", "install", "-y", "-qq", "ffmpeg"], capture_output=True, text=True, timeout=120)
    results.append(f"ffmpeg install: {'OK' if r.returncode == 0 else r.stderr[:100]}")

# Install required Python packages
packages = {
    "diffusers": "diffusers",
    "stable_audio_tools": "stable-audio-tools",
    "demucs": "demucs",
    "librosa": "librosa",
    "scipy": "scipy",
}
for pkg_import, pkg_pip in packages.items():
    try:
        __import__(pkg_import)
        results.append(f"{pkg_pip}: already installed")
    except ImportError:
        results.append(f"Installing {pkg_pip}...")
        r = subprocess.run([sys.executable, "-m", "pip", "install", pkg_pip, "--quiet"], 
                          capture_output=True, text=True, timeout=300)
        results.append(f"{pkg_pip}: {'OK' if r.returncode == 0 else r.stderr[:100]}")

# Verify all packages
for pkg in ["torch", "torchaudio", "diffusers", "transformers", "accelerate", "stable_audio_tools", "demucs", "librosa", "soundfile", "scipy"]:
    try:
        mod = __import__(pkg)
        ver = getattr(mod, "__version__", "ok")
        results.append(f"  {pkg}: {ver}")
    except ImportError:
        results.append(f"  {pkg}: MISSING")

print("\\n".join(results))
`;

    const output = await executeCode(kernelId, setupScript, 300000);
    const isTimeout = output === "execution_timeout_submitted" || output === "timeout";
    if (isTimeout) {
      return { success: false, output: "Setup timed out. The installation may still be running on the GPU. Check status again in a few minutes." };
    }
    const hasCuda = output.includes("CUDA: AVAILABLE");
    const hasMissing = output.includes("MISSING");
    return {
      success: hasCuda && !hasMissing,
      output: output || "Setup completed",
    };
  } catch (err: any) {
    return { success: false, output: err.message };
  }
}
