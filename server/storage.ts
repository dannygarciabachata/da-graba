import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { 
  songs, lyrics, quizResults, tracks,
  type Song, type InsertSong, 
  type Lyric, type InsertLyric,
  type QuizResult, type InsertQuizResult,
  type Track, type InsertTrack
} from "@shared/schema";

export { authStorage } from "./replit_integrations/auth/storage";
export { chatStorage } from "./replit_integrations/chat/storage";

export interface IStorage {
  createSong(song: InsertSong): Promise<Song>;
  getSong(id: number): Promise<Song | undefined>;
  getUserSongs(userId: string): Promise<Song[]>;
  updateSongStatus(id: number, status: string, audioUrl?: string, error?: string): Promise<Song>;
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

  async updateSongStatus(id: number, status: string, audioUrl?: string, error?: string): Promise<Song> {
    const [updated] = await db
      .update(songs)
      .set({ status, audioUrl, error })
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
}

export const storage = new DatabaseStorage();
