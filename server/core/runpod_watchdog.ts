import { storage } from "../storage";
import { getJobStatus, isServerlessConfigured, getEndpointId } from "./runpod_serverless";
import { saveRunPodAudio } from "./runpod_music_engine";
import { db } from "../db";
import { songs as songsTable } from "@shared/schema";
import { eq } from "drizzle-orm";

const POLL_INTERVAL_MS = 30_000;
const MAX_PROCESSING_AGE_MS = 2 * 60 * 60 * 1000;
const NO_TASKID_TIMEOUT_MS = 10 * 60 * 1000;
const UNDELIVERED_GRACE_MS = 120_000;

let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

const undeliveredSeen = new Map<number, number>();

export function startRunPodWatchdog() {
  if (watchdogTimer) {
    console.log("[RunPod Watchdog] Already running, skipping start");
    return;
  }

  if (!isServerlessConfigured("music")) {
    console.log("[RunPod Watchdog] RunPod not configured, skipping watchdog");
    return;
  }

  console.log(`[RunPod Watchdog] Starting (poll every ${POLL_INTERVAL_MS / 1000}s)`);

  setTimeout(() => checkProcessingSongs(), 5000);

  watchdogTimer = setInterval(() => {
    checkProcessingSongs();
  }, POLL_INTERVAL_MS);
}

export function stopRunPodWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
    console.log("[RunPod Watchdog] Stopped");
  }
}

async function checkProcessingSongs() {
  if (isRunning) return;
  isRunning = true;

  try {
    const processingSongs = await db
      .select()
      .from(songsTable)
      .where(eq(songsTable.status, "processing"));

    if (processingSongs.length === 0) {
      isRunning = false;
      return;
    }

    console.log(`[RunPod Watchdog] Found ${processingSongs.length} processing song(s)`);

    for (const song of processingSongs) {
      try {
        await checkSongJob(song);
      } catch (err: any) {
        console.error(`[RunPod Watchdog] Error checking song ${song.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error(`[RunPod Watchdog] Error: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

async function checkSongJob(song: any) {
  const taskId = song.taskId;
  if (!taskId) {
    const age = Date.now() - new Date(song.createdAt).getTime();
    if (age > NO_TASKID_TIMEOUT_MS) {
      console.log(`[RunPod Watchdog] Song ${song.id} has no taskId and is ${(age / 60000).toFixed(0)}min old, marking failed`);
      await storage.updateSongStatus(song.id, "failed", undefined, "Generation job could not be submitted. Please try again.");
    }
    return;
  }

  const isRunPodJob =
    taskId.includes("-") ||
    /^[a-f0-9]{32}$/.test(taskId) ||
    taskId.endsWith("-u1") ||
    taskId.endsWith("-u2");

  if (!isRunPodJob) {
    return;
  }

  console.log(`[RunPod Watchdog] Checking song ${song.id} (taskId: ${taskId})`);

  const jobResult = await getJobStatus("music", taskId);

  if (jobResult.status === "COMPLETED") {
    const output = jobResult.output;

    const freshSong = await storage.getSong(song.id);
    if (freshSong?.status === "completed") {
      console.log(`[RunPod Watchdog] Song ${song.id} already completed (likely via file upload), skipping`);
      undeliveredSeen.delete(song.id);
      return;
    }

    if (!output) {
      console.log(`[RunPod Watchdog] Song ${song.id} COMPLETED but no output`);
      await storage.updateSongStatus(song.id, "failed", undefined, "Job completed but no output returned");
      return;
    }

    if (output.delivered) {
      console.log(`[RunPod Watchdog] Song ${song.id} was delivered via file upload, checking DB...`);
      const uploadedSong = await storage.getSong(song.id);
      if (uploadedSong?.status === "completed" && uploadedSong?.audioUrl) {
        console.log(`[RunPod Watchdog] Song ${song.id} confirmed completed via upload: ${uploadedSong.audioUrl}`);
        undeliveredSeen.delete(song.id);
      } else {
        console.log(`[RunPod Watchdog] Song ${song.id} marked delivered but not in DB yet, waiting...`);
      }
      return;
    }

    if (output.audioBase64) {
      const audioFormat = output.audioFormat || "mp3";
      const localUrl = await saveRunPodAudio(output.audioBase64, song.id, audioFormat);
      await storage.updateSongStatus(song.id, "completed", localUrl);

      if (output.duration) {
        try {
          await db.update(songsTable).set({ duration: output.duration }).where(eq(songsTable.id, song.id));
        } catch {}
      }

      console.log(`[RunPod Watchdog] Song ${song.id} recovered and saved: ${localUrl}`);
      undeliveredSeen.delete(song.id);
    } else if (output.status === "completed" || output.audio_path) {
      await handleUndeliveredAudio(song, output);
    } else {
      console.log(`[RunPod Watchdog] Song ${song.id} COMPLETED but unexpected output:`, JSON.stringify(output).substring(0, 200));
      await storage.updateSongStatus(song.id, "failed", undefined, "Unexpected output format from generation");
    }
  } else if (jobResult.status === "FAILED" || jobResult.status === "CANCELLED" || jobResult.status === "TIMED_OUT") {
    const errorMsg = jobResult.error || jobResult.output?.error || `Job ${jobResult.status}`;
    console.log(`[RunPod Watchdog] Song ${song.id} ${jobResult.status}: ${errorMsg}`);
    await storage.updateSongStatus(song.id, "failed", undefined, errorMsg.substring(0, 300));
  } else if (jobResult.status === "IN_QUEUE" || jobResult.status === "IN_PROGRESS") {
    const age = Date.now() - new Date(song.createdAt).getTime();
    const ageMin = (age / 60000).toFixed(0);
    console.log(`[RunPod Watchdog] Song ${song.id} still ${jobResult.status} (age: ${ageMin}min)`);

    if (age > MAX_PROCESSING_AGE_MS) {
      console.log(`[RunPod Watchdog] Song ${song.id} exceeded max age, marking failed`);
      await storage.updateSongStatus(song.id, "failed", undefined, `Generation timed out after ${ageMin} minutes`);
    }
  }
}

async function tryRecoverFromJobOutput(song: any, taskId: string): Promise<boolean> {
  try {
    const jobResult = await getJobStatus("music", taskId);
    if (jobResult.status !== "COMPLETED" || !jobResult.output) return false;

    const output = jobResult.output;
    if (output.audioBase64) {
      const audioFormat = output.audioFormat || "mp3";
      const localUrl = await saveRunPodAudio(output.audioBase64, song.id, audioFormat);
      await storage.updateSongStatus(song.id, "completed", localUrl);
      if (output.duration) {
        try { await db.update(songsTable).set({ duration: output.duration }).where(eq(songsTable.id, song.id)); } catch {}
      }
      console.log(`[RunPod Watchdog] Song ${song.id} recovered from job output base64: ${localUrl}`);
      return true;
    }

    if (output.audio_url) {
      try {
        const audioRes = await fetch(output.audio_url, { signal: AbortSignal.timeout(60000) });
        if (audioRes.ok) {
          const fs = await import("fs");
          const path = await import("path");
          const audioDir = path.join(process.cwd(), "uploads", "audio", "songs");
          if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
          const filename = `${song.id}_recovered_${Date.now()}.mp3`;
          const filePath = path.join(audioDir, filename);
          const buffer = Buffer.from(await audioRes.arrayBuffer());
          fs.writeFileSync(filePath, buffer);
          const localUrl = `/audio/songs/${filename}`;
          await storage.updateSongStatus(song.id, "completed", localUrl);
          console.log(`[RunPod Watchdog] Song ${song.id} recovered by downloading audio_url: ${localUrl}`);
          return true;
        }
      } catch (dlErr: any) {
        console.log(`[RunPod Watchdog] Failed to download audio_url for song ${song.id}: ${dlErr.message}`);
      }
    }
  } catch (err: any) {
    console.log(`[RunPod Watchdog] Recovery attempt failed for song ${song.id}: ${err.message}`);
  }
  return false;
}

async function handleUndeliveredAudio(song: any, output: any) {
  const audioPath = output.audio_path;
  const firstSeen = undeliveredSeen.get(song.id) || Date.now();
  
  if (!undeliveredSeen.has(song.id)) {
    undeliveredSeen.set(song.id, firstSeen);
  }

  const waitTime = Date.now() - firstSeen;
  console.log(`[RunPod Watchdog] Song ${song.id} completed on RunPod but audio not delivered. Path: ${audioPath}, waited: ${(waitTime / 1000).toFixed(0)}s`);

  if (waitTime > UNDELIVERED_GRACE_MS) {
    console.log(`[RunPod Watchdog] Song ${song.id} grace period expired, attempting active recovery...`);
    const recovered = await tryRecoverFromJobOutput(song, song.taskId);
    if (recovered) {
      undeliveredSeen.delete(song.id);
      return;
    }

    console.log(`[RunPod Watchdog] Song ${song.id} recovery failed. Marking as failed with retry option.`);
    await storage.updateSongStatus(
      song.id,
      "failed",
      undefined,
      "Audio was generated successfully but delivery to server failed. Please try generating again."
    );
    undeliveredSeen.delete(song.id);
  } else {
    console.log(`[RunPod Watchdog] Song ${song.id} waiting for upload delivery (${((UNDELIVERED_GRACE_MS - waitTime) / 1000).toFixed(0)}s remaining)`);
  }
}
