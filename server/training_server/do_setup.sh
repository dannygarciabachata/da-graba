#!/bin/bash
set -e
cd /opt/dgb-training

echo "[1/4] Upgrading pip..."
/opt/dgb-training/venv/bin/python3 -m pip install --upgrade pip >> /tmp/pip_setup.log 2>&1

echo "[2/4] Installing base libraries..."
/opt/dgb-training/venv/bin/python3 -m pip install fastapi "uvicorn[standard]" requests aiohttp pydantic soundfile librosa aiofiles >> /tmp/pip_setup.log 2>&1

echo "[3/4] Installing AI/ML libraries (this takes a while)..."
/opt/dgb-training/venv/bin/python3 -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124 >> /tmp/pip_setup.log 2>&1
/opt/dgb-training/venv/bin/python3 -m pip install diffusers transformers accelerate safetensors >> /tmp/pip_setup.log 2>&1

echo "[4/4] Setting up service..."
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

echo "=== SETUP COMPLETE ==="
echo "Server running on port 8000"
