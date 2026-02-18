# DAGRABA Studio - RunPod Serverless Deployment Guide

## Deployment Option: Network Volume (Base PyTorch Image)

Use the base `runpod/pytorch` image with your network volume `dagraba-studio`.
No Docker Hub needed. Dependencies install once and are cached on the volume.

### Step 1: Upload Files to Network Volume

You need to upload **2 files** to your network volume `dagraba-studio`:

```
/runpod-volume/
└── dagraba/
    ├── start.sh        <- Startup script (installs deps + launches handler)
    └── handler.py      <- DAGRABA serverless handler
```

**How to upload:**
1. Go to RunPod > Storage > `dagraba-studio` volume
2. Click "Start Pod" to mount the volume temporarily
3. Open a terminal in the pod
4. Create the directory and upload files:

```bash
mkdir -p /runpod-volume/dagraba
```

Then copy the contents of these two files from this project:
- `scripts/runpod_serverless/start.sh` -> `/runpod-volume/dagraba/start.sh`
- `scripts/runpod_serverless/handler.py` -> `/runpod-volume/dagraba/handler.py`

Make the startup script executable:
```bash
chmod +x /runpod-volume/dagraba/start.sh
```

5. Stop the temporary pod when done.

### Step 2: Configure RunPod Serverless Endpoint

Your endpoint `9buu4vzqalgj18` should have these settings:

| Setting | Value |
|---------|-------|
| **Docker Image** | `runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04` |
| **Docker Command** | `bash /runpod-volume/dagraba/start.sh` |
| **GPU** | 24 GB or 48 GB |
| **Min Workers** | 0 |
| **Max Workers** | 3 |
| **Idle Timeout** | 300 seconds |
| **Execution Timeout** | 3600 seconds |
| **Network Volume** | `dagraba-studio` |

**Environment Variables** (set in RunPod endpoint settings):
| Variable | Value | Required |
|----------|-------|----------|
| `HF_TOKEN` | Your HuggingFace token | Yes (for SAO model download) |

**IMPORTANT:** Set the **Docker Command** to:
```
bash /runpod-volume/dagraba/start.sh
```

This tells the worker to run the startup script instead of the default command.

### Step 3: Verify DAGRABA Studio Config

These are already configured in your Replit project:
```
RUNPOD_API_KEY=rpa_CFWZ...  (set)
RUNPOD_ENDPOINT_MUSIC=https://api.runpod.ai/v2/9buu4vzqalgj18  (set)
```

Optionally, set these for training and stem separation (can use same endpoint):
```
RUNPOD_ENDPOINT_TRAINING=https://api.runpod.ai/v2/9buu4vzqalgj18
RUNPOD_ENDPOINT_STEMS=https://api.runpod.ai/v2/9buu4vzqalgj18
```

### Step 4: Test the Endpoint

After the rollout completes, test with a health check:

```bash
curl -X POST https://api.runpod.ai/v2/9buu4vzqalgj18/runsync \
  -H "Authorization: Bearer rpa_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"action": "health_check"}}'
```

## Architecture

The handler routes jobs by `action` field:
- `generate_music` - Stable Audio Open generation (default: SAO Instrumental Finetune)
- `train_model` - SAO fine-tuning with instrument samples
- `separate_stems` - Demucs stem separation
- `health_check` - Returns GPU/server status

### Network Volume Directory Structure

After the worker runs, the network volume will contain:
```
/runpod-volume/
├── dagraba/
│   ├── start.sh                           <- Startup script
│   └── handler.py                         <- Handler code
├── models/
│   ├── sao_instrumental_finetune/         <- SAO finetune checkpoint (auto-downloaded)
│   │   └── SAO_Instrumental_Finetune.ckpt
│   └── kit_{id}/                          <- Fine-tuned style kits
│       ├── model_final.pt
│       └── best_model.pt
├── outputs/
│   ├── music/                             <- Generated audio files
│   └── stems/                             <- Separated stem files
├── datasets/                              <- Training datasets
├── tmp/                                   <- Temporary files
├── .cache/
│   ├── huggingface/                       <- HF model cache
│   └── torch/                             <- PyTorch cache
└── .deps_installed_v3                     <- Dependencies cache marker
```

### SAO Model Variants
- `instrumental_finetune` (default) - SAO Instrumental Finetune from `santifiorino/SAO-Instrumental-Finetune`. Better instrument control, tempo accuracy (~88%), genre adherence.
- `base` - Original `stabilityai/stable-audio-open-1.0`. Useful as fallback.
- Custom kit weights (`style_kit_id`) take priority when provided.

## Supported Inputs

### generate_music
```json
{
  "action": "generate_music",
  "engine": "sao",
  "song_id": 123,
  "prompt": "A beautiful bachata guitar melody",
  "duration_seconds": 30,
  "style_kit_id": 11,
  "genre": "Bachata",
  "webhook_url": "https://dagraba.studio/api/webhooks/runpod-serverless"
}
```

### train_model
```json
{
  "action": "train_model",
  "kit_id": 11,
  "kit_name": "DGB Bolero",
  "genre": "bolero",
  "instruments": [{"id": 1, "name": "Guitar", "audioUrl": "...", "prompt": "..."}],
  "training_config": {"learning_rate": 5e-5, "batch_size": 1, "epochs": 100},
  "webhook_url": "https://dagraba.studio/api/webhooks/training"
}
```

### separate_stems
```json
{
  "action": "separate_stems",
  "song_id": 456,
  "audio_url": "https://...",
  "model": "htdemucs",
  "webhook_url": "https://dagraba.studio/api/webhooks/runpod-serverless"
}
```

## Troubleshooting

### "worker exited with exit code 2"
1. **Missing HF_TOKEN**: Set `HF_TOKEN` env var in RunPod endpoint settings.
2. **Dependencies failed**: Delete `/runpod-volume/.deps_installed_v3` to force reinstall.
3. **GPU OOM**: Use 48GB GPU or handler auto-retries with shorter duration.

### Rollout stuck / 0% workers running
1. Check that the **Docker Command** is set to `bash /runpod-volume/dagraba/start.sh`
2. Verify the files exist on the network volume at `/runpod-volume/dagraba/`
3. Check worker logs in RunPod dashboard > Workers tab
4. If dependencies broke, delete the cache marker:
   - Mount volume via temporary pod
   - `rm /runpod-volume/.deps_installed_v3`
   - Restart endpoint

### Force dependency reinstall
Delete the cache marker file to make the next worker install fresh:
```bash
rm /runpod-volume/.deps_installed_v3
```

## Alternative: Docker Image Deployment

If you later want faster cold starts, you can build a custom Docker image:

```bash
cd scripts/runpod_serverless
docker build --build-arg HF_TOKEN=hf_YOUR_TOKEN -t dagraba-serverless:latest .
docker tag dagraba-serverless:latest YOUR_DOCKERHUB/dagraba-serverless:latest
docker push YOUR_DOCKERHUB/dagraba-serverless:latest
```

Then update the endpoint's Docker Image to your custom image.
