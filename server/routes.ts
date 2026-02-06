import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import Replicate from "replicate";
import OpenAI from "openai";

// Initialize Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Initialize OpenAI (using Replit Integration env vars)
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // 1. Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // 2. Song Routes
  
  // List user songs
  app.get(api.songs.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const songs = await storage.getUserSongs(userId);
    res.json(songs);
  });

  // Get single song
  app.get(api.songs.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const song = await storage.getSong(Number(req.params.id));
    if (!song) return res.sendStatus(404);
    
    // Authorization check
    const userId = (req.user as any).claims.sub;
    if (song.userId !== userId && !song.isPublic) {
      return res.sendStatus(403);
    }
    
    res.json(song);
  });

  // Generate Song (Replicate)
  app.post(api.songs.generate.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;

    try {
      const input = api.songs.generate.input.parse(req.body);

      // Construct prompt based on Bachata mode
      let prompt = input.prompt;
      if (input.isBachata) {
        prompt = `${prompt}, Dominican bachata guitar, bongo, guira, smooth bassline, high fidelity, caribbean rhythm, emotional melody`;
      }

      // Create pending song record
      const song = await storage.createSong({
        userId,
        title: input.prompt.slice(0, 50) + (input.prompt.length > 50 ? "..." : ""),
        prompt: prompt,
        status: "processing",
      });

      // Start generation in background (don't await)
      (async () => {
        try {
          console.log(`Starting music generation for song ${song.id} with prompt: ${prompt}`);
          
          const output = await replicate.run(
            "meta/musicgen-large:1a581232847c94313f8c85848c41463e26466f8e77c5952d7e97f0a92e1062b8",
            {
              input: {
                model_version: "large",
                prompt: prompt,
                duration: 15
              }
            }
          );

          console.log("Replicate output:", output);
          
          // Replicate returns the audio URL string directly or inside an object
          const audioUrl = typeof output === 'string' ? output : (output as any).audio;

          await storage.updateSongStatus(song.id, "completed", audioUrl);
        } catch (err: any) {
          console.error("Replicate generation failed:", err);
          await storage.updateSongStatus(song.id, "failed", undefined, err.message || "Generation failed");
        }
      })();

      res.status(202).json(song);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 3. Lyrics Routes
  app.post(api.lyrics.generate.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;

    try {
      const input = api.lyrics.generate.input.parse(req.body);

      const systemPrompt = `You are a professional Bachata songwriter like Romeo Santos or Prince Royce. Write lyrics in Spanish (with some Spanglish if appropriate). Style: ${input.style}. Structure: Verse 1, Chorus, Verse 2, Chorus. Keep it rhythmic and emotional.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write a song about: ${input.theme}` },
        ],
      });

      const lyricsContent = completion.choices[0].message.content || "Failed to generate lyrics.";

      const lyric = await storage.createLyric({
        userId,
        songId: null, // Can link later
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

  return httpServer;
}
