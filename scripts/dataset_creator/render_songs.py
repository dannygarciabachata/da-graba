import os
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
import pyloudnorm as pyln
import fluidsynth

from instruments_map import SOUNDFONT_PATH, get_instrument_name

sample_rate = 44100
num_channels = 2
output_dir = Path("renders")
output_dir.mkdir(parents=True, exist_ok=True)


def main():
    if not os.path.exists(SOUNDFONT_PATH):
        print(f"SoundFont not found at {SOUNDFONT_PATH}")
        print("Run setup_runpod_instruments.sh first to download FluidR3_GM.sf2")
        return

    root = Path("clean_midi")
    if not root.exists():
        print("clean_midi directory not found. Exiting...")
        return

    for artist_dir in root.iterdir():
        if not artist_dir.is_dir():
            continue
        for midi_track_dir in artist_dir.iterdir():
            if not midi_track_dir.is_dir():
                continue
            render_song(artist_dir, midi_track_dir)


def render_song(artist_dir, midi_track_dir):
    output_path = output_dir / artist_dir.name / f"{midi_track_dir.name}.wav"

    if output_path.exists():
        return

    output_path.parent.mkdir(parents=True, exist_ok=True)
    print(f'Rendering "{midi_track_dir.name}" by {artist_dir.name}...')

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir = Path(temp_dir)
        synthesize_all_tracks(midi_track_dir, temp_dir)

        wav_files = list(temp_dir.glob("*.wav"))
        if not wav_files:
            print(f"\tNo tracks rendered for {midi_track_dir.name}. Skipping...")
            return

        mix_and_normalize(temp_dir, output_path)


def synthesize_all_tracks(midi_dir, temp_dir):
    for midi_path in midi_dir.iterdir():
        if midi_path.suffix.lower() == ".mid":
            synthesize_single_track(midi_path, temp_dir)


def synthesize_single_track(midi_path, temp_dir):
    try:
        instrument_number = int(midi_path.stem.split("_")[0])
    except (ValueError, IndexError):
        print(f"\tCould not parse instrument number from {midi_path.name}. Skipping...")
        return

    instrument_name = get_instrument_name(instrument_number)
    print(f"\tSynthesizing {midi_path.name} ({instrument_name})...")

    audio_path = temp_dir / f"{midi_path.stem}.wav"

    try:
        render_midi_with_fluidsynth(
            midi_path=str(midi_path),
            output_path=str(audio_path),
            program_number=instrument_number,
            sample_rate=sample_rate,
        )
    except Exception as e:
        print(f"\t\tError synthesizing {midi_path.name}: {e}")
        return

    if audio_path.exists() and audio_path.stat().st_size > 0:
        print(f"\t\tNormalizing loudness of synthesized audio...")
        try:
            normalize_loudness(str(audio_path))
        except Exception as e:
            print(f"\t\tWarning: Could not normalize {midi_path.name}: {e}")


def render_midi_with_fluidsynth(midi_path, output_path, program_number, sample_rate=44100):
    fs = fluidsynth.Synth(samplerate=float(sample_rate))
    sfid = fs.sfload(SOUNDFONT_PATH)

    is_drum = (program_number >= 112)
    if is_drum:
        fs.program_select(9, sfid, 128, 0)
    else:
        fs.program_select(0, sfid, 0, program_number)

    import mido
    midi_file = mido.MidiFile(midi_path)
    total_duration = midi_file.length + 2.0

    total_samples = int(total_duration * sample_rate)
    audio_buffer = np.zeros((total_samples, 2), dtype=np.float32)

    channel = 9 if is_drum else 0
    current_sample = 0

    for msg in midi_file:
        if msg.time > 0:
            samples_to_render = int(msg.time * sample_rate)
            if samples_to_render > 0 and current_sample < total_samples:
                chunk = fs.get_samples(samples_to_render)
                chunk = chunk.reshape(-1, 2).astype(np.float32) / 32768.0
                end_sample = min(current_sample + len(chunk), total_samples)
                audio_buffer[current_sample:end_sample] = chunk[:end_sample - current_sample]
                current_sample = end_sample

        if msg.type == 'note_on':
            fs.noteon(channel, msg.note, msg.velocity)
        elif msg.type == 'note_off':
            fs.noteoff(channel, msg.note)
        elif msg.type == 'control_change':
            fs.cc(channel, msg.control, msg.value)
        elif msg.type == 'pitchwheel':
            fs.pitch_bend(channel, msg.pitch + 8192)

    remaining = total_samples - current_sample
    if remaining > 0:
        chunk = fs.get_samples(remaining)
        chunk = chunk.reshape(-1, 2).astype(np.float32) / 32768.0
        end_sample = min(current_sample + len(chunk), total_samples)
        audio_buffer[current_sample:end_sample] = chunk[:end_sample - current_sample]

    fs.delete()

    audio_buffer = np.clip(audio_buffer, -1.0, 1.0)
    sf.write(output_path, audio_buffer, sample_rate)


def mix_and_normalize(temp_dir, output_path):
    print(f"\tMixing all audio files...")
    mix_audio_files(temp_dir, output_path)
    print(f"\t\tNormalizing loudness of mixed audio...")
    normalize_loudness(str(output_path))


def normalize_loudness(file):
    data, rate = sf.read(file)
    meter = pyln.Meter(rate)
    loudness = meter.integrated_loudness(data)
    if loudness == float('-inf'):
        return
    loudness_normalized_audio = pyln.normalize.loudness(data, loudness, -12.0)
    sf.write(file, loudness_normalized_audio, rate)


def mix_audio_files(dir_path, output_path):
    audio_paths = [path for path in Path(dir_path).iterdir() if path.is_file() and path.suffix == ".wav"]
    if not audio_paths:
        return

    audio_files = [sf.read(str(path)) for path in audio_paths]
    wav_datas = [file[0] for file in audio_files]
    wav_rates = [file[1] for file in audio_files]

    max_length = max(len(wav_data) for wav_data in wav_datas)

    padded_wav_datas = []
    for wav_data in wav_datas:
        if wav_data.ndim == 1:
            wav_data = np.stack([wav_data, wav_data], axis=-1)
        if len(wav_data) < max_length:
            padding = max_length - len(wav_data)
            padded_data = np.pad(wav_data, ((0, padding), (0, 0)), mode="constant")
            padded_wav_datas.append(padded_data)
        else:
            padded_wav_datas.append(wav_data)

    mixed_wav_data = sum(padded_wav_datas)
    mixed_wav_rate = wav_rates[0]
    sf.write(str(output_path), mixed_wav_data, mixed_wav_rate)


if __name__ == "__main__":
    main()
