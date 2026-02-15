#!/bin/bash
# =============================================================
# DGB Studio - RunPod A100 Training Machine Setup
# =============================================================
# Sets up a RunPod A100 pod for SAO fine-tuning.
#
# Recommended RunPod template:
#   - Template: runpod/pytorch:2.1.0-py3.10-cuda12.1.0-ubuntu22.04
#   - GPU: NVIDIA A100 (40GB or 80GB)
#   - Disk: 100GB+
#   - Volume: /workspace (persistent, shared with dataset machine)
#
# Usage:
#   bash setup_training_machine.sh
# =============================================================

set -e

echo ""
echo "============================================================="
echo "  DGB Studio - A100 Training Machine Setup"
echo "============================================================="
echo ""

# Check GPU
echo ">>> Checking GPU..."
nvidia-smi || {
    echo "[ERROR] No GPU detected. This script requires an NVIDIA GPU (A100 recommended)."
    exit 1
}

GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
GPU_MEM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader | head -1)
echo "  GPU: $GPU_NAME ($GPU_MEM)"

# System dependencies
echo ""
echo ">>> Installing system dependencies..."
apt-get update -y
apt-get install -y ffmpeg git curl wget

# Clone and install stable-audio-tools
echo ""
echo ">>> Setting up stable-audio-tools..."
mkdir -p /workspace/training
cd /workspace/training

if [ ! -d "stable-audio-tools" ]; then
    git clone https://github.com/Stability-AI/stable-audio-tools.git
    cd stable-audio-tools
    pip install .
    cd ..
    echo "  stable-audio-tools installed"
else
    echo "  stable-audio-tools already installed"
fi

# Install additional dependencies
echo ""
echo ">>> Installing additional Python packages..."
pip install wandb huggingface_hub

# Download pretrained model
echo ""
echo ">>> Downloading Stable Audio Open 1.0 model..."
if [ ! -f "/workspace/training/model.ckpt" ]; then
    python3 -c "
import os
from huggingface_hub import hf_hub_download
token = os.environ.get('HF_TOKEN', '')
print('Downloading SAO model from HuggingFace...')
hf_hub_download(
    repo_id='stabilityai/stable-audio-open-1.0',
    filename='model.ckpt',
    local_dir='/workspace/training',
    token=token if token else None
)
print('Model downloaded!')
"
else
    echo "  Model already downloaded"
fi

# Copy training configs
echo ""
echo ">>> Setting up training configs..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRAINING_DIR="$SCRIPT_DIR/../training-pipeline"

if [ -d "$TRAINING_DIR" ]; then
    cp "$TRAINING_DIR/model_config.json" /workspace/training/
    cp "$TRAINING_DIR/dataset_config.json" /workspace/training/
    cp "$TRAINING_DIR/metadata_loader.py" /workspace/training/
    cp "$TRAINING_DIR/train.sh" /workspace/training/
    chmod +x /workspace/training/train.sh
    echo "  Training configs copied"
else
    echo "[WARN] Training pipeline dir not found at $TRAINING_DIR"
fi

# Create checkpoints directory
mkdir -p /workspace/training/checkpoints

# Verify dataset
echo ""
echo ">>> Checking for dataset..."
DATASET_DIR="/workspace/dgb-dataset/04_dataset"
if [ -d "$DATASET_DIR" ]; then
    WAV_COUNT=$(find "$DATASET_DIR" -name "*.wav" | wc -l)
    JSON_COUNT=$(find "$DATASET_DIR" -name "*.json" | wc -l)
    echo "  Dataset found!"
    echo "  WAV files:  $WAV_COUNT"
    echo "  JSON files: $JSON_COUNT"
else
    echo "  [WARN] Dataset not found at $DATASET_DIR"
    echo "         Run the dataset pipeline first, or transfer the dataset here."
fi

echo ""
echo "============================================================="
echo "  Setup Complete!"
echo "============================================================="
echo ""
echo "  Training workspace:"
echo "    /workspace/training/"
echo "    ├── stable-audio-tools/   <- Training framework"
echo "    ├── model.ckpt            <- Pretrained SAO model"
echo "    ├── model_config.json     <- Model architecture config"
echo "    ├── dataset_config.json   <- Dataset paths config"
echo "    ├── metadata_loader.py    <- Prompt metadata reader"
echo "    ├── train.sh              <- Training launch script"
echo "    └── checkpoints/          <- Saved checkpoints"
echo ""
echo "  To start training:"
echo "    cd /workspace/training"
echo "    bash train.sh 8    # batch_size=8 for A100-40GB"
echo "    bash train.sh 16   # batch_size=16 for A100-80GB"
echo ""
echo "  Training tips from Fiorino's thesis:"
echo "    - 4h audio + 1h training = good initial test"
echo "    - 9h audio + 5h training = production quality"
echo "    - Monitor demo outputs every 500 steps"
echo "    - Use W&B for loss tracking (set WANDB_API_KEY)"
echo ""
echo "============================================================="
