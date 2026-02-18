#pragma once

#include "public.sdk/source/vst/vsteditcontroller.h"
#include "dag_ids.h"

namespace Dagraba {

class DagrabaController : public Steinberg::Vst::EditController {
public:
    static Steinberg::FUnknown* createInstance(void*) {
        return static_cast<Steinberg::Vst::IEditController*>(new DagrabaController());
    }

    Steinberg::tresult PLUGIN_API initialize(Steinberg::FUnknown* context) override;
    Steinberg::tresult PLUGIN_API setComponentState(Steinberg::IBStream* state) override;
};

}
