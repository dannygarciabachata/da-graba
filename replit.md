# DGB Audio - Heart Mula Music Engine

## Overview
AI-powered music generation platform tailored for Bachata music by Danny Garcia. The "Heart Mula" engine uses ElevenLabs Music (primary, full songs with vocals), Mureka AI (secondary), and Replicate (fallback, instrumental) for music generation, and OpenAI (GPT-5.1) for lyrics writing, with a structured prompt system for authentic Dominican Bachata sound.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + Shadcn UI
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL (Neon-backed via Replit)
- **Auth**: Replit Auth (OpenID Connect)
- **Music AI**: ElevenLabs Music (primary, full songs with vocals) → Mureka AI (secondary) → Replicate (fallback, instrumental)
- **Lyrics AI**: OpenAI via Replit AI Integrations (GPT-5.1)

## Core Engines (server/core/)
- **prompt_engine.ts** - Versioned music prompts (Heart Mula, Romantic, Dance, Bolero, Urbana, Serenade), lyrics system prompts, structured JSON config generation
- **elevenlabs_engine.ts** - ElevenLabs Music client (direct audio generation, Bachata prompts & lyrics)
- **mureka_engine.ts** - Mureka AI client (song generation, async polling, Bachata lyrics templates)
- **music_engine.ts** - Multi-provider orchestrator
- **antigravity_engine.ts** - Creative AI engine for lyrics and full arrangement configs via OpenAI
- **quiz_engine.ts** - Bachata knowledge quiz system (static bank + AI-generated questions)

## Workers (server/workers/)
- **music_tasks.ts** - Background async music generation: OpenAI creates lyrics + enhanced prompt, then ElevenLabs → Mureka → Replicate for audio

## Key Features
- "Heart Mula" branded music engine with style presets selector
- Bachata Mode auto-detection (keywords like "bachata", "bongo", "guira" auto-force Dominican instruments)
- 6 style presets: Heart Mula Signature, Romantic, Dance, Bolero, Trio Serenade, Bachata Urbana
- AI lyrics generator (romantic, dance, heartbreak styles) with Frank Reyes/Romeo Santos influences
- Bachata Quiz with 10-question knowledge bank (history, instruments, artists, rhythm, culture)
- Waveform audio player (wavesurfer.js)
- Song history with polling for processing status
- User authentication via Replit Auth

## Project Structure
```
client/src/
  pages/Landing.tsx              - Landing page with Heart Mula branding
  pages/Dashboard.tsx            - Main dashboard with Lyrics/Quiz tabs
  components/MusicGenerator.tsx  - Heart Mula music generation panel
  components/LyricsGenerator.tsx - Lyrics AI editor
  components/AudioPlayer.tsx     - Waveform player
  components/SongHistory.tsx     - Track history list
  components/BachataQuiz.tsx     - Interactive Bachata quiz
  hooks/use-songs.ts             - Song CRUD hooks
  hooks/use-lyrics.ts            - Lyrics generation hook
  hooks/use-auth.ts              - Auth state hook

server/
  core/
    prompt_engine.ts             - Versioned prompts & structured config
    music_engine.ts              - MusicGen wrapper
    antigravity_engine.ts        - Creative AI (lyrics + arrangements)
    quiz_engine.ts               - Quiz logic & question bank
  workers/
    music_tasks.ts               - Background music generation
  routes.ts                      - API routes (music, lyrics, quiz, auth)
  storage.ts                     - Database storage layer (IStorage interface)
  db.ts                          - Database connection
  replit_integrations/           - Auth, chat modules

shared/
  schema.ts                      - Drizzle schema (songs, lyrics, quiz_results, users, sessions)
  routes.ts                      - API contract with Zod validation
```

## Theme
- Premium Dark Mode
- Background: #121212 (Carbon Black)
- Primary: #00F3FF (Neon Blue)
- Secondary: #C0C0C0 (Silver)
- Font: Inter + JetBrains Mono

## API Endpoints
- `POST /api/songs/generate` - Generate music (ElevenLabs primary, Mureka secondary, Replicate fallback; supports style, duration, lyrics, auto-bachata detection)
- `GET /api/songs` - List user's songs
- `GET /api/songs/:id` - Get single song
- `DELETE /api/songs/:id` - Delete song
- `POST /api/lyrics/generate` - Generate lyrics via Heart Mula AI
- `GET /api/quiz` - Get random quiz questions (supports ?category=&count=)
- `POST /api/quiz/submit` - Submit quiz answers (validated with Zod)
- `GET /api/quiz/results` - Get user's quiz history
- `GET /api/quiz/styles` - List available music style presets

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection
- `ELEVENLABS_API_KEY` - ElevenLabs API key (primary music generation, requires paid plan)
- `MUREKA_API_KEY` - Mureka AI API key (secondary music generation)
- `REPLICATE_API_TOKEN` - Replicate API key (fallback music generation)
- `HF_TOKEN` - Hugging Face token (unused fallback)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Auto-configured by Replit
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Auto-configured by Replit
- `SESSION_SECRET` - Session encryption
