#!/bin/bash
# =============================================================
# DGB Studio - Complete Dataset Pipeline Runner
# =============================================================
# This script runs the full dataset preparation pipeline:
#   1. Audio preprocessing (format conversion, normalization)
#   2. Audio segmentation (~47s clips, beat-aligned)
#   3. Feature extraction (BPM, key, energy)
#   4. Prompt generation (LLM-based natural language descriptions)
#
# Usage:
#   ./run_pipeline.sh /path/to/raw/audio [genre]
#
# Arguments:
#   $1 - Path to raw audio files (required)
#   $2 - Genre: bachata, bolero, or mixed (default: bachata)
#
# Requirements:
#   - Python 3.10+
#   - ffmpeg
#   - OPENAI_API_KEY environment variable set
# =============================================================

set -e

RAW_AUDIO_DIR="${1:?Usage: ./run_pipeline.sh /path/to/raw/audio [genre]}"
GENRE="${2:-bachata}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

WORKSPACE="/workspace/dgb-dataset"
PROCESSED_DIR="$WORKSPACE/01_processed"
SEGMENTS_DIR="$WORKSPACE/02_segments"
METADATA_DIR="$WORKSPACE/03_metadata"
DATASET_DIR="$WORKSPACE/04_dataset"

echo ""
echo "============================================================="
echo "  DGB Studio - Dataset Pipeline"
echo "============================================================="
echo "  Raw audio:    $RAW_AUDIO_DIR"
echo "  Genre:        $GENRE"
echo "  Workspace:    $WORKSPACE"
echo "============================================================="
echo ""

mkdir -p "$WORKSPACE"

# Step 1: Audio Preprocessing
echo ""
echo ">>> STEP 1/4: Audio Preprocessing"
echo "-------------------------------------------------------------"
python3 "$SCRIPT_DIR/prepare_audio.py" \
    --input "$RAW_AUDIO_DIR" \
    --output "$PROCESSED_DIR" \
    --min-duration 10

# Step 2: Segmentation
echo ""
echo ">>> STEP 2/4: Audio Segmentation"
echo "-------------------------------------------------------------"
python3 "$SCRIPT_DIR/segment_audio.py" \
    --input "$PROCESSED_DIR" \
    --output "$SEGMENTS_DIR" \
    --target-duration 47

# Step 3: Feature Extraction
echo ""
echo ">>> STEP 3/4: Feature Extraction"
echo "-------------------------------------------------------------"
python3 "$SCRIPT_DIR/extract_features.py" \
    --input "$SEGMENTS_DIR" \
    --output "$METADATA_DIR" \
    --genre "$GENRE"

# Step 4: Prompt Generation
echo ""
echo ">>> STEP 4/4: Prompt Generation (LLM)"
echo "-------------------------------------------------------------"
if [ -z "$OPENAI_API_KEY" ]; then
    echo "[WARN] OPENAI_API_KEY not set. Using fallback prompts."
    echo "       Set OPENAI_API_KEY for better prompt quality."
fi

python3 "$SCRIPT_DIR/generate_prompts.py" \
    --input "$METADATA_DIR" \
    --output "$DATASET_DIR" \
    --segments "$SEGMENTS_DIR"

# Summary
echo ""
echo "============================================================="
echo "  PIPELINE COMPLETE"
echo "============================================================="
echo ""
echo "  Dataset directory: $DATASET_DIR"
echo ""
echo "  Files in dataset:"
WAV_COUNT=$(find "$DATASET_DIR" -name "*.wav" | wc -l)
JSON_COUNT=$(find "$DATASET_DIR" -name "*.json" | wc -l)
echo "    WAV files:  $WAV_COUNT"
echo "    JSON files: $JSON_COUNT"
echo ""

if [ "$WAV_COUNT" -gt 0 ]; then
    TOTAL_DURATION=$(python3 -c "
import soundfile as sf
from pathlib import Path
total = sum(sf.info(str(f)).duration for f in Path('$DATASET_DIR').glob('*.wav'))
print(f'{total/60:.1f} minutes ({total/3600:.1f} hours)')
" 2>/dev/null || echo "unknown")
    echo "    Total duration: $TOTAL_DURATION"
fi

echo ""
echo "  Next steps:"
echo "    1. Review the generated prompts in $DATASET_DIR/*.json"
echo "    2. Copy the dataset to your A100 training machine"
echo "    3. Run the training pipeline: python train_sao.py"
echo "============================================================="
