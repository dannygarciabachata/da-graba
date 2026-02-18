#pragma once

#include <vector>
#include <string>
#include <cmath>
#include <cstdint>
#include <map>
#include <memory>
#include <fstream>
#include <algorithm>
#include <cstring>

namespace Dagraba {

struct SampleData {
    std::vector<float> samples;
    int sampleRate = 44100;
    int channels = 1;
    int rootNote = 60;
    int loVelocity = 0;
    int hiVelocity = 127;
    int loKey = 0;
    int hiKey = 127;
};

struct ADSREnvelope {
    float attack = 0.01f;
    float decay = 0.1f;
    float sustain = 0.8f;
    float release = 0.3f;

    enum class Stage { Idle, Attack, Decay, Sustain, Release };

    Stage stage = Stage::Idle;
    float level = 0.0f;
    float releaseLevel = 0.0f;

    void noteOn() {
        stage = Stage::Attack;
        level = 0.0f;
    }

    void noteOff() {
        if (stage != Stage::Idle) {
            stage = Stage::Release;
            releaseLevel = level;
        }
    }

    float process(float sampleRate) {
        float dt = 1.0f / sampleRate;
        switch (stage) {
            case Stage::Attack:
                level += dt / std::max(attack, 0.001f);
                if (level >= 1.0f) {
                    level = 1.0f;
                    stage = Stage::Decay;
                }
                break;
            case Stage::Decay:
                level -= dt / std::max(decay, 0.001f) * (1.0f - sustain);
                if (level <= sustain) {
                    level = sustain;
                    stage = Stage::Sustain;
                }
                break;
            case Stage::Sustain:
                level = sustain;
                break;
            case Stage::Release:
                level = releaseLevel * (1.0f - dt / std::max(release, 0.001f));
                releaseLevel = level;
                if (level <= 0.001f) {
                    level = 0.0f;
                    stage = Stage::Idle;
                }
                break;
            case Stage::Idle:
                level = 0.0f;
                break;
        }
        return level;
    }

    bool isActive() const { return stage != Stage::Idle; }
};

struct Voice {
    int note = -1;
    float velocity = 0.0f;
    double phase = 0.0;
    double phaseIncrement = 0.0;
    ADSREnvelope envelope;
    const SampleData* sample = nullptr;

    bool isActive() const { return envelope.isActive(); }
};

class SamplerEngine {
public:
    static constexpr int kMaxVoices = 32;
    static constexpr int kMaxInstruments = 12;

    SamplerEngine() {
        for (int i = 0; i < kMaxVoices; ++i) {
            voices_[i].note = -1;
        }
    }

    void setSampleRate(float sr) { sampleRate_ = sr; }

    void setVolume(float v) { volume_ = v; }
    void setAttack(float a) { adsr_.attack = a; }
    void setDecay(float d) { adsr_.decay = d; }
    void setSustain(float s) { adsr_.sustain = s; }
    void setRelease(float r) { adsr_.release = r; }

    void setInstrument(int preset) {
        if (preset >= 0 && preset < kMaxInstruments) {
            currentInstrument_ = preset;
        }
    }

    int getInstrument() const { return currentInstrument_; }

    bool loadSamplesFromDirectory(int instrument, const std::string& dirPath) {
        instrumentSamples_[instrument].clear();
        return true;
    }

    bool loadWavFile(int instrument, const std::string& filePath, int rootNote, int loKey, int hiKey, int loVel, int hiVel) {
        std::ifstream file(filePath, std::ios::binary);
        if (!file.is_open()) return false;

        char header[44];
        file.read(header, 44);
        if (file.gcount() < 44) return false;

        if (std::memcmp(header, "RIFF", 4) != 0 || std::memcmp(header + 8, "WAVE", 4) != 0)
            return false;

        int channels = *reinterpret_cast<int16_t*>(header + 22);
        int sampleRate = *reinterpret_cast<int32_t*>(header + 24);
        int bitsPerSample = *reinterpret_cast<int16_t*>(header + 34);
        int dataSize = *reinterpret_cast<int32_t*>(header + 40);

        SampleData sd;
        sd.sampleRate = sampleRate;
        sd.channels = channels;
        sd.rootNote = rootNote;
        sd.loKey = loKey;
        sd.hiKey = hiKey;
        sd.loVelocity = loVel;
        sd.hiVelocity = hiVel;

        int numSamples = dataSize / (bitsPerSample / 8) / channels;
        sd.samples.resize(numSamples);

        if (bitsPerSample == 16) {
            std::vector<int16_t> raw(numSamples * channels);
            file.read(reinterpret_cast<char*>(raw.data()), dataSize);
            for (int i = 0; i < numSamples; ++i) {
                float sum = 0.0f;
                for (int ch = 0; ch < channels; ++ch) {
                    sum += raw[i * channels + ch] / 32768.0f;
                }
                sd.samples[i] = sum / channels;
            }
        } else if (bitsPerSample == 24) {
            std::vector<uint8_t> raw(dataSize);
            file.read(reinterpret_cast<char*>(raw.data()), dataSize);
            for (int i = 0; i < numSamples; ++i) {
                float sum = 0.0f;
                for (int ch = 0; ch < channels; ++ch) {
                    int idx = (i * channels + ch) * 3;
                    int32_t val = (raw[idx] | (raw[idx+1] << 8) | (raw[idx+2] << 16));
                    if (val & 0x800000) val |= 0xFF000000;
                    sum += val / 8388608.0f;
                }
                sd.samples[i] = sum / channels;
            }
        } else if (bitsPerSample == 32) {
            std::vector<float> raw(numSamples * channels);
            file.read(reinterpret_cast<char*>(raw.data()), dataSize);
            for (int i = 0; i < numSamples; ++i) {
                float sum = 0.0f;
                for (int ch = 0; ch < channels; ++ch) {
                    sum += raw[i * channels + ch];
                }
                sd.samples[i] = sum / channels;
            }
        } else {
            return false;
        }

        instrumentSamples_[instrument].push_back(std::move(sd));
        return true;
    }

    bool hasSamplesLoaded(int instrument) const {
        auto it = instrumentSamples_.find(instrument);
        return it != instrumentSamples_.end() && !it->second.empty();
    }

    void noteOn(int note, float velocity) {
        Voice* voice = findFreeVoice();
        if (!voice) {
            voice = stealVoice();
        }
        if (!voice) return;

        voice->note = note;
        voice->velocity = velocity;
        voice->phase = 0.0;
        voice->envelope = adsr_;
        voice->envelope.noteOn();
        voice->sample = findSample(currentInstrument_, note, static_cast<int>(velocity * 127.0f));

        if (voice->sample) {
            double ratio = static_cast<double>(voice->sample->sampleRate) / sampleRate_;
            double pitchShift = std::pow(2.0, (note - voice->sample->rootNote) / 12.0);
            voice->phaseIncrement = ratio * pitchShift;
        } else {
            double freq = 440.0 * std::pow(2.0, (note - 69) / 12.0);
            voice->phaseIncrement = freq / sampleRate_;
        }
    }

    void noteOff(int note) {
        for (int i = 0; i < kMaxVoices; ++i) {
            if (voices_[i].note == note && voices_[i].isActive()) {
                voices_[i].envelope.noteOff();
            }
        }
    }

    void allNotesOff() {
        for (int i = 0; i < kMaxVoices; ++i) {
            voices_[i].envelope.noteOff();
            voices_[i].note = -1;
        }
    }

    void process(float** outputs, int numChannels, int numSamples) {
        for (int ch = 0; ch < numChannels; ++ch) {
            std::memset(outputs[ch], 0, numSamples * sizeof(float));
        }

        for (int v = 0; v < kMaxVoices; ++v) {
            Voice& voice = voices_[v];
            if (!voice.isActive()) continue;

            for (int s = 0; s < numSamples; ++s) {
                float env = voice.envelope.process(sampleRate_);
                if (!voice.isActive()) break;

                float sample;
                if (voice.sample && !voice.sample->samples.empty()) {
                    int idx = static_cast<int>(voice.phase);
                    if (idx >= static_cast<int>(voice.sample->samples.size()) - 1) {
                        voice.envelope.stage = ADSREnvelope::Stage::Idle;
                        break;
                    }
                    float frac = static_cast<float>(voice.phase - idx);
                    sample = voice.sample->samples[idx] * (1.0f - frac)
                           + voice.sample->samples[idx + 1] * frac;
                } else {
                    sample = generateSynthTone(voice.phase, voice.note);
                }

                float out = sample * env * voice.velocity * volume_;
                for (int ch = 0; ch < numChannels; ++ch) {
                    outputs[ch][s] += out;
                }
                voice.phase += voice.phaseIncrement;
            }
        }
    }

private:
    float sampleRate_ = 44100.0f;
    float volume_ = 0.8f;
    int currentInstrument_ = 0;
    ADSREnvelope adsr_;
    Voice voices_[kMaxVoices];
    std::map<int, std::vector<SampleData>> instrumentSamples_;

    Voice* findFreeVoice() {
        for (int i = 0; i < kMaxVoices; ++i) {
            if (!voices_[i].isActive()) return &voices_[i];
        }
        return nullptr;
    }

    Voice* stealVoice() {
        Voice* quietest = &voices_[0];
        for (int i = 1; i < kMaxVoices; ++i) {
            if (voices_[i].envelope.level < quietest->envelope.level) {
                quietest = &voices_[i];
            }
        }
        return quietest;
    }

    const SampleData* findSample(int instrument, int note, int velocity) const {
        auto it = instrumentSamples_.find(instrument);
        if (it == instrumentSamples_.end() || it->second.empty()) return nullptr;

        const SampleData* best = nullptr;
        int bestDist = 999;
        for (const auto& sd : it->second) {
            if (note >= sd.loKey && note <= sd.hiKey &&
                velocity >= sd.loVelocity && velocity <= sd.hiVelocity) {
                int dist = std::abs(note - sd.rootNote);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = &sd;
                }
            }
        }
        return best;
    }

    float generateSynthTone(double phase, int note) const {
        float p = static_cast<float>(phase - static_cast<int>(phase));
        float fundamental = std::sin(2.0f * 3.14159265f * p);
        float second = 0.3f * std::sin(4.0f * 3.14159265f * p);
        float third = 0.15f * std::sin(6.0f * 3.14159265f * p);
        float body = 0.08f * std::sin(8.0f * 3.14159265f * p);
        float brightness = std::max(0.0f, 1.0f - static_cast<float>(phase) * 0.5f);
        return fundamental + (second + third + body) * brightness;
    }
};

}
