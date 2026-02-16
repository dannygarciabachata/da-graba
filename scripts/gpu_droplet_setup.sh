#!/bin/bash
set -e

echo "============================================"
echo "  DGB Studio - GPU Droplet Setup"
echo "  DigitalOcean GPU Training Server"
echo "============================================"
echo ""

export DEBIAN_FRONTEND=noninteractive

echo "[1/6] Updating system packages..."
apt-get update -qq
apt-get install -y -qq python3-pip python3-venv ffmpeg libsndfile1 git wget curl > /dev/null 2>&1

echo "[2/6] Creating workspace..."
mkdir -p /workspace/dgb-training
mkdir -p /workspace/dgb-training/uploads
mkdir -p /workspace/dgb-training/models
mkdir -p /workspace/dgb-training/outputs
mkdir -p /workspace/dgb-training/datasets

echo "[3/6] Setting up Python virtual environment..."
python3 -m venv /workspace/dgb-training/venv
source /workspace/dgb-training/venv/bin/activate

echo "[4/6] Installing PyTorch with CUDA support..."
pip install --quiet --upgrade pip
pip install --quiet torch torchaudio --index-url https://download.pytorch.org/whl/cu124

echo "[5/6] Installing training dependencies..."
pip install --quiet \
  fastapi==0.115.* \
  uvicorn[standard]==0.34.* \
  python-multipart==0.0.* \
  httpx==0.28.* \
  librosa==0.10.* \
  soundfile==0.13.* \
  scipy==1.15.* \
  numpy==1.26.* \
  pydub==0.25.* \
  stable-audio-tools \
  diffusers \
  transformers \
  accelerate \
  safetensors \
  datasets

echo "[6/6] Setting up training server..."
if [ -f /workspace/dgb_training_server.py ]; then
  cp /workspace/dgb_training_server.py /workspace/dgb-training/server.py
  echo "  Copied training server from /workspace/dgb_training_server.py"
elif [ -f /root/dgb_training_server.py ]; then
  cp /root/dgb_training_server.py /workspace/dgb-training/server.py
  echo "  Copied training server from /root/dgb_training_server.py"
else
  echo "  WARNING: dgb_training_server.py not found."
  echo "  Copy it manually to /workspace/dgb-training/server.py"
  echo "  Use: scp -P 41588 scripts/dgb_training_server.py root@38.147.83.27:/workspace/dgb-training/server.py"
fi

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "GPU check:"
python3 -c "import torch; print(f'  CUDA available: {torch.cuda.is_available()}'); print(f'  GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"None\"}'); print(f'  VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB' if torch.cuda.is_available() else '')"
echo ""
echo "To start the training server:"
echo "  source /workspace/dgb-training/venv/bin/activate"
echo "  cd /workspace/dgb-training"
echo "  DGB_API_KEY=your_key python3 server.py"
echo ""
echo "Or run in background:"
echo "  nohup bash -c 'source /workspace/dgb-training/venv/bin/activate && DGB_API_KEY=your_key python3 /workspace/dgb-training/server.py' > /workspace/dgb-training/server.log 2>&1 &"
echo ""
