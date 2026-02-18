cmake_minimum_required(VERSION 3.14.0)

set(CMAKE_OSX_DEPLOYMENT_TARGET 10.13 CACHE STRING "")

project(DAGRABA_Sampler
    VERSION 1.0.0.1
    DESCRIPTION "DAGRABA Sampler VST3 Plugin - La Pura Sangre de la Bachata"
)

set(SMTG_VSTGUI_ROOT "${vst3sdk_SOURCE_DIR}")

add_subdirectory(${vst3sdk_SOURCE_DIR} ${PROJECT_BINARY_DIR}/vst3sdk)

smtg_enable_vst3_sdk()

set(target DAGRABA_Sampler)

smtg_add_vst3plugin(${target}
    source/dag_factory.cpp
    source/dag_processor.cpp
    source/dag_processor.h
    source/dag_controller.cpp
    source/dag_controller.h
    source/dag_sampler_engine.h
    source/dag_ids.h
    source/version.h
)

target_compile_features(${target} PRIVATE cxx_std_17)

target_link_libraries(${target}
    PRIVATE
        sdk
)

if(SMTG_MAC)
    smtg_target_set_bundle(${target}
        BUNDLE_IDENTIFIER "studio.dagraba.sampler"
        COMPANY_NAME "DAGRABA Studio"
    )
elseif(SMTG_LINUX)
    target_link_libraries(${target} PRIVATE stdc++fs)
endif()
