# DGB Studio - RunPod Serverless Deployment Guide

## Step 1: Build & Push Docker Image

```bash
# From the scripts/runpod_serverless directory
cd scripts/runpod_serverless

# Build the Docker image
docker build -t dgb-studio-serverless:latest .

# Tag for Docker Hub (replace with your Docker Hub username)
docker tag dgb-studio-serverless:latest YOUR_DOCKERHUB/dgb-studio-serverless:latest

# Push to Docker Hub
docker push YOUR_DOCKERHUB/dgb-studio-serverless:latest
```

## Step 2: Create RunPod Serverless Endpoint

1. Go to https://www.runpod.io/console/serverless
2. Click "New Endpoint"
3. Configure:
   - **Name**: `dgb-studio-music` (or `dgb-studio-training`, `dgb-studio-stems`)
   - **Docker Image**: `YOUR_DOCKERHUB/dgb-studio-serverless:latest`
   - **GPU**: Select GPU type (A100 80GB recommended for training, A40/L40 for generation)
   - **Min Workers**: 0 (scale to zero when idle)
   - **Max Workers**: 3 (adjust based on budget)
   - **Idle Timeout**: 300 seconds
   - **Execution Timeout**: 3600 seconds (1 hour for training)
   - **Environment Variables**:
     - `HF_TOKEN`: Your Hugging Face token
4. Click "Create"
5. Copy the **Endpoint ID** (e.g., `abc123def456`)

## Step 3: Configure DGB Studio

Set the following environment variables in your Replit project:

```
RUNPOD_API_KEY=rpa_YOUR_API_KEY
RUNPOD_ENDPOINT_MUSIC=your_music_endpoint_id
RUNPOD_ENDPOINT_TRAINING=your_training_endpoint_id
RUNPOD_ENDPOINT_STEMS=your_stems_endpoint_id
```

You can use a single endpoint for all three actions, or separate endpoints
with different GPU configurations for each workload.

## Architecture

The handler routes jobs by `action` field:
- `generate_music` → HeartMuLa or Stable Audio Open generation
- `train_model` → SAO fine-tuning with instrument samples
- `separate_stems` → Demucs stem separation
- `health_check` → Returns GPU/server status

## Supported Inputs

### generate_music
```json
{
  "action": "generate_music",
  "engine": "sao",
  "song_id": 123,
  "prompt": "A beautiful bachata guitar melody",
  "duration_seconds": 30,
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
