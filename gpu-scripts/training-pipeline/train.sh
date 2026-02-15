#!/bin/bash
# =============================================================
# DGB Studio - SAO Training Script for RunPod A100
# =============================================================
# Fine-tunes Stable Audio Open 1.0 with DGB Studio's
# Bachata/Boleros dataset.
#
# Requirements:
#   - NVIDIA A100 GPU (40GB+ VRAM)
#   - Dataset prepared at /workspace/dgb-dataset/04_dataset/
#   - HuggingFace token for model download
#
# Usage:
#   ./train.sh [batch_size] [num_steps]
#
# Default: batch_size=8, runs until stopped
# =============================================================

set -e

BATCH_SIZE="${1:-8}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="/workspace/training"

echo ""
echo "============================================================="
echo "  DGB Studio - SAO Fine-Tuning Pipeline"
echo "============================================================="
echo "  GPU:         $(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null || echo 'Unknown')"
echo "  VRAM:        $(nvidia-smi --query-gpu=memory.total --format=csv,noheader 2>/dev/null || echo 'Unknown')"
echo "  Batch size:  $BATCH_SIZE"
echo "  Workspace:   $WORKSPACE"
echo "============================================================="
echo ""

# Step 1: Install dependencies
echo ">>> Step 1: Installing dependencies..."
apt-get update -y && apt-get install -y ffmpeg git

if [ ! -d "$WORKSPACE/stable-audio-tools" ]; then
    echo ">>> Cloning stable-audio-tools..."
    mkdir -p "$WORKSPACE"
    cd "$WORKSPACE"
    git clone https://github.com/Stability-AI/stable-audio-tools.git
    cd stable-audio-tools
    pip install .
    cd "$WORKSPACE"
else
    echo ">>> stable-audio-tools already installed"
    cd "$WORKSPACE"
fi

# Step 2: Download pretrained model
echo ""
echo ">>> Step 2: Downloading pretrained SAO model..."
if [ ! -f "$WORKSPACE/model.ckpt" ]; then
    python3 -c "
from huggingface_hub import hf_hub_download
import os
token = os.environ.get('HF_TOKEN', '')
hf_hub_download(
    repo_id='stabilityai/stable-audio-open-1.0',
    filename='model.ckpt',
    local_dir='$WORKSPACE',
    token=token if token else None
)
print('Model downloaded successfully!')
"
else
    echo ">>> Model already downloaded"
fi

# Step 3: Verify dataset
echo ""
echo ">>> Step 3: Verifying dataset..."
DATASET_DIR="/workspace/dgb-dataset/04_dataset"
if [ ! -d "$DATASET_DIR" ]; then
    echo "[ERROR] Dataset not found at $DATASET_DIR"
    echo "        Run the dataset pipeline first!"
    exit 1
fi

WAV_COUNT=$(find "$DATASET_DIR" -name "*.wav" | wc -l)
JSON_COUNT=$(find "$DATASET_DIR" -name "*.json" | wc -l)
echo "  WAV files:  $WAV_COUNT"
echo "  JSON files: $JSON_COUNT"

if [ "$WAV_COUNT" -lt 10 ]; then
    echo "[WARN] Very small dataset ($WAV_COUNT files). Consider adding more audio."
    echo "       Fiorino used ~1000 segments (9 hours) for good results."
fi

# Step 4: Copy config files
echo ""
echo ">>> Step 4: Setting up configs..."
cp "$SCRIPT_DIR/model_config.json" "$WORKSPACE/model_config.json"
cp "$SCRIPT_DIR/dataset_config.json" "$WORKSPACE/dataset_config.json"
cp "$SCRIPT_DIR/metadata_loader.py" "$WORKSPACE/metadata_loader.py"

# Step 5: Create checkpoints directory
mkdir -p "$WORKSPACE/checkpoints"

# Step 6: Run training
echo ""
echo "============================================================="
echo "  Starting Training"
echo "============================================================="
echo "  Model config:   $WORKSPACE/model_config.json"
echo "  Dataset config:  $WORKSPACE/dataset_config.json"
echo "  Batch size:      $BATCH_SIZE"
echo "  Save directory:  $WORKSPACE/checkpoints"
echo "============================================================="
echo ""

cd "$WORKSPACE/stable-audio-tools"

TRAIN_CMD="python3 train.py \
    --dataset-config $WORKSPACE/dataset_config.json \
    --model-config $WORKSPACE/model_config.json \
    --name dgb_bachata_boleros_finetune \
    --save-dir $WORKSPACE/checkpoints \
    --batch-size $BATCH_SIZE \
    --seed 42 \
    --pretrained-ckpt-path $WORKSPACE/model.ckpt"

# Add wandb if available
if [ -n "$WANDB_API_KEY" ]; then
    echo ">>> W&B logging enabled"
    wandb login "$WANDB_API_KEY" 2>/dev/null || true
fi

echo ""
echo "Running: $TRAIN_CMD"
echo ""

eval $TRAIN_CMD

echo ""
echo "============================================================="
echo "  Training Complete!"
echo "  Checkpoints saved at: $WORKSPACE/checkpoints"
echo "============================================================="
