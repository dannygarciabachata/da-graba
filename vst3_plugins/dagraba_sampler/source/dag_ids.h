#pragma once

#include "pluginterfaces/base/funknown.h"

namespace Dagraba {

static const Steinberg::FUID kDagrabaProcessorUID(0x44414752, 0x41424153, 0x414D504C, 0x45520001);
static const Steinberg::FUID kDagrabaControllerUID(0x44414752, 0x41424153, 0x414D504C, 0x45520002);

enum ParamIDs : Steinberg::Vst::ParamID {
    kParamVolume = 100,
    kParamAttack = 101,
    kParamDecay = 102,
    kParamSustain = 103,
    kParamRelease = 104,
    kParamInstrument = 200,
};

enum InstrumentPreset : int {
    kRequinto = 0,
    kSegundaGuitarra,
    kBongo,
    kConga,
    kGuira,
    kTimbal,
    kCampanas,
    kBajo,
    kPiano,
    kPad,
    kStringsViolin,
    kStringsCello,
    kNumInstruments
};

static const char* kInstrumentNames[kNumInstruments] = {
    "Requinto",
    "Segunda Guitarra",
    "Bongo",
    "Conga",
    "Guira",
    "Timbal",
    "Campanas",
    "Bajo",
    "Piano",
    "Pad",
    "Strings (Violines)",
    "Strings (Chelos)",
};

}
