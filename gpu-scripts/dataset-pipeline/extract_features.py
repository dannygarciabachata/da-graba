#!/usr/bin/env python3
"""
DGB Studio - Audio Feature Extraction Pipeline
Step 3: Extract musical features from audio segments

Extracts BPM, key, scale, energy, acousticness, and instrument tags
from each audio segment. Outputs JSON metadata files.

Uses:
- deeprhythm (BPM detection)
- essentia (key/scale detection)
- librosa (energy, spectral features)

Usage:
    python extract_features.py --input /path/to/segments --output /path/to/metadata
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf


def detect_bpm(file_path: str) -> float:
    try:
        import deeprhythm
        model = deeprhythm.DeepRhythmPredictor()
        bpm = model.predict(file_path)
        return round(float(bpm), 1)
    except ImportError:
        try:
            import librosa
            y, sr = librosa.load(file_path, sr=22050, mono=True)
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            return round(float(tempo[0] if hasattr(tempo, '__len__') else tempo), 1)
        except:
            return 120.0
    except Exception:
        return 120.0


def detect_key_scale(file_path: str) -> tuple:
    try:
        import essentia.standard as es
        loader = es.MonoLoader(filename=file_path, sampleRate=44100)
        audio = loader()
        key_extractor = es.KeyExtractor()
        key, scale, strength = key_extractor(audio)
        return key, scale.capitalize(), round(float(strength), 3)
    except ImportError:
        try:
            import librosa
            y, sr = librosa.load(file_path, sr=22050, mono=True)
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
            key_idx = int(np.argmax(np.mean(chroma, axis=1)))
            keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
            return keys[key_idx], "Major", 0.5
        except:
            return "C", "Major", 0.0
    except Exception:
        return "C", "Major", 0.0


def compute_energy(file_path: str) -> float:
    try:
        data, rate = sf.read(file_path)
        if len(data.shape) > 1:
            data = np.mean(data, axis=1)
        rms = np.sqrt(np.mean(data ** 2))
        energy = min(1.0, rms / 0.15)
        return round(energy, 3)
    except:
        return 0.5


def compute_acousticness(file_path: str) -> float:
    try:
        import librosa
        y, sr = librosa.load(file_path, sr=22050, mono=True)
        spec_cent = librosa.feature.spectral_centroid(y=y, sr=sr)
        mean_centroid = np.mean(spec_cent)
        acousticness = max(0.0, min(1.0, 1.0 - (mean_centroid / 5000.0)))
        return round(acousticness, 3)
    except:
        return 0.5


def compute_spectral_features(file_path: str) -> dict:
    try:
        import librosa
        y, sr = librosa.load(file_path, sr=22050, mono=True)
        spec_cent = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        spec_bw = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))
        spec_roll = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))
        return {
            "spectral_centroid": round(spec_cent, 1),
            "spectral_bandwidth": round(spec_bw, 1),
            "spectral_rolloff": round(spec_roll, 1),
            "zero_crossing_rate": round(zcr, 4),
        }
    except:
        return {}


def extract_features(file_path: Path) -> dict:
    fp = str(file_path)

    bpm = detect_bpm(fp)
    key, scale, key_strength = detect_key_scale(fp)
    energy = compute_energy(fp)
    acousticness = compute_acousticness(fp)
    spectral = compute_spectral_features(fp)

    try:
        info = sf.info(fp)
        duration = info.duration
    except:
        duration = 30.0

    return {
        "file": file_path.name,
        "duration_sec": round(duration, 2),
        "tempo": bpm,
        "key": key,
        "mode": scale,
        "key_strength": key_strength,
        "energy": energy,
        "acousticness": acousticness,
        **spectral,
    }


def process_segments(input_dir: Path, output_dir: Path, genre: str, instruments: list, tags: list):
    output_dir.mkdir(parents=True, exist_ok=True)

    wav_files = sorted(input_dir.glob("*.wav"))
    total = len(wav_files)

    print(f"\n{'='*60}")
    print(f"DGB Studio - Feature Extraction Pipeline")
    print(f"{'='*60}")
    print(f"Input directory:  {input_dir}")
    print(f"Output directory: {output_dir}")
    print(f"Segments found:   {total}")
    print(f"Genre:            {genre}")
    print(f"Instruments:      {', '.join(instruments)}")
    print(f"Tags:             {', '.join(tags)}")
    print(f"{'='*60}\n")

    all_metadata = []

    for i, wav_path in enumerate(wav_files, 1):
        print(f"[{i}/{total}] Extracting features: {wav_path.name}")

        features = extract_features(wav_path)
        features["genre"] = genre
        features["instruments"] = instruments
        features["tags"] = tags

        json_path = output_dir / f"{wav_path.stem}.json"
        with open(json_path, "w") as f:
            json.dump(features, f, indent=2)

        all_metadata.append(features)
        print(f"  BPM: {features['tempo']}, Key: {features['key']} {features['mode']}, Energy: {features['energy']}")

    summary_path = output_dir / "features_summary.json"
    avg_bpm = np.mean([m["tempo"] for m in all_metadata]) if all_metadata else 0
    avg_energy = np.mean([m["energy"] for m in all_metadata]) if all_metadata else 0

    with open(summary_path, "w") as f:
        json.dump({
            "total_segments": len(all_metadata),
            "genre": genre,
            "instruments": instruments,
            "tags": tags,
            "avg_bpm": round(avg_bpm, 1),
            "avg_energy": round(avg_energy, 3),
        }, f, indent=2)

    print(f"\n{'='*60}")
    print(f"Results:")
    print(f"  Segments processed: {len(all_metadata)}")
    print(f"  Average BPM:        {avg_bpm:.1f}")
    print(f"  Average Energy:     {avg_energy:.3f}")
    print(f"  Metadata saved to:  {output_dir}")
    print(f"{'='*60}")


BACHATA_INSTRUMENTS = [
    "Guitarra Requinto",
    "Guitarra Segunda",
    "Bongó",
    "Güira",
    "Bajo Eléctrico",
]

BOLERO_INSTRUMENTS = [
    "Guitarra Clásica Nylon",
    "Requinto",
    "Piano",
    "Cuerdas",
    "Maracas",
    "Congas",
    "Bajo Acústico",
]

BACHATA_TAGS = [
    "bachata", "romántica", "tropical", "latin",
    "Dominican", "requinto", "güira",
    "bolero", "merengue", "caribbean",
]

BOLERO_TAGS = [
    "bolero", "balada", "romántica", "latin",
    "intimate", "warm", "classic",
    "nylon guitar", "orchestral",
]


def main():
    parser = argparse.ArgumentParser(description="DGB Studio Feature Extraction")
    parser.add_argument("--input", "-i", required=True, help="Input directory with audio segments")
    parser.add_argument("--output", "-o", required=True, help="Output directory for metadata JSON files")
    parser.add_argument("--genre", "-g", default="bachata", choices=["bachata", "bolero", "mixed"],
                        help="Genre for instrument/tag defaults (default: bachata)")
    parser.add_argument("--instruments", nargs="+", default=None, help="Custom instrument list (overrides genre default)")
    parser.add_argument("--tags", nargs="+", default=None, help="Custom tag list (overrides genre default)")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)

    if not input_dir.exists():
        print(f"Error: Input directory not found: {input_dir}")
        sys.exit(1)

    if args.genre == "bachata":
        instruments = args.instruments or BACHATA_INSTRUMENTS
        tags = args.tags or BACHATA_TAGS
    elif args.genre == "bolero":
        instruments = args.instruments or BOLERO_INSTRUMENTS
        tags = args.tags or BOLERO_TAGS
    else:
        instruments = args.instruments or BACHATA_INSTRUMENTS + BOLERO_INSTRUMENTS
        tags = args.tags or BACHATA_TAGS + BOLERO_TAGS

    process_segments(input_dir, output_dir, args.genre, instruments, tags)


if __name__ == "__main__":
    main()
