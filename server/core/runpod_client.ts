import type { TrainingConfig } from "./sao_training_engine";

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

async function getOrCreateKernel(): Promise<string> {
  const base = getBaseUrl();
  const headers = getHeaders();

  const listRes = await fetch(`${base}/api/kernels`, { headers });
  if (listRes.ok) {
    const kernels = await listRes.json();
    if (Array.isArray(kernels) && kernels.length > 0) {
      return kernels[0].id;
    }
  }

  const createRes = await fetch(`${base}/api/kernels`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "python3" }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Failed to create Jupyter kernel: ${createRes.status} ${errorText}`);
  }

  const kernel = await createRes.json();
  return kernel.id;
}

async function executeCode(kernelId: string, code: string): Promise<string> {
  const base = getBaseUrl();
  const token = RUNPOD_TOKEN();

  const wsProtocol = base.startsWith("https") ? "wss" : "ws";
  const wsBase = base.replace(/^https?/, wsProtocol);
  const tokenParam = token ? `?token=${token}` : "";

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      try { ws.close(); } catch {}
      resolve("execution_timeout_submitted");
    }, 60000);

    const WebSocket = require("ws");
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

  return `
import json
import subprocess
import os
import requests

kit_id = ${kitId}
webhook_url = "${webhookUrl}"

training_config = json.loads('''${configJson}''')

config_path = f"/workspace/training_configs/kit_{kit_id}.json"
os.makedirs(os.path.dirname(config_path), exist_ok=True)
with open(config_path, "w") as f:
    json.dump(training_config, f, indent=2)

print(f"[SAO Pipeline] Training config saved to {config_path}")
print(f"[SAO Pipeline] Kit: {training_config['kit']['name']}")
print(f"[SAO Pipeline] Genre: {training_config['kit']['genre']}")
print(f"[SAO Pipeline] Instruments: {len(training_config['dataset']['instruments'])}")
print(f"[SAO Pipeline] Model type: {training_config['model_type']}")
print(f"[SAO Pipeline] Sample rate: {training_config['sample_rate']}")

instrument_dir = f"/workspace/training_data/kit_{kit_id}"
os.makedirs(instrument_dir, exist_ok=True)

import numpy as np
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
        print(f"[SAO Pipeline] Downloaded: {instr['name']} -> {src_path}")
        
        if src_ext != "wav":
            converted = False
            try:
                import soundfile as sf
                import librosa
                y, sr = librosa.load(src_path, sr=44100, mono=False)
                if y.ndim == 1:
                    y = np.expand_dims(y, 0)
                    y = np.concatenate([y, y], axis=0)
                sf.write(wav_path, y.T, 44100)
                os.remove(src_path)
                final_path = wav_path
                converted = True
                print(f"[SAO Pipeline] Converted to WAV: {wav_path}")
            except ImportError:
                pass
            
            if not converted:
                try:
                    result = subprocess.run(
                        ["ffmpeg", "-i", src_path, "-ar", "44100", "-ac", "2", wav_path, "-y"],
                        capture_output=True, text=True, timeout=60
                    )
                    if result.returncode == 0:
                        os.remove(src_path)
                        final_path = wav_path
                        print(f"[SAO Pipeline] FFmpeg converted to WAV: {wav_path}")
                    else:
                        final_path = src_path
                        print(f"[SAO Pipeline] FFmpeg failed, using original: {src_path}")
                except Exception as e:
                    final_path = src_path
                    print(f"[SAO Pipeline] Conversion failed, using original: {e}")
        else:
            final_path = src_path
            
    except Exception as e:
        print(f"[SAO Pipeline] Failed to download {instr['name']}: {e}")
        final_path = None
    
    if final_path and os.path.exists(final_path):
        downloaded_files[instr["id"]] = os.path.basename(final_path)

metadata_path = os.path.join(instrument_dir, "metadata.json")
metadata = []
for instr in training_config["dataset"]["instruments"]:
    file_entry = downloaded_files.get(instr["id"])
    if not file_entry:
        print(f"[SAO Pipeline] Skipping {instr['name']} from metadata (file not available)")
        continue
    metadata.append({
        "file": file_entry,
        "prompt": instr["prompt"],
        "metadata": instr.get("metadata", {})
    })
with open(metadata_path, "w") as f:
    json.dump(metadata, f, indent=2)

print(f"[SAO Pipeline] Metadata saved to {metadata_path}")
print(f"[SAO Pipeline] Kit {kit_id} ready for training")
print(f"[SAO Pipeline] Webhook: {webhook_url}")

try:
    requests.post(webhook_url, json={
        "kitId": kit_id,
        "status": "training",
        "jobId": f"sao_kit_{kit_id}",
        "message": "Training data prepared, starting fine-tuning"
    }, timeout=10)
except:
    pass

print("[SAO Pipeline] Setup complete - training data and config prepared")
print(json.dumps({"status": "prepared", "kit_id": kit_id, "config_path": config_path, "data_dir": instrument_dir}))
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
