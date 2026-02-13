import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
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
