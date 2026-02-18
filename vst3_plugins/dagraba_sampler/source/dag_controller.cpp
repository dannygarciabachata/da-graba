#include "dag_controller.h"
#include "pluginterfaces/base/ibstream.h"

namespace Dagraba {

Steinberg::tresult PLUGIN_API DagrabaController::initialize(Steinberg::FUnknown* context) {
    auto result = EditController::initialize(context);
    if (result != Steinberg::kResultOk) return result;

    parameters.addParameter(
        STR16("Volume"), STR16("%"), 0, 0.8,
        Steinberg::Vst::ParameterInfo::kCanAutomate, kParamVolume);

    parameters.addParameter(
        STR16("Attack"), STR16("s"), 0, 0.005,
        Steinberg::Vst::ParameterInfo::kCanAutomate, kParamAttack);

    parameters.addParameter(
        STR16("Decay"), STR16("s"), 0, 0.05,
        Steinberg::Vst::ParameterInfo::kCanAutomate, kParamDecay);

    parameters.addParameter(
        STR16("Sustain"), STR16("%"), 0, 0.8,
        Steinberg::Vst::ParameterInfo::kCanAutomate, kParamSustain);

    parameters.addParameter(
        STR16("Release"), STR16("s"), 0, 0.06,
        Steinberg::Vst::ParameterInfo::kCanAutomate, kParamRelease);

    auto* instParam = new Steinberg::Vst::StringListParameter(
        STR16("Instrument"), kParamInstrument,
        nullptr, Steinberg::Vst::ParameterInfo::kIsProgramChange | Steinberg::Vst::ParameterInfo::kCanAutomate);

    for (int i = 0; i < kNumInstruments; ++i) {
        Steinberg::String128 name;
        Steinberg::UString(name, 128).fromAscii(kInstrumentNames[i]);
        instParam->appendString(name);
    }

    parameters.addParameter(instParam);

    return Steinberg::kResultOk;
}

Steinberg::tresult PLUGIN_API DagrabaController::setComponentState(Steinberg::IBStream* state) {
    if (!state) return Steinberg::kResultFalse;

    float volume, attack, decay, sustain, release;
    Steinberg::int32 instrument;

    if (state->read(&volume, sizeof(float), nullptr) != Steinberg::kResultOk) return Steinberg::kResultFalse;
    if (state->read(&attack, sizeof(float), nullptr) != Steinberg::kResultOk) return Steinberg::kResultFalse;
    if (state->read(&decay, sizeof(float), nullptr) != Steinberg::kResultOk) return Steinberg::kResultFalse;
    if (state->read(&sustain, sizeof(float), nullptr) != Steinberg::kResultOk) return Steinberg::kResultFalse;
    if (state->read(&release, sizeof(float), nullptr) != Steinberg::kResultOk) return Steinberg::kResultFalse;
    if (state->read(&instrument, sizeof(Steinberg::int32), nullptr) != Steinberg::kResultOk) return Steinberg::kResultFalse;

    setParamNormalized(kParamVolume, volume);
    setParamNormalized(kParamAttack, attack / 2.0);
    setParamNormalized(kParamDecay, decay / 2.0);
    setParamNormalized(kParamSustain, sustain);
    setParamNormalized(kParamRelease, release / 5.0);
    setParamNormalized(kParamInstrument,
        static_cast<double>(instrument) / (kNumInstruments - 1));

    return Steinberg::kResultOk;
}

}
