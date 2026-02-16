import { storage } from "../storage";
import { db } from "../db";
import { discographyAlbums, discographyTracks, artistProfiles } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDefaultMusicGPTProvider(): Promise<void> {
  const existing = await storage.getApiProviders();
  if (existing.length > 0) {
    console.log("[Seed] Providers already exist, skipping seed");
    return;
  }

  console.log("[Seed] Seeding default DGB AUDIO Audio Engine configuration...");

  const provider = await storage.createApiProvider({
    name: "DGB AUDIO Audio Engine",
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

  console.log(`[Seed] DGB AUDIO Audio Engine seeded with ${endpoints.length} endpoints`);

  await seedDgbRunPodProvider();
}

export async function seedDgbRunPodProvider(): Promise<void> {
  const existing = await storage.getApiProviders();
  const hasDgb = existing.some(p =>
    p.name === "DGB Cloud Engine" || p.name === "DGB Audio RunPod" ||
    p.name === "Heart Mula Cloud Engine" || p.name === "DGB AUDIO Cloud Engine"
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

  console.log("[Seed] Seeding DGB AUDIO Cloud Engine provider...");

  const provider = await storage.createApiProvider({
    name: "DGB AUDIO Cloud Engine",
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

  console.log(`[Seed] DGB AUDIO Cloud Engine seeded with ${dgbEndpoints.length} endpoints`);
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

export async function seedKieProvider(): Promise<void> {
  const existing = await storage.getApiProviders();
  const hasKie = existing.some(p => p.name === "Kie.ai" || p.name === "Kie AI");
  if (hasKie) {
    console.log("[Seed] Kie.ai provider already exists, skipping");
    return;
  }

  if (!process.env.KIE_API_KEY) {
    console.log("[Seed] KIE_API_KEY not set, skipping Kie.ai seed");
    return;
  }

  console.log("[Seed] Seeding Kie.ai provider...");

  const provider = await storage.createApiProvider({
    name: "Kie.ai",
    baseUrl: "https://api.kie.ai/api/v1",
    authType: "bearer",
    authHeaderName: "Authorization",
    apiKeyEnvVar: "KIE_API_KEY",
    category: "music",
    isActive: true,
    description: "Suno V5 music generation via Kie.ai. ~$0.06/song. Supports vocals, custom lyrics, stem separation.",
    priority: 10,
    adapterKey: "kie_music",
  });

  const kieEndpoints = [
    {
      name: "Music Generation (Kie.ai Suno V5)",
      operationType: "music_generation",
      path: "/generate",
      method: "POST",
      contentType: "json",
      requestMapping: {
        prompt: "$prompt",
        model: "V5",
        customMode: true,
        style: "$style",
        title: "$title",
        instrumental: "$instrumental",
        vocalGender: "$vocalGender",
      },
      responseMapping: { taskId: "data.taskId" },
      pollPath: "/generate/record-info?taskId={taskId}",
      pollMethod: "GET",
      pollResponseMapping: {
        status: "data.status",
        audioUrl: "data.response.sunoData.0.audio_url",
      },
      asyncPattern: "polling",
      webhookSupported: true,
      callbackUrlTemplate: "https://{domain}/api/kie/callback",
      successStatuses: ["SUCCESS", "FIRST_SUCCESS"],
      failStatuses: ["FAILED", "ERROR"],
      description: "Generate songs with Suno V5 model. Supports lyrics, custom mode, vocal gender selection.",
    },
    {
      name: "Stem Separation (Kie.ai)",
      operationType: "stem_separation",
      path: "/vocal-removal/generate",
      method: "POST",
      contentType: "json",
      requestMapping: {
        taskId: "$kieTaskId",
        audioId: "$kieAudioId",
        type: "split_stem",
      },
      responseMapping: { taskId: "data.taskId" },
      pollPath: "/generate/record-info?taskId={taskId}",
      pollMethod: "GET",
      asyncPattern: "callback",
      webhookSupported: true,
      callbackUrlTemplate: "https://{domain}/api/kie/stems-callback",
      successStatuses: ["SUCCESS", "COMPLETE", "COMPLETED"],
      failStatuses: ["FAILED", "ERROR"],
      description: "Split audio into vocals, drums, bass, and other stems via Kie.ai vocal removal API.",
    },
  ];

  for (const ep of kieEndpoints) {
    await storage.createApiEndpoint({
      providerId: provider.id,
      ...ep,
    } as any);
    console.log(`[Seed] Created Kie.ai endpoint: ${ep.name}`);
  }

  console.log(`[Seed] Kie.ai provider seeded with ${kieEndpoints.length} endpoints`);
}

export async function seedReplicateStemsProvider(): Promise<void> {
  const existing = await storage.getApiProviders();
  const hasReplicateStems = existing.some(p => p.name === "Replicate Stems" || p.adapterKey === "replicate_stems");
  if (hasReplicateStems) {
    console.log("[Seed] Replicate Stems provider already exists, skipping");
    return;
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    console.log("[Seed] REPLICATE_API_TOKEN not set, skipping Replicate Stems seed");
    return;
  }

  console.log("[Seed] Seeding Replicate Stems provider...");

  const provider = await storage.createApiProvider({
    name: "Replicate Stems",
    baseUrl: "https://api.replicate.com/v1",
    authType: "bearer",
    authHeaderName: "Authorization",
    apiKeyEnvVar: "REPLICATE_API_TOKEN",
    category: "music",
    isActive: true,
    description: "Serverless GPU stem separation using Demucs model on Replicate.",
    priority: 30,
    adapterKey: "replicate_stems",
  });

  await storage.createApiEndpoint({
    providerId: provider.id,
    name: "Stem Separation (Demucs)",
    operationType: "stem_separation",
    path: "/predictions",
    method: "POST",
    contentType: "json",
    requestMapping: {
      "version": "07afda2a068a69bafe901cd1e6a41e5e6e1c8fe8b101c89eb06488e7e38e1d56",
      "input.audio": "$audioUrl",
    },
    responseMapping: { taskId: "id" },
    asyncPattern: "none",
    webhookSupported: false,
    successStatuses: ["succeeded"],
    description: "Separate audio into vocals, drums, bass, other using Demucs on Replicate.",
  } as any);

  console.log("[Seed] Replicate Stems provider seeded");
}

export async function updateProviderPriorities(): Promise<void> {
  const providers = await storage.getApiProviders();

  const priorityMap: Record<string, { priority: number; adapterKey?: string }> = {
    "Kie.ai": { priority: 10, adapterKey: "kie_music" },
    "Kie AI": { priority: 10, adapterKey: "kie_music" },
    "Replicate Stems": { priority: 30, adapterKey: "replicate_stems" },
    "Replicate": { priority: 40 },
    "Replicate AI": { priority: 40 },
    "Mureka AI": { priority: 60 },
    "DGB AUDIO Audio Engine": { priority: 80 },
    "DGB AUDIO Cloud Engine": { priority: 50 },
  };

  for (const provider of providers) {
    const config = priorityMap[provider.name];
    if (config && (provider.priority !== config.priority || provider.adapterKey !== config.adapterKey)) {
      try {
        await storage.updateApiProvider(provider.id, {
          priority: config.priority,
          adapterKey: config.adapterKey || provider.adapterKey,
        });
        console.log(`[Seed] Updated ${provider.name}: priority=${config.priority}, adapter=${config.adapterKey || "none"}`);
      } catch {
        console.log(`[Seed] Could not update priority for ${provider.name}`);
      }
    }
  }
}

export async function seedTrainingKits(): Promise<void> {
  const existingKits = await storage.getStyleKits();

  const bachatKit = existingKits.find(k => k.name === "Bachata" && k.genre === "bachata");
  const boleroKit = existingKits.find(k => k.name === "Baladas Boleros" && k.genre === "bolero");
  const dgbBoleroKit = existingKits.find(k => k.name === "DGB Bolero" && k.genre === "dgb_bolero");

  if (bachatKit && boleroKit && dgbBoleroKit) {
    console.log("[Seed] Training kits (Bachata, Baladas Boleros, DGB Bolero) already exist, skipping");
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

  if (!dgbBoleroKit) {
    const kit = await storage.createStyleKit({
      name: "DGB Bolero",
      genre: "dgb_bolero",
      description: "Orquesta completa DGB Bolero — el ADN de Danny Garcia: bongó, conga, güira, timbal completo, campanas, segunda guitarra, requinto, bajo, piano, pad, strings, violines, chelos, voz principal, dúo de voz, y coros femenino/masculino con armonías completas.",
      createdBy: "system",
    });
    const dgbBoleroInstruments = [
      { name: "Bongó", type: "bongo", description: "Bongó — percusión rítmica fundamental del DGB Bolero", position: 1 },
      { name: "Conga", type: "conga", description: "Conga — golpes y slaps para el groove del bolero DGB", position: 2 },
      { name: "Güira", type: "guira", description: "Güira metálica — ritmo constante, marca registrada DGB", position: 3 },
      { name: "Timbal Completo", type: "timbal", description: "Timbal completo con pailas — ritmo y fills del bolero DGB", position: 4 },
      { name: "Campanas", type: "campana", description: "Campanas de timbal — acentos rítmicos y transiciones", position: 5 },
      { name: "Requinto", type: "requinto", description: "Requinto — melodía principal y punteos románticos DGB", position: 6 },
      { name: "Segunda Guitarra", type: "segunda_guitarra", description: "Segunda guitarra — acompañamiento armónico y rasgueo", position: 7 },
      { name: "Bajo", type: "bass", description: "Bajo eléctrico — línea grave y walking bass del bolero", position: 8 },
      { name: "Piano", type: "piano", description: "Piano — montunos, acordes y arreglos armónicos", position: 9 },
      { name: "Pad", type: "pad", description: "Pad sintetizado — colchón armónico y atmósfera", position: 10 },
      { name: "Strings (Violines)", type: "strings", description: "Sección de violines — arreglos melódicos y contrapuntos", position: 11 },
      { name: "Strings (Chelos)", type: "strings", description: "Sección de chelos — base armónica y profundidad orquestal", position: 12 },
      { name: "Voz Principal", type: "vocal", description: "Voz principal — melodía vocal líder del bolero", position: 13 },
      { name: "Dúo de Voz", type: "vocal", description: "Dúo de voz — armonía vocal a dos voces", position: 14 },
      { name: "Coros", type: "choir", description: "Coros estéreo — armonías completas femeninas y masculinas, el training identifica los géneros automáticamente", position: 15 },
    ];
    for (const instr of dgbBoleroInstruments) {
      await storage.createStyleKitInstrument({ kitId: kit.id, ...instr, volume: 100, uploadStatus: "pending", analysisStatus: "pending" });
    }
    console.log(`[Seed] Created DGB Bolero kit (id=${kit.id}) with ${dgbBoleroInstruments.length} instruments`);
  }
}

export async function seedDiscography(): Promise<void> {
  const existingAlbums = await db.select().from(discographyAlbums).limit(1);
  if (existingAlbums.length > 0) {
    console.log("[Seed] Discography already exists, skipping");
    return;
  }

  const dgbProfiles = await db.select().from(artistProfiles).where(eq(artistProfiles.artistName, "Danny Garcia Bachata")).limit(1);
  let dgbArtistId: number;
  if (dgbProfiles.length > 0) {
    dgbArtistId = dgbProfiles[0].id;
  } else {
    const [profile] = await db.insert(artistProfiles).values({
      userId: "dgb_founder",
      artistName: "Danny Garcia Bachata",
      bio: "Artista dominicano de Bachata, musico y visionario tecnologico. Fundador de DGB Studio. Nacido y criado en la Republica Dominicana, cuna de la musica Bachata. Danny lleva el ADN autentico de la musica dominicana en su sangre — la pura sangre de la Bachata. Su mision es democratizar la creacion musical con inteligencia artificial, preservando las raices autenticas y el alma de la musica dominicana y latina.",
      genre: "Bachata",
      country: "Dominican Republic",
      website: "https://dgbstudio.com",
      socialLinks: { spotify: "https://open.spotify.com/artist/danny-garcia-bachata", apple_music: "https://music.apple.com/us/artist/danny-garcia", youtube: "https://youtube.com/@dannygarciamusic", deezer: "https://www.deezer.com/us/artist/119140" },
      isVerified: true,
      isActive: true,
      artistType: "singer",
      onboardingCompleted: true,
    }).returning();
    dgbArtistId = profile.id;
  }

  const [historiaAlbum] = await db.insert(discographyAlbums).values({
    artistId: dgbArtistId,
    title: "Historia De Amor",
    albumType: "album",
    releaseDate: "2021",
    genre: "Bachata",
    tracksCount: 24,
    description: "El album debut de Danny Garcia Bachata — 24 canciones de bachata romantica que capturan la esencia del amor, la pasion y la vida dominicana. Un viaje musical desde el corazon de la Republica Dominicana.",
    spotifyUrl: "https://open.spotify.com/search/Danny%20Garcia%20Bachata%20Historia%20De%20Amor",
    appleMusicUrl: "https://music.apple.com/us/artist/danny-garc%C3%ADa/4004931",
    deezerUrl: "https://www.deezer.com/us/album/815790951",
    isPublished: true,
  }).returning();

  const historiaTracks = [
    "Historia De Amor", "Me Marcho Lejos", "Falsa Mujer", "Quien Te Hizo Cambiar",
    "Por Ella", "Amor Prohibido", "No Me Dejes Solo", "Corazon Partido",
    "Bachata De La Vida", "Mi Guitarra Llora", "Noches De Luna", "Suenos De Amor",
    "Lagrimas En La Arena", "Bailando Bajo Las Estrellas", "Tu Recuerdo", "El Ultimo Beso",
    "Perdoname", "Amor Eterno", "Caminos Del Destino", "Serenata Nocturna",
    "Entre Tu Y Yo", "Corazon Salvaje", "Mi Razon De Ser", "Hasta El Final"
  ];
  await db.insert(discographyTracks).values(
    historiaTracks.map((title, i) => ({
      albumId: historiaAlbum.id,
      title,
      trackNumber: i + 1,
      durationSeconds: 180 + Math.floor(Math.random() * 120),
    }))
  );

  const [echosSingle] = await db.insert(discographyAlbums).values({
    artistId: dgbArtistId,
    title: "Echoes of Love / Ecos de Amor",
    albumType: "single",
    releaseDate: "2024-02-14",
    genre: "Bachata",
    tracksCount: 1,
    description: "Lanzado el Dia de San Valentin 2024 en ODGmusic Records. Una bachata romantica bilingue que fusiona el sonido tradicional dominicano con produccion moderna.",
    isPublished: true,
  }).returning();
  await db.insert(discographyTracks).values({
    albumId: echosSingle.id,
    title: "Ecos de Amor (Echoes of Love)",
    trackNumber: 1,
    durationSeconds: 240,
  });

  const [porEllaSingle] = await db.insert(discographyAlbums).values({
    artistId: dgbArtistId,
    title: "Por Ella",
    albumType: "single",
    releaseDate: "2022",
    genre: "Bachata",
    tracksCount: 1,
    description: "Colaboracion especial con Memin El Sucesor. Una bachata dedicada a ese amor que lo cambia todo.",
    isPublished: true,
  }).returning();
  await db.insert(discographyTracks).values({
    albumId: porEllaSingle.id,
    title: "Por Ella (feat. Memin El Sucesor)",
    trackNumber: 1,
    featuring: "Memin El Sucesor",
    durationSeconds: 220,
  });

  console.log("[Seed] DGB discography seeded: Historia De Amor + 2 singles");
}
