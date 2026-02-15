#!/usr/bin/env python3
"""
DGB Studio - Audio Dataset Preparation Pipeline
Step 1: Audio Ingestion & Preprocessing

Takes raw audio files (MP3, WAV, FLAC, OGG, M4A) and converts them to
standardized 44.1kHz stereo WAV files with loudness normalization.

Based on Santiago Fiorino's SAO fine-tuning pipeline, adapted for
DGB Studio's Bachata/Boleros training workflow.

Usage:
    python prepare_audio.py --input /path/to/raw/audio --output /path/to/processed
"""

import argparse
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import pyloudnorm as pyln


SAMPLE_RATE = 44100
NUM_CHANNELS = 2
TARGET_LOUDNESS = -14.0
SUPPORTED_FORMATS = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".wma", ".opus"}


def convert_to_wav(input_path: Path, output_path: Path) -> bool:
    try:
        cmd = [
            "ffmpeg", "-y", "-i", str(input_path),
            "-ar", str(SAMPLE_RATE),
            "-ac", str(NUM_CHANNELS),
            "-sample_fmt", "s16",
            str(output_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            print(f"  [ERROR] ffmpeg failed: {result.stderr[:200]}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print(f"  [ERROR] ffmpeg timed out for {input_path.name}")
        return False
    except Exception as e:
        print(f"  [ERROR] Conversion failed: {e}")
        return False


def normalize_loudness(file_path: str, target_loudness: float = TARGET_LOUDNESS) -> bool:
    try:
        data, rate = sf.read(file_path)
        if len(data.shape) == 1:
            data = np.column_stack([data, data])

        meter = pyln.Meter(rate)
        loudness = meter.integrated_loudness(data)

        if np.isinf(loudness) or np.isnan(loudness):
            print(f"  [WARN] Could not measure loudness, skipping normalization")
            return True

        normalized = pyln.normalize.loudness(data, loudness, target_loudness)

        peak = np.max(np.abs(normalized))
        if peak > 1.0:
            normalized = normalized / peak * 0.99

        sf.write(file_path, normalized, rate)
        return True
    except Exception as e:
        print(f"  [ERROR] Normalization failed: {e}")
        return False


def get_audio_duration(file_path: Path) -> float:
    try:
        info = sf.info(str(file_path))
        return info.duration
    except:
        return 0.0


def process_directory(input_dir: Path, output_dir: Path, min_duration: float = 10.0):
    output_dir.mkdir(parents=True, exist_ok=True)

    audio_files = []
    for fmt in SUPPORTED_FORMATS:
        audio_files.extend(input_dir.rglob(f"*{fmt}"))
        audio_files.extend(input_dir.rglob(f"*{fmt.upper()}"))

    audio_files = sorted(set(audio_files))
    total = len(audio_files)

    print(f"\n{'='*60}")
    print(f"DGB Studio - Audio Preprocessing Pipeline")
    print(f"{'='*60}")
    print(f"Input directory:  {input_dir}")
    print(f"Output directory: {output_dir}")
    print(f"Files found:      {total}")
    print(f"Target sample rate: {SAMPLE_RATE} Hz")
    print(f"Target channels:    {NUM_CHANNELS} (stereo)")
    print(f"Target loudness:    {TARGET_LOUDNESS} LUFS")
    print(f"Min duration:       {min_duration}s")
    print(f"{'='*60}\n")

    success = 0
    skipped = 0
    failed = 0

    for i, audio_path in enumerate(audio_files, 1):
        rel_path = audio_path.relative_to(input_dir)
        output_path = output_dir / rel_path.with_suffix(".wav")
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if output_path.exists():
            print(f"[{i}/{total}] SKIP (exists): {rel_path}")
            skipped += 1
            continue

        print(f"[{i}/{total}] Processing: {rel_path}")

        if audio_path.suffix.lower() == ".wav":
            try:
                info = sf.info(str(audio_path))
                if info.samplerate == SAMPLE_RATE and info.channels == NUM_CHANNELS:
                    import shutil
                    shutil.copy2(str(audio_path), str(output_path))
                    print(f"  Copied (already correct format)")
                else:
                    if not convert_to_wav(audio_path, output_path):
                        failed += 1
                        continue
            except:
                if not convert_to_wav(audio_path, output_path):
                    failed += 1
                    continue
        else:
            if not convert_to_wav(audio_path, output_path):
                failed += 1
                continue

        duration = get_audio_duration(output_path)
        if duration < min_duration:
            print(f"  [SKIP] Too short ({duration:.1f}s < {min_duration}s)")
            output_path.unlink()
            skipped += 1
            continue

        if not normalize_loudness(str(output_path)):
            failed += 1
            continue

        print(f"  OK ({duration:.1f}s)")
        success += 1

    print(f"\n{'='*60}")
    print(f"Results: {success} processed, {skipped} skipped, {failed} failed")
    print(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(description="DGB Studio Audio Preprocessing")
    parser.add_argument("--input", "-i", required=True, help="Input directory with raw audio files")
    parser.add_argument("--output", "-o", required=True, help="Output directory for processed WAV files")
    parser.add_argument("--min-duration", type=float, default=10.0, help="Minimum audio duration in seconds (default: 10)")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)

    if not input_dir.exists():
        print(f"Error: Input directory not found: {input_dir}")
        sys.exit(1)

    process_directory(input_dir, output_dir, args.min_duration)


if __name__ == "__main__":
    main()
