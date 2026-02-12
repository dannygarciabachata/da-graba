# DGB Audio - Heart Mula Music Engine

## Overview
AI-powered music generation platform by Danny Garcia. The "Heart Mula" engine uses MusicGPT as the exclusive AI provider for all audio operations (generation, stem extraction, remix, mastering, denoise, key/BPM detection, cover songs), and OpenAI for lyrics writing. Supports 20+ music genres from MusicGPT's native style list. Uses webhook-based architecture for efficient async processing.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + Shadcn UI
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL (Neon-backed via Replit)
- **Auth**: Replit Auth (OpenID Connect)
- **Music AI**: MusicGPT (exclusive provider for all audio: /MusicAI, /Extraction, /Remix, /AudioMastering, /Denoise, /KeyBPMExtraction, /Cover)
- **Lyrics AI**: OpenAI via Replit AI Integrations (GPT-5.1)

## Core Engines (server/core/)
- **musicgpt_engine.ts** - MusicGPT API client with generic submit/poll helpers for all endpoints (MusicAI, Extraction, Remix, AudioMastering, Denoise, KeyBPMExtraction, Cover), file download utility, URL resolver, webhook URL helper
- **prompt_engine.ts** - Lyrics system prompts (romantic/dance/heartbreak), structured JSON config generation
- **antigravity_engine.ts** - Creative AI engine for lyrics and full arrangement configs via OpenAI
- **quiz_engine.ts** - Bachata knowledge quiz system (static bank + AI-generated questions)
- **stems_engine.ts** - AI stem separation using MusicGPT /Extraction (splits songs into vocals, drums, bass, other)

## Workers (server/workers/)
- **music_tasks.ts** - Background async music generation via MusicGPT /MusicAI
- **sample_tasks.ts** - MusicGPT-powered workers: Remix (humming-to-music transform), Key/BPM detection, Mastering, Denoise, Cover song generation

## Key Features
- "Heart Mula" branded music engine with style presets selector
- Dual generation modes: Aggregate (quick title+genre+style) and Standard (detailed prompt)
- Bachata Mode auto-detection (keywords like "bachata", "bongo", "guira" auto-force Dominican instruments)
- 6 style presets: Heart Mula Signature, Romantic, Dance, Bolero, Trio Serenade, Bachata Urbana
- MusicGPT-inspired CreatePage with genre cards (20+ genres), pro controls, prompt/lyrics intensity sliders
- Multitrack Studio: AI stem separation (MusicGPT Extraction) splits songs into Vocals, Drums, Bass, Melody
- Studio AI Tools: Master (professional audio mastering), Denoise (noise removal), AI Cover (voice change)
- Individual track controls: volume, mute, solo per stem with waveform visualization
- AI lyrics generator (romantic, dance, heartbreak styles) with Frank Reyes/Romeo Santos influences
- Bachata Quiz with 10-question knowledge bank (history, instruments, artists, rhythm, culture)
- Waveform audio player (wavesurfer.js)
- Song history with polling for processing status
- Mobile-first responsive design with bottom tab navigation
- User authentication via Replit Auth
- Sample Lab: Audio recording, file upload, AI Remix transformation, Key/BPM detection, clip timeline, transport controls

## Layout Architecture (Suno-inspired)
- **Left Sidebar**: Shadcn sidebar with nav (Create, Library, Lyrics, Quiz, Studio, Sample Lab), user profile, DGB branding
- **Main Content Area**: Full-width page content for each route
- **Create Page**: Centered Suno-style prompt with Simple/Custom toggle, style preset badges, recent creations grid
- **Library Page**: Song list feed with inline player
- **Studio Page**: Song selector + stem separation + AI tools (Master, Denoise, Cover)
- **Sample Lab**: Record/Upload/Transform tabs + Key/BPM detection
- **Landing**: Public landing page for unauthenticated users

## Project Structure
```
client/src/
  App.tsx                        - Root with SidebarProvider layout for authenticated users
  components/app-sidebar.tsx     - Shadcn sidebar with navigation & user profile
  pages/Landing.tsx              - Landing page with Heart Mula branding
  pages/CreatePage.tsx           - Suno-style music creation (Simple/Custom modes)
  pages/LibraryPage.tsx          - Song library with inline player
  pages/LyricsPage.tsx           - Lyrics generation page
  pages/QuizPage.tsx             - Bachata quiz page
  pages/Studio.tsx               - Multitrack studio with stem separation + AI tools (Master, Denoise, Cover)
  pages/SampleLab.tsx            - Sample Lab with recording, upload, AI Remix, Key/BPM detection, timeline
  pages/Dashboard.tsx            - (legacy, redirects to /create)
  components/AudioPlayer.tsx     - Waveform player
  components/SongHistory.tsx     - Track history list with Studio link
  components/BachataQuiz.tsx     - Interactive Bachata quiz
  hooks/use-songs.ts             - Song CRUD hooks
  hooks/use-tracks.ts            - Track/stem hooks + mastering, denoise, cover mutations
  hooks/use-lyrics.ts            - Lyrics generation hook
  hooks/use-samples.ts           - Sample Lab hooks + Key/BPM detection mutation
  hooks/use-auth.ts              - Auth state hook

server/
  core/
    musicgpt_engine.ts           - MusicGPT API: generic submit/poll for all endpoints + download + URL resolve
    prompt_engine.ts             - Versioned prompts & structured config
    antigravity_engine.ts        - Creative AI (lyrics + arrangements)
    quiz_engine.ts               - Quiz logic & question bank
    stems_engine.ts              - AI stem separation (MusicGPT Extraction)
  workers/
    music_tasks.ts               - Background music generation (MusicGPT MusicAI)
    sample_tasks.ts              - Background workers: Remix, Key/BPM, Mastering, Denoise, Cover
  routes.ts                      - API routes (music, lyrics, quiz, tracks, samples, audio tools, auth)
  storage.ts                     - Database storage layer (IStorage interface)
  db.ts                          - Database connection
  replit_integrations/           - Auth, chat modules

shared/
  schema.ts                      - Drizzle schema (songs, tracks, lyrics, quiz_results, samples, users, sessions)
  routes.ts                      - API contract with Zod validation
```

## Theme
- Premium Dark Mode
- Background: #121212 (Carbon Black)
- Primary: #00F3FF (Neon Blue)
- Secondary: #C0C0C0 (Silver)
- Font: Inter + JetBrains Mono

## API Endpoints
- `POST /api/songs/generate` - Generate music (MusicGPT exclusive; supports style, duration, lyrics, auto-bachata detection)
- `POST /api/webhooks/musicgpt` - Webhook receiver for MusicGPT async completion (no auth, matches by task_id)
- `GET /api/songs` - List user's songs
- `GET /api/songs/:id` - Get single song
- `DELETE /api/songs/:id` - Delete song
- `POST /api/songs/:id/stems` - Trigger AI stem separation (MusicGPT Extraction) for a completed song
- `POST /api/songs/:id/master` - AI audio mastering (MusicGPT AudioMastering)
- `POST /api/songs/:id/denoise` - AI noise removal (MusicGPT Denoise)
- `POST /api/songs/:id/cover` - AI cover song with voice change (MusicGPT Cover, body: {voiceDescription})
- `GET /api/songs/:id/tracks` - Get individual tracks/stems for a song
- `GET /api/tracks` - List all user's tracks
- `PATCH /api/tracks/:id` - Update track settings (volume, mute, solo)
- `POST /api/lyrics/generate` - Generate lyrics via Heart Mula AI
- `GET /api/quiz` - Get random quiz questions (supports ?category=&count=)
- `POST /api/quiz/submit` - Submit quiz answers (validated with Zod)
- `GET /api/quiz/results` - Get user's quiz history
- `GET /api/quiz/styles` - List available music style presets
- `GET /api/samples` - List user's samples
- `POST /api/samples/upload` - Upload audio file (multipart/form-data with multer)
- `POST /api/samples/record` - Save browser recording (base64 audio data)
- `POST /api/samples/transform` - AI Remix transform (MusicGPT Remix)
- `POST /api/samples/:id/key-bpm` - AI Key/BPM detection (MusicGPT KeyBPMExtraction)
- `DELETE /api/samples/:id` - Delete sample (also removes audio file)
- `PATCH /api/samples/:id` - Update sample metadata (name, bpm, key, position)

## MusicGPT API Pattern
All MusicGPT endpoints use async task-based processing:
1. Submit job → POST to /api/public/v1/{Endpoint} → receive task_id
2. Poll status → GET /api/public/v1/byId?task_id={id} → check status
3. On COMPLETED → download audio from returned URL → save locally
4. Authorization: raw API key in Authorization header (not Bearer)

For music generation (MusicAI), webhook-based flow is preferred:
1. Submit with webhook_url → receive task_id → store in songs.taskId
2. MusicGPT POSTs to /api/webhooks/musicgpt when complete
3. Webhook handler matches task_id → downloads audio → updates song status
4. Fallback poller runs as backup in case webhook fails

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection
- `MUSICGPT_API_KEY` - MusicGPT API key (exclusive provider for all audio AI operations)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Auto-configured by Replit
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Auto-configured by Replit
- `SESSION_SECRET` - Session encryption
- `ELEVENLABS_API_KEY` - (legacy, unused)
- `MUREKA_API_KEY` - (legacy, unused)
- `REPLICATE_API_TOKEN` - (legacy, unused)
- `HF_TOKEN` - (legacy, unused)
