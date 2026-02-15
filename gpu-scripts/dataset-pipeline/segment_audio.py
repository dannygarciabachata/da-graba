#!/usr/bin/env python3
"""
DGB Studio - Audio Segmentation Pipeline
Step 2: Segment audio files into training-ready clips with beat-aligned cuts

Splits processed audio files into ~47-second segments aligned to beat boundaries.
Filters out silent or very quiet segments.

Based on SAO fine-tuning requirements (sample_size: 2097152 @ 44100Hz = ~47.5s).
Uses librosa beat tracking to find optimal cut points on downbeats.

Usage:
    python segment_audio.py --input /path/to/processed --output /path/to/segments
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

try:
    import librosa
    HAS_LIBROSA = True
except ImportError:
    HAS_LIBROSA = False


SAMPLE_RATE = 44100
TARGET_DURATION = 47.0
MIN_SEGMENT_DURATION = 30.0
MAX_SEGMENT_DURATION = 47.5
SILENCE_THRESHOLD_DB = -40.0


def compute_rms_db(audio: np.ndarray) -> float:
    if audio.size == 0:
        return -100.0
    rms = np.sqrt(np.mean(audio ** 2))
    if rms == 0:
        return -100.0
    return 20 * np.log10(rms)


def get_beat_times(audio_mono: np.ndarray, sr: int) -> np.ndarray:
    if not HAS_LIBROSA:
        return np.array([])
    try:
        tempo, beat_frames = librosa.beat.beat_track(y=audio_mono, sr=sr, units="frames")
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        return beat_times
    except Exception as e:
        print(f"    [WARN] Beat tracking failed: {e}")
        return np.array([])


def find_nearest_beat(beat_times: np.ndarray, target_time: float) -> float:
    if len(beat_times) == 0:
        return target_time
    idx = np.argmin(np.abs(beat_times - target_time))
    return float(beat_times[idx])


def segment_audio_file(
    input_path: Path,
    output_dir: Path,
    target_duration: float = TARGET_DURATION,
    min_duration: float = MIN_SEGMENT_DURATION,
    silence_threshold: float = SILENCE_THRESHOLD_DB,
) -> list:
    try:
        data, rate = sf.read(str(input_path))
    except Exception as e:
        print(f"  [ERROR] Could not read {input_path.name}: {e}")
        return []

    if len(data.shape) == 1:
        data = np.column_stack([data, data])

    total_samples = len(data)
    total_duration = total_samples / rate

    audio_mono = np.mean(data, axis=1) if data.ndim > 1 else data
    beat_times = get_beat_times(audio_mono, rate)

    if len(beat_times) > 0:
        print(f"    Detected {len(beat_times)} beats")
    else:
        print(f"    No beats detected, using fixed-window fallback")

    segments = []
    seg_idx = 0
    current_time = 0.0

    while current_time < total_duration:
        ideal_end = current_time + target_duration

        if ideal_end >= total_duration:
            remaining = total_duration - current_time
            if remaining >= min_duration:
                end_time = total_duration
            else:
                break
        else:
            if len(beat_times) > 0:
                end_time = find_nearest_beat(beat_times, ideal_end)
                if end_time - current_time < min_duration:
                    later_beats = beat_times[beat_times > (current_time + min_duration)]
                    if len(later_beats) > 0:
                        end_time = float(later_beats[np.argmin(np.abs(later_beats - ideal_end))])
                    else:
                        end_time = ideal_end
                elif end_time - current_time > MAX_SEGMENT_DURATION:
                    earlier_beats = beat_times[(beat_times > current_time + min_duration) & (beat_times <= ideal_end)]
                    if len(earlier_beats) > 0:
                        end_time = float(earlier_beats[-1])
                    else:
                        end_time = ideal_end
            else:
                end_time = min(ideal_end, total_duration)

        start_sample = int(current_time * rate)
        end_sample = min(int(end_time * rate), total_samples)
        segment = data[start_sample:end_sample]

        seg_duration = (end_sample - start_sample) / rate
        if seg_duration < min_duration:
            break

        rms_db = compute_rms_db(segment)
        if rms_db < silence_threshold:
            if len(beat_times) > 0:
                next_beats = beat_times[beat_times > end_time]
                if len(next_beats) > 0:
                    current_time = float(next_beats[0])
                else:
                    current_time = end_time
            else:
                current_time = end_time
            continue

        base_name = input_path.stem
        seg_name = f"{base_name}_seg{seg_idx:03d}.wav"
        seg_path = output_dir / seg_name

        sf.write(str(seg_path), segment, rate)
        segments.append({
            "file": seg_name,
            "source": input_path.name,
            "start_sec": round(current_time, 3),
            "end_sec": round(end_time, 3),
            "duration_sec": round(seg_duration, 3),
            "rms_db": round(rms_db, 2),
            "beat_aligned": len(beat_times) > 0,
        })

        seg_idx += 1
        if len(beat_times) > 0:
            next_beats = beat_times[beat_times >= end_time]
            if len(next_beats) > 0:
                current_time = float(next_beats[0])
            else:
                current_time = end_time
        else:
            current_time = end_time

    return segments


def process_directory(
    input_dir: Path,
    output_dir: Path,
    target_duration: float,
):
    output_dir.mkdir(parents=True, exist_ok=True)

    wav_files = sorted(input_dir.rglob("*.wav"))
    total = len(wav_files)

    print(f"\n{'='*60}")
    print(f"DGB Studio - Audio Segmentation Pipeline")
    print(f"{'='*60}")
    print(f"Input directory:    {input_dir}")
    print(f"Output directory:   {output_dir}")
    print(f"WAV files found:    {total}")
    print(f"Target duration:    {target_duration}s")
    print(f"Min duration:       {MIN_SEGMENT_DURATION}s")
    print(f"Beat alignment:     {'Yes (librosa)' if HAS_LIBROSA else 'No (fixed windows)'}")
    print(f"Silence threshold:  {SILENCE_THRESHOLD_DB} dB")
    print(f"{'='*60}\n")

    all_segments = []
    total_source_duration = 0
    total_segment_duration = 0

    for i, wav_path in enumerate(wav_files, 1):
        rel_path = wav_path.relative_to(input_dir)
        print(f"[{i}/{total}] Segmenting: {rel_path}")

        try:
            info = sf.info(str(wav_path))
            total_source_duration += info.duration
        except:
            pass

        segments = segment_audio_file(
            wav_path, output_dir,
            target_duration=target_duration,
        )

        for seg in segments:
            seg["source_path"] = str(rel_path)
            total_segment_duration += seg["duration_sec"]

        all_segments.extend(segments)
        print(f"  -> {len(segments)} segments")

    import json
    manifest_path = output_dir / "segments_manifest.json"
    with open(manifest_path, "w") as f:
        json.dump({
            "total_segments": len(all_segments),
            "total_source_duration_min": round(total_source_duration / 60, 2),
            "total_segment_duration_min": round(total_segment_duration / 60, 2),
            "target_duration": target_duration,
            "beat_aligned": HAS_LIBROSA,
            "segments": all_segments,
        }, f, indent=2)

    print(f"\n{'='*60}")
    print(f"Results:")
    print(f"  Source audio:   {total_source_duration/60:.1f} minutes")
    print(f"  Total segments: {len(all_segments)}")
    print(f"  Segment audio:  {total_segment_duration/60:.1f} minutes")
    beat_aligned = sum(1 for s in all_segments if s.get("beat_aligned"))
    print(f"  Beat-aligned:   {beat_aligned}/{len(all_segments)}")
    print(f"  Manifest:       {manifest_path}")
    print(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(description="DGB Studio Audio Segmentation")
    parser.add_argument("--input", "-i", required=True, help="Input directory with processed WAV files")
    parser.add_argument("--output", "-o", required=True, help="Output directory for segments")
    parser.add_argument("--target-duration", type=float, default=TARGET_DURATION, help=f"Target segment duration in seconds (default: {TARGET_DURATION})")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)

    if not input_dir.exists():
        print(f"Error: Input directory not found: {input_dir}")
        sys.exit(1)

    process_directory(input_dir, output_dir, args.target_duration)


if __name__ == "__main__":
    main()
