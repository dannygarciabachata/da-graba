#!/usr/bin/env python3
"""
DGB Audio Cloud Engine - GPU Processing Server
================================================
This Flask server runs on your private GPU instance and receives
instrument kit uploads from the DGB Audio platform.

SETUP:
  1. pip install flask requests librosa soundfile numpy basic-pitch
  2. export DGB_API_KEY="your_shared_key_here"
  3. export TRAINING_WEBHOOK_SECRET="your_webhook_secret_here"
  4. python3 /workspace/dgb_api_receptor.py

The server listens on port 7860 and handles:
  - Audio file uploads from Producer Store
  - Audio-to-MIDI conversion using basic-pitch
  - Audio analysis (key, BPM, energy detection)
  - Webhook callbacks with results
"""

import os
import sys
import json
import time
import uuid
import base64
import hashlib
import threading
import traceback
from pathlib import Path

try:
    from flask import Flask, request, jsonify, send_file
except ImportError:
    print("Installing Flask...")
    os.system("pip install flask")
    from flask import Flask, request, jsonify, send_file

try:
    import requests as http_requests
except ImportError:
    print("Installing requests...")
    os.system("pip install requests")
    import requests as http_requests

app = Flask(__name__)

DGB_API_KEY = os.environ.get("DGB_API_KEY", "")
TRAINING_WEBHOOK_SECRET = os.environ.get("TRAINING_WEBHOOK_SECRET", "")
UPLOAD_DIR = Path("/workspace/dgb_audio/uploads")
MIDI_DIR = Path("/workspace/dgb_audio/midi")
ANALYSIS_DIR = Path("/workspace/dgb_audio/analysis")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MIDI_DIR.mkdir(parents=True, exist_ok=True)
ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)


def verify_api_key(req):
    auth = req.headers.get("Authorization", "")
    key = req.headers.get("X-DGB-API-Key", "")
    if key == DGB_API_KEY and DGB_API_KEY:
        return True
    if auth == f"Bearer {DGB_API_KEY}" and DGB_API_KEY:
        return True
    return False


def get_webhook_secret():
    return TRAINING_WEBHOOK_SECRET or DGB_API_KEY


def convert_audio_to_midi(audio_path, output_midi_path):
    try:
        from basic_pitch.inference import predict
        from basic_pitch import ICASSP_2022_MODEL_PATH

        print(f"  [MIDI] Converting {audio_path} -> {output_midi_path}")
        model_output, midi_data, note_events = predict(str(audio_path))

        midi_data.write(str(output_midi_path))
        print(f"  [MIDI] Conversion complete: {output_midi_path}")
        return True, None
    except ImportError:
        print("  [MIDI] basic-pitch not installed, attempting install...")
        os.system("pip install basic-pitch")
        try:
            from basic_pitch.inference import predict
            from basic_pitch import ICASSP_2022_MODEL_PATH

            model_output, midi_data, note_events = predict(str(audio_path))
            midi_data.write(str(output_midi_path))
            print(f"  [MIDI] Conversion complete after install: {output_midi_path}")
            return True, None
        except Exception as e:
            return False, f"basic-pitch failed: {str(e)}"
    except Exception as e:
        return False, str(e)


def analyze_audio(audio_path):
    result = {}
    try:
        import librosa
        import numpy as np

        y, sr = librosa.load(str(audio_path), sr=None)

        duration_ms = int(len(y) / sr * 1000)
        result["durationMs"] = duration_ms

        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        if hasattr(tempo, "__len__"):
            tempo = float(tempo[0]) if len(tempo) > 0 else 120.0
        result["bpm"] = round(float(tempo))

        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        key_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        key_idx = int(chroma.mean(axis=1).argmax())
        chroma_mean = chroma.mean(axis=1)
        major_sum = sum(float(chroma_mean[(key_idx + i) % 12]) for i in [0, 4, 7])
        minor_sum = sum(float(chroma_mean[(key_idx + i) % 12]) for i in [0, 3, 7])
        mode = "Major" if major_sum >= minor_sum else "Minor"
        result["key"] = f"{key_names[key_idx]} {mode}"

        rms = librosa.feature.rms(y=y)[0]
        rms_max = float(rms.max())
        energy = float(rms.mean()) / (rms_max + 1e-6) if rms_max > 0 else 0.5
        result["energy"] = round(min(max(energy, 0), 1), 2)

        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        avg_centroid = float(spectral_centroid.mean())
        acousticness = max(0.0, min(1.0, 1.0 - (avg_centroid / 8000.0)))
        result["acousticness"] = round(acousticness, 2)

        tags = []
        if avg_centroid < 2000:
            tags.extend(["warm", "bass-heavy"])
        elif avg_centroid < 4000:
            tags.extend(["balanced", "midrange"])
        else:
            tags.extend(["bright", "treble"])
        if result["energy"] > 0.7:
            tags.append("energetic")
        elif result["energy"] < 0.3:
            tags.extend(["soft", "ambient"])
        if acousticness > 0.7:
            tags.append("acoustic")
        result["tags"] = tags

    except ImportError:
        print("  [Analysis] librosa not available")
        result["tags"] = ["audio-file"]
        result["error"] = "librosa not installed"
    except Exception as e:
        print(f"  [Analysis] Error: {e}")
        result["tags"] = ["analysis-partial"]
        result["error"] = str(e)

    return result


def process_instrument_async(instrument_id, audio_path, webhook_url, kit_id):
    try:
        print(f"\n🎸 DGB AUDIO: Procesando instrumento {instrument_id}...")

        analysis = analyze_audio(audio_path)
        analysis["instrumentId"] = instrument_id
        print(f"  [Analysis] Key={analysis.get('key')}, BPM={analysis.get('bpm')}, Energy={analysis.get('energy')}")

        safe_name = f"instrument_{instrument_id}_{int(time.time())}"
        midi_path = MIDI_DIR / f"{safe_name}.mid"
        midi_success, midi_error = convert_audio_to_midi(audio_path, midi_path)

        midi_b64 = None
        if midi_success and midi_path.exists():
            with open(midi_path, "rb") as f:
                midi_b64 = base64.b64encode(f.read()).decode("utf-8")
            print(f"  [MIDI] Size: {midi_path.stat().st_size} bytes")

        result = {
            "instrumentId": instrument_id,
            "kitId": kit_id,
            "status": "completed",
            "analysis": analysis,
            "midiConverted": midi_success,
            "midiBase64": midi_b64,
            "midiError": midi_error,
        }

        if webhook_url:
            try:
                webhook_secret = get_webhook_secret()
                resp = http_requests.post(
                    webhook_url,
                    json=result,
                    timeout=30,
                    headers={
                        "Content-Type": "application/json",
                        "X-Webhook-Secret": webhook_secret,
                        "X-DGB-API-Key": DGB_API_KEY,
                    },
                )
                print(f"  [Webhook] Sent to {webhook_url}: {resp.status_code}")
            except Exception as e:
                print(f"  [Webhook] Failed: {e}")

        print(f"  ✅ Instrumento {instrument_id} procesado exitosamente")

    except Exception as e:
        print(f"  ❌ Error procesando instrumento {instrument_id}: {e}")
        traceback.print_exc()
        if webhook_url:
            try:
                webhook_secret = get_webhook_secret()
                http_requests.post(
                    webhook_url,
                    json={
                        "instrumentId": instrument_id,
                        "kitId": kit_id,
                        "status": "failed",
                        "error": str(e),
                    },
                    timeout=10,
                    headers={
                        "X-Webhook-Secret": webhook_secret,
                        "X-DGB-API-Key": DGB_API_KEY,
                    },
                )
            except:
                pass


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "DGB Cloud Engine",
        "gpu_available": os.path.exists("/dev/nvidia0"),
        "upload_dir": str(UPLOAD_DIR),
        "api_key_configured": bool(DGB_API_KEY),
        "webhook_secret_configured": bool(TRAINING_WEBHOOK_SECRET),
    })


@app.route("/api/upload-instrument", methods=["POST"])
def upload_instrument():
    if not verify_api_key(request):
        return jsonify({"error": "Invalid API key"}), 401

    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]
    instrument_id = request.form.get("instrumentId")
    kit_id = request.form.get("kitId")
    instrument_name = request.form.get("instrumentName", "Unknown")
    webhook_url = request.form.get("webhookUrl", "")

    if not instrument_id:
        return jsonify({"error": "instrumentId required"}), 400

    ext = Path(audio_file.filename or "audio.wav").suffix or ".wav"
    safe_name = f"instr_{instrument_id}_{int(time.time())}{ext}"
    audio_path = UPLOAD_DIR / safe_name
    audio_file.save(str(audio_path))

    file_size = audio_path.stat().st_size
    print(f"\n🎸 DGB AUDIO: Recibido kit instrumento '{instrument_name}' (ID: {instrument_id}, Kit: {kit_id})")
    print(f"  Archivo: {safe_name} ({file_size / 1024:.1f} KB)")

    thread = threading.Thread(
        target=process_instrument_async,
        args=(int(instrument_id), audio_path, webhook_url, int(kit_id or 0)),
    )
    thread.start()

    return jsonify({
        "status": "processing",
        "instrumentId": int(instrument_id),
        "fileName": safe_name,
        "fileSize": file_size,
        "message": f"Instrumento '{instrument_name}' recibido. Procesando análisis y conversión MIDI...",
    })


@app.route("/api/analyze-audio", methods=["POST"])
def analyze_audio_endpoint():
    if not verify_api_key(request):
        return jsonify({"error": "Invalid API key"}), 401

    if "audio" not in request.files:
        audio_url = request.form.get("audioUrl") or request.json.get("audioUrl", "") if request.is_json else ""
        if not audio_url:
            return jsonify({"error": "No audio file or URL provided"}), 400

        tmp_path = ANALYSIS_DIR / f"analyze_{int(time.time())}.wav"
        try:
            r = http_requests.get(audio_url, timeout=120)
            r.raise_for_status()
            with open(tmp_path, "wb") as f:
                f.write(r.content)
        except Exception as e:
            return jsonify({"error": f"Failed to download audio: {e}"}), 400
        audio_path = tmp_path
    else:
        audio_file = request.files["audio"]
        ext = Path(audio_file.filename or "audio.wav").suffix or ".wav"
        audio_path = ANALYSIS_DIR / f"analyze_{int(time.time())}{ext}"
        audio_file.save(str(audio_path))

    result = analyze_audio(audio_path)

    try:
        os.remove(audio_path)
    except:
        pass

    return jsonify(result)


@app.route("/api/convert-midi", methods=["POST"])
def convert_midi_endpoint():
    if not verify_api_key(request):
        return jsonify({"error": "Invalid API key"}), 401

    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]
    ext = Path(audio_file.filename or "audio.wav").suffix or ".wav"
    safe_name = f"midi_convert_{int(time.time())}"
    audio_path = UPLOAD_DIR / f"{safe_name}{ext}"
    midi_path = MIDI_DIR / f"{safe_name}.mid"

    audio_file.save(str(audio_path))

    success, error = convert_audio_to_midi(audio_path, midi_path)

    if success and midi_path.exists():
        with open(midi_path, "rb") as f:
            midi_b64 = base64.b64encode(f.read()).decode("utf-8")
        return jsonify({
            "status": "completed",
            "midiBase64": midi_b64,
            "midiSize": midi_path.stat().st_size,
        })
    else:
        return jsonify({"status": "failed", "error": error or "Conversion failed"}), 500


@app.route("/api/status", methods=["GET"])
def status():
    uploads = len(list(UPLOAD_DIR.glob("*")))
    midis = len(list(MIDI_DIR.glob("*.mid")))
    return jsonify({
        "service": "DGB Cloud Engine",
        "uploads_processed": uploads,
        "midi_files_generated": midis,
        "gpu_available": os.path.exists("/dev/nvidia0"),
    })


if __name__ == "__main__":
    if not DGB_API_KEY:
        print("⚠️  WARNING: DGB_API_KEY no configurada. Configúrala con:")
        print("   export DGB_API_KEY='tu_clave_aqui'")
        print("")

    if not TRAINING_WEBHOOK_SECRET:
        print("⚠️  WARNING: TRAINING_WEBHOOK_SECRET no configurado. Configúralo con:")
        print("   export TRAINING_WEBHOOK_SECRET='tu_secreto_aqui'")
        print("   (Se usará DGB_API_KEY como fallback para webhooks)")
        print("")

    print("=" * 60)
    print("🎵 DGB AUDIO - Cloud Engine")
    print("=" * 60)
    print(f"  Puerto: 7860")
    print(f"  API Key: {'✅ Configurada' if DGB_API_KEY else '❌ NO CONFIGURADA'}")
    print(f"  Webhook Secret: {'✅ Configurado' if TRAINING_WEBHOOK_SECRET else '⚠️ Usando DGB_API_KEY'}")
    print(f"  GPU: {'✅ Disponible' if os.path.exists('/dev/nvidia0') else '⚠️ No detectada'}")
    print(f"  Uploads: {UPLOAD_DIR}")
    print(f"  MIDI: {MIDI_DIR}")
    print("=" * 60)
    print("")
    print("Endpoints disponibles:")
    print("  GET  /api/health           - Health check")
    print("  GET  /api/status           - Estado del servidor")
    print("  POST /api/upload-instrument - Subir instrumento (audio + análisis + MIDI)")
    print("  POST /api/analyze-audio    - Analizar audio (key, BPM, energy)")
    print("  POST /api/convert-midi     - Convertir audio a MIDI")
    print("")
    print("Esperando conexiones...")
    print("")

    app.run(host="0.0.0.0", port=7860, debug=False)
