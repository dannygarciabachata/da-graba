import { storage } from "../storage";
import { getJobStatus, isServerlessConfigured } from "./runpod_serverless";
import { saveRunPodAudio } from "./runpod_music_engine";
import { db } from "../db";
import { songs as songsTable } from "@shared/schema";
import { eq } from "drizzle-orm";

const POLL_INTERVAL_MS = 30_000;
const MAX_PROCESSING_AGE_MS = 24 * 60 * 60 * 1000;

let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

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
    if (age > MAX_PROCESSING_AGE_MS) {
      console.log(`[RunPod Watchdog] Song ${song.id} has no taskId and is ${(age / 3600000).toFixed(1)}h old, marking failed`);
      await storage.updateSongStatus(song.id, "failed", undefined, "No task ID - generation may not have started");
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
    } else if (output.status === "completed" || output.audio_path) {
      console.log(`[RunPod Watchdog] Song ${song.id} completed on RunPod but no audio delivered. Audio path: ${output.audio_path}`);
      const age = Date.now() - new Date(song.createdAt).getTime();
      if (age > 600000) {
        await storage.updateSongStatus(song.id, "failed", undefined, "Audio generated but could not be delivered to server. Try again.");
      } else {
        console.log(`[RunPod Watchdog] Song ${song.id} waiting for upload delivery (age: ${(age / 60000).toFixed(0)}min)`);
      }
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
