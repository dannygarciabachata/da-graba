# DGB Audio - Danny Garcia Bachata

## Overview
AI-powered music generation platform tailored for Bachata music. Uses Replicate (meta/musicgen-large) for music generation and OpenAI (GPT-5.1) for lyrics writing.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + Shadcn UI
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL (Neon-backed via Replit)
- **Auth**: Replit Auth (OpenID Connect)
- **Music AI**: Replicate API (meta/musicgen-large)
- **Lyrics AI**: OpenAI via Replit AI Integrations (GPT-5.1)

## Key Features
- Music generation with "Bachata Mode" that forces Dominican-style instruments
- AI lyrics generator (romantic, dance, heartbreak styles)
- Waveform audio player (wavesurfer.js)
- Song history with polling for processing status
- User authentication via Replit Auth

## Project Structure
```
client/src/
  pages/Landing.tsx       - Landing page with hero
  pages/Dashboard.tsx     - Main dashboard (auth required)
  components/MusicGenerator.tsx  - Music generation panel
  components/LyricsGenerator.tsx - Lyrics AI editor
  components/AudioPlayer.tsx     - Waveform player
  components/SongHistory.tsx     - Track history list
  hooks/use-songs.ts     - Song CRUD hooks
  hooks/use-lyrics.ts    - Lyrics generation hook
  hooks/use-auth.ts      - Auth state hook

server/
  routes.ts              - API routes (songs, lyrics, auth)
  storage.ts             - Database storage layer
  db.ts                  - Database connection
  replit_integrations/   - Auth, chat, audio, image modules

shared/
  schema.ts              - Drizzle schema (songs, lyrics, users, sessions)
  routes.ts              - API contract with Zod validation
```

## Theme
- Premium Dark Mode
- Background: #121212 (Carbon Black)
- Primary: #00F3FF (Neon Blue)
- Secondary: #C0C0C0 (Silver)
- Font: Inter + JetBrains Mono

## API Endpoints
- `POST /api/songs/generate` - Generate music via Replicate
- `GET /api/songs` - List user's songs
- `GET /api/songs/:id` - Get single song
- `DELETE /api/songs/:id` - Delete song
- `POST /api/lyrics/generate` - Generate lyrics via OpenAI

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection
- `REPLICATE_API_TOKEN` - Replicate API key
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Auto-configured by Replit
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Auto-configured by Replit
- `SESSION_SECRET` - Session encryption
