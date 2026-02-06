import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { 
  songs, lyrics, 
  type Song, type InsertSong, 
  type Lyric, type InsertLyric 
} from "@shared/schema";

// Re-export auth/chat storage
export { authStorage } from "./replit_integrations/auth/storage";
export { chatStorage } from "./replit_integrations/chat/storage";

export interface IStorage {
  // Songs
  createSong(song: InsertSong): Promise<Song>;
  getSong(id: number): Promise<Song | undefined>;
  getUserSongs(userId: string): Promise<Song[]>;
  updateSongStatus(id: number, status: string, audioUrl?: string, error?: string): Promise<Song>;
  deleteSong(id: number): Promise<void>;

  // Lyrics
  createLyric(lyric: InsertLyric): Promise<Lyric>;
  getLyricsBySongId(songId: number): Promise<Lyric[]>;
}

export class DatabaseStorage implements IStorage {
  // Songs
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
      .set({ 
        status, 
        audioUrl, 
        error 
      })
      .where(eq(songs.id, id))
      .returning();
    return updated;
  }

  async deleteSong(id: number): Promise<void> {
    await db.delete(songs).where(eq(songs.id, id));
  }

  // Lyrics
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
}

export const storage = new DatabaseStorage();
