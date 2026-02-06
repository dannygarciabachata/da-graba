import { z } from 'zod';
import { insertSongSchema, insertLyricsSchema, songs, lyrics } from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  songs: {
    list: {
      method: 'GET' as const,
      path: '/api/songs',
      responses: {
        200: z.array(z.custom<typeof songs.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/songs/:id',
      responses: {
        200: z.custom<typeof songs.$inferSelect>(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    generate: {
      method: 'POST' as const,
      path: '/api/songs/generate',
      input: z.object({
        prompt: z.string().min(3),
        isBachata: z.boolean().default(true),
      }),
      responses: {
        202: z.custom<typeof songs.$inferSelect>(), // Accepted/Processing
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/songs/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
  },
  lyrics: {
    generate: {
      method: 'POST' as const,
      path: '/api/lyrics/generate',
      input: z.object({
        theme: z.string().min(3),
        style: z.enum(["romantic", "dance", "heartbreak"]).default("romantic"),
      }),
      responses: {
        200: z.custom<typeof lyrics.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },
};

// ============================================
// REQUIRED: buildUrl helper
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// ============================================
// TYPE HELPERS
// ============================================
export type SongInput = z.infer<typeof api.songs.generate.input>;
export type LyricInput = z.infer<typeof api.lyrics.generate.input>;
