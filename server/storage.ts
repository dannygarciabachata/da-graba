import { db } from "./db";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { 
  songs, lyrics, quizResults, tracks, samples,
  apiProviders, apiEndpoints,
  type Song, type InsertSong, 
  type Lyric, type InsertLyric,
  type QuizResult, type InsertQuizResult,
  type Track, type InsertTrack,
  type Sample, type InsertSample,
  type ApiProvider, type InsertApiProvider,
  type ApiEndpoint, type InsertApiEndpoint
} from "@shared/schema";
import { users, type User } from "@shared/models/auth";

export { authStorage } from "./replit_integrations/auth/storage";
export { chatStorage } from "./replit_integrations/chat/storage";

export interface IStorage {
  createSong(song: InsertSong): Promise<Song>;
  getSong(id: number): Promise<Song | undefined>;
  getSongByTaskId(taskId: string): Promise<Song | undefined>;
  getUserSongs(userId: string): Promise<Song[]>;
  updateSongStatus(id: number, status: string, audioUrl?: string, error?: string): Promise<Song>;
  updateSongTaskId(id: number, taskId: string): Promise<Song>;
  updateSongImage(id: number, imageUrl: string): Promise<Song>;
  deleteSong(id: number): Promise<void>;

  createTrack(track: InsertTrack): Promise<Track>;
  getTrack(id: number): Promise<Track | undefined>;
  getTracksBySongId(songId: number): Promise<Track[]>;
  getUserTracks(userId: string): Promise<Track[]>;
  updateTrackStatus(id: number, status: string, audioUrl?: string, error?: string): Promise<Track>;
  updateTrackSettings(id: number, settings: { volume?: number; isMuted?: boolean; isSolo?: boolean }): Promise<Track>;
  deleteTracksBySongId(songId: number): Promise<void>;

  createLyric(lyric: InsertLyric): Promise<Lyric>;
  getLyricsBySongId(songId: number): Promise<Lyric[]>;

  saveQuizResult(result: InsertQuizResult): Promise<QuizResult>;
  getUserQuizResults(userId: string): Promise<QuizResult[]>;

  createSample(sample: InsertSample & { audioUrl?: string; status?: string }): Promise<Sample>;
  getSample(id: number): Promise<Sample | undefined>;
  getUserSamples(userId: string): Promise<Sample[]>;
  updateSample(id: number, data: Partial<Sample>): Promise<Sample>;
  deleteSample(id: number): Promise<void>;

  getApiProviders(): Promise<ApiProvider[]>;
  getApiProvider(id: number): Promise<ApiProvider | undefined>;
  createApiProvider(provider: InsertApiProvider): Promise<ApiProvider>;
  updateApiProvider(id: number, data: Partial<ApiProvider>): Promise<ApiProvider>;
  deleteApiProvider(id: number): Promise<void>;

  getApiEndpoints(providerId?: number): Promise<ApiEndpoint[]>;
  getApiEndpoint(id: number): Promise<ApiEndpoint | undefined>;
  getApiEndpointByOperation(operationType: string): Promise<(ApiEndpoint & { provider?: ApiProvider }) | undefined>;
  createApiEndpoint(endpoint: InsertApiEndpoint): Promise<ApiEndpoint>;
  updateApiEndpoint(id: number, data: Partial<ApiEndpoint>): Promise<ApiEndpoint>;
  deleteApiEndpoint(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createSong(insertSong: InsertSong): Promise<Song> {
    const [song] = await db.insert(songs).values(insertSong).returning();
    return song;
  }

  async getSong(id: number): Promise<Song | undefined> {
    const [song] = await db.select().from(songs).where(eq(songs.id, id));
    return song;
  }

  async getUserSongs(userId: string): Promise<Song[]> {
    return await db
      .select()
      .from(songs)
      .where(eq(songs.userId, userId))
      .orderBy(desc(songs.createdAt));
  }

  async getSongByTaskId(taskId: string): Promise<Song | undefined> {
    const [song] = await db.select().from(songs).where(eq(songs.taskId, taskId));
    return song;
  }

  async updateSongStatus(id: number, status: string, audioUrl?: string, error?: string): Promise<Song> {
    const [updated] = await db
      .update(songs)
      .set({ status, audioUrl, error })
      .where(eq(songs.id, id))
      .returning();
    return updated;
  }

  async updateSongTaskId(id: number, taskId: string): Promise<Song> {
    const [updated] = await db
      .update(songs)
      .set({ taskId })
      .where(eq(songs.id, id))
      .returning();
    return updated;
  }

  async updateSongImage(id: number, imageUrl: string): Promise<Song> {
    const [updated] = await db
      .update(songs)
      .set({ imageUrl })
      .where(eq(songs.id, id))
      .returning();
    return updated;
  }

  async toggleSongPublic(id: number): Promise<Song> {
    const song = await this.getSong(id);
    if (!song) throw new Error("Song not found");
    const [updated] = await db
      .update(songs)
      .set({ isPublic: !song.isPublic })
      .where(eq(songs.id, id))
      .returning();
    return updated;
  }

  async deleteSong(id: number): Promise<void> {
    await db.delete(tracks).where(eq(tracks.songId, id));
    await db.delete(songs).where(eq(songs.id, id));
  }

  async createTrack(insertTrack: InsertTrack): Promise<Track> {
    const [track] = await db.insert(tracks).values(insertTrack).returning();
    return track;
  }

  async getTrack(id: number): Promise<Track | undefined> {
    const [track] = await db.select().from(tracks).where(eq(tracks.id, id));
    return track;
  }

  async getTracksBySongId(songId: number): Promise<Track[]> {
    return await db
      .select()
      .from(tracks)
      .where(eq(tracks.songId, songId))
      .orderBy(tracks.type);
  }

  async getUserTracks(userId: string): Promise<Track[]> {
    return await db
      .select()
      .from(tracks)
      .where(eq(tracks.userId, userId))
      .orderBy(desc(tracks.createdAt));
  }

  async updateTrackStatus(id: number, status: string, audioUrl?: string, error?: string): Promise<Track> {
    const [updated] = await db
      .update(tracks)
      .set({ status, audioUrl, error })
      .where(eq(tracks.id, id))
      .returning();
    return updated;
  }

  async updateTrackSettings(id: number, settings: { volume?: number; isMuted?: boolean; isSolo?: boolean }): Promise<Track> {
    const [updated] = await db
      .update(tracks)
      .set(settings)
      .where(eq(tracks.id, id))
      .returning();
    return updated;
  }

  async deleteTracksBySongId(songId: number): Promise<void> {
    await db.delete(tracks).where(eq(tracks.songId, songId));
  }

  async createLyric(insertLyric: InsertLyric): Promise<Lyric> {
    const [lyric] = await db.insert(lyrics).values(insertLyric).returning();
    return lyric;
  }

  async getLyricsBySongId(songId: number): Promise<Lyric[]> {
    return await db
      .select()
      .from(lyrics)
      .where(eq(lyrics.songId, songId))
      .orderBy(desc(lyrics.createdAt));
  }

  async saveQuizResult(result: InsertQuizResult): Promise<QuizResult> {
    const [saved] = await db.insert(quizResults).values(result).returning();
    return saved;
  }

  async getUserQuizResults(userId: string): Promise<QuizResult[]> {
    return await db
      .select()
      .from(quizResults)
      .where(eq(quizResults.userId, userId))
      .orderBy(desc(quizResults.createdAt));
  }

  async createSample(data: InsertSample & { audioUrl?: string; status?: string }): Promise<Sample> {
    const [sample] = await db.insert(samples).values(data).returning();
    return sample;
  }

  async getSample(id: number): Promise<Sample | undefined> {
    const [sample] = await db.select().from(samples).where(eq(samples.id, id));
    return sample;
  }

  async getUserSamples(userId: string): Promise<Sample[]> {
    return await db
      .select()
      .from(samples)
      .where(eq(samples.userId, userId))
      .orderBy(desc(samples.createdAt));
  }

  async updateSample(id: number, data: Partial<Sample>): Promise<Sample> {
    const [updated] = await db
      .update(samples)
      .set(data)
      .where(eq(samples.id, id))
      .returning();
    return updated;
  }

  async deleteSample(id: number): Promise<void> {
    const [sample] = await db.select().from(samples).where(eq(samples.id, id));
    if (sample?.audioUrl && sample.audioUrl.startsWith("/audio/")) {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.default.join(process.cwd(), "public", sample.audioUrl);
      try { fs.default.unlinkSync(filePath); } catch {}
    }
    await db.delete(samples).where(eq(samples.id, id));
  }

  // === API Provider CRUD ===

  async getApiProviders(): Promise<ApiProvider[]> {
    return await db.select().from(apiProviders).orderBy(desc(apiProviders.createdAt));
  }

  async getApiProvider(id: number): Promise<ApiProvider | undefined> {
    const [provider] = await db.select().from(apiProviders).where(eq(apiProviders.id, id));
    return provider;
  }

  async createApiProvider(provider: InsertApiProvider): Promise<ApiProvider> {
    const [created] = await db.insert(apiProviders).values(provider).returning();
    return created;
  }

  async updateApiProvider(id: number, data: Partial<ApiProvider>): Promise<ApiProvider> {
    const [updated] = await db
      .update(apiProviders)
      .set(data)
      .where(eq(apiProviders.id, id))
      .returning();
    return updated;
  }

  async deleteApiProvider(id: number): Promise<void> {
    await db.delete(apiEndpoints).where(eq(apiEndpoints.providerId, id));
    await db.delete(apiProviders).where(eq(apiProviders.id, id));
  }

  // === API Endpoint CRUD ===

  async getApiEndpoints(providerId?: number): Promise<ApiEndpoint[]> {
    if (providerId) {
      return await db.select().from(apiEndpoints)
        .where(eq(apiEndpoints.providerId, providerId))
        .orderBy(apiEndpoints.operationType);
    }
    return await db.select().from(apiEndpoints).orderBy(apiEndpoints.operationType);
  }

  async getApiEndpoint(id: number): Promise<ApiEndpoint | undefined> {
    const [endpoint] = await db.select().from(apiEndpoints).where(eq(apiEndpoints.id, id));
    return endpoint;
  }

  async getApiEndpointByOperation(operationType: string): Promise<(ApiEndpoint & { provider?: ApiProvider }) | undefined> {
    const [result] = await db
      .select()
      .from(apiEndpoints)
      .where(and(
        eq(apiEndpoints.operationType, operationType),
        eq(apiEndpoints.isActive, true)
      ))
      .limit(1);

    if (!result) return undefined;

    const provider = await this.getApiProvider(result.providerId);
    if (!provider || !provider.isActive) return undefined;

    return { ...result, provider };
  }

  async createApiEndpoint(endpoint: InsertApiEndpoint): Promise<ApiEndpoint> {
    const [created] = await db.insert(apiEndpoints).values(endpoint).returning();
    return created;
  }

  async updateApiEndpoint(id: number, data: Partial<ApiEndpoint>): Promise<ApiEndpoint> {
    const [updated] = await db
      .update(apiEndpoints)
      .set(data)
      .where(eq(apiEndpoints.id, id))
      .returning();
    return updated;
  }

  async deleteApiEndpoint(id: number): Promise<void> {
    await db.delete(apiEndpoints).where(eq(apiEndpoints.id, id));
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserStripeInfo(userId: string, data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string | null;
    subscriptionTier?: string;
  }): Promise<User> {
    const [updated] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return updated;
  }

  async getAdminStats(): Promise<{
    totalUsers: number;
    totalSongs: number;
    totalSamples: number;
    totalLyrics: number;
  }> {
    const [userCount] = await db.select({ count: count() }).from(users);
    const [songCount] = await db.select({ count: count() }).from(songs);
    const [sampleCount] = await db.select({ count: count() }).from(samples);
    const [lyricCount] = await db.select({ count: count() }).from(lyrics);
    return {
      totalUsers: userCount.count,
      totalSongs: songCount.count,
      totalSamples: sampleCount.count,
      totalLyrics: lyricCount.count,
    };
  }

  async getStripeProducts() {
    try {
      const result = await db.execute(sql`
        SELECT p.id, p.name, p.description, p.metadata, p.active,
               pr.id as price_id, pr.unit_amount, pr.currency, pr.recurring, pr.active as price_active
        FROM stripe.products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = true
        ORDER BY p.name, pr.unit_amount
      `);
      return result.rows;
    } catch {
      return [];
    }
  }

  async getStripeSubscriptions() {
    try {
      const result = await db.execute(sql`
        SELECT s.id, s.customer, s.status, s.current_period_start, s.current_period_end,
               s.cancel_at_period_end, s.metadata
        FROM stripe.subscriptions s
        ORDER BY s.current_period_start DESC
      `);
      return result.rows;
    } catch {
      return [];
    }
  }
}

export const storage = new DatabaseStorage();
