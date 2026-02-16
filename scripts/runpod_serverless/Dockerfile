FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

# DGB Studio - RunPod Serverless Worker
# For HeartMuLa engine: attach a Network Volume with the model at /workspace/HeartMuse
# For SAO fine-tuned models: attach a Network Volume at /workspace for persistent storage

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/workspace/.cache/huggingface

RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-dev \
    ffmpeg libsndfile1 git wget curl \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3 /usr/bin/python

RUN pip3 install --no-cache-dir \
    runpod \
    torch torchaudio --index-url https://download.pytorch.org/whl/cu121

RUN pip3 install --no-cache-dir \
    stable-audio-tools \
    demucs \
    requests \
    numpy \
    soundfile \
    librosa \
    transformers \
    accelerate \
    safetensors

RUN mkdir -p /workspace/models /workspace/outputs /workspace/datasets /workspace/tmp

COPY handler.py /handler.py

CMD ["python3", "/handler.py"]
