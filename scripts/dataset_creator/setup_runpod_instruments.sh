#!/bin/bash
# DAGRABA Studio - RunPod Instrument Setup Script
# Downloads FluidR3_GM SoundFont and installs FluidSynth for MIDI synthesis
# Run this on the RunPod pod or as part of the Docker image build

set -e

VOLUME_PATH="${RUNPOD_VOLUME_PATH:-/runpod-volume}"
INSTRUMENTS_DIR="${VOLUME_PATH}/instruments"
SOUNDFONT_DIR="${INSTRUMENTS_DIR}/soundfonts"
SOUNDFONT_URL="https://musical-artifacts.com/artifacts/738/FluidR3_GM.sf2"
SOUNDFONT_FILE="${SOUNDFONT_DIR}/FluidR3_GM.sf2"

echo "============================================"
echo "DAGRABA Studio - Instrument Setup"
echo "============================================"

mkdir -p "${SOUNDFONT_DIR}"

echo ""
echo "[1/3] Installing FluidSynth system package..."
if command -v fluidsynth &> /dev/null; then
    echo "  FluidSynth already installed: $(fluidsynth --version 2>&1 | head -1)"
else
    apt-get update -qq && apt-get install -y -qq fluidsynth libfluidsynth-dev
    echo "  FluidSynth installed successfully"
fi

echo ""
echo "[2/3] Installing Python dependencies..."
pip install -q pyfluidsynth mido pyloudnorm soundfile numpy

echo ""
echo "[3/3] Downloading FluidR3_GM SoundFont..."
if [ -f "${SOUNDFONT_FILE}" ]; then
    FILE_SIZE=$(stat -c%s "${SOUNDFONT_FILE}" 2>/dev/null || echo "0")
    if [ "$FILE_SIZE" -gt 100000000 ]; then
        echo "  FluidR3_GM.sf2 already exists ($(du -h "${SOUNDFONT_FILE}" | cut -f1)). Skipping download."
    else
        echo "  Existing file appears corrupt (${FILE_SIZE} bytes). Re-downloading..."
        rm -f "${SOUNDFONT_FILE}"
        wget -q --show-progress -O "${SOUNDFONT_FILE}" "${SOUNDFONT_URL}"
        echo "  Downloaded FluidR3_GM.sf2 ($(du -h "${SOUNDFONT_FILE}" | cut -f1))"
    fi
else
    wget -q --show-progress -O "${SOUNDFONT_FILE}" "${SOUNDFONT_URL}"
    echo "  Downloaded FluidR3_GM.sf2 ($(du -h "${SOUNDFONT_FILE}" | cut -f1))"
fi

echo ""
echo "============================================"
echo "Setup Complete!"
echo "============================================"
echo ""
echo "SoundFont location: ${SOUNDFONT_FILE}"
echo "FluidSynth version: $(fluidsynth --version 2>&1 | head -1)"
echo ""
echo "General MIDI instruments available: 128 melodic + 47 percussion"
echo "Ready for dataset rendering pipeline."
