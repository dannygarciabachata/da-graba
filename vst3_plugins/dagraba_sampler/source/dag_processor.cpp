#include "dag_processor.h"
#include "pluginterfaces/vst/ivstevents.h"
#include "pluginterfaces/vst/ivstparameterchanges.h"
#include "pluginterfaces/base/ibstream.h"

#include <cstdlib>
#include <filesystem>

namespace Dagraba {

DagrabaProcessor::DagrabaProcessor() {
    setControllerClass(kDagrabaControllerUID);

    const char* envPath = std::getenv("DAGRABA_SAMPLES_PATH");
    if (envPath) {
        samplesBasePath_ = envPath;
    } else {
        samplesBasePath_ = "/runpod-volume/vst3/samples";
    }
}

Steinberg::tresult PLUGIN_API DagrabaProcessor::initialize(Steinberg::FUnknown* context) {
    auto result = AudioEffect::initialize(context);
    if (result != Steinberg::kResultOk) return result;

    addEventInput(STR16("MIDI In"));
    addAudioOutput(STR16("Stereo Out"), Steinberg::Vst::SpeakerArr::kStereo);

    loadSamplesForInstrument(0);

    return Steinberg::kResultOk;
}

Steinberg::tresult PLUGIN_API DagrabaProcessor::terminate() {
    return AudioEffect::terminate();
}

Steinberg::tresult PLUGIN_API DagrabaProcessor::setActive(Steinberg::TBool state) {
    if (state) {
        engine_.setSampleRate(static_cast<float>(processSetup.sampleRate));
    } else {
        engine_.allNotesOff();
    }
    return AudioEffect::setActive(state);
}

Steinberg::tresult PLUGIN_API DagrabaProcessor::setupProcessing(Steinberg::Vst::ProcessSetup& newSetup) {
    engine_.setSampleRate(static_cast<float>(newSetup.sampleRate));
    return AudioEffect::setupProcessing(newSetup);
}

Steinberg::tresult PLUGIN_API DagrabaProcessor::canProcessSampleSize(Steinberg::int32 symbolicSampleSize) {
    if (symbolicSampleSize == Steinberg::Vst::kSample32)
        return Steinberg::kResultTrue;
    return Steinberg::kResultFalse;
}

Steinberg::tresult PLUGIN_API DagrabaProcessor::setBusArrangements(
    Steinberg::Vst::SpeakerArrangement* inputs, Steinberg::int32 numIns,
    Steinberg::Vst::SpeakerArrangement* outputs, Steinberg::int32 numOuts)
{
    if (numOuts == 1 && outputs[0] == Steinberg::Vst::SpeakerArr::kStereo) {
        return AudioEffect::setBusArrangements(inputs, numIns, outputs, numOuts);
    }
    return Steinberg::kResultFalse;
}

Steinberg::tresult PLUGIN_API DagrabaProcessor::process(Steinberg::Vst::ProcessData& data) {
    if (data.inputParameterChanges) {
        processParameterChanges(data.inputParameterChanges);
    }

    if (data.inputEvents) {
        processEvents(data.inputEvents);
    }

    if (data.numOutputs == 0 || data.outputs[0].numChannels < 2)
        return Steinberg::kResultOk;

    float* outputChannels[2] = {
        data.outputs[0].channelBuffers32[0],
        data.outputs[0].channelBuffers32[1]
    };

    engine_.process(outputChannels, 2, data.numSamples);

    data.outputs[0].silenceFlags = 0;

    return Steinberg::kResultOk;
}

void DagrabaProcessor::processEvents(Steinberg::Vst::IEventList* events) {
    if (!events) return;

    Steinberg::int32 count = events->getEventCount();
    for (Steinberg::int32 i = 0; i < count; ++i) {
        Steinberg::Vst::Event event;
        if (events->getEvent(i, event) == Steinberg::kResultOk) {
            switch (event.type) {
                case Steinberg::Vst::Event::kNoteOnEvent:
                    if (event.noteOn.velocity > 0) {
                        engine_.noteOn(event.noteOn.pitch, event.noteOn.velocity);
                    } else {
                        engine_.noteOff(event.noteOn.pitch);
                    }
                    break;
                case Steinberg::Vst::Event::kNoteOffEvent:
                    engine_.noteOff(event.noteOff.pitch);
                    break;
                default:
                    break;
            }
        }
    }
}

void DagrabaProcessor::processParameterChanges(Steinberg::Vst::IParameterChanges* changes) {
    if (!changes) return;

    Steinberg::int32 count = changes->getParameterCount();
    for (Steinberg::int32 i = 0; i < count; ++i) {
        auto* queue = changes->getParameterData(i);
        if (!queue) continue;

        Steinberg::Vst::ParamValue value;
        Steinberg::int32 sampleOffset;
        Steinberg::int32 numPoints = queue->getPointCount();
        if (queue->getPoint(numPoints - 1, sampleOffset, value) != Steinberg::kResultOk)
            continue;

        switch (queue->getParameterId()) {
            case kParamVolume:
                paramVolume_ = static_cast<float>(value);
                engine_.setVolume(paramVolume_);
                break;
            case kParamAttack:
                paramAttack_ = static_cast<float>(value) * 2.0f;
                engine_.setAttack(paramAttack_);
                break;
            case kParamDecay:
                paramDecay_ = static_cast<float>(value) * 2.0f;
                engine_.setDecay(paramDecay_);
                break;
            case kParamSustain:
                paramSustain_ = static_cast<float>(value);
                engine_.setSustain(paramSustain_);
                break;
            case kParamRelease:
                paramRelease_ = static_cast<float>(value) * 5.0f;
                engine_.setRelease(paramRelease_);
                break;
            case kParamInstrument: {
                int newInst = static_cast<int>(value * (kNumInstruments - 1) + 0.5);
                if (newInst != paramInstrument_) {
                    paramInstrument_ = newInst;
                    engine_.setInstrument(paramInstrument_);
                    loadSamplesForInstrument(paramInstrument_);
                }
                break;
            }
        }
    }
}

void DagrabaProcessor::loadSamplesForInstrument(int instrument) {
    if (instrument < 0 || instrument >= kNumInstruments) return;
    if (engine_.hasSamplesLoaded(instrument)) return;

    std::string instDir = samplesBasePath_ + "/" + kInstrumentNames[instrument];
    if (!std::filesystem::exists(instDir)) return;

    for (const auto& entry : std::filesystem::directory_iterator(instDir)) {
        if (!entry.is_regular_file()) continue;
        std::string ext = entry.path().extension().string();
        std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
        if (ext != ".wav") continue;

        std::string filename = entry.path().stem().string();
        int rootNote = 60;
        int loKey = 0, hiKey = 127;
        int loVel = 0, hiVel = 127;

        size_t pos = filename.find("_n");
        if (pos != std::string::npos) {
            try {
                rootNote = std::stoi(filename.substr(pos + 2));
                loKey = std::max(0, rootNote - 6);
                hiKey = std::min(127, rootNote + 6);
            } catch (...) {}
        }

        pos = filename.find("_v");
        if (pos != std::string::npos) {
            try {
                int vel = std::stoi(filename.substr(pos + 2));
                loVel = std::max(0, vel - 32);
                hiVel = std::min(127, vel + 32);
            } catch (...) {}
        }

        engine_.loadWavFile(instrument, entry.path().string(), rootNote, loKey, hiKey, loVel, hiVel);
    }
}

Steinberg::tresult PLUGIN_API DagrabaProcessor::setState(Steinberg::IBStream* state) {
    if (!state) return Steinberg::kResultFalse;

    float savedVolume, savedAttack, savedDecay, savedSustain, savedRelease;
    Steinberg::int32 savedInstrument;

    if (state->read(&savedVolume, sizeof(float), nullptr) != Steinberg::kResultOk) return Steinberg::kResultFalse;
    if (state->read(&savedAttack, sizeof(float), nullptr) != Steinberg::kResultOk) return Steinberg::kResultFalse;
    if (state->read(&savedDecay, sizeof(float), nullptr) != Steinberg::kResultOk) return Steinberg::kResultFalse;
    if (state->read(&savedSustain, sizeof(float), nullptr) != Steinberg::kResultOk) return Steinberg::kResultFalse;
    if (state->read(&savedRelease, sizeof(float), nullptr) != Steinberg::kResultOk) return Steinberg::kResultFalse;
    if (state->read(&savedInstrument, sizeof(Steinberg::int32), nullptr) != Steinberg::kResultOk) return Steinberg::kResultFalse;

    paramVolume_ = savedVolume;
    paramAttack_ = savedAttack;
    paramDecay_ = savedDecay;
    paramSustain_ = savedSustain;
    paramRelease_ = savedRelease;
    paramInstrument_ = savedInstrument;

    engine_.setVolume(paramVolume_);
    engine_.setAttack(paramAttack_);
    engine_.setDecay(paramDecay_);
    engine_.setSustain(paramSustain_);
    engine_.setRelease(paramRelease_);
    engine_.setInstrument(paramInstrument_);

    return Steinberg::kResultOk;
}

Steinberg::tresult PLUGIN_API DagrabaProcessor::getState(Steinberg::IBStream* state) {
    if (!state) return Steinberg::kResultFalse;

    state->write(&paramVolume_, sizeof(float), nullptr);
    state->write(&paramAttack_, sizeof(float), nullptr);
    state->write(&paramDecay_, sizeof(float), nullptr);
    state->write(&paramSustain_, sizeof(float), nullptr);
    state->write(&paramRelease_, sizeof(float), nullptr);
    state->write(&paramInstrument_, sizeof(Steinberg::int32), nullptr);

    return Steinberg::kResultOk;
}

}
