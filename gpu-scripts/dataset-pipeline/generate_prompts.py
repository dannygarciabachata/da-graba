#!/usr/bin/env python3
"""
DGB Studio - Prompt Generation Pipeline
Step 4: Generate natural language prompts from metadata using LLM

Takes JSON metadata files and generates descriptive prompts suitable for
training Stable Audio Open. Uses OpenAI/LiteLLM to create varied,
natural-sounding descriptions.

Based on Santiago Fiorino's prompt generation approach, customized for
Bachata/Boleros with DGB Studio's signature sound.

Usage:
    python generate_prompts.py --input /path/to/metadata --output /path/to/dataset
"""

import argparse
import json
import random
import sys
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from litellm import completion
except ImportError:
    completion = None

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


SYSTEM_PROMPT_TEMPLATE = """# General Instructions

You're an agent in charge of converting structured data into a cohesive, human-written-like paragraph.

Your task is to transform a JSON describing an audio track into a **short, descriptive paragraph** that reads like a prompt a human would write to generate music.

The JSON contains metadata such as genre tags, key, tempo, acousticness, energy, and instruments.

Your output will be paired with the audio to train a music generative model specialized in Latin music (Bachata and Boleros), so the description must accurately reflect the metadata.

## Special Context: DGB Studio / Danny Garcia Sound

This model is being trained for DGB Studio, specializing in:
- **Bachata Dominicana** with authentic requinto guitar work, distinctive güira patterns, and bongó rhythms
- **Boleros románticos** with intimate nylon guitar, orchestral arrangements, and warm vocal styles
- **"Trucos de tocadas"** - unique playing techniques, ornamental notes, slides, hammer-ons, pull-offs, and rhythmic embellishments characteristic of the genre
- The sound DNA of Danny Garcia's signature production style

When describing the track, emphasize the Latin character, rhythmic patterns, and any distinctive playing techniques or ornamental details.

## Input

The user will provide a JSON with the following structure:

```json
{{
    "tags": [str],
    "instruments": [str],
    "acousticness": float,
    "energy": float,
    "key": str,
    "mode": str,
    "tempo": float
}}
```

{explanation}

## Output

The output should be:
- **A description of the song**, written with **adjectives**, not verbs.
- **Not a question**, not a conversation.
- **Not instructions**, but a natural standalone prompt.
- **Cohesive and short** (1-3 sentences), not a list of parameters.
- A reflection of what a human would write when describing the track's vibe, style, and instrumentation.
- Should include the genre, instruments, key/mode, and BPM naturally woven into the description.

Your output is only the prompt itself, no explanations, no extra text.

## Examples

**Input 1:**
```json
{{
    "tags": ["bachata", "romántica", "tropical"],
    "instruments": ["Guitarra Requinto", "Guitarra Segunda", "Bongó", "Güira", "Bajo Eléctrico"],
    "acousticness": 0.72,
    "energy": 0.55,
    "key": "D",
    "mode": "Minor",
    "tempo": 130
}}
```

**Expected Output 1**:
A romantic bachata dominicana featuring the distinctive requinto guitar with ornamental punteos, rhythmic segunda guitar strumming, bongó patterns, metallic güira, and a warm electric bass groove. Set in D Minor at 130 BPM, the track evokes the intimate feel of classic Dominican bachata with a tropical warmth.

**Input 2:**
```json
{{
    "tags": ["bolero", "balada", "romántica", "intimate"],
    "instruments": ["Guitarra Clásica Nylon", "Piano", "Cuerdas", "Congas"],
    "acousticness": 0.91,
    "energy": 0.3,
    "key": "G",
    "mode": "Major",
    "tempo": 85
}}
```

**Expected Output 2**:
An intimate bolero romántico with delicate nylon guitar arpeggios, soft piano chords, lush string arrangements, and subtle conga percussion. In the key of G Major at 85 BPM, this acoustic ballad captures the warmth and tenderness of classic Latin bolero tradition.

**Input 3:**
```json
{{
    "tags": ["bachata", "tropical", "Dominican", "requinto"],
    "instruments": ["Guitarra Requinto", "Bongó", "Güira"],
    "acousticness": 0.65,
    "energy": 0.7,
    "key": "A",
    "mode": "Minor",
    "tempo": 140
}}
```

**Expected Output 3**:
An energetic bachata with a driving requinto lead guitar showcasing rapid punteos and ornamental slides, accompanied by syncopated bongó hits and a crisp güira pattern. Set in A Minor at 140 BPM, the track brings an authentic Dominican rhythm with high energy and tropical flair."""


def build_system_prompt():
    tags_md = """**Tags**
A list of words describing the track's style.
They often describe **genre, style, and feel**, and are **extremely important.**
* If a genre appears (e.g., "bachata", "bolero"), always include it prominently.
* Keep all relevant adjectives describing the mood or feel.
* For Latin genres, emphasize rhythmic character and cultural origin."""

    acousticness_md = """**Acousticness and Energy**:
Both range from 0 to 1:
* If **acousticness is close to 1**, mention that the track is acoustic or intimate.
* If **energy is close to 1**, describe it as energetic or lively.
* If **energy is close to 0**, describe it as soft, gentle, or intimate."""

    key_md = """**Key, Mode and Tempo**:
Always include the musical key, mode, and BPM somewhere in the paragraph (e.g., "in the key of D Minor at 130 BPM")."""

    instruments_md = """**Instruments**:
Always list the instruments present in the audio as part of the description.
For bachata: use specific names like "requinto", "segunda guitarra", "bongó", "güira".
For bolero: mention "guitarra clásica nylon", "cuerdas", "piano" etc.
Include any playing techniques: punteos, rasgueos, slides, ornaments."""

    explanation = [tags_md, acousticness_md, key_md, instruments_md]
    random.shuffle(explanation)
    explanation = [f"{i+1}. {e}\n" for i, e in enumerate(explanation)]
    explanation_text = "\n".join(explanation)

    return SYSTEM_PROMPT_TEMPLATE.replace("{explanation}", explanation_text)


def generate_prompt_openai(metadata: dict) -> str:
    client = OpenAI()
    system_prompt = build_system_prompt()

    clean_metadata = {
        "tags": metadata.get("tags", []),
        "instruments": metadata.get("instruments", []),
        "acousticness": metadata.get("acousticness", 0.5),
        "energy": metadata.get("energy", 0.5),
        "key": metadata.get("key", "C"),
        "mode": metadata.get("mode", "Major"),
        "tempo": metadata.get("tempo", 120),
    }

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(clean_metadata)},
        ],
        max_tokens=300,
        temperature=0.7,
    )

    return response.choices[0].message.content.strip()


def generate_prompt_litellm(metadata: dict, model: str = "gpt-4o-mini") -> str:
    system_prompt = build_system_prompt()

    clean_metadata = {
        "tags": metadata.get("tags", []),
        "instruments": metadata.get("instruments", []),
        "acousticness": metadata.get("acousticness", 0.5),
        "energy": metadata.get("energy", 0.5),
        "key": metadata.get("key", "C"),
        "mode": metadata.get("mode", "Major"),
        "tempo": metadata.get("tempo", 120),
    }

    response = completion(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(clean_metadata)},
        ],
        max_tokens=300,
        temperature=0.7,
    )

    return response.choices[0].message.content.strip()


def process_metadata(input_dir: Path, output_dir: Path, segments_dir: Path, model: str):
    output_dir.mkdir(parents=True, exist_ok=True)

    json_files = sorted(input_dir.glob("*.json"))
    json_files = [f for f in json_files if f.name != "features_summary.json"]
    total = len(json_files)

    print(f"\n{'='*60}")
    print(f"DGB Studio - Prompt Generation Pipeline")
    print(f"{'='*60}")
    print(f"Metadata directory: {input_dir}")
    print(f"Output directory:   {output_dir}")
    print(f"Segments directory: {segments_dir}")
    print(f"JSON files found:   {total}")
    print(f"LLM Model:          {model}")
    print(f"{'='*60}\n")

    success = 0
    failed = 0

    for i, json_path in enumerate(json_files, 1):
        output_json = output_dir / json_path.name
        if output_json.exists():
            print(f"[{i}/{total}] SKIP (exists): {json_path.name}")
            success += 1
            continue

        print(f"[{i}/{total}] Generating prompt: {json_path.name}")

        try:
            metadata = json.loads(json_path.read_text())

            if completion and model != "openai":
                prompt = generate_prompt_litellm(metadata, model)
            elif OpenAI:
                prompt = generate_prompt_openai(metadata)
            else:
                print(f"  [ERROR] No LLM library available")
                failed += 1
                continue

            metadata["prompt"] = prompt
            print(f"  -> {prompt[:100]}...")

            wav_name = json_path.stem + ".wav"
            wav_source = segments_dir / wav_name
            wav_dest = output_dir / wav_name

            if wav_source.exists() and not wav_dest.exists():
                import shutil
                shutil.copy2(str(wav_source), str(wav_dest))

            with open(output_json, "w") as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)

            success += 1

        except Exception as e:
            print(f"  [ERROR] {e}")
            failed += 1

    print(f"\n{'='*60}")
    print(f"Results: {success} prompts generated, {failed} failed")
    print(f"Dataset ready at: {output_dir}")
    print(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(description="DGB Studio Prompt Generation")
    parser.add_argument("--input", "-i", required=True, help="Input directory with metadata JSON files")
    parser.add_argument("--output", "-o", required=True, help="Output directory for dataset (WAV + JSON with prompts)")
    parser.add_argument("--segments", "-s", required=True, help="Directory containing audio segment WAV files")
    parser.add_argument("--model", "-m", default="gpt-4o-mini", help="LLM model for prompt generation (default: gpt-4o-mini)")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)
    segments_dir = Path(args.segments)

    if not input_dir.exists():
        print(f"Error: Metadata directory not found: {input_dir}")
        sys.exit(1)
    if not segments_dir.exists():
        print(f"Error: Segments directory not found: {segments_dir}")
        sys.exit(1)

    process_metadata(input_dir, output_dir, segments_dir, args.model)


if __name__ == "__main__":
    main()
