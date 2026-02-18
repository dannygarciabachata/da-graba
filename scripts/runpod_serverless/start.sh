#!/bin/bash
# =============================================================
# DAGRABA Studio - RunPod Serverless Startup Script v4
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VOLUME_DIR="/runpod-volume"
DAGRABA_DIR="${VOLUME_DIR}/dagraba"
HANDLER="${DAGRABA_DIR}/handler.py"
DEPS_MARKER="${VOLUME_DIR}/.deps_installed_v5"

echo ""
echo "============================================================="
echo "  DAGRABA Studio - RunPod Serverless Worker v5"
echo "============================================================="
echo ""

echo "[Init] Script dir: ${SCRIPT_DIR}"
echo "[Init] Volume dir: ${VOLUME_DIR}"
echo "[Init] Handler: ${HANDLER}"
echo "[Init] Python: $(python3 --version 2>&1)"
echo "[Init] Date: $(date -u)"

if [ ! -f "${HANDLER}" ]; then
    echo "[FATAL] handler.py not found at ${HANDLER}"
    echo "[FATAL] Upload handler.py to ${DAGRABA_DIR}/ on your network volume"
    exit 1
fi

echo "[Init] Checking GPU..."
if nvidia-smi 2>/dev/null; then
    echo "[Init] GPU detected"
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
    GPU_MEM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader 2>/dev/null | head -1)
    echo "[Init] GPU: ${GPU_NAME} | VRAM: ${GPU_MEM}"
else
    echo "[Init] WARNING: No GPU detected (CPU mode)"
fi

for OLD_V in v3 v4; do
    OLD_MARKER="${VOLUME_DIR}/.deps_installed_${OLD_V}"
    if [ -f "${OLD_MARKER}" ]; then
        echo "[Init] Removing old marker: ${OLD_MARKER}"
        rm -f "${OLD_MARKER}"
    fi
done

if [ ! -f "${DEPS_MARKER}" ]; then
    echo ""
    echo "[Init] Installing Python dependencies (first run, cached after)..."
    echo "[Init] This may take 2-5 minutes..."

    echo "[Init] Step 1/2: Installing core dependencies..."
    pip install --no-cache-dir \
        runpod==1.7.7 \
        stable-audio-tools==0.0.17 \
        requests==2.32.3 \
        numpy==1.26.4 \
        soundfile==0.13.1 \
        librosa==0.10.2 \
        transformers==4.44.0 \
        accelerate==0.33.0 \
        safetensors==0.4.5 \
        huggingface_hub==0.25.0 \
        scipy==1.14.0 2>&1 | tail -10

    if [ $? -ne 0 ]; then
        echo "[WARN] Some core pip packages may have failed."
    fi

    echo "[Init] Step 2/2: Installing demucs (stem separation)..."
    pip install --no-cache-dir --no-deps demucs==4.0.1 2>&1 | tail -5
    pip install --no-cache-dir dora-search lameenc openunmix julius diffq 2>&1 | tail -5
    if [ $? -ne 0 ]; then
        echo "[WARN] Demucs install had issues. Stem separation may not work."
    fi

    echo "[Init] Verifying critical imports..."
    python3 -c "import runpod; import torch; import torchaudio; print('[Init] Core imports OK')" 2>&1
    if [ $? -ne 0 ]; then
        echo "[WARN] Core import check failed. Worker may not function correctly."
        echo "[WARN] Check that the base Docker image has PyTorch + CUDA."
    fi

    echo "[Init] Dependencies installed successfully"
    touch "${DEPS_MARKER}"
else
    echo "[Init] Dependencies already installed (cached v4)"
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
mkdir -p "${VOLUME_DIR}/instruments/soundfonts"

echo ""
echo "[Init] Environment:"
echo "  HF_HOME=${HF_HOME}"
echo "  TORCH_HOME=${TORCH_HOME}"
echo "  Models: ${VOLUME_DIR}/models"
echo "  Outputs: ${VOLUME_DIR}/outputs"
echo "  Instruments: ${VOLUME_DIR}/instruments"
echo ""

EXISTING_MODELS=$(find "${VOLUME_DIR}/models" -maxdepth 1 -name "kit_*" -type d 2>/dev/null | wc -l)
echo "[Init] Found ${EXISTING_MODELS} fine-tuned model(s)"

SAO_FT="${VOLUME_DIR}/models/sao_instrumental_finetune/SAO_Instrumental_Finetune.ckpt"
if [ -f "${SAO_FT}" ]; then
    SAO_SIZE=$(du -h "${SAO_FT}" 2>/dev/null | cut -f1)
    echo "[Init] SAO Instrumental Finetune: cached (${SAO_SIZE})"
else
    echo "[Init] SAO Instrumental Finetune: NOT cached (will download on first use)"
fi

SF_PATH="${VOLUME_DIR}/instruments/soundfonts/FluidR3_GM.sf2"
if [ -f "${SF_PATH}" ]; then
    SF_SIZE=$(du -h "${SF_PATH}" 2>/dev/null | cut -f1)
    echo "[Init] FluidR3_GM.sf2: present (${SF_SIZE})"
else
    echo "[Init] FluidR3_GM.sf2: not installed (run GPU Setup from admin panel)"
fi

echo ""
echo "[Init] Starting DAGRABA handler..."
echo "============================================================="
echo ""

exec python3 -u "${HANDLER}"
