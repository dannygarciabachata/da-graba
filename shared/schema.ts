import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";
export * from "./models/chat";

// === TABLE DEFINITIONS ===

export const songs = pgTable("songs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull().default("Untitled Track"),
  prompt: text("prompt").notNull(),
  genre: text("genre"),
  audioUrl: text("audio_url"),
  imageUrl: text("image_url"),
  duration: integer("duration"),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  isPublic: boolean("is_public").default(false),
  mode: text("mode").default("standard"),
  taskId: text("task_id"),
  kieAudioId: text("kie_audio_id"),
  pairId: text("pair_id"),
  variationLabel: text("variation_label"),
  artistName: text("artist_name"),
  copyrightHolder: text("copyright_holder").default("DGB AUDIO"),
  lyricsText: text("lyrics_text"),
  playCount: integer("play_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lyrics = pgTable("lyrics", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").references(() => songs.id),
  userId: text("user_id").notNull(),
  theme: text("theme").notNull(),
  content: text("content").notNull(),
  style: text("style").default("bachata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const songsRelations = relations(songs, ({ many }) => ({
  lyrics: many(lyrics),
  tracks: many(tracks),
}));

export const lyricsRelations = relations(lyrics, ({ one }) => ({
  song: one(songs, {
    fields: [lyrics.songId],
    references: [songs.id],
  }),
}));

export const insertSongSchema = createInsertSchema(songs).omit({ 
  id: true, 
  createdAt: true,
  status: true,
  audioUrl: true,
  error: true 
});

export const insertLyricsSchema = createInsertSchema(lyrics).omit({ 
  id: true, 
  createdAt: true 
});

// === TRACKS TABLE ===
export const tracks = pgTable("tracks", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").notNull().references(() => songs.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  audioUrl: text("audio_url"),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  volume: integer("volume").default(100),
  isMuted: boolean("is_muted").default(false),
  isSolo: boolean("is_solo").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tracksRelations = relations(tracks, ({ one }) => ({
  song: one(songs, {
    fields: [tracks.songId],
    references: [songs.id],
  }),
}));

export const insertTrackSchema = createInsertSchema(tracks).omit({
  id: true,
  createdAt: true,
  status: true,
  audioUrl: true,
  error: true,
});

export type Track = typeof tracks.$inferSelect;
export type InsertTrack = z.infer<typeof insertTrackSchema>;

// === SAMPLES TABLE ===
export const samples = pgTable("samples", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull().default("Untitled Sample"),
  type: text("type").notNull().default("audio"),
  sourceType: text("source_type").notNull().default("upload"),
  audioUrl: text("audio_url"),
  duration: integer("duration"),
  bpm: integer("bpm"),
  key: text("key"),
  status: text("status").notNull().default("ready"),
  error: text("error"),
  parentId: integer("parent_id"),
  position: integer("position").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSampleSchema = createInsertSchema(samples).omit({
  id: true,
  createdAt: true,
  status: true,
  audioUrl: true,
  error: true,
});

export type Sample = typeof samples.$inferSelect;
export type InsertSample = z.infer<typeof insertSampleSchema>;

// === QUIZ TABLE ===
export const quizResults = pgTable("quiz_results", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  score: integer("score").notNull(),
  total: integer("total").notNull(),
  percentage: integer("percentage").notNull(),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQuizResultSchema = createInsertSchema(quizResults).omit({
  id: true,
  createdAt: true,
});

// === GENERIC API PROVIDER SYSTEM ===

export const apiProviders = pgTable("api_providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  authType: text("auth_type").notNull().default("raw"),
  authHeaderName: text("auth_header_name").default("Authorization"),
  apiKeyValue: text("api_key_value"),
  apiKeyEnvVar: text("api_key_env_var"),
  category: text("category").notNull().default("music"),
  isActive: boolean("is_active").default(true),
  defaultHeaders: jsonb("default_headers").$type<Record<string, string>>(),
  description: text("description"),
  priority: integer("priority").notNull().default(50),
  adapterKey: text("adapter_key"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const apiEndpoints = pgTable("api_endpoints", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").notNull().references(() => apiProviders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  operationType: text("operation_type").notNull(),
  path: text("path").notNull(),
  method: text("method").notNull().default("POST"),
  contentType: text("content_type").notNull().default("formdata"),
  requestMapping: jsonb("request_mapping").$type<Record<string, any>>(),
  responseMapping: jsonb("response_mapping").$type<Record<string, string>>(),
  pollPath: text("poll_path"),
  pollMethod: text("poll_method").default("GET"),
  pollResponseMapping: jsonb("poll_response_mapping").$type<Record<string, string>>(),
  conversionType: text("conversion_type"),
  asyncPattern: text("async_pattern").notNull().default("polling"),
  webhookSupported: boolean("webhook_supported").default(false),
  callbackUrlTemplate: text("callback_url_template"),
  successStatuses: jsonb("success_statuses").$type<string[]>(),
  failStatuses: jsonb("fail_statuses").$type<string[]>(),
  outputMapping: jsonb("output_mapping").$type<Record<string, string>>(),
  isActive: boolean("is_active").default(true),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const apiProvidersRelations = relations(apiProviders, ({ many }) => ({
  endpoints: many(apiEndpoints),
}));

export const apiEndpointsRelations = relations(apiEndpoints, ({ one }) => ({
  provider: one(apiProviders, {
    fields: [apiEndpoints.providerId],
    references: [apiProviders.id],
  }),
}));

export const insertApiProviderSchema = createInsertSchema(apiProviders).omit({
  id: true,
  createdAt: true,
});

export const insertApiEndpointSchema = createInsertSchema(apiEndpoints).omit({
  id: true,
  createdAt: true,
});

export type ApiProvider = typeof apiProviders.$inferSelect;
export type InsertApiProvider = z.infer<typeof insertApiProviderSchema>;
export type ApiEndpoint = typeof apiEndpoints.$inferSelect;
export type InsertApiEndpoint = z.infer<typeof insertApiEndpointSchema>;

export const OPERATION_TYPES = [
  "music_generation",
  "stem_separation",
  "remix",
  "mastering",
  "denoise",
  "key_bpm",
  "cover",
  "voice_change",
  "voice_conversion",
  "audio_cut",
  "lyrics_generation",
  "image_generation",
  "tts",
  "de_echo",
  "de_reverb",
  "sound_generation",
  "transcription",
  "audio_speed",
] as const;

export type OperationType = typeof OPERATION_TYPES[number];

export const PROVIDER_CATEGORIES = [
  "music",
  "lyrics",
  "image",
  "audio_processing",
  "voice",
] as const;

export type ProviderCategory = typeof PROVIDER_CATEGORIES[number];

export const AUTH_TYPES = [
  "raw",
  "bearer",
  "header",
  "query",
  "none",
] as const;

export type AuthType = typeof AUTH_TYPES[number];

// === STYLE KITS ===

export const styleKits = pgTable("style_kits", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  genre: text("genre").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  referenceUrl: text("reference_url"),
  createdBy: text("created_by").notNull(),
  isActive: boolean("is_active").default(true),
  isPublic: boolean("is_public").default(false),
  trainingStatus: text("training_status").default("pending"),
  trainingJobId: text("training_job_id"),
  trainingError: text("training_error"),
  trainedModelUrl: text("trained_model_url"),
  trainingConfig: text("training_config"),
  trainingPrompt: text("training_prompt"),
  pipelineStep: text("pipeline_step").default("upload"),
  lastTrainedAt: timestamp("last_trained_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const styleKitInstruments = pgTable("style_kit_instruments", {
  id: serial("id").primaryKey(),
  kitId: integer("kit_id").notNull().references(() => styleKits.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  audioUrl: text("audio_url"),
  processedUrl: text("processed_url"),
  midiUrl: text("midi_url"),
  description: text("description"),
  volume: integer("volume").default(100),
  position: integer("position").default(0),
  uploadStatus: text("upload_status").default("uploaded"),
  analysisStatus: text("analysis_status").default("pending"),
  analysisError: text("analysis_error"),
  detectedKey: text("detected_key"),
  detectedBpm: integer("detected_bpm"),
  detectedEnergy: real("detected_energy"),
  detectedTags: text("detected_tags"),
  generatedPrompt: text("generated_prompt"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const styleKitsRelations = relations(styleKits, ({ many }) => ({
  instruments: many(styleKitInstruments),
}));

export const styleKitInstrumentsRelations = relations(styleKitInstruments, ({ one }) => ({
  kit: one(styleKits, {
    fields: [styleKitInstruments.kitId],
    references: [styleKits.id],
  }),
}));

export const insertStyleKitSchema = createInsertSchema(styleKits).omit({
  id: true,
  createdAt: true,
});

export const insertStyleKitInstrumentSchema = createInsertSchema(styleKitInstruments).omit({
  id: true,
  createdAt: true,
});

export type StyleKit = typeof styleKits.$inferSelect;
export type InsertStyleKit = z.infer<typeof insertStyleKitSchema>;
export type StyleKitInstrument = typeof styleKitInstruments.$inferSelect;
export type InsertStyleKitInstrument = z.infer<typeof insertStyleKitInstrumentSchema>;

export const STYLE_KIT_GENRES = [
  "bachata",
  "bolero",
  "latin_pop",
  "merengue",
  "salsa",
  "cumbia",
  "reggaeton",
  "son",
  "vallenato",
  "tropical",
  "mambo",
  "cha_cha_cha",
  "guaracha",
  "dembow",
  "plena",
  "bomba",
  "punta",
  "champeta",
  "afrobeat",
  "jazz",
  "rock",
  "pop",
  "r_and_b",
  "hip_hop",
  "edm",
  "k_pop",
  "synthwave",
  "house",
  "soul",
  "country",
  "blues",
  "indie",
  "classical",
  "funk",
  "drum_and_bass",
] as const;

export type StyleKitGenre = typeof STYLE_KIT_GENRES[number];

export const INSTRUMENT_TYPES = [
  "guira",
  "bongo",
  "conga",
  "timbal",
  "requinto",
  "segunda_guitarra",
  "bass",
  "piano",
  "trumpet",
  "saxophone",
  "accordion",
  "maracas",
  "claves",
  "cowbell",
  "vocals",
  "other",
] as const;

export type InstrumentType = typeof INSTRUMENT_TYPES[number];

// === PLATFORM SETTINGS ===

export const platformSettings = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  category: text("category").notNull().default("general"),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPlatformSettingSchema = createInsertSchema(platformSettings).omit({
  id: true,
  updatedAt: true,
});

export type PlatformSetting = typeof platformSettings.$inferSelect;
export type InsertPlatformSetting = z.infer<typeof insertPlatformSettingSchema>;

export const SETTING_CATEGORIES = [
  "general",
  "email",
  "support",
  "billing",
  "limits",
  "branding",
] as const;

// === SUPPORT TICKETS ===

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  userName: text("user_name"),
  userEmail: text("user_email"),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("normal"),
  assignedTo: text("assigned_to"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const supportMessages = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("user"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supportTicketsRelations = relations(supportTickets, ({ many }) => ({
  messages: many(supportMessages),
}));

export const supportMessagesRelations = relations(supportMessages, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [supportMessages.ticketId],
    references: [supportTickets.id],
  }),
}));

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
});

export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({
  id: true,
  createdAt: true,
});

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;

export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

// === EXPLICIT API CONTRACT TYPES ===

export type Song = typeof songs.$inferSelect;
export type InsertSong = z.infer<typeof insertSongSchema>;
export type Lyric = typeof lyrics.$inferSelect;
export type InsertLyric = z.infer<typeof insertLyricsSchema>;
export type QuizResult = typeof quizResults.$inferSelect;
export type InsertQuizResult = z.infer<typeof insertQuizResultSchema>;

export type GenerateSongRequest = {
  prompt: string;
  isBachata?: boolean;
  style?: string;
  duration?: number;
  lyrics?: string;
  mode?: "standard" | "aggregate";
  title?: string;
  genre?: string;
  voiceModelId?: number;
  styleReferenceId?: number;
  artistName?: string;
  copyrightHolder?: string;
  make_instrumental?: boolean;
  styleKitId?: number;
};

export type GenerateLyricsRequest = {
  theme: string;
  style?: "romantic" | "dance" | "heartbreak";
};

export type SubmitQuizRequest = {
  answers: Record<number, number>;
  category?: string;
};

export type SongResponse = Song;
export type LyricResponse = Lyric;

// === VOICE MODELS ===

export const voiceModels = pgTable("voice_models", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("uploaded"),
  imageUrl: text("image_url"),
  modelUrl: text("model_url"),
  externalVoiceId: text("external_voice_id"),
  provider: text("provider").default("custom"),
  gender: text("gender"),
  language: text("language").default("es"),
  tags: text("tags"),
  isActive: boolean("is_active").default(true),
  isPublic: boolean("is_public").default(false),
  trainingStatus: text("training_status").default("ready"),
  trainingJobId: text("training_job_id"),
  trainingError: text("training_error"),
  pipelineStep: text("pipeline_step").default("ready"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voiceSamples = pgTable("voice_samples", {
  id: serial("id").primaryKey(),
  voiceModelId: integer("voice_model_id").notNull().references(() => voiceModels.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  audioUrl: text("audio_url"),
  duration: integer("duration"),
  status: text("status").notNull().default("uploaded"),
  error: text("error"),
  analysisData: text("analysis_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const styleReferences = pgTable("style_references", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  audioUrl: text("audio_url"),
  duration: integer("duration"),
  detectedGenre: text("detected_genre"),
  detectedBpm: integer("detected_bpm"),
  detectedKey: text("detected_key"),
  analysisData: text("analysis_data"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voiceModelsRelations = relations(voiceModels, ({ many }) => ({
  samples: many(voiceSamples),
}));

export const voiceSamplesRelations = relations(voiceSamples, ({ one }) => ({
  voiceModel: one(voiceModels, {
    fields: [voiceSamples.voiceModelId],
    references: [voiceModels.id],
  }),
}));

export const insertVoiceModelSchema = createInsertSchema(voiceModels).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export const insertVoiceSampleSchema = createInsertSchema(voiceSamples).omit({
  id: true,
  createdAt: true,
});

export const insertStyleReferenceSchema = createInsertSchema(styleReferences).omit({
  id: true,
  createdAt: true,
});

export type VoiceModel = typeof voiceModels.$inferSelect;
export type InsertVoiceModel = z.infer<typeof insertVoiceModelSchema>;
export type VoiceSample = typeof voiceSamples.$inferSelect;
export type InsertVoiceSample = z.infer<typeof insertVoiceSampleSchema>;
export type StyleReference = typeof styleReferences.$inferSelect;
export type InsertStyleReference = z.infer<typeof insertStyleReferenceSchema>;

export const VOICE_MODEL_TYPES = [
  "uploaded",
  "trained",
  "cloned",
] as const;

export const VOICE_PROVIDERS = [
  "custom",
  "elevenlabs",
  "rvc",
  "so-vits",
  "openvoice",
  "cloud_gpu",
] as const;

export const VOICE_TRAINING_STEPS = ["upload", "analyze", "train", "ready"] as const;

export type VoiceModelType = typeof VOICE_MODEL_TYPES[number];
export type VoiceProvider = typeof VOICE_PROVIDERS[number];

// === CLOUD SERVERS ===

export const cloudServers = pgTable("cloud_servers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  apiPort: integer("api_port").notNull().default(7860),
  jupyterPort: integer("jupyter_port").default(8888),
  jupyterToken: text("jupyter_token"),
  apiKey: text("api_key"),
  webhookSecret: text("webhook_secret"),
  authHeaderName: text("auth_header_name").default("X-DGB-API-Key"),
  webhookHeaderName: text("webhook_header_name").default("X-Webhook-Secret"),
  healthEndpoint: text("health_endpoint").default("/api/health"),
  uploadEndpoint: text("upload_endpoint").default("/api/upload-instrument"),
  capabilities: text("capabilities").array().notNull().default(["instrument_processing"]),
  priority: integer("priority").notNull().default(0),
  isActive: boolean("is_active").default(true),
  status: text("status").default("unknown"),
  lastHealthCheck: timestamp("last_health_check"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCloudServerSchema = createInsertSchema(cloudServers).omit({
  id: true,
  createdAt: true,
  lastHealthCheck: true,
  status: true,
});

export type CloudServer = typeof cloudServers.$inferSelect;
export type InsertCloudServer = z.infer<typeof insertCloudServerSchema>;

export const CLOUD_CAPABILITIES = [
  "instrument_processing",
  "music_generation",
  "training",
  "audio_analysis",
  "midi_conversion",
] as const;

export type CloudCapability = typeof CLOUD_CAPABILITIES[number];

// === BLOG SYSTEM ===

export const blogCategories = pgTable("blog_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  color: text("color").default("#00F3FF"),
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull().default(""),
  excerpt: text("excerpt"),
  featuredImageUrl: text("featured_image_url"),
  categoryId: integer("category_id").references(() => blogCategories.id),
  authorId: text("author_id").notNull(),
  authorName: text("author_name"),
  status: text("status").notNull().default("draft"),
  tags: text("tags"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  viewCount: integer("view_count").default(0),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  category: one(blogCategories, {
    fields: [blogPosts.categoryId],
    references: [blogCategories.id],
  }),
}));

export const blogCategoriesRelations = relations(blogCategories, ({ many }) => ({
  posts: many(blogPosts),
}));

export const insertBlogCategorySchema = createInsertSchema(blogCategories).omit({
  id: true,
  createdAt: true,
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
});

export type BlogCategory = typeof blogCategories.$inferSelect;
export type InsertBlogCategory = z.infer<typeof insertBlogCategorySchema>;
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;

export const BLOG_POST_STATUSES = ["draft", "published", "archived"] as const;
export type BlogPostStatus = typeof BLOG_POST_STATUSES[number];

// === BLOG INTERACTIONS ===

export const blogComments = pgTable("blog_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  authorName: text("author_name").notNull(),
  authorAvatar: text("author_avatar"),
  content: text("content").notNull(),
  isApproved: boolean("is_approved").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blogLikes = pgTable("blog_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blogStars = pgTable("blog_stars", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  rating: integer("rating").notNull().default(5),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blogShares = pgTable("blog_shares", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  platform: text("platform").notNull().default("link"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBlogCommentSchema = createInsertSchema(blogComments).omit({
  id: true,
  createdAt: true,
});

export const insertBlogLikeSchema = createInsertSchema(blogLikes).omit({
  id: true,
  createdAt: true,
});

export const insertBlogStarSchema = createInsertSchema(blogStars).omit({
  id: true,
  createdAt: true,
});

export const insertBlogShareSchema = createInsertSchema(blogShares).omit({
  id: true,
  createdAt: true,
});

export type BlogComment = typeof blogComments.$inferSelect;
export type InsertBlogComment = z.infer<typeof insertBlogCommentSchema>;
export type BlogLike = typeof blogLikes.$inferSelect;
export type InsertBlogLike = z.infer<typeof insertBlogLikeSchema>;
export type BlogStar = typeof blogStars.$inferSelect;
export type InsertBlogStar = z.infer<typeof insertBlogStarSchema>;
export type BlogShare = typeof blogShares.$inferSelect;
export type InsertBlogShare = z.infer<typeof insertBlogShareSchema>;

// === SONG LIKES ===

export const songLikes = pgTable("song_likes", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").notNull().references(() => songs.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  value: integer("value").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSongLikeSchema = createInsertSchema(songLikes).omit({
  id: true,
  createdAt: true,
});

export type SongLike = typeof songLikes.$inferSelect;
export type InsertSongLike = z.infer<typeof insertSongLikeSchema>;

// === COVER DESIGNS ===

export const coverDesigns = pgTable("cover_designs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  songId: integer("song_id").references(() => songs.id, { onDelete: "set null" }),
  name: text("name").notNull().default("Untitled Design"),
  backgroundImageUrl: text("background_image_url"),
  overlayElements: jsonb("overlay_elements").default([]),
  filterSettings: jsonb("filter_settings").default({}),
  templateId: text("template_id"),
  fontId: text("font_id"),
  titleText: text("title_text"),
  artistText: text("artist_text"),
  titleSize: integer("title_size").default(48),
  artistSize: integer("artist_size").default(24),
  titlePosition: jsonb("title_position").default({ x: 400, y: 600 }),
  artistPosition: jsonb("artist_position").default({ x: 400, y: 680 }),
  aiPrompt: text("ai_prompt"),
  aiEffects: text("ai_effects"),
  renderedImageUrl: text("rendered_image_url"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCoverDesignSchema = createInsertSchema(coverDesigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CoverDesign = typeof coverDesigns.$inferSelect;
export type InsertCoverDesign = z.infer<typeof insertCoverDesignSchema>;

// === PRICING PLANS ===

export const pricingPlans = pgTable("pricing_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tier: text("tier").notNull(),
  description: text("description"),
  features: text("features").array().notNull().default([]),
  priceMonthly: integer("price_monthly").notNull().default(0),
  priceAnnual: integer("price_annual"),
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdAnnual: text("stripe_price_id_annual"),
  stripeProductId: text("stripe_product_id"),
  credits: integer("credits").default(0),
  creditsLabel: text("credits_label"),
  iconName: text("icon_name").default("Zap"),
  color: text("color").default("text-blue-400"),
  isActive: boolean("is_active").default(true),
  isPopular: boolean("is_popular").default(false),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPricingPlanSchema = createInsertSchema(pricingPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PricingPlan = typeof pricingPlans.$inferSelect;
export type InsertPricingPlan = z.infer<typeof insertPricingPlanSchema>;

export const PLAN_TIERS = ["free", "pro", "producer", "premium"] as const;
export type PlanTier = typeof PLAN_TIERS[number];

// === ARTIST PROFILES ===

export const artistProfiles = pgTable("artist_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  artistName: text("artist_name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  genre: text("genre"),
  country: text("country"),
  website: text("website"),
  socialLinks: jsonb("social_links").$type<Record<string, string>>(),
  proEntity: text("pro_entity"),
  proMemberId: text("pro_member_id"),
  ipiNumber: text("ipi_number"),
  isVerified: boolean("is_verified").default(false),
  isActive: boolean("is_active").default(true),
  monthlySubscriptionPrice: integer("monthly_subscription_price").default(299),
  totalEarnings: integer("total_earnings").default(0),
  totalSubscribers: integer("total_subscribers").default(0),
  totalPlays: integer("total_plays").default(0),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  artistType: text("artist_type").default("independent"),
  youtubeUrls: jsonb("youtube_urls").$type<string[]>().default([]),
  spotifyArtistId: text("spotify_artist_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertArtistProfileSchema = createInsertSchema(artistProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalEarnings: true,
  totalSubscribers: true,
  totalPlays: true,
});

export type ArtistProfile = typeof artistProfiles.$inferSelect;
export type InsertArtistProfile = z.infer<typeof insertArtistProfileSchema>;

export const PRO_ENTITIES = ["bmi", "ascap", "sesac", "socan", "prs", "gema", "sgae", "none"] as const;
export type ProEntity = typeof PRO_ENTITIES[number];

export const ARTIST_TYPES = [
  "independent",
  "singer",
  "producer",
  "dj",
  "band",
  "restaurant",
  "barbershop",
  "nightclub",
  "content_creator",
  "hobbyist",
] as const;
export type ArtistType = typeof ARTIST_TYPES[number];

// === ARTIST SUBSCRIPTIONS (Listeners subscribe to artists) ===

export const artistSubscriptions = pgTable("artist_subscriptions", {
  id: serial("id").primaryKey(),
  subscriberId: text("subscriber_id").notNull(),
  artistId: integer("artist_id").notNull().references(() => artistProfiles.id, { onDelete: "cascade" }),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull().default("active"),
  priceAtSubscription: integer("price_at_subscription").default(299),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const artistSubscriptionsRelations = relations(artistSubscriptions, ({ one }) => ({
  artist: one(artistProfiles, {
    fields: [artistSubscriptions.artistId],
    references: [artistProfiles.id],
  }),
}));

export const insertArtistSubscriptionSchema = createInsertSchema(artistSubscriptions).omit({
  id: true,
  createdAt: true,
});

export type ArtistSubscription = typeof artistSubscriptions.$inferSelect;
export type InsertArtistSubscription = z.infer<typeof insertArtistSubscriptionSchema>;

export const SUBSCRIPTION_STATUSES = ["active", "canceled", "past_due", "expired"] as const;

// === SONG EARNINGS / REVENUE LEDGER ===

export const songEarnings = pgTable("song_earnings", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").notNull().references(() => songs.id, { onDelete: "cascade" }),
  artistId: integer("artist_id").notNull().references(() => artistProfiles.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  totalPlays: integer("total_plays").default(0),
  grossRevenue: integer("gross_revenue").default(0),
  platformFee: integer("platform_fee").default(0),
  netRevenue: integer("net_revenue").default(0),
  isPaid: boolean("is_paid").default(false),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const songEarningsRelations = relations(songEarnings, ({ one }) => ({
  song: one(songs, {
    fields: [songEarnings.songId],
    references: [songs.id],
  }),
  artist: one(artistProfiles, {
    fields: [songEarnings.artistId],
    references: [artistProfiles.id],
  }),
}));

export const insertSongEarningSchema = createInsertSchema(songEarnings).omit({
  id: true,
  createdAt: true,
});

export type SongEarning = typeof songEarnings.$inferSelect;
export type InsertSongEarning = z.infer<typeof insertSongEarningSchema>;

// === PRO REGISTRATIONS (BMI/ASCAP song registrations) ===

export const proRegistrations = pgTable("pro_registrations", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").notNull().references(() => songs.id, { onDelete: "cascade" }),
  artistId: integer("artist_id").notNull().references(() => artistProfiles.id, { onDelete: "cascade" }),
  proEntity: text("pro_entity").notNull(),
  registrationStatus: text("registration_status").notNull().default("pending"),
  externalRegistrationId: text("external_registration_id"),
  workTitle: text("work_title").notNull(),
  writers: jsonb("writers").$type<Array<{ name: string; role: string; share: number; ipiNumber?: string }>>(),
  publishers: jsonb("publishers").$type<Array<{ name: string; share: number }>>(),
  iswcCode: text("iswc_code"),
  submittedAt: timestamp("submitted_at"),
  registeredAt: timestamp("registered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const proRegistrationsRelations = relations(proRegistrations, ({ one }) => ({
  song: one(songs, {
    fields: [proRegistrations.songId],
    references: [songs.id],
  }),
  artist: one(artistProfiles, {
    fields: [proRegistrations.artistId],
    references: [artistProfiles.id],
  }),
}));

export const insertProRegistrationSchema = createInsertSchema(proRegistrations).omit({
  id: true,
  createdAt: true,
});

export type ProRegistration = typeof proRegistrations.$inferSelect;
export type InsertProRegistration = z.infer<typeof insertProRegistrationSchema>;

export const PRO_REGISTRATION_STATUSES = ["pending", "submitted", "registered", "rejected"] as const;
export type ProRegistrationStatus = typeof PRO_REGISTRATION_STATUSES[number];

// === ARTIST FOLLOWERS (free follow, no payment) ===

export const artistFollowers = pgTable("artist_followers", {
  id: serial("id").primaryKey(),
  followerId: text("follower_id").notNull(),
  artistId: integer("artist_id").notNull().references(() => artistProfiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const artistFollowersRelations = relations(artistFollowers, ({ one }) => ({
  artist: one(artistProfiles, {
    fields: [artistFollowers.artistId],
    references: [artistProfiles.id],
  }),
}));

export const insertArtistFollowerSchema = createInsertSchema(artistFollowers).omit({
  id: true,
  createdAt: true,
});

export type ArtistFollower = typeof artistFollowers.$inferSelect;
export type InsertArtistFollower = z.infer<typeof insertArtistFollowerSchema>;

// === DISCOGRAPHY ALBUMS ===

export const discographyAlbums = pgTable("discography_albums", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull().references(() => artistProfiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  albumType: text("album_type").notNull().default("album"),
  releaseDate: text("release_date"),
  coverImageUrl: text("cover_image_url"),
  description: text("description"),
  genre: text("genre"),
  tracksCount: integer("tracks_count").default(0),
  spotifyAlbumId: text("spotify_album_id"),
  spotifyUrl: text("spotify_url"),
  appleMusicUrl: text("apple_music_url"),
  amazonMusicUrl: text("amazon_music_url"),
  youtubeMusicUrl: text("youtube_music_url"),
  deezerUrl: text("deezer_url"),
  tidalUrl: text("tidal_url"),
  isPublished: boolean("is_published").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const discographyAlbumsRelations = relations(discographyAlbums, ({ one, many }) => ({
  artist: one(artistProfiles, {
    fields: [discographyAlbums.artistId],
    references: [artistProfiles.id],
  }),
  tracks: many(discographyTracks),
}));

export const insertDiscographyAlbumSchema = createInsertSchema(discographyAlbums).omit({
  id: true,
  createdAt: true,
});

export type DiscographyAlbum = typeof discographyAlbums.$inferSelect;
export type InsertDiscographyAlbum = z.infer<typeof insertDiscographyAlbumSchema>;

export const ALBUM_TYPES = ["album", "single", "ep", "compilation"] as const;
export type AlbumType = typeof ALBUM_TYPES[number];

// === DISCOGRAPHY TRACKS ===

export const discographyTracks = pgTable("discography_tracks", {
  id: serial("id").primaryKey(),
  albumId: integer("album_id").notNull().references(() => discographyAlbums.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  trackNumber: integer("track_number").default(1),
  durationSeconds: integer("duration_seconds"),
  featuring: text("featuring"),
  spotifyTrackId: text("spotify_track_id"),
  previewUrl: text("preview_url"),
  isrcCode: text("isrc_code"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const discographyTracksRelations = relations(discographyTracks, ({ one }) => ({
  album: one(discographyAlbums, {
    fields: [discographyTracks.albumId],
    references: [discographyAlbums.id],
  }),
}));

export const insertDiscographyTrackSchema = createInsertSchema(discographyTracks).omit({
  id: true,
  createdAt: true,
});

export type DiscographyTrack = typeof discographyTracks.$inferSelect;
export type InsertDiscographyTrack = z.infer<typeof insertDiscographyTrackSchema>;

// === ARTIST GIFTS / FAN DONATIONS ===

export const artistGifts = pgTable("artist_gifts", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull().references(() => artistProfiles.id, { onDelete: "cascade" }),
  fanUserId: text("fan_user_id"),
  fanDisplayName: text("fan_display_name").default("Anonymous"),
  amountCents: integer("amount_cents").notNull(),
  message: text("message"),
  thankYouMessage: text("thank_you_message"),
  status: text("status").notNull().default("pending"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  platformFeeCents: integer("platform_fee_cents").default(0),
  netAmountCents: integer("net_amount_cents").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const artistGiftsRelations = relations(artistGifts, ({ one }) => ({
  artist: one(artistProfiles, {
    fields: [artistGifts.artistId],
    references: [artistProfiles.id],
  }),
}));

export const insertArtistGiftSchema = createInsertSchema(artistGifts).omit({
  id: true,
  createdAt: true,
});

export type ArtistGift = typeof artistGifts.$inferSelect;
export type InsertArtistGift = z.infer<typeof insertArtistGiftSchema>;

export const GIFT_STATUSES = ["pending", "completed", "failed", "refunded"] as const;

// === ARTIST WALLETS ===

export const artistWallets = pgTable("artist_wallets", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull().references(() => artistProfiles.id, { onDelete: "cascade" }),
  balanceCents: integer("balance_cents").default(0),
  pendingBalanceCents: integer("pending_balance_cents").default(0),
  totalEarnedCents: integer("total_earned_cents").default(0),
  totalWithdrawnCents: integer("total_withdrawn_cents").default(0),
  totalFeesPaidCents: integer("total_fees_paid_cents").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const artistWalletsRelations = relations(artistWallets, ({ one }) => ({
  artist: one(artistProfiles, {
    fields: [artistWallets.artistId],
    references: [artistProfiles.id],
  }),
}));

export const insertArtistWalletSchema = createInsertSchema(artistWallets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ArtistWallet = typeof artistWallets.$inferSelect;
export type InsertArtistWallet = z.infer<typeof insertArtistWalletSchema>;

// === WALLET TRANSACTIONS (LEDGER) ===

export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull().references(() => artistProfiles.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  description: text("description"),
  grossAmountCents: integer("gross_amount_cents").default(0),
  platformFeeCents: integer("platform_fee_cents").default(0),
  netAmountCents: integer("net_amount_cents").default(0),
  relatedGiftId: integer("related_gift_id"),
  balanceAfterCents: integer("balance_after_cents").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  artist: one(artistProfiles, {
    fields: [walletTransactions.artistId],
    references: [artistProfiles.id],
  }),
}));

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({
  id: true,
  createdAt: true,
});

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;

export const TRANSACTION_TYPES = ["gift_received", "subscription_income", "payout", "platform_fee", "adjustment"] as const;
export type TransactionType = typeof TRANSACTION_TYPES[number];

export const artistProfileLikes = pgTable("artist_profile_likes", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull().references(() => artistProfiles.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertArtistProfileLikeSchema = createInsertSchema(artistProfileLikes).omit({
  id: true,
  createdAt: true,
});

export type ArtistProfileLike = typeof artistProfileLikes.$inferSelect;
export type InsertArtistProfileLike = z.infer<typeof insertArtistProfileLikeSchema>;

export const artistProfileComments = pgTable("artist_profile_comments", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull().references(() => artistProfiles.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  userName: text("user_name").default("Fan"),
  userAvatarUrl: text("user_avatar_url"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertArtistProfileCommentSchema = createInsertSchema(artistProfileComments).omit({
  id: true,
  createdAt: true,
});

export type ArtistProfileComment = typeof artistProfileComments.$inferSelect;
export type InsertArtistProfileComment = z.infer<typeof insertArtistProfileCommentSchema>;

export const artistProfileShares = pgTable("artist_profile_shares", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull().references(() => artistProfiles.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  platform: text("platform").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertArtistProfileShareSchema = createInsertSchema(artistProfileShares).omit({
  id: true,
  createdAt: true,
});

export type ArtistProfileShare = typeof artistProfileShares.$inferSelect;
export type InsertArtistProfileShare = z.infer<typeof insertArtistProfileShareSchema>;

// === COPYRIGHT & PUBLISHING HUB ===

export const WORK_TYPES = ["composition", "sound_recording", "both"] as const;
export type WorkType = typeof WORK_TYPES[number];

export const REGISTRATION_STATUSES = ["draft", "pending", "submitted", "registered", "rejected"] as const;
export type RegistrationStatus = typeof REGISTRATION_STATUSES[number];

export const CONTRIBUTOR_ROLES = ["writer", "composer", "lyricist", "arranger", "publisher", "admin_publisher"] as const;
export type ContributorRole = typeof CONTRIBUTOR_ROLES[number];

export const copyrightWorks = pgTable("copyright_works", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  songId: integer("song_id").references(() => songs.id, { onDelete: "set null" }),
  artistProfileId: integer("artist_profile_id").references(() => artistProfiles.id, { onDelete: "set null" }),
  workType: text("work_type").notNull().default("both"),
  title: text("title").notNull(),
  alternativeTitles: text("alternative_titles"),
  language: text("language").default("es"),
  genre: text("genre"),
  copyrightDate: timestamp("copyright_date"),
  copyrightYear: integer("copyright_year"),
  duration: integer("duration"),
  isrc: text("isrc"),
  iswc: text("iswc"),
  upc: text("upc"),
  hfaSongCode: text("hfa_song_code"),
  status: text("status").notNull().default("draft"),
  proEntity: text("pro_entity"),
  externalRegistrationId: text("external_registration_id"),
  publisherName: text("publisher_name").default("ODGMUSIC LATIN WORLDWIDE PUBLISHING"),
  publisherIpi: text("publisher_ipi"),
  publisherShare: real("publisher_share").default(50),
  notes: text("notes"),
  exportData: jsonb("export_data").$type<Record<string, any>>(),
  submittedAt: timestamp("submitted_at"),
  registeredAt: timestamp("registered_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const copyrightWorksRelations = relations(copyrightWorks, ({ one, many }) => ({
  song: one(songs, {
    fields: [copyrightWorks.songId],
    references: [songs.id],
  }),
  artist: one(artistProfiles, {
    fields: [copyrightWorks.artistProfileId],
    references: [artistProfiles.id],
  }),
  contributors: many(copyrightContributors),
}));

export const insertCopyrightWorkSchema = createInsertSchema(copyrightWorks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CopyrightWork = typeof copyrightWorks.$inferSelect;
export type InsertCopyrightWork = z.infer<typeof insertCopyrightWorkSchema>;

export const copyrightContributors = pgTable("copyright_contributors", {
  id: serial("id").primaryKey(),
  workId: integer("work_id").notNull().references(() => copyrightWorks.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull().default("writer"),
  ipiNumber: text("ipi_number"),
  proEntity: text("pro_entity"),
  share: real("share").notNull().default(0),
  isControlled: boolean("is_controlled").default(false),
  publisherName: text("publisher_name"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const copyrightContributorsRelations = relations(copyrightContributors, ({ one }) => ({
  work: one(copyrightWorks, {
    fields: [copyrightContributors.workId],
    references: [copyrightWorks.id],
  }),
}));

export const insertCopyrightContributorSchema = createInsertSchema(copyrightContributors).omit({
  id: true,
  createdAt: true,
});

export type CopyrightContributor = typeof copyrightContributors.$inferSelect;
export type InsertCopyrightContributor = z.infer<typeof insertCopyrightContributorSchema>;

export const publisherEntities = pgTable("publisher_entities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ipiNumber: text("ipi_number"),
  proEntity: text("pro_entity"),
  isDefault: boolean("is_default").default(false),
  contactEmail: text("contact_email"),
  website: text("website"),
  address: text("address"),
  country: text("country"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPublisherEntitySchema = createInsertSchema(publisherEntities).omit({
  id: true,
  createdAt: true,
});

export type PublisherEntity = typeof publisherEntities.$inferSelect;
export type InsertPublisherEntity = z.infer<typeof insertPublisherEntitySchema>;
