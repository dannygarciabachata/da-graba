import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Import models from integrations
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
  style: text("style").default("bachata"), // romantic, dance, heartbreak
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
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

// === BASE SCHEMAS ===
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

// === TRACKS TABLE (Individual stems per song) ===
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

// === SAMPLES TABLE (Sample Lab) ===
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

// === EXPLICIT API CONTRACT TYPES ===

// Base types
export type Song = typeof songs.$inferSelect;
export type InsertSong = z.infer<typeof insertSongSchema>;
export type Lyric = typeof lyrics.$inferSelect;
export type InsertLyric = z.infer<typeof insertLyricsSchema>;
export type QuizResult = typeof quizResults.$inferSelect;
export type InsertQuizResult = z.infer<typeof insertQuizResultSchema>;

// Request types
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

// Response types
export type SongResponse = Song;
export type LyricResponse = Lyric;

