import { storage } from "../storage";

export async function seedDefaultMusicGPTProvider(): Promise<void> {
  const existing = await storage.getApiProviders();
  if (existing.length > 0) {
    console.log("[Seed] Providers already exist, skipping seed");
    return;
  }

  console.log("[Seed] Seeding default DGB STUDIO Audio Engine configuration...");

  const provider = await storage.createApiProvider({
    name: "DGB STUDIO Audio Engine",
    baseUrl: "https://api.musicgpt.com/api/public/v1",
    authType: "raw",
    authHeaderName: "Authorization",
    apiKeyEnvVar: "MUSICGPT_API_KEY",
    category: "music",
    isActive: true,
    description: "Primary audio processing engine - AI music generation, stem separation, mastering, and audio tools",
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

  console.log(`[Seed] DGB STUDIO Audio Engine seeded with ${endpoints.length} endpoints`);

  await seedDgbRunPodProvider();
}

export async function seedDgbRunPodProvider(): Promise<void> {
  const existing = await storage.getApiProviders();
  const hasDgb = existing.some(p =>
    p.name === "DGB Cloud Engine" || p.name === "DGB Audio RunPod" ||
    p.name === "Heart Mula Cloud Engine" || p.name === "DGB Studio Cloud Engine"
  );
  if (hasDgb) {
    console.log("[Seed] Cloud Engine provider already exists, skipping");
    return;
  }

  if (!process.env.DGB_API_KEY || !process.env.RUNPOD_BASE_URL) {
    console.log("[Seed] DGB_API_KEY or RUNPOD_BASE_URL not set, skipping Cloud Engine seed");
    return;
  }

  const gpuBase = (process.env.RUNPOD_BASE_URL || "").replace(/\/lab\/.*$/, "").replace(/\/$/, "");
  const apiBase = gpuBase.replace(/:8888$/, ":7860").replace(/-8888\./, "-7860.");

  console.log("[Seed] Seeding DGB Studio Cloud Engine provider...");

  const provider = await storage.createApiProvider({
    name: "DGB Studio Cloud Engine",
    baseUrl: apiBase,
    authType: "header",
    authHeaderName: "X-DGB-API-Key",
    apiKeyEnvVar: "DGB_API_KEY",
    category: "music",
    isActive: true,
    description: "Private cloud GPU engine for instrument processing, audio analysis, and MIDI conversion",
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
      description: "Upload instrument audio for analysis and MIDI conversion",
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
      description: "Analyze audio for key, BPM, energy, and musical tags",
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
      description: "Convert audio to MIDI instrument data",
    },
  ];

  for (const ep of dgbEndpoints) {
    await storage.createApiEndpoint({
      providerId: provider.id,
      ...ep,
    } as any);
    console.log(`[Seed] Created Cloud endpoint: ${ep.name}`);
  }

  console.log(`[Seed] DGB Studio Cloud Engine seeded with ${dgbEndpoints.length} endpoints`);
}

export async function seedMurekaProvider(): Promise<void> {
  const existing = await storage.getApiProviders();
  const hasMureka = existing.some(p =>
    p.name === "Mureka" || p.name === "Mureka AI"
  );
  if (hasMureka) {
    console.log("[Seed] Mureka provider already exists, skipping");
    return;
  }

  if (!process.env.MUREKA_API_KEY) {
    console.log("[Seed] MUREKA_API_KEY not set, skipping Mureka seed");
    return;
  }

  console.log("[Seed] Seeding Mureka AI provider...");

  const provider = await storage.createApiProvider({
    name: "Mureka AI",
    baseUrl: "https://api.mureka.ai/v1",
    authType: "bearer",
    authHeaderName: "Authorization",
    apiKeyEnvVar: "MUREKA_API_KEY",
    category: "music",
    isActive: true,
    description: "Professional AI music generation with vocals, lyrics, and multi-language support. Produces studio-quality songs in Bachata, Bolero, Salsa, and 50+ genres.",
  });

  const murekaEndpoints = [
    {
      name: "Song Generation (Mureka)",
      operationType: "music_generation",
      path: "/song/generate",
      method: "POST",
      contentType: "json",
      requestMapping: {
        "prompt": "$prompt",
        "lyrics": "$lyrics",
        "model": "auto",
      },
      responseMapping: { taskId: "id", status: "status" },
      pollPath: "/song/query/{taskId}",
      pollMethod: "GET",
      pollResponseMapping: {
        status: "status",
        audioUrl: "songs.0.mp3_url",
        imageUrl: "songs.0.cover_url",
      },
      asyncPattern: "polling",
      webhookSupported: false,
      description: "Generate complete songs with vocals and lyrics using Mureka AI. Supports Spanish, English, and 10+ languages.",
    },
  ];

  for (const ep of murekaEndpoints) {
    await storage.createApiEndpoint({
      providerId: provider.id,
      ...ep,
    } as any);
    console.log(`[Seed] Created Mureka endpoint: ${ep.name}`);
  }

  console.log(`[Seed] Mureka AI provider seeded with ${murekaEndpoints.length} endpoint(s)`);
}

export async function seedReplicateProvider(): Promise<void> {
  const existing = await storage.getApiProviders();
  const hasReplicate = existing.some(p =>
    p.name === "Replicate" || p.name === "Replicate AI"
  );
  if (hasReplicate) {
    console.log("[Seed] Replicate provider already exists, skipping");
    return;
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    console.log("[Seed] REPLICATE_API_TOKEN not set, skipping Replicate seed");
    return;
  }

  console.log("[Seed] Seeding Replicate AI provider...");

  const provider = await storage.createApiProvider({
    name: "Replicate",
    baseUrl: "https://api.replicate.com/v1",
    authType: "bearer",
    authHeaderName: "Authorization",
    apiKeyEnvVar: "REPLICATE_API_TOKEN",
    category: "music",
    isActive: true,
    description: "Serverless GPU platform - stem separation (Demucs) and music generation (MusicGen). Pay-per-use, no server to maintain.",
  });

  const replicateEndpoints = [
    {
      name: "Stem Separation (Demucs)",
      operationType: "stem_separation",
      path: "/predictions",
      method: "POST",
      contentType: "json",
      requestMapping: {
        "version": "25a173108cff36ef9f80f854c162d01df9e6528be175794b81571f6e0feadce7",
        "input.audio": "$audio_url",
        "input.model": "htdemucs",
        "input.stem": "all",
        "input.mp3": true,
        "input.mp3_bitrate": 320,
        "input.shifts": 1,
        "input.overlap": 0.25,
      },
      responseMapping: { taskId: "id", status: "status" },
      pollPath: "/predictions/{taskId}",
      pollMethod: "GET",
      pollResponseMapping: {
        status: "status",
        audioUrl: "output",
      },
      asyncPattern: "polling",
      webhookSupported: false,
      description: "Separate audio into vocals, drums, bass, and other stems using Demucs htdemucs model (~$0.01-0.05/song)",
    },
    {
      name: "Music Generation (MusicGen)",
      operationType: "music_generation",
      path: "/predictions",
      method: "POST",
      contentType: "json",
      requestMapping: {
        "version": "b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38",
        "input.model_version": "stereo-melody-large",
        "input.prompt": "$prompt",
        "input.duration": "$output_length",
        "input.temperature": 1.0,
        "input.top_k": 250,
        "input.top_p": 0.0,
        "input.classifier_free_guidance": 3,
        "input.output_format": "wav",
        "input.normalization_strategy": "loudness",
      },
      responseMapping: { taskId: "id", status: "status" },
      pollPath: "/predictions/{taskId}",
      pollMethod: "GET",
      pollResponseMapping: {
        status: "status",
        audioUrl: "output",
      },
      asyncPattern: "polling",
      webhookSupported: false,
      description: "Generate music from text prompts using Meta MusicGen stereo-large model",
    },
  ];

  for (const ep of replicateEndpoints) {
    await storage.createApiEndpoint({
      providerId: provider.id,
      ...ep,
    } as any);
    console.log(`[Seed] Created Replicate endpoint: ${ep.name}`);
  }

  console.log(`[Seed] Replicate provider seeded with ${replicateEndpoints.length} endpoints`);
}

export async function seedTrainingKits(): Promise<void> {
  const existingKits = await storage.getStyleKits();

  const bachatKit = existingKits.find(k => k.name === "Bachata" && k.genre === "bachata");
  const boleroKit = existingKits.find(k => k.name === "Baladas Boleros" && k.genre === "bolero");

  if (bachatKit && boleroKit) {
    console.log("[Seed] Training kits (Bachata, Baladas Boleros) already exist, skipping");
    return;
  }

  console.log("[Seed] Seeding training orchestras...");

  if (!bachatKit) {
    const kit = await storage.createStyleKit({
      name: "Bachata",
      genre: "bachata",
      description: "Orquesta de bachata dominicana con guitarra requinto, segunda guitarra, bongó, güira y bajo eléctrico. El sonido auténtico de la bachata con el DNA de Danny Garcia.",
      createdBy: "system",
    });
    const bachataInstruments = [
      { name: "Guitarra Requinto", type: "requinto", description: "Guitarra requinto lead - melodía principal y punteos de bachata", position: 1 },
      { name: "Guitarra Segunda", type: "segunda_guitarra", description: "Guitarra rítmica segunda - acompañamiento y rasgueo de bachata", position: 2 },
      { name: "Bongó", type: "bongo", description: "Bongó de bachata - patrón rítmico tradicional dominicano", position: 3 },
      { name: "Güira", type: "guira", description: "Güira metálica - ritmo constante característico de la bachata", position: 4 },
      { name: "Bajo Eléctrico", type: "bass", description: "Bajo eléctrico de bachata - línea de bajo melódica y rítmica", position: 5 },
    ];
    for (const instr of bachataInstruments) {
      await storage.createStyleKitInstrument({ kitId: kit.id, ...instr, volume: 100, uploadStatus: "pending", analysisStatus: "pending" });
    }
    console.log(`[Seed] Created Bachata kit (id=${kit.id}) with ${bachataInstruments.length} instruments`);
  }

  if (!boleroKit) {
    const kit = await storage.createStyleKit({
      name: "Baladas Boleros",
      genre: "bolero",
      description: "Orquesta de baladas y boleros con guitarra clásica nylon, requinto, piano, cuerdas (violines/cello), maracas, congas y bajo acústico. Sonido íntimo y romántico para boleros clásicos.",
      createdBy: "system",
    });
    const boleroInstruments = [
      { name: "Guitarra Clásica Nylon", type: "requinto", description: "Guitarra clásica con cuerdas de nylon - arpegios y melodías suaves de bolero", position: 1 },
      { name: "Requinto Bolero", type: "requinto", description: "Requinto para bolero - punteos delicados y melodías románticas", position: 2 },
      { name: "Piano", type: "piano", description: "Piano acústico - acordes y arreglos armónicos de balada/bolero", position: 3 },
      { name: "Cuerdas", type: "other", description: "Sección de cuerdas (violines, violas, cellos) - arreglos orquestales románticos", position: 4 },
      { name: "Maracas", type: "maracas", description: "Maracas suaves - ritmo delicado para boleros", position: 5 },
      { name: "Congas", type: "conga", description: "Congas - percusión suave para baladas y boleros", position: 6 },
      { name: "Bajo Acústico", type: "bass", description: "Bajo acústico/contrabajo - línea grave y cálida para boleros", position: 7 },
    ];
    for (const instr of boleroInstruments) {
      await storage.createStyleKitInstrument({ kitId: kit.id, ...instr, volume: 100, uploadStatus: "pending", analysisStatus: "pending" });
    }
    console.log(`[Seed] Created Baladas Boleros kit (id=${kit.id}) with ${boleroInstruments.length} instruments`);
  }
}
