import { db } from "./db";
import { eq, desc, and, sql, count, gte, gt } from "drizzle-orm";
import { 
  songs, lyrics, quizResults, tracks, samples,
  apiProviders, apiEndpoints,
  styleKits, styleKitInstruments,
  platformSettings, supportTickets, supportMessages,
  cloudServers, voiceModels, voiceSamples, styleReferences,
  blogPosts, blogCategories, pricingPlans,
  type Song, type InsertSong, 
  type Lyric, type InsertLyric,
  type QuizResult, type InsertQuizResult,
  type Track, type InsertTrack,
  type Sample, type InsertSample,
  type ApiProvider, type InsertApiProvider,
  type ApiEndpoint, type InsertApiEndpoint,
  type StyleKit, type InsertStyleKit,
  type StyleKitInstrument, type InsertStyleKitInstrument,
  type PlatformSetting, type InsertPlatformSetting,
  type SupportTicket, type InsertSupportTicket,
  type SupportMessage, type InsertSupportMessage,
  type CloudServer, type InsertCloudServer,
  type VoiceModel, type InsertVoiceModel,
  type VoiceSample, type InsertVoiceSample,
  type StyleReference, type InsertStyleReference,
  type BlogPost, type InsertBlogPost,
  type BlogCategory, type InsertBlogCategory,
  type PricingPlan, type InsertPricingPlan,
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
  getApiEndpointsByOperation(operationType: string): Promise<(ApiEndpoint & { provider?: ApiProvider })[]>;
  createApiEndpoint(endpoint: InsertApiEndpoint): Promise<ApiEndpoint>;
  updateApiEndpoint(id: number, data: Partial<ApiEndpoint>): Promise<ApiEndpoint>;
  deleteApiEndpoint(id: number): Promise<void>;

  getStyleKits(): Promise<StyleKit[]>;
  getStyleKit(id: number): Promise<StyleKit | undefined>;
  getStyleKitsByGenre(genre: string): Promise<StyleKit[]>;
  getStyleKitsByUser(userId: string): Promise<StyleKit[]>;
  createStyleKit(kit: InsertStyleKit): Promise<StyleKit>;
  updateStyleKit(id: number, data: Partial<StyleKit>): Promise<StyleKit>;
  deleteStyleKit(id: number): Promise<void>;

  getStyleKitInstruments(kitId: number): Promise<StyleKitInstrument[]>;
  getStyleKitInstrument(id: number): Promise<StyleKitInstrument | undefined>;
  createStyleKitInstrument(instrument: InsertStyleKitInstrument): Promise<StyleKitInstrument>;
  updateStyleKitInstrument(id: number, data: Partial<StyleKitInstrument>): Promise<StyleKitInstrument>;
  deleteStyleKitInstrument(id: number): Promise<void>;

  getPlatformSettings(category?: string): Promise<PlatformSetting[]>;
  getPlatformSetting(key: string): Promise<PlatformSetting | undefined>;
  upsertPlatformSetting(setting: InsertPlatformSetting): Promise<PlatformSetting>;
  deletePlatformSetting(key: string): Promise<void>;

  getSupportTickets(status?: string): Promise<SupportTicket[]>;
  getSupportTicket(id: number): Promise<SupportTicket | undefined>;
  getUserSupportTickets(userId: string): Promise<SupportTicket[]>;
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  updateSupportTicket(id: number, data: Partial<SupportTicket>): Promise<SupportTicket>;

  getSupportMessages(ticketId: number): Promise<SupportMessage[]>;
  createSupportMessage(message: InsertSupportMessage): Promise<SupportMessage>;

  getAnalytics(): Promise<{
    userGrowth: { date: string; count: number }[];
    songsByGenre: { genre: string; count: number }[];
    songsByStatus: { status: string; count: number }[];
    recentActivity: { date: string; songs: number; samples: number; lyrics: number }[];
    ticketStats: { open: number; inProgress: number; resolved: number; closed: number };
  }>;

  getCloudServers(): Promise<CloudServer[]>;
  getCloudServer(id: number): Promise<CloudServer | undefined>;
  getActiveCloudServer(capability?: string): Promise<CloudServer | undefined>;
  createCloudServer(server: InsertCloudServer): Promise<CloudServer>;
  updateCloudServer(id: number, data: Partial<CloudServer>): Promise<CloudServer>;
  deleteCloudServer(id: number): Promise<void>;

  getVoiceModels(userId?: string): Promise<VoiceModel[]>;
  getVoiceModel(id: number): Promise<VoiceModel | undefined>;
  getUserVoiceModels(userId: string): Promise<VoiceModel[]>;
  getPublicVoiceModels(): Promise<VoiceModel[]>;
  createVoiceModel(model: InsertVoiceModel): Promise<VoiceModel>;
  updateVoiceModel(id: number, data: Partial<VoiceModel>): Promise<VoiceModel>;
  deleteVoiceModel(id: number): Promise<void>;

  getVoiceSamples(voiceModelId: number): Promise<VoiceSample[]>;
  createVoiceSample(sample: InsertVoiceSample): Promise<VoiceSample>;
  updateVoiceSample(id: number, data: Partial<VoiceSample>): Promise<VoiceSample>;
  deleteVoiceSample(id: number): Promise<void>;

  getStyleReferences(userId: string): Promise<StyleReference[]>;
  getStyleReference(id: number): Promise<StyleReference | undefined>;
  createStyleReference(ref: InsertStyleReference): Promise<StyleReference>;
  updateStyleReference(id: number, data: Partial<StyleReference>): Promise<StyleReference>;
  deleteStyleReference(id: number): Promise<void>;

  getUser(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(userId: string, role: string): Promise<User>;
  getUserCredits(userId: string): Promise<number>;
  deductCredit(userId: string): Promise<number>;
  addCredits(userId: string, amount: number): Promise<number>;

  getBlogPosts(status?: string): Promise<BlogPost[]>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: number, data: Partial<BlogPost>): Promise<BlogPost>;
  deleteBlogPost(id: number): Promise<void>;

  getBlogCategories(): Promise<BlogCategory[]>;
  getBlogCategory(id: number): Promise<BlogCategory | undefined>;
  createBlogCategory(cat: InsertBlogCategory): Promise<BlogCategory>;
  updateBlogCategory(id: number, data: Partial<BlogCategory>): Promise<BlogCategory>;
  deleteBlogCategory(id: number): Promise<void>;

  getPricingPlans(activeOnly?: boolean): Promise<PricingPlan[]>;
  getPricingPlan(id: number): Promise<PricingPlan | undefined>;
  createPricingPlan(plan: InsertPricingPlan): Promise<PricingPlan>;
  updatePricingPlan(id: number, data: Partial<PricingPlan>): Promise<PricingPlan>;
  deletePricingPlan(id: number): Promise<void>;
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

  async getApiEndpointsByOperation(operationType: string): Promise<(ApiEndpoint & { provider?: ApiProvider })[]> {
    const results = await db
      .select()
      .from(apiEndpoints)
      .where(and(
        eq(apiEndpoints.operationType, operationType),
        eq(apiEndpoints.isActive, true)
      ));

    const withProviders: (ApiEndpoint & { provider?: ApiProvider })[] = [];
    for (const result of results) {
      const provider = await this.getApiProvider(result.providerId);
      if (provider && provider.isActive) {
        withProviders.push({ ...result, provider });
      }
    }
    withProviders.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    return withProviders;
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

  async updateUserRole(userId: string, role: string): Promise<User> {
    const [updated] = await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return updated;
  }

  async getUserCredits(userId: string): Promise<number> {
    const user = await this.getUser(userId);
    return user?.credits ?? 0;
  }

  async deductCredit(userId: string): Promise<number> {
    const [updated] = await db
      .update(users)
      .set({ credits: sql`credits - 1`, updatedAt: new Date() })
      .where(and(eq(users.id, userId), gt(users.credits, 0)))
      .returning();
    if (!updated) return -1;
    return updated.credits ?? 0;
  }

  async addCredits(userId: string, amount: number): Promise<number> {
    const [updated] = await db
      .update(users)
      .set({ credits: sql`credits + ${amount}`, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated?.credits ?? 0;
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

  // === Style Kit CRUD ===

  async getStyleKits(): Promise<StyleKit[]> {
    return await db.select().from(styleKits).orderBy(styleKits.genre, styleKits.name);
  }

  async getStyleKit(id: number): Promise<StyleKit | undefined> {
    const [kit] = await db.select().from(styleKits).where(eq(styleKits.id, id));
    return kit;
  }

  async getStyleKitsByGenre(genre: string): Promise<StyleKit[]> {
    return await db.select().from(styleKits)
      .where(and(eq(styleKits.genre, genre), eq(styleKits.isActive, true)))
      .orderBy(styleKits.name);
  }

  async getStyleKitsByUser(userId: string): Promise<StyleKit[]> {
    return await db.select().from(styleKits)
      .where(eq(styleKits.createdBy, userId))
      .orderBy(styleKits.createdAt);
  }

  async createStyleKit(kit: InsertStyleKit): Promise<StyleKit> {
    const [created] = await db.insert(styleKits).values(kit).returning();
    return created;
  }

  async updateStyleKit(id: number, data: Partial<StyleKit>): Promise<StyleKit> {
    const [updated] = await db.update(styleKits).set(data).where(eq(styleKits.id, id)).returning();
    return updated;
  }

  async deleteStyleKit(id: number): Promise<void> {
    await db.delete(styleKitInstruments).where(eq(styleKitInstruments.kitId, id));
    await db.delete(styleKits).where(eq(styleKits.id, id));
  }

  async getStyleKitInstruments(kitId: number): Promise<StyleKitInstrument[]> {
    return await db.select().from(styleKitInstruments)
      .where(eq(styleKitInstruments.kitId, kitId))
      .orderBy(styleKitInstruments.position);
  }

  async getStyleKitInstrument(id: number): Promise<StyleKitInstrument | undefined> {
    const [instrument] = await db.select().from(styleKitInstruments).where(eq(styleKitInstruments.id, id));
    return instrument;
  }

  async createStyleKitInstrument(instrument: InsertStyleKitInstrument): Promise<StyleKitInstrument> {
    const [created] = await db.insert(styleKitInstruments).values(instrument).returning();
    return created;
  }

  async updateStyleKitInstrument(id: number, data: Partial<StyleKitInstrument>): Promise<StyleKitInstrument> {
    const [updated] = await db.update(styleKitInstruments).set(data).where(eq(styleKitInstruments.id, id)).returning();
    return updated;
  }

  async deleteStyleKitInstrument(id: number): Promise<void> {
    const [instrument] = await db.select().from(styleKitInstruments).where(eq(styleKitInstruments.id, id));
    if (instrument?.audioUrl && instrument.audioUrl.startsWith("/audio/")) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        fs.default.unlinkSync(path.default.join(process.cwd(), "public", instrument.audioUrl));
      } catch {}
    }
    await db.delete(styleKitInstruments).where(eq(styleKitInstruments.id, id));
  }

  // === Platform Settings ===

  async getPlatformSettings(category?: string): Promise<PlatformSetting[]> {
    if (category) {
      return await db.select().from(platformSettings)
        .where(eq(platformSettings.category, category))
        .orderBy(platformSettings.key);
    }
    return await db.select().from(platformSettings).orderBy(platformSettings.category, platformSettings.key);
  }

  async getPlatformSetting(key: string): Promise<PlatformSetting | undefined> {
    const [setting] = await db.select().from(platformSettings).where(eq(platformSettings.key, key));
    return setting;
  }

  async upsertPlatformSetting(setting: InsertPlatformSetting): Promise<PlatformSetting> {
    const existing = await this.getPlatformSetting(setting.key);
    if (existing) {
      const [updated] = await db.update(platformSettings)
        .set({ value: setting.value, category: setting.category, description: setting.description, updatedAt: new Date() })
        .where(eq(platformSettings.key, setting.key))
        .returning();
      return updated;
    }
    const [created] = await db.insert(platformSettings).values(setting).returning();
    return created;
  }

  async deletePlatformSetting(key: string): Promise<void> {
    await db.delete(platformSettings).where(eq(platformSettings.key, key));
  }

  // === Support Tickets ===

  async getSupportTickets(status?: string): Promise<SupportTicket[]> {
    if (status) {
      return await db.select().from(supportTickets)
        .where(eq(supportTickets.status, status))
        .orderBy(desc(supportTickets.updatedAt));
    }
    return await db.select().from(supportTickets).orderBy(desc(supportTickets.updatedAt));
  }

  async getSupportTicket(id: number): Promise<SupportTicket | undefined> {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return ticket;
  }

  async getUserSupportTickets(userId: string): Promise<SupportTicket[]> {
    return await db.select().from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const [created] = await db.insert(supportTickets).values(ticket).returning();
    return created;
  }

  async updateSupportTicket(id: number, data: Partial<SupportTicket>): Promise<SupportTicket> {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.status === "closed" || data.status === "resolved") {
      updateData.closedAt = new Date();
    }
    const [updated] = await db.update(supportTickets).set(updateData).where(eq(supportTickets.id, id)).returning();
    return updated;
  }

  async getSupportMessages(ticketId: number): Promise<SupportMessage[]> {
    return await db.select().from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(supportMessages.createdAt);
  }

  async createSupportMessage(message: InsertSupportMessage): Promise<SupportMessage> {
    const [created] = await db.insert(supportMessages).values(message).returning();
    await db.update(supportTickets).set({ updatedAt: new Date() }).where(eq(supportTickets.id, message.ticketId));
    return created;
  }

  // === Analytics ===

  async getAnalytics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const userGrowthResult = await db.execute(sql`
      SELECT DATE(created_at) as date, COUNT(*)::int as count
      FROM users
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    const songsByGenreResult = await db.execute(sql`
      SELECT COALESCE(genre, 'unknown') as genre, COUNT(*)::int as count
      FROM songs
      GROUP BY genre
      ORDER BY count DESC
      LIMIT 10
    `);

    const songsByStatusResult = await db.execute(sql`
      SELECT status, COUNT(*)::int as count
      FROM songs
      GROUP BY status
      ORDER BY count DESC
    `);

    const recentActivityResult = await db.execute(sql`
      SELECT d.date,
        COALESCE(s.count, 0)::int as songs,
        COALESCE(sa.count, 0)::int as samples,
        COALESCE(l.count, 0)::int as lyrics
      FROM generate_series(${thirtyDaysAgo}::date, CURRENT_DATE, '1 day') AS d(date)
      LEFT JOIN (SELECT DATE(created_at) as date, COUNT(*) as count FROM songs WHERE created_at >= ${thirtyDaysAgo} GROUP BY DATE(created_at)) s ON s.date = d.date
      LEFT JOIN (SELECT DATE(created_at) as date, COUNT(*) as count FROM samples WHERE created_at >= ${thirtyDaysAgo} GROUP BY DATE(created_at)) sa ON sa.date = d.date
      LEFT JOIN (SELECT DATE(created_at) as date, COUNT(*) as count FROM lyrics WHERE created_at >= ${thirtyDaysAgo} GROUP BY DATE(created_at)) l ON l.date = d.date
      ORDER BY d.date
    `);

    const ticketStatsResult = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')::int as open,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int as in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved')::int as resolved,
        COUNT(*) FILTER (WHERE status = 'closed')::int as closed
      FROM support_tickets
    `);

    const ticketRow = ticketStatsResult.rows[0] || { open: 0, in_progress: 0, resolved: 0, closed: 0 };

    return {
      userGrowth: userGrowthResult.rows.map((r: any) => ({ date: r.date, count: r.count })),
      songsByGenre: songsByGenreResult.rows.map((r: any) => ({ genre: r.genre, count: r.count })),
      songsByStatus: songsByStatusResult.rows.map((r: any) => ({ status: r.status, count: r.count })),
      recentActivity: recentActivityResult.rows.map((r: any) => ({ date: r.date, songs: r.songs, samples: r.samples, lyrics: r.lyrics })),
      ticketStats: {
        open: Number(ticketRow.open) || 0,
        inProgress: Number(ticketRow.in_progress) || 0,
        resolved: Number(ticketRow.resolved) || 0,
        closed: Number(ticketRow.closed) || 0,
      },
    };
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

  async getCloudServers(): Promise<CloudServer[]> {
    return await db.select().from(cloudServers).orderBy(desc(cloudServers.priority));
  }

  async getCloudServer(id: number): Promise<CloudServer | undefined> {
    const [server] = await db.select().from(cloudServers).where(eq(cloudServers.id, id));
    return server;
  }

  async getActiveCloudServer(capability?: string): Promise<CloudServer | undefined> {
    const allServers = await db
      .select()
      .from(cloudServers)
      .where(eq(cloudServers.isActive, true))
      .orderBy(desc(cloudServers.priority));
    if (!capability) return allServers[0];
    return allServers.find(s => s.capabilities?.includes(capability));
  }

  async createCloudServer(server: InsertCloudServer): Promise<CloudServer> {
    const [created] = await db.insert(cloudServers).values(server).returning();
    return created;
  }

  async updateCloudServer(id: number, data: Partial<CloudServer>): Promise<CloudServer> {
    const [updated] = await db.update(cloudServers).set(data).where(eq(cloudServers.id, id)).returning();
    return updated;
  }

  async deleteCloudServer(id: number): Promise<void> {
    await db.delete(cloudServers).where(eq(cloudServers.id, id));
  }

  async getVoiceModels(userId?: string): Promise<VoiceModel[]> {
    if (userId) {
      return await db.select().from(voiceModels)
        .where(eq(voiceModels.userId, userId))
        .orderBy(desc(voiceModels.createdAt));
    }
    return await db.select().from(voiceModels).orderBy(desc(voiceModels.createdAt));
  }

  async getVoiceModel(id: number): Promise<VoiceModel | undefined> {
    const [model] = await db.select().from(voiceModels).where(eq(voiceModels.id, id));
    return model;
  }

  async getUserVoiceModels(userId: string): Promise<VoiceModel[]> {
    return await db.select().from(voiceModels)
      .where(eq(voiceModels.userId, userId))
      .orderBy(desc(voiceModels.createdAt));
  }

  async getPublicVoiceModels(): Promise<VoiceModel[]> {
    return await db.select().from(voiceModels)
      .where(and(eq(voiceModels.isPublic, true), eq(voiceModels.isActive, true)))
      .orderBy(desc(voiceModels.createdAt));
  }

  async createVoiceModel(model: InsertVoiceModel): Promise<VoiceModel> {
    const [created] = await db.insert(voiceModels).values(model).returning();
    return created;
  }

  async updateVoiceModel(id: number, data: Partial<VoiceModel>): Promise<VoiceModel> {
    const [updated] = await db.update(voiceModels).set(data).where(eq(voiceModels.id, id)).returning();
    return updated;
  }

  async deleteVoiceModel(id: number): Promise<void> {
    await db.delete(voiceModels).where(eq(voiceModels.id, id));
  }

  async getVoiceSamples(voiceModelId: number): Promise<VoiceSample[]> {
    return await db.select().from(voiceSamples)
      .where(eq(voiceSamples.voiceModelId, voiceModelId))
      .orderBy(desc(voiceSamples.createdAt));
  }

  async createVoiceSample(sample: InsertVoiceSample): Promise<VoiceSample> {
    const [created] = await db.insert(voiceSamples).values(sample).returning();
    return created;
  }

  async updateVoiceSample(id: number, data: Partial<VoiceSample>): Promise<VoiceSample> {
    const [updated] = await db.update(voiceSamples).set(data).where(eq(voiceSamples.id, id)).returning();
    return updated;
  }

  async deleteVoiceSample(id: number): Promise<void> {
    await db.delete(voiceSamples).where(eq(voiceSamples.id, id));
  }

  async getStyleReferences(userId: string): Promise<StyleReference[]> {
    return await db.select().from(styleReferences)
      .where(eq(styleReferences.userId, userId))
      .orderBy(desc(styleReferences.createdAt));
  }

  async getStyleReference(id: number): Promise<StyleReference | undefined> {
    const [ref] = await db.select().from(styleReferences).where(eq(styleReferences.id, id));
    return ref;
  }

  async createStyleReference(ref: InsertStyleReference): Promise<StyleReference> {
    const [created] = await db.insert(styleReferences).values(ref).returning();
    return created;
  }

  async updateStyleReference(id: number, data: Partial<StyleReference>): Promise<StyleReference> {
    const [updated] = await db.update(styleReferences).set(data).where(eq(styleReferences.id, id)).returning();
    return updated;
  }

  async deleteStyleReference(id: number): Promise<void> {
    await db.delete(styleReferences).where(eq(styleReferences.id, id));
  }

  async getBlogPosts(status?: string): Promise<BlogPost[]> {
    if (status) {
      return await db.select().from(blogPosts).where(eq(blogPosts.status, status)).orderBy(desc(blogPosts.publishedAt));
    }
    return await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post;
  }

  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [created] = await db.insert(blogPosts).values(post).returning();
    return created;
  }

  async updateBlogPost(id: number, data: Partial<BlogPost>): Promise<BlogPost> {
    const [updated] = await db.update(blogPosts).set({ ...data, updatedAt: new Date() }).where(eq(blogPosts.id, id)).returning();
    return updated;
  }

  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  async getBlogCategories(): Promise<BlogCategory[]> {
    return await db.select().from(blogCategories).orderBy(blogCategories.order);
  }

  async getBlogCategory(id: number): Promise<BlogCategory | undefined> {
    const [cat] = await db.select().from(blogCategories).where(eq(blogCategories.id, id));
    return cat;
  }

  async createBlogCategory(cat: InsertBlogCategory): Promise<BlogCategory> {
    const [created] = await db.insert(blogCategories).values(cat).returning();
    return created;
  }

  async updateBlogCategory(id: number, data: Partial<BlogCategory>): Promise<BlogCategory> {
    const [updated] = await db.update(blogCategories).set(data).where(eq(blogCategories.id, id)).returning();
    return updated;
  }

  async deleteBlogCategory(id: number): Promise<void> {
    await db.delete(blogCategories).where(eq(blogCategories.id, id));
  }

  async getPricingPlans(activeOnly?: boolean): Promise<PricingPlan[]> {
    if (activeOnly) {
      return await db.select().from(pricingPlans).where(eq(pricingPlans.isActive, true)).orderBy(pricingPlans.order);
    }
    return await db.select().from(pricingPlans).orderBy(pricingPlans.order);
  }

  async getPricingPlan(id: number): Promise<PricingPlan | undefined> {
    const [plan] = await db.select().from(pricingPlans).where(eq(pricingPlans.id, id));
    return plan;
  }

  async createPricingPlan(plan: InsertPricingPlan): Promise<PricingPlan> {
    const [created] = await db.insert(pricingPlans).values(plan).returning();
    return created;
  }

  async updatePricingPlan(id: number, data: Partial<PricingPlan>): Promise<PricingPlan> {
    const [updated] = await db.update(pricingPlans).set({ ...data, updatedAt: new Date() }).where(eq(pricingPlans.id, id)).returning();
    return updated;
  }

  async deletePricingPlan(id: number): Promise<void> {
    await db.delete(pricingPlans).where(eq(pricingPlans.id, id));
  }
}

export const storage = new DatabaseStorage();
