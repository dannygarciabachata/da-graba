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
  pairId: text("pair_id"),
  variationLabel: text("variation_label"),
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
  "audio_cut",
  "lyrics_generation",
  "image_generation",
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
