# DGB Studio - Custom SAO Fine-Tuning Guide

## Complete Pipeline for Training a Bachata/Boleros Music Generation Model

**Based on Santiago Fiorino's methodology, adapted for original audio files**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Phase 1: Dataset Preparation](#phase-1-dataset-preparation)
5. [Phase 2: Model Training](#phase-2-model-training)
6. [Phase 3: Inference & Deployment](#phase-3-inference--deployment)
7. [Bachata/Boleros Instrument Reference](#bachataboleros-instrument-reference)
8. [Troubleshooting](#troubleshooting)
9. [Key Learnings from Fiorino's Research](#key-learnings-from-fiorinos-research)

---

## Overview

This guide walks through training a custom Stable Audio Open (SAO) model fine-tuned specifically on DGB Studio's Bachata and Boleros audio library. The goal is to capture Danny Garcia's signature sound DNA, including authentic playing techniques ("trucos de tocadas") like slides, hammer-ons, ornamental punteos, and genre-specific rhythm patterns.

### Key Difference from Fiorino's Original Pipeline

Fiorino's thesis used MIDI files rendered to audio through virtual instruments. DGB Studio works with **original audio recordings**, which means:

- **Skip MIDI rendering entirely** - we start with real audio files
- **Audio normalization replaces MIDI rendering** - loudness normalization, sample rate standardization
- **Feature extraction analyzes real recordings** - capturing authentic timbres and techniques
- **Prompts describe real performances** - not synthesized MIDI playback

### Expected Results (from Fiorino's research)

| Dataset Size | Training Time | Quality |
|---|---|---|
| 4 hours audio | ~1 hour | Initial test, recognizable style |
| 9 hours audio | ~5 hours | Production quality, strong genre adherence |
| 15+ hours audio | ~8 hours | Best results, full technique capture |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DATASET MACHINE                       │
│              (RunPod CPU or small GPU)                   │
│                                                          │
│  raw_audio/ ──► prepare_audio.py ──► 01_processed/      │
│                     (normalize, 44.1kHz stereo)          │
│                                                          │
│  01_processed/ ──► segment_audio.py ──► 02_segments/    │
│                     (~47s segments, beat-aligned)         │
│                                                          │
│  02_segments/ ──► extract_features.py ──► 03_metadata/  │
│                     (key, BPM, instruments, techniques)  │
│                                                          │
│  03_metadata/ ──► generate_prompts.py ──► 04_dataset/   │
│                     (OpenAI GPT prompt generation)       │
└─────────────────────────────────────────────────────────┘
                           │
                    Shared Volume
                           │
┌─────────────────────────────────────────────────────────┐
│                   TRAINING MACHINE                       │
│                  (RunPod A100 GPU)                       │
│                                                          │
│  04_dataset/ ──► stable-audio-tools train.py            │
│                     (fine-tune SAO 1.0)                  │
│                                                          │
│  Output: checkpoints/ (model weights)                    │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Audio Files
- Original Bachata and/or Boleros recordings (WAV, MP3, FLAC, OGG, AIFF)
- Minimum: 4 hours of audio for initial testing
- Recommended: 9+ hours for production quality
- Can be full songs, individual instrument recordings, or stems

### RunPod Account
- Account at [runpod.io](https://runpod.io)
- Sufficient credits for:
  - Dataset machine: ~$0.50-2.00 (few hours on CPU/small GPU)
  - Training machine: ~$5-20 (1-8 hours on A100)

### API Keys
- **OpenAI API Key** - for GPT-powered prompt generation
- **HuggingFace Token** - for downloading SAO 1.0 pretrained model
- **W&B API Key** (optional) - for training monitoring

---

## Phase 1: Dataset Preparation

### Step 1: Create RunPod Pod for Dataset Prep

1. Go to RunPod dashboard
2. Create a new pod:
   - **Template:** `runpod/pytorch:2.1.0-py3.10-cuda12.1.0-ubuntu22.04`
   - **GPU:** Any (CPU works fine for dataset prep)
   - **Container Disk:** 20GB
   - **Volume:** Create a new volume, 50GB+, mount at `/workspace`
3. Start the pod and connect via terminal

### Step 2: Run Setup Script

Upload the setup script and run it:

```bash
# Upload gpu-scripts/setup/setup_dataset_machine.sh to the pod
# Then run:
bash setup_dataset_machine.sh
```

This installs all dependencies and creates the workspace structure.

### Step 3: Upload Your Audio

Upload your Bachata/Boleros audio files to `/workspace/dgb-dataset/raw_audio/`:

```bash
# Using RunPod's file manager, or:
# From your local machine:
rsync -avz ./my-audio-files/ runpod:/workspace/dgb-dataset/raw_audio/
```

**Supported formats:** WAV, MP3, FLAC, OGG, AIFF, M4A

### Step 4: Configure Environment

```bash
cd /workspace
cp .env.template .env
nano .env
# Add your OPENAI_API_KEY
```

### Step 5: Run the Pipeline

```bash
cd /workspace/scripts

# For Bachata:
bash run_pipeline.sh /workspace/dgb-dataset/raw_audio bachata

# For Boleros:
bash run_pipeline.sh /workspace/dgb-dataset/raw_audio bolero
```

Or run each step individually:

```bash
# Step 1: Normalize audio (44.1kHz, stereo, -14 LUFS)
python3 prepare_audio.py -i /workspace/dgb-dataset/raw_audio -o /workspace/dgb-dataset/01_processed

# Step 2: Segment into ~47s chunks (beat-aligned)
python3 segment_audio.py -i /workspace/dgb-dataset/01_processed -o /workspace/dgb-dataset/02_segments --target-duration 47

# Step 3: Extract musical features (key, BPM, instruments)
python3 extract_features.py -i /workspace/dgb-dataset/02_segments -o /workspace/dgb-dataset/03_metadata --genre bachata

# Step 4: Generate prompts with OpenAI
python3 generate_prompts.py -i /workspace/dgb-dataset/03_metadata -o /workspace/dgb-dataset/04_dataset -s /workspace/dgb-dataset/02_segments
```

### Step 6: Verify Dataset

```bash
# Check output
ls /workspace/dgb-dataset/04_dataset/
# Should see paired .wav and .json files

# Check a prompt
cat /workspace/dgb-dataset/04_dataset/*.json | head -5

# Count files
find /workspace/dgb-dataset/04_dataset -name "*.wav" | wc -l
```

Each JSON file should contain a prompt like:
```json
{
  "prompt": "A romantic bachata dominicana featuring guitarra requinto playing ornamental punteos with hammer-on slides, segunda guitarra providing rhythmic strumming, bongó with syncopated slaps, güira maintaining steady scraping pattern, and electric bass walking bassline. In D Minor at 132 BPM, warm intimate Dominican bachata feel with traditional acoustic timbre."
}
```

---

## Phase 2: Model Training

### Step 1: Create A100 Pod

1. **Stop** the dataset pod (save credits)
2. Create a new pod:
   - **Template:** `runpod/pytorch:2.1.0-py3.10-cuda12.1.0-ubuntu22.04`
   - **GPU:** NVIDIA A100 (40GB or 80GB)
   - **Container Disk:** 50GB
   - **Volume:** **Same volume** as dataset machine (`/workspace`)
3. Start and connect

### Step 2: Run Training Setup

```bash
bash /workspace/scripts/setup_training_machine.sh
# Or upload and run: gpu-scripts/setup/setup_training_machine.sh
```

### Step 3: Start Training

```bash
cd /workspace/training

# For A100-40GB:
bash train.sh 8

# For A100-80GB:
bash train.sh 16
```

### Step 4: Monitor Training

**Demo outputs** are generated every 500 steps. Check them at:
```
/workspace/training/checkpoints/dgb_bachata_boleros_finetune/
```

**What to listen for in demos:**
- Step 500-1000: Basic structure emerging, may sound noisy
- Step 1500-2000: Genre becoming recognizable
- Step 2500-3000: Instrument timbres becoming clearer
- Step 3500-4000: Playing techniques becoming audible
- Step 4000+: Fine details, check for overfitting

**W&B monitoring** (if configured):
```bash
export WANDB_API_KEY=your_key
# Training will auto-log to wandb.ai
```

### Step 5: Stop Training

Training runs until manually stopped. Good stopping points:
- **~2000 steps**: Quick test, basic style capture
- **~4000 steps**: Recommended for production (matches Fiorino's results)
- **~6000+ steps**: Only if dataset is large enough (15h+), watch for overfitting

### Step 6: Export Model

The best checkpoint will be at:
```
/workspace/training/checkpoints/dgb_bachata_boleros_finetune/
```

Copy the final checkpoint for deployment:
```bash
cp /workspace/training/checkpoints/dgb_bachata_boleros_finetune/best.ckpt \
   /workspace/dgb_sao_bachata_v1.ckpt
```

---

## Phase 3: Inference & Deployment

### Local Testing

After training, test generation on the same A100 pod:

```python
import torch
from stable_audio_tools import get_pretrained_model
from stable_audio_tools.inference.generation import generate_diffusion_cond

# Load your fine-tuned model
model, model_config = get_pretrained_model("stabilityai/stable-audio-open-1.0")
model.load_state_dict(torch.load("/workspace/dgb_sao_bachata_v1.ckpt"))
model = model.cuda()

# Generate
conditioning = [{
    "prompt": "A romantic bachata with requinto guitar punteos, bongó, güira, and electric bass. D Minor, 130 BPM.",
    "seconds_start": 0,
    "seconds_total": 30
}]

output = generate_diffusion_cond(
    model,
    conditioning=conditioning,
    steps=100,
    cfg_scale=7,
    sample_size=model_config["sample_size"],
    sample_rate=model_config["sample_rate"],
    device="cuda"
)
```

### Deploying to DGB Studio

The fine-tuned model integrates with DGB Studio's existing SAO engine:

1. Upload the checkpoint to your RunPod persistent volume
2. Update the SAO generation endpoint to load the fine-tuned weights
3. The existing `sao_engine.ts` in DGB Studio will route to the fine-tuned model

---

## Bachata/Boleros Instrument Reference

### Bachata Instruments

| Instrument | Spanish Name | Key Techniques (Trucos) |
|---|---|---|
| Lead Guitar | Guitarra Requinto | Punteos, slides, hammer-ons, ornamental notes, arpeggios |
| Rhythm Guitar | Segunda (Guitarra Rítmica) | Rasgueo (strumming), derecho-revés pattern, palm muting |
| Bongó | Bongó | Slaps, open tones, martillo pattern, muted hits |
| Güira | Güira | Scraping patterns, accented strokes, metal scraping |
| Electric Bass | Bajo Eléctrico | Walking basslines, tumbao, syncopated patterns |

### Bolero Instruments

| Instrument | Spanish Name | Key Techniques |
|---|---|---|
| Classical Guitar | Guitarra Clásica (Nylon) | Fingerpicking arpeggios, tremolo, rubato |
| Lead Guitar | Requinto | Melodic fills, ornamental passages, vibrato |
| Piano | Piano | Block chords, arpeggiated accompaniment, fills |
| Strings | Cuerdas | Sustained pads, legato melodies, tremolo |
| Maracas | Maracas | Steady eighth-note pattern, accented downbeats |
| Congas | Congas | Open tones, slaps, heel-toe pattern |
| Acoustic Bass | Bajo Acústico | Root-fifth patterns, walking basslines |

### Typical BPM Ranges

- **Bachata Tradicional:** 125-135 BPM
- **Bachata Moderna:** 130-145 BPM
- **Bachata Sensual:** 120-130 BPM
- **Bolero Tradicional:** 75-95 BPM
- **Bolero Rítmico:** 90-110 BPM

### Common Keys

- **Bachata:** D minor, A minor, E minor, G major, C major
- **Bolero:** G major, C major, F major, D major, A minor

---

## Troubleshooting

### Dataset Pipeline Issues

**"essentia not installed"**
- Essentia can be tricky to install. The pipeline falls back to librosa for key detection, which works well.

**"Out of memory during feature extraction"**
- Process fewer files at once, or use a pod with more RAM.
- Feature extraction is CPU-bound, not GPU-bound.

**"OpenAI API errors during prompt generation"**
- Check your OPENAI_API_KEY in .env
- The script retries automatically (3 attempts per file)
- Rate limits are handled with exponential backoff

**"Segments are too short/long"**
- Default target: ~47 seconds (matching SAO's sample_size). Adjust with `--target-duration`.
- Minimum segment: 30 seconds. Shorter segments are discarded.
- Fiorino used 47 seconds as the optimal duration for training.

### Training Issues

**"CUDA out of memory"**
- Reduce batch_size (try 4 for A100-40GB)
- Ensure no other processes are using the GPU: `nvidia-smi`

**"model.ckpt not found"**
- Ensure HF_TOKEN is set: `export HF_TOKEN=your_token`
- Download manually: `huggingface-cli download stabilityai/stable-audio-open-1.0 model.ckpt`

**"Dataset too small" warning**
- Minimum ~100 segments recommended
- 4 hours of audio produces roughly 300-500 segments
- Smaller datasets will overfit quickly

**Demos sound like noise after 4000+ steps**
- Likely overfitting. Use an earlier checkpoint.
- Add more diverse audio to the dataset.
- Reduce learning rate in model_config.json.

**Training loss not decreasing**
- Check that JSON metadata files are paired correctly with WAV files
- Verify prompts are meaningful (not all the same)
- Try increasing learning rate slightly

---

## Key Learnings from Fiorino's Research

### What Worked

1. **Text conditioning is crucial** - Detailed, accurate prompts dramatically improve generation quality. Generic prompts produce generic output.

2. **47-second segments** - Long enough to capture musical phrases and structure, short enough for efficient training.

3. **Beat-aligned cuts** - Cutting at beat boundaries prevents artifacts and helps the model learn rhythmic structure.

4. **Diverse prompts** - Each segment should have a unique, detailed prompt describing what's happening musically.

5. **CFG scale 4-7** - Lower values (4) for more variety, higher (7) for more prompt adherence. Fiorino found 7 optimal for genre-specific generation.

6. **EMA weights** - Using exponential moving average of weights produces smoother, more stable outputs.

### What to Avoid

1. **Identical prompts** - Don't use the same prompt for all segments. Each should describe its unique musical content.

2. **Too-short segments** (<15s) - Not enough musical context for the model to learn structure.

3. **Mixed quality audio** - Normalize everything to the same loudness and sample rate first.

4. **Training too long on small datasets** - Leads to overfitting. Monitor demos and stop when quality plateaus.

5. **Ignoring demo outputs** - Demos every 500 steps are your best quality indicator. Listen to them.

### Adaptation Notes for DGB Studio

Since we use original audio instead of MIDI:

- **Advantage:** Real timbres, real playing techniques, authentic room sound
- **Advantage:** No MIDI-to-audio rendering artifacts
- **Challenge:** Must rely on audio analysis for feature extraction (vs. reading MIDI data directly)
- **Challenge:** Multiple instruments in a recording require intelligent prompt description
- **Solution:** OpenAI GPT generates prompts from extracted features, producing natural language descriptions that capture the full musical context

---

## File Reference

```
gpu-scripts/
├── GUIDE.md                              <- This file
├── dataset-pipeline/
│   ├── prepare_audio.py                  <- Step 1: Audio normalization
│   ├── segment_audio.py                  <- Step 2: Beat-aligned segmentation
│   ├── extract_features.py               <- Step 3: Musical feature extraction
│   ├── generate_prompts.py               <- Step 4: GPT prompt generation
│   ├── run_pipeline.sh                   <- Run all steps
│   └── requirements.txt                  <- Python dependencies
├── training-pipeline/
│   ├── model_config.json                 <- SAO model architecture config
│   ├── dataset_config.json               <- Dataset paths for training
│   ├── metadata_loader.py               <- Custom metadata reader
│   └── train.sh                          <- Training launch script
└── setup/
    ├── setup_dataset_machine.sh          <- Dataset pod setup
    └── setup_training_machine.sh         <- A100 training pod setup
```
