FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /workspace

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    runpod \
    stable-audio-tools \
    torchaudio \
    einops \
    huggingface_hub

COPY handler.py /workspace/handler.py

ENV HF_HOME=/workspace/hf_cache
ENV PYTHONUNBUFFERED=1

CMD ["python", "-u", "/workspace/handler.py"]
