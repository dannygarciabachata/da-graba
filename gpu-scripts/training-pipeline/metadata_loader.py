"""
DGB Studio - Custom Metadata Loader for stable-audio-tools

This module is loaded by stable-audio-tools during training to
read prompt metadata from JSON files alongside each WAV file.

The JSON files must be in the same directory as the WAV files,
with the same base name (e.g., track_seg001.wav -> track_seg001.json).
"""

import json


def get_custom_metadata(info, audio):
    wav_path = info["relpath"]
    json_path = wav_path.rsplit(".", 1)[0] + ".json"

    dataset_path = info.get("dataset_path", "/workspace/dgb-dataset/04_dataset")
    full_path = f"{dataset_path}/{json_path}"

    try:
        with open(full_path, encoding="utf-8") as f:
            metadata = json.load(f)
        return {
            "prompt": metadata.get("prompt", "A Latin music track with guitar and percussion.")
        }
    except FileNotFoundError:
        return {
            "prompt": "A Latin music instrumental with warm acoustic guitar and rhythmic percussion."
        }
    except Exception as e:
        print(f"[metadata_loader] Error loading {full_path}: {e}")
        return {
            "prompt": "A Latin music track."
        }
