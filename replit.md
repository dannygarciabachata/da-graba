# DGB Studio

## Overview
DGB Studio is an AI-powered SaaS platform for music generation — "La Pura Sangre de la Bachata con el ADN de Danny Garcia y los Grandes Musicos Dominicanos." It uses RunPod Serverless GPU infrastructure, featuring a dual-engine system: HeartMuLa for songs with lyrics and vocals (including native Spanish support), and Stable Audio Open for instrumental-only tracks. Music generation and model training use RunPod Serverless endpoints, with OpenAI for lyrics and prompt enrichment. A key feature is custom model fine-tuning through "Style Kits," where users upload instruments for AI analysis and training on serverless GPU. The platform incorporates a comprehensive subscription model via Stripe, an admin dashboard, and an AI-driven support chatbot.

## User Preferences
I prefer clear and concise communication. For coding, I favor modular and maintainable solutions. I appreciate an iterative development approach with regular updates. Before implementing significant architectural changes or new external dependencies, please ask for my approval. I expect the agent to prioritize secure and scalable solutions.

## System Architecture
The "DGB AUDIO" music engine employs a microservices-oriented architecture.

**Frontend:**
- **Technology Stack:** React, Vite, TailwindCSS, Shadcn UI.
- **UI/UX Design:** Dark mode theme with deep purple background (`hsl 270 30% 7%`), neon cyan primary (`#00C8FF` / hsl 190 100% 50%), magenta/pink accents (`#D946EF` / hsl 300 76% 57%). Cyan-to-magenta gradients throughout. DGB Studio 2 transparent logo (h-16 with glow effects). Uses Inter and JetBrains Mono fonts. Mobile-first, responsive design.
- **Layout:** Left sidebar for navigation and controls, dynamic full-width main content area.
- **Key UI Components:** CreatePage (Suno-style music creation), LibraryPage (user songs, audio player), Studio (multitrack editor with AI stem separation, track controls, AI tools), Sample Lab (audio recording, upload, AI Remix, Key/BPM detection), AdminPage (owner-only management), Producer Store/Style Kits (user-browsable/uploadable instrument kits).

**Backend:**
- **Technology Stack:** Express.js (TypeScript).
- **Database:** PostgreSQL on Neon.
- **Authentication:** Replit Auth (OpenID Connect).
- **Admin Role System:** Role-based access control with `super_admin`, `admin`, `moderator`, `user` roles.
- **Payments:** Stripe integration for subscriptions.
- **Generic API Provider System:** API-agnostic engine (`generic_api_engine.ts`) for dynamic configuration of API providers via the Admin Panel, supporting various authentication, request/response patterns, and asynchronous operations (polling, webhooks). Includes a fallback mechanism to `musicgpt_engine.ts`.
- **AI Engines:**
    - **HeartMuLa (Primary):** 3B parameter model for full songs with vocals/lyrics, supports Spanish. Runs on private RunPod GPU.
    - **Stable Audio Open (Instrumental):** Secondary engine for instrumental generation. Supports fine-tuned models from Style Kits. Runs on private RunPod GPU.
    - **Kie.ai (Cloud API):** Cost-effective Suno V5 integration (~$0.06/song) for high-quality music generation with vocals. Priority 3 fallback after private GPU engines. Supports generation, extend, covers, and stem separation.
    - **DGB AUDIO Audio Engine:** MusicGPT-based fallback.
    - **OpenAI Integration:** Used for lyrics generation (GPT-5.1), support chatbot, and instrument prompt generation.
    - **SAO Training Pipeline:** Fine-tuning pipeline for custom instrument kits using OpenAI for prompts and cloud GPU for training.
    - **Antigravity Engine:** Leverages OpenAI for lyrics, arrangement, and prompt enrichment, translating user prompts into optimized English descriptions for music generation, including genre-specific mappings.
- **Stem Separation Engine:** Multi-tier fallback system: Private Cloud GPU (Demucs), Replicate serverless GPU (Demucs), Generic API providers, MusicGPT fallback. Produces vocals, drums, bass, and melody stems.
- **Workers:** Background workers for asynchronous processing of music generation and audio sample transformations.
- **Key Features:** DGB AUDIO branded engine with style presets, Bachata Mode (genre-specific instrument sounds), AI Lyrics Generator, Song History tracking.

## External Dependencies
- **HeartMuLa:** Self-hosted on private RunPod GPU for primary music generation.
- **Stable Audio Open:** Self-hosted on private RunPod GPU for instrumental music generation.
- **Replicate:** Used exclusively for serverless stem separation (Demucs model).
- **OpenAI:** Used for AI lyrics generation, support chatbot, and prompt enrichment/generation.
- **Neon (PostgreSQL):** Database hosting.
- **Stripe:** Payment gateway for subscriptions.
- **DGB Cloud Engine:** FastAPI/Uvicorn server on private cloud GPU for Producer Store instrument processing, audio analysis, and MIDI conversion.
- **Cloud GPU Server:** JupyterLab server on private cloud GPU for audio analysis, stem separation, and music generation.
- **Generic Cloud Server System:** Database-driven management of multiple GPU servers from various providers, allowing dynamic configuration and auto-selection.
- **Replit Auth:** User authentication.
- **Wavesurfer.js:** Frontend library for audio waveform visualization.

## GPU Infrastructure Notes
- **RunPod Device Fix:** GPU is assigned as `/dev/nvidia4` not `/dev/nvidia0`. All generation scripts create a symlink `/dev/nvidia0 -> /dev/nvidia4` at startup.
- **HeartMuse Integration:** HeartMuse (open-source HeartMuLa wrapper) installed at `/workspace/HeartMuse` with dedicated venv containing correct PyTorch 2.6.0+cu124.
- **Model Variant:** Uses HeartMuLa 3B-RL (reinforcement-learned) variant when available, falls back to base 3B.
- **Checkpoint Directories:** Scripts check `/workspace/HeartMuse/ckpt` first, then `/workspace/heartmula_ckpt` as fallback.
- **HeartMuse venv path:** `/workspace/HeartMuse/venv/lib/python3.11/site-packages` - added to sys.path in all generation scripts for correct PyTorch.

## Recent Changes
- **Feb 15, 2026:** Major GPU reliability overhaul - added RunPod device mapping fix (nvidia0 symlink), HeartMuse venv integration for correct PyTorch, 3B-RL model variant support, GPU memory cleanup in finally blocks, seed tracking for reproducibility.
- **Feb 15, 2026:** Updated diagnostics to report device mapping status, HeartMuse installation, and CUDA architecture list.
- **Feb 15, 2026:** Fixed song duration bug - default increased from 15s to 180s (3 min). Added duration selector in CreatePage Pro Controls (1:00, 2:00, 3:00, 4:00, 5:00). Backend clamps duration between 30-300s.
- **Feb 15, 2026:** Improved genre/rhythm adherence - enhanced HeartMuLa tags with BPM, time signature, and genre-specific instrument descriptors. Improved prompt enrichment system prompt to prioritize genre name and rhythm feel. Made lyrics generation genre-aware (no longer hardcoded to "Bachata").
- **Feb 15, 2026:** Added Hip Hop to GENRE_INSTRUMENT_MAP in antigravity_engine.ts. Expanded buildHeartMuLaTags to cover R&B, Hip Hop, Pop, EDM genres with proper tag normalization.
- **Feb 15, 2026:** Full blog system with WordPress-like features: blogComments, blogLikes, blogStars, blogShares tables. Public-facing blog page (/blog) with search, category filters, and blog post detail view with comments, likes (toggle), star ratings (1-5), share (Twitter, Facebook, WhatsApp, copy link). Admin blog editor enhanced with image file upload (multer) alongside URL input. Blog added to sidebar navigation.
- **Feb 15, 2026:** Integrated Kie.ai as Priority 3 music generation engine (after HeartMuLa/SAO private GPU). Uses Suno V5 model at ~$0.06/song. Added kie_engine.ts with generate, poll, extend, cover, and stem separation functions. Fallback chain: HeartMuLa → SAO → Kie.ai → Generic API → MusicGPT.
- **Feb 15, 2026:** Full i18n internationalization with react-i18next. Spanish is default language, English is secondary. Translation files at `client/src/i18n/` (es.json, en.json). Language switcher in sidebar and landing page nav. Config uses localStorage key "dgb-lang" for persistence. All pages and components translated.
- **Feb 16, 2026:** Added playCount field to songs schema for tracking plays. Built public music discovery system: DiscoverPage (/discover) with genre playlist carousel and trending songs grid, PlaylistPage (/discover/:genre) with Top 100 overall and Top 20 per genre charts. MusicGPT-style song cards with play counts (formatted as K/M), likes, download, duration. Now Playing bar at bottom. APIs: GET /api/public/charts, GET /api/public/charts/:genre, GET /api/public/playlists, POST /api/songs/:id/play. Both pages accessible to unauthenticated users. Added to sidebar navigation.
- **Feb 16, 2026:** Added RunPod Serverless integration (`server/core/runpod_serverless.ts`) for music generation, model training, and stem separation. Three endpoint types: RUNPOD_ENDPOINT_MUSIC, RUNPOD_ENDPOINT_TRAINING, RUNPOD_ENDPOINT_STEMS. New webhook at `/api/webhooks/runpod-serverless` handles all serverless results. Health check at `/api/serverless/health`. Training pipeline UI with 5-step visualization, real-time polling, and GPU status badges.
- **Feb 16, 2026:** Created comprehensive project documentation in both Spanish (DGB_STUDIO_ES.md) and English (DGB_STUDIO_EN.md) covering all platform features, APIs, architecture, Style Kits, training pipeline, and RunPod Serverless configuration.
- **Feb 16, 2026:** Artist Monetization Ecosystem: Schema (artist_profiles, artist_subscriptions, artist_followers, song_earnings, pro_registrations), 25+ storage CRUD methods, full API routes for profile CRUD, follow/subscribe, earnings dashboard, PRO registration. Frontend: ArtistDashboardPage (stats, overview/copyright/monetization tabs), ArtistProfilePage (public profile with follow/subscribe, discography), ArtistOnboardingPage (4-step wizard: identity, music, copyright, monetization). Revenue model: Pro users 100%, Basic users 95/5 split. PRO entities: BMI, ASCAP, SESAC, SOCAN, PRS, GEMA, SGAE. Artist types: singer, producer, DJ, band, restaurant, barbershop, nightclub, content_creator, hobbyist. Sidebar "Artist" section added. Full i18n (es/en).
- **Feb 16, 2026:** Discography system: Schema (discography_albums, discography_tracks) with Spotify import capability. Seeded Danny Garcia Bachata's real discography: "Historia De Amor" album (2021, 24 tracks), singles "Echoes of Love/Ecos de Amor" (2024), "Por Ella feat. Memin El Sucesor" (2022). Public DiscographyPage (/discography) with album cards, expandable tracklists, streaming platform links (Spotify, Apple Music, Amazon, YouTube, Deezer, Tidal), artist bio section. Admin routes for CRUD and Spotify artist search/import. Sidebar navigation added. Full i18n (es/en). Accessible to unauthenticated users.