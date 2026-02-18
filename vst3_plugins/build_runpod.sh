#!/bin/bash
set -e

echo "=== DAGRABA Sampler VST3 Build Script for RunPod ==="

VST3_SDK_DIR="/runpod-volume/vst3sdk"
PLUGIN_SRC="/workspace/vst3_plugins/dagraba_sampler"
BUILD_DIR="/runpod-volume/vst3_build"
DEPLOY_DIR="/runpod-volume/vst3"
SAMPLES_DIR="/runpod-volume/vst3/samples"

echo "[1/6] Installing build dependencies..."
apt-get update -qq
apt-get install -y -qq build-essential cmake git pkg-config libx11-dev libxcb1-dev \
    libfreetype6-dev libfontconfig1-dev 2>/dev/null || true

echo "[2/6] Cloning/updating VST3 SDK..."
if [ -d "$VST3_SDK_DIR/.git" ]; then
    echo "  VST3 SDK already cloned, updating..."
    cd "$VST3_SDK_DIR"
    git pull --quiet 2>/dev/null || true
    git submodule update --init --recursive --quiet 2>/dev/null || true
else
    echo "  Cloning VST3 SDK (this may take a few minutes)..."
    git clone --recursive --quiet https://github.com/steinbergmedia/vst3sdk.git "$VST3_SDK_DIR"
fi

echo "[3/6] Preparing build directory..."
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

echo "[4/6] Running CMake configuration..."
cmake "$PLUGIN_SRC" \
    -DCMAKE_BUILD_TYPE=Release \
    -Dvst3sdk_SOURCE_DIR="$VST3_SDK_DIR" \
    -DSMTG_ADD_VST3_HOSTING_SAMPLES=OFF \
    -DSMTG_ADD_VST3_PLUGINS_SAMPLES=OFF \
    -DSMTG_CREATE_PLUGIN_LINK=OFF \
    -DSMTG_RUN_VST_VALIDATOR=OFF \
    2>&1

echo "[5/6] Building DAGRABA Sampler..."
cmake --build . --config Release -j$(nproc) 2>&1

echo "[6/6] Deploying to network volume..."
mkdir -p "$DEPLOY_DIR"
mkdir -p "$SAMPLES_DIR"

BUILT_VST3=$(find "$BUILD_DIR" -name "DAGRABA_Sampler.vst3" -type d 2>/dev/null | head -1)
if [ -z "$BUILT_VST3" ]; then
    BUILT_VST3=$(find "$BUILD_DIR" -name "*.vst3" -type d 2>/dev/null | head -1)
fi

if [ -n "$BUILT_VST3" ]; then
    cp -r "$BUILT_VST3" "$DEPLOY_DIR/"
    echo "  Deployed: $DEPLOY_DIR/DAGRABA_Sampler.vst3"
else
    BUILT_SO=$(find "$BUILD_DIR" -name "*.so" -path "*/VST3/*" 2>/dev/null | head -1)
    if [ -n "$BUILT_SO" ]; then
        mkdir -p "$DEPLOY_DIR/DAGRABA_Sampler.vst3/Contents/x86_64-linux"
        cp "$BUILT_SO" "$DEPLOY_DIR/DAGRABA_Sampler.vst3/Contents/x86_64-linux/DAGRABA_Sampler.so"
        echo "  Deployed manually: $DEPLOY_DIR/DAGRABA_Sampler.vst3"
    else
        echo "  ERROR: Could not find built VST3 plugin!"
        find "$BUILD_DIR" -name "*.so" -o -name "*.vst3" 2>/dev/null
        exit 1
    fi
fi

for inst in "Requinto" "Segunda Guitarra" "Bongo" "Conga" "Guira" "Timbal" "Campanas" "Bajo" "Piano" "Pad" "Strings (Violines)" "Strings (Chelos)"; do
    mkdir -p "$SAMPLES_DIR/$inst"
done

echo ""
echo "=== Build Complete ==="
echo "Plugin: $DEPLOY_DIR/DAGRABA_Sampler.vst3"
echo "Samples: $SAMPLES_DIR/"
echo ""
echo "To add instrument samples, place WAV files in:"
echo "  $SAMPLES_DIR/<InstrumentName>/"
echo ""
echo "WAV naming convention:"
echo "  <name>_n<rootNote>.wav       (e.g., requinto_n60.wav)"
echo "  <name>_n<note>_v<vel>.wav    (e.g., requinto_n60_v100.wav)"
echo ""
ls -la "$DEPLOY_DIR/" 2>/dev/null
