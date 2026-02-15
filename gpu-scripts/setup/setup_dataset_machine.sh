#!/bin/bash
# =============================================================
# DGB Studio - RunPod Dataset Machine Setup
# =============================================================
# Sets up a RunPod pod for dataset preparation.
# Can run on CPU or small GPU pod (no GPU needed for dataset prep).
#
# Recommended RunPod template:
#   - Template: runpod/pytorch:2.1.0-py3.10-cuda12.1.0-ubuntu22.04
#   - GPU: Any (CPU also works for dataset prep)
#   - Disk: 50GB+ (depends on audio library size)
#   - Volume: /workspace (persistent storage)
#
# Usage:
#   bash setup_dataset_machine.sh
# =============================================================

set -e

echo ""
echo "============================================================="
echo "  DGB Studio - Dataset Machine Setup"
echo "============================================================="
echo ""

# System dependencies
echo ">>> Installing system dependencies..."
apt-get update -y
apt-get install -y ffmpeg git curl wget unzip sox libsox-fmt-all

# Python dependencies
echo ""
echo ">>> Installing Python dependencies..."
pip install --upgrade pip

pip install \
    numpy>=1.24.0 \
    soundfile>=0.12.0 \
    pyloudnorm>=0.1.1 \
    librosa>=0.10.0 \
    scipy>=1.10.0 \
    litellm>=1.40.0 \
    openai>=1.0.0 \
    python-dotenv>=1.0.0

# Try installing essentia (may need special handling)
echo ""
echo ">>> Installing essentia for key detection..."
pip install essentia 2>/dev/null || {
    echo "[WARN] essentia failed to install. Will use librosa fallback for key detection."
    echo "       This is fine - librosa key detection works well enough."
}

# Try installing deeprhythm for BPM detection
echo ""
echo ">>> Installing deeprhythm for BPM detection..."
pip install deeprhythm 2>/dev/null || {
    echo "[WARN] deeprhythm failed to install. Will use librosa fallback for BPM."
    echo "       This is fine - librosa BPM detection is reliable."
}

# Create workspace structure
echo ""
echo ">>> Creating workspace directories..."
mkdir -p /workspace/dgb-dataset/{raw_audio,01_processed,02_segments,03_metadata,04_dataset}
mkdir -p /workspace/scripts

# Copy pipeline scripts
echo ""
echo ">>> Setting up pipeline scripts..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPELINE_DIR="$SCRIPT_DIR/../dataset-pipeline"

if [ -d "$PIPELINE_DIR" ]; then
    cp -r "$PIPELINE_DIR"/*.py /workspace/scripts/
    cp -r "$PIPELINE_DIR"/*.sh /workspace/scripts/ 2>/dev/null || true
    chmod +x /workspace/scripts/*.sh 2>/dev/null || true
    echo "  Pipeline scripts copied to /workspace/scripts/"
else
    echo "[WARN] Pipeline scripts not found at $PIPELINE_DIR"
    echo "       Upload them manually to /workspace/scripts/"
fi

# Create environment file template
cat > /workspace/.env.template << 'EOF'
# DGB Studio - Dataset Pipeline Environment Variables
# Copy this to .env and fill in your keys

# OpenAI API Key (for prompt generation)
OPENAI_API_KEY=your_openai_key_here

# Optional: HuggingFace Token (for model downloads)
HF_TOKEN=your_hf_token_here

# Optional: Weights & Biases (for training monitoring)
WANDB_API_KEY=your_wandb_key_here
EOF

echo ""
echo "============================================================="
echo "  Setup Complete!"
echo "============================================================="
echo ""
echo "  Workspace structure:"
echo "    /workspace/"
echo "    ├── dgb-dataset/"
echo "    │   ├── raw_audio/      <- PUT YOUR AUDIO FILES HERE"
echo "    │   ├── 01_processed/   <- Step 1 output"
echo "    │   ├── 02_segments/    <- Step 2 output"
echo "    │   ├── 03_metadata/    <- Step 3 output"
echo "    │   └── 04_dataset/     <- Final dataset (WAV + JSON)"
echo "    ├── scripts/            <- Pipeline scripts"
echo "    └── .env.template       <- Copy to .env and add keys"
echo ""
echo "  Next steps:"
echo "    1. Upload your Bachata/Boleros audio to /workspace/dgb-dataset/raw_audio/"
echo "    2. Copy .env.template to .env and add your API keys"
echo "    3. Run: cd /workspace/scripts && bash run_pipeline.sh /workspace/dgb-dataset/raw_audio bachata"
echo ""
echo "============================================================="
