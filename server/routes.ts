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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  await setupAuth(app);
  registerAuthRoutes(app);

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
      const style = (req.body.style as string) || "bachata-romantic";
      const duration = (req.body.duration as number) || 15;

      const hasBachataKeywords = /bachata|bongo|guira|dominican|latino|requinto/i.test(input.prompt);
      const shouldForceBachata = input.isBachata || hasBachataKeywords;

      const finalPrompt = shouldForceBachata
        ? buildMusicGenPrompt(input.prompt, style)
        : input.prompt;

      const song = await storage.createSong({
        userId,
        title: input.prompt.slice(0, 50) + (input.prompt.length > 50 ? "..." : ""),
        prompt: finalPrompt,
        status: "processing",
      });

      processMusicGeneration(song.id, finalPrompt, {
        isBachata: false,
        style,
        duration,
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

  // ========== LYRICS ROUTES ==========

  app.post(api.lyrics.generate.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;

    try {
      const input = api.lyrics.generate.input.parse(req.body);

      const lyricsContent = await generateCreativeLyrics(
        input.theme,
        input.style as "romantic" | "dance" | "heartbreak"
      );

      const lyric = await storage.createLyric({
        userId,
        songId: null,
        theme: input.theme,
        style: input.style,
        content: lyricsContent,
      });

      res.json(lyric);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
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

  return httpServer;
}
