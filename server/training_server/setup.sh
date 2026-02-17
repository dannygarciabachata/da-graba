#!/bin/bash
set -e

echo "=== DGB Studio Training Server Setup ==="

apt-get update -y
apt-get install -y python3-pip python3-venv wget curl

nvidia-smi 2>/dev/null || {
  echo "Installing NVIDIA drivers..."
  apt-get install -y linux-headers-$(uname -r)
  wget -q https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb
  dpkg -i cuda-keyring_1.1-1_all.deb
  apt-get update -y
  apt-get install -y cuda-toolkit-12-4 nvidia-driver-550
}

mkdir -p /opt/dgb-training
cd /opt/dgb-training

python3 -m venv venv 2>/dev/null || python3 -m pip install virtualenv && python3 -m virtualenv venv
source venv/bin/activate

pip install --upgrade pip
pip install fastapi uvicorn[standard] torch torchaudio diffusers transformers accelerate safetensors soundfile librosa requests aiohttp aiofiles pydantic

cp /tmp/dgb_training_main.py /opt/dgb-training/main.py

cat > /etc/systemd/system/dgb-training.service << 'SERVICEEOF'
[Unit]
Description=DGB Studio Training Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/dgb-training
ExecStart=/opt/dgb-training/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
Restart=always
RestartSec=10
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable dgb-training
systemctl start dgb-training

echo "=== DGB Training Server Setup Complete ==="
echo "Server running on port 8000"
