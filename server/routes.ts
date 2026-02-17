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
import { processStemSeparation, cancelStemTimeout, getSongIdForStemTask, clearStemTask } from "./core/stems_engine";
import { saveStemAudio, getStemsWebhookSecret } from "./core/runpod_stems_engine";
import {
  processHummingToMusic, processKeyBPMDetection, processMastering, processDenoise,
  processCoverSong, processAudioCut, processVoiceConversion, processDeEcho,
  processDeReverb, processTTS, processSoundGeneration, processTranscription,
  processRemix, processSpeedChange,
} from "./workers/sample_tasks";
import { seedDefaultMusicGPTProvider, seedDgbRunPodProvider, seedReplicateProvider, seedMurekaProvider, seedKieProvider, seedReplicateStemsProvider, updateProviderPriorities, seedTrainingKits, seedDiscography } from "./core/seed_providers";
import { initializeAdapters } from "./core/adapters";
import { generateInstrumentPrompt, generateKitTrainingPrompt, buildTrainingConfig, buildRunPodPayload, GENRE_STYLE_HINTS } from "./core/sao_training_engine";
import { submitTrainingJob, submitAnalysisJob, isRunPodConfigured, checkRunPodConnection, getGpuStatus, resumeGpuPod, stopGpuPod, setupGpuEnvironment } from "./core/runpod_client";
import { isCloudConfigured, getActiveServer, checkCloudHealth, checkDgbCloudHealth, uploadInstrumentToCloud, saveMidiFile, verifyWebhookFromAnyServer } from "./core/dgb_runpod_api";
import { isServerlessConfigured as isServerlessAvailable } from "./core/runpod_serverless";
import { OPERATION_TYPES, PROVIDER_CATEGORIES, AUTH_TYPES, STYLE_KIT_GENRES, INSTRUMENT_TYPES, SETTING_CATEGORIES, TICKET_STATUSES, TICKET_PRIORITIES, insertApiProviderSchema, insertApiEndpointSchema, insertStyleKitSchema, insertStyleKitInstrumentSchema, insertPlatformSettingSchema, insertUserPlaylistSchema } from "@shared/schema";
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
      const artistName = (req.body.artistName as string) || undefined;
      const copyrightHolder = (req.body.copyrightHolder as string) || "DGB AUDIO";
      const lyricsText = lyrics || undefined;

      const song1 = await storage.createSong({
        userId,
        title: songTitle,
        prompt: finalPrompt,
        genre: genre || null,
        mode,
        pairId,
        variationLabel: "A",
        artistName,
        copyrightHolder,
        lyricsText,
      });

      const song2 = await storage.createSong({
        userId,
        title: songTitle,
        prompt: finalPrompt,
        genre: genre || null,
        mode,
        pairId,
        variationLabel: "B",
        artistName,
        copyrightHolder,
        lyricsText,
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

  // ========== SONG LIKES ==========
  app.post("/api/songs/:id/like", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const songId = Number(req.params.id);
    const { value } = req.body;
    if (value !== 1 && value !== -1) return res.status(400).json({ message: "Value must be 1 or -1" });
    const result = await storage.toggleSongLike(songId, userId, value);
    res.json(result);
  });

  app.get("/api/songs/:id/likes", async (req, res) => {
    const songId = Number(req.params.id);
    const counts = await storage.getSongLikeCounts(songId);
    let userValue = 0;
    if (req.isAuthenticated()) {
      const userId = (req.user as any).claims.sub;
      const status = await storage.getSongLikeStatus(songId, userId);
      userValue = status?.value || 0;
    }
    res.json({ ...counts, userValue });
  });

  // ========== PUBLIC SONGS ==========
  app.get("/api/public/songs", async (_req, res) => {
    const publicSongs = await storage.getPublicSongs();
    res.json(publicSongs);
  });

  app.get("/api/public/charts", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 100, 200);
      const topSongs = await storage.getTopSongs(limit * 2);
      const songIds = topSongs.map(s => s.id);
      const likesMap = await storage.getSongLikeCountsBatch(songIds);
      const songsWithLikes = topSongs.map(s => ({
        ...s,
        likes: likesMap[s.id] || 0,
        score: (s.playCount || 0) + (likesMap[s.id] || 0) * 10,
      }));
      songsWithLikes.sort((a, b) => b.score - a.score);
      res.json(songsWithLikes.slice(0, limit));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/public/charts/:genre", async (req, res) => {
    try {
      const genre = req.params.genre;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const topSongs = await storage.getTopSongsByGenre(genre, limit * 2);
      const songIds = topSongs.map(s => s.id);
      const likesMap = await storage.getSongLikeCountsBatch(songIds);
      const songsWithLikes = topSongs.map(s => ({
        ...s,
        likes: likesMap[s.id] || 0,
        score: (s.playCount || 0) + (likesMap[s.id] || 0) * 10,
      }));
      songsWithLikes.sort((a, b) => b.score - a.score);
      res.json(songsWithLikes.slice(0, limit));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/public/playlists", async (_req, res) => {
    try {
      const summaries = await storage.getGenrePlaylistSummaries();
      res.json(summaries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/songs/:id/play", async (req, res) => {
    try {
      const songId = Number(req.params.id);
      const song = await storage.getSong(songId);
      if (!song) return res.sendStatus(404);
      await storage.incrementPlayCount(songId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== SONG METADATA UPDATE ==========
  app.patch("/api/songs/:id/metadata", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const song = await storage.getSong(Number(req.params.id));
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    const { artistName, copyrightHolder, lyricsText, title } = req.body;
    const updated = await storage.updateSongMetadata(song.id, { artistName, copyrightHolder, lyricsText, title });
    res.json(updated);
  });

  app.patch("/api/songs/:id/cover", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const song = await storage.getSong(Number(req.params.id));
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ message: "imageUrl required" });
    const updated = await storage.updateSongImage(song.id, imageUrl);
    res.json(updated);
  });

  // ========== ARTIST PROFILES & MONETIZATION ==========

  app.get("/api/artist/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const profile = await storage.getArtistProfile(userId);
    res.json(profile || null);
  });

  app.post("/api/artist/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const existing = await storage.getArtistProfile(userId);
    if (existing) return res.status(409).json({ message: "Profile already exists" });
    const { artistName, bio, genre, country, artistType, proEntity, proMemberId, ipiNumber, monthlySubscriptionPrice } = req.body;
    if (!artistName) return res.status(400).json({ message: "Artist name required" });
    const profile = await storage.createArtistProfile({
      userId,
      artistName,
      bio: bio || null,
      genre: genre || null,
      country: country || null,
      artistType: artistType || "independent",
      proEntity: proEntity || null,
      proMemberId: proMemberId || null,
      ipiNumber: ipiNumber || null,
      monthlySubscriptionPrice: monthlySubscriptionPrice || 299,
      onboardingCompleted: true,
    });
    res.json(profile);
  });

  app.patch("/api/artist/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const profile = await storage.getArtistProfile(userId);
    if (!profile) return res.status(404).json({ message: "No artist profile" });
    const updated = await storage.updateArtistProfile(profile.id, req.body);
    res.json(updated);
  });

  app.get("/api/public/artists", async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const artists = await storage.getArtistProfiles(limit);
    res.json(artists);
  });

  app.get("/api/public/artists/search", async (req, res) => {
    const q = String(req.query.q || "");
    if (!q) return res.json([]);
    const results = await storage.searchArtists(q);
    res.json(results);
  });

  app.get("/api/public/artists/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Registration required to view artist profiles" });
    }
    const id = Number(req.params.id);
    const profile = await storage.getArtistProfileById(id);
    if (!profile) return res.sendStatus(404);
    await storage.incrementProfileViews(id);
    const songs = await storage.getArtistSongs(id);
    const followers = await storage.getFollowerCount(id);
    const subscribers = await storage.getSubscriberCount(id);
    const userId = (req.user as any).claims.sub;
    const isFollowing = await storage.isFollowing(userId, id);
    const isSubscribed = await storage.isSubscribed(userId, id);
    res.json({ ...profile, songs, followerCount: followers, subscriberCount: subscribers, isFollowing, isSubscribed });
  });

  app.post("/api/artists/:id/follow", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const artistId = Number(req.params.id);
    const result = await storage.toggleFollow(userId, artistId);
    res.json(result);
  });

  app.post("/api/artists/:id/subscribe", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const artistId = Number(req.params.id);
    const profile = await storage.getArtistProfileById(artistId);
    if (!profile) return res.sendStatus(404);
    const already = await storage.isSubscribed(userId, artistId);
    if (already) return res.status(409).json({ message: "Already subscribed" });
    const sub = await storage.createArtistSubscription({
      subscriberId: userId,
      artistId,
      status: "active",
      priceAtSubscription: profile.monthlySubscriptionPrice || 299,
    });
    res.json(sub);
  });

  app.delete("/api/artists/:id/subscribe", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const artistId = Number(req.params.id);
    const subs = await storage.getUserSubscriptions(userId);
    const sub = subs.find(s => s.artistId === artistId);
    if (!sub) return res.status(404).json({ message: "Not subscribed" });
    const canceled = await storage.cancelArtistSubscription(sub.id);
    res.json(canceled);
  });

  app.get("/api/artist/subscribers", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const profile = await storage.getArtistProfile(userId);
    if (!profile) return res.json([]);
    const subs = await storage.getArtistSubscribers(profile.id);
    res.json(subs);
  });

  app.get("/api/artist/subscriptions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const subs = await storage.getUserSubscriptions(userId);
    res.json(subs);
  });

  app.get("/api/artist/earnings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const profile = await storage.getArtistProfile(userId);
    if (!profile) return res.json({ earnings: [], totals: { gross: 0, net: 0, pending: 0 } });
    const earnings = await storage.getSongEarnings(profile.id);
    const totals = await storage.getArtistTotalEarnings(profile.id);
    const user = await storage.getUser(userId);
    const isPro = user?.subscriptionTier === "pro" || user?.subscriptionTier === "producer" || user?.subscriptionTier === "premium";
    const platformFeePercent = isPro ? 0 : 5;
    res.json({ earnings, totals, platformFeePercent, isPro });
  });

  app.get("/api/artist/dashboard", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const profile = await storage.getArtistProfile(userId);
    if (!profile) return res.json(null);
    const user = await storage.getUser(userId);
    const isPro = user?.subscriptionTier === "pro" || user?.subscriptionTier === "producer" || user?.subscriptionTier === "premium";
    const subscribers = await storage.getSubscriberCount(profile.id);
    const followers = await storage.getFollowerCount(profile.id);
    const totals = await storage.getArtistTotalEarnings(profile.id);
    const songs = await storage.getUserSongs(userId);
    const totalPlays = songs.reduce((s, song) => s + (song.playCount || 0), 0);
    const registrations = await storage.getProRegistrations(profile.id);
    res.json({
      profile,
      isPro,
      platformFeePercent: isPro ? 0 : 5,
      subscribers,
      followers,
      totals,
      totalSongs: songs.length,
      totalPlays,
      registrations,
    });
  });

  app.get("/api/artist/pro-registrations", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const profile = await storage.getArtistProfile(userId);
    if (!profile) return res.json([]);
    const regs = await storage.getProRegistrations(profile.id);
    res.json(regs);
  });

  app.post("/api/artist/pro-registrations", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const profile = await storage.getArtistProfile(userId);
    if (!profile) return res.status(404).json({ message: "Create artist profile first" });
    const { songId, workTitle, writers, publishers } = req.body;
    if (!songId || !workTitle) return res.status(400).json({ message: "songId and workTitle required" });
    const proEntity = profile.proEntity || "none";
    if (proEntity === "none") return res.status(400).json({ message: "Set your PRO entity (BMI/ASCAP) in your artist profile first" });
    const reg = await storage.createProRegistration({
      songId,
      artistId: profile.id,
      proEntity,
      registrationStatus: "pending",
      workTitle,
      writers: writers || [{ name: profile.artistName, role: "writer", share: 100 }],
      publishers: publishers || [],
    });
    res.json(reg);
  });

  // ========== AI LYRICS TITLE SUGGESTIONS ==========
  app.post("/api/ai/suggest-titles", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { lyrics, genre, description } = req.body;
    if (!lyrics && !description) return res.status(400).json({ message: "Lyrics or description required" });
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a creative music title generator. Given lyrics or a description, suggest 5 compelling song titles. Return only a JSON array of strings." },
          { role: "user", content: `Genre: ${genre || "any"}\n${description ? `Description: ${description}\n` : ""}${lyrics ? `Lyrics:\n${lyrics}` : ""}` },
        ],
        response_format: { type: "json_object" },
      });
      const content = response.choices[0]?.message?.content || '{"titles":[]}';
      const parsed = JSON.parse(content);
      res.json({ titles: parsed.titles || parsed.suggestions || [] });
    } catch (err: any) {
      console.error("[AI] Title suggestion error:", err.message);
      res.status(500).json({ message: "Failed to generate title suggestions" });
    }
  });

  // ========== AI COVER ART GENERATION ==========
  app.post("/api/ai/generate-cover", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { prompt, songId, genre, title } = req.body;
    if (!prompt) return res.status(400).json({ message: "Prompt is required" });
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const genreStyles: Record<string, string> = {
        Bachata: "tropical Caribbean night, palm trees silhouette, warm golden and deep blue tones, romantic moonlit ambiance, Dominican Republic vibes, sensual dance couple silhouette",
        Bolero: "vintage romantic atmosphere, rose petals, candlelight, warm sepia tones, classic elegant feel, nostalgic old Havana, soft dreamy lighting",
        Salsa: "vibrant tropical colors, red orange yellow, energetic dance movement, Latin nightclub neon lights, Fania Records aesthetic, bold and dynamic",
        Merengue: "colorful carnival energy, Dominican flag colors, festive celebration, bright tropical setting, dynamic and joyful, perico ripiao traditional feel",
        Reggaeton: "urban neon cityscape at night, purple and cyan lights, modern street art graffiti, bold typography aesthetic, dark moody with vibrant accents",
        Cumbia: "Colombian countryside sunset, warm earth tones with pops of color, traditional folklore elements, tropical flowers, golden hour lighting",
        Jazz: "smoky jazz club atmosphere, saxophone silhouette, deep blue and gold tones, noir aesthetic, vintage vinyl record feel, sophisticated mood",
        "R&B": "luxurious modern aesthetic, soft purple and gold gradients, city skyline at golden hour, smooth and sensual mood, contemporary elegant",
        "Hip Hop": "urban street culture, graffiti walls, bold contrasting colors, metropolitan skyline, gritty authentic feel, strong visual impact",
        Pop: "bright colorful modern design, clean and polished, candy-like color palette, trending aesthetic, playful geometric shapes, commercial appeal",
        EDM: "futuristic digital landscape, neon light trails, cosmic space elements, electric blue and magenta, abstract waveforms, high energy festival vibes",
        Vallenato: "Colombian Caribbean coast, accordion and guitar, warm sunset colors, romantic countryside, traditional folk art elements",
      };

      const genreStyle = genreStyles[genre || ""] || "professional music production studio, dramatic lighting, artistic abstract design, bold visual composition";

      const enrichedPrompt = `Professional album cover artwork for a ${genre || "Latin"} music single${title ? ` titled "${title}"` : ""}. User vision: ${prompt}. Visual style: ${genreStyle}. Requirements: Square format 1:1 ratio, NO text or letters or words on the image, cinematic quality, professional music industry standard, high detail, visually striking composition, suitable for streaming platforms like Spotify and Apple Music.`;

      const response = await client.images.generate({
        model: "gpt-image-1",
        prompt: enrichedPrompt,
        n: 1,
        size: "1024x1024",
      });

      const imageBase64 = response.data?.[0]?.b64_json;
      if (!imageBase64) throw new Error("No image generated");

      const fs = await import("fs/promises");
      const path = await import("path");
      const buffer = Buffer.from(imageBase64, "base64");
      const dir = path.join(process.cwd(), "public", "audio", "covers");
      await fs.mkdir(dir, { recursive: true });
      const filename = `cover_ai_${songId || "new"}_${Date.now()}.png`;
      await fs.writeFile(path.join(dir, filename), buffer);
      const localUrl = `/audio/covers/${filename}`;

      if (songId) {
        await storage.updateSongImage(Number(songId), localUrl);
      }

      res.json({ imageUrl: localUrl });
    } catch (err: any) {
      console.error("[AI] Cover generation error:", err.message);
      res.status(500).json({ message: "Failed to generate cover art" });
    }
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

  // ========== RUNPOD SERVERLESS WEBHOOK ==========

  app.post("/api/webhooks/runpod-serverless", async (req, res) => {
    try {
      const payload = req.body;
      const { output, status: jobStatus, error: topLevelError, input: jobInput } = payload;

      console.log(`[Webhook] RunPod Serverless webhook: status=${jobStatus}, hasOutput=${!!output}, hasError=${!!topLevelError}`);

      if (!output && (jobStatus === "FAILED" || jobStatus === "TIMED_OUT" || jobStatus === "CANCELLED")) {
        const errorMsg = topLevelError || `Job ${jobStatus}`;
        const inputAction = jobInput?.action;
        const songId = jobInput?.song_id;
        const kitId = jobInput?.kit_id;
        console.error(`[Webhook] Serverless job ${jobStatus}: ${errorMsg} (action=${inputAction})`);

        if (songId && (inputAction === "generate_music" || !inputAction)) {
          await storage.updateSongStatus(songId, "failed", undefined, errorMsg.substring(0, 300));
        }
        if (kitId && (inputAction === "train_model" || !inputAction)) {
          await storage.updateStyleKit(kitId, { trainingStatus: "failed", trainingError: errorMsg });
        }
        return res.sendStatus(200);
      }

      if (!output) {
        console.log("[Webhook] RunPod Serverless: no output in payload, ignoring");
        return res.sendStatus(200);
      }

      const action = output.action || jobInput?.action;
      console.log(`[Webhook] RunPod Serverless processing: action=${action}, jobStatus=${jobStatus}`);

      if (action === "generate_music" || output.songId) {
        const songId = output.songId || output.song_id;
        if (!songId) return res.sendStatus(200);

        if (jobStatus === "FAILED" || output.status === "failed") {
          const errorMsg = output.error || payload.error || "Serverless generation failed";
          console.error(`[Webhook] Serverless music FAILED for song ${songId}: ${errorMsg}`);
          await storage.updateSongStatus(songId, "failed", undefined, errorMsg.substring(0, 300));
        } else if (output.audioBase64 && (jobStatus === "COMPLETED" || output.status === "completed")) {
          const audioFormat = output.audioFormat || "mp3";
          const localUrl = await saveRunPodAudio(output.audioBase64, songId, audioFormat);
          await storage.updateSongStatus(songId, "completed", localUrl);
          if (output.duration) {
            try {
              const { db } = await import("./db");
              const { songs: songsTable } = await import("@shared/schema");
              const { eq } = await import("drizzle-orm");
              await db.update(songsTable).set({ duration: output.duration }).where(eq(songsTable.id, songId));
            } catch {}
          }
          console.log(`[Webhook] Serverless song ${songId} saved: ${localUrl}`);
        }
      }

      if (action === "train_model" || output.kitId) {
        const kitId = output.kitId || output.kit_id;
        if (kitId) {
          if (jobStatus === "FAILED" || output.status === "failed") {
            const errorMsg = output.error || output.message || "Training failed";
            console.error(`[Webhook] Serverless training FAILED for kit ${kitId}: ${errorMsg}`);
            await storage.updateStyleKit(kitId, { trainingStatus: "failed", trainingError: errorMsg });
          } else if (jobStatus === "COMPLETED" || output.status === "completed") {
            const modelUrl = output.modelPath || output.model_url || output.trainedModelUrl;
            console.log(`[Webhook] Serverless training COMPLETED for kit ${kitId}: ${modelUrl}`);
            await storage.updateStyleKit(kitId, {
              trainingStatus: "completed",
              trainedModelUrl: modelUrl,
              pipelineStep: "ready",
              lastTrainedAt: new Date(),
            });
          } else if (output.status === "training") {
            console.log(`[Webhook] Serverless training progress for kit ${kitId}: ${output.message}`);
          }
        }
      }

      if (action === "separate_stems" || output.stems) {
        const songId = output.songId || output.song_id;
        if (songId && output.stems) {
          console.log(`[Webhook] Serverless stems completed for song ${songId}`);
        }
      }

      res.sendStatus(200);
    } catch (err: any) {
      console.error("[Webhook] Error processing RunPod Serverless webhook:", err);
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

      cancelStemTimeout(songId);

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

  // ========== KIE.AI STEMS CALLBACK ==========

  app.post("/api/kie/stems-callback", async (req, res) => {
    try {
      const payload = req.body;
      console.log(`[Kie.ai Stems Callback] Received:`, JSON.stringify(payload).substring(0, 500));

      const taskId = payload?.data?.task_id || payload?.task_id;
      if (!taskId) {
        console.log("[Kie.ai Stems Callback] No task_id in payload, ignoring");
        return res.sendStatus(200);
      }

      let song = await storage.getSongByTaskId(taskId);

      if (!song) {
        const mappedSongId = getSongIdForStemTask(taskId);
        if (mappedSongId) {
          song = await storage.getSong(mappedSongId);
          console.log(`[Kie.ai Stems Callback] Found song ${mappedSongId} via stem task map`);
          clearStemTask(taskId);
        }
      }

      if (!song) {
        console.log(`[Kie.ai Stems Callback] No song found for task_id ${taskId}`);
        return res.sendStatus(200);
      }

      const tracks = await storage.getTracksBySongId(song.id);
      if (tracks.length === 0) {
        console.log(`[Kie.ai Stems Callback] No tracks found for song ${song.id}`);
        return res.sendStatus(200);
      }

      const { parseKieStemCallbackData } = await import("./core/kie_engine");
      const { downloadFile } = await import("./core/generic_api_engine");
      const stemUrls = parseKieStemCallbackData(payload?.data || payload);

      console.log(`[Kie.ai Stems Callback] Parsed stems: ${Object.keys(stemUrls).join(", ")}`);

      const STEM_MAP: Record<string, string> = {
        vocals: "vocals",
        drums: "drums",
        bass: "bass",
        other: "other",
        instrumental: "other",
      };

      for (const track of tracks) {
        const stemKey = track.type;
        const apiKey = stemKey === "other" ? "instrumental" : stemKey;
        const remoteUrl = stemUrls[stemKey] || stemUrls[apiKey];

        if (remoteUrl) {
          try {
            const localUrl = await downloadFile(remoteUrl, "stems", `${song.id}_${track.type}`);
            await storage.updateTrackStatus(track.id, "completed", localUrl);
            console.log(`[Kie.ai Stems Callback] ${track.type} stem saved: ${localUrl}`);
          } catch (dlErr: any) {
            console.error(`[Kie.ai Stems Callback] Failed to download ${track.type}:`, dlErr.message);
            await storage.updateTrackStatus(track.id, "failed", undefined, dlErr.message);
          }
        } else {
          await storage.updateTrackStatus(track.id, "completed", undefined);
          console.log(`[Kie.ai Stems Callback] ${track.type}: no URL available`);
        }
      }

      console.log(`[Kie.ai Stems Callback] Stem separation completed for song ${song.id}`);
      res.sendStatus(200);
    } catch (err: any) {
      console.error("[Kie.ai Stems Callback] Error:", err.message);
      res.sendStatus(200);
    }
  });

  // ========== TRACKS / STEMS ROUTES ==========

  app.post("/api/songs/:id/stems", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;

    const user = await storage.getUser(userId);
    const tier = user?.subscriptionTier || "free";
    const isAdminUser = user?.role === "super_admin" || user?.role === "admin";
    if (!isAdminUser && tier !== "pro" && tier !== "premium" && tier !== "producer") {
      return res.status(403).json({ message: "Stem separation requires a Pro or Premium subscription. Upgrade your plan to access this feature." });
    }

    const songId = Number(req.params.id);
    const song = await storage.getSong(songId);
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    if (song.status !== "completed" || !song.audioUrl) {
      return res.status(400).json({ message: "Song must be completed with audio before stem separation" });
    }

    const existingTracks = await storage.getTracksBySongId(songId);
    if (existingTracks.length > 0) {
      const allStuck = existingTracks.every(t => t.status === "failed" || t.status === "pending");
      const anyProcessing = existingTracks.some(t => t.status === "processing");
      const anyCompleted = existingTracks.some(t => t.status === "completed" && t.audioUrl);

      if (anyCompleted) {
        return res.status(400).json({ message: "Stems already exist for this song", tracks: existingTracks });
      }

      if (anyProcessing) {
        const oldestProcessing = existingTracks.filter(t => t.status === "processing")
          .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime())[0];
        const ageMs = Date.now() - new Date(oldestProcessing.createdAt!).getTime();
        if (ageMs < 600000) {
          return res.status(400).json({ message: "Stem separation is still in progress", tracks: existingTracks });
        }
      }

      await storage.deleteTracksBySongId(songId);
    }

    processStemSeparation(songId, song.audioUrl, userId, song.taskId, song.kieAudioId);
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
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [".wav", ".mp3", ".ogg", ".webm", ".m4a", ".flac", ".aif", ".aiff"];
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

  // ========== AUDIO TOOLS: VOICE CONVERSION ==========
  app.post("/api/songs/:id/voice-convert", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const songId = Number(req.params.id);
    const song = await storage.getSong(songId);
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    if (song.status !== "completed" || !song.audioUrl) {
      return res.status(400).json({ message: "Song must be completed with audio" });
    }
    const { voiceId, pitch } = req.body;
    if (!voiceId) return res.status(400).json({ message: "voiceId is required" });
    processVoiceConversion(songId, song.audioUrl, voiceId, userId, pitch);
    res.status(202).json({ message: "Voice conversion started", songId });
  });

  // ========== AUDIO TOOLS: DE-ECHO ==========
  app.post("/api/songs/:id/de-echo", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const songId = Number(req.params.id);
    const song = await storage.getSong(songId);
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    if (song.status !== "completed" || !song.audioUrl) {
      return res.status(400).json({ message: "Song must be completed with audio" });
    }
    processDeEcho(songId, song.audioUrl);
    res.status(202).json({ message: "De-echo processing started", songId });
  });

  // ========== AUDIO TOOLS: DE-REVERB ==========
  app.post("/api/songs/:id/de-reverb", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const songId = Number(req.params.id);
    const song = await storage.getSong(songId);
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    if (song.status !== "completed" || !song.audioUrl) {
      return res.status(400).json({ message: "Song must be completed with audio" });
    }
    processDeReverb(songId, song.audioUrl);
    res.status(202).json({ message: "De-reverb processing started", songId });
  });

  // ========== AUDIO TOOLS: TEXT TO SPEECH ==========
  app.post("/api/audio/tts", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const { text, voiceId, language } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ message: "Text is required" });
    processTTS(userId, text.trim(), voiceId, language);
    res.status(202).json({ message: "Text to speech started" });
  });

  // ========== AUDIO TOOLS: SOUND GENERATOR ==========
  app.post("/api/audio/sound-generator", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const { prompt, duration } = req.body;
    if (!prompt || prompt.trim().length === 0) return res.status(400).json({ message: "Prompt is required" });
    processSoundGeneration(userId, prompt.trim(), duration);
    res.status(202).json({ message: "Sound generation started" });
  });

  // ========== AUDIO TOOLS: TRANSCRIPTION ==========
  app.post("/api/songs/:id/transcribe", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const songId = Number(req.params.id);
    const song = await storage.getSong(songId);
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    if (song.status !== "completed" || !song.audioUrl) {
      return res.status(400).json({ message: "Song must be completed with audio" });
    }
    const { language } = req.body;
    const result = await processTranscription(songId, song.audioUrl, language);
    res.json({ message: "Transcription complete", text: result.text || "" });
  });

  // ========== AUDIO TOOLS: REMIX ==========
  app.post("/api/songs/:id/remix", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const songId = Number(req.params.id);
    const song = await storage.getSong(songId);
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    if (song.status !== "completed" || !song.audioUrl) {
      return res.status(400).json({ message: "Song must be completed with audio" });
    }
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ message: "Remix prompt is required" });
    processRemix(songId, song.audioUrl, prompt, userId);
    res.status(202).json({ message: "Remix started", songId });
  });

  // ========== AUDIO TOOLS: SPEED CHANGER ==========
  app.post("/api/songs/:id/speed", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const songId = Number(req.params.id);
    const song = await storage.getSong(songId);
    if (!song) return res.sendStatus(404);
    if (song.userId !== userId) return res.sendStatus(403);
    if (song.status !== "completed" || !song.audioUrl) {
      return res.status(400).json({ message: "Song must be completed with audio" });
    }
    const { speed, pitch } = req.body;
    if (!speed || speed < 0.25 || speed > 4.0) {
      return res.status(400).json({ message: "Speed must be between 0.25 and 4.0" });
    }
    processSpeedChange(songId, song.audioUrl, speed, userId, pitch);
    res.status(202).json({ message: "Speed change started", songId });
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

  initializeAdapters();

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

  seedKieProvider().catch((err: any) =>
    console.log("[Seed] Kie.ai seed error:", err.message?.substring(0, 100))
  );

  seedReplicateStemsProvider().catch((err: any) =>
    console.log("[Seed] Replicate Stems seed error:", err.message?.substring(0, 100))
  );

  updateProviderPriorities().catch((err: any) =>
    console.log("[Seed] Priority update error:", err.message?.substring(0, 100))
  );

  seedTrainingKits().catch((err: any) =>
    console.log("[Seed] Training kits seed error:", err.message?.substring(0, 100))
  );

  seedDiscography().catch((err: any) =>
    console.log("[Seed] Discography seed error:", err.message?.substring(0, 100))
  );

  // ========== DISCOGRAPHY ==========

  app.get("/api/public/discography", async (_req, res) => {
    try {
      const discography = await storage.getAllDiscographyPublic();
      res.json(discography);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/public/discography/:artistId", async (req, res) => {
    try {
      const artistId = Number(req.params.artistId);
      const albums = await storage.getArtistDiscographyPublic(artistId);
      const artist = await storage.getArtistProfileById(artistId);
      res.json({ artist, albums });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/discography/albums", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const album = await storage.createDiscographyAlbum(req.body);
      res.json(album);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/discography/albums/:id", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const album = await storage.updateDiscographyAlbum(Number(req.params.id), req.body);
      res.json(album);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/discography/albums/:id", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      await storage.deleteDiscographyAlbum(Number(req.params.id));
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/discography/tracks", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const track = await storage.createDiscographyTrack(req.body);
      res.json(track);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/discography/tracks/:id", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      await storage.deleteDiscographyTrack(Number(req.params.id));
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/discography/import/spotify", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const { artistId, spotifyArtistId } = req.body;
      if (!artistId || !spotifyArtistId) {
        return res.status(400).json({ message: "artistId and spotifyArtistId required" });
      }

      const { getSpotifyClient } = await import("./core/spotify_client");
      const spotify = await getSpotifyClient();

      const spotifyAlbums = await spotify.artists.albums(spotifyArtistId, "album,single,compilation", undefined, 50);

      const imported: any[] = [];
      for (const sa of spotifyAlbums.items) {
        const existing = await storage.getDiscographyAlbums(artistId);
        if (existing.find(e => e.spotifyAlbumId === sa.id)) continue;

        const album = await storage.createDiscographyAlbum({
          artistId,
          title: sa.name,
          albumType: sa.album_type === "single" ? "single" : sa.album_type === "compilation" ? "compilation" : "album",
          releaseDate: sa.release_date,
          coverImageUrl: sa.images?.[0]?.url || null,
          genre: null,
          tracksCount: sa.total_tracks,
          spotifyAlbumId: sa.id,
          spotifyUrl: sa.external_urls?.spotify || null,
          isPublished: true,
        });

        try {
          const spotifyTracks = await spotify.albums.tracks(sa.id, undefined, 50);
          const trackInserts = spotifyTracks.items.map((st: any, idx: number) => ({
            albumId: album.id,
            title: st.name,
            trackNumber: st.track_number || idx + 1,
            durationSeconds: Math.round((st.duration_ms || 0) / 1000),
            featuring: st.artists?.length > 1 ? st.artists.slice(1).map((a: any) => a.name).join(", ") : null,
            spotifyTrackId: st.id,
            previewUrl: st.preview_url || null,
          }));
          if (trackInserts.length > 0) {
            await storage.createDiscographyTracksBulk(trackInserts);
          }
        } catch (trackErr: any) {
          console.log(`[Discography] Failed to fetch tracks for album ${sa.name}: ${trackErr.message}`);
        }

        imported.push(album);
      }

      res.json({ imported: imported.length, albums: imported });
    } catch (err: any) {
      console.error("[Discography] Spotify import error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/discography/spotify/search", async (req, res) => {
    if (!(await requireRole(req, res, "admin"))) return;
    try {
      const q = req.query.q as string;
      if (!q) return res.status(400).json({ message: "q parameter required" });

      const { getSpotifyClient } = await import("./core/spotify_client");
      const spotify = await getSpotifyClient();
      const results = await spotify.search(q, ["artist"], undefined, 10);

      res.json(results.artists?.items?.map(a => ({
        id: a.id,
        name: a.name,
        image: a.images?.[0]?.url,
        genres: a.genres,
        followers: a.followers?.total,
        spotifyUrl: a.external_urls?.spotify,
      })) || []);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== ARTIST-OWNED DISCOGRAPHY ==========

  app.get("/api/artist/discography", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const userId = (req.user as any).claims.sub;
      const profile = await storage.getArtistProfile(userId);
      if (!profile) return res.status(404).json({ message: "Artist profile not found" });
      const albums = await storage.getDiscographyAlbums(profile.id);
      res.json(albums);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/artist/discography/albums", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const userId = (req.user as any).claims.sub;
      const profile = await storage.getArtistProfile(userId);
      if (!profile) return res.status(404).json({ message: "Artist profile not found" });
      const album = await storage.createDiscographyAlbum({ ...req.body, artistId: profile.id });
      res.json(album);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/artist/discography/albums/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const userId = (req.user as any).claims.sub;
      const profile = await storage.getArtistProfile(userId);
      if (!profile) return res.status(404).json({ message: "Artist profile not found" });
      const albums = await storage.getDiscographyAlbums(profile.id);
      const album = albums.find(a => a.id === Number(req.params.id));
      if (!album) return res.status(403).json({ message: "Not your album" });
      const updated = await storage.updateDiscographyAlbum(Number(req.params.id), req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/artist/discography/albums/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const userId = (req.user as any).claims.sub;
      const profile = await storage.getArtistProfile(userId);
      if (!profile) return res.status(404).json({ message: "Artist profile not found" });
      const albums = await storage.getDiscographyAlbums(profile.id);
      const album = albums.find(a => a.id === Number(req.params.id));
      if (!album) return res.status(403).json({ message: "Not your album" });
      await storage.deleteDiscographyAlbum(Number(req.params.id));
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/artist/discography/tracks", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const userId = (req.user as any).claims.sub;
      const profile = await storage.getArtistProfile(userId);
      if (!profile) return res.status(404).json({ message: "Artist profile not found" });
      const albums = await storage.getDiscographyAlbums(profile.id);
      const album = albums.find(a => a.id === Number(req.body.albumId));
      if (!album) return res.status(403).json({ message: "Not your album" });
      const track = await storage.createDiscographyTrack(req.body);
      res.json(track);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/artist/discography/tracks/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const userId = (req.user as any).claims.sub;
      const profile = await storage.getArtistProfile(userId);
      if (!profile) return res.status(404).json({ message: "Artist profile not found" });
      await storage.deleteDiscographyTrack(Number(req.params.id));
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/artist/discography/spotify/search", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const query = req.query.q as string;
      if (!query) return res.status(400).json({ message: "Search query required" });
      const { getSpotifyClient } = await import("./core/spotify_client");
      const spotify = await getSpotifyClient();
      const results = await spotify.search(query, ["artist"], undefined, 10);
      const artists = results.artists?.items?.map((a: any) => ({
        id: a.id,
        name: a.name,
        genres: a.genres,
        imageUrl: a.images?.[0]?.url,
        followers: a.followers?.total,
        popularity: a.popularity,
        spotifyUrl: a.external_urls?.spotify,
      })) || [];
      res.json(artists);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/artist/discography/import/spotify", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const userId = (req.user as any).claims.sub;
      const profile = await storage.getArtistProfile(userId);
      if (!profile) return res.status(404).json({ message: "Artist profile not found" });
      
      const { spotifyArtistId } = req.body;
      if (!spotifyArtistId) return res.status(400).json({ message: "spotifyArtistId required" });
      
      await storage.updateArtistProfile(userId, { spotifyArtistId } as any);
      
      const { getSpotifyClient } = await import("./core/spotify_client");
      const spotify = await getSpotifyClient();
      const spotifyAlbums = await spotify.artists.albums(spotifyArtistId, "album,single,compilation", undefined, 50);
      
      const imported: any[] = [];
      for (const sa of spotifyAlbums.items) {
        const existing = await storage.getDiscographyAlbums(profile.id);
        if (existing.find(e => e.spotifyAlbumId === sa.id)) continue;
        
        const album = await storage.createDiscographyAlbum({
          artistId: profile.id,
          title: sa.name,
          albumType: sa.album_type || "album",
          releaseDate: sa.release_date,
          coverImageUrl: sa.images?.[0]?.url || null,
          spotifyAlbumId: sa.id,
          spotifyUrl: sa.external_urls?.spotify || null,
          tracksCount: sa.total_tracks || 0,
          genre: profile.genre || null,
        });
        
        try {
          const spotifyTracks = await spotify.albums.tracks(sa.id, undefined, 50);
          for (const st of spotifyTracks.items) {
            await storage.createDiscographyTrack({
              albumId: album.id,
              title: st.name,
              trackNumber: st.track_number,
              durationSeconds: Math.round(st.duration_ms / 1000),
              featuring: st.artists?.slice(1).map((a: any) => a.name).join(", ") || null,
              spotifyTrackId: st.id,
              previewUrl: st.preview_url || null,
            });
          }
        } catch (trackErr: any) {
          console.error(`[Spotify Import] Track import failed for album ${sa.name}:`, trackErr.message);
        }
        
        imported.push({ id: album.id, title: album.title, tracks: sa.total_tracks });
      }
      
      res.json({ imported, count: imported.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== PROFILE SOCIAL INTERACTIONS ==========

  app.post("/api/artists/:id/like", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const artistId = Number(req.params.id);
      const userId = (req.user as any).claims.sub;
      const result = await storage.toggleArtistProfileLike(artistId, userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/public/artists/:id/likes", async (req, res) => {
    try {
      const artistId = Number(req.params.id);
      const likes = await storage.getArtistProfileLikes(artistId);
      res.json({ count: likes.length, userIds: likes.map(l => l.userId) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/public/artists/:id/comments", async (req, res) => {
    try {
      const artistId = Number(req.params.id);
      const comments = await storage.getArtistProfileComments(artistId);
      res.json(comments);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/artists/:id/comments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const artistId = Number(req.params.id);
      const userId = (req.user as any).claims.sub;
      const { content } = req.body;
      if (!content || content.trim().length === 0) return res.status(400).json({ message: "Content required" });
      
      const user = await storage.getUser(userId);
      const comment = await storage.createArtistProfileComment({
        artistId,
        userId,
        userName: user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Fan",
        userAvatarUrl: user?.profileImageUrl || null,
        content: content.trim(),
      });
      res.json(comment);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/artists/:id/comments/:commentId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const userId = (req.user as any).claims.sub;
      const commentId = Number(req.params.commentId);
      const artistId = Number(req.params.id);
      const comments = await storage.getArtistProfileComments(artistId);
      const comment = comments.find(c => c.id === commentId);
      if (!comment) return res.status(404).json({ message: "Comment not found" });
      
      const profile = await storage.getArtistProfile(userId);
      if (comment.userId !== userId && (!profile || profile.id !== artistId)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      await storage.deleteArtistProfileComment(commentId);
      res.sendStatus(204);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/artists/:id/share", async (req, res) => {
    try {
      const artistId = Number(req.params.id);
      const userId = req.isAuthenticated() ? (req.user as any).claims.sub : null;
      const { platform } = req.body;
      await storage.createArtistProfileShare({ artistId, userId, platform: platform || "link" });
      const count = await storage.getArtistProfileShareCount(artistId);
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/public/artists/:id/shares", async (req, res) => {
    try {
      const artistId = Number(req.params.id);
      const count = await storage.getArtistProfileShareCount(artistId);
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== ARTIST GIFTS / DONATIONS ==========

  app.post("/api/artists/:id/gift", async (req, res) => {
    try {
      const artistId = Number(req.params.id);
      const { amountCents, message, fanDisplayName } = req.body;

      if (!amountCents || amountCents < 100) {
        return res.status(400).json({ message: "Minimum gift is $1.00" });
      }
      if (amountCents > 100000) {
        return res.status(400).json({ message: "Maximum gift is $1,000.00" });
      }

      const artist = await storage.getArtistProfileById(artistId);
      if (!artist) return res.status(404).json({ message: "Artist not found" });

      const platformFeeCents = Math.round(amountCents * 0.10);
      const netAmountCents = amountCents - platformFeeCents;

      const stripeClient = await getUncachableStripeClient();

      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        metadata: {
          type: "artist_gift",
          artistId: String(artistId),
          artistName: artist.artistName,
        },
      });

      const userId = (req as any).user?.claims?.sub || null;
      const gift = await storage.createArtistGift({
        artistId,
        fanUserId: userId,
        fanDisplayName: fanDisplayName || "Anonymous",
        amountCents,
        message: message || null,
        status: "pending",
        stripePaymentIntentId: paymentIntent.id,
        platformFeeCents,
        netAmountCents,
      });

      res.json({
        gift,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (err: any) {
      console.error("[Gift] Error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/gifts/:id/confirm", async (req, res) => {
    try {
      const giftId = Number(req.params.id);
      const gift = await storage.getArtistGift(giftId);
      if (!gift) return res.status(404).json({ message: "Gift not found" });

      if (gift.status === "completed") {
        return res.json({ gift });
      }

      if (gift.stripePaymentIntentId) {
        const stripeClient = await getUncachableStripeClient();
        const pi = await stripeClient.paymentIntents.retrieve(gift.stripePaymentIntentId);
        if (pi.status !== "succeeded") {
          return res.status(400).json({ message: "Payment not yet completed" });
        }
      }

      const updatedGift = await storage.updateArtistGift(giftId, { status: "completed" });

      const wallet = await storage.updateArtistWalletBalance(
        gift.artistId,
        gift.netAmountCents || 0,
        gift.platformFeeCents || 0
      );

      await storage.createWalletTransaction({
        artistId: gift.artistId,
        type: "gift_received",
        description: `Gift from ${gift.fanDisplayName || "Anonymous"}`,
        grossAmountCents: gift.amountCents,
        platformFeeCents: gift.platformFeeCents || 0,
        netAmountCents: gift.netAmountCents || 0,
        relatedGiftId: gift.id,
        balanceAfterCents: wallet.balanceCents || 0,
      });

      res.json({ gift: updatedGift, wallet });
    } catch (err: any) {
      console.error("[Gift] Confirm error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/artist/gifts", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const userId = (req.user as any).claims.sub;
      const profile = await storage.getArtistProfile(userId);
      if (!profile) {
        return res.json({ gifts: [], wallet: null, transactions: [] });
      }

      const gifts = await storage.getArtistGifts(profile.id);
      const wallet = await storage.getOrCreateArtistWallet(profile.id);
      const transactions = await storage.getWalletTransactions(profile.id);

      res.json({ gifts, wallet, transactions });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/public/artists/:id/gifts-summary", async (req, res) => {
    try {
      const artistId = Number(req.params.id);
      const gifts = await storage.getArtistGifts(artistId);
      const completed = gifts.filter(g => g.status === "completed");
      res.json({
        totalGifts: completed.length,
        totalAmountCents: completed.reduce((sum, g) => sum + g.amountCents, 0),
        recentGifts: completed.slice(0, 5).map(g => ({
          fanDisplayName: g.fanDisplayName,
          amountCents: g.amountCents,
          message: g.message,
          createdAt: g.createdAt,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

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

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const hostHeader = req.headers["host"] || "localhost:5000";
      const analysisWebhookUrl = `${protocol}://${hostHeader}/api/dgb-cloud/webhook`;
      const runpodAnalysisWebhookUrl = `${protocol}://${hostHeader}/api/analysis/webhook`;

      let gpuAnalysisSubmitted = false;

      if (isRunPodConfigured()) {
        let submittedCount = 0;
        for (const instr of withAudio) {
          if (!instr.audioUrl) continue;
          await storage.updateStyleKitInstrument(instr.id, { analysisStatus: "analyzing" });
          const result = await submitAnalysisJob(instr.id, instr.audioUrl, instr.name, runpodAnalysisWebhookUrl);
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
        if (submittedCount > 0) gpuAnalysisSubmitted = true;
        console.log(`[SAO Pipeline] Kit ${kitId}: ${submittedCount}/${withAudio.length} analysis jobs sent to RunPod`);
      }

      if (!gpuAnalysisSubmitted) {
        const cloudServer = await getActiveServer(storage, "instrument_processing");
        if (cloudServer) {
          let submittedCount = 0;
          for (const instr of withAudio) {
            if (!instr.audioUrl) continue;
            try {
              await storage.updateStyleKitInstrument(instr.id, { analysisStatus: "analyzing" });
              const uploadResult = await uploadInstrumentToCloud(
                instr.id, kitId, instr.name, instr.audioUrl, analysisWebhookUrl, cloudServer
              );
              if (uploadResult.success) {
                submittedCount++;
                console.log(`[SAO Pipeline] Instrument ${instr.id} sent to cloud server for analysis`);
              } else {
                await storage.updateStyleKitInstrument(instr.id, {
                  analysisStatus: "failed",
                  analysisError: `Cloud server upload failed: ${uploadResult.error}`,
                });
              }
            } catch (err: any) {
              await storage.updateStyleKitInstrument(instr.id, {
                analysisStatus: "failed",
                analysisError: `Cloud server error: ${err.message}`,
              });
            }
          }
          if (submittedCount > 0) gpuAnalysisSubmitted = true;
          console.log(`[SAO Pipeline] Kit ${kitId}: ${submittedCount}/${withAudio.length} analysis jobs sent to cloud server`);
        }
      }

      if (gpuAnalysisSubmitted) {
        res.json({
          message: `Analysis submitted to GPU server.`,
          kitId,
          instrumentCount: withAudio.length,
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

  app.post("/api/style-kits/:id/generate-virtual", async (req, res) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== process.env.SESSION_SECRET) {
      if (!(await requireRole(req, res, "admin"))) return;
    }
    try {
      const kitId = Number(req.params.id);
      const kit = await storage.getStyleKit(kitId);
      if (!kit) return res.sendStatus(404);

      const instruments = await storage.getStyleKitInstruments(kitId);
      const pending = instruments.filter(i => !i.audioUrl);
      if (pending.length === 0) {
        return res.json({ message: "All instruments already have audio.", count: 0 });
      }

      const { canUseKie, submitKieMusicGeneration, pollKieTask } = await import("./core/kie_engine");
      if (!canUseKie()) {
        return res.status(400).json({ message: "Kie.ai API not configured." });
      }

      const results: { id: number; name: string; status: string; error?: string }[] = [];

      for (const instr of pending) {
        const prompt = `${instr.name} solo, ${kit.genre} style, instrumental only, studio quality, isolated ${instr.type} sound, professional recording, bolero bachata modern arrangement, no vocals, clean mix`;
        try {
          console.log(`[Virtual Instrument] Generating "${instr.name}" for kit ${kitId}`);
          const { taskId } = await submitKieMusicGeneration(prompt, `${kit.genre} instrumental`, {
            title: instr.name,
            instrumental: true,
          });

          const pollResult = await pollKieTask(taskId, 180000, 8000);
          if (pollResult.audioUrl) {
            const https = await import("https");
            const http = await import("http");
            const filename = `${uuidv4()}.mp3`;
            const filePath = path.join("uploads", "audio", filename);
            await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

            await new Promise<void>((resolve, reject) => {
              const mod = pollResult.audioUrl.startsWith("https") ? https : http;
              mod.get(pollResult.audioUrl, (response: any) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                  mod.get(response.headers.location!, (r2: any) => {
                    const ws = fs.createWriteStream(filePath);
                    r2.pipe(ws);
                    ws.on("finish", resolve);
                    ws.on("error", reject);
                  }).on("error", reject);
                } else {
                  const ws = fs.createWriteStream(filePath);
                  response.pipe(ws);
                  ws.on("finish", resolve);
                  ws.on("error", reject);
                }
              }).on("error", reject);
            });

            const audioUrl = `/audio/${filename}`;
            await storage.updateStyleKitInstrument(instr.id, { audioUrl, uploadStatus: "uploaded" });
            results.push({ id: instr.id, name: instr.name, status: "generated" });
            console.log(`[Virtual Instrument] "${instr.name}" saved: ${audioUrl}`);
          } else {
            results.push({ id: instr.id, name: instr.name, status: "failed", error: "No audio URL returned" });
          }
        } catch (err: any) {
          console.error(`[Virtual Instrument] Failed for "${instr.name}":`, err.message);
          results.push({ id: instr.id, name: instr.name, status: "failed", error: err.message });
        }
      }

      res.json({ message: "Virtual instrument generation complete", results });
    } catch (err: any) {
      console.error("[Virtual Instrument] Error:", err.message);
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

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["host"] || "localhost:5000";
      const webhookUrl = `${protocol}://${host}/api/training/webhook`;

      let gpuSubmitted = false;

      const cloudServer = await getActiveServer(storage, "training");
      if (cloudServer) {
        try {
          const trainUrl = `${cloudServer.baseUrl}/api/train-kit`;
          const trainPayload = {
            kit_id: kitId,
            training_config: trainingConfig,
            webhook_url: webhookUrl,
          };
          const trainRes = await fetch(trainUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              [cloudServer.authHeaderName]: cloudServer.apiKey,
            },
            body: JSON.stringify(trainPayload),
            signal: AbortSignal.timeout(30000),
          });
          if (trainRes.ok) {
            const trainData = await trainRes.json() as any;
            await storage.updateStyleKit(kitId, {
              trainingStatus: "training",
              trainingJobId: trainData.jobId || `cloud_kit_${kitId}_${Date.now()}`,
            });
            console.log(`[SAO Pipeline] Admin training submitted to cloud server: ${cloudServer.baseUrl}`);
            gpuSubmitted = true;
          } else {
            const errText = await trainRes.text();
            console.error(`[SAO Pipeline] Cloud server training failed: ${trainRes.status} ${errText}`);
          }
        } catch (err: any) {
          console.error(`[SAO Pipeline] Cloud server training error: ${err.message}`);
        }
      }

      if (!gpuSubmitted && isRunPodConfigured()) {
        console.log(`[SAO Pipeline] Cloud server unavailable, trying RunPod fallback...`);
        const result = await submitTrainingJob(kitId, trainingConfig, webhookUrl);
        if (result.success) {
          await storage.updateStyleKit(kitId, {
            trainingStatus: "training",
            trainingJobId: result.jobId || null,
          });
          console.log(`[SAO Pipeline] Admin training job submitted to RunPod: ${result.jobId}`);
          gpuSubmitted = true;
        } else {
          console.error(`[SAO Pipeline] RunPod submission also failed: ${result.error}`);
        }
      }

      if (!gpuSubmitted) {
        await storage.updateStyleKit(kitId, {
          trainingStatus: "queued",
          trainingError: "No GPU server available. Check server status.",
        });
      }

      res.json({
        message: gpuSubmitted
          ? "Training submitted to GPU server."
          : "Training queued. Connect a GPU server to start training.",
        kitId,
        status: gpuSubmitted ? "training" : "queued",
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

  app.post("/api/style-kits/instruments/:id/upload", upload.single("audio"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const instrument = await storage.getStyleKitInstrument(Number(req.params.id));
      if (!instrument) return res.sendStatus(404);
      const kit = await storage.getStyleKit(instrument.kitId);
      if (!kit) return res.sendStatus(404);
      if (kit.createdBy !== userId && !isAdmin(req)) return res.sendStatus(403);
      if (!req.file) return res.status(400).json({ message: "No audio file provided" });

      const audioUrl = `/audio/${req.file.filename}`;
      const updated = await storage.updateStyleKitInstrument(instrument.id, { audioUrl, uploadStatus: "uploaded" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/producer/kits/:id/reference", upload.single("audio"), async (req, res) => {
    if (!(await checkProducerTier(req, res))) return;
    const userId = (req.user as any).claims.sub;
    try {
      const kitId = Number(req.params.id);
      const kit = await storage.getStyleKit(kitId);
      if (!kit) return res.sendStatus(404);
      if (kit.createdBy !== userId && !isAdmin(req)) return res.sendStatus(403);
      if (!req.file) return res.status(400).json({ message: "No audio file provided" });

      const referenceUrl = `/audio/${req.file.filename}`;
      await storage.updateStyleKit(kitId, { referenceUrl });
      res.json({ referenceUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/producer/kits/:id/reference", async (req, res) => {
    if (!(await checkProducerTier(req, res))) return;
    const userId = (req.user as any).claims.sub;
    try {
      const kitId = Number(req.params.id);
      const kit = await storage.getStyleKit(kitId);
      if (!kit) return res.sendStatus(404);
      if (kit.createdBy !== userId && !isAdmin(req)) return res.sendStatus(403);
      await storage.updateStyleKit(kitId, { referenceUrl: null });
      res.sendStatus(204);
    } catch (err: any) {
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

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["host"] || "localhost:5000";
      const webhookUrl = `${protocol}://${host}/api/training/webhook`;

      let gpuSubmitted = false;

      const cloudServer = await getActiveServer(storage, "training");
      if (cloudServer) {
        try {
          const trainUrl = `${cloudServer.baseUrl}/api/train-kit`;
          const trainPayload = {
            kit_id: kitId,
            training_config: trainingConfig,
            webhook_url: webhookUrl,
          };
          const trainRes = await fetch(trainUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              [cloudServer.authHeaderName]: cloudServer.apiKey,
            },
            body: JSON.stringify(trainPayload),
            signal: AbortSignal.timeout(30000),
          });
          if (trainRes.ok) {
            const trainData = await trainRes.json() as any;
            await storage.updateStyleKit(kitId, {
              trainingStatus: "training",
              trainingJobId: trainData.jobId || `cloud_kit_${kitId}_${Date.now()}`,
            });
            console.log(`[SAO Pipeline] Training submitted to cloud server: ${cloudServer.baseUrl}`);
            gpuSubmitted = true;
          } else {
            const errText = await trainRes.text();
            console.error(`[SAO Pipeline] Cloud server training failed: ${trainRes.status} ${errText}`);
          }
        } catch (err: any) {
          console.error(`[SAO Pipeline] Cloud server training error: ${err.message}`);
        }
      }

      if (!gpuSubmitted && isRunPodConfigured()) {
        console.log(`[SAO Pipeline] Cloud server unavailable, trying RunPod fallback...`);
        const result = await submitTrainingJob(kitId, trainingConfig, webhookUrl);
        if (result.success) {
          await storage.updateStyleKit(kitId, {
            trainingStatus: "training",
            trainingJobId: result.jobId || null,
          });
          console.log(`[SAO Pipeline] Job submitted to RunPod GPU: ${result.jobId}`);
          gpuSubmitted = true;
        } else {
          console.error(`[SAO Pipeline] RunPod submission also failed: ${result.error}`);
        }
      }

      if (!gpuSubmitted) {
        const errorMsg = "No GPU server available. Connect a GPU server or check server status.";
        await storage.updateStyleKit(kitId, {
          trainingStatus: "queued",
          trainingError: errorMsg,
        });
        console.error(`[SAO Pipeline] Kit ${kitId} training: no GPU servers available`);
      }

      res.json({
        message: gpuSubmitted
          ? "Training submitted to GPU server. Your kit is being fine-tuned with the SAO pipeline."
          : "Training queued. No GPU server responded. You can retry when a server is available.",
        kitId,
        instrumentCount: withPrompts.length,
        status: gpuSubmitted ? "training" : "queued",
        gpuConnected: gpuSubmitted,
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
      const authHeader = (req.headers["x-webhook-secret"] || req.headers["x-dgb-api-key"] || req.headers["authorization"] || "") as string;
      let verified = false;
      if (webhookSecret && (authHeader === webhookSecret || authHeader === `Bearer ${webhookSecret}`)) {
        verified = true;
      }
      if (!verified) {
        const cloudVerified = await verifyWebhookFromAnyServer(req.headers as any, storage);
        if (!cloudVerified && webhookSecret) {
          return res.status(401).json({ message: "Invalid webhook secret" });
        }
      }

      const { kitId, status, modelUrl, modelPath, error, jobId } = req.body;
      if (!kitId) return res.status(400).json({ message: "kitId required" });

      const kit = await storage.getStyleKit(Number(kitId));
      if (!kit) return res.sendStatus(404);

      if (kit.trainingJobId && jobId && kit.trainingJobId !== jobId) {
        console.log(`[Training] Ignoring stale webhook for kit ${kitId}: expected job ${kit.trainingJobId}, got ${jobId}`);
        return res.json({ success: true, ignored: true });
      }

      const resolvedModelUrl = modelUrl || modelPath;
      const resolvedStatus = status === "completed" ? "ready" : (status || "ready");

      const updateData: any = { trainingStatus: resolvedStatus };
      if (resolvedModelUrl) updateData.trainedModelUrl = resolvedModelUrl;
      if (error) updateData.trainingError = error;
      if (jobId) updateData.trainingJobId = jobId;
      if (resolvedStatus === "ready") {
        updateData.pipelineStep = "ready";
        updateData.lastTrainedAt = new Date();
      }
      if (resolvedStatus === "failed") updateData.pipelineStep = "train";

      await storage.updateStyleKit(Number(kitId), updateData);

      if (resolvedStatus === "ready") {
        const instruments = await storage.getStyleKitInstruments(Number(kitId));
        for (const instr of instruments) {
          if (instr.audioUrl) {
            await storage.updateStyleKitInstrument(instr.id, { uploadStatus: "processed" });
          }
        }
      }

      console.log(`[Training] Webhook received for kit ${kitId}: status=${status} -> resolved=${resolvedStatus}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Training] Webhook error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/style-kits/:id/reset-training", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).claims.sub;
      const userRecord = await storage.getUser(userId);
      if (!userRecord || !["super_admin", "admin"].includes(userRecord.role || "")) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const kitId = Number(req.params.id);
      const kit = await storage.getStyleKit(kitId);
      if (!kit) return res.sendStatus(404);

      const instruments = await storage.getStyleKitInstruments(kitId);
      const withPrompts = instruments.filter(i => i.generatedPrompt).length;

      const resetStep = withPrompts > 0 ? "prompt" : "upload";

      await storage.updateStyleKit(kitId, {
        trainingStatus: "pending",
        trainingError: null,
        trainingJobId: null,
        pipelineStep: resetStep,
      });

      console.log(`[Training] Admin ${userId} reset kit ${kitId} training to step: ${resetStep}`);
      res.json({ success: true, kitId, resetTo: resetStep });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/style-kits/:id/training-status", async (req, res) => {
    try {
      const kitId = Number(req.params.id);
      const kit = await storage.getStyleKit(kitId);
      if (!kit) return res.sendStatus(404);

      const instruments = await storage.getStyleKitInstruments(kitId);
      const totalInstruments = instruments.length;
      const withAudio = instruments.filter(i => i.audioUrl).length;
      const analyzed = instruments.filter(i => i.analysisStatus === "complete").length;
      const withPrompts = instruments.filter(i => i.generatedPrompt).length;

      let currentPipelineStep = kit.pipelineStep || "upload";
      if (currentPipelineStep === "prompt" && withAudio > 0 && withPrompts >= withAudio) {
        await storage.updateStyleKit(kitId, { pipelineStep: "train", trainingStatus: "pending" });
        currentPipelineStep = "train";
      }
      if (currentPipelineStep === "analyze" && withAudio > 0 && analyzed >= withAudio) {
        await storage.updateStyleKit(kitId, { pipelineStep: "prompt" });
        currentPipelineStep = "prompt";
      }

      const pipelineSteps = ["upload", "analyze", "prompt", "train", "ready"];
      const currentStepIndex = pipelineSteps.indexOf(currentPipelineStep);

      let isStuck = false;
      if (currentPipelineStep === "train" && kit.trainingStatus === "training") {
        let jobStartTime: number | null = null;
        if (kit.trainingJobId) {
          const jobTimestampMatch = kit.trainingJobId.match(/_(\d+)$/);
          if (jobTimestampMatch) {
            jobStartTime = Number(jobTimestampMatch[1]);
          }
        }
        if (!jobStartTime && kit.createdAt) {
          jobStartTime = new Date(kit.createdAt).getTime();
        }
        if (jobStartTime) {
          const minutesSinceStart = (Date.now() - jobStartTime) / (1000 * 60);
          if (minutesSinceStart > 30) {
            isStuck = true;
          }
        }
      }

      let progress = 0;
      if (currentPipelineStep === "upload") {
        progress = totalInstruments > 0 ? Math.round((withAudio / totalInstruments) * 20) : 0;
      } else if (currentPipelineStep === "analyze") {
        progress = 20 + Math.round((analyzed / Math.max(withAudio, 1)) * 20);
      } else if (currentPipelineStep === "prompt") {
        progress = 40 + Math.round((withPrompts / Math.max(withAudio, 1)) * 20);
      } else if (currentPipelineStep === "train") {
        if (kit.trainingStatus === "training") progress = 70;
        else if (kit.trainingStatus === "queued") progress = 62;
        else progress = 60;
      } else if (currentPipelineStep === "ready") {
        progress = 100;
      }

      let stepLabel = "";
      switch (currentPipelineStep) {
        case "upload": stepLabel = "Subiendo instrumentos"; break;
        case "analyze": stepLabel = "Analizando audio"; break;
        case "prompt": stepLabel = "Generando prompts IA"; break;
        case "train":
          if (isStuck) stepLabel = "Entrenamiento detenido - Reintentar";
          else stepLabel = kit.trainingStatus === "training" ? "Entrenando modelo..." : "En cola de entrenamiento";
          break;
        case "ready": stepLabel = "Modelo listo"; break;
        default: stepLabel = currentPipelineStep || "Pendiente";
      }

      res.json({
        kitId,
        pipelineStep: currentPipelineStep,
        trainingStatus: kit.trainingStatus || "pending",
        trainingError: kit.trainingError,
        trainedModelUrl: kit.trainedModelUrl,
        trainingJobId: kit.trainingJobId,
        lastTrainedAt: kit.lastTrainedAt,
        progress,
        stepLabel,
        isStuck,
        instruments: {
          total: totalInstruments,
          withAudio,
          analyzed,
          withPrompts,
        },
        gpuConnected: isRunPodConfigured() || isServerlessAvailable("training"),
        serverless: isServerlessAvailable("training"),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/serverless/health", async (_req, res) => {
    try {
      const { checkHealth, isServerlessConfigured } = await import("./core/runpod_serverless");
      const results: Record<string, any> = {};
      for (const type of ["music", "training", "stems"] as const) {
        if (isServerlessConfigured(type)) {
          results[type] = await checkHealth(type);
        } else {
          results[type] = { connected: false, error: "Not configured" };
        }
      }
      res.json({ serverless: true, endpoints: results });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/serverless/test", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const dbUser = await storage.getUserByReplitId(req.user.id);
    if (!dbUser || !["super_admin", "admin"].includes(dbUser.role || "")) {
      return res.status(403).json({ message: "Admin only" });
    }
    try {
      const { submitJob, isServerlessConfigured, getWebhookUrl } = await import("./core/runpod_serverless");
      const endpointType = (req.body.type || "music") as "music" | "training" | "stems";
      if (!isServerlessConfigured(endpointType)) {
        return res.status(400).json({ message: `Serverless endpoint not configured for: ${endpointType}` });
      }
      const result = await submitJob(endpointType, {
        action: "health_check",
        test: true,
        timestamp: Date.now(),
      });
      res.json({ success: true, job: result });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/serverless/configure", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const dbUser = await storage.getUserByReplitId(req.user.id);
    if (!dbUser || !["super_admin", "admin"].includes(dbUser.role || "")) {
      return res.status(403).json({ message: "Admin only" });
    }
    const { endpointType, endpointId } = req.body;
    if (!endpointType || !endpointId) {
      return res.status(400).json({ message: "endpointType and endpointId required" });
    }
    const envKey = `RUNPOD_ENDPOINT_${(endpointType as string).toUpperCase()}`;
    process.env[envKey] = endpointId;
    res.json({ success: true, message: `${envKey} set to ${endpointId}` });
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

  // ========== BLOG: PUBLIC ROUTES ==========

  app.get("/api/blog/posts", async (_req, res) => {
    try {
      const posts = await storage.getBlogPosts("published");
      const categories = await storage.getBlogCategories();
      const catMap = new Map(categories.map(c => [c.id, c]));
      const enriched = posts.map(p => ({
        ...p,
        category: p.categoryId ? catMap.get(p.categoryId) : null,
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/blog/posts/:slug", async (req, res) => {
    try {
      const post = await storage.getBlogPostBySlug(req.params.slug);
      if (!post || post.status !== "published") return res.status(404).json({ message: "Post not found" });
      const category = post.categoryId ? await storage.getBlogCategory(post.categoryId) : null;
      await storage.updateBlogPost(post.id, { viewCount: (post.viewCount || 0) + 1 });
      res.json({ ...post, category });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/blog/categories", async (_req, res) => {
    try {
      const categories = await storage.getBlogCategories();
      res.json(categories.filter(c => c.isActive));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== BLOG: ADMIN ROUTES ==========

  app.get("/api/admin/blog/posts", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      const posts = await storage.getBlogPosts();
      res.json(posts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/blog/posts/:id", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      const post = await storage.getBlogPost(parseInt(req.params.id));
      if (!post) return res.status(404).json({ message: "Post not found" });
      res.json(post);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/blog/posts", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || user?.id;
      const userName = user?.claims?.first_name || user?.username || user?.firstName || "Admin";
      const { title, content, excerpt, featuredImageUrl, categoryId, status, tags, seoTitle, seoDescription } = req.body;
      const slug = (req.body.slug || title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `post-${Date.now()}`;
      const post = await storage.createBlogPost({
        title: title || "Untitled",
        slug,
        content: content || "",
        excerpt,
        featuredImageUrl,
        categoryId: categoryId ? parseInt(categoryId) : null,
        authorId: userId,
        authorName: userName,
        status: status || "draft",
        tags,
        seoTitle,
        seoDescription,
        publishedAt: status === "published" ? new Date() : null,
      });
      res.json(post);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/blog/posts/:id", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      const data: any = { ...req.body };
      if (data.categoryId) data.categoryId = parseInt(data.categoryId);
      if (data.status === "published") {
        const existing = await storage.getBlogPost(parseInt(req.params.id));
        if (existing && !existing.publishedAt) data.publishedAt = new Date();
      }
      const post = await storage.updateBlogPost(parseInt(req.params.id), data);
      res.json(post);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/blog/posts/:id", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      await storage.deleteBlogPost(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/blog/categories", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      const categories = await storage.getBlogCategories();
      res.json(categories);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/blog/categories", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { name, description, color, order } = req.body;
      const slug = (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const cat = await storage.createBlogCategory({ name, slug, description, color, order, isActive: true });
      res.json(cat);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/blog/categories/:id", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      const cat = await storage.updateBlogCategory(parseInt(req.params.id), req.body);
      res.json(cat);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/blog/categories/:id", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      await storage.deleteBlogCategory(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== BLOG IMAGE UPLOAD ==========

  const blogImagesDir = path.join(process.cwd(), "public", "blog", "images");
  if (!fs.existsSync(blogImagesDir)) fs.mkdirSync(blogImagesDir, { recursive: true });

  const blogImageUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, blogImagesDir),
      filename: (_req, _file, cb) => {
        const ext = path.extname(_file.originalname) || ".png";
        cb(null, `${uuidv4()}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, allowed.includes(ext));
    },
  });

  app.post("/api/admin/blog/upload-image", blogImageUpload.single("image"), async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      if (!req.file) return res.status(400).json({ message: "No image file uploaded" });
      const url = `/blog/images/${req.file.filename}`;
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== BLOG INTERACTION ROUTES ==========

  app.get("/api/blog/posts/:postId/comments", async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      const comments = await storage.getPostComments(postId);
      res.json(comments);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/blog/posts/:postId/comments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const postId = parseInt(req.params.postId);
      const { content, authorName } = req.body;
      if (!content) return res.status(400).json({ message: "Content is required" });
      const comment = await storage.createComment({
        postId,
        userId,
        authorName: authorName || "Anonymous",
        content,
      });
      res.json(comment);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/blog/comments/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const id = parseInt(req.params.id);
      const { db } = await import("./db");
      const { blogComments } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [comment] = await db.select().from(blogComments).where(eq(blogComments.id, id));
      if (!comment) return res.status(404).json({ message: "Comment not found" });
      if (comment.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteComment(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/blog/posts/:postId/like", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const postId = parseInt(req.params.postId);
      const result = await storage.toggleLike(postId, userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/blog/posts/:postId/like", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const postId = parseInt(req.params.postId);
      const liked = await storage.isPostLikedByUser(postId, userId);
      res.json({ liked });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/blog/posts/:postId/star", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const postId = parseInt(req.params.postId);
      const { rating } = req.body;
      if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be between 1 and 5" });
      const star = await storage.setStarRating(postId, userId, rating);
      res.json(star);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/blog/posts/:postId/stars", async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      const stars = await storage.getPostStars(postId);
      res.json(stars);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/blog/posts/:postId/share", async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      const { platform } = req.body;
      const userId = req.isAuthenticated() ? (req.user as any).claims.sub : null;
      const share = await storage.recordShare({
        postId,
        userId,
        platform: platform || "link",
      });
      res.json(share);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/blog/posts/:postId/stats", async (req, res) => {
    try {
      const postId = parseInt(req.params.postId);
      const [likes, stars, shares, comments] = await Promise.all([
        storage.getPostLikes(postId),
        storage.getPostStars(postId),
        storage.getPostShares(postId),
        storage.getPostComments(postId),
      ]);
      res.json({
        likesCount: likes.length,
        starsAverage: stars.average,
        starsCount: stars.count,
        sharesCount: shares,
        commentsCount: comments.length,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== COVER DESIGNS ==========

  app.get("/api/cover-designs", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const designs = await storage.getCoverDesigns(userId);
      res.json(designs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/cover-designs/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const design = await storage.getCoverDesign(parseInt(req.params.id));
      if (!design) return res.status(404).json({ message: "Design not found" });
      res.json(design);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/cover-designs", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const design = await storage.createCoverDesign({ ...req.body, userId });
      res.json(design);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/cover-designs/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const design = await storage.updateCoverDesign(parseInt(req.params.id), req.body);
      res.json(design);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/cover-designs/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      await storage.deleteCoverDesign(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/cover-designs/upload-background", blogImageUpload.single("image"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const coverDir = path.join(process.cwd(), "public", "audio", "covers");
      if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true });
      const ext = path.extname(req.file.originalname) || ".png";
      const filename = `bg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
      fs.copyFileSync(req.file.path, path.join(coverDir, filename));
      const url = `/audio/covers/${filename}`;
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/cover-designs/remove-background", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { imageData } = req.body;
      if (!imageData) return res.status(400).json({ message: "No image data" });

      const base64Input = imageData.replace(/^data:image\/\w+;base64,/, "");
      const inputBuffer = Buffer.from(base64Input, "base64");

      const coverDir = path.join(process.cwd(), "public", "audio", "covers");
      if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true });
      const inputFilename = `rmbg_input_${Date.now()}.png`;
      const inputPath = path.join(coverDir, inputFilename);
      fs.writeFileSync(inputPath, inputBuffer);

      const Replicate = (await import("replicate")).default;
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

      const dataUri = `data:image/png;base64,${base64Input}`;
      const output = await replicate.run(
        "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
        { input: { image: dataUri } }
      );

      let outputUrl: string;
      if (typeof output === "string") {
        outputUrl = output;
      } else if (output && typeof (output as any).url === "function") {
        outputUrl = (output as any).url();
      } else {
        outputUrl = String(output);
      }

      const response = await fetch(outputUrl);
      const outputBuffer = Buffer.from(await response.arrayBuffer());
      const outputFilename = `rmbg_${Date.now()}.png`;
      fs.writeFileSync(path.join(coverDir, outputFilename), outputBuffer);
      const url = `/audio/covers/${outputFilename}`;

      try { fs.unlinkSync(inputPath); } catch {}

      res.json({ url });
    } catch (err: any) {
      console.error("[BG Removal] Error:", err.message);
      res.status(500).json({ message: "Failed to remove background: " + err.message });
    }
  });

  app.post("/api/cover-designs/save-render", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { imageData, designId } = req.body;
      if (!imageData) return res.status(400).json({ message: "No image data" });
      const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const dir = path.join(process.cwd(), "public", "audio", "covers");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filename = `cover_design_${designId || Date.now()}_${Date.now()}.png`;
      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, buffer);
      const url = `/audio/covers/${filename}`;
      if (designId) {
        await storage.updateCoverDesign(parseInt(designId), { renderedImageUrl: url, thumbnailUrl: url });
      }
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/cover-designs/:id/apply-to-song", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const designId = parseInt(req.params.id);
      const { songId } = req.body;
      if (!songId) return res.status(400).json({ message: "songId required" });
      const design = await storage.getCoverDesign(designId);
      if (!design || !design.renderedImageUrl) return res.status(400).json({ message: "Design has no rendered image" });
      await storage.updateSongImage(songId, design.renderedImageUrl);
      await storage.updateCoverDesign(designId, { songId });
      res.json({ success: true, imageUrl: design.renderedImageUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/ai/suggest-effects", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { prompt, currentFilters } = req.body;
      if (!prompt) return res.status(400).json({ message: "Prompt required" });
      const openai = (await import("./replit_integrations/ai/index")).default;
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional album cover art designer. Given a user's description of desired effects, return a JSON object with these CSS filter values and overlay effects:
            {
              "brightness": number (50-150, default 100),
              "contrast": number (50-150, default 100),
              "saturation": number (0-200, default 100),
              "blur": number (0-5, default 0),
              "sepia": number (0-100, default 0),
              "grayscale": number (0-100, default 0),
              "hueRotate": number (-180 to 180, default 0),
              "glamour": boolean (add golden glow overlay),
              "vignette": boolean (dark edges),
              "grain": boolean (film grain texture),
              "neonGlow": boolean (neon edge glow),
              "duotone": string|null (color like "#FF00FF" for duotone effect),
              "suggestion": string (brief description of what these settings achieve)
            }
            Only return the JSON, no markdown.`
          },
          { role: "user", content: `Current filters: ${JSON.stringify(currentFilters || {})}. User wants: ${prompt}` }
        ],
        max_tokens: 300,
      });
      const text = response.choices[0]?.message?.content || "{}";
      let parsed;
      try { parsed = JSON.parse(text.replace(/```json?\n?/g, "").replace(/```/g, "").trim()); } catch { parsed = {}; }
      res.json(parsed);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== PRICING PLANS: PUBLIC & ADMIN ROUTES ==========

  app.get("/api/pricing/plans", async (_req, res) => {
    try {
      const plans = await storage.getPricingPlans(true);
      res.json(plans);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/pricing/plans", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      const plans = await storage.getPricingPlans();
      res.json(plans);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/pricing/plans", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      const plan = await storage.createPricingPlan(req.body);
      res.json(plan);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/pricing/plans/:id", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      const plan = await storage.updatePricingPlan(parseInt(req.params.id), req.body);
      res.json(plan);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/pricing/plans/:id", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      await storage.deletePricingPlan(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/stripe/transactions", async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
    try {
      const stripe = await getUncachableStripeClient();
      const charges = await stripe.charges.list({ limit: 50 });
      const transactions = charges.data.map(c => ({
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        status: c.status,
        description: c.description,
        customerEmail: (c as any).billing_details?.email || (c as any).receipt_email,
        created: c.created,
      }));
      res.json(transactions);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== ADMIN: STRIPE PRODUCT MANAGEMENT ==========

  app.post("/api/admin/stripe/products", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const stripe = await getUncachableStripeClient();
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const product = await stripe.products.create({
        name,
        description: description || undefined,
      });
      res.json({ id: product.id, name: product.name, description: product.description, active: product.active });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/stripe/products/:productId", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const stripe = await getUncachableStripeClient();
      const { name, description, active } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (active !== undefined) updateData.active = active;
      const product = await stripe.products.update(req.params.productId, updateData);
      res.json({ id: product.id, name: product.name, description: product.description, active: product.active });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/stripe/products/:productId", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const stripe = await getUncachableStripeClient();
      await stripe.products.update(req.params.productId, { active: false });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/stripe/prices", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const stripe = await getUncachableStripeClient();
      const { productId, unitAmount, currency, interval } = req.body;
      if (!productId || unitAmount == null) return res.status(400).json({ message: "productId and unitAmount are required" });
      const priceData: any = {
        product: productId,
        unit_amount: Math.round(Number(unitAmount)),
        currency: currency || "usd",
      };
      if (interval) {
        priceData.recurring = { interval };
      }
      const price = await stripe.prices.create(priceData);
      res.json({ id: price.id, unitAmount: price.unit_amount, currency: price.currency, recurring: price.recurring, active: price.active });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/stripe/prices/:priceId", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const stripe = await getUncachableStripeClient();
      const { active } = req.body;
      const price = await stripe.prices.update(req.params.priceId, { active: active !== false });
      res.json({ id: price.id, active: price.active });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/stripe/subscriptions/:subId/cancel", async (req, res) => {
    if (!(await requireRole(req, res, "super_admin"))) return;
    try {
      const stripe = await getUncachableStripeClient();
      const subscription = await stripe.subscriptions.update(req.params.subId, {
        cancel_at_period_end: true,
      });
      res.json({ id: subscription.id, status: subscription.status, cancel_at_period_end: subscription.cancel_at_period_end });
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

      const systemPrompt = `You are the DGB Studio Support Assistant, a helpful, friendly, and knowledgeable AI support agent for the DGB Studio music production platform.

ABOUT THE FOUNDER — DANNY GARCIA (DGB):
Danny Garcia, known artistically as "Danny Garcia Bachata" or simply "DGB", is a Dominican Bachata artist, musician, and technology visionary. He is the founder and creator of DGB Studio. Danny was born and raised in the Dominican Republic, the birthplace of Bachata music. He carries the authentic DNA of Dominican music in his blood — la pura sangre de la Bachata.

Danny created DGB Studio because he believes that the power of music creation should be accessible to everyone, not just those with expensive studios or formal training. His vision is to democratize music production using artificial intelligence while preserving the authentic roots and soul of Dominican and Latin music. The platform's slogan reflects this: "La Pura Sangre de la Bachata con el ADN de Danny Garcia y los Grandes Musicos Dominicanos" (The Pure Blood of Bachata with the DNA of Danny Garcia and the Great Dominican Musicians).

IMPORTANT: DGB IS Danny Garcia Bachata. They are the same person. "DGB" is the abbreviation of "Danny Garcia Bachata". Whenever someone mentions DGB, they are referring to Danny Garcia Bachata, the Dominican artist and founder of this platform.

As a Bachata artist, Danny understands the nuances of Latin rhythms — the guira, the bongo, the requinto guitar picking, the segunda rhythm — and has embedded this deep musical knowledge into DGB Studio. His goal is to empower artists, content creators, and music lovers worldwide to create professional-quality Latin music, whether it's Bachata, Bolero, Salsa, Merengue, Cumbia, Vallenato, or any of the 35+ genres supported by the platform.

Danny is also passionate about artist monetization and fair compensation. That's why DGB Studio includes a complete Artist Ecosystem where Pro artists keep 100% of their earnings, and even Basic users get 95% (with only a 5% platform fee). He integrated BMI, ASCAP, SESAC, SOCAN, PRS, GEMA, and SGAE copyright registration support because he believes every artist deserves to protect and profit from their work.

DANNY GARCIA BACHATA — DISCOGRAPHY & MUSIC:
Danny Garcia Bachata is an active recording artist with music available on all major digital platforms. If a user wants to know more about Danny, listen to his music, or explore his discography, recommend them to search "Danny Garcia Bachata" on any of these platforms:
- Spotify: Search "Danny Garcia Bachata" on Spotify to listen to his discography
- Apple Music: Available on Apple Music as "Danny Garcia Bachata"
- Amazon Music: Search "Danny Garcia Bachata" on Amazon Music
- YouTube Music: Find his official music videos and tracks on YouTube Music
- Deezer: Available on Deezer as "Danny Garcia Bachata"
- Tidal: Available on Tidal as "Danny Garcia Bachata"
- Pandora: Available on Pandora as "Danny Garcia Bachata"
- iHeartRadio: Available on iHeartRadio
- Also available on all other major digital music stores and streaming platforms worldwide.
When recommending his music, encourage users to follow him on these platforms to stay updated with his latest releases and full discography. His music reflects the authentic Dominican Bachata sound that inspired the creation of DGB Studio.

WHY DGB STUDIO EXISTS:
- To bring the authentic sound of Dominican Bachata and Latin music to the world through AI
- To make professional music creation accessible to everyone — singers, producers, DJs, content creators, restaurants, churches, and hobbyists
- To preserve and celebrate the rich musical heritage of the Dominican Republic and Latin America
- To empower independent artists with tools for creation, distribution, and monetization
- To prove that technology and tradition can coexist — AI as a tool that amplifies human creativity, not replaces it

PLATFORM FEATURES:
- Music Generation: AI-powered music creation supporting 35+ genres including Bachata, Salsa, Merengue, Cumbia, Bolero, Vallenato, Son, Mambo, Cha-Cha-Cha, Guaracha, Dembow, Reggaeton, and many more.
- Style Kits & Producer Store: Users can upload instrument samples to create custom sound models. Browse and use Style Kits from other producers.
- Multitrack Studio: AI stem separation splits songs into Vocals, Drums, Bass, and Melody tracks with individual controls.
- Studio AI Tools: Professional audio mastering, noise removal, AI cover songs with voice change, and audio trimming.
- Sample Lab: Record audio from browser, upload audio files, AI remix transformation, and Key/BPM detection.
- Lyrics Generator: AI-powered lyrics creation in multiple styles with Latin music influences.
- Discover & Charts: Public music discovery with genre playlists, Top 100 charts, trending songs, and auto-play.
- Artist Ecosystem: Artist profiles, follower system, subscription monetization, earnings dashboard, and copyright registration (BMI/ASCAP/SESAC/SOCAN/PRS/GEMA/SGAE). PRO artists keep 100%, Basic artists get 95/5 split.
- Blog: Community blog with posts, comments, likes, star ratings, and social sharing.
- Available in Spanish (default) and English.
- Library: All generated songs stored with playback, download, and studio access.

SUBSCRIPTION PLANS:
- Free: Basic access to music generation and core features
- Pro: Enhanced features, more generations, priority processing, 100% artist earnings
- Premium: Unlimited access, all features, priority support

USE CASES — "Tu Decides Que Quieres Crear":
- Church & Christian Music: Worship songs, gospel, praise music
- Birthday & Celebrations: Custom songs for special occasions
- Children's Content: Educational and fun music for kids
- Movies & Film: Soundtracks and cinematic scores
- Jingles & Advertising: Commercial music for brands
- YouTube & Content Creation: Background music, intros, outros
- Restaurants & Business: Ambient music for establishments
- Personal Art: Express yourself through music

HOW TO USE:
1. Create Music: Go to "Create" page, enter a prompt describing your song, select genre and style, click generate
2. Edit in Studio: After a song is generated, click "Studio" to separate stems and apply AI tools
3. Sample Lab: Record or upload audio, then transform it with AI remix
4. Generate Lyrics: Go to "Lyrics" page, enter a theme and style
5. Discover Music: Visit "Discover" to explore charts and playlists from other creators
6. Become an Artist: Complete the Artist Onboarding to set up your profile, copyright info, and monetization

COMMON ISSUES:
- Song stuck on "processing": Songs typically take 1-3 minutes. If stuck longer, try generating again.
- Audio not playing: Check browser audio permissions and try refreshing.
- Stem separation failed: Ensure the original song was fully generated first.

CRITICAL PRIVACY RULE — TECHNICAL DETAILS ARE CONFIDENTIAL:
- NEVER reveal technical details about how the platform was built. This includes: model names, engine names, AI frameworks, GPU infrastructure, API providers, database technology, programming languages, libraries, or any internal architecture details.
- If a user asks how the platform was built, what technology is used, what AI models power it, or any technical implementation question, respond that you don't have many technical details, but that ALL ideas and creation are by DGB Studio (Danny Garcia Bachata), built with the technology of Replit.
- Example response to technical questions: "No tengo muchos detalles técnicos sobre la implementación, pero puedo decirte que todas las ideas y la creación de esta plataforma son de DGB Studio (Danny Garcia Bachata), desarrollada con la tecnología de Replit."
- Do NOT mention: HeartMuLa, Stable Audio Open, RunPod, Demucs, OpenAI, GPT, Neon, PostgreSQL, Drizzle, Express, React, Vite, or any other specific technology name.
- This rule applies to ALL technical questions without exception. The internal workings are private intellectual property of DGB Studio.

LEGAL KNOWLEDGE (TERMS OF SERVICE & FAQ):

OWNERSHIP RULE (60/40):
- Users WITH active membership (paid subscription): Have FULL commercial rights over generated content. Music is "Royalty Free" for the user.
- Users WITHOUT membership (Free Plan): DGB STUDIO / ODGMUSIC retains 60% of copyright and related rights on each generated work. The user keeps 40%.
- ALWAYS remind users: "Con una suscripción Pro, el 100% de la creación es tuya."

VOCAL DNA & PRIVACY:
- User voice models are ENCRYPTED and strictly PRIVATE.
- DGB STUDIO will NEVER share, give away, or use a user's vocal DNA for other users without express consent.
- Users can only make their voice public through the "Discover" section voluntarily.
- If asked "¿Es seguro subir mi voz?": Answer "Totalmente. En DGB STUDIO tratamos tu audio como propiedad intelectual privada. Tus voces se procesan en un entorno seguro y nunca se comparten con otros usuarios, a menos que tú decidas publicar en la sección 'Discover'."

EXECUTION DNA (ADN DE EJECUCIÓN):
- DGB STUDIO uses original instruments recorded by Danny Garcia and Dominican masters.
- The system allows third-party model integration BUT is NOT responsible if generated audio infringes a real musician's "execution DNA."
- If an artist publishes a song that generates IP claims, the legal responsibility falls ENTIRELY on the Artist/User.
- If asked about guitar sound claims: "Nuestras librerías son originales. Pero si tú usas modelos externos o el sistema genera un estilo muy similar al de un tercero y decides publicarlo, tú eres legalmente responsable de esa decisión de distribución."

PUBLISHING & DISTRIBUTION (ODGMUSIC):
- Users who choose "Distribute with us" designate ODGMUSIC LATIN WORLDWIDE PUBLISHING (ASCAP-affiliated) as their exclusive worldwide editorial administrator.
- Royalty split: 50% Artist / 50% Publisher on net income from mechanical exploitation, sync, and digital sales.
- NEVER reveal the IPI number or Member ID. If asked, say: "Esos datos se manejan internamente en los contratos de regalías."

DATA PRIVACY:
- Data shared only for: payment processing (Stripe), copyright/publishing registration with ODGMUSIC/ASCAP (if user opts in), and legal requirements.
- Users have rights to: delete data, data portability, and access information stored.
- If asked "¿Qué hacen con mis datos?": Answer "Solo usamos tus datos para que puedas crear música. No vendemos información a terceros. Si decides distribuir con nuestra editora ODGMUSIC, usamos tus datos solo para asegurar que cobres tus regalías correctamente en ASCAP."

PROHIBITED USES:
- No automated bots for mass content generation.
- No defamatory, illegal content or synthetic voices of public figures without authorization.

CONVERSION RULE: Whenever someone asks about rights or ownership, ALWAYS highlight the advantages of membership to unlock 100% ownership of their songs.

CULTURAL IDENTITY: Always mention that this system has the "Pura Sangre" of Dominican Bachata. The instruments carry the real DNA of Danny Garcia and the great Dominican musicians.

IMPORTANT GUIDELINES:
- Always be helpful, concise, warm, and supportive — reflect Danny's passion for music and community.
- Speak professionally but with Dominican flavor and musical knowledge.
- When users ask about the founder, share Danny Garcia's story with pride — he is a real Dominican Bachata artist building this platform.
- If users ask about Bachata or Dominican music, share knowledge enthusiastically — this is the heart of DGB Studio.
- Respond in the same language the user writes in (Spanish or English).
- If you don't know something specific, suggest the user contact support or explore the platform's features.
- Encourage creativity and experimentation with different genres and tools.`;

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

  // ========== COPYRIGHT & PUBLISHING HUB ==========

  app.get("/api/copyright/works", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).claims.sub;
      const works = await storage.getCopyrightWorks(userId);
      const worksWithContributors = await Promise.all(
        works.map(async (work) => {
          const contributors = await storage.getCopyrightContributors(work.id);
          return { ...work, contributors };
        })
      );
      res.json(worksWithContributors);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/copyright/works/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).claims.sub;
      const work = await storage.getCopyrightWork(parseInt(req.params.id));
      if (!work) return res.status(404).json({ message: "Work not found" });
      if (work.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const contributors = await storage.getCopyrightContributors(work.id);
      res.json({ ...work, contributors });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/copyright/works", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).claims.sub;
      const { contributors: contributorData, ...workData } = req.body;
      const work = await storage.createCopyrightWork({
        ...workData,
        userId,
      });
      if (contributorData && Array.isArray(contributorData)) {
        for (const c of contributorData) {
          await storage.createCopyrightContributor({ ...c, workId: work.id });
        }
      }
      const contributors = await storage.getCopyrightContributors(work.id);
      res.json({ ...work, contributors });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/copyright/works/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).claims.sub;
      const work = await storage.getCopyrightWork(parseInt(req.params.id));
      if (!work) return res.status(404).json({ message: "Work not found" });
      if (work.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const { contributors: contributorData, ...workData } = req.body;
      const updated = await storage.updateCopyrightWork(work.id, workData);
      if (contributorData && Array.isArray(contributorData)) {
        await storage.deleteCopyrightContributorsByWork(work.id);
        for (const c of contributorData) {
          await storage.createCopyrightContributor({ ...c, workId: work.id });
        }
      }
      const contributors = await storage.getCopyrightContributors(work.id);
      res.json({ ...updated, contributors });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/copyright/works/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).claims.sub;
      const work = await storage.getCopyrightWork(parseInt(req.params.id));
      if (!work) return res.status(404).json({ message: "Work not found" });
      if (work.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteCopyrightWork(work.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/copyright/works/:id/submit", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).claims.sub;
      const work = await storage.getCopyrightWork(parseInt(req.params.id));
      if (!work) return res.status(404).json({ message: "Work not found" });
      if (work.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const contributors = await storage.getCopyrightContributors(work.id);
      const totalWriterShare = contributors.filter(c => ["writer", "composer", "lyricist", "arranger"].includes(c.role)).reduce((sum, c) => sum + c.share, 0);
      if (Math.abs(totalWriterShare - 100) > 0.01) {
        return res.status(400).json({ message: "Writer shares must total 100%" });
      }
      const exportData = {
        title: work.title,
        alternativeTitles: work.alternativeTitles,
        workType: work.workType,
        language: work.language,
        genre: work.genre,
        copyrightYear: work.copyrightYear,
        duration: work.duration,
        isrc: work.isrc,
        iswc: work.iswc,
        publisher: {
          name: work.publisherName,
          ipi: work.publisherIpi,
          share: work.publisherShare,
        },
        writers: contributors.filter(c => c.role !== "publisher" && c.role !== "admin_publisher").map(c => ({
          name: c.name,
          role: c.role,
          ipiNumber: c.ipiNumber,
          pro: c.proEntity,
          share: c.share,
          publisher: c.publisherName,
        })),
        proEntity: work.proEntity,
        submittedAt: new Date().toISOString(),
      };
      const updated = await storage.updateCopyrightWork(work.id, {
        status: "submitted",
        submittedAt: new Date(),
        exportData,
      });
      res.json({ ...updated, contributors, exportData });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/copyright/works/:id/export", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).claims.sub;
      const work = await storage.getCopyrightWork(parseInt(req.params.id));
      if (!work) return res.status(404).json({ message: "Work not found" });
      if (work.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const contributors = await storage.getCopyrightContributors(work.id);
      const exportData = {
        title: work.title,
        alternativeTitles: work.alternativeTitles,
        workType: work.workType,
        language: work.language,
        genre: work.genre,
        copyrightDate: work.copyrightDate,
        copyrightYear: work.copyrightYear,
        duration: work.duration,
        isrc: work.isrc,
        iswc: work.iswc,
        upc: work.upc,
        hfaSongCode: work.hfaSongCode,
        publisher: {
          name: work.publisherName,
          ipi: work.publisherIpi,
          share: work.publisherShare,
        },
        writers: contributors.map(c => ({
          name: c.name,
          role: c.role,
          ipiNumber: c.ipiNumber,
          pro: c.proEntity,
          share: c.share,
          email: c.email,
          publisher: c.publisherName,
          controlled: c.isControlled,
        })),
        proEntity: work.proEntity,
        status: work.status,
        externalRegistrationId: work.externalRegistrationId,
      };
      res.json(exportData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/copyright/publishers", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    try {
      const publishers = await storage.getPublisherEntities();
      res.json(publishers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/copyright/publishers/default", async (req, res) => {
    try {
      const publisher = await storage.getDefaultPublisher();
      res.json(publisher || { name: "ODGMUSIC LATIN WORLDWIDE PUBLISHING", isDefault: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/copyright/songs", async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).claims.sub;
      const userSongs = await storage.getUserSongs(userId);
      const songsWithRegistrations = await Promise.all(
        userSongs.filter(s => s.status === "completed" && s.audioUrl).map(async (song) => {
          const registrations = await storage.getCopyrightWorksBySong(song.id);
          return { ...song, copyrightRegistered: registrations.length > 0 };
        })
      );
      res.json(songsWithRegistrations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== USER PLAYLISTS ==========

  app.get("/api/playlists", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const playlists = await storage.getUserPlaylists(userId);
    res.json(playlists);
  });

  app.post("/api/playlists", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    try {
      const data = insertUserPlaylistSchema.parse({ ...req.body, userId });
      const playlist = await storage.createPlaylist(data);
      res.status(201).json(playlist);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: (err as any).message });
    }
  });

  app.patch("/api/playlists/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const playlist = await storage.getPlaylist(Number(req.params.id));
    if (!playlist) return res.sendStatus(404);
    if (playlist.userId !== userId) return res.sendStatus(403);
    const { name, description, isPublic, imageUrl } = req.body;
    const updated = await storage.updatePlaylist(playlist.id, { name, description, isPublic, imageUrl });
    res.json(updated);
  });

  app.delete("/api/playlists/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const playlist = await storage.getPlaylist(Number(req.params.id));
    if (!playlist) return res.sendStatus(404);
    if (playlist.userId !== userId) return res.sendStatus(403);
    await storage.deletePlaylist(playlist.id);
    res.sendStatus(204);
  });

  app.get("/api/playlists/:id/songs", async (req, res) => {
    const playlist = await storage.getPlaylist(Number(req.params.id));
    if (!playlist) return res.sendStatus(404);
    if (!playlist.isPublic) {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const userId = (req.user as any).claims.sub;
      if (playlist.userId !== userId) return res.sendStatus(403);
    }
    const songs = await storage.getPlaylistSongs(playlist.id);
    res.json(songs);
  });

  app.post("/api/playlists/:id/songs", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const playlist = await storage.getPlaylist(Number(req.params.id));
    if (!playlist) return res.sendStatus(404);
    if (playlist.userId !== userId) return res.sendStatus(403);
    const { songId, position } = req.body;
    if (!songId) return res.status(400).json({ message: "songId required" });
    const entry = await storage.addSongToPlaylist(playlist.id, Number(songId), position);
    res.status(201).json(entry);
  });

  app.delete("/api/playlists/:id/songs/:songId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const playlist = await storage.getPlaylist(Number(req.params.id));
    if (!playlist) return res.sendStatus(404);
    if (playlist.userId !== userId) return res.sendStatus(403);
    await storage.removeSongFromPlaylist(playlist.id, Number(req.params.songId));
    res.sendStatus(204);
  });

  app.get("/api/public/user-playlists", async (req, res) => {
    try {
      const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 50;
      const playlists = await storage.getPublicPlaylists(limit);
      res.json(playlists);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/public/user-playlists/:id", async (req, res) => {
    try {
      const playlist = await storage.getPlaylist(Number(req.params.id));
      if (!playlist) return res.sendStatus(404);
      if (!playlist.isPublic) return res.sendStatus(404);
      const songs = await storage.getPlaylistSongs(playlist.id);
      res.json({ ...playlist, songs });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.use((err: any, _req: any, res: any, next: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: "El archivo es demasiado grande. El límite es 200MB." });
      }
      return res.status(400).json({ message: `Error de archivo: ${err.message}` });
    }
    if (err && err.message === "Only audio files are allowed") {
      return res.status(400).json({ message: "Solo se permiten archivos de audio (WAV, MP3, FLAC, OGG, M4A, AIFF)." });
    }
    next(err);
  });

  return httpServer;
}
