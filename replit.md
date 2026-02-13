# DGB Audio - Heart Mula Music Engine

## Overview
AI-powered music generation SaaS platform by Danny Garcia. The "Heart Mula" engine uses a **generic, API-agnostic architecture** where any API provider can be configured via the Admin Panel. Default provider is MusicGPT for all audio operations. OpenAI handles lyrics writing. Supports 20+ music genres. Uses webhook-based architecture for efficient async processing. Includes Stripe subscription billing, comprehensive admin dashboard, and AI support chatbot.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + Shadcn UI
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL (Neon-backed via Replit)
- **Auth**: Replit Auth (OpenID Connect)
- **Payments**: Stripe via stripe-replit-sync (products, subscriptions, checkout, customer portal)
- **API System**: Generic API engine with DB-driven provider configuration (api_providers + api_endpoints tables)
- **Default Music AI**: MusicGPT (auto-seeded, all audio operations)
- **Lyrics AI**: OpenAI via Replit AI Integrations (GPT-5.1)
- **Support AI**: OpenAI-powered chatbot with platform knowledge
- **Admin Panel**: Owner-only UI for managing users, subscriptions, API providers, endpoints, and platform stats

## Generic API Provider System
The system is API-agnostic. All audio operations route through a generic engine that:
1. Checks DB for an active provider+endpoint matching the operation type
2. If found, uses the generic engine with dynamic auth, request mapping, and response extraction
3. If not found, falls back to hardcoded MusicGPT engine
4. Supports any API provider with configurable: auth (raw/bearer/header/query/none), request mapping ($param, @env:VAR), response extraction (dot-path), async patterns (polling/webhook/none)

### DB Tables
- **api_providers**: name, baseUrl, authType, authHeaderName, apiKeyValue/apiKeyEnvVar, category, isActive, defaultHeaders, description
- **api_endpoints**: providerId, name, operationType, path, method, contentType, requestMapping, responseMapping, pollPath, pollResponseMapping, conversionType, asyncPattern, webhookSupported, isActive

### Operation Types
music_generation, stem_separation, remix, mastering, denoise, key_bpm, cover, voice_change, audio_cut, lyrics_generation, image_generation

### Provider Categories
music, lyrics, image, audio_processing, voice

## Core Engines (server/core/)
- **generic_api_engine.ts** - API-agnostic engine: dynamic auth, request mapping, response extraction, submit/poll/download for ANY configured provider
- **musicgpt_engine.ts** - MusicGPT-specific API client (fallback when no generic provider configured)
- **seed_providers.ts** - Auto-seeds default MusicGPT provider with all 8 endpoints on first run
- **prompt_engine.ts** - Lyrics system prompts (romantic/dance/heartbreak), structured JSON config generation, style kit prompt builder
- **antigravity_engine.ts** - Creative AI engine for lyrics and full arrangement configs via OpenAI
- **quiz_engine.ts** - Bachata knowledge quiz system (static bank + AI-generated questions)
- **stems_engine.ts** - AI stem separation (uses generic engine with MusicGPT fallback)

## Workers (server/workers/)
- **music_tasks.ts** - Background async music generation (generic engine → MusicGPT fallback)
- **sample_tasks.ts** - Background workers: Remix, Key/BPM, Mastering, Denoise, Cover, Audio Cut (all use generic engine → MusicGPT fallback)

## Key Features
- "Heart Mula" branded music engine with style presets selector
- **Admin Panel**: Owner-only API provider management with providers/endpoints tabs, test connection, Zod-validated CRUD
- **Style Kits**: User-browsable library of custom instrument kits by Latin genre, with WAV/MP3 instrument audio upload and preview, integrated into music generation prompt engine
- Dual generation modes: Aggregate (quick title+genre+style) and Standard (detailed prompt)
- Bachata Mode auto-detection (keywords like "bachata", "bongo", "guira" auto-force Dominican instruments)
- 6 style presets: Heart Mula Signature, Romantic, Dance, Bolero, Trio Serenade, Bachata Urbana
- CreatePage with genre cards (20+ genres), pro controls, prompt/lyrics intensity sliders
- Multitrack Studio: AI stem separation splits songs into Vocals, Drums, Bass, Melody
- Studio AI Tools: Master, Denoise, AI Cover, Audio Cutter
- Individual track controls: volume, mute, solo per stem with waveform visualization
- AI lyrics generator (romantic, dance, heartbreak styles) with Frank Reyes/Romeo Santos influences
- Bachata Quiz with 10-question knowledge bank
- Waveform audio player (wavesurfer.js)
- Song history with polling for processing status
- Mobile-first responsive design with bottom tab navigation
- User authentication via Replit Auth
- Sample Lab: Audio recording, file upload, AI Remix transformation, Key/BPM detection

## Layout Architecture
- **Left Sidebar**: Shadcn sidebar with nav (Create, Library, Lyrics, Quiz, Studio, Sample Lab), Admin section (if admin), user profile, DGB branding
- **Main Content Area**: Full-width page content for each route
- **Admin Page**: Providers/Endpoints tabs with CRUD forms, test connection, JSON mapping editors

## Project Structure
```
client/src/
  App.tsx                        - Root with SidebarProvider layout for authenticated users
  components/app-sidebar.tsx     - Shadcn sidebar with navigation, admin section, & user profile
  pages/Landing.tsx              - Landing page with Heart Mula branding
  pages/CreatePage.tsx           - Suno-style music creation (Simple/Custom modes)
  pages/LibraryPage.tsx          - Song library with inline player
  pages/LyricsPage.tsx           - Lyrics generation page
  pages/QuizPage.tsx             - Bachata quiz page
  pages/Studio.tsx               - Multitrack studio with stem separation + AI tools
  pages/SampleLab.tsx            - Sample Lab with recording, upload, AI Remix, Key/BPM detection
  pages/AdminPage.tsx            - Admin panel for API provider/endpoint management + style kits
  pages/StyleKitsPage.tsx        - User-facing style kit browser with instrument preview
  pages/PricingPage.tsx          - Subscription plans and checkout
  components/AudioPlayer.tsx     - Waveform player
  components/SongHistory.tsx     - Track history list with Studio link
  components/BachataQuiz.tsx     - Interactive Bachata quiz
  components/SupportChat.tsx     - AI-powered support chatbot
  hooks/use-songs.ts             - Song CRUD hooks
  hooks/use-tracks.ts            - Track/stem hooks + mastering, denoise, cover mutations
  hooks/use-lyrics.ts            - Lyrics generation hook
  hooks/use-samples.ts           - Sample Lab hooks + Key/BPM detection mutation
  hooks/use-admin.ts             - Admin panel hooks (providers, endpoints CRUD, test)
  hooks/use-style-kits.ts        - Style kit data fetching and admin mutations
  hooks/use-auth.ts              - Auth state hook

server/
  core/
    generic_api_engine.ts        - API-agnostic engine: submit/poll/download with dynamic config
    musicgpt_engine.ts           - MusicGPT-specific API client (fallback)
    seed_providers.ts            - Auto-seed default MusicGPT provider config
    prompt_engine.ts             - Versioned prompts & structured config
    antigravity_engine.ts        - Creative AI (lyrics + arrangements)
    quiz_engine.ts               - Quiz logic & question bank
    stems_engine.ts              - AI stem separation (generic + MusicGPT fallback)
  workers/
    music_tasks.ts               - Background music generation (generic + MusicGPT fallback)
    sample_tasks.ts              - Background workers: Remix, Key/BPM, Mastering, Denoise, Cover, Audio Cut
  routes.ts                      - API routes (music, lyrics, quiz, tracks, samples, audio tools, admin, auth)
  storage.ts                     - Database storage layer (IStorage interface + provider/endpoint CRUD)
  db.ts                          - Database connection
  replit_integrations/           - Auth, chat modules

shared/
  schema.ts                      - Drizzle schema (songs, tracks, lyrics, quiz_results, samples, api_providers, api_endpoints, users, sessions, style_kits, style_kit_instruments)
  routes.ts                      - API contract with Zod validation
```

## Theme
- Premium Dark Mode
- Background: #121212 (Carbon Black)
- Primary: #00F3FF (Neon Blue)
- Secondary: #C0C0C0 (Silver)
- Font: Inter + JetBrains Mono

## API Endpoints

### Music
- `POST /api/songs/generate` - Generate music (generic engine → MusicGPT fallback)
- `POST /api/webhooks/musicgpt` - Webhook receiver for async completion
- `GET /api/songs` - List user's songs
- `GET /api/songs/:id` - Get single song
- `DELETE /api/songs/:id` - Delete song
- `POST /api/songs/:id/stems` - Trigger AI stem separation
- `POST /api/songs/:id/master` - AI audio mastering
- `POST /api/songs/:id/denoise` - AI noise removal
- `POST /api/songs/:id/cover` - AI cover song with voice change
- `POST /api/songs/:id/trim` - Audio Cutter trim
- `GET /api/songs/:id/tracks` - Get tracks/stems for a song
- `GET /api/tracks` - List all user's tracks
- `PATCH /api/tracks/:id` - Update track settings

### Lyrics & Quiz
- `POST /api/lyrics/generate` - Generate lyrics via Heart Mula AI
- `GET /api/quiz` - Get random quiz questions
- `POST /api/quiz/submit` - Submit quiz answers
- `GET /api/quiz/results` - Get user's quiz history
- `GET /api/quiz/styles` - List available music style presets

### Sample Lab
- `GET /api/samples` - List user's samples
- `POST /api/samples/upload` - Upload audio file
- `POST /api/samples/record` - Save browser recording
- `POST /api/samples/transform` - AI Remix transform
- `POST /api/samples/:id/key-bpm` - AI Key/BPM detection
- `DELETE /api/samples/:id` - Delete sample
- `PATCH /api/samples/:id` - Update sample metadata

### Style Kits
- `GET /api/style-kits` - List all active style kits with instruments
- `GET /api/style-kits/meta` - Get available genres and instrument types
- `GET /api/style-kits/:id` - Get single style kit with instruments
- `POST /api/style-kits` - Create style kit (admin only)
- `PATCH /api/style-kits/:id` - Update style kit (admin only)
- `DELETE /api/style-kits/:id` - Delete style kit + instruments (admin only)
- `GET /api/style-kits/:kitId/instruments` - List instruments for a kit
- `POST /api/style-kits/:kitId/instruments` - Upload instrument audio file (admin only)
- `PATCH /api/style-kits/instruments/:id` - Update instrument (admin only)
- `DELETE /api/style-kits/instruments/:id` - Delete instrument (admin only)

### Admin (owner-only, requires ADMIN_USER_ID env var)
- `GET /api/admin/check` - Check if current user is admin
- `GET /api/admin/meta` - Get operation types, categories, auth types
- `GET /api/admin/providers` - List all API providers
- `GET /api/admin/providers/:id` - Get single provider
- `POST /api/admin/providers` - Create provider (Zod validated)
- `PATCH /api/admin/providers/:id` - Update provider (Zod validated)
- `DELETE /api/admin/providers/:id` - Delete provider + endpoints
- `GET /api/admin/endpoints` - List endpoints (?providerId=)
- `GET /api/admin/endpoints/:id` - Get single endpoint
- `POST /api/admin/endpoints` - Create endpoint (Zod validated)
- `PATCH /api/admin/endpoints/:id` - Update endpoint (Zod validated)
- `DELETE /api/admin/endpoints/:id` - Delete endpoint
- `POST /api/admin/endpoints/:id/test` - Test endpoint connection

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection
- `MUSICGPT_API_KEY` - MusicGPT API key (default provider for audio AI)
- `ADMIN_USER_ID` - Replit user ID for admin panel access (required for admin features)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Auto-configured by Replit
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Auto-configured by Replit
- `SESSION_SECRET` - Session encryption
- `ELEVENLABS_API_KEY` - (legacy, unused)
- `MUREKA_API_KEY` - (legacy, unused)
- `REPLICATE_API_TOKEN` - (legacy, unused)
- `HF_TOKEN` - (legacy, unused)
