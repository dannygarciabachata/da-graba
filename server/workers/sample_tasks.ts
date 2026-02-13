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
} from "../core/musicgpt_engine";

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

    if (useGeneric) {
      const submitResult = await submitGenericJob("remix", {
        audio_url: fullAudioUrl,
        prompt: cleanPrompt,
      });
      const pollResult = await pollGenericJob("remix", submitResult.taskId!, 600000, 8000);
      if (!pollResult.audioUrl) throw new Error("Remix completed but no audio URL returned");
      const localUrl = await downloadFile(pollResult.audioUrl, "samples", "remix");
      await storage.updateSample(sampleId, { status: "ready", audioUrl: localUrl, sourceType: "ai-transform" });
    } else {
      const submitResult = await submitRemix(fullAudioUrl, cleanPrompt);
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "REMIX");
      if (!pollResult.audioUrl) throw new Error("Remix completed but no audio URL returned");
      const localUrl = await downloadMusicGPTFile(pollResult.audioUrl, "samples", "remix");
      await storage.updateSample(sampleId, { status: "ready", audioUrl: localUrl, sourceType: "ai-transform" });
    }

    console.log(`[SampleWorker] Remix complete for sample ${sampleId}`);
  } catch (err: any) {
    console.error(`[SampleWorker] Error for sample ${sampleId}:`, err.message || err);
    await storage.updateSample(sampleId, { status: "failed", error: err.message || "AI remix generation failed" });
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
      const pollResult = await pollGenericJob("key_bpm", submitResult.taskId!, 120000, 5000);
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
    console.error(`[SampleWorker] Key/BPM error for sample ${sampleId}:`, err.message || err);
    const sample = await storage.getSample(sampleId);
    await storage.updateSample(sampleId, { status: sample?.audioUrl ? "ready" : "failed", error: err.message || "Key/BPM detection failed" });
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
      const pollResult = await pollGenericJob("mastering", submitResult.taskId!, 600000, 8000);
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
    console.error(`[MasterWorker] Error for song ${songId}:`, err.message || err);
    await storage.updateSongStatus(songId, "completed", undefined, err.message);
  }
}

export async function processDenoise(
  songId: number,
  audioUrl: string
): Promise<void> {
  try {
    console.log(`[DenoiseWorker] Starting denoise for song ${songId}`);
    await storage.updateSongStatus(songId, "denoising");

    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    const useGeneric = await hasProviderForOperation("denoise");

    let localUrl: string;

    if (useGeneric) {
      const submitResult = await submitGenericJob("denoise", { audio_url: fullAudioUrl });
      const pollResult = await pollGenericJob("denoise", submitResult.taskId!, 600000, 8000);
      if (!pollResult.audioUrl) throw new Error("Denoise completed but no audio URL returned");
      localUrl = await downloadFile(pollResult.audioUrl, "denoised", "clean");
    } else {
      const submitResult = await submitDenoise(fullAudioUrl);
      const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "DENOISING");
      if (!pollResult.audioUrl) throw new Error("Denoise completed but no audio URL returned");
      localUrl = await downloadMusicGPTFile(pollResult.audioUrl, "denoised", "clean");
    }

    await storage.updateSongStatus(songId, "completed", localUrl);
    console.log(`[DenoiseWorker] Denoise complete for song ${songId}: ${localUrl}`);
  } catch (err: any) {
    console.error(`[DenoiseWorker] Error for song ${songId}:`, err.message || err);
    await storage.updateSongStatus(songId, "completed", undefined, err.message);
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
      const pollResult = await pollGenericJob("cover", submitResult.taskId!, 600000, 8000);
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
    console.error(`[CoverWorker] Error for song ${songId}:`, err.message || err);
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
      const pollResult = await pollGenericJob("audio_cut", submitResult.taskId!, 600000, 8000);
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
    console.error(`[CutWorker] Error for song ${songId}:`, err.message || err);
    if (trimSongId) {
      await storage.updateSongStatus(trimSongId, "failed", undefined, err.message || "Audio trimming failed");
    }
  }
}
