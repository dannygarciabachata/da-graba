#!/bin/bash
# =============================================================
# DAGRABA Studio - RunPod Serverless Startup Script
# =============================================================
# This script runs when the serverless worker starts.
# It installs dependencies and launches the handler from the
# network volume.
#
# Setup:
#   1. Upload this file + handler.py to your RunPod network volume
#      at: /runpod-volume/dagraba/
#   2. In RunPod endpoint settings, set Docker Command to:
#      bash /runpod-volume/dagraba/start.sh
# =============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VOLUME_DIR="/runpod-volume"
DAGRABA_DIR="${VOLUME_DIR}/dagraba"
HANDLER="${DAGRABA_DIR}/handler.py"
DEPS_MARKER="${VOLUME_DIR}/.deps_installed_v3"

echo ""
echo "============================================================="
echo "  DAGRABA Studio - RunPod Serverless Worker"
echo "============================================================="
echo ""

echo "[Init] Script dir: ${SCRIPT_DIR}"
echo "[Init] Volume dir: ${VOLUME_DIR}"
echo "[Init] Handler: ${HANDLER}"

if [ ! -f "${HANDLER}" ]; then
    echo "[FATAL] handler.py not found at ${HANDLER}"
    echo "[FATAL] Upload handler.py to ${DAGRABA_DIR}/ on your network volume"
    exit 1
fi

echo "[Init] Checking GPU..."
nvidia-smi 2>/dev/null && echo "[Init] GPU detected" || echo "[Init] No GPU (CPU mode)"

if [ ! -f "${DEPS_MARKER}" ]; then
    echo ""
    echo "[Init] Installing Python dependencies (first run, cached after)..."

    pip install --no-cache-dir \
        runpod==1.7.7 \
        stable-audio-tools==0.0.17 \
        demucs==4.0.1 \
        requests==2.32.3 \
        numpy==1.26.4 \
        soundfile==0.13.1 \
        librosa==0.10.2 \
        transformers==4.44.0 \
        accelerate==0.33.0 \
        safetensors==0.4.5 \
        huggingface_hub==0.25.0 \
        scipy==1.14.0 2>&1 | tail -5

    echo "[Init] Dependencies installed successfully"
    touch "${DEPS_MARKER}"
else
    echo "[Init] Dependencies already installed (cached)"
fi

if [ -n "${HF_TOKEN}" ]; then
    export HUGGING_FACE_HUB_TOKEN="${HF_TOKEN}"
    echo "[Init] HF_TOKEN configured"
else
    echo "[Init] WARNING: HF_TOKEN not set. Model downloads may fail."
fi

export HF_HOME="${VOLUME_DIR}/.cache/huggingface"
export TORCH_HOME="${VOLUME_DIR}/.cache/torch"
export TMPDIR="${VOLUME_DIR}/tmp"
mkdir -p "${HF_HOME}" "${TORCH_HOME}" "${TMPDIR}"
mkdir -p "${VOLUME_DIR}/models" "${VOLUME_DIR}/outputs" "${VOLUME_DIR}/datasets"

echo ""
echo "[Init] Environment:"
echo "  HF_HOME=${HF_HOME}"
echo "  TORCH_HOME=${TORCH_HOME}"
echo "  Models: ${VOLUME_DIR}/models"
echo "  Outputs: ${VOLUME_DIR}/outputs"
echo ""

EXISTING_MODELS=$(find "${VOLUME_DIR}/models" -maxdepth 1 -name "kit_*" -type d 2>/dev/null | wc -l)
echo "[Init] Found ${EXISTING_MODELS} fine-tuned model(s)"

SAO_FT="${VOLUME_DIR}/models/sao_instrumental_finetune/SAO_Instrumental_Finetune.ckpt"
if [ -f "${SAO_FT}" ]; then
    echo "[Init] SAO Instrumental Finetune checkpoint found"
else
    echo "[Init] SAO Instrumental Finetune NOT cached (will download on first use)"
fi

echo ""
echo "[Init] Starting DAGRABA handler..."
echo "============================================================="
echo ""

exec python3 -u "${HANDLER}"
