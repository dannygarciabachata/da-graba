import { storage } from "../storage";
import {
  submitRemix,
  pollMusicGPTJob,
  downloadMusicGPTFile,
  resolveFullAudioUrl,
  buildMusicGPTPrompt,
  submitAudioCutter,
  getConversionType,
} from "../core/musicgpt_engine";

export async function processHummingToMusic(
  sampleId: number,
  audioUrl: string,
  prompt: string,
  duration: number = 15
): Promise<void> {
  try {
    console.log(`[SampleWorker] Starting MusicGPT Remix for sample ${sampleId}`);
    await storage.updateSample(sampleId, { status: "processing" });

    const fullAudioUrl = resolveFullAudioUrl(audioUrl);

    const cleanPrompt = prompt
      .replace(/high fidelity|masterpiece|studio quality/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 280);

    console.log(`[SampleWorker] Using MusicGPT Remix with prompt: ${cleanPrompt}`);

    const submitResult = await submitRemix(fullAudioUrl, cleanPrompt);

    const pollResult = await pollMusicGPTJob(submitResult.task_id, 600000, 8000, "REMIX");

    if (!pollResult.audioUrl) {
      throw new Error("MusicGPT Remix completed but no audio URL returned");
    }

    const localUrl = await downloadMusicGPTFile(pollResult.audioUrl, "samples", "remix");

    await storage.updateSample(sampleId, {
      status: "ready",
      audioUrl: localUrl,
      sourceType: "ai-transform",
    });

    console.log(`[SampleWorker] Remix complete for sample ${sampleId}`);
  } catch (err: any) {
    console.error(`[SampleWorker] Error for sample ${sampleId}:`, err.message || err);
    await storage.updateSample(sampleId, {
      status: "failed",
      error: err.message || "AI remix generation failed",
    });
  }
}

export async function processKeyBPMDetection(
  sampleId: number,
  audioUrl: string
): Promise<void> {
  const { submitKeyBPMExtraction, pollMusicGPTJob: poll } = await import("../core/musicgpt_engine");

  try {
    console.log(`[SampleWorker] Starting Key/BPM detection for sample ${sampleId}`);
    await storage.updateSample(sampleId, { status: "processing" });

    const fullAudioUrl = resolveFullAudioUrl(audioUrl);
    const submitResult = await submitKeyBPMExtraction(fullAudioUrl);
    const pollResult = await poll(submitResult.task_id, 120000, 5000, "KEY_BPM_EXTRACTION");

    const updates: Record<string, any> = { status: "ready" };
    if (pollResult.dominantKey) updates.key = pollResult.dominantKey;
    else if (pollResult.key) updates.key = pollResult.key;
    if (pollResult.bpm) updates.bpm = Math.round(pollResult.bpm);

    await storage.updateSample(sampleId, updates);
    console.log(`[SampleWorker] Key/BPM detection complete: key=${pollResult.dominantKey || pollResult.key}, bpm=${pollResult.bpm}`);
  } catch (err: any) {
    console.error(`[SampleWorker] Key/BPM error for sample ${sampleId}:`, err.message || err);
    const sample = await storage.getSample(sampleId);
    await storage.updateSample(sampleId, {
      status: sample?.audioUrl ? "ready" : "failed",
      error: err.message || "Key/BPM detection failed",
    });
  }
}

export async function processMastering(
  songId: number,
  audioUrl: string
): Promise<void> {
  const { submitMastering, pollMusicGPTJob: poll, downloadMusicGPTFile: download, resolveFullAudioUrl: resolve } = await import("../core/musicgpt_engine");

  try {
    console.log(`[MasterWorker] Starting mastering for song ${songId}`);
    await storage.updateSongStatus(songId, "mastering");

    const fullAudioUrl = resolve(audioUrl);
    const submitResult = await submitMastering(fullAudioUrl, { referenceAudioUrl: fullAudioUrl });
    const pollResult = await poll(submitResult.task_id, 600000, 8000, "AUDIO_MASTERING");

    if (!pollResult.audioUrl) {
      throw new Error("Mastering completed but no audio URL returned");
    }

    const localUrl = await download(pollResult.audioUrl, "mastered", "master");
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
  const { submitDenoise, pollMusicGPTJob: poll, downloadMusicGPTFile: download, resolveFullAudioUrl: resolve } = await import("../core/musicgpt_engine");

  try {
    console.log(`[DenoiseWorker] Starting denoise for song ${songId}`);
    await storage.updateSongStatus(songId, "denoising");

    const fullAudioUrl = resolve(audioUrl);
    const submitResult = await submitDenoise(fullAudioUrl);
    const pollResult = await poll(submitResult.task_id, 600000, 8000, "DENOISING");

    if (!pollResult.audioUrl) {
      throw new Error("Denoise completed but no audio URL returned");
    }

    const localUrl = await download(pollResult.audioUrl, "denoised", "clean");
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
  const { submitCover, pollMusicGPTJob: poll, downloadMusicGPTFile: download, resolveFullAudioUrl: resolve } = await import("../core/musicgpt_engine");

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

    const fullAudioUrl = resolve(audioUrl);
    const submitResult = await submitCover(fullAudioUrl, voiceId, { pitch });
    const pollResult = await poll(submitResult.task_id, 600000, 8000, "COVER");

    if (!pollResult.audioUrl) {
      throw new Error("Cover generation completed but no audio URL returned");
    }

    const localUrl = await download(pollResult.audioUrl, "covers", "cover");
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
    const submitResult = await submitAudioCutter(fullAudioUrl, startTimeMs, endTimeMs);

    const { pollMusicGPTJob: poll, downloadMusicGPTFile: download } = await import("../core/musicgpt_engine");
    const pollResult = await poll(submitResult.task_id, 600000, 8000, "AUDIO_CUTTER");

    const outputUrl = pollResult.audioUrl || pollResult.raw.output_file || pollResult.raw.conversion_path;
    if (!outputUrl) {
      throw new Error("Audio cutter completed but no output URL returned");
    }

    const localUrl = await download(outputUrl, "trimmed", "trim");
    await storage.updateSongStatus(trimSong.id, "completed", localUrl);
    console.log(`[CutWorker] Trim complete for song ${songId}, new song: ${trimSong.id}`);
  } catch (err: any) {
    console.error(`[CutWorker] Error for song ${songId}:`, err.message || err);
    if (trimSongId) {
      await storage.updateSongStatus(trimSongId, "failed", undefined, err.message || "Audio trimming failed");
    }
  }
}
