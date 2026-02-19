#!/usr/bin/env bash
# =============================================================
# DAGRABA Studio - RunPod Serverless Startup Script v7
# =============================================================
# Docker Args: bash /runpod-volume/dagraba/start.sh
# =============================================================

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH}"

VOLUME_DIR="/runpod-volume"
DAGRABA_DIR="${VOLUME_DIR}/dagraba"
HANDLER="${DAGRABA_DIR}/handler.py"
DEPS_MARKER="${VOLUME_DIR}/.deps_installed_v7"

echo ""
echo "============================================================="
echo "  DAGRABA Studio - RunPod Serverless Worker v7"
echo "============================================================="
echo ""

PYTHON_BIN=$(which python3 2>/dev/null || which python 2>/dev/null || echo "/usr/bin/python3")
echo "[Init] Python binary: ${PYTHON_BIN}"
echo "[Init] Python version: $(${PYTHON_BIN} --version 2>&1)"
echo "[Init] Date: $(date -u)"

if [ ! -f "${HANDLER}" ]; then
    echo "[FATAL] handler.py not found at ${HANDLER}"
    ls -la "${DAGRABA_DIR}/" 2>&1 || echo "  Directory does not exist"
    exit 1
fi

echo "[Init] handler.py found ($(wc -c < "${HANDLER}") bytes)"

echo "[Init] Checking GPU..."
if nvidia-smi 2>/dev/null; then
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
    GPU_MEM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader 2>/dev/null | head -1)
    echo "[Init] GPU: ${GPU_NAME} | VRAM: ${GPU_MEM}"
else
    echo "[Init] WARNING: No GPU detected"
fi

for OLD_V in v3 v4 v5 v6; do
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

    echo "[Init] Step 1/4: Installing runpod and core libs..."
    ${PYTHON_BIN} -m pip install --no-cache-dir \
        runpod==1.7.7 \
        requests==2.32.3 \
        soundfile==0.13.1 \
        safetensors==0.4.5 \
        huggingface_hub==0.25.0 2>&1 | tail -10

    echo "[Init] Step 2/4: Installing ML dependencies..."
    ${PYTHON_BIN} -m pip install --no-cache-dir \
        numpy \
        scipy \
        librosa==0.10.2 \
        transformers==4.44.0 \
        accelerate==0.33.0 2>&1 | tail -10

    echo "[Init] Step 3/4: Installing stable-audio-tools and einops..."
    ${PYTHON_BIN} -m pip install --no-cache-dir \
        einops \
        alias-free-torch \
        "stable-audio-tools @ git+https://github.com/Stability-AI/stable-audio-tools.git" 2>&1 | tail -15

    INSTALL_OK=true
    echo "[Init] Verifying stable_audio_tools import..."
    ${PYTHON_BIN} -c "import stable_audio_tools; print('[Init] stable_audio_tools OK')" 2>&1
    if [ $? -ne 0 ]; then
        echo "[WARN] stable_audio_tools import failed! Trying alternative install..."
        ${PYTHON_BIN} -m pip install --no-cache-dir stable-audio-tools 2>&1 | tail -10
        ${PYTHON_BIN} -c "import stable_audio_tools; print('[Init] stable_audio_tools OK (retry)')" 2>&1
        if [ $? -ne 0 ]; then
            echo "[ERROR] stable_audio_tools still not importable!"
            INSTALL_OK=false
        fi
    fi

    echo "[Init] Step 4/4: Installing demucs (stem separation)..."
    ${PYTHON_BIN} -m pip install --no-cache-dir --no-deps demucs==4.0.1 2>&1 | tail -5
    ${PYTHON_BIN} -m pip install --no-cache-dir dora-search lameenc openunmix julius diffq 2>&1 | tail -5

    echo "[Init] Verifying all critical imports..."
    ${PYTHON_BIN} -c "
import runpod
import torch
import torchaudio
import stable_audio_tools
print('[Init] Core imports OK')
print(f'[Init] PyTorch {torch.__version__} loaded | CUDA: {torch.cuda.is_available()}')
" 2>&1
    if [ $? -ne 0 ]; then
        echo "[WARN] Core import check failed."
        INSTALL_OK=false
    fi

    if [ "${INSTALL_OK}" = true ]; then
        echo "[Init] Dependencies installed successfully"
        touch "${DEPS_MARKER}"
    else
        echo "[WARN] Some dependencies failed. Will retry on next startup."
    fi
else
    echo "[Init] Dependencies already installed (cached v7)"
    echo "[Init] Quick import check..."
    ${PYTHON_BIN} -c "import stable_audio_tools; import runpod; import torch; print('[Init] All imports OK')" 2>&1
    if [ $? -ne 0 ]; then
        echo "[WARN] Import check failed, reinstalling..."
        rm -f "${DEPS_MARKER}"
        exec bash "$0"
    fi
fi

if [ -n "${HF_TOKEN}" ]; then
    export HUGGING_FACE_HUB_TOKEN="${HF_TOKEN}"
    echo "[Init] HF_TOKEN configured"
else
    echo "[Init] WARNING: HF_TOKEN not set"
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
echo ""

SAO_FT="${VOLUME_DIR}/models/sao_instrumental_finetune/SAO_Instrumental_Finetune.ckpt"
if [ -f "${SAO_FT}" ]; then
    echo "[Init] SAO Instrumental Finetune: cached ($(du -h "${SAO_FT}" 2>/dev/null | cut -f1))"
else
    echo "[Init] SAO Instrumental Finetune: NOT cached (will download on first use)"
fi

echo ""
echo "[Init] Starting DAGRABA handler..."
echo "============================================================="
echo ""

exec ${PYTHON_BIN} -u "${HANDLER}"
