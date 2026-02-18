# DAGRABA Studio - RunPod Serverless Deployment Guide

## Step 1: Build & Push Docker Image

```bash
cd scripts/runpod_serverless

docker build -t dagraba-serverless:latest .

docker tag dagraba-serverless:latest YOUR_DOCKERHUB/dagraba-serverless:latest

docker push YOUR_DOCKERHUB/dagraba-serverless:latest
```

## Step 2: Create RunPod Serverless Endpoint

1. Go to https://www.runpod.io/console/serverless
2. Click "New Endpoint"
3. Configure:
   - **Name**: `dagraba-music`
   - **Docker Image**: `YOUR_DOCKERHUB/dagraba-serverless:latest`
   - **GPU**: RTX A6000 (48GB VRAM) or L40 recommended. A5000 (24GB) works for shorter durations.
   - **Min Workers**: 0 (scale to zero when idle)
   - **Max Workers**: 3
   - **Idle Timeout**: 300 seconds
   - **Execution Timeout**: 3600 seconds (1 hour for training)
   - **Network Volume**: Attach at `/workspace` for persistent model storage
   - **Environment Variables**:
     - `HF_TOKEN`: Your Hugging Face token (required for SAO model download)
4. Click "Create"
5. Copy the **Endpoint ID**

## Step 3: Configure DAGRABA Studio

Set the following environment variables in your Replit project:

```
RUNPOD_API_KEY=rpa_YOUR_API_KEY
RUNPOD_ENDPOINT_MUSIC=your_music_endpoint_id
RUNPOD_ENDPOINT_TRAINING=your_training_endpoint_id
RUNPOD_ENDPOINT_STEMS=your_stems_endpoint_id
```

You can use a single endpoint for all three actions, or separate endpoints.

## Architecture

The handler routes jobs by `action` field:
- `generate_music` - HeartMuLa or Stable Audio Open generation
- `train_model` - SAO fine-tuning with instrument samples
- `separate_stems` - Demucs stem separation
- `health_check` - Returns GPU/server status

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
  "webhook_url": "https://your-app.replit.app/api/webhooks/runpod-serverless"
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
  "webhook_url": "https://your-app.replit.app/api/webhooks/training"
}
```

### separate_stems
```json
{
  "action": "separate_stems",
  "song_id": 456,
  "audio_url": "https://...",
  "model": "htdemucs",
  "webhook_url": "https://your-app.replit.app/api/webhooks/runpod-serverless"
}
```

## Troubleshooting Worker Crashes

### "worker exited with exit code 2"

This means the Python process crashed during startup or execution. Common causes:

1. **Missing HF_TOKEN**: The SAO model requires HuggingFace authentication.
   - Fix: Set `HF_TOKEN` environment variable in your RunPod endpoint settings.

2. **Dependency version conflicts**: Package versions may be incompatible.
   - Fix: The Dockerfile pins exact versions. Rebuild the Docker image.

3. **GPU memory (OOM)**: Workers with less VRAM may fail on long durations.
   - Fix: Use GPUs with 24GB+ VRAM. The handler auto-retries with shorter duration on OOM.

4. **Network Volume not attached**: Fine-tuned models require persistent storage.
   - Fix: Attach a Network Volume at `/workspace` in your endpoint settings.

### "model not found"

The fine-tuned style kit model file doesn't exist on the worker's storage.

- This is normal if you haven't trained a kit yet. The handler falls back to the base SAO model.
- If you trained a kit, make sure the Network Volume is attached and the model was saved to `/workspace/models/kit_{id}/model_final.pt`.

### Rollout stuck / workers unhealthy

1. **Cancel the rollout** from RunPod dashboard to revert to the last working version.
2. **Check Docker image**: Verify the image builds locally with `docker build -t test .`
3. **Check logs**: In RunPod dashboard, click on a worker to see its logs.
4. **Rebuild and re-push**: If the image is broken, rebuild with `docker build --no-cache -t dagraba-serverless:latest .`

### Workers throttled

RunPod throttles workers when they use too much compute. This is normal behavior.
- Workers will resume automatically after the throttle period.
- Consider increasing `Idle Timeout` to reduce cold starts.

## Network Volume Setup

For persistent model storage across worker restarts:

1. Create a Network Volume in RunPod (100GB recommended)
2. Attach it to your endpoint at mount path `/workspace`
3. Fine-tuned models will be saved to `/workspace/models/`
4. HuggingFace cache will be at `/workspace/.cache/huggingface/`
