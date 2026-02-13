# DGB Audio - Heart Mula Music Engine

## Overview
DGB Audio is building an AI-powered music generation SaaS platform, "Heart Mula," designed to revolutionize music creation. The platform offers a generic, API-agnostic architecture, allowing for flexible integration with various AI providers, with MusicGPT as the default for audio operations and OpenAI for lyrics. It supports over 20 music genres and features a webhook-based system for efficient asynchronous processing.

The platform includes a robust subscription model (Free, Pro, Producer, Premium tiers) powered by Stripe, a comprehensive admin dashboard for analytics, settings, and support management, and an AI-driven support chatbot. A key differentiator is the "Producer Store," enabling paying customers to upload custom instrument kits for AI training via a private cloud GPU engine, fostering a unique and evolving sound library. The business vision is to empower musicians and producers with cutting-edge AI tools to create high-quality, genre-diverse music effortlessly, tapping into the growing market for AI-assisted creative tools.

## User Preferences
I prefer clear and concise communication. For coding, I favor modular and maintainable solutions. I appreciate an iterative development approach with regular updates. Before implementing significant architectural changes or new external dependencies, please ask for my approval. I expect the agent to prioritize secure and scalable solutions.

## System Architecture
The "Heart Mula" music engine employs a microservices-oriented architecture with a clear separation of concerns.

**Frontend:**
- **Technology Stack:** React, Vite, TailwindCSS, Shadcn UI.
- **UI/UX Design:** Features a premium dark mode theme with a carbon black background (`#121212`), neon blue accents (`#00F3FF`), and silver highlights (`#C0C0C0`). Typography uses Inter and JetBrains Mono. The design is mobile-first and responsive, with a consistent bottom tab navigation for core features.
- **Layout:** A left sidebar provides navigation and user/admin controls, while the main content area is dynamic and full-width.
- **Key UI Components:**
    - **CreatePage:** Suno-style music creation with both aggregate and detailed prompt modes.
    - **LibraryPage:** Displays user's generated songs with an inline audio player.
    - **Studio:** Multitrack studio with AI stem separation (Vocals, Drums, Bass, Melody), individual track controls (volume, mute, solo, waveform visualization), and AI tools (Master, Denoise, AI Cover, Audio Cutter).
    - **Sample Lab:** Features audio recording, file upload, AI Remix transformation, and Key/BPM detection.
    - **AdminPage:** Owner-only interface for managing API providers, endpoints, style kits, users, and subscriptions.
    - **Producer Store/Style Kits:** User-browsable and uploadable custom instrument kits with audio preview and integration into the music generation prompt engine.

**Backend:**
- **Technology Stack:** Express.js (TypeScript).
- **Database:** PostgreSQL, hosted on Neon via Replit.
- **Authentication:** Replit Auth (OpenID Connect).
- **Admin Role System:** Role-based access control with 4 levels: `super_admin` (full access), `admin` (dashboard/analytics/users/subscriptions/support/style-kits), `moderator` (support only), `user` (no admin access). ADMIN_USER_ID env var is always super_admin. Roles stored in `users.role` column. Super admins can manage user roles from the Users tab.
- **Payments:** Stripe integration via `stripe-replit-sync` for subscriptions, checkout, and customer portal.
- **Generic API Provider System:**
    - A core architectural decision is the **API-agnostic engine** (`generic_api_engine.ts`). This system allows any API provider to be configured dynamically via the Admin Panel, storing configurations in `api_providers` and `api_endpoints` tables.
    - It supports dynamic authentication (raw, bearer, header, query), request mapping, response extraction, and various async patterns (polling, webhook).
    - **Fallback Mechanism:** If no specific provider is configured for an operation, the system defaults to a hardcoded fallback engine (`musicgpt_engine.ts`).
    - **Operation Types:** Supports a wide range of operations including music_generation, stem_separation, remix, mastering, denoise, key_bpm, cover, voice_change, audio_cut, lyrics_generation, and image_generation.
- **AI Engines:**
    - **DGB STUDIO Audio Engine:** Default for all audio operations (seeded as "DGB STUDIO Audio Engine"), API-agnostic.
    - **Heart Mula Cloud Engine:** Private cloud GPU engine for instrument processing, audio analysis, and MIDI conversion.
    - **OpenAI Integration:** Used for lyrics generation (via GPT-5.1) and powering the platform's support chatbot and instrument prompt generation.
    - **SAO Training Pipeline:** A Stable Audio Open-inspired fine-tuning pipeline for custom instrument kits, utilizing OpenAI for prompt generation and cloud GPU for training.
    - **Antigravity Engine:** A creative AI engine leveraging OpenAI for lyrics and full arrangement configurations.
- **Stem Separation Engine:** Cloud GPU-first stem separation using Demucs (htdemucs model) via RunPod Jupyter. Falls back to generic API providers if GPU unavailable. Webhook: `/api/webhooks/runpod-stems`. Produces 4 stems: vocals, drums, bass, other/melody.
- **Workers:** Dedicated background workers (`music_tasks.ts`, `sample_tasks.ts`) for asynchronous processing of music generation and various audio sample transformations (Remix, Key/BPM, Mastering, Denoise, Cover, Audio Cut).
- **Key Features Implemented:**
    - **Heart Mula branded engine:** Includes style presets (Signature, Romantic, Dance, Bolero, Trio Serenade, Bachata Urbana).
    - **Bachata Mode:** Auto-detection of Bachata-related keywords to force Dominican instrument sounds.
    - **AI Lyrics Generator:** Offers romantic, dance, and heartbreak styles, influenced by artists like Frank Reyes and Romeo Santos.
    - **Bachata Quiz:** A knowledge quiz system.
    - **Song History:** Tracks processing status via polling.

## External Dependencies
- **Stable Audio Open (Self-Hosted):** Primary music generation engine running on private cloud GPU. Uses `runpod_music_engine.ts` to submit inference jobs via Jupyter WebSocket protocol. Generates audio from text prompts with no per-song API cost. Webhook: `/api/webhooks/runpod-music`. Falls back to external APIs (Generic/MusicGPT) if GPU is unavailable.
- **MusicGPT:** Fallback AI provider for audio-related operations (music generation, stem separation, remix, mastering, etc.).
- **OpenAI:** Used for AI lyrics generation, AI support chatbot, and prompt generation within the SAO training pipeline.
- **Neon (PostgreSQL):** Database hosting for all persistent data.
- **Stripe:** Payment gateway for subscription management, checkouts, and customer portals.
- **DGB Cloud Engine:** Self-hosted Flask server (`dgb_api_receptor.py`) on private cloud GPU for Producer Store instrument processing. Receives audio uploads, converts to MIDI (basic-pitch), analyzes audio (librosa). Authenticated via `DGB_API_KEY` + `TRAINING_WEBHOOK_SECRET` for webhooks. Runs on port 7860. Webhook: `/api/dgb-cloud/webhook`. Auto-seeded as API Provider "DGB Cloud Engine" in Admin panel.
- **Cloud GPU Server:** JupyterLab server for audio analysis (librosa-based key/BPM/energy detection) and SAO model fine-tuning. Connected via `RUNPOD_BASE_URL` env var (internal only). Uses Jupyter kernel API for job dispatch with webhook callbacks.
- **Generic Cloud Server System:** Database-driven (`cloud_servers` table) management of multiple GPU servers from any provider (AWS, Google Cloud, DigitalOcean, RunPod, etc.). Admin panel "Cloud Servers" tab allows adding/editing/testing servers without code changes. System auto-selects highest-priority active server by capability. Falls back to env vars if no DB servers configured. Each server stores: baseUrl, apiPort, apiKey, webhookSecret, capabilities, priority, custom auth/webhook headers, and endpoint paths.
- **Replit Auth:** OpenID Connect-based user authentication.
- **Replit AI Integrations:** Facilitates connection to OpenAI services.
- **Wavesurfer.js:** Frontend library for audio waveform visualization.

## Key Scripts
- **`server/scripts/dgb_api_receptor.py`**: DGB Cloud Engine Flask API server for private GPU. Run on GPU server with `export DGB_API_KEY='key' && export TRAINING_WEBHOOK_SECRET='secret' && python3 /workspace/dgb_api_receptor.py`. Handles instrument uploads, audio-to-MIDI conversion, and audio analysis. Port 7860. Webhook authentication uses `TRAINING_WEBHOOK_SECRET` (falls back to `DGB_API_KEY`).