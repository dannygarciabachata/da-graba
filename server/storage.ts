import { db } from "./db";
import { eq, desc, and, sql, count, gte, gt, inArray, sum } from "drizzle-orm";
import { 
  songs, lyrics, quizResults, tracks, samples,
  apiProviders, apiEndpoints,
  styleKits, styleKitInstruments, genreStyles,
  platformSettings, supportTickets, supportMessages,
  cloudServers, voiceModels, voiceSamples, styleReferences,
  blogPosts, blogCategories, blogComments, blogLikes, blogStars, blogShares, pricingPlans, coverDesigns, songLikes,
  artistProfiles, artistSubscriptions, songEarnings, proRegistrations, artistFollowers,
  discographyAlbums, discographyTracks,
  artistGifts, artistWallets, walletTransactions, payoutRequests,
  artistProfileLikes, artistProfileComments, artistProfileShares,
  copyrightWorks, copyrightContributors, publisherEntities,
  userPlaylists, userPlaylistSongs,
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
  type BlogComment, type InsertBlogComment,
  type BlogLike, type InsertBlogLike,
  type BlogStar, type InsertBlogStar,
  type BlogShare, type InsertBlogShare,
  type PricingPlan, type InsertPricingPlan,
  type CoverDesign, type InsertCoverDesign,
  type SongLike, type InsertSongLike,
  type ArtistProfile, type InsertArtistProfile,
  type ArtistSubscription, type InsertArtistSubscription,
  type SongEarning, type InsertSongEarning,
  type ProRegistration, type InsertProRegistration,
  type ArtistFollower, type InsertArtistFollower,
  type DiscographyAlbum, type InsertDiscographyAlbum,
  type DiscographyTrack, type InsertDiscographyTrack,
  type ArtistGift, type InsertArtistGift,
  type ArtistWallet, type InsertArtistWallet,
  type WalletTransaction, type InsertWalletTransaction,
  type PayoutRequest, type InsertPayoutRequest,
  type ArtistProfileLike, type InsertArtistProfileLike,
  type ArtistProfileComment, type InsertArtistProfileComment,
  type ArtistProfileShare, type InsertArtistProfileShare,
  type CopyrightWork, type InsertCopyrightWork,
  type CopyrightContributor, type InsertCopyrightContributor,
  type PublisherEntity, type InsertPublisherEntity,
  type UserPlaylist, type InsertUserPlaylist,
  type UserPlaylistSong, type InsertUserPlaylistSong,
  trainingDatasets, trainingFiles,
  type TrainingDataset, type InsertTrainingDataset,
  type TrainingFile, type InsertTrainingFile,
  type GenreStyle, type InsertGenreStyle,
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
  updateSongKieAudioId(id: number, kieAudioId: string): Promise<Song>;
  updateSongImage(id: number, imageUrl: string): Promise<Song>;
  updateSongMetadata(id: number, data: { artistName?: string; copyrightHolder?: string; lyricsText?: string; title?: string }): Promise<Song>;
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

  getGenreStyles(genre?: string): Promise<GenreStyle[]>;
  getGenreStyle(id: number): Promise<GenreStyle | undefined>;
  createGenreStyle(style: InsertGenreStyle): Promise<GenreStyle>;
  updateGenreStyle(id: number, data: Partial<GenreStyle>): Promise<GenreStyle>;
  deleteGenreStyle(id: number): Promise<void>;

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

  getPostComments(postId: number): Promise<BlogComment[]>;
  createComment(comment: InsertBlogComment): Promise<BlogComment>;
  deleteComment(id: number): Promise<void>;

  getPostLikes(postId: number): Promise<BlogLike[]>;
  toggleLike(postId: number, userId: string): Promise<{ liked: boolean; count: number }>;
  isPostLikedByUser(postId: number, userId: string): Promise<boolean>;

  getPostStars(postId: number): Promise<{ average: number; count: number }>;
  setStarRating(postId: number, userId: string, rating: number): Promise<BlogStar>;

  getPostShares(postId: number): Promise<number>;
  recordShare(share: InsertBlogShare): Promise<BlogShare>;

  getPricingPlans(activeOnly?: boolean): Promise<PricingPlan[]>;
  getPricingPlan(id: number): Promise<PricingPlan | undefined>;
  createPricingPlan(plan: InsertPricingPlan): Promise<PricingPlan>;
  updatePricingPlan(id: number, data: Partial<PricingPlan>): Promise<PricingPlan>;
  deletePricingPlan(id: number): Promise<void>;

  getCoverDesigns(userId: string): Promise<CoverDesign[]>;
  getCoverDesign(id: number): Promise<CoverDesign | undefined>;
  createCoverDesign(design: InsertCoverDesign): Promise<CoverDesign>;
  updateCoverDesign(id: number, data: Partial<CoverDesign>): Promise<CoverDesign>;
  deleteCoverDesign(id: number): Promise<void>;

  getPublicSongs(): Promise<Song[]>;
  getTopSongs(limit: number): Promise<Song[]>;
  getTopSongsByGenre(genre: string, limit: number): Promise<Song[]>;
  getGenrePlaylistSummaries(): Promise<Array<{ genre: string; songCount: number; totalPlays: number; totalLikes: number }>>;
  incrementPlayCount(songId: number): Promise<void>;
  incrementProfileViews(artistId: number): Promise<void>;
  toggleSongLike(songId: number, userId: string, value: number): Promise<{ liked: boolean; value: number; likes: number; dislikes: number }>;
  getSongLikeStatus(songId: number, userId: string): Promise<{ value: number } | null>;
  getSongLikeCounts(songId: number): Promise<{ likes: number; dislikes: number }>;
  getSongLikeCountsBatch(songIds: number[]): Promise<Record<number, number>>;

  getArtistProfile(userId: string): Promise<ArtistProfile | undefined>;
  getArtistProfileById(id: number): Promise<ArtistProfile | undefined>;
  getArtistProfiles(limit?: number): Promise<ArtistProfile[]>;
  createArtistProfile(profile: InsertArtistProfile): Promise<ArtistProfile>;
  updateArtistProfile(id: number, data: Partial<ArtistProfile>): Promise<ArtistProfile>;
  searchArtists(query: string): Promise<ArtistProfile[]>;

  getArtistSubscribers(artistId: number): Promise<ArtistSubscription[]>;
  getSubscriberCount(artistId: number): Promise<number>;
  getUserSubscriptions(userId: string): Promise<ArtistSubscription[]>;
  isSubscribed(subscriberId: string, artistId: number): Promise<boolean>;
  createArtistSubscription(sub: InsertArtistSubscription): Promise<ArtistSubscription>;
  cancelArtistSubscription(id: number): Promise<ArtistSubscription>;

  getArtistFollowers(artistId: number): Promise<ArtistFollower[]>;
  getFollowerCount(artistId: number): Promise<number>;
  isFollowing(followerId: string, artistId: number): Promise<boolean>;
  toggleFollow(followerId: string, artistId: number): Promise<{ following: boolean; count: number }>;

  getSongEarnings(artistId: number): Promise<SongEarning[]>;
  getSongEarningsByPeriod(artistId: number, period: string): Promise<SongEarning[]>;
  createSongEarning(earning: InsertSongEarning): Promise<SongEarning>;
  getArtistTotalEarnings(artistId: number): Promise<{ gross: number; net: number; pending: number }>;

  getProRegistrations(artistId: number): Promise<ProRegistration[]>;
  getProRegistration(id: number): Promise<ProRegistration | undefined>;
  createProRegistration(reg: InsertProRegistration): Promise<ProRegistration>;
  updateProRegistration(id: number, data: Partial<ProRegistration>): Promise<ProRegistration>;

  getArtistSongs(artistId: number): Promise<Song[]>;

  getDiscographyAlbums(artistId: number): Promise<DiscographyAlbum[]>;
  getDiscographyAlbum(id: number): Promise<DiscographyAlbum | undefined>;
  createDiscographyAlbum(album: InsertDiscographyAlbum): Promise<DiscographyAlbum>;
  updateDiscographyAlbum(id: number, data: Partial<DiscographyAlbum>): Promise<DiscographyAlbum>;
  deleteDiscographyAlbum(id: number): Promise<void>;
  getDiscographyTracks(albumId: number): Promise<DiscographyTrack[]>;
  createDiscographyTrack(track: InsertDiscographyTrack): Promise<DiscographyTrack>;
  createDiscographyTracksBulk(tracks: InsertDiscographyTrack[]): Promise<DiscographyTrack[]>;
  deleteDiscographyTrack(id: number): Promise<void>;
  getArtistDiscographyPublic(artistId: number): Promise<Array<DiscographyAlbum & { tracks: DiscographyTrack[] }>>;
  getAllDiscographyPublic(): Promise<Array<DiscographyAlbum & { artist: ArtistProfile; tracks: DiscographyTrack[] }>>;

  getArtistProfileLikes(artistId: number): Promise<ArtistProfileLike[]>;
  getArtistProfileLikeByUser(artistId: number, userId: string): Promise<ArtistProfileLike | undefined>;
  toggleArtistProfileLike(artistId: number, userId: string): Promise<{ liked: boolean; count: number }>;
  getArtistProfileComments(artistId: number): Promise<ArtistProfileComment[]>;
  createArtistProfileComment(data: InsertArtistProfileComment): Promise<ArtistProfileComment>;
  deleteArtistProfileComment(id: number): Promise<void>;
  createArtistProfileShare(data: InsertArtistProfileShare): Promise<ArtistProfileShare>;
  getArtistProfileShareCount(artistId: number): Promise<number>;

  createArtistGift(gift: InsertArtistGift): Promise<ArtistGift>;
  getArtistGift(id: number): Promise<ArtistGift | undefined>;
  getArtistGiftByPaymentIntent(paymentIntentId: string): Promise<ArtistGift | undefined>;
  updateArtistGift(id: number, data: Partial<ArtistGift>): Promise<ArtistGift>;
  getArtistGifts(artistId: number, limit?: number): Promise<ArtistGift[]>;
  getGiftsByFan(fanUserId: string): Promise<ArtistGift[]>;

  getOrCreateArtistWallet(artistId: number): Promise<ArtistWallet>;
  getArtistWallet(artistId: number): Promise<ArtistWallet | undefined>;
  updateArtistWalletBalance(artistId: number, addCents: number, feeCents: number): Promise<ArtistWallet>;

  createWalletTransaction(tx: InsertWalletTransaction): Promise<WalletTransaction>;
  getWalletTransactions(artistId: number, limit?: number): Promise<WalletTransaction[]>;

  createPayoutRequest(req: InsertPayoutRequest): Promise<PayoutRequest>;
  updatePayoutRequest(id: number, data: Partial<PayoutRequest>): Promise<PayoutRequest>;
  getPayoutRequests(artistId: number, limit?: number): Promise<PayoutRequest[]>;
  getPayoutRequest(id: number): Promise<PayoutRequest | undefined>;
  getAllPayoutRequests(limit?: number, statusFilter?: string): Promise<(PayoutRequest & { artistName?: string | null })[]>;
  updateArtistConnectStatus(artistId: number, data: { stripeConnectAccountId?: string; stripeConnectStatus?: string; stripeConnectDetailsSubmitted?: boolean; stripeConnectPayoutsEnabled?: boolean }): Promise<ArtistProfile>;
  deductWalletBalance(artistId: number, amountCents: number): Promise<ArtistWallet>;

  getCopyrightWorks(userId: string): Promise<CopyrightWork[]>;
  getCopyrightWork(id: number): Promise<CopyrightWork | undefined>;
  getCopyrightWorksBySong(songId: number): Promise<CopyrightWork[]>;
  createCopyrightWork(work: InsertCopyrightWork): Promise<CopyrightWork>;
  updateCopyrightWork(id: number, data: Partial<CopyrightWork>): Promise<CopyrightWork>;
  deleteCopyrightWork(id: number): Promise<void>;

  getCopyrightContributors(workId: number): Promise<CopyrightContributor[]>;
  createCopyrightContributor(contributor: InsertCopyrightContributor): Promise<CopyrightContributor>;
  updateCopyrightContributor(id: number, data: Partial<CopyrightContributor>): Promise<CopyrightContributor>;
  deleteCopyrightContributor(id: number): Promise<void>;
  deleteCopyrightContributorsByWork(workId: number): Promise<void>;

  getPublisherEntities(): Promise<PublisherEntity[]>;
  getPublisherEntity(id: number): Promise<PublisherEntity | undefined>;
  getDefaultPublisher(): Promise<PublisherEntity | undefined>;
  createPublisherEntity(publisher: InsertPublisherEntity): Promise<PublisherEntity>;
  updatePublisherEntity(id: number, data: Partial<PublisherEntity>): Promise<PublisherEntity>;

  getUserPlaylists(userId: string): Promise<UserPlaylist[]>;
  getPlaylist(id: number): Promise<UserPlaylist | undefined>;
  createPlaylist(playlist: InsertUserPlaylist): Promise<UserPlaylist>;
  updatePlaylist(id: number, data: Partial<InsertUserPlaylist>): Promise<UserPlaylist | undefined>;
  deletePlaylist(id: number): Promise<void>;
  addSongToPlaylist(playlistId: number, songId: number, position?: number): Promise<UserPlaylistSong>;
  removeSongFromPlaylist(playlistId: number, songId: number): Promise<void>;
  getPlaylistSongs(playlistId: number): Promise<any[]>;
  getPublicPlaylists(limit?: number): Promise<UserPlaylist[]>;

  getTrainingDatasets(): Promise<TrainingDataset[]>;
  getTrainingDataset(id: number): Promise<TrainingDataset | undefined>;
  createTrainingDataset(dataset: InsertTrainingDataset): Promise<TrainingDataset>;
  updateTrainingDataset(id: number, data: Partial<TrainingDataset>): Promise<TrainingDataset>;
  deleteTrainingDataset(id: number): Promise<void>;

  getTrainingFiles(datasetId: number, fileType?: string): Promise<TrainingFile[]>;
  getTrainingFile(id: number): Promise<TrainingFile | undefined>;
  createTrainingFile(file: InsertTrainingFile): Promise<TrainingFile>;
  deleteTrainingFile(id: number): Promise<void>;
  deleteTrainingFilesByDataset(datasetId: number): Promise<void>;
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

  async updateSongKieAudioId(id: number, kieAudioId: string): Promise<Song> {
    const [updated] = await db
      .update(songs)
      .set({ kieAudioId })
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

  async updateSongMetadata(id: number, data: { artistName?: string; copyrightHolder?: string; lyricsText?: string; title?: string }): Promise<Song> {
    const updateData: any = {};
    if (data.artistName !== undefined) updateData.artistName = data.artistName;
    if (data.copyrightHolder !== undefined) updateData.copyrightHolder = data.copyrightHolder;
    if (data.lyricsText !== undefined) updateData.lyricsText = data.lyricsText;
    if (data.title !== undefined) updateData.title = data.title;
    const [updated] = await db
      .update(songs)
      .set(updateData)
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

  // === Genre Styles (Tocadas) ===

  async getGenreStyles(genre?: string): Promise<GenreStyle[]> {
    if (genre) {
      return await db.select().from(genreStyles)
        .where(eq(genreStyles.genre, genre))
        .orderBy(genreStyles.displayOrder, genreStyles.name);
    }
    return await db.select().from(genreStyles).orderBy(genreStyles.genre, genreStyles.displayOrder, genreStyles.name);
  }

  async getGenreStyle(id: number): Promise<GenreStyle | undefined> {
    const [style] = await db.select().from(genreStyles).where(eq(genreStyles.id, id));
    return style;
  }

  async createGenreStyle(style: InsertGenreStyle): Promise<GenreStyle> {
    const [created] = await db.insert(genreStyles).values(style).returning();
    return created;
  }

  async updateGenreStyle(id: number, data: Partial<GenreStyle>): Promise<GenreStyle> {
    const [updated] = await db.update(genreStyles).set(data).where(eq(genreStyles.id, id)).returning();
    return updated;
  }

  async deleteGenreStyle(id: number): Promise<void> {
    await db.delete(genreStyles).where(eq(genreStyles.id, id));
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

  async getPostComments(postId: number): Promise<BlogComment[]> {
    return await db.select().from(blogComments)
      .where(and(eq(blogComments.postId, postId), eq(blogComments.isApproved, true)))
      .orderBy(desc(blogComments.createdAt));
  }

  async createComment(comment: InsertBlogComment): Promise<BlogComment> {
    const [created] = await db.insert(blogComments).values(comment).returning();
    return created;
  }

  async deleteComment(id: number): Promise<void> {
    await db.delete(blogComments).where(eq(blogComments.id, id));
  }

  async getPostLikes(postId: number): Promise<BlogLike[]> {
    return await db.select().from(blogLikes).where(eq(blogLikes.postId, postId));
  }

  async toggleLike(postId: number, userId: string): Promise<{ liked: boolean; count: number }> {
    const [existing] = await db.select().from(blogLikes)
      .where(and(eq(blogLikes.postId, postId), eq(blogLikes.userId, userId)));
    if (existing) {
      await db.delete(blogLikes).where(eq(blogLikes.id, existing.id));
    } else {
      await db.insert(blogLikes).values({ postId, userId });
    }
    const [result] = await db.select({ count: count() }).from(blogLikes).where(eq(blogLikes.postId, postId));
    return { liked: !existing, count: result.count };
  }

  async isPostLikedByUser(postId: number, userId: string): Promise<boolean> {
    const [existing] = await db.select().from(blogLikes)
      .where(and(eq(blogLikes.postId, postId), eq(blogLikes.userId, userId)));
    return !!existing;
  }

  async getPostStars(postId: number): Promise<{ average: number; count: number }> {
    const [result] = await db.select({
      average: sql<number>`coalesce(avg(${blogStars.rating}), 0)`,
      count: count(),
    }).from(blogStars).where(eq(blogStars.postId, postId));
    return { average: Number(result.average) || 0, count: result.count };
  }

  async setStarRating(postId: number, userId: string, rating: number): Promise<BlogStar> {
    const [existing] = await db.select().from(blogStars)
      .where(and(eq(blogStars.postId, postId), eq(blogStars.userId, userId)));
    if (existing) {
      const [updated] = await db.update(blogStars).set({ rating }).where(eq(blogStars.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(blogStars).values({ postId, userId, rating }).returning();
    return created;
  }

  async getPostShares(postId: number): Promise<number> {
    const [result] = await db.select({ count: count() }).from(blogShares).where(eq(blogShares.postId, postId));
    return result.count;
  }

  async recordShare(share: InsertBlogShare): Promise<BlogShare> {
    const [created] = await db.insert(blogShares).values(share).returning();
    return created;
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

  async getCoverDesigns(userId: string): Promise<CoverDesign[]> {
    return await db.select().from(coverDesigns).where(eq(coverDesigns.userId, userId)).orderBy(desc(coverDesigns.updatedAt));
  }

  async getCoverDesign(id: number): Promise<CoverDesign | undefined> {
    const [design] = await db.select().from(coverDesigns).where(eq(coverDesigns.id, id));
    return design;
  }

  async createCoverDesign(design: InsertCoverDesign): Promise<CoverDesign> {
    const [created] = await db.insert(coverDesigns).values(design).returning();
    return created;
  }

  async updateCoverDesign(id: number, data: Partial<CoverDesign>): Promise<CoverDesign> {
    const [updated] = await db.update(coverDesigns).set({ ...data, updatedAt: new Date() }).where(eq(coverDesigns.id, id)).returning();
    return updated;
  }

  async deleteCoverDesign(id: number): Promise<void> {
    await db.delete(coverDesigns).where(eq(coverDesigns.id, id));
  }

  async getPublicSongs(): Promise<Song[]> {
    return await db.select().from(songs)
      .where(and(eq(songs.isPublic, true), eq(songs.status, "completed")))
      .orderBy(desc(songs.createdAt));
  }

  async toggleSongLike(songId: number, userId: string, value: number): Promise<{ liked: boolean; value: number; likes: number; dislikes: number }> {
    const [existing] = await db.select().from(songLikes)
      .where(and(eq(songLikes.songId, songId), eq(songLikes.userId, userId)));

    if (existing) {
      if (existing.value === value) {
        await db.delete(songLikes).where(eq(songLikes.id, existing.id));
        const counts = await this.getSongLikeCounts(songId);
        return { liked: false, value: 0, ...counts };
      } else {
        await db.update(songLikes).set({ value }).where(eq(songLikes.id, existing.id));
        const counts = await this.getSongLikeCounts(songId);
        return { liked: true, value, ...counts };
      }
    } else {
      await db.insert(songLikes).values({ songId, userId, value });
      const counts = await this.getSongLikeCounts(songId);
      return { liked: true, value, ...counts };
    }
  }

  async getSongLikeStatus(songId: number, userId: string): Promise<{ value: number } | null> {
    const [existing] = await db.select().from(songLikes)
      .where(and(eq(songLikes.songId, songId), eq(songLikes.userId, userId)));
    return existing ? { value: existing.value } : null;
  }

  async getSongLikeCounts(songId: number): Promise<{ likes: number; dislikes: number }> {
    const [likesResult] = await db.select({ count: count() }).from(songLikes)
      .where(and(eq(songLikes.songId, songId), eq(songLikes.value, 1)));
    const [dislikesResult] = await db.select({ count: count() }).from(songLikes)
      .where(and(eq(songLikes.songId, songId), eq(songLikes.value, -1)));
    return { likes: likesResult?.count || 0, dislikes: dislikesResult?.count || 0 };
  }

  async getTopSongs(limit: number): Promise<Song[]> {
    return await db.select().from(songs)
      .where(and(eq(songs.isPublic, true), eq(songs.status, "completed")))
      .orderBy(desc(songs.playCount))
      .limit(limit);
  }

  async getTopSongsByGenre(genre: string, limit: number): Promise<Song[]> {
    return await db.select().from(songs)
      .where(and(eq(songs.isPublic, true), eq(songs.status, "completed"), eq(songs.genre, genre)))
      .orderBy(desc(songs.playCount))
      .limit(limit);
  }

  async getGenrePlaylistSummaries(): Promise<Array<{ genre: string; songCount: number; totalPlays: number; totalLikes: number }>> {
    const results = await db.select({
      genre: songs.genre,
      songCount: count(),
      totalPlays: sum(songs.playCount),
    }).from(songs)
      .where(and(eq(songs.isPublic, true), eq(songs.status, "completed")))
      .groupBy(songs.genre);

    const summaries: Array<{ genre: string; songCount: number; totalPlays: number; totalLikes: number }> = [];
    for (const r of results) {
      if (!r.genre) continue;
      const genreSongs = await db.select({ id: songs.id }).from(songs)
        .where(and(eq(songs.isPublic, true), eq(songs.status, "completed"), eq(songs.genre, r.genre)));
      const songIds = genreSongs.map(s => s.id);
      let totalLikes = 0;
      if (songIds.length > 0) {
        const [likeResult] = await db.select({ count: count() }).from(songLikes)
          .where(and(inArray(songLikes.songId, songIds), eq(songLikes.value, 1)));
        totalLikes = likeResult?.count || 0;
      }
      summaries.push({
        genre: r.genre,
        songCount: r.songCount,
        totalPlays: Number(r.totalPlays) || 0,
        totalLikes,
      });
    }
    return summaries.sort((a, b) => b.totalPlays - a.totalPlays);
  }

  async incrementPlayCount(songId: number): Promise<void> {
    await db.update(songs).set({ playCount: sql`${songs.playCount} + 1` }).where(eq(songs.id, songId));
  }

  async incrementProfileViews(artistId: number): Promise<void> {
    await db.update(artistProfiles).set({ profileViews: sql`COALESCE(${artistProfiles.profileViews}, 0) + 1` }).where(eq(artistProfiles.id, artistId));
  }

  async getSongLikeCountsBatch(songIds: number[]): Promise<Record<number, number>> {
    if (songIds.length === 0) return {};
    const results = await db.select({
      songId: songLikes.songId,
      count: count(),
    }).from(songLikes)
      .where(and(inArray(songLikes.songId, songIds), eq(songLikes.value, 1)))
      .groupBy(songLikes.songId);
    const map: Record<number, number> = {};
    for (const r of results) map[r.songId] = r.count;
    return map;
  }

  // === ARTIST PROFILES ===

  async getArtistProfile(userId: string): Promise<ArtistProfile | undefined> {
    const [profile] = await db.select().from(artistProfiles).where(eq(artistProfiles.userId, userId));
    return profile;
  }

  async getArtistProfileById(id: number): Promise<ArtistProfile | undefined> {
    const [profile] = await db.select().from(artistProfiles).where(eq(artistProfiles.id, id));
    return profile;
  }

  async getArtistProfiles(limit = 50): Promise<ArtistProfile[]> {
    return db.select().from(artistProfiles)
      .where(eq(artistProfiles.isActive, true))
      .orderBy(desc(artistProfiles.totalSubscribers))
      .limit(limit);
  }

  async createArtistProfile(profile: InsertArtistProfile): Promise<ArtistProfile> {
    const [created] = await db.insert(artistProfiles).values(profile).returning();
    return created;
  }

  async updateArtistProfile(id: number, data: Partial<ArtistProfile>): Promise<ArtistProfile> {
    const [updated] = await db.update(artistProfiles).set({ ...data, updatedAt: new Date() }).where(eq(artistProfiles.id, id)).returning();
    return updated;
  }

  async searchArtists(query: string): Promise<ArtistProfile[]> {
    return db.select().from(artistProfiles)
      .where(and(
        eq(artistProfiles.isActive, true),
        sql`LOWER(${artistProfiles.artistName}) LIKE LOWER(${'%' + query + '%'})`
      ))
      .orderBy(desc(artistProfiles.totalSubscribers))
      .limit(20);
  }

  // === ARTIST SUBSCRIPTIONS ===

  async getArtistSubscribers(artistId: number): Promise<ArtistSubscription[]> {
    return db.select().from(artistSubscriptions)
      .where(and(eq(artistSubscriptions.artistId, artistId), eq(artistSubscriptions.status, "active")))
      .orderBy(desc(artistSubscriptions.createdAt));
  }

  async getSubscriberCount(artistId: number): Promise<number> {
    const [result] = await db.select({ count: count() }).from(artistSubscriptions)
      .where(and(eq(artistSubscriptions.artistId, artistId), eq(artistSubscriptions.status, "active")));
    return result?.count || 0;
  }

  async getUserSubscriptions(userId: string): Promise<ArtistSubscription[]> {
    return db.select().from(artistSubscriptions)
      .where(and(eq(artistSubscriptions.subscriberId, userId), eq(artistSubscriptions.status, "active")))
      .orderBy(desc(artistSubscriptions.createdAt));
  }

  async isSubscribed(subscriberId: string, artistId: number): Promise<boolean> {
    const [result] = await db.select({ count: count() }).from(artistSubscriptions)
      .where(and(
        eq(artistSubscriptions.subscriberId, subscriberId),
        eq(artistSubscriptions.artistId, artistId),
        eq(artistSubscriptions.status, "active")
      ));
    return (result?.count || 0) > 0;
  }

  async createArtistSubscription(sub: InsertArtistSubscription): Promise<ArtistSubscription> {
    const [created] = await db.insert(artistSubscriptions).values(sub).returning();
    await db.update(artistProfiles)
      .set({ totalSubscribers: sql`${artistProfiles.totalSubscribers} + 1` })
      .where(eq(artistProfiles.id, sub.artistId));
    return created;
  }

  async cancelArtistSubscription(id: number): Promise<ArtistSubscription> {
    const [updated] = await db.update(artistSubscriptions)
      .set({ status: "canceled", canceledAt: new Date() })
      .where(eq(artistSubscriptions.id, id))
      .returning();
    if (updated) {
      await db.update(artistProfiles)
        .set({ totalSubscribers: sql`GREATEST(${artistProfiles.totalSubscribers} - 1, 0)` })
        .where(eq(artistProfiles.id, updated.artistId));
    }
    return updated;
  }

  // === ARTIST FOLLOWERS ===

  async getArtistFollowers(artistId: number): Promise<ArtistFollower[]> {
    return db.select().from(artistFollowers)
      .where(eq(artistFollowers.artistId, artistId))
      .orderBy(desc(artistFollowers.createdAt));
  }

  async getFollowerCount(artistId: number): Promise<number> {
    const [result] = await db.select({ count: count() }).from(artistFollowers)
      .where(eq(artistFollowers.artistId, artistId));
    return result?.count || 0;
  }

  async isFollowing(followerId: string, artistId: number): Promise<boolean> {
    const [result] = await db.select({ count: count() }).from(artistFollowers)
      .where(and(eq(artistFollowers.followerId, followerId), eq(artistFollowers.artistId, artistId)));
    return (result?.count || 0) > 0;
  }

  async toggleFollow(followerId: string, artistId: number): Promise<{ following: boolean; count: number }> {
    const existing = await db.select().from(artistFollowers)
      .where(and(eq(artistFollowers.followerId, followerId), eq(artistFollowers.artistId, artistId)));
    if (existing.length > 0) {
      await db.delete(artistFollowers).where(eq(artistFollowers.id, existing[0].id));
      const cnt = await this.getFollowerCount(artistId);
      return { following: false, count: cnt };
    }
    await db.insert(artistFollowers).values({ followerId, artistId });
    const cnt = await this.getFollowerCount(artistId);
    return { following: true, count: cnt };
  }

  // === SONG EARNINGS ===

  async getSongEarnings(artistId: number): Promise<SongEarning[]> {
    return db.select().from(songEarnings)
      .where(eq(songEarnings.artistId, artistId))
      .orderBy(desc(songEarnings.createdAt));
  }

  async getSongEarningsByPeriod(artistId: number, period: string): Promise<SongEarning[]> {
    return db.select().from(songEarnings)
      .where(and(eq(songEarnings.artistId, artistId), eq(songEarnings.period, period)))
      .orderBy(desc(songEarnings.netRevenue));
  }

  async createSongEarning(earning: InsertSongEarning): Promise<SongEarning> {
    const [created] = await db.insert(songEarnings).values(earning).returning();
    return created;
  }

  async getArtistTotalEarnings(artistId: number): Promise<{ gross: number; net: number; pending: number }> {
    const [totals] = await db.select({
      gross: sum(songEarnings.grossRevenue),
      net: sum(songEarnings.netRevenue),
    }).from(songEarnings).where(eq(songEarnings.artistId, artistId));

    const [pendingResult] = await db.select({
      pending: sum(songEarnings.netRevenue),
    }).from(songEarnings)
      .where(and(eq(songEarnings.artistId, artistId), eq(songEarnings.isPaid, false)));

    return {
      gross: Number(totals?.gross) || 0,
      net: Number(totals?.net) || 0,
      pending: Number(pendingResult?.pending) || 0,
    };
  }

  // === PRO REGISTRATIONS ===

  async getProRegistrations(artistId: number): Promise<ProRegistration[]> {
    return db.select().from(proRegistrations)
      .where(eq(proRegistrations.artistId, artistId))
      .orderBy(desc(proRegistrations.createdAt));
  }

  async getProRegistration(id: number): Promise<ProRegistration | undefined> {
    const [reg] = await db.select().from(proRegistrations).where(eq(proRegistrations.id, id));
    return reg;
  }

  async createProRegistration(reg: InsertProRegistration): Promise<ProRegistration> {
    const [created] = await db.insert(proRegistrations).values(reg).returning();
    return created;
  }

  async updateProRegistration(id: number, data: Partial<ProRegistration>): Promise<ProRegistration> {
    const [updated] = await db.update(proRegistrations).set(data).where(eq(proRegistrations.id, id)).returning();
    return updated;
  }

  // === ARTIST SONGS ===

  async getArtistSongs(artistId: number): Promise<Song[]> {
    const profile = await this.getArtistProfileById(artistId);
    if (!profile) return [];
    return db.select().from(songs)
      .where(and(eq(songs.userId, profile.userId), eq(songs.isPublic, true)))
      .orderBy(desc(songs.createdAt));
  }

  // === DISCOGRAPHY ===

  async getDiscographyAlbums(artistId: number): Promise<DiscographyAlbum[]> {
    return db.select().from(discographyAlbums)
      .where(eq(discographyAlbums.artistId, artistId))
      .orderBy(desc(discographyAlbums.releaseDate));
  }

  async getDiscographyAlbum(id: number): Promise<DiscographyAlbum | undefined> {
    const [album] = await db.select().from(discographyAlbums).where(eq(discographyAlbums.id, id));
    return album;
  }

  async createDiscographyAlbum(album: InsertDiscographyAlbum): Promise<DiscographyAlbum> {
    const [created] = await db.insert(discographyAlbums).values(album).returning();
    return created;
  }

  async updateDiscographyAlbum(id: number, data: Partial<DiscographyAlbum>): Promise<DiscographyAlbum> {
    const [updated] = await db.update(discographyAlbums).set(data).where(eq(discographyAlbums.id, id)).returning();
    return updated;
  }

  async deleteDiscographyAlbum(id: number): Promise<void> {
    await db.delete(discographyTracks).where(eq(discographyTracks.albumId, id));
    await db.delete(discographyAlbums).where(eq(discographyAlbums.id, id));
  }

  async getDiscographyTracks(albumId: number): Promise<DiscographyTrack[]> {
    return db.select().from(discographyTracks)
      .where(eq(discographyTracks.albumId, albumId))
      .orderBy(discographyTracks.trackNumber);
  }

  async createDiscographyTrack(track: InsertDiscographyTrack): Promise<DiscographyTrack> {
    const [created] = await db.insert(discographyTracks).values(track).returning();
    return created;
  }

  async createDiscographyTracksBulk(tracks: InsertDiscographyTrack[]): Promise<DiscographyTrack[]> {
    if (tracks.length === 0) return [];
    return db.insert(discographyTracks).values(tracks).returning();
  }

  async deleteDiscographyTrack(id: number): Promise<void> {
    await db.delete(discographyTracks).where(eq(discographyTracks.id, id));
  }

  async getArtistDiscographyPublic(artistId: number): Promise<Array<DiscographyAlbum & { tracks: DiscographyTrack[] }>> {
    const albums = await db.select().from(discographyAlbums)
      .where(and(eq(discographyAlbums.artistId, artistId), eq(discographyAlbums.isPublished, true)))
      .orderBy(desc(discographyAlbums.releaseDate));

    const result: Array<DiscographyAlbum & { tracks: DiscographyTrack[] }> = [];
    for (const album of albums) {
      const albumTracks = await db.select().from(discographyTracks)
        .where(eq(discographyTracks.albumId, album.id))
        .orderBy(discographyTracks.trackNumber);
      result.push({ ...album, tracks: albumTracks });
    }
    return result;
  }

  async getAllDiscographyPublic(): Promise<Array<DiscographyAlbum & { artist: ArtistProfile; tracks: DiscographyTrack[] }>> {
    const albums = await db.select().from(discographyAlbums)
      .where(eq(discographyAlbums.isPublished, true))
      .orderBy(desc(discographyAlbums.releaseDate));

    const result: Array<DiscographyAlbum & { artist: ArtistProfile; tracks: DiscographyTrack[] }> = [];
    for (const album of albums) {
      const [artist] = await db.select().from(artistProfiles).where(eq(artistProfiles.id, album.artistId));
      if (!artist) continue;
      const albumTracks = await db.select().from(discographyTracks)
        .where(eq(discographyTracks.albumId, album.id))
        .orderBy(discographyTracks.trackNumber);
      result.push({ ...album, artist, tracks: albumTracks });
    }
    return result;
  }
  // === ARTIST GIFTS ===

  async createArtistGift(gift: InsertArtistGift): Promise<ArtistGift> {
    const [created] = await db.insert(artistGifts).values(gift).returning();
    return created;
  }

  async getArtistGift(id: number): Promise<ArtistGift | undefined> {
    const [gift] = await db.select().from(artistGifts).where(eq(artistGifts.id, id));
    return gift;
  }

  async getArtistGiftByPaymentIntent(paymentIntentId: string): Promise<ArtistGift | undefined> {
    const [gift] = await db.select().from(artistGifts).where(eq(artistGifts.stripePaymentIntentId, paymentIntentId));
    return gift;
  }

  async updateArtistGift(id: number, data: Partial<ArtistGift>): Promise<ArtistGift> {
    const [updated] = await db.update(artistGifts).set(data).where(eq(artistGifts.id, id)).returning();
    return updated;
  }

  async getArtistGifts(artistId: number, limit = 50): Promise<ArtistGift[]> {
    return db.select().from(artistGifts)
      .where(eq(artistGifts.artistId, artistId))
      .orderBy(desc(artistGifts.createdAt))
      .limit(limit);
  }

  async getGiftsByFan(fanUserId: string): Promise<ArtistGift[]> {
    return db.select().from(artistGifts)
      .where(eq(artistGifts.fanUserId, fanUserId))
      .orderBy(desc(artistGifts.createdAt));
  }

  // === ARTIST WALLETS ===

  async getOrCreateArtistWallet(artistId: number): Promise<ArtistWallet> {
    const [existing] = await db.select().from(artistWallets).where(eq(artistWallets.artistId, artistId));
    if (existing) return existing;
    const [created] = await db.insert(artistWallets).values({
      artistId,
      balanceCents: 0,
      pendingBalanceCents: 0,
      totalEarnedCents: 0,
      totalWithdrawnCents: 0,
      totalFeesPaidCents: 0,
    }).returning();
    return created;
  }

  async getArtistWallet(artistId: number): Promise<ArtistWallet | undefined> {
    const [wallet] = await db.select().from(artistWallets).where(eq(artistWallets.artistId, artistId));
    return wallet;
  }

  async updateArtistWalletBalance(artistId: number, addCents: number, feeCents: number): Promise<ArtistWallet> {
    return await db.transaction(async (tx) => {
      let [wallet] = await tx.select().from(artistWallets).where(eq(artistWallets.artistId, artistId));
      if (!wallet) {
        [wallet] = await tx.insert(artistWallets).values({
          artistId,
          balanceCents: 0,
          pendingBalanceCents: 0,
          totalEarnedCents: 0,
          totalWithdrawnCents: 0,
          totalFeesPaidCents: 0,
        }).returning();
      }
      const [updated] = await tx.update(artistWallets).set({
        balanceCents: sql`${artistWallets.balanceCents} + ${addCents}`,
        totalEarnedCents: sql`${artistWallets.totalEarnedCents} + ${addCents}`,
        totalFeesPaidCents: sql`${artistWallets.totalFeesPaidCents} + ${feeCents}`,
        updatedAt: new Date(),
      }).where(eq(artistWallets.artistId, artistId)).returning();
      return updated;
    });
  }

  // === WALLET TRANSACTIONS ===

  async createWalletTransaction(tx: InsertWalletTransaction): Promise<WalletTransaction> {
    const [created] = await db.insert(walletTransactions).values(tx).returning();
    return created;
  }

  async getWalletTransactions(artistId: number, limit = 50): Promise<WalletTransaction[]> {
    return db.select().from(walletTransactions)
      .where(eq(walletTransactions.artistId, artistId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit);
  }

  async createPayoutRequest(req: InsertPayoutRequest): Promise<PayoutRequest> {
    const [created] = await db.insert(payoutRequests).values(req).returning();
    return created;
  }

  async updatePayoutRequest(id: number, data: Partial<PayoutRequest>): Promise<PayoutRequest> {
    const [updated] = await db.update(payoutRequests).set(data).where(eq(payoutRequests.id, id)).returning();
    return updated;
  }

  async getPayoutRequests(artistId: number, limit = 50): Promise<PayoutRequest[]> {
    return db.select().from(payoutRequests)
      .where(eq(payoutRequests.artistId, artistId))
      .orderBy(desc(payoutRequests.createdAt))
      .limit(limit);
  }

  async getPayoutRequest(id: number): Promise<PayoutRequest | undefined> {
    const [request] = await db.select().from(payoutRequests).where(eq(payoutRequests.id, id));
    return request;
  }

  async getAllPayoutRequests(limit = 100, statusFilter?: string): Promise<(PayoutRequest & { artistName?: string | null })[]> {
    const conditions = statusFilter ? [eq(payoutRequests.status, statusFilter)] : [];
    const rows = await db.select({
      id: payoutRequests.id,
      artistId: payoutRequests.artistId,
      amountCents: payoutRequests.amountCents,
      method: payoutRequests.method,
      status: payoutRequests.status,
      stripeTransferId: payoutRequests.stripeTransferId,
      stripePayoutId: payoutRequests.stripePayoutId,
      failureReason: payoutRequests.failureReason,
      processedAt: payoutRequests.processedAt,
      createdAt: payoutRequests.createdAt,
      artistName: artistProfiles.artistName,
    })
      .from(payoutRequests)
      .leftJoin(artistProfiles, eq(payoutRequests.artistId, artistProfiles.id))
      .where(conditions.length > 0 ? conditions[0] : undefined)
      .orderBy(desc(payoutRequests.createdAt))
      .limit(limit);
    return rows;
  }

  async updateArtistConnectStatus(artistId: number, data: { stripeConnectAccountId?: string; stripeConnectStatus?: string; stripeConnectDetailsSubmitted?: boolean; stripeConnectPayoutsEnabled?: boolean }): Promise<ArtistProfile> {
    const [updated] = await db.update(artistProfiles).set({ ...data, updatedAt: new Date() }).where(eq(artistProfiles.id, artistId)).returning();
    return updated;
  }

  async deductWalletBalance(artistId: number, amountCents: number): Promise<ArtistWallet> {
    const wallet = await this.getOrCreateArtistWallet(artistId);
    const newBalance = (wallet.balanceCents || 0) - amountCents;
    const newPending = (wallet.pendingBalanceCents || 0) + amountCents;
    const [updated] = await db.update(artistWallets).set({
      balanceCents: newBalance,
      pendingBalanceCents: newPending,
      updatedAt: new Date(),
    }).where(eq(artistWallets.artistId, artistId)).returning();
    return updated;
  }

  async getArtistProfileLikes(artistId: number): Promise<ArtistProfileLike[]> {
    return db.select().from(artistProfileLikes).where(eq(artistProfileLikes.artistId, artistId));
  }

  async getArtistProfileLikeByUser(artistId: number, userId: string): Promise<ArtistProfileLike | undefined> {
    const [like] = await db.select().from(artistProfileLikes)
      .where(and(eq(artistProfileLikes.artistId, artistId), eq(artistProfileLikes.userId, userId)));
    return like;
  }

  async toggleArtistProfileLike(artistId: number, userId: string): Promise<{ liked: boolean; count: number }> {
    const existing = await this.getArtistProfileLikeByUser(artistId, userId);
    if (existing) {
      await db.delete(artistProfileLikes).where(eq(artistProfileLikes.id, existing.id));
    } else {
      await db.insert(artistProfileLikes).values({ artistId, userId });
    }
    const likes = await this.getArtistProfileLikes(artistId);
    return { liked: !existing, count: likes.length };
  }

  async getArtistProfileComments(artistId: number): Promise<ArtistProfileComment[]> {
    return db.select().from(artistProfileComments)
      .where(eq(artistProfileComments.artistId, artistId))
      .orderBy(desc(artistProfileComments.createdAt));
  }

  async createArtistProfileComment(data: InsertArtistProfileComment): Promise<ArtistProfileComment> {
    const [comment] = await db.insert(artistProfileComments).values(data).returning();
    return comment;
  }

  async deleteArtistProfileComment(id: number): Promise<void> {
    await db.delete(artistProfileComments).where(eq(artistProfileComments.id, id));
  }

  async createArtistProfileShare(data: InsertArtistProfileShare): Promise<ArtistProfileShare> {
    const [share] = await db.insert(artistProfileShares).values(data).returning();
    return share;
  }

  async getArtistProfileShareCount(artistId: number): Promise<number> {
    const shares = await db.select().from(artistProfileShares).where(eq(artistProfileShares.artistId, artistId));
    return shares.length;
  }

  async getCopyrightWorks(userId: string): Promise<CopyrightWork[]> {
    return await db.select().from(copyrightWorks).where(eq(copyrightWorks.userId, userId)).orderBy(desc(copyrightWorks.createdAt));
  }

  async getCopyrightWork(id: number): Promise<CopyrightWork | undefined> {
    const [work] = await db.select().from(copyrightWorks).where(eq(copyrightWorks.id, id));
    return work;
  }

  async getCopyrightWorksBySong(songId: number): Promise<CopyrightWork[]> {
    return await db.select().from(copyrightWorks).where(eq(copyrightWorks.songId, songId));
  }

  async createCopyrightWork(work: InsertCopyrightWork): Promise<CopyrightWork> {
    const [created] = await db.insert(copyrightWorks).values(work).returning();
    return created;
  }

  async updateCopyrightWork(id: number, data: Partial<CopyrightWork>): Promise<CopyrightWork> {
    const [updated] = await db.update(copyrightWorks).set({ ...data, updatedAt: new Date() }).where(eq(copyrightWorks.id, id)).returning();
    return updated;
  }

  async deleteCopyrightWork(id: number): Promise<void> {
    await db.delete(copyrightWorks).where(eq(copyrightWorks.id, id));
  }

  async getCopyrightContributors(workId: number): Promise<CopyrightContributor[]> {
    return await db.select().from(copyrightContributors).where(eq(copyrightContributors.workId, workId));
  }

  async createCopyrightContributor(contributor: InsertCopyrightContributor): Promise<CopyrightContributor> {
    const [created] = await db.insert(copyrightContributors).values(contributor).returning();
    return created;
  }

  async updateCopyrightContributor(id: number, data: Partial<CopyrightContributor>): Promise<CopyrightContributor> {
    const [updated] = await db.update(copyrightContributors).set(data).where(eq(copyrightContributors.id, id)).returning();
    return updated;
  }

  async deleteCopyrightContributor(id: number): Promise<void> {
    await db.delete(copyrightContributors).where(eq(copyrightContributors.id, id));
  }

  async deleteCopyrightContributorsByWork(workId: number): Promise<void> {
    await db.delete(copyrightContributors).where(eq(copyrightContributors.workId, workId));
  }

  async getPublisherEntities(): Promise<PublisherEntity[]> {
    return await db.select().from(publisherEntities).where(eq(publisherEntities.isActive, true));
  }

  async getPublisherEntity(id: number): Promise<PublisherEntity | undefined> {
    const [publisher] = await db.select().from(publisherEntities).where(eq(publisherEntities.id, id));
    return publisher;
  }

  async getDefaultPublisher(): Promise<PublisherEntity | undefined> {
    const [publisher] = await db.select().from(publisherEntities).where(eq(publisherEntities.isDefault, true));
    return publisher;
  }

  async createPublisherEntity(publisher: InsertPublisherEntity): Promise<PublisherEntity> {
    const [created] = await db.insert(publisherEntities).values(publisher).returning();
    return created;
  }

  async updatePublisherEntity(id: number, data: Partial<PublisherEntity>): Promise<PublisherEntity> {
    const [updated] = await db.update(publisherEntities).set(data).where(eq(publisherEntities.id, id)).returning();
    return updated;
  }

  async getUserPlaylists(userId: string): Promise<UserPlaylist[]> {
    return await db.select().from(userPlaylists).where(eq(userPlaylists.userId, userId)).orderBy(desc(userPlaylists.createdAt));
  }

  async getPlaylist(id: number): Promise<UserPlaylist | undefined> {
    const [playlist] = await db.select().from(userPlaylists).where(eq(userPlaylists.id, id));
    return playlist;
  }

  async createPlaylist(playlist: InsertUserPlaylist): Promise<UserPlaylist> {
    const [created] = await db.insert(userPlaylists).values(playlist).returning();
    return created;
  }

  async updatePlaylist(id: number, data: Partial<InsertUserPlaylist>): Promise<UserPlaylist | undefined> {
    const [updated] = await db.update(userPlaylists).set({ ...data, updatedAt: new Date() }).where(eq(userPlaylists.id, id)).returning();
    return updated;
  }

  async deletePlaylist(id: number): Promise<void> {
    await db.delete(userPlaylists).where(eq(userPlaylists.id, id));
  }

  async addSongToPlaylist(playlistId: number, songId: number, position?: number): Promise<UserPlaylistSong> {
    const pos = position ?? 0;
    const [entry] = await db.insert(userPlaylistSongs).values({ playlistId, songId, position: pos }).returning();
    return entry;
  }

  async removeSongFromPlaylist(playlistId: number, songId: number): Promise<void> {
    await db.delete(userPlaylistSongs).where(and(eq(userPlaylistSongs.playlistId, playlistId), eq(userPlaylistSongs.songId, songId)));
  }

  async getPlaylistSongs(playlistId: number): Promise<any[]> {
    const rows = await db
      .select({
        entryId: userPlaylistSongs.id,
        position: userPlaylistSongs.position,
        addedAt: userPlaylistSongs.addedAt,
        song: songs,
      })
      .from(userPlaylistSongs)
      .innerJoin(songs, eq(userPlaylistSongs.songId, songs.id))
      .where(eq(userPlaylistSongs.playlistId, playlistId))
      .orderBy(userPlaylistSongs.position);

    const songIds = rows.map(r => r.song.id);
    const likesMap = songIds.length > 0 ? await this.getSongLikeCountsBatch(songIds) : {};

    return rows.map(r => ({
      ...r.song,
      entryId: r.entryId,
      position: r.position,
      addedAt: r.addedAt,
      likes: likesMap[r.song.id] || 0,
    }));
  }

  async getPublicPlaylists(limit?: number): Promise<UserPlaylist[]> {
    const q = db.select().from(userPlaylists).where(eq(userPlaylists.isPublic, true)).orderBy(desc(userPlaylists.createdAt));
    if (limit) {
      return await q.limit(limit);
    }
    return await q;
  }

  async getTrainingDatasets(): Promise<TrainingDataset[]> {
    return await db.select().from(trainingDatasets).orderBy(desc(trainingDatasets.createdAt));
  }

  async getTrainingDataset(id: number): Promise<TrainingDataset | undefined> {
    const [dataset] = await db.select().from(trainingDatasets).where(eq(trainingDatasets.id, id));
    return dataset;
  }

  async createTrainingDataset(dataset: InsertTrainingDataset): Promise<TrainingDataset> {
    const [created] = await db.insert(trainingDatasets).values(dataset).returning();
    return created;
  }

  async updateTrainingDataset(id: number, data: Partial<TrainingDataset>): Promise<TrainingDataset> {
    const [updated] = await db.update(trainingDatasets).set(data).where(eq(trainingDatasets.id, id)).returning();
    return updated;
  }

  async deleteTrainingDataset(id: number): Promise<void> {
    await db.delete(trainingFiles).where(eq(trainingFiles.datasetId, id));
    await db.delete(trainingDatasets).where(eq(trainingDatasets.id, id));
  }

  async getTrainingFiles(datasetId: number, fileType?: string): Promise<TrainingFile[]> {
    if (fileType) {
      return await db.select().from(trainingFiles)
        .where(and(eq(trainingFiles.datasetId, datasetId), eq(trainingFiles.fileType, fileType)))
        .orderBy(trainingFiles.fileName);
    }
    return await db.select().from(trainingFiles)
      .where(eq(trainingFiles.datasetId, datasetId))
      .orderBy(trainingFiles.fileName);
  }

  async getTrainingFile(id: number): Promise<TrainingFile | undefined> {
    const [file] = await db.select().from(trainingFiles).where(eq(trainingFiles.id, id));
    return file;
  }

  async createTrainingFile(file: InsertTrainingFile): Promise<TrainingFile> {
    const [created] = await db.insert(trainingFiles).values(file).returning();
    return created;
  }

  async deleteTrainingFile(id: number): Promise<void> {
    await db.delete(trainingFiles).where(eq(trainingFiles.id, id));
  }

  async deleteTrainingFilesByDataset(datasetId: number): Promise<void> {
    await db.delete(trainingFiles).where(eq(trainingFiles.datasetId, datasetId));
  }
}

export const storage = new DatabaseStorage();
