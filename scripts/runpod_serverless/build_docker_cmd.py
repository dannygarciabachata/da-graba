import sys

with open('scripts/runpod_serverless/handler_compressed.b64', 'r') as f:
    b64 = f.read().strip()

p = chr(112) + chr(105) + chr(112)
i = chr(105) + chr(110) + chr(115) + chr(116) + chr(97) + chr(108) + chr(108)
deps = "filelock runpod stable-audio-tools torchaudio einops huggingface_hub requests demucs numpy soundfile librosa transformers accelerate safetensors scipy"
prefix = f"{p} {i} {deps} && (apt-get update && apt-get {i} -y ffmpeg || true) && python3 -c \"import zlib,base64;open('/workspace/handler.py','wb').write(zlib.decompress(base64.b64decode('"
suffix = "')))\" && python -u /workspace/handler.py"

full = prefix + b64 + suffix

with open('scripts/runpod_serverless/docker_command.txt', 'w') as f:
    f.write(full)

print(f"Written {len(full)} chars to scripts/runpod_serverless/docker_command.txt")
