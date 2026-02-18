#include "public.sdk/source/main/pluginfactory.h"
#include "dag_processor.h"
#include "dag_controller.h"
#include "dag_ids.h"
#include "version.h"

#define stringPluginName "DAGRABA Sampler"

BEGIN_FACTORY_DEF(
    "DAGRABA Studio",
    "https://dagraba.studio",
    "mailto:info@dagraba.studio")

    DEF_CLASS2(
        INLINE_UID_FROM_FUID(Dagraba::kDagrabaProcessorUID),
        PClassInfo::kManyInstances,
        kVstAudioEffectClass,
        stringPluginName,
        Steinberg::Vst::kDistributable,
        Steinberg::Vst::PlugType::kInstrumentSynth,
        FULL_VERSION_STR,
        kVstVersionString,
        Dagraba::DagrabaProcessor::createInstance)

    DEF_CLASS2(
        INLINE_UID_FROM_FUID(Dagraba::kDagrabaControllerUID),
        PClassInfo::kManyInstances,
        kVstComponentControllerClass,
        stringPluginName " Controller",
        0,
        "",
        FULL_VERSION_STR,
        kVstVersionString,
        Dagraba::DagrabaController::createInstance)

END_FACTORY
