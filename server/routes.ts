import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { processMusicGeneration, pendingTaskMap, pendingRunPodSongs, startRunPodTimeout } from "./workers/music_tasks";
import { saveRunPodAudio } from "./core/runpod_music_engine";
import { generateCreativeLyrics } from "./core/antigravity_engine";
import { buildMusicGenPrompt, buildStyleKitPrompt, PROMPT_VERSIONS } from "./core/prompt_engine";
import { downloadMusicGPTFile } from "./core/musicgpt_engine";
import { getRandomQuiz, getQuizByCategory, evaluateQuiz } from "./core/quiz_engine";
import { processStemSeparation } from "./core/stems_engine";
import { saveStemAudio, getStemsWebhookSecret } from "./core/runpod_stems_engine";
import { processHummingToMusic, processKeyBPMDetection, processMastering, processDenoise, processCoverSong, processAudioCut } from "./workers/sample_tasks";
import { seedDefaultMusicGPTProvider, seedDgbRunPodProvider, seedReplicateProvider, seedMurekaProvider, seedTrainingKits } from "./core/seed_providers";
import { generateInstrumentPrompt, generateKitTrainingPrompt, buildTrainingConfig, buildRunPodPayload, GENRE_STYLE_HINTS } from "./core/sao_training_engine";
import { submitTrainingJob, submitAnalysisJob, isRunPodConfigured, checkRunPodConnection, getGpuStatus, resumeGpuPod, stopGpuPod, setupGpuEnvironment } from "./core/runpod_client";
import { isCloudConfigured, getActiveServer, checkCloudHealth, checkDgbCloudHealth, uploadInstrumentToCloud, saveMidiFile, verifyWebhookFromAnyServer } from "./core/dgb_runpod_api";
import { OPERATION_TYPES, PROVIDER_CATEGORIES, AUTH_TYPES, STYLE_KIT_GENRES, INSTRUMENT_TYPES, SETTING_CATEGORIES, TICKET_STATUSES, TICKET_PRIORITIES, insertApiProviderSchema, insertApiEndpointSchema, insertStyleKitSchema, insertStyleKitInstrumentSchema, insertPlatformSettingSchema } from "@shared/schema";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

async function recoverStuckSongs() {
  try {
    const { db } = await import("./db");
    const { songs } = await import("@shared/schema");
    const { eq, inArray, and, lt } = await import("drizzle-orm");
    const stuckStatuses = ["processing", "mastering", "denoising"];
    const stuckSongs = await db.select({ id: songs.id, status: songs.status, audioUrl: songs.audioUrl, createdAt: songs.createdAt })
      .from(songs)
      .where(inArray(songs.status, stuckStatuses));

    const now = Date.now();
    const MAX_AGE_MS = 20 * 60 * 1000;

    const { users } = await import("@shared/schema");
    const { sql } = await import("drizzle-orm");
    for (const s of stuckSongs) {
      if (s.audioUrl) {
        await db.update(songs).set({ status: "completed", error: null }).where(eq(songs.id, s.id));
        console.log(`[Recovery] Restored song ${s.id} from "${s.status}" to "completed" (has audio)`);
      } else {
        const songAge = now - new Date(s.createdAt || now).getTime();
        if (songAge > MAX_AGE_MS) {
          const [songRecord] = await db.select({ userId: songs.userId }).from(songs).where(eq(songs.id, s.id));
          await db.update(songs).set({ status: "failed", error: "Generation timed out - please try again" }).where(eq(songs.id, s.id));
          console.log(`[Recovery] Marked song ${s.id} as failed (was "${s.status}", age ${Math.round(songAge/60000)}min, no audio)`);
          if (songRecord?.userId) {
            try {
              await db.update(users).set({ credits: sql`${users.credits} + 1` }).where(eq(users.id, songRecord.userId));
              console.log(`[Recovery] Refunded 1 credit to user ${songRecord.userId} for timed-out song ${s.id}`);
            } catch (refundErr) {
              console.log(`[Recovery] Credit refund failed for song ${s.id}:`, (refundErr as any).message);
            }
          }
        } else {
          console.log(`[Recovery] Keeping song ${s.id} as "${s.status}" (age ${Math.round(songAge/60000)}min, GPU may still be working)`);
        }
      }
    }
    console.log(`[Recovery] Checked ${stuckSongs.length} stuck songs`);
  } catch (err) {
    console.log("[Recovery] Could not check stuck songs:", (err as any).message);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  await setupAuth(app);
  registerAuthRoutes(app);

  recoverStuckSongs();
  setInterval(() => recoverStuckSongs(), 5 * 60 * 1000);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // ========== MUSIC ROUTES ==========

  app.get(api.songs.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const songs = await storage.getUserSongs(userId);
    res.json(songs);
  });

  app.get(api.songs.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const song = await storage.getSong(Number(req.params.id));
    if (!song) return res.sendStatus(404);
    const userId = (req.user as any).claims.sub;
    if (song.userId !== userId && !song.isPublic) {
      return res.sendStatus(403);
    }
    res.json(song);
  });

  app.get("/api/user/credits", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.sendStatus(404);
    const isUnlimited = user.subscriptionTier === "premium" || user.role === "super_admin" || user.role === "admin";
    res.json({ credits: user.credits, tier: user.subscriptionTier || "free", isUnlimited });
  });

  app.post(api.songs.generate.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;

    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const isUnlimited = user.subscriptionTier === "premium" || user.role === "super_admin" || user.role === "admin";

      if (!isUnlimited) {
        const remaining = await storage.deductCredit(userId);
        if (remaining === -1) {
          return res.status(403).json({
            error: "No credits remaining",
            message: "You've used all your credits. Upgrade your plan for more.",
            credits: 0,
          });
        }
      }

      const input = api.songs.generate.input.parse(req.body);
      const rawDuration = Number(req.body.duration) || 180;
      const duration = Math.max(30, Math.min(rawDuration, 300));
      const lyrics = (req.body.lyrics as string) || undefined;
      const mode = input.mode || "standard";
      const style = input.style || "Bachata";
      const genre = input.genre || undefined;
      const styleKitId = req.body.styleKitId ? Number(req.body.styleKitId) : undefined;

      let finalPrompt: string;
      let songTitle: string;

      if (styleKitId) {
        const kit = await storage.getStyleKit(styleKitId);
        if (kit) {
          const instruments = await storage.getStyleKitInstruments(kit.id);
          songTitle = (input.title || input.prompt || "Untitled").trim();
          finalPrompt = buildStyleKitPrompt(
            input.prompt || songTitle,
            kit.name,
            kit.genre,
            instruments
          );
        } else {
          songTitle = (input.title || input.prompt || "Untitled").trim();
          finalPrompt = `${songTitle}, ${genre || style} style, high fidelity, studio quality`;
        }
      } else if (mode === "aggregate") {
        songTitle = (input.title || input.prompt || "Untitled").trim();
        finalPrompt = `${songTitle}, ${genre || style} style, high fidelity, studio quality`;
      } else {
        songTitle = input.prompt.slice(0, 50) + (input.prompt.length > 50 ? "..." : "");
        finalPrompt = input.prompt;
      }

      const pairId = `pair_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const song1 = await storage.createSong({
        userId,
        title: songTitle,
        prompt: finalPrompt,
        genre: genre || null,
        mode,
        pairId,
        variationLabel: "A",
      });

      const song2 = await storage.createSong({
        userId,
        title: songTitle,
        prompt: finalPrompt,
        genre: genre || null,
        mode,
        pairId,
        variationLabel: "B",
      });

      const makeInstrumental = req.body.make_instrumental === true;

      processMusicGeneration(song1.id, finalPrompt, {
        style,
        duration,
        lyrics,
        instrumental: makeInstrumental,
      });

      setTimeout(() => {
        processMusicGeneration(song2.id, finalPrompt, {
          style,
          duration,
          lyrics,
          instrumental: makeInstrumental,
        });
      }, 20000);

      const remainingCredits = isUnlimited ? -1 : await storage.getUserCredits(userId);
      res.status(202).json({ ...song1, pairId, remainingCredits });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/songs/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const song = await storage.getSong(Number(req.params.id));
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    await storage.deleteSong(song.id);
    res.sendStatus(204);
  });

  app.patch("/api/songs/:id/publish", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const song = await storage.getSong(Number(req.params.id));
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    const updated = await storage.toggleSongPublic(song.id);
    res.json(updated);
  });

  // ========== AUDIO ENGINE WEBHOOK ==========

  app.post("/api/webhooks/musicgpt", async (req, res) => {
    try {
      const payload = req.body;
      const subtype = payload.subtype;
      console.log(`[Webhook] Received audio engine webhook (subtype: ${subtype || "audio"}):`, JSON.stringify(payload).substring(0, 500));

      const taskId = payload.task_id;
      if (!taskId) {
        console.log("[Webhook] No task_id in payload, ignoring");
        return res.sendStatus(200);
      }

      let song = await storage.getSongByTaskId(taskId);
      if (!song) {
        const songId = pendingTaskMap.get(taskId);
        if (songId) {
          song = await storage.getSong(songId);
          if (song) {
            await storage.updateSongTaskId(song.id, taskId);
          }
        }
      }
      if (!song) {
        console.log(`[Webhook] No song found for task_id ${taskId}, ignoring`);
        return res.sendStatus(200);
      }

      if (subtype === "album_cover_generation" && payload.image_path) {
        console.log(`[Webhook] Song ${song.id} - saving album cover: ${payload.image_path}`);
        await storage.updateSongImage(song.id, payload.image_path);
        return res.sendStatus(200);
      }

      if (subtype === "lyrics_timestamped") {
        console.log(`[Webhook] Song ${song.id} - received timestamped lyrics, skipping`);
        return res.sendStatus(200);
      }

      if (payload.success === false) {
        const errorMsg = payload.status_msg || payload.error || "Generation failed";
        console.log(`[Webhook] Song ${song.id} failed: ${errorMsg}`);
        await storage.updateSongStatus(song.id, "failed", undefined, errorMsg);
        pendingTaskMap.delete(taskId);
        return res.sendStatus(200);
      }

      const audioUrl = payload.conversion_path || payload.conversion_path_wav || payload.audio_url;
      if (!audioUrl) {
        console.log(`[Webhook] Song ${song.id} - no audio URL in payload, skipping`);
        return res.sendStatus(200);
      }

      if (song.status === "completed") {
        console.log(`[Webhook] Song ${song.id} already completed, ignoring duplicate`);
        return res.sendStatus(200);
      }

      console.log(`[Webhook] Song ${song.id} completed! Downloading audio from ${audioUrl}...`);
      const localUrl = await downloadMusicGPTFile(audioUrl, "songs", "song");
      const duration = payload.conversion_duration ? Math.round(payload.conversion_duration) : null;
      await storage.updateSongStatus(song.id, "completed", localUrl);

      if (duration) {
        try {
          const { db } = await import("./db");
          const { songs: songsTable } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(songsTable).set({ duration }).where(eq(songsTable.id, song.id));
        } catch {}
      }

      pendingTaskMap.delete(taskId);
      console.log(`[Webhook] Song ${song.id} saved: ${localUrl} (duration: ${duration}s)`);

      res.sendStatus(200);
    } catch (err: any) {
      console.error("[Webhook] Error processing webhook:", err);
      res.sendStatus(200);
    }
  });

  app.post("/api/webhooks/runpod-music", async (req, res) => {
    try {
      const payload = req.body;
      const songId = payload.songId;
      console.log(`[Webhook] RunPod music webhook received for song ${songId}, status: ${payload.status}`);

      if (!songId) {
        console.log("[Webhook] No songId in RunPod music payload, ignoring");
        return res.sendStatus(200);
      }

      const song = await storage.getSong(songId);
      if (!song) {
        console.log(`[Webhook] No song found with id ${songId}`);
        return res.sendStatus(200);
      }

      const existingTimeout = pendingRunPodSongs.get(songId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        pendingRunPodSongs.delete(songId);
      }

      if (payload.status === "failed") {
        if (song.status === "completed") {
          console.log(`[Webhook] Song ${songId} already completed, ignoring failure`);
          return res.sendStatus(200);
        }
        const errorMsg = payload.error || "GPU generation failed";
        const engine = payload.engine || (song.taskId?.startsWith("heartmula_") ? "heartmula" : "unknown");
        console.error(`[Webhook] Song ${songId} GPU ERROR (${engine}): ${errorMsg}`);

        if (engine === "heartmula") {
          console.log(`[Webhook] HeartMuLa failed for song ${songId}, attempting SAO fallback...`);
          try {
            const { submitRunPodMusicGeneration, canUseRunPodMusic } = await import("./core/runpod_music_engine");
            if (canUseRunPodMusic()) {
              await storage.updateSongStatus(songId, "processing", undefined, "Switching to instrumental engine...");
              const saoResult = await submitRunPodMusicGeneration(songId, song.prompt || "", song.duration || 180);
              if (saoResult.success) {
                await storage.updateSongTaskId(songId, saoResult.jobId);
                console.log(`[Webhook] SAO fallback submitted for song ${songId}: ${saoResult.jobId}`);
                startRunPodTimeout(songId, 300000);
                return res.sendStatus(200);
              }
              console.log(`[Webhook] SAO fallback also failed: ${saoResult.error}`);
            }
          } catch (fallbackErr: any) {
            console.log(`[Webhook] SAO fallback error: ${fallbackErr.message}`);
          }
        }

        const isGpuSetupError = errorMsg.includes("No module") || errorMsg.includes("ImportError") || errorMsg.includes("not available") || errorMsg.includes("CUDA");
        const userError = isGpuSetupError
          ? "El motor de música necesita configuración en el GPU. Contacta al administrador."
          : errorMsg.substring(0, 300);
        await storage.updateSongStatus(songId, "failed", undefined, userError);
        return res.sendStatus(200);
      }

      if (payload.status === "completed" && payload.audioBase64) {
        console.log(`[Webhook] Song ${songId} completed! Saving audio (${payload.fileSize ? (payload.fileSize / 1024 / 1024).toFixed(1) + 'MB' : 'unknown size'})...`);

        const audioFormat = payload.audioFormat || "mp3";
        const localUrl = await saveRunPodAudio(payload.audioBase64, songId, audioFormat);
        const duration = payload.duration || null;

        await storage.updateSongStatus(songId, "completed", localUrl);

        if (duration) {
          try {
            const { db } = await import("./db");
            const { songs: songsTable } = await import("@shared/schema");
            const { eq } = await import("drizzle-orm");
            await db.update(songsTable).set({ duration }).where(eq(songsTable.id, songId));
          } catch {}
        }

        console.log(`[Webhook] Song ${songId} saved: ${localUrl} (gen time: ${payload.generationTime}s, device: ${payload.device})`);
      }

      res.sendStatus(200);
    } catch (err: any) {
      console.error("[Webhook] Error processing RunPod music webhook:", err);
      res.sendStatus(200);
    }
  });

  // ========== RUNPOD STEMS WEBHOOK ==========

  app.post("/api/webhooks/runpod-stems", async (req, res) => {
    try {
      const expectedSecret = getStemsWebhookSecret();
      if (expectedSecret) {
        const incomingSecret = req.headers["x-webhook-secret"] as string;
        if (incomingSecret !== expectedSecret) {
          console.log("[Webhook] Stems webhook: invalid secret, rejecting");
          return res.sendStatus(403);
        }
      }

      const payload = req.body;
      const songId = payload.songId;
      console.log(`[Webhook] RunPod stems webhook received for song ${songId}, status: ${payload.status}`);

      if (!songId) {
        console.log("[Webhook] No songId in stems payload, ignoring");
        return res.sendStatus(200);
      }

      const tracks = await storage.getTracksBySongId(songId);
      if (tracks.length === 0) {
        console.log(`[Webhook] No tracks found for song ${songId}`);
        return res.sendStatus(200);
      }

      if (payload.status === "failed") {
        const errorMsg = payload.error || "Cloud GPU stem separation failed";
        console.log(`[Webhook] Stems failed for song ${songId}: ${errorMsg}`);
        for (const track of tracks) {
          if (track.status === "processing" || track.status === "pending") {
            await storage.updateTrackStatus(track.id, "failed", undefined, errorMsg);
          }
        }
        return res.sendStatus(200);
      }

      if (payload.status === "completed" && payload.stems) {
        const stemKeys = Object.keys(payload.stems);
        console.log(`[Webhook] Stems completed for song ${songId}! Received: ${stemKeys.join(", ")}`);

        const stemTypeMapping: Record<string, string> = {
          vocals: "vocals",
          drums: "drums",
          bass: "bass",
          other: "other",
          instrumental: "other",
        };

        const processedTrackIds = new Set<number>();

        for (const [stemName, stemData] of Object.entries(payload.stems) as [string, any][]) {
          const trackType = stemTypeMapping[stemName];
          if (!trackType) continue;

          const track = tracks.find(t => t.type === trackType && !processedTrackIds.has(t.id));
          if (!track) continue;
          processedTrackIds.add(track.id);

          try {
            const localUrl = await saveStemAudio(
              stemData.audioBase64,
              songId,
              stemName,
              stemData.format || "wav"
            );
            await storage.updateTrackStatus(track.id, "completed", localUrl);
            console.log(`[Webhook] Stem ${stemName} saved: ${localUrl}`);
          } catch (saveErr: any) {
            console.error(`[Webhook] Failed to save stem ${stemName}:`, saveErr.message);
            await storage.updateTrackStatus(track.id, "failed", undefined, saveErr.message);
          }
        }

        for (const track of tracks) {
          if (!processedTrackIds.has(track.id) && (track.status === "processing" || track.status === "pending")) {
            await storage.updateTrackStatus(track.id, "completed", undefined);
            console.log(`[Webhook] Stem ${track.type}: no data from Demucs, marked completed (no audio)`);
          }
        }

        console.log(`[Webhook] All stems processed for song ${songId}`);
      }

      res.sendStatus(200);
    } catch (err: any) {
      console.error("[Webhook] Error processing stems webhook:", err);
      res.sendStatus(200);
    }
  });

  // ========== TRACKS / STEMS ROUTES ==========

  app.post("/api/songs/:id/stems", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const songId = Number(req.params.id);
    const song = await storage.getSong(songId);
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    if (song.status !== "completed" || !song.audioUrl) {
      return res.status(400).json({ message: "Song must be completed with audio before stem separation" });
    }

    const existingTracks = await storage.getTracksBySongId(songId);
    if (existingTracks.length > 0) {
      const allFailed = existingTracks.every(t => t.status === "failed");
      if (allFailed) {
        await storage.deleteTracksBySongId(songId);
      } else {
        return res.status(400).json({ message: "Stems already exist for this song", tracks: existingTracks });
      }
    }

    processStemSeparation(songId, song.audioUrl, userId);
    res.status(202).json({ message: "Stem separation started", songId });
  });

  app.get("/api/songs/:id/tracks", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const songId = Number(req.params.id);
    const song = await storage.getSong(songId);
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId && !song.isPublic) return res.sendStatus(403);
    const songTracks = await storage.getTracksBySongId(songId);
    res.json(songTracks);
  });

  app.get("/api/tracks", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const userTracks = await storage.getUserTracks(userId);
    res.json(userTracks);
  });

  const trackSettingsSchema = z.object({
    volume: z.number().min(0).max(100).optional(),
    isMuted: z.boolean().optional(),
    isSolo: z.boolean().optional(),
  });

  app.patch("/api/tracks/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const trackId = Number(req.params.id);

    const track = await storage.getTrack(trackId);
    if (!track) return res.sendStatus(404);
    if (track.userId !== userId) return res.sendStatus(403);

    try {
      const settings = trackSettingsSchema.parse(req.body);
      const updated = await storage.updateTrackSettings(trackId, settings);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update track settings" });
    }
  });

  // ========== LYRICS ROUTES ==========

  app.post(api.lyrics.generate.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;

    try {
      console.log(`[Lyrics] Generating lyrics for user ${userId}`, req.body);
      const input = api.lyrics.generate.input.parse(req.body);

      const lyricsContent = await generateCreativeLyrics(
        input.theme,
        input.style as "romantic" | "dance" | "heartbreak"
      );

      console.log(`[Lyrics] Generated ${lyricsContent.length} chars of lyrics`);

      const lyric = await storage.createLyric({
        userId,
        songId: null,
        theme: input.theme,
        style: input.style,
        content: lyricsContent,
      });

      res.json(lyric);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("[Lyrics] Error:", err.message || err);
      res.status(500).json({ message: err.message || "Internal server error" });
    }
  });

  // ========== QUIZ ROUTES ==========

  app.get("/api/quiz", async (req, res) => {
    const category = req.query.category as string | undefined;
    const count = Number(req.query.count) || 5;

    if (category && ["history", "instruments", "artists", "rhythm", "culture"].includes(category)) {
      const questions = getQuizByCategory(category as any);
      return res.json(questions);
    }

    const questions = getRandomQuiz(count);
    res.json(questions);
  });

  const quizSubmitSchema = z.object({
    answers: z.record(z.string(), z.number()),
    category: z.string().optional(),
  });

  app.post("/api/quiz/submit", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;

    try {
      const parsed = quizSubmitSchema.parse(req.body);
      const numericAnswers: Record<number, number> = {};
      for (const [k, v] of Object.entries(parsed.answers)) {
        numericAnswers[Number(k)] = v;
      }
      const result = evaluateQuiz(numericAnswers);

      const saved = await storage.saveQuizResult({
        userId,
        score: result.score,
        total: result.total,
        percentage: result.percentage,
        category: parsed.category || null,
      });

      res.json({ ...result, id: saved.id });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error(err);
      res.status(500).json({ message: "Failed to submit quiz" });
    }
  });

  app.get("/api/quiz/results", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const results = await storage.getUserQuizResults(userId);
    res.json(results);
  });

  app.get("/api/quiz/styles", (_req, res) => {
    const musicGPTStyles = [
      "Pop", "Rock", "Hip Hop", "R&B", "EDM", "Jazz", "Blues", "Country",
      "Reggaeton", "Bachata", "Salsa", "Afrobeat", "K-pop", "Indie",
      "Classical", "Soul", "Funk", "House", "Drum & Bass", "Synthwave"
    ];
    res.json(musicGPTStyles);
  });

  // ========== SAMPLE LAB ROUTES ==========

  const audioDir = path.join(process.cwd(), "public", "audio");
  if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, audioDir),
      filename: (_req, _file, cb) => {
        const ext = path.extname(_file.originalname) || ".wav";
        cb(null, `${uuidv4()}${ext}`);
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [".wav", ".mp3", ".ogg", ".webm", ".m4a", ".flac"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext) || file.mimetype.startsWith("audio/")) {
        cb(null, true);
      } else {
        cb(new Error("Only audio files are allowed"));
      }
    },
  });

  app.get("/api/samples", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const userSamples = await storage.getUserSamples(userId);
    res.json(userSamples);
  });

  const uploadSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    bpm: z.coerce.number().int().min(20).max(300).optional(),
    key: z.string().max(10).optional(),
    duration: z.coerce.number().min(0).max(3600).optional(),
  });

  app.post("/api/samples/upload", upload.single("audio"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;

    if (!req.file) {
      return res.status(400).json({ message: "No audio file provided" });
    }

    try {
      const parsed = uploadSchema.parse(req.body);
      const name = parsed.name || req.file.originalname || "Untitled Sample";
      const audioUrl = `/audio/${req.file.filename}`;

      const sample = await storage.createSample({
        userId,
        name,
        type: "audio",
        sourceType: "upload",
        audioUrl,
        status: "ready",
        bpm: parsed.bpm ?? null,
        key: parsed.key ?? null,
        duration: parsed.duration ? Math.round(parsed.duration) : null,
        parentId: null,
        position: 0,
      });

      res.status(201).json(sample);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("[SampleLab] Upload error:", err.message);
      res.status(500).json({ message: "Failed to save sample" });
    }
  });

  const recordSchema = z.object({
    audioData: z.string().min(1),
    name: z.string().max(200).optional(),
    duration: z.number().min(0).max(3600).optional(),
  });

  app.post("/api/samples/record", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;

    try {
      const parsed = recordSchema.parse(req.body);

      const base64Data = parsed.audioData.replace(/^data:audio\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const fileName = `${uuidv4()}.webm`;
      const filePath = path.join(audioDir, fileName);
      fs.writeFileSync(filePath, buffer);

      const sample = await storage.createSample({
        userId,
        name: parsed.name || "Recording",
        type: "audio",
        sourceType: "recording",
        audioUrl: `/audio/${fileName}`,
        status: "ready",
        duration: parsed.duration ? Math.round(parsed.duration) : null,
        bpm: null,
        key: null,
        parentId: null,
        position: 0,
      });

      res.status(201).json(sample);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("[SampleLab] Record error:", err.message);
      res.status(500).json({ message: "Failed to save recording" });
    }
  });

  const hummingSchema = z.object({
    sampleId: z.number(),
    prompt: z.string().min(1),
    style: z.string().optional(),
    duration: z.number().min(5).max(30).optional(),
  });

  app.post("/api/samples/transform", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;

    try {
      const input = hummingSchema.parse(req.body);
      const sourceSample = await storage.getSample(input.sampleId);
      if (!sourceSample) return res.sendStatus(404);
      if (sourceSample.userId !== userId) return res.sendStatus(403);
      if (!sourceSample.audioUrl) return res.status(400).json({ message: "Source sample has no audio" });

      const style = input.style || "Bachata";
      const promptWithStyle = `${input.prompt}, ${style} style`;

      const newSample = await storage.createSample({
        userId,
        name: `${sourceSample.name} (AI Transform)`,
        type: "audio",
        sourceType: "ai-transform",
        parentId: sourceSample.id,
        bpm: null,
        key: null,
        duration: null,
        position: 0,
      });

      processHummingToMusic(
        newSample.id,
        sourceSample.audioUrl,
        promptWithStyle,
        input.duration || 15
      );

      res.status(202).json(newSample);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("[SampleLab] Transform error:", err.message);
      res.status(500).json({ message: "Failed to start transformation" });
    }
  });

  app.delete("/api/samples/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const sample = await storage.getSample(Number(req.params.id));
    if (!sample) return res.sendStatus(404);
    if (sample.userId !== userId) return res.sendStatus(403);
    await storage.deleteSample(sample.id);
    res.sendStatus(204);
  });

  const updateSampleSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    bpm: z.number().int().min(20).max(300).optional(),
    key: z.string().max(10).optional(),
    position: z.number().int().min(0).optional(),
  });

  app.patch("/api/samples/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const sample = await storage.getSample(Number(req.params.id));
    if (!sample) return res.sendStatus(404);
    if (sample.userId !== userId) return res.sendStatus(403);

    try {
      const parsed = updateSampleSchema.parse(req.body);
      const updated = await storage.updateSample(sample.id, parsed);
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update sample" });
    }
  });

  // ========== MUSICGPT AUDIO PROCESSING ROUTES ==========

  app.post("/api/songs/:id/master", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const songId = Number(req.params.id);
    const song = await storage.getSong(songId);
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    if (song.status !== "completed" || !song.audioUrl) {
      return res.status(400).json({ message: "Song must be completed with audio before mastering" });
    }

    processMastering(songId, song.audioUrl);
    res.status(202).json({ message: "Audio mastering started", songId });
  });

  app.post("/api/songs/:id/denoise", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const songId = Number(req.params.id);
    const song = await storage.getSong(songId);
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    if (song.status !== "completed" || !song.audioUrl) {
      return res.status(400).json({ message: "Song must be completed with audio before denoising" });
    }

    processDenoise(songId, song.audioUrl);
    res.status(202).json({ message: "Audio denoising started", songId });
  });

  const coverSchema = z.object({
    voiceId: z.string().min(1).max(500),
    pitch: z.coerce.number().min(-12).max(12).optional(),
  });

  app.post("/api/songs/:id/cover", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const songId = Number(req.params.id);
    const song = await storage.getSong(songId);
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    if (song.status !== "completed" || !song.audioUrl) {
      return res.status(400).json({ message: "Song must be completed with audio before creating a cover" });
    }

    try {
      const input = coverSchema.parse(req.body);
      processCoverSong(songId, song.audioUrl, input.voiceId, userId, input.pitch);
      res.status(202).json({ message: "Cover song generation started", songId });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to start cover generation" });
    }
  });

  const trimSchema = z.object({
    startTimeMs: z.coerce.number().min(0).max(86400000),
    endTimeMs: z.coerce.number().min(100).max(86400000),
  }).refine(data => data.endTimeMs > data.startTimeMs, {
    message: "End time must be greater than start time",
  }).refine(data => (data.endTimeMs - data.startTimeMs) >= 500, {
    message: "Trimmed audio must be at least 0.5 seconds",
  });

  app.post("/api/songs/:id/trim", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const songId = Number(req.params.id);
    const song = await storage.getSong(songId);
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    if (song.status !== "completed" || !song.audioUrl) {
      return res.status(400).json({ message: "Song must be completed with audio before trimming" });
    }

    try {
      const input = trimSchema.parse(req.body);
      processAudioCut(songId, song.audioUrl, input.startTimeMs, input.endTimeMs, userId);
      res.status(202).json({ message: "Audio trimming started", songId });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to start audio trimming" });
    }
  });

  app.post("/api/samples/:id/key-bpm", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const sampleId = Number(req.params.id);
    const sample = await storage.getSample(sampleId);
    if (!sample) return res.sendStatus(404);
    if (sample.userId !== userId) return res.sendStatus(403);
    if (!sample.audioUrl) {
      return res.status(400).json({ message: "Sample must have audio for Key/BPM detection" });
    }

    processKeyBPMDetection(sampleId, sample.audioUrl);
    res.status(202).json({ message: "Key/BPM detection started", sampleId });
  });

  // ========== ADMIN: API PROVIDER MANAGEMENT ==========

  const ADMIN_USER_ID = process.env.ADMIN_USER_ID;
  if (!ADMIN_USER_ID) {
    console.warn("[Admin] WARNING: ADMIN_USER_ID env var not set. Admin panel will be inaccessible. Set it to your Replit user ID to enable admin access.");
  }

  async function getUserRole(req: any): Promise<string> {
    if (!req.isAuthenticated()) return "user";
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) return "user";
    if (userId === ADMIN_USER_ID) return "super_admin";
    const user = await storage.getUser(userId);
    return user?.role || "user";
  }

  function isAdmin(req: any): boolean {
    if (!req.isAuthenticated()) return false;
    const userId = (req.user as any)?.claims?.sub;
    if (userId === ADMIN_USER_ID) return true;
    return false;
  }

  async function hasRole(req: any, minRole: "super_admin" | "admin" | "moderator"): Promise<boolean> {
    const role = await getUserRole(req);
    const hierarchy: Record<string, number> = { super_admin: 3, admin: 2, moderator: 1, user: 0 };
    return (hierarchy[role] || 0) >= (hierarchy[minRole] || 0);
  }

  async function requireRole(req: any, res: any, minRole: "super_admin" | "admin" | "moderator"): Promise<boolean> {
    if (!req.isAuthenticated()) { res.sendStatus(401); return false; }
    if (!(await hasRole(req, minRole))) { res.sendStatus(403); return false; }
    return true;
  }

  seedDefaultMusicGPTProvider().catch((err: any) =>
    console.log("[Seed] Provider seed error:", err.message?.substring(0, 100))
  );

  seedDgbRunPodProvider().catch((err: any) =>
    console.log("[Seed] DGB Cloud seed error:", err.message?.substring(0, 100))
  );

  seedReplicateProvider().catch((err: any) =>
    console.log("[Seed] Replicate seed error:", err.message?.substring(0, 100))
  );

  seedMurekaProvider().catch((err: any) =>
    console.log("[Seed] Mureka seed error:", err.message?.substring(0, 100))
  );

  seedTrainingKits().catch((err: any) =>
    console.log("[Seed] Training kits seed error:", err.message?.substring(0, 100))
  );

  app.get("/api/admin/check", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const role = await getUserRole(req);
    const isAdminUser = role === "super_admin" || role === "admin" || role === "moderator";
    res.json({ isAdmin: isAdminUser, role });
  });

  app.get("/api/admin/meta", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    res.json({
      operationTypes: OPERATION_TYPES,
      providerCategories: PROVIDER_CATEGORIES,
      authTypes: AUTH_TYPES,
    });
  });

  app.get("/api/admin/providers", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    const providers = await storage.getApiProviders();
    res.json(providers);
  });

  app.get("/api/admin/providers/:id", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    const provider = await storage.getApiProvider(Number(req.params.id));
    if (!provider) return res.sendStatus(404);
    res.json(provider);
  });

  app.post("/api/admin/providers", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const data = insertApiProviderSchema.parse(req.body);
      const provider = await storage.createApiProvider(data);
      res.status(201).json(provider);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to create provider" });
    }
  });

  const updateProviderSchema = z.object({
    name: z.string().min(1).optional(),
    baseUrl: z.string().url().optional(),
    authType: z.enum(["raw", "bearer", "header", "query", "none"]).optional(),
    authHeaderName: z.string().optional(),
    apiKeyValue: z.string().optional().nullable(),
    apiKeyEnvVar: z.string().optional().nullable(),
    category: z.enum(["music", "lyrics", "image", "audio_processing", "voice"]).optional(),
    isActive: z.boolean().optional(),
    defaultHeaders: z.record(z.string()).optional().nullable(),
    description: z.string().optional().nullable(),
  });

  app.patch("/api/admin/providers/:id", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    const id = Number(req.params.id);
    const existing = await storage.getApiProvider(id);
    if (!existing) return res.sendStatus(404);
    try {
      const data = updateProviderSchema.parse(req.body);
      const updated = await storage.updateApiProvider(id, data);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to update provider" });
    }
  });

  app.delete("/api/admin/providers/:id", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    const id = Number(req.params.id);
    const existing = await storage.getApiProvider(id);
    if (!existing) return res.sendStatus(404);
    await storage.deleteApiProvider(id);
    res.sendStatus(204);
  });

  app.get("/api/admin/endpoints", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    const providerId = req.query.providerId ? Number(req.query.providerId) : undefined;
    const endpoints = await storage.getApiEndpoints(providerId);
    res.json(endpoints);
  });

  app.get("/api/admin/endpoints/:id", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    const endpoint = await storage.getApiEndpoint(Number(req.params.id));
    if (!endpoint) return res.sendStatus(404);
    res.json(endpoint);
  });

  app.post("/api/admin/endpoints", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const data = insertApiEndpointSchema.parse(req.body);
      const endpoint = await storage.createApiEndpoint(data);
      res.status(201).json(endpoint);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to create endpoint" });
    }
  });

  const updateEndpointSchema = z.object({
    name: z.string().min(1).optional(),
    operationType: z.string().optional(),
    path: z.string().min(1).optional(),
    method: z.enum(["POST", "GET", "PUT", "PATCH"]).optional(),
    contentType: z.enum(["json", "formdata"]).optional(),
    requestMapping: z.record(z.any()).optional().nullable(),
    responseMapping: z.record(z.string()).optional().nullable(),
    pollPath: z.string().optional().nullable(),
    pollMethod: z.enum(["GET", "POST"]).optional(),
    pollResponseMapping: z.record(z.string()).optional().nullable(),
    conversionType: z.string().optional().nullable(),
    asyncPattern: z.enum(["polling", "webhook", "none"]).optional(),
    webhookSupported: z.boolean().optional(),
    isActive: z.boolean().optional(),
    description: z.string().optional().nullable(),
  });

  app.patch("/api/admin/endpoints/:id", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    const id = Number(req.params.id);
    const existing = await storage.getApiEndpoint(id);
    if (!existing) return res.sendStatus(404);
    try {
      const data = updateEndpointSchema.parse(req.body);
      const updated = await storage.updateApiEndpoint(id, data);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to update endpoint" });
    }
  });

  app.delete("/api/admin/endpoints/:id", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    const id = Number(req.params.id);
    const existing = await storage.getApiEndpoint(id);
    if (!existing) return res.sendStatus(404);
    await storage.deleteApiEndpoint(id);
    res.sendStatus(204);
  });

  app.post("/api/admin/endpoints/:id/test", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    const endpoint = await storage.getApiEndpoint(Number(req.params.id));
    if (!endpoint) return res.sendStatus(404);
    const provider = await storage.getApiProvider(endpoint.providerId);
    if (!provider) return res.status(400).json({ message: "Provider not found" });

    try {
      const apiKey = provider.apiKeyEnvVar ? process.env[provider.apiKeyEnvVar] : provider.apiKeyValue;
      if (!apiKey) {
        return res.json({ success: false, message: "No API key configured" });
      }

      const headers: Record<string, string> = {};
      switch (provider.authType) {
        case "bearer": headers[provider.authHeaderName || "Authorization"] = `Bearer ${apiKey}`; break;
        case "raw": case "header": headers[provider.authHeaderName || "Authorization"] = apiKey; break;
      }

      const testUrl = `${provider.baseUrl}${endpoint.pollPath || "/byId"}`;
      const response = await fetch(testUrl, { method: "GET", headers });

      res.json({
        success: response.status < 500,
        statusCode: response.status,
        message: response.status < 500 ? "Connection successful" : `Server error: ${response.status}`,
      });
    } catch (err: any) {
      res.json({ success: false, message: err.message || "Connection failed" });
    }
  });

  // ========== ADMIN: EXPANDED DASHBOARD ==========

  app.get("/api/admin/stats", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const stats = await storage.getAdminStats();
      const subscriptions = await storage.getStripeSubscriptions();
      const activeSubscriptions = subscriptions.filter((s: any) => s.status === "active" || s.status === "trialing");
      res.json({
        ...stats,
        totalSubscriptions: subscriptions.length,
        activeSubscriptions: activeSubscriptions.length,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/users/:id/role", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    const { role } = req.body;
    const validRoles = ["super_admin", "admin", "moderator", "user"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be one of: " + validRoles.join(", ") });
    }
    try {
      const updated = await storage.updateUserRole(req.params.id, role);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/subscriptions", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const subs = await storage.getStripeSubscriptions();
      res.json(subs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/products", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const products = await storage.getStripeProducts();
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== ADMIN: PLATFORM SETTINGS ==========

  app.get("/api/admin/settings", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const category = req.query.category as string | undefined;
      const settings = await storage.getPlatformSettings(category);
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/admin/settings", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const data = insertPlatformSettingSchema.parse(req.body);
      const setting = await storage.upsertPlatformSetting(data);
      res.json(setting);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/admin/settings/bulk", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const { settings } = req.body;
      if (!Array.isArray(settings)) return res.status(400).json({ message: "settings array required" });
      const results = [];
      for (const s of settings) {
        const data = insertPlatformSettingSchema.parse(s);
        results.push(await storage.upsertPlatformSetting(data));
      }
      res.json(results);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/settings/:key", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      await storage.deletePlatformSetting(req.params.key);
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/settings/meta", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    res.json({ categories: SETTING_CATEGORIES });
  });

  // ========== ADMIN: ANALYTICS ==========

  app.get("/api/admin/analytics", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const analytics = await storage.getAnalytics();
      res.json(analytics);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== ADMIN: SUPPORT TICKETS ==========

  app.get("/api/admin/tickets/meta", async (req, res) => {
    if (!(await requireRole(req, res, "moderator"))) return;
    res.json({ statuses: TICKET_STATUSES, priorities: TICKET_PRIORITIES });
  });

  app.get("/api/admin/tickets", async (req, res) => {
    if (!(await requireRole(req, res, "moderator"))) return;
    try {
      const status = req.query.status as string | undefined;
      const tickets = await storage.getSupportTickets(status);
      res.json(tickets);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/tickets/:id", async (req, res) => {
    if (!(await requireRole(req, res, "moderator"))) return;
    try {
      const ticket = await storage.getSupportTicket(Number(req.params.id));
      if (!ticket) return res.sendStatus(404);
      const messages = await storage.getSupportMessages(ticket.id);
      res.json({ ...ticket, messages });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/tickets/:id", async (req, res) => {
    if (!(await requireRole(req, res, "moderator"))) return;
    try {
      const ticket = await storage.updateSupportTicket(Number(req.params.id), req.body);
      res.json(ticket);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/tickets/:id/reply", async (req, res) => {
    if (!(await requireRole(req, res, "moderator"))) return;
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: "content required" });
    try {
      const ticket = await storage.getSupportTicket(Number(req.params.id));
      if (!ticket) return res.sendStatus(404);
      const message = await storage.createSupportMessage({
        ticketId: ticket.id,
        role: "admin",
        content,
      });
      if (ticket.status === "open") {
        await storage.updateSupportTicket(ticket.id, { status: "in_progress" });
      }
      res.status(201).json(message);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== USER: SUPPORT TICKETS ==========

  app.get("/api/support/tickets", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const tickets = await storage.getUserSupportTickets(userId);
      res.json(tickets);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/support/tickets/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const ticket = await storage.getSupportTicket(Number(req.params.id));
      if (!ticket || ticket.userId !== userId) return res.sendStatus(404);
      const messages = await storage.getSupportMessages(ticket.id);
      res.json({ ...ticket, messages });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/support/tickets", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const user = await storage.getUser(userId);
    const { subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ message: "subject and message required" });
    try {
      const ticket = await storage.createSupportTicket({
        userId,
        userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : undefined,
        userEmail: user?.email || undefined,
        subject,
        status: "open",
        priority: "normal",
      });
      await storage.createSupportMessage({ ticketId: ticket.id, role: "user", content: message });
      res.status(201).json(ticket);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/support/tickets/:id/message", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: "content required" });
    try {
      const ticket = await storage.getSupportTicket(Number(req.params.id));
      if (!ticket || ticket.userId !== userId) return res.sendStatus(404);
      const message = await storage.createSupportMessage({ ticketId: ticket.id, role: "user", content });
      res.status(201).json(message);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== STYLE KITS ==========

  app.get("/api/style-kits", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const genre = req.query.genre as string | undefined;
      const kits = genre
        ? await storage.getStyleKitsByGenre(genre)
        : await storage.getStyleKits();

      const kitsWithInstruments = await Promise.all(
        kits.map(async (kit) => ({
          ...kit,
          instruments: await storage.getStyleKitInstruments(kit.id),
        }))
      );
      res.json(kitsWithInstruments);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/style-kits/meta", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json({ genres: STYLE_KIT_GENRES, instrumentTypes: INSTRUMENT_TYPES });
  });

  app.get("/api/style-kits/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const kit = await storage.getStyleKit(Number(req.params.id));
      if (!kit) return res.sendStatus(404);
      const instruments = await storage.getStyleKitInstruments(kit.id);
      res.json({ ...kit, instruments });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/style-kits", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const userId = (req.user as any).claims.sub;
      const parsed = insertStyleKitSchema.parse({ ...req.body, createdBy: userId });
      const kit = await storage.createStyleKit(parsed);
      res.status(201).json(kit);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/style-kits/:id", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const kit = await storage.updateStyleKit(Number(req.params.id), req.body);
      res.json(kit);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/style-kits/:id", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      await storage.deleteStyleKit(Number(req.params.id));
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/style-kits/:kitId/instruments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const instruments = await storage.getStyleKitInstruments(Number(req.params.kitId));
      res.json(instruments);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/style-kits/:kitId/instruments", upload.single("audio"), async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const kitId = Number(req.params.kitId);
      const kit = await storage.getStyleKit(kitId);
      if (!kit) return res.sendStatus(404);

      const audioUrl = req.file ? `/audio/${req.file.filename}` : undefined;
      const parsed = insertStyleKitInstrumentSchema.parse({
        kitId,
        name: req.body.name,
        type: req.body.type || "other",
        audioUrl,
        description: req.body.description || null,
        volume: req.body.volume ? Number(req.body.volume) : 100,
        position: req.body.position ? Number(req.body.position) : 0,
      });
      const instrument = await storage.createStyleKitInstrument(parsed);
      res.status(201).json(instrument);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/style-kits/instruments/:id", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const instrument = await storage.updateStyleKitInstrument(Number(req.params.id), req.body);
      res.json(instrument);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/style-kits/instruments/:id", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      await storage.deleteStyleKitInstrument(Number(req.params.id));
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/style-kits/:id/analyze", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const kitId = Number(req.params.id);
      const kit = await storage.getStyleKit(kitId);
      if (!kit) return res.sendStatus(404);

      const instruments = await storage.getStyleKitInstruments(kitId);
      const withAudio = instruments.filter(i => i.audioUrl);
      if (withAudio.length === 0) {
        return res.status(400).json({ message: "Upload at least one instrument audio file before analysis." });
      }

      await storage.updateStyleKit(kitId, { pipelineStep: "analyze", trainingStatus: "analyzing" });

      for (const instr of withAudio) {
        await storage.updateStyleKitInstrument(instr.id, { analysisStatus: "queued" });
      }

      console.log(`[SAO Pipeline] Admin Kit ${kitId}: analysis started for ${withAudio.length} instruments`);

      if (isRunPodConfigured()) {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = req.headers["host"] || "localhost:5000";
        const analysisWebhookUrl = `${protocol}://${host}/api/analysis/webhook`;

        let submittedCount = 0;
        for (const instr of withAudio) {
          if (!instr.audioUrl) continue;
          await storage.updateStyleKitInstrument(instr.id, { analysisStatus: "analyzing" });
          const result = await submitAnalysisJob(instr.id, instr.audioUrl, instr.name, analysisWebhookUrl);
          if (result.success) {
            submittedCount++;
            console.log(`[SAO Pipeline] Analysis job submitted for instrument ${instr.id}: ${result.jobId}`);
          } else {
            await storage.updateStyleKitInstrument(instr.id, {
              analysisStatus: "failed",
              analysisError: `Cloud GPU submission failed: ${result.error}`,
            });
          }
        }

        console.log(`[SAO Pipeline] Kit ${kitId}: ${submittedCount}/${withAudio.length} analysis jobs sent to cloud GPU`);

        res.json({
          message: submittedCount > 0
            ? `Analysis submitted to cloud GPU for ${submittedCount} instruments.`
            : "No instruments could be submitted for analysis.",
          kitId,
          instrumentCount: withAudio.length,
          submittedCount,
          gpuConnected: true,
        });
      } else {
        const genreHint = GENRE_STYLE_HINTS[kit.genre] || kit.genre;
        for (const instr of withAudio) {
          try {
            await storage.updateStyleKitInstrument(instr.id, { analysisStatus: "analyzing" });
            const tags = [kit.genre, instr.type];
            if (genreHint) tags.push(genreHint.split(" ")[0]);
            await storage.updateStyleKitInstrument(instr.id, {
              analysisStatus: "complete",
              detectedTags: JSON.stringify(tags),
            });
          } catch (err: any) {
            await storage.updateStyleKitInstrument(instr.id, {
              analysisStatus: "failed",
              analysisError: err.message,
            });
          }
        }

        await storage.updateStyleKit(kitId, { pipelineStep: "prompt", trainingStatus: "prompting" });
        const updatedInstruments = await storage.getStyleKitInstruments(kitId);
        const analyzed = updatedInstruments.filter(i => i.audioUrl && i.analysisStatus === "complete");
        for (const instr of analyzed) {
          try {
            const prompt = await generateInstrumentPrompt(instr, kit.genre);
            await storage.updateStyleKitInstrument(instr.id, { generatedPrompt: prompt });
            console.log(`[SAO Pipeline] Prompt for "${instr.name}": ${prompt.substring(0, 80)}...`);
          } catch (err: any) {
            console.error(`[SAO Pipeline] Prompt generation failed for instrument ${instr.id}:`, err.message);
          }
        }

        const kitPrompt = await generateKitTrainingPrompt(kit, analyzed);
        await storage.updateStyleKit(kitId, { trainingPrompt: kitPrompt, pipelineStep: "train" });

        res.json({
          message: "Analysis and prompt generation complete. Kit is ready for training.",
          kitId,
          instrumentCount: withAudio.length,
          analyzedCount: analyzed.length,
          gpuConnected: false,
          pipelineStep: "train",
        });
      }
    } catch (err: any) {
      console.error("[SAO Pipeline] Admin analysis error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/style-kits/:id/train", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const kitId = Number(req.params.id);
      const kit = await storage.getStyleKit(kitId);
      if (!kit) return res.sendStatus(404);

      const instruments = await storage.getStyleKitInstruments(kitId);
      const withPrompts = instruments.filter(i => i.audioUrl && i.generatedPrompt);
      if (withPrompts.length === 0) {
        return res.status(400).json({ message: "Run analysis first to generate training prompts before training." });
      }

      const trainingConfig = buildTrainingConfig(kit, instruments);
      const configJson = JSON.stringify(trainingConfig, null, 2);

      await storage.updateStyleKit(kitId, {
        trainingStatus: "queued",
        trainingError: null,
        trainingConfig: configJson,
        pipelineStep: "train",
      });

      console.log(`[SAO Pipeline] Admin Kit ${kitId} queued for training with ${withPrompts.length} instruments`);

      if (isRunPodConfigured()) {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = req.headers["host"] || "localhost:5000";
        const webhookUrl = `${protocol}://${host}/api/training/webhook`;

        const result = await submitTrainingJob(kitId, trainingConfig, webhookUrl);
        if (result.success) {
          await storage.updateStyleKit(kitId, {
            trainingStatus: "training",
            trainingJobId: result.jobId || null,
          });
          console.log(`[SAO Pipeline] Admin training job submitted: ${result.jobId}`);
        } else {
          await storage.updateStyleKit(kitId, {
            trainingStatus: "failed",
            trainingError: `Cloud GPU submission failed: ${result.error}`,
          });
        }
      }

      res.json({
        message: isRunPodConfigured()
          ? "Training submitted to cloud GPU."
          : "Training queued. Awaiting cloud GPU connection.",
        kitId,
        status: isRunPodConfigured() ? "training" : "queued",
        instrumentCount: withPrompts.length,
        trainingConfig: {
          model_type: trainingConfig.model_type,
          sample_rate: trainingConfig.sample_rate,
          instruments: trainingConfig.dataset.instruments.length,
        },
      });
    } catch (err: any) {
      console.error("[SAO Pipeline] Admin training error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // ========== PRODUCER STORE (User Kit Management) ==========

  const isProducer = (req: any): boolean => {
    if (!req.isAuthenticated()) return false;
    return true;
  };

  const checkProducerTier = async (req: any, res: any): Promise<boolean> => {
    if (!req.isAuthenticated()) { res.sendStatus(401); return false; }
    const userId = (req.user as any).claims.sub;
    const user = await storage.getUser(userId);
    if (isAdmin(req)) return true;
    const tier = user?.subscriptionTier || "free";
    if (tier !== "producer" && tier !== "premium") {
      res.status(403).json({ message: "Producer subscription required. Upgrade to the Producer plan to upload your own instrument kits." });
      return false;
    }
    return true;
  };

  app.get("/api/producer/kits", async (req, res) => {
    if (!(await checkProducerTier(req, res))) return;
    const userId = (req.user as any).claims.sub;
    try {
      const kits = await storage.getStyleKitsByUser(userId);
      const kitsWithInstruments = await Promise.all(
        kits.map(async (kit) => ({
          ...kit,
          instruments: await storage.getStyleKitInstruments(kit.id),
        }))
      );
      res.json(kitsWithInstruments);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/producer/kits", async (req, res) => {
    if (!(await checkProducerTier(req, res))) return;
    const userId = (req.user as any).claims.sub;
    try {
      const parsed = insertStyleKitSchema.parse({
        ...req.body,
        createdBy: userId,
        trainingStatus: "pending",
      });
      const kit = await storage.createStyleKit(parsed);
      res.status(201).json(kit);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/producer/kits/:id", async (req, res) => {
    if (!(await checkProducerTier(req, res))) return;
    const userId = (req.user as any).claims.sub;
    try {
      const kit = await storage.getStyleKit(Number(req.params.id));
      if (!kit) return res.sendStatus(404);
      if (kit.createdBy !== userId && !isAdmin(req)) return res.sendStatus(403);
      const { trainingStatus, trainingJobId, trainedModelUrl, ...safeData } = req.body;
      const updated = await storage.updateStyleKit(Number(req.params.id), safeData);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/producer/kits/:id", async (req, res) => {
    if (!(await checkProducerTier(req, res))) return;
    const userId = (req.user as any).claims.sub;
    try {
      const kit = await storage.getStyleKit(Number(req.params.id));
      if (!kit) return res.sendStatus(404);
      if (kit.createdBy !== userId && !isAdmin(req)) return res.sendStatus(403);
      await storage.deleteStyleKit(kit.id);
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/producer/kits/:id/instruments", upload.single("audio"), async (req, res) => {
    if (!(await checkProducerTier(req, res))) return;
    const userId = (req.user as any).claims.sub;
    try {
      const kitId = Number(req.params.id);
      const kit = await storage.getStyleKit(kitId);
      if (!kit) return res.sendStatus(404);
      if (kit.createdBy !== userId && !isAdmin(req)) return res.sendStatus(403);

      const audioUrl = req.file ? `/audio/${req.file.filename}` : undefined;
      const parsed = insertStyleKitInstrumentSchema.parse({
        kitId,
        name: req.body.name,
        type: req.body.type || "other",
        audioUrl,
        description: req.body.description || null,
        volume: req.body.volume ? Number(req.body.volume) : 100,
        position: req.body.position ? Number(req.body.position) : 0,
        uploadStatus: "uploaded",
      });
      const instrument = await storage.createStyleKitInstrument(parsed);

      if (audioUrl) {
        await storage.updateStyleKit(kitId, { trainingStatus: "pending" });

        const cloudConfigured = await isCloudConfigured(storage);
        if (cloudConfigured) {
          const protocol = req.headers["x-forwarded-proto"] || "https";
          const host = req.headers["host"] || "localhost:5000";
          const webhookUrl = `${protocol}://${host}/api/dgb-cloud/webhook`;

          const activeServer = await getActiveServer(storage, "instrument_processing");
          console.log(`[Cloud] Forwarding instrument ${instrument.id} for GPU processing...`);
          const uploadResult = await uploadInstrumentToCloud(
            instrument.id,
            kitId,
            req.body.name,
            audioUrl,
            webhookUrl,
            activeServer || undefined
          );

          if (uploadResult.success) {
            await storage.updateStyleKitInstrument(instrument.id, {
              uploadStatus: "processing",
              analysisStatus: "analyzing",
            });
            console.log(`[Cloud] Instrument ${instrument.id} sent for analysis + MIDI conversion`);
          } else {
            console.error(`[Cloud] Upload failed: ${uploadResult.error}`);
          }
        }
      }

      res.status(201).json(instrument);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/producer/kits/:kitId/instruments/:id", async (req, res) => {
    if (!(await checkProducerTier(req, res))) return;
    const userId = (req.user as any).claims.sub;
    try {
      const kit = await storage.getStyleKit(Number(req.params.kitId));
      if (!kit) return res.sendStatus(404);
      if (kit.createdBy !== userId && !isAdmin(req)) return res.sendStatus(403);
      await storage.deleteStyleKitInstrument(Number(req.params.id));
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/producer/kits/:id/analyze", async (req, res) => {
    if (!(await checkProducerTier(req, res))) return;
    const userId = (req.user as any).claims.sub;
    try {
      const kitId = Number(req.params.id);
      const kit = await storage.getStyleKit(kitId);
      if (!kit) return res.sendStatus(404);
      if (kit.createdBy !== userId && !isAdmin(req)) return res.sendStatus(403);

      const instruments = await storage.getStyleKitInstruments(kitId);
      const withAudio = instruments.filter(i => i.audioUrl);
      if (withAudio.length === 0) {
        return res.status(400).json({ message: "Upload at least one instrument audio file before analysis." });
      }

      await storage.updateStyleKit(kitId, { pipelineStep: "analyze", trainingStatus: "analyzing" });

      for (const instr of withAudio) {
        await storage.updateStyleKitInstrument(instr.id, { analysisStatus: "queued" });
      }

      console.log(`[SAO Pipeline] Kit ${kitId}: analysis started for ${withAudio.length} instruments`);

      if (isRunPodConfigured()) {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = req.headers["host"] || "localhost:5000";
        const analysisWebhookUrl = `${protocol}://${host}/api/analysis/webhook`;

        let submittedCount = 0;
        for (const instr of withAudio) {
          if (!instr.audioUrl) continue;
          await storage.updateStyleKitInstrument(instr.id, { analysisStatus: "analyzing" });
          const result = await submitAnalysisJob(instr.id, instr.audioUrl, instr.name, analysisWebhookUrl);
          if (result.success) {
            submittedCount++;
            console.log(`[SAO Pipeline] Analysis job submitted for instrument ${instr.id}: ${result.jobId}`);
          } else {
            await storage.updateStyleKitInstrument(instr.id, {
              analysisStatus: "failed",
              analysisError: `Cloud GPU submission failed: ${result.error}`,
            });
          }
        }

        console.log(`[SAO Pipeline] Kit ${kitId}: ${submittedCount}/${withAudio.length} analysis jobs sent to cloud GPU`);

        const allComplete = submittedCount === 0;
        if (allComplete) {
          await storage.updateStyleKit(kitId, { pipelineStep: "prompt", trainingStatus: "prompting" });
        }

        res.json({
          message: submittedCount > 0
            ? `Analysis submitted to cloud GPU for ${submittedCount} instruments. Results will arrive via webhook.`
            : "No instruments could be submitted for analysis.",
          kitId,
          instrumentCount: withAudio.length,
          submittedCount,
          gpuConnected: true,
          pipelineStep: submittedCount > 0 ? "analyze" : "upload",
        });
      } else {
        const genreHint = GENRE_STYLE_HINTS[kit.genre] || kit.genre;
        for (const instr of withAudio) {
          try {
            await storage.updateStyleKitInstrument(instr.id, { analysisStatus: "analyzing" });
            const tags = [kit.genre, instr.type];
            if (genreHint) tags.push(genreHint.split(" ")[0]);
            await storage.updateStyleKitInstrument(instr.id, {
              analysisStatus: "complete",
              detectedTags: JSON.stringify(tags),
            });
          } catch (err: any) {
            await storage.updateStyleKitInstrument(instr.id, {
              analysisStatus: "failed",
              analysisError: err.message,
            });
          }
        }

        await storage.updateStyleKit(kitId, { pipelineStep: "prompt", trainingStatus: "prompting" });
        console.log(`[SAO Pipeline] Kit ${kitId}: generating training prompts (local fallback)...`);

        const updatedInstruments = await storage.getStyleKitInstruments(kitId);
        const analyzed = updatedInstruments.filter(i => i.audioUrl && i.analysisStatus === "complete");
        for (const instr of analyzed) {
          try {
            const prompt = await generateInstrumentPrompt(instr, kit.genre);
            await storage.updateStyleKitInstrument(instr.id, { generatedPrompt: prompt });
            console.log(`[SAO Pipeline] Prompt for "${instr.name}": ${prompt.substring(0, 80)}...`);
          } catch (err: any) {
            console.error(`[SAO Pipeline] Prompt generation failed for instrument ${instr.id}:`, err.message);
          }
        }

        const kitPrompt = await generateKitTrainingPrompt(kit, analyzed);
        await storage.updateStyleKit(kitId, { trainingPrompt: kitPrompt, pipelineStep: "train" });

        console.log(`[SAO Pipeline] Kit ${kitId}: prompts generated, ready for training`);

        res.json({
          message: "Analysis and prompt generation complete. Kit is ready for training.",
          kitId,
          instrumentCount: withAudio.length,
          analyzedCount: analyzed.length,
          gpuConnected: false,
          pipelineStep: "train",
        });
      }
    } catch (err: any) {
      console.error("[SAO Pipeline] Analysis error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/producer/kits/:id/train", async (req, res) => {
    if (!(await checkProducerTier(req, res))) return;
    const userId = (req.user as any).claims.sub;
    try {
      const kitId = Number(req.params.id);
      const kit = await storage.getStyleKit(kitId);
      if (!kit) return res.sendStatus(404);
      if (kit.createdBy !== userId && !isAdmin(req)) return res.sendStatus(403);

      const instruments = await storage.getStyleKitInstruments(kitId);
      const withPrompts = instruments.filter(i => i.audioUrl && i.generatedPrompt);
      if (withPrompts.length === 0) {
        return res.status(400).json({ message: "Run analysis first to generate training prompts before training." });
      }

      const trainingConfig = buildTrainingConfig(kit, instruments);
      const configJson = JSON.stringify(trainingConfig, null, 2);

      await storage.updateStyleKit(kitId, {
        trainingStatus: "queued",
        trainingError: null,
        trainingConfig: configJson,
        pipelineStep: "train",
      });

      console.log(`[SAO Pipeline] Kit ${kitId} queued for training with ${withPrompts.length} instruments (SAO config generated)`);
      console.log(`[SAO Pipeline] Training config: model_type=${trainingConfig.model_type}, sample_rate=${trainingConfig.sample_rate}, instruments=${trainingConfig.dataset.instruments.length}`);

      if (isRunPodConfigured()) {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = req.headers["host"] || "localhost:5000";
        const webhookUrl = `${protocol}://${host}/api/training/webhook`;

        const result = await submitTrainingJob(kitId, trainingConfig, webhookUrl);
        if (result.success) {
          await storage.updateStyleKit(kitId, {
            trainingStatus: "training",
            trainingJobId: result.jobId || null,
          });
          console.log(`[SAO Pipeline] Job submitted to cloud GPU: ${result.jobId}`);
        } else {
          await storage.updateStyleKit(kitId, {
            trainingStatus: "failed",
            trainingError: `Cloud GPU submission failed: ${result.error}`,
          });
          console.error(`[SAO Pipeline] Cloud GPU submission failed: ${result.error}`);
        }
      }

      res.json({
        message: isRunPodConfigured()
          ? "Training submitted to cloud GPU. Your kit is being fine-tuned with the SAO pipeline."
          : "Training queued. Your kit will be fine-tuned using the SAO pipeline with AI-generated prompts.",
        kitId,
        instrumentCount: withPrompts.length,
        status: isRunPodConfigured() ? "training" : "queued",
        gpuConnected: isRunPodConfigured(),
        trainingConfig: {
          model_type: trainingConfig.model_type,
          sample_rate: trainingConfig.sample_rate,
          instruments: trainingConfig.dataset.instruments.length,
          demo_prompts: trainingConfig.training.demo_prompts,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/analysis/webhook", async (req, res) => {
    try {
      const webhookSecret = process.env.TRAINING_WEBHOOK_SECRET;
      if (webhookSecret) {
        const authHeader = req.headers["x-webhook-secret"] || req.headers["authorization"];
        if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
          return res.status(401).json({ message: "Invalid webhook secret" });
        }
      }

      const { instrumentId, key, bpm, energy, acousticness, durationMs, tags, error } = req.body;
      if (!instrumentId) return res.status(400).json({ message: "instrumentId required" });

      const instrument = await storage.getStyleKitInstrument(Number(instrumentId));
      if (!instrument) return res.sendStatus(404);

      if (error) {
        await storage.updateStyleKitInstrument(Number(instrumentId), {
          analysisStatus: "failed",
          analysisError: error,
        });
      } else {
        await storage.updateStyleKitInstrument(Number(instrumentId), {
          analysisStatus: "complete",
          detectedKey: key || null,
          detectedBpm: bpm ? Number(bpm) : null,
          detectedEnergy: energy ? Number(energy) : null,
          detectedTags: tags ? JSON.stringify(tags) : null,
          durationMs: durationMs ? Number(durationMs) : null,
        });
      }

      console.log(`[SAO Pipeline] Analysis webhook: instrument ${instrumentId} - ${error ? "failed" : "complete"}`);

      const kitId = instrument.kitId;
      const allInstruments = await storage.getStyleKitInstruments(kitId);
      const audioInstruments = allInstruments.filter(i => i.audioUrl);
      const allDone = audioInstruments.every(i => {
        if (i.id === Number(instrumentId)) return true;
        return i.analysisStatus === "complete" || i.analysisStatus === "failed";
      });

      if (allDone) {
        console.log(`[SAO Pipeline] All instruments analyzed for kit ${kitId}, generating prompts...`);
        const kit = await storage.getStyleKit(kitId);
        if (kit) {
          await storage.updateStyleKit(kitId, { pipelineStep: "prompt", trainingStatus: "prompting" });

          const analyzed = (await storage.getStyleKitInstruments(kitId))
            .filter(i => i.audioUrl && i.analysisStatus === "complete");

          for (const instr of analyzed) {
            try {
              const prompt = await generateInstrumentPrompt(instr, kit.genre);
              await storage.updateStyleKitInstrument(instr.id, { generatedPrompt: prompt });
              console.log(`[SAO Pipeline] Prompt for "${instr.name}": ${prompt.substring(0, 80)}...`);
            } catch (err: any) {
              console.error(`[SAO Pipeline] Prompt generation failed for instrument ${instr.id}:`, err.message);
            }
          }

          const kitPrompt = await generateKitTrainingPrompt(kit, analyzed);
          await storage.updateStyleKit(kitId, { trainingPrompt: kitPrompt, pipelineStep: "train" });
          console.log(`[SAO Pipeline] Kit ${kitId}: prompts generated via webhook, ready for training`);
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("[SAO Pipeline] Analysis webhook error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/training/webhook", async (req, res) => {
    try {
      const webhookSecret = process.env.TRAINING_WEBHOOK_SECRET;
      if (webhookSecret) {
        const authHeader = req.headers["x-webhook-secret"] || req.headers["authorization"];
        if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
          return res.status(401).json({ message: "Invalid webhook secret" });
        }
      }

      const { kitId, status, modelUrl, error, jobId } = req.body;
      if (!kitId) return res.status(400).json({ message: "kitId required" });

      const kit = await storage.getStyleKit(Number(kitId));
      if (!kit) return res.sendStatus(404);

      const updateData: any = { trainingStatus: status || "ready" };
      if (modelUrl) updateData.trainedModelUrl = modelUrl;
      if (error) updateData.trainingError = error;
      if (jobId) updateData.trainingJobId = jobId;
      if (status === "ready") {
        updateData.pipelineStep = "ready";
        updateData.lastTrainedAt = new Date();
      }
      if (status === "failed") updateData.pipelineStep = "train";

      await storage.updateStyleKit(Number(kitId), updateData);

      if (status === "ready") {
        const instruments = await storage.getStyleKitInstruments(Number(kitId));
        for (const instr of instruments) {
          if (instr.audioUrl) {
            await storage.updateStyleKitInstrument(instr.id, { uploadStatus: "processed" });
          }
        }
      }

      console.log(`[Training] Webhook received for kit ${kitId}: status=${status}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Training] Webhook error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // ========== VOICE MODELS & STYLE REFERENCES ==========

  const voiceDir = path.join(process.cwd(), "public", "audio", "voices");
  if (!fs.existsSync(voiceDir)) fs.mkdirSync(voiceDir, { recursive: true });
  const refDir = path.join(process.cwd(), "public", "audio", "references");
  if (!fs.existsSync(refDir)) fs.mkdirSync(refDir, { recursive: true });

  const voiceUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, voiceDir),
      filename: (_req, _file, cb) => {
        const ext = path.extname(_file.originalname) || ".wav";
        cb(null, `${uuidv4()}${ext}`);
      },
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [".wav", ".mp3", ".ogg", ".webm", ".m4a", ".flac"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext) || file.mimetype.startsWith("audio/")) {
        cb(null, true);
      } else {
        cb(new Error("Only audio files are allowed"));
      }
    },
  });

  const refUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, refDir),
      filename: (_req, _file, cb) => {
        const ext = path.extname(_file.originalname) || ".mp3";
        cb(null, `ref_${uuidv4()}${ext}`);
      },
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [".wav", ".mp3", ".ogg", ".webm", ".m4a", ".flac"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext) || file.mimetype.startsWith("audio/")) {
        cb(null, true);
      } else {
        cb(new Error("Only audio files are allowed"));
      }
    },
  });

  app.get("/api/voice-models", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const own = await storage.getUserVoiceModels(userId);
      const pub = await storage.getPublicVoiceModels();
      const combined = [...own, ...pub.filter(p => p.userId !== userId)];
      res.json(combined);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/voice-models/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const model = await storage.getVoiceModel(parseInt(req.params.id));
      if (!model) return res.sendStatus(404);
      const samples = await storage.getVoiceSamples(model.id);
      res.json({ ...model, samples });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/voice-models", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const { name, description, type, provider, gender, language, tags, externalVoiceId } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });

      const model = await storage.createVoiceModel({
        userId,
        name,
        description: description || null,
        type: type || "uploaded",
        provider: provider || "custom",
        gender: gender || null,
        language: language || "es",
        tags: tags || null,
        externalVoiceId: externalVoiceId || null,
        isActive: true,
        isPublic: false,
        trainingStatus: type === "uploaded" ? "ready" : "pending",
        pipelineStep: type === "uploaded" ? "ready" : "upload",
      });
      res.json(model);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/voice-models/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const model = await storage.getVoiceModel(parseInt(req.params.id));
      if (!model) return res.sendStatus(404);
      if (model.userId !== userId) return res.sendStatus(403);

      const { name, description, gender, language, tags, isPublic, isActive, externalVoiceId, provider } = req.body;
      const updated = await storage.updateVoiceModel(model.id, {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(gender !== undefined ? { gender } : {}),
        ...(language !== undefined ? { language } : {}),
        ...(tags !== undefined ? { tags } : {}),
        ...(isPublic !== undefined ? { isPublic } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(externalVoiceId !== undefined ? { externalVoiceId } : {}),
        ...(provider !== undefined ? { provider } : {}),
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/voice-models/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const model = await storage.getVoiceModel(parseInt(req.params.id));
      if (!model) return res.sendStatus(404);
      if (model.userId !== userId) return res.sendStatus(403);
      await storage.deleteVoiceModel(model.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/voice-models/:id/samples", voiceUpload.single("audio"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const model = await storage.getVoiceModel(parseInt(req.params.id as string));
      if (!model) return res.sendStatus(404);
      if (model.userId !== userId) return res.sendStatus(403);

      if (!req.file) return res.status(400).json({ message: "No audio file provided" });

      const audioUrl = `/audio/voices/${req.file.filename}`;
      const name = req.body.name || req.file.originalname || "Voice Sample";

      const sample = await storage.createVoiceSample({
        voiceModelId: model.id,
        name,
        audioUrl,
        status: "uploaded",
      });

      if (model.trainingStatus === "ready" && model.type !== "uploaded") {
        await storage.updateVoiceModel(model.id, {
          trainingStatus: "pending",
          pipelineStep: "upload",
        });
      }

      res.json(sample);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/voice-samples/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      await storage.deleteVoiceSample(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/voice-models/:id/train", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const model = await storage.getVoiceModel(parseInt(req.params.id));
      if (!model) return res.sendStatus(404);
      if (model.userId !== userId) return res.sendStatus(403);

      const samples = await storage.getVoiceSamples(model.id);
      if (samples.length === 0) {
        return res.status(400).json({ message: "Upload at least one voice sample before training" });
      }

      await storage.updateVoiceModel(model.id, {
        trainingStatus: "training",
        pipelineStep: "train",
        trainingError: null,
      });

      console.log(`[Voice Training] Started training for model ${model.id} "${model.name}" with ${samples.length} samples`);

      res.json({ success: true, message: "Voice training started" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/webhooks/voice-training", async (req, res) => {
    try {
      const { getVoiceWebhookSecret } = await import("./core/voice_training_engine");
      const expectedSecret = getVoiceWebhookSecret();
      if (expectedSecret) {
        const incomingSecret = req.headers["x-webhook-secret"] as string;
        if (incomingSecret !== expectedSecret) {
          return res.sendStatus(403);
        }
      }

      const payload = req.body;
      const voiceModelId = payload.voiceModelId;
      console.log(`[Webhook] Voice training webhook received for model ${voiceModelId}, status: ${payload.status}`);

      if (!voiceModelId) return res.sendStatus(200);

      const model = await storage.getVoiceModel(voiceModelId);
      if (!model) return res.sendStatus(200);

      if (payload.status === "failed") {
        await storage.updateVoiceModel(voiceModelId, {
          trainingStatus: "failed",
          trainingError: payload.error || "Training failed",
          pipelineStep: "train",
        });
      } else if (payload.status === "completed") {
        await storage.updateVoiceModel(voiceModelId, {
          trainingStatus: "ready",
          pipelineStep: "ready",
          trainingError: null,
          modelUrl: payload.model?.modelUrl || null,
        });
      }

      res.sendStatus(200);
    } catch (err: any) {
      console.error("[Webhook] Voice training error:", err);
      res.sendStatus(200);
    }
  });

  app.get("/api/style-references", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const refs = await storage.getStyleReferences(userId);
      res.json(refs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/style-references", refUpload.single("audio"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      if (!req.file) return res.status(400).json({ message: "No audio file provided" });

      const audioUrl = `/audio/references/${req.file.filename}`;
      const name = req.body.name || req.file.originalname || "Style Reference";

      const ref = await storage.createStyleReference({
        userId,
        name,
        audioUrl,
        isActive: true,
      });

      res.json(ref);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/style-references/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const ref = await storage.getStyleReference(parseInt(req.params.id));
      if (!ref) return res.sendStatus(404);
      if (ref.userId !== userId) return res.sendStatus(403);
      await storage.deleteStyleReference(ref.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== CLOUD SERVERS MANAGEMENT (Admin) ==========

  app.get("/api/admin/cloud-servers", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const servers = await storage.getCloudServers();
      const safeServers = servers.map(s => ({
        ...s,
        apiKey: s.apiKey ? "••••" + s.apiKey.slice(-4) : null,
        webhookSecret: s.webhookSecret ? "••••" + s.webhookSecret.slice(-4) : null,
      }));
      res.json(safeServers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/cloud-servers", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const server = await storage.createCloudServer(req.body);
      res.status(201).json({ ...server, apiKey: server.apiKey ? "••••" + server.apiKey.slice(-4) : null, webhookSecret: server.webhookSecret ? "••••" + server.webhookSecret.slice(-4) : null });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/cloud-servers/:id", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const id = Number(req.params.id);
      const existing = await storage.getCloudServer(id);
      if (!existing) return res.sendStatus(404);
      const updateData = { ...req.body };
      if (updateData.apiKey === "") delete updateData.apiKey;
      if (updateData.webhookSecret === "") delete updateData.webhookSecret;
      const updated = await storage.updateCloudServer(id, updateData);
      res.json({ ...updated, apiKey: updated.apiKey ? "••••" + updated.apiKey.slice(-4) : null, webhookSecret: updated.webhookSecret ? "••••" + updated.webhookSecret.slice(-4) : null });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/cloud-servers/:id", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      await storage.deleteCloudServer(Number(req.params.id));
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/cloud-servers/:id/health", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const id = Number(req.params.id);
      const server = await storage.getCloudServer(id);
      if (!server) return res.sendStatus(404);
      const resolved = {
        baseUrl: (() => {
          let url = server.baseUrl.replace(/\/$/, "");
          if (server.apiPort && !url.includes(`:${server.apiPort}`)) {
            try { const u = new URL(url); u.port = String(server.apiPort); url = u.toString().replace(/\/$/, ""); } catch {}
          }
          return url;
        })(),
        apiKey: server.apiKey || "",
        webhookSecret: server.webhookSecret || "",
        authHeaderName: server.authHeaderName || "X-DGB-API-Key",
        webhookHeaderName: server.webhookHeaderName || "X-Webhook-Secret",
        healthEndpoint: server.healthEndpoint || "/api/health",
        uploadEndpoint: server.uploadEndpoint || "/api/upload-instrument",
      };
      const health = await checkCloudHealth(resolved);
      const status = health.connected ? "connected" : "offline";
      await storage.updateCloudServer(id, { status, lastHealthCheck: new Date() });
      res.json({ ...health, status });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== GPU POD MANAGEMENT ==========

  app.get("/api/admin/gpu-status", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const status = await getGpuStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/gpu/resume", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const result = await resumeGpuPod();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/admin/gpu/stop", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const result = await stopGpuPod();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/admin/gpu/setup", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const result = await setupGpuEnvironment();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, output: err.message });
    }
  });

  app.post("/api/admin/gpu/diagnostics", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const { runGpuDiagnostics } = await import("./core/runpod_music_engine");
      console.log("[Admin] Running GPU diagnostics...");
      const result = await runGpuDiagnostics();
      console.log("[Admin] GPU diagnostics completed:", JSON.stringify(result).substring(0, 500));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ output: [], errors: [err.message], status: "error" });
    }
  });

  // ========== DGB CLOUD ENGINE WEBHOOK ==========

  app.post("/api/dgb-cloud/webhook", async (req, res) => {
    try {
      const verified = await verifyWebhookFromAnyServer(req.headers as any, storage);
      if (!verified) {
        return res.status(401).json({ message: "Invalid webhook secret" });
      }

      const { instrumentId, kitId, status, analysis, midiConverted, midiBase64, midiError, error } = req.body;
      if (!instrumentId) return res.status(400).json({ message: "instrumentId required" });

      const instrument = await storage.getStyleKitInstrument(Number(instrumentId));
      if (!instrument) return res.sendStatus(404);

      console.log(`[DGB Cloud Webhook] Instrument ${instrumentId}: status=${status}, midi=${midiConverted}`);

      if (status === "failed") {
        await storage.updateStyleKitInstrument(Number(instrumentId), {
          uploadStatus: "failed",
          analysisStatus: "failed",
          analysisError: error || "Processing failed on cloud GPU",
        });
        return res.json({ success: true });
      }

      const updateData: Record<string, any> = {
        uploadStatus: "processed",
      };

      if (analysis) {
        updateData.analysisStatus = "complete";
        if (analysis.key) updateData.detectedKey = analysis.key;
        if (analysis.bpm) updateData.detectedBpm = Number(analysis.bpm);
        if (analysis.energy !== undefined) updateData.detectedEnergy = Number(analysis.energy);
        if (analysis.tags) updateData.detectedTags = JSON.stringify(analysis.tags);
        if (analysis.durationMs) updateData.durationMs = Number(analysis.durationMs);
      }

      if (midiConverted && midiBase64) {
        try {
          const midiUrl = await saveMidiFile(midiBase64, Number(instrumentId));
          updateData.midiUrl = midiUrl;
          console.log(`[DGB Cloud Webhook] MIDI saved: ${midiUrl}`);
        } catch (err: any) {
          console.error(`[DGB Cloud Webhook] MIDI save error: ${err.message}`);
        }
      }

      await storage.updateStyleKitInstrument(Number(instrumentId), updateData);

      const instrKitId = instrument.kitId;
      const allInstruments = await storage.getStyleKitInstruments(instrKitId);
      const audioInstruments = allInstruments.filter(i => i.audioUrl);
      const allDone = audioInstruments.every(i => {
        if (i.id === Number(instrumentId)) return true;
        return i.uploadStatus === "processed" || i.uploadStatus === "failed" ||
               i.analysisStatus === "complete" || i.analysisStatus === "failed";
      });

      if (allDone) {
        console.log(`[DGB Cloud Webhook] All instruments processed for kit ${instrKitId}`);
        const kit = await storage.getStyleKit(instrKitId);
        if (kit) {
          await storage.updateStyleKit(instrKitId, { pipelineStep: "prompt", trainingStatus: "prompting" });

          const analyzed = (await storage.getStyleKitInstruments(instrKitId))
            .filter(i => i.audioUrl && i.analysisStatus === "complete");

          for (const instr of analyzed) {
            try {
              const prompt = await generateInstrumentPrompt(instr, kit.genre);
              await storage.updateStyleKitInstrument(instr.id, { generatedPrompt: prompt });
              console.log(`[DGB Cloud Webhook] Prompt for "${instr.name}": ${prompt.substring(0, 80)}...`);
            } catch (err: any) {
              console.error(`[DGB Cloud Webhook] Prompt gen failed for ${instr.id}:`, err.message);
            }
          }

          const kitPrompt = await generateKitTrainingPrompt(kit, analyzed);
          await storage.updateStyleKit(instrKitId, { trainingPrompt: kitPrompt, pipelineStep: "train" });
          console.log(`[DGB Cloud Webhook] Kit ${instrKitId}: prompts generated, ready for training`);
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("[DGB Cloud Webhook] Error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/dgb-cloud/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const configured = await isCloudConfigured(storage);
      if (!configured) {
        return res.json({ configured: false, connected: false });
      }
      const activeServer = await getActiveServer(storage, "instrument_processing");
      if (activeServer) {
        const health = await checkCloudHealth(activeServer);
        return res.json({ configured: true, ...health, serverId: activeServer.serverId });
      }
      const health = await checkDgbCloudHealth();
      res.json({ configured: true, ...health });
    } catch (err: any) {
      res.json({ configured: false, connected: false, error: err.message });
    }
  });

  // ========== SONG DOWNLOAD ==========

  app.get("/api/songs/:id/download", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const songId = Number(req.params.id);
      const song = await storage.getSong(songId);
      if (!song) return res.sendStatus(404);

      const userId = (req.user as any).claims.sub;
      if (song.userId !== userId && !isAdmin(req)) return res.sendStatus(403);

      if (!song.audioUrl) {
        return res.status(400).json({ message: "Song has no audio file" });
      }

      const format = (req.query.format as string) || "mp3";
      const audioPath = path.join(process.cwd(), "public", song.audioUrl);

      if (!fs.existsSync(audioPath)) {
        return res.status(404).json({ message: "Audio file not found on server" });
      }

      const safeName = (song.title || "song").replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_");
      const currentExt = path.extname(audioPath).toLowerCase();

      if (format === "wav" && currentExt !== ".wav") {
        const { execSync } = require("child_process");
        const tmpWav = path.join("/tmp", `${safeName}_${songId}.wav`);
        try {
          execSync(`ffmpeg -i "${audioPath}" -acodec pcm_s16le -ar 44100 -y "${tmpWav}"`, { timeout: 60000 });
          res.setHeader("Content-Disposition", `attachment; filename="${safeName}.wav"`);
          res.setHeader("Content-Type", "audio/wav");
          const stream = fs.createReadStream(tmpWav);
          stream.pipe(res);
          stream.on("end", () => { try { fs.unlinkSync(tmpWav); } catch {} });
          return;
        } catch (err: any) {
          console.error("[Download] WAV conversion failed:", err.message);
        }
      }

      if (format === "mp3" && currentExt !== ".mp3") {
        const { execSync } = require("child_process");
        const tmpMp3 = path.join("/tmp", `${safeName}_${songId}.mp3`);
        try {
          execSync(`ffmpeg -i "${audioPath}" -codec:a libmp3lame -b:a 192k -y "${tmpMp3}"`, { timeout: 60000 });
          res.setHeader("Content-Disposition", `attachment; filename="${safeName}.mp3"`);
          res.setHeader("Content-Type", "audio/mpeg");
          const stream = fs.createReadStream(tmpMp3);
          stream.pipe(res);
          stream.on("end", () => { try { fs.unlinkSync(tmpMp3); } catch {} });
          return;
        } catch (err: any) {
          console.error("[Download] MP3 conversion failed:", err.message);
        }
      }

      const contentType = currentExt === ".wav" ? "audio/wav" : "audio/mpeg";
      const ext = currentExt || ".mp3";
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}${ext}"`);
      res.setHeader("Content-Type", contentType);
      fs.createReadStream(audioPath).pipe(res);
    } catch (err: any) {
      console.error("[Download] Error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // ========== STRIPE: PUBLIC ROUTES ==========

  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (err: any) {
      res.status(500).json({ message: "Stripe not configured" });
    }
  });

  app.get("/api/stripe/products", async (_req, res) => {
    try {
      const products = await storage.getStripeProducts();
      const productsMap = new Map<string, any>();
      for (const row of products) {
        const pid = (row as any).id;
        if (!productsMap.has(pid)) {
          productsMap.set(pid, {
            id: pid,
            name: (row as any).name,
            description: (row as any).description,
            metadata: (row as any).metadata,
            prices: [],
          });
        }
        if ((row as any).price_id) {
          productsMap.get(pid).prices.push({
            id: (row as any).price_id,
            unitAmount: (row as any).unit_amount,
            currency: (row as any).currency,
            recurring: (row as any).recurring,
          });
        }
      }
      res.json(Array.from(productsMap.values()));
    } catch {
      res.json([]);
    }
  });

  app.get("/api/stripe/subscription", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const user = await storage.getUser(userId);
      if (!user?.stripeSubscriptionId) {
        return res.json({ subscription: null, tier: user?.subscriptionTier || "free" });
      }
      const stripe = await getUncachableStripeClient();
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId) as any;
      res.json({
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
        tier: user.subscriptionTier || "free",
      });
    } catch {
      res.json({ subscription: null, tier: "free" });
    }
  });

  app.post("/api/stripe/checkout", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ message: "priceId required" });

    try {
      const stripe = await getUncachableStripeClient();
      const user = await storage.getUser(userId);
      if (!user) return res.sendStatus(404);

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { userId },
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${baseUrl}/pricing?success=true`,
        cancel_url: `${baseUrl}/pricing?canceled=true`,
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("[Stripe] Checkout error:", err.message);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/portal", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;

    try {
      const stripe = await getUncachableStripeClient();
      const user = await storage.getUser(userId);
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: "No billing account found" });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${baseUrl}/pricing`,
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("[Stripe] Portal error:", err.message);
      res.status(500).json({ message: "Failed to create portal session" });
    }
  });

  // ========== AI SUPPORT CHATBOT ==========

  app.get("/api/support/ticket/current", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const tickets = await storage.getSupportTickets(userId);
      const openTicket = tickets.find(t => t.status === "open" || t.status === "in_progress");
      if (!openTicket) return res.json({ ticket: null, messages: [] });
      const messages = await storage.getSupportMessages(openTicket.id);
      res.json({
        ticket: openTicket,
        messages: messages.map(m => ({
          role: m.role === "admin" ? "assistant" : m.role,
          content: m.content,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/support/ticket/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const ticketId = Number(req.params.id);
    try {
      const ticket = await storage.getSupportTicket(ticketId);
      if (!ticket || ticket.userId !== userId) return res.sendStatus(404);
      const messages = await storage.getSupportMessages(ticketId);
      res.json({
        messages: messages.map(m => ({
          role: m.role === "admin" ? "assistant" : m.role,
          content: m.content,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/support/chat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const { message, history, ticketId } = req.body;
    if (!message) return res.status(400).json({ message: "message required" });

    try {
      let currentTicketId = ticketId ? Number(ticketId) : null;
      const user = await storage.getUser(userId);

      if (!currentTicketId) {
        const subject = message.length > 60 ? message.substring(0, 57) + "..." : message;
        const ticket = await storage.createSupportTicket({
          userId,
          userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : undefined,
          userEmail: user?.email || undefined,
          subject,
          status: "open",
          priority: "normal",
        });
        currentTicketId = ticket.id;
      }

      await storage.createSupportMessage({ ticketId: currentTicketId, role: "user", content: message });

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const systemPrompt = `You are the DGB Audio Support Assistant, a helpful and friendly AI support agent for the DGB Audio music production platform (also known as "DGB Studio").

PLATFORM FEATURES:
- Music Generation: AI-powered music creation supporting 20+ genres. Users can create songs with custom prompts, select genres, and choose from 6 style presets (DGB Studio Signature, Romantic, Dance, Bolero, Trio Serenade, Bachata Urbana).
- Multitrack Studio: AI stem separation splits songs into Vocals, Drums, Bass, and Melody tracks. Each track has individual volume, mute, and solo controls.
- Studio AI Tools: Professional audio mastering, noise removal (denoise), AI cover songs with voice change, and audio trimming/cutting.
- Sample Lab: Record audio from browser, upload audio files, AI remix transformation, and Key/BPM detection.
- Lyrics Generator: AI-powered lyrics creation in romantic, dance, and heartbreak styles with Latin music influences.
- Bachata Quiz: Interactive music knowledge quiz about bachata history, instruments, and culture.
- Library: All generated songs stored with playback, download, and studio access.

SUBSCRIPTION PLANS:
- Free: Basic access to music generation and features
- Pro: Enhanced features, more generations, priority processing
- Premium: Unlimited access, all features, priority support

HOW TO USE:
1. Create Music: Go to "Create" page, enter a prompt describing your song, select genre and style, click generate
2. Edit in Studio: After a song is generated, click "Studio" to separate stems and apply AI tools
3. Sample Lab: Record or upload audio, then transform it with AI remix
4. Generate Lyrics: Go to "Lyrics" page, enter a theme and style

COMMON ISSUES:
- Song stuck on "processing": Songs typically take 1-3 minutes. If stuck longer, try generating again.
- Audio not playing: Check browser audio permissions and try refreshing.
- Stem separation failed: Ensure the original song was fully generated first.

IMPORTANT: Always be helpful, concise, and supportive. If you don't know something specific about the platform, suggest the user contact support. Respond in the same language the user writes in.`;

      const messages: any[] = [
        { role: "system", content: systemPrompt },
        ...(history || []).slice(-10),
        { role: "user", content: message },
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 500,
        temperature: 0.7,
      });

      const reply = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request. Please try again.";

      await storage.createSupportMessage({ ticketId: currentTicketId, role: "assistant", content: reply });

      res.json({ reply, ticketId: currentTicketId });
    } catch (err: any) {
      console.error("[Support] Chat error:", err.message);
      res.status(500).json({ message: "Support chat unavailable" });
    }
  });

  return httpServer;
}
