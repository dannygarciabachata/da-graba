#pragma once

#define MAJOR_VERSION_STR "1"
#define MAJOR_VERSION_INT 1
#define SUB_VERSION_STR "0"
#define SUB_VERSION_INT 0
#define RELEASE_NUMBER_STR "0"
#define RELEASE_NUMBER_INT 0
#define BUILD_NUMBER_STR "1"
#define BUILD_NUMBER_INT 1

#define FULL_VERSION_STR MAJOR_VERSION_STR "." SUB_VERSION_STR "." RELEASE_NUMBER_STR "." BUILD_NUMBER_STR
#define FULL_VERSION_INT (MAJOR_VERSION_INT << 24 | SUB_VERSION_INT << 16 | RELEASE_NUMBER_INT << 8 | BUILD_NUMBER_INT)

#define stringOriginalFilename "DAGRABA_Sampler.vst3"
#define stringFileDescription "DAGRABA Sampler VST3 Plugin"
#define stringCompanyName "DAGRABA Studio"
#define stringLegalCopyright "(c) 2026 DAGRABA Studio - Danny Garcia"
