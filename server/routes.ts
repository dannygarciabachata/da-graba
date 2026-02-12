import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { processMusicGeneration } from "./workers/music_tasks";
import { generateCreativeLyrics } from "./core/antigravity_engine";
import { buildMusicGenPrompt, PROMPT_VERSIONS } from "./core/prompt_engine";
import { getRandomQuiz, getQuizByCategory, evaluateQuiz } from "./core/quiz_engine";
import { processStemSeparation } from "./core/stems_engine";
import { processHummingToMusic, processKeyBPMDetection, processMastering, processDenoise, processCoverSong } from "./workers/sample_tasks";
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
      const style = input.style || "heart-mula";
      const genre = input.genre || undefined;

      let finalPrompt: string;
      let songTitle: string;
      let shouldForceBachata: boolean;

      if (mode === "aggregate") {
        songTitle = (input.title || input.prompt || "Untitled").trim();
        const genreLabel = genre || "Bachata";
        const isBachataGenre = /bachata/i.test(genreLabel);
        
        if (isBachataGenre) {
          finalPrompt = buildMusicGenPrompt(`${songTitle}, ${genreLabel} style`, style);
        } else {
          const styleDesc = PROMPT_VERSIONS[style] || "";
          finalPrompt = `${songTitle}, ${genreLabel} style, ${styleDesc}, high fidelity, studio quality`;
        }
        shouldForceBachata = isBachataGenre;
      } else {
        songTitle = input.prompt.slice(0, 50) + (input.prompt.length > 50 ? "..." : "");
        const hasBachataKeywords = /bachata|bongo|guira|dominican|latino|requinto/i.test(input.prompt);
        shouldForceBachata = input.isBachata || hasBachataKeywords;
        finalPrompt = shouldForceBachata
          ? buildMusicGenPrompt(input.prompt, style)
          : input.prompt;
      }

      const song = await storage.createSong({
        userId,
        title: songTitle,
        prompt: finalPrompt,
        genre: genre || null,
        mode,
      });

      processMusicGeneration(song.id, finalPrompt, {
        isBachata: shouldForceBachata,
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
      return res.status(400).json({ message: "Stems already exist for this song", tracks: existingTracks });
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
    res.json(Object.keys(PROMPT_VERSIONS));
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

      const style = input.style || "heart-mula";
      const promptWithStyle = buildMusicGenPrompt(input.prompt, style);

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
    voiceDescription: z.string().min(1).max(500),
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
      processCoverSong(songId, song.audioUrl, input.voiceDescription, userId);
      res.status(202).json({ message: "Cover song generation started", songId });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to start cover generation" });
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

  return httpServer;
}
