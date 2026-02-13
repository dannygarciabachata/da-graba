import { storage } from "../storage";

export async function seedDefaultMusicGPTProvider(): Promise<void> {
  const existing = await storage.getApiProviders();
  if (existing.length > 0) {
    console.log("[Seed] Providers already exist, skipping seed");
    return;
  }

  console.log("[Seed] Seeding default MusicGPT provider configuration...");

  const provider = await storage.createApiProvider({
    name: "MusicGPT",
    baseUrl: "https://api.musicgpt.com/api/public/v1",
    authType: "raw",
    authHeaderName: "Authorization",
    apiKeyEnvVar: "MUSICGPT_API_KEY",
    category: "music",
    isActive: true,
    description: "MusicGPT API - AI music generation, stem separation, mastering, and audio processing",
  });

  const endpoints = [
    {
      name: "Music Generation",
      operationType: "music_generation",
      path: "/MusicAI",
      method: "POST",
      contentType: "json",
      requestMapping: {
        prompt: "$prompt",
        music_style: "$music_style",
        lyrics: "$lyrics",
        output_length: "$output_length",
        make_instrumental: "$make_instrumental",
        vocal_only: "$vocal_only",
        webhook_url: "$webhook_url",
      },
      responseMapping: { taskId: "task_id", eta: "eta" },
      pollPath: "/byId",
      conversionType: "MUSIC_AI",
      asyncPattern: "polling",
      webhookSupported: true,
      description: "Generate music from text prompts with lyrics and style control",
    },
    {
      name: "Stem Separation",
      operationType: "stem_separation",
      path: "/Extraction",
      method: "POST",
      contentType: "formdata",
      requestMapping: { audio_url: "$audio_url", stems: "$stems" },
      responseMapping: { taskId: "task_id" },
      pollPath: "/byId",
      conversionType: "EXTRACTION",
      asyncPattern: "polling",
      description: "Separate audio into vocals, drums, bass, and instrumental stems",
    },
    {
      name: "AI Remix",
      operationType: "remix",
      path: "/Remix",
      method: "POST",
      contentType: "formdata",
      requestMapping: { audio_url: "$audio_url", prompt: "$prompt" },
      responseMapping: { taskId: "task_id" },
      pollPath: "/byId",
      conversionType: "REMIX",
      asyncPattern: "polling",
      description: "Transform audio with AI remix (humming-to-music)",
    },
    {
      name: "Audio Mastering",
      operationType: "mastering",
      path: "/audio_mastering",
      method: "POST",
      contentType: "formdata",
      requestMapping: { audio_url: "$audio_url", reference_audio_url: "$reference_audio_url" },
      responseMapping: { taskId: "task_id" },
      pollPath: "/byId",
      conversionType: "AUDIO_MASTERING",
      asyncPattern: "polling",
      description: "Professional audio mastering",
    },
    {
      name: "Audio Denoise",
      operationType: "denoise",
      path: "/denoise",
      method: "POST",
      contentType: "formdata",
      requestMapping: { audio_url: "$audio_url" },
      responseMapping: { taskId: "task_id" },
      pollPath: "/byId",
      conversionType: "DENOISING",
      asyncPattern: "polling",
      description: "AI-powered noise removal",
    },
    {
      name: "Key/BPM Detection",
      operationType: "key_bpm",
      path: "/extract_key_bpm",
      method: "POST",
      contentType: "formdata",
      requestMapping: { audio_url: "$audio_url" },
      responseMapping: { taskId: "task_id" },
      pollPath: "/byId",
      pollResponseMapping: {
        dominantKey: "conversion.dominant_key",
        bpm: "conversion.bpm",
        keyChanges: "conversion.key_changes",
      },
      conversionType: "KEY_BPM_EXTRACTION",
      asyncPattern: "polling",
      description: "Detect musical key and BPM from audio",
    },
    {
      name: "AI Cover",
      operationType: "cover",
      path: "/Cover",
      method: "POST",
      contentType: "formdata",
      requestMapping: { audio_url: "$audio_url", voice_id: "$voice_id", pitch: "$pitch" },
      responseMapping: { taskId: "task_id" },
      pollPath: "/byId",
      conversionType: "COVER",
      asyncPattern: "polling",
      description: "Generate cover songs with voice change",
    },
    {
      name: "Audio Cutter",
      operationType: "audio_cut",
      path: "/audio_cutter",
      method: "POST",
      contentType: "formdata",
      requestMapping: {
        audio_url: "$audio_url",
        start_time: "$start_time",
        end_time: "$end_time",
        output_extension: "$output_extension",
      },
      responseMapping: { taskId: "task_id" },
      pollPath: "/byId",
      pollResponseMapping: { outputFile: "conversion.output_file" },
      conversionType: "AUDIO_CUTTER",
      asyncPattern: "polling",
      description: "Trim audio to specific time range",
    },
  ];

  for (const ep of endpoints) {
    await storage.createApiEndpoint({
      providerId: provider.id,
      ...ep,
    } as any);
    console.log(`[Seed] Created endpoint: ${ep.name}`);
  }

  console.log(`[Seed] Default MusicGPT provider seeded with ${endpoints.length} endpoints`);

  await seedDgbRunPodProvider();
}

export async function seedDgbRunPodProvider(): Promise<void> {
  const existing = await storage.getApiProviders();
  const hasDgb = existing.some(p => p.name === "DGB Cloud Engine" || p.name === "DGB Audio RunPod");
  if (hasDgb) {
    console.log("[Seed] DGB Cloud Engine provider already exists, skipping");
    return;
  }

  if (!process.env.DGB_API_KEY || !process.env.RUNPOD_BASE_URL) {
    console.log("[Seed] DGB_API_KEY or RUNPOD_BASE_URL not set, skipping DGB Cloud Engine seed");
    return;
  }

  const gpuBase = (process.env.RUNPOD_BASE_URL || "").replace(/\/lab\/.*$/, "").replace(/\/$/, "");
  const apiBase = gpuBase.replace(/:8888$/, ":7860").replace(/-8888\./, "-7860.");

  console.log("[Seed] Seeding DGB Cloud Engine provider...");

  const provider = await storage.createApiProvider({
    name: "DGB Cloud Engine",
    baseUrl: apiBase,
    authType: "header",
    authHeaderName: "X-DGB-API-Key",
    apiKeyEnvVar: "DGB_API_KEY",
    category: "music",
    isActive: true,
    description: "DGB Audio private cloud GPU engine. Handles instrument kit processing, audio analysis, and MIDI conversion.",
  });

  const dgbEndpoints = [
    {
      name: "Upload Instrument",
      operationType: "instrument_upload",
      path: "/api/upload-instrument",
      method: "POST",
      contentType: "formdata",
      requestMapping: {
        audio: "$audio_file",
        instrumentId: "$instrument_id",
        kitId: "$kit_id",
        instrumentName: "$instrument_name",
        webhookUrl: "$webhook_url",
      },
      responseMapping: { status: "status", instrumentId: "instrumentId" },
      asyncPattern: "webhook",
      webhookSupported: true,
      description: "Upload instrument audio to cloud GPU for analysis and MIDI conversion",
    },
    {
      name: "Audio Analysis",
      operationType: "audio_analysis",
      path: "/api/analyze-audio",
      method: "POST",
      contentType: "formdata",
      requestMapping: { audio: "$audio_file" },
      responseMapping: {
        key: "key",
        bpm: "bpm",
        energy: "energy",
        durationMs: "durationMs",
        tags: "tags",
      },
      asyncPattern: "sync",
      description: "Analyze audio for key, BPM, energy, and musical tags using librosa",
    },
    {
      name: "MIDI Conversion",
      operationType: "midi_conversion",
      path: "/api/convert-midi",
      method: "POST",
      contentType: "formdata",
      requestMapping: { audio: "$audio_file" },
      responseMapping: { midiBase64: "midiBase64", midiSize: "midiSize" },
      asyncPattern: "sync",
      description: "Convert audio to MIDI instrument using basic-pitch AI",
    },
  ];

  for (const ep of dgbEndpoints) {
    await storage.createApiEndpoint({
      providerId: provider.id,
      ...ep,
    } as any);
    console.log(`[Seed] Created DGB endpoint: ${ep.name}`);
  }

  console.log(`[Seed] DGB Cloud Engine provider seeded with ${dgbEndpoints.length} endpoints`);
}
