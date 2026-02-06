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
  userId: text("user_id").notNull(), // Links to Replit Auth user ID
  title: text("title").notNull().default("Untitled Track"),
  prompt: text("prompt").notNull(),
  audioUrl: text("audio_url"),
  imageUrl: text("image_url"),
  duration: integer("duration"), // in seconds
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  error: text("error"),
  isPublic: boolean("is_public").default(false),
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

// === EXPLICIT API CONTRACT TYPES ===

// Base types
export type Song = typeof songs.$inferSelect;
export type InsertSong = z.infer<typeof insertSongSchema>;
export type Lyric = typeof lyrics.$inferSelect;
export type InsertLyric = z.infer<typeof insertLyricsSchema>;

// Request types
export type GenerateSongRequest = {
  prompt: string;
  isBachata?: boolean; // If true, force bachata prompt injection
};

export type GenerateLyricsRequest = {
  theme: string;
  style?: "romantic" | "dance" | "heartbreak";
};

// Response types
export type SongResponse = Song;
export type LyricResponse = Lyric;

