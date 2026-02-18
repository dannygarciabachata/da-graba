FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

# DAGRABA Studio - RunPod Serverless Worker
# Uses SAO Instrumental Finetune (santifiorino/SAO-Instrumental-Finetune) as default model
# For HeartMuLa engine: attach a Network Volume with the model at /workspace/HeartMuse
# For custom Style Kit models: attach a Network Volume at /workspace for persistent storage

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/workspace/.cache/huggingface
ENV TORCH_HOME=/workspace/.cache/torch

RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-dev \
    ffmpeg libsndfile1 git wget curl \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3 /usr/bin/python

RUN pip3 install --no-cache-dir \
    torch==2.1.2 torchaudio==2.1.2 --index-url https://download.pytorch.org/whl/cu121

RUN pip3 install --no-cache-dir \
    runpod==1.7.0 \
    stable-audio-tools==0.0.17 \
    demucs==4.0.1 \
    requests==2.31.0 \
    numpy==1.26.4 \
    soundfile==0.12.1 \
    librosa==0.10.1 \
    transformers==4.36.2 \
    accelerate==0.25.0 \
    safetensors==0.4.1 \
    huggingface_hub==0.20.3

RUN mkdir -p /workspace/models/sao_instrumental_finetune /workspace/outputs /workspace/datasets /workspace/tmp

ARG HF_TOKEN=""
RUN if [ -n "$HF_TOKEN" ]; then \
    python3 -c " \
from huggingface_hub import hf_hub_download; \
hf_hub_download( \
    repo_id='santifiorino/SAO-Instrumental-Finetune', \
    filename='SAO_Instrumental_Finetune.ckpt', \
    local_dir='/workspace/models/sao_instrumental_finetune', \
    token='${HF_TOKEN}' \
); \
print('SAO Instrumental Finetune checkpoint pre-downloaded') \
"; \
    else echo "No HF_TOKEN provided at build time. Model will download on first use."; fi

COPY handler.py /handler.py

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python3 -c "import runpod; import torch; print('OK')" || exit 1

CMD ["python3", "-u", "/handler.py"]
