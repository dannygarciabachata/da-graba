#pragma once

#include "public.sdk/source/vst/vstaudioeffect.h"
#include "dag_sampler_engine.h"
#include "dag_ids.h"

namespace Dagraba {

class DagrabaProcessor : public Steinberg::Vst::AudioEffect {
public:
    DagrabaProcessor();
    ~DagrabaProcessor() override = default;

    static Steinberg::FUnknown* createInstance(void*) {
        return static_cast<Steinberg::Vst::IAudioProcessor*>(new DagrabaProcessor());
    }

    Steinberg::tresult PLUGIN_API initialize(Steinberg::FUnknown* context) override;
    Steinberg::tresult PLUGIN_API terminate() override;
    Steinberg::tresult PLUGIN_API setActive(Steinberg::TBool state) override;
    Steinberg::tresult PLUGIN_API setupProcessing(Steinberg::Vst::ProcessSetup& newSetup) override;
    Steinberg::tresult PLUGIN_API process(Steinberg::Vst::ProcessData& data) override;
    Steinberg::tresult PLUGIN_API canProcessSampleSize(Steinberg::int32 symbolicSampleSize) override;
    Steinberg::tresult PLUGIN_API setBusArrangements(
        Steinberg::Vst::SpeakerArrangement* inputs, Steinberg::int32 numIns,
        Steinberg::Vst::SpeakerArrangement* outputs, Steinberg::int32 numOuts) override;

    Steinberg::tresult PLUGIN_API setState(Steinberg::IBStream* state) override;
    Steinberg::tresult PLUGIN_API getState(Steinberg::IBStream* state) override;

private:
    SamplerEngine engine_;
    float paramVolume_ = 0.8f;
    float paramAttack_ = 0.01f;
    float paramDecay_ = 0.1f;
    float paramSustain_ = 0.8f;
    float paramRelease_ = 0.3f;
    int paramInstrument_ = 0;
    std::string samplesBasePath_;

    void loadSamplesForInstrument(int instrument);
    void processEvents(Steinberg::Vst::IEventList* events);
    void processParameterChanges(Steinberg::Vst::IParameterChanges* changes);
};

}
