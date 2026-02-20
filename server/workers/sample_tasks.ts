import { storage } from "../storage";
import {
  submitGenericJob, pollGenericJob, downloadFile,
  resolveFullAudioUrl, hasProviderForOperation,
} from "../core/generic_api_engine";
import {
  submitRemix, pollMusicGPTJob, downloadMusicGPTFile,
  resolveFullAudioUrl as musicgptResolve,
  submitMastering, submitDenoise, submitCover,
  submitKeyBPMExtraction, submitAudioCutter,
  submitTTS, submitDeEcho, submitDeReverb,
  submitSoundGenerator, submitTranscription,
  submitAudioSpeedChanger, submitVoiceChanger,
} from "../core/musicgpt_engine";
import {
  canUseKie, submitKieExtend, pollKieTask,
} from "../core/kie_engine";
import { textToSpeech } from "../replit_integrations/audio/client";
import fs from "fs";
import path from "path";

function friendlyError(msg: string, fallback: string): string {
  if (msg.includes("QUOTA_EXCEEDED")) return "AI service credits exhausted. Please contact admin to restore service.";
  if (msg.includes("AUTH_ERROR")) return "AI service authentication failed. Please contact admin.";
  if (msg.includes("No API key configured")) return "AI service not configured. Please contact admin.";
  if (msg.includes("No active endpoint found")) return "This feature is temporarily unavailable. No AI provider is configured for this operation.";
  return fallback;
}

export async function processHummingToMusic(
  sampleId: number,
  audioUrl: string,
  prompt: string,
  duration: number = 15
): Promise<void> {
  try {
    console.log(`[SampleWorker] Starting Remix for sample ${sampleId}`);
    await storage.updateSample(sampleId, { status: "processing" });

    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    const cleanPrompt = prompt.replace(/high fidelity|masterpiece|studio quality/gi, "").replace(/\s+/g, " ").trim().substring(0, 280);

    const useGeneric = await hasProviderForOperation("remix");
    let completed = false;

    if (useGeneric) {
      try {
        const submitResult = await submitGenericJob("remix", {
          audio_url: fullAudioUrl,
          prompt: cleanPrompt,
        });
        const pollResult = await pollGenericJob("remix", submitResult.taskId!, 600000, 8000, submitResult.endpointId);
        if (!pollResult.audioUrl) throw new Error("Remix completed but no audio URL returned");
        const localUrl = await downloadFile(pollResult.audioUrl, "samples", "remix");
        await storage.updateSample(sampleId, { status: "ready", audioUrl: localUrl, sourceType: "ai-transform" });
        completed = true;
      } catch (genErr: any) {
        console.log(`[SampleWorker] Generic API remix failed: ${genErr.message}, trying fallbacks`);
      }
    }

    if (!completed && canUseKie()) {
      try {
        console.log(`[SampleWorker] Using Kie.ai extend for remix`);
        const kieResult = await submitKieExtend(fullAudioUrl, cleanPrompt);
        const pollResult = await pollKieTask(kieResult.taskId, 300000, 10000);
        if (!pollResult.audioUrl) throw new Error("Kie.ai extend completed but no audio URL returned");
        const localUrl = await downloadFile(pollResult.audioUrl, "samples", "remix");
        await storage.updateSample(sampleId, { status: "ready", audioUrl: localUrl, sourceType: "ai-transform" });
        completed = true;
      } catch (kieErr: any) {
        console.log(`[SampleWorker] Kie.ai remix failed: ${kieErr.message}, trying MusicGPT`);
      }
    }

    if (!completed) {
      const submitResult = await submitRemix(fullAudioUrl, cleanPrompt);
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "REMIX");
      if (!pollResult.audioUrl) throw new Error("Remix completed but no audio URL returned");
      const localUrl = await downloadMusicGPTFile(pollResult.audioUrl, "samples", "remix");
      await storage.updateSample(sampleId, { status: "ready", audioUrl: localUrl, sourceType: "ai-transform" });
    }

    console.log(`[SampleWorker] Remix complete for sample ${sampleId}`);
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[SampleWorker] Error for sample ${sampleId}:`, msg);
    await storage.updateSample(sampleId, { status: "failed", error: friendlyError(msg, "AI remix generation failed") });
  }
}

export async function processKeyBPMDetection(
  sampleId: number,
  audioUrl: string
): Promise<void> {
  try {
    console.log(`[SampleWorker] Starting Key/BPM detection for sample ${sampleId}`);
    await storage.updateSample(sampleId, { status: "processing" });

    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    const useGeneric = await hasProviderForOperation("key_bpm");

    let key: string | undefined;
    let bpm: number | undefined;

    if (useGeneric) {
      const submitResult = await submitGenericJob("key_bpm", { audio_url: fullAudioUrl });
      const pollResult = await pollGenericJob("key_bpm", submitResult.taskId!, 120000, 5000, submitResult.endpointId);
      key = pollResult.dominantKey;
      bpm = pollResult.bpm;
    } else {
      const submitResult = await submitKeyBPMExtraction(fullAudioUrl);
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 120000, 5000, "KEY_BPM_EXTRACTION");
      key = pollResult.dominantKey || pollResult.key;
      bpm = pollResult.bpm;
    }

    const updates: Record<string, any> = { status: "ready" };
    if (key) updates.key = key;
    if (bpm) updates.bpm = Math.round(bpm);
    await storage.updateSample(sampleId, updates);
    console.log(`[SampleWorker] Key/BPM detection complete: key=${key}, bpm=${bpm}`);
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[SampleWorker] Key/BPM error for sample ${sampleId}:`, msg);
    const sample = await storage.getSample(sampleId);
    await storage.updateSample(sampleId, { status: sample?.audioUrl ? "ready" : "failed", error: friendlyError(msg, "Key/BPM detection failed") });
  }
}

export async function processMastering(
  songId: number,
  audioUrl: string
): Promise<void> {
  try {
    console.log(`[MasterWorker] Starting mastering for song ${songId}`);
    await storage.updateSongStatus(songId, "mastering");

    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    const useGeneric = await hasProviderForOperation("mastering");

    let localUrl: string;

    if (useGeneric) {
      const submitResult = await submitGenericJob("mastering", {
        audio_url: fullAudioUrl,
        reference_audio_url: fullAudioUrl,
      });
      const pollResult = await pollGenericJob("mastering", submitResult.taskId!, 600000, 8000, submitResult.endpointId);
      if (!pollResult.audioUrl) throw new Error("Mastering completed but no audio URL returned");
      localUrl = await downloadFile(pollResult.audioUrl, "mastered", "master");
    } else {
      const submitResult = await submitMastering(fullAudioUrl, { referenceAudioUrl: fullAudioUrl });
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "AUDIO_MASTERING");
      if (!pollResult.audioUrl) throw new Error("Mastering completed but no audio URL returned");
      localUrl = await downloadMusicGPTFile(pollResult.audioUrl, "mastered", "master");
    }

    await storage.updateSongStatus(songId, "completed", localUrl);
    console.log(`[MasterWorker] Mastering complete for song ${songId}: ${localUrl}`);
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[MasterWorker] Error for song ${songId}:`, msg);
    await storage.updateSongStatus(songId, "completed", undefined, friendlyError(msg, "Audio mastering failed"));
  }
}

export async function processDenoise(
  songId: number,
  audioUrl: string
): Promise<void> {
  let newSongId: number | null = null;
  try {
    console.log(`[DenoiseWorker] Starting denoise for song ${songId}`);
    const song = await storage.getSong(songId);
    if (!song) throw new Error("Song not found");
    const newSong = await storage.createSong({ userId: song.userId, title: `${song.title} (Denoised)`, prompt: `Denoised version of "${song.title}"`, genre: song.genre, mode: "standard" });
    newSongId = newSong.id;
    await storage.updateSongStatus(newSong.id, "processing");

    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    const useGeneric = await hasProviderForOperation("denoise");

    let localUrl: string;

    if (useGeneric) {
      const submitResult = await submitGenericJob("denoise", { audio_url: fullAudioUrl });
      const pollResult = await pollGenericJob("denoise", submitResult.taskId!, 600000, 8000, submitResult.endpointId);
      if (!pollResult.audioUrl) throw new Error("Denoise completed but no audio URL returned");
      localUrl = await downloadFile(pollResult.audioUrl, "denoised", "clean");
    } else {
      const submitResult = await submitDenoise(fullAudioUrl);
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "DENOISING");
      if (!pollResult.audioUrl) throw new Error("Denoise completed but no audio URL returned");
      localUrl = await downloadMusicGPTFile(pollResult.audioUrl, "denoised", "clean");
    }

    await storage.updateSongStatus(newSong.id, "completed", localUrl);
    console.log(`[DenoiseWorker] Denoise complete for song ${songId}: ${localUrl}`);
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[DenoiseWorker] Error for song ${songId}:`, msg);
    if (newSongId) await storage.updateSongStatus(newSongId, "failed", undefined, friendlyError(msg, "Audio denoising failed"));
  }
}

export async function processCoverSong(
  songId: number,
  audioUrl: string,
  voiceId: string,
  userId: string,
  pitch?: number
): Promise<void> {
  try {
    console.log(`[CoverWorker] Starting cover generation for song ${songId}`);

    const song = await storage.getSong(songId);
    if (!song) throw new Error("Song not found");

    const coverSong = await storage.createSong({
      userId,
      title: `${song.title} (Cover)`,
      prompt: `Cover of "${song.title}" with voice: ${voiceId}`,
      genre: song.genre,
      mode: "standard",
    });

    await storage.updateSongStatus(coverSong.id, "processing");

    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    const useGeneric = await hasProviderForOperation("cover");

    let localUrl: string;

    if (useGeneric) {
      const submitResult = await submitGenericJob("cover", {
        audio_url: fullAudioUrl,
        voice_id: voiceId,
        pitch: pitch ?? 0,
      });
      const pollResult = await pollGenericJob("cover", submitResult.taskId!, 600000, 8000, submitResult.endpointId);
      if (!pollResult.audioUrl) throw new Error("Cover generation completed but no audio URL returned");
      localUrl = await downloadFile(pollResult.audioUrl, "covers", "cover");
    } else {
      const submitResult = await submitCover(fullAudioUrl, voiceId, { pitch });
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "COVER");
      if (!pollResult.audioUrl) throw new Error("Cover generation completed but no audio URL returned");
      localUrl = await downloadMusicGPTFile(pollResult.audioUrl, "covers", "cover");
    }

    await storage.updateSongStatus(coverSong.id, "completed", localUrl);
    console.log(`[CoverWorker] Cover complete for song ${songId}, new song: ${coverSong.id}`);
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[CoverWorker] Error for song ${songId}:`, msg);
  }
}

export async function processAudioCut(
  songId: number,
  audioUrl: string,
  startTimeMs: number,
  endTimeMs: number,
  userId: string
): Promise<void> {
  let trimSongId: number | null = null;

  try {
    console.log(`[CutWorker] Starting audio trim for song ${songId}: ${startTimeMs}ms - ${endTimeMs}ms`);

    const song = await storage.getSong(songId);
    if (!song) throw new Error("Song not found");

    const durationSec = Math.round((endTimeMs - startTimeMs) / 1000);
    const trimSong = await storage.createSong({
      userId,
      title: `${song.title} (Trimmed ${durationSec}s)`,
      prompt: `Trimmed version of "${song.title}" (${startTimeMs}ms - ${endTimeMs}ms)`,
      genre: song.genre,
      mode: "standard",
    });

    trimSongId = trimSong.id;
    await storage.updateSongStatus(trimSong.id, "processing");

    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    const useGeneric = await hasProviderForOperation("audio_cut");

    let localUrl: string;

    if (useGeneric) {
      const submitResult = await submitGenericJob("audio_cut", {
        audio_url: fullAudioUrl,
        start_time: startTimeMs,
        end_time: endTimeMs,
        output_extension: "mp3",
      });
      const pollResult = await pollGenericJob("audio_cut", submitResult.taskId!, 600000, 8000, submitResult.endpointId);
      const outputUrl = pollResult.audioUrl || pollResult.outputFile;
      if (!outputUrl) throw new Error("Audio cutter completed but no output URL returned");
      localUrl = await downloadFile(outputUrl, "trimmed", "trim");
    } else {
      const submitResult = await submitAudioCutter(fullAudioUrl, startTimeMs, endTimeMs);
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "AUDIO_CUTTER");
      const outputUrl = pollResult.audioUrl || pollResult.raw.output_file || pollResult.raw.conversion_path;
      if (!outputUrl) throw new Error("Audio cutter completed but no output URL returned");
      localUrl = await downloadMusicGPTFile(outputUrl, "trimmed", "trim");
    }

    await storage.updateSongStatus(trimSong.id, "completed", localUrl);
    console.log(`[CutWorker] Trim complete for song ${songId}, new song: ${trimSong.id}`);
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[CutWorker] Error for song ${songId}:`, msg);
    if (trimSongId) {
      await storage.updateSongStatus(trimSongId, "failed", undefined, friendlyError(msg, "Audio trimming failed"));
    }
  }
}

export async function processVoiceConversion(
  songId: number, audioUrl: string, voiceId: string, userId: string, pitch?: number
): Promise<void> {
  let newSongId: number | null = null;
  try {
    console.log(`[VoiceWorker] Starting voice conversion for song ${songId}`);
    const song = await storage.getSong(songId);
    if (!song) throw new Error("Song not found");
    const newSong = await storage.createSong({ userId, title: `${song.title} (Voice Changed)`, prompt: `Voice conversion of "${song.title}"`, genre: song.genre, mode: "standard" });
    newSongId = newSong.id;
    await storage.updateSongStatus(newSong.id, "processing");
    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    const useGeneric = await hasProviderForOperation("voice_conversion");
    let localUrl: string;
    if (useGeneric) {
      const submitResult = await submitGenericJob("voice_conversion", { audio_url: fullAudioUrl, voice_id: voiceId, pitch: pitch ?? 0 });
      const pollResult = await pollGenericJob("voice_conversion", submitResult.taskId!, 600000, 8000, submitResult.endpointId);
      if (!pollResult.audioUrl) throw new Error("Voice conversion completed but no audio URL returned");
      localUrl = await downloadFile(pollResult.audioUrl, "voice_converted", "vc");
    } else {
      const submitResult = await submitVoiceChanger(fullAudioUrl, voiceId, { pitch });
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "VOICE_CONVERSION");
      if (!pollResult.audioUrl) throw new Error("Voice conversion completed but no audio URL returned");
      localUrl = await downloadMusicGPTFile(pollResult.audioUrl, "voice_converted", "vc");
    }
    await storage.updateSongStatus(newSong.id, "completed", localUrl);
    console.log(`[VoiceWorker] Voice conversion complete for song ${songId}`);
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[VoiceWorker] Error for song ${songId}:`, msg);
    if (newSongId) await storage.updateSongStatus(newSongId, "failed", undefined, friendlyError(msg, "Voice conversion failed"));
  }
}

export async function processDeEcho(songId: number, audioUrl: string): Promise<void> {
  let newSongId: number | null = null;
  try {
    console.log(`[DeEchoWorker] Starting de-echo for song ${songId}`);
    const song = await storage.getSong(songId);
    if (!song) throw new Error("Song not found");
    const newSong = await storage.createSong({ userId: song.userId, title: `${song.title} (De-echo)`, prompt: `De-echo of "${song.title}"`, genre: song.genre, mode: "standard" });
    newSongId = newSong.id;
    await storage.updateSongStatus(newSong.id, "processing");
    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    const useGeneric = await hasProviderForOperation("de_echo");
    let localUrl: string;
    if (useGeneric) {
      const submitResult = await submitGenericJob("de_echo", { audio_url: fullAudioUrl });
      const pollResult = await pollGenericJob("de_echo", submitResult.taskId!, 600000, 8000, submitResult.endpointId);
      if (!pollResult.audioUrl) throw new Error("De-echo completed but no audio URL returned");
      localUrl = await downloadFile(pollResult.audioUrl, "de_echo", "clean");
    } else {
      const submitResult = await submitDeEcho(fullAudioUrl);
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "DE_ECHO");
      if (!pollResult.audioUrl) throw new Error("De-echo completed but no audio URL returned");
      localUrl = await downloadMusicGPTFile(pollResult.audioUrl, "de_echo", "clean");
    }
    await storage.updateSongStatus(newSong.id, "completed", localUrl);
    console.log(`[DeEchoWorker] De-echo complete for song ${songId}`);
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[DeEchoWorker] Error for song ${songId}:`, msg);
    if (newSongId) await storage.updateSongStatus(newSongId, "failed", undefined, friendlyError(msg, "De-echo processing failed"));
  }
}

export async function processDeReverb(songId: number, audioUrl: string): Promise<void> {
  let newSongId: number | null = null;
  try {
    console.log(`[DeReverbWorker] Starting de-reverb for song ${songId}`);
    const song = await storage.getSong(songId);
    if (!song) throw new Error("Song not found");
    const newSong = await storage.createSong({ userId: song.userId, title: `${song.title} (De-reverb)`, prompt: `De-reverb of "${song.title}"`, genre: song.genre, mode: "standard" });
    newSongId = newSong.id;
    await storage.updateSongStatus(newSong.id, "processing");
    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    const useGeneric = await hasProviderForOperation("de_reverb");
    let localUrl: string;
    if (useGeneric) {
      const submitResult = await submitGenericJob("de_reverb", { audio_url: fullAudioUrl });
      const pollResult = await pollGenericJob("de_reverb", submitResult.taskId!, 600000, 8000, submitResult.endpointId);
      if (!pollResult.audioUrl) throw new Error("De-reverb completed but no audio URL returned");
      localUrl = await downloadFile(pollResult.audioUrl, "de_reverb", "clean");
    } else {
      const submitResult = await submitDeReverb(fullAudioUrl);
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "DE_REVERB");
      if (!pollResult.audioUrl) throw new Error("De-reverb completed but no audio URL returned");
      localUrl = await downloadMusicGPTFile(pollResult.audioUrl, "de_reverb", "clean");
    }
    await storage.updateSongStatus(newSong.id, "completed", localUrl);
    console.log(`[DeReverbWorker] De-reverb complete for song ${songId}`);
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[DeReverbWorker] Error for song ${songId}:`, msg);
    if (newSongId) await storage.updateSongStatus(newSongId, "failed", undefined, friendlyError(msg, "De-reverb processing failed"));
  }
}

export async function processTTS(
  userId: string, text: string, voiceId?: string, language?: string
): Promise<void> {
  let songId: number | null = null;
  try {
    console.log(`[TTSWorker] Starting TTS generation via OpenAI`);
    const song = await storage.createSong({ userId, title: `TTS: ${text.substring(0, 50)}...`, prompt: text, genre: "speech", mode: "standard" });
    songId = song.id;
    await storage.updateSongStatus(song.id, "processing");

    const useGeneric = await hasProviderForOperation("tts");
    let localUrl: string;

    if (useGeneric) {
      const submitResult = await submitGenericJob("tts", { text, voice_id: voiceId, language });
      const pollResult = await pollGenericJob("tts", submitResult.taskId!, 600000, 8000, submitResult.endpointId);
      if (!pollResult.audioUrl) throw new Error("TTS completed but no audio URL returned");
      localUrl = await downloadFile(pollResult.audioUrl, "tts", "speech");
    } else {
      const voiceMap: Record<string, "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"> = {
        "male_1": "onyx", "male_2": "echo", "male_3": "fable",
        "female_1": "nova", "female_2": "shimmer", "female_3": "alloy",
      };
      const voice = (voiceId && voiceMap[voiceId]) ? voiceMap[voiceId] : "nova";

      const audioDir = path.join(process.cwd(), "audio", "tts");
      if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
      const filename = `speech_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.mp3`;
      const filePath = path.join(audioDir, filename);

      let audioBuffer: Buffer | null = null;

      // Try AI integrations (gpt-audio) first
      try {
        console.log(`[TTSWorker] Trying AI integrations gpt-audio TTS voice: ${voice}`);
        audioBuffer = await textToSpeech(text, voice, "mp3");
        if (!audioBuffer || audioBuffer.length === 0) throw new Error("Empty audio returned");
        console.log(`[TTSWorker] AI integrations TTS succeeded (${audioBuffer.length} bytes)`);
      } catch (aiErr: any) {
        console.warn(`[TTSWorker] AI integrations TTS failed: ${aiErr.message}`);
      }

      // Fallback: direct OpenAI tts-1 API with user's own key
      if (!audioBuffer || audioBuffer.length === 0) {
        const directKey = process.env.OPENAI_API_KEY;
        if (!directKey) throw new Error("TTS unavailable: AI integrations failed and no OPENAI_API_KEY configured");
        console.log(`[TTSWorker] Falling back to direct OpenAI tts-1 with voice: ${voice}`);
        const OpenAI = (await import("openai")).default;
        const directClient = new OpenAI({ apiKey: directKey });
        const mp3Response = await directClient.audio.speech.create({
          model: "tts-1-hd",
          voice: voice as any,
          input: text,
          response_format: "mp3",
        });
        audioBuffer = Buffer.from(await mp3Response.arrayBuffer());
        if (!audioBuffer || audioBuffer.length === 0) throw new Error("Direct OpenAI TTS returned empty audio");
        console.log(`[TTSWorker] Direct OpenAI TTS succeeded (${audioBuffer.length} bytes)`);
      }

      fs.writeFileSync(filePath, audioBuffer);
      localUrl = `/audio/tts/${filename}`;
      console.log(`[TTSWorker] TTS saved: ${localUrl}`);
    }

    await storage.updateSongStatus(song.id, "completed", localUrl);
    console.log(`[TTSWorker] TTS complete: ${song.id}`);
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[TTSWorker] Error:`, msg);
    if (songId) await storage.updateSongStatus(songId, "failed", undefined, friendlyError(msg, "Text-to-speech failed"));
  }
}

export async function processSoundGeneration(
  userId: string, prompt: string, duration?: number
): Promise<void> {
  let songId: number | null = null;
  try {
    console.log(`[SFXWorker] Starting sound generation: ${prompt.substring(0, 60)}`);
    const song = await storage.createSong({ userId, title: `SFX: ${prompt.substring(0, 50)}`, prompt, genre: "sfx", mode: "standard" });
    songId = song.id;
    await storage.updateSongStatus(song.id, "processing");
    const useGeneric = await hasProviderForOperation("sound_generation");
    let localUrl: string;
    if (useGeneric) {
      const submitResult = await submitGenericJob("sound_generation", { prompt, duration });
      const pollResult = await pollGenericJob("sound_generation", submitResult.taskId!, 600000, 8000, submitResult.endpointId);
      if (!pollResult.audioUrl) throw new Error("Sound generation completed but no audio URL returned");
      localUrl = await downloadFile(pollResult.audioUrl, "sfx", "sound");
    } else {
      const submitResult = await submitSoundGenerator(prompt, duration);
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "SOUND_GENERATOR");
      if (!pollResult.audioUrl) throw new Error("Sound generation completed but no audio URL returned");
      localUrl = await downloadMusicGPTFile(pollResult.audioUrl, "sfx", "sound");
    }
    await storage.updateSongStatus(song.id, "completed", localUrl);
    console.log(`[SFXWorker] Sound generation complete: ${song.id}`);
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[SFXWorker] Error:`, msg);
    if (songId) await storage.updateSongStatus(songId, "failed", undefined, friendlyError(msg, "Sound generation failed"));
  }
}

export async function processTranscription(
  songId: number, audioUrl: string, language?: string
): Promise<{ text?: string }> {
  try {
    console.log(`[TranscribeWorker] Starting transcription for song ${songId}`);
    await storage.updateSongStatus(songId, "processing");
    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    const useGeneric = await hasProviderForOperation("transcription");
    let text: string | undefined;
    if (useGeneric) {
      const submitResult = await submitGenericJob("transcription", { audio_url: fullAudioUrl, language });
      const pollResult = await pollGenericJob("transcription", submitResult.taskId!, 300000, 5000, submitResult.endpointId);
      text = (pollResult as any).text || (pollResult as any).transcription;
    } else {
      const submitResult = await submitTranscription(fullAudioUrl, { language });
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 300000, 5000, "TRANSCRIPTION");
      text = (pollResult as any).text || (pollResult.raw as any)?.transcription || (pollResult.raw as any)?.text;
    }
    await storage.updateSongStatus(songId, "completed");
    console.log(`[TranscribeWorker] Transcription complete for song ${songId}`);
    return { text };
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[TranscribeWorker] Error for song ${songId}:`, msg);
    await storage.updateSongStatus(songId, "completed", undefined, friendlyError(msg, "Transcription failed"));
    return {};
  }
}

export async function processRemix(
  songId: number, audioUrl: string, prompt: string, userId: string
): Promise<void> {
  let newSongId: number | null = null;
  try {
    console.log(`[RemixWorker] Starting remix for song ${songId}`);
    const song = await storage.getSong(songId);
    if (!song) throw new Error("Song not found");
    const newSong = await storage.createSong({ userId, title: `${song.title} (Remix)`, prompt: `Remix: ${prompt}`, genre: song.genre, mode: "standard" });
    newSongId = newSong.id;
    await storage.updateSongStatus(newSong.id, "processing");
    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    const useGeneric = await hasProviderForOperation("remix");
    let localUrl: string;
    if (useGeneric) {
      const submitResult = await submitGenericJob("remix", { audio_url: fullAudioUrl, prompt });
      const pollResult = await pollGenericJob("remix", submitResult.taskId!, 600000, 8000, submitResult.endpointId);
      if (!pollResult.audioUrl) throw new Error("Remix completed but no audio URL returned");
      localUrl = await downloadFile(pollResult.audioUrl, "remixes", "remix");
    } else {
      const submitResult = await submitRemix(fullAudioUrl, prompt);
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "REMIX");
      if (!pollResult.audioUrl) throw new Error("Remix completed but no audio URL returned");
      localUrl = await downloadMusicGPTFile(pollResult.audioUrl, "remixes", "remix");
    }
    await storage.updateSongStatus(newSong.id, "completed", localUrl);
    console.log(`[RemixWorker] Remix complete for song ${songId}, new song: ${newSong.id}`);
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[RemixWorker] Error for song ${songId}:`, msg);
    if (newSongId) await storage.updateSongStatus(newSongId, "failed", undefined, friendlyError(msg, "Remix failed"));
  }
}

export async function processSpeedChange(
  songId: number, audioUrl: string, speed: number, userId: string, pitch?: number
): Promise<void> {
  let newSongId: number | null = null;
  try {
    console.log(`[SpeedWorker] Starting speed change for song ${songId}: ${speed}x`);
    const song = await storage.getSong(songId);
    if (!song) throw new Error("Song not found");
    const newSong = await storage.createSong({ userId, title: `${song.title} (${speed}x)`, prompt: `Speed changed to ${speed}x`, genre: song.genre, mode: "standard" });
    newSongId = newSong.id;
    await storage.updateSongStatus(newSong.id, "processing");
    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    const useGeneric = await hasProviderForOperation("audio_speed");
    let localUrl: string;
    if (useGeneric) {
      const submitResult = await submitGenericJob("audio_speed", { audio_url: fullAudioUrl, speed, pitch: pitch ?? 0 });
      const pollResult = await pollGenericJob("audio_speed", submitResult.taskId!, 600000, 8000, submitResult.endpointId);
      if (!pollResult.audioUrl) throw new Error("Speed change completed but no audio URL returned");
      localUrl = await downloadFile(pollResult.audioUrl, "speed_changed", "speed");
    } else {
      const submitResult = await submitAudioSpeedChanger(fullAudioUrl, speed, { pitch });
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "AUDIO_SPEED_CHANGER");
      if (!pollResult.audioUrl) throw new Error("Speed change completed but no audio URL returned");
      localUrl = await downloadMusicGPTFile(pollResult.audioUrl, "speed_changed", "speed");
    }
    await storage.updateSongStatus(newSong.id, "completed", localUrl);
    console.log(`[SpeedWorker] Speed change complete for song ${songId}, new song: ${newSong.id}`);
  } catch (err: any) {
    const msg = err.message || "";
    console.error(`[SpeedWorker] Error for song ${songId}:`, msg);
    if (newSongId) await storage.updateSongStatus(newSongId, "failed", undefined, friendlyError(msg, "Speed change failed"));
  }
}
