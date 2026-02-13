import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { processMusicGeneration, pendingTaskMap } from "./workers/music_tasks";
import { generateCreativeLyrics } from "./core/antigravity_engine";
import { buildMusicGenPrompt, PROMPT_VERSIONS } from "./core/prompt_engine";
import { downloadMusicGPTFile } from "./core/musicgpt_engine";
import { getRandomQuiz, getQuizByCategory, evaluateQuiz } from "./core/quiz_engine";
import { processStemSeparation } from "./core/stems_engine";
import { processHummingToMusic, processKeyBPMDetection, processMastering, processDenoise, processCoverSong, processAudioCut } from "./workers/sample_tasks";
import { seedDefaultMusicGPTProvider } from "./core/seed_providers";
import { OPERATION_TYPES, PROVIDER_CATEGORIES, AUTH_TYPES, insertApiProviderSchema, insertApiEndpointSchema } from "@shared/schema";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

async function recoverStuckSongs() {
  try {
    const { db } = await import("./db");
    const { songs } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(songs)
      .set({ status: "failed", error: "Generation interrupted - please try again" })
      .where(eq(songs.status, "processing"));
    console.log("[Recovery] Checked for stuck processing songs");
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

  app.post(api.songs.generate.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;

    try {
      const input = api.songs.generate.input.parse(req.body);
      const duration = (req.body.duration as number) || 15;
      const lyrics = (req.body.lyrics as string) || undefined;
      const mode = input.mode || "standard";
      const style = input.style || "Bachata";
      const genre = input.genre || undefined;

      let finalPrompt: string;
      let songTitle: string;

      if (mode === "aggregate") {
        songTitle = (input.title || input.prompt || "Untitled").trim();
        finalPrompt = `${songTitle}, ${genre || style} style, high fidelity, studio quality`;
      } else {
        songTitle = input.prompt.slice(0, 50) + (input.prompt.length > 50 ? "..." : "");
        finalPrompt = input.prompt;
      }

      const song = await storage.createSong({
        userId,
        title: songTitle,
        prompt: finalPrompt,
        genre: genre || null,
        mode,
      });

      processMusicGeneration(song.id, finalPrompt, {
        style,
        duration,
        lyrics,
      });

      res.status(202).json(song);
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

  // ========== MUSICGPT WEBHOOK ==========

  app.post("/api/webhooks/musicgpt", async (req, res) => {
    try {
      const payload = req.body;
      const subtype = payload.subtype;
      console.log(`[Webhook] Received MusicGPT webhook (subtype: ${subtype || "audio"}):`, JSON.stringify(payload).substring(0, 500));

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

  function isAdmin(req: any): boolean {
    if (!req.isAuthenticated()) return false;
    if (!ADMIN_USER_ID) return false;
    const userId = (req.user as any)?.claims?.sub;
    return userId === ADMIN_USER_ID;
  }

  seedDefaultMusicGPTProvider().catch((err: any) =>
    console.log("[Seed] Provider seed error:", err.message?.substring(0, 100))
  );

  app.get("/api/admin/check", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    res.json({ isAdmin: userId === ADMIN_USER_ID });
  });

  app.get("/api/admin/meta", (req, res) => {
    if (!isAdmin(req)) return res.sendStatus(403);
    res.json({
      operationTypes: OPERATION_TYPES,
      providerCategories: PROVIDER_CATEGORIES,
      authTypes: AUTH_TYPES,
    });
  });

  app.get("/api/admin/providers", async (req, res) => {
    if (!isAdmin(req)) return res.sendStatus(403);
    const providers = await storage.getApiProviders();
    res.json(providers);
  });

  app.get("/api/admin/providers/:id", async (req, res) => {
    if (!isAdmin(req)) return res.sendStatus(403);
    const provider = await storage.getApiProvider(Number(req.params.id));
    if (!provider) return res.sendStatus(404);
    res.json(provider);
  });

  app.post("/api/admin/providers", async (req, res) => {
    if (!isAdmin(req)) return res.sendStatus(403);
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
    if (!isAdmin(req)) return res.sendStatus(403);
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
    if (!isAdmin(req)) return res.sendStatus(403);
    const id = Number(req.params.id);
    const existing = await storage.getApiProvider(id);
    if (!existing) return res.sendStatus(404);
    await storage.deleteApiProvider(id);
    res.sendStatus(204);
  });

  app.get("/api/admin/endpoints", async (req, res) => {
    if (!isAdmin(req)) return res.sendStatus(403);
    const providerId = req.query.providerId ? Number(req.query.providerId) : undefined;
    const endpoints = await storage.getApiEndpoints(providerId);
    res.json(endpoints);
  });

  app.get("/api/admin/endpoints/:id", async (req, res) => {
    if (!isAdmin(req)) return res.sendStatus(403);
    const endpoint = await storage.getApiEndpoint(Number(req.params.id));
    if (!endpoint) return res.sendStatus(404);
    res.json(endpoint);
  });

  app.post("/api/admin/endpoints", async (req, res) => {
    if (!isAdmin(req)) return res.sendStatus(403);
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
    if (!isAdmin(req)) return res.sendStatus(403);
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
    if (!isAdmin(req)) return res.sendStatus(403);
    const id = Number(req.params.id);
    const existing = await storage.getApiEndpoint(id);
    if (!existing) return res.sendStatus(404);
    await storage.deleteApiEndpoint(id);
    res.sendStatus(204);
  });

  app.post("/api/admin/endpoints/:id/test", async (req, res) => {
    if (!isAdmin(req)) return res.sendStatus(403);
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
    if (!isAdmin(req)) return res.sendStatus(403);
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
    if (!isAdmin(req)) return res.sendStatus(403);
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/subscriptions", async (req, res) => {
    if (!isAdmin(req)) return res.sendStatus(403);
    try {
      const subs = await storage.getStripeSubscriptions();
      res.json(subs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/products", async (req, res) => {
    if (!isAdmin(req)) return res.sendStatus(403);
    try {
      const products = await storage.getStripeProducts();
      res.json(products);
    } catch (err: any) {
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

  app.post("/api/support/chat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ message: "message required" });

    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const systemPrompt = `You are the DGB Audio Support Assistant, a helpful and friendly AI support agent for the DGB Audio music production platform (also known as "Heart Mula Engine").

PLATFORM FEATURES:
- Music Generation: AI-powered music creation supporting 20+ genres. Users can create songs with custom prompts, select genres, and choose from 6 style presets (Heart Mula Signature, Romantic, Dance, Bolero, Trio Serenade, Bachata Urbana).
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

      res.json({
        reply: completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request. Please try again.",
      });
    } catch (err: any) {
      console.error("[Support] Chat error:", err.message);
      res.status(500).json({ message: "Support chat unavailable" });
    }
  });

  return httpServer;
}
