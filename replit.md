# DAGRABA Studio

## Overview
DAGRABA Studio (formerly DGB Studio) is an AI-powered SaaS platform for music generation, specializing in "Bachata" music. The name DAGRABA stands for DA(nny) GRA(garcia) BA(chata) — with the R of Requinto woven in. Domain: dagraba.studio. It uses a dual-engine system, HeartMuLa for vocal tracks (with native Spanish support) and Stable Audio Open for instrumental tracks, leveraging RunPod Serverless GPU infrastructure. Key features include custom model fine-tuning via "Style Kits," comprehensive subscription management through Stripe, an admin dashboard, and an AI-driven support chatbot. The platform aims to be "La Pura Sangre de la Bachata con el ADN de Danny Garcia y los Grandes Musicos Dominicanos," offering advanced music creation, artist monetization, and a rich user experience.

## User Preferences
I prefer clear and concise communication. For coding, I favor modular and maintainable solutions. I appreciate an iterative development approach with regular updates. Before implementing significant architectural changes or new external dependencies, please ask for my approval. I expect the agent to prioritize secure and scalable solutions.

## System Architecture
DAGRABA Studio employs a microservices-oriented architecture with a clear separation between frontend and backend.

**Frontend:**
- **Technology Stack:** React, Vite, TailwindCSS, Shadcn UI.
- **UI/UX Design:** Dark mode with dark navy background, neon cyan primary accents (#00C8FF), and royal blue secondary accents (#3366FF). Features cyan-to-blue gradients, a transparent DAGRABA logo with glow effects, and uses Inter and JetBrains Mono fonts. Designed with a mobile-first, responsive approach.
- **Layout:** Utilizes a left sidebar for navigation and controls, with a dynamic full-width main content area.
- **Key UI Components:** CreatePage for music generation, LibraryPage for user song management, Studio for multitrack editing and AI tools (stem separation, controls), Sample Lab for audio recording/upload and AI remixing, AdminPage for platform management, and Producer Store/Style Kits for instrument kit browsing/upload. Also includes Discography, Artist Dashboard, Copyright Hub, Discover pages, MyPlaylistsPage for user-created playlists, and PublicPlaylistViewPage for public playlist browsing.
- **Streaming/Social:** Spotify-like streaming model. Songs on Discover are playable/likeable/shareable but NOT downloadable by non-owners. Artists can create public playlists. Artist profiles require registration to view and track profile views. Annual pricing discounts: Basic 20%, Pro 25%, Premium 30%.

**Backend:**
- **Technology Stack:** Express.js (TypeScript).
- **Database:** PostgreSQL on Neon.
- **Authentication:** Replit Auth (OpenID Connect).
- **Admin Role System:** Role-based access control (`super_admin`, `admin`, `moderator`, `user`).
- **Payments:** Stripe integration for subscriptions, fan gifts, and artist monetization.
- **Generic API Provider System:** An API-agnostic engine for dynamic configuration of various API providers, including fallback mechanisms.
- **AI Engines (Music Generation Pipeline - priority order):**
    - **RunPod Serverless GPU (Priority 1):** Primary engine using Stable Audio Open + HeartMuLa on private GPU. Zero third-party API cost. Requires `RUNPOD_ENDPOINT_MUSIC` env var. Webhook-based delivery.
    - **Kie.ai (Priority 2):** Suno V5 integration for high-quality music generation with vocals. Fallback when RunPod unavailable.
    - **DGB AUDIO Audio Engine (Priority 3):** MusicGPT-based last resort fallback.
    - **Replicate/Mureka:** Deactivated. No longer part of music generation pipeline.
    - **OpenAI Integration:** Used for lyrics generation (GPT-5.1), support chatbot, instrument prompt generation, and prompt enrichment via the Antigravity Engine.
    - **SAO Training Pipeline:** Fine-tuning custom instrument kits using OpenAI and cloud GPU.
- **Stem Separation Engine:** Multi-tier fallback system (Private Cloud GPU, Replicate serverless, Generic API, MusicGPT) producing vocal, drum, bass, and melody stems.
- **Workers:** Background workers handle asynchronous processing for music generation and audio transformations.
- **Key Features:** DGB AUDIO branded engine with style presets, Bachata Mode, AI Lyrics Generator, Song History tracking, Artist Monetization Ecosystem (PRO registrations, earnings, fan gifts, wallets), Discography management (with Spotify import), and a Copyright & Publishing Hub.
- **Internationalization:** Full i18n support with `react-i18next`, defaulting to Spanish.
- **RunPod Serverless Integration:** Manages music generation, model training, and stem separation endpoints with webhook callbacks.

## External Dependencies
- **HeartMuLa:** Self-hosted on private RunPod GPU.
- **Stable Audio Open:** Self-hosted on private RunPod GPU.
- **Replicate:** Used for serverless stem separation (Demucs model).
- **OpenAI:** AI lyrics generation, support chatbot, prompt enrichment.
- **Neon (PostgreSQL):** Database hosting.
- **Stripe:** Payment gateway for subscriptions, fan gifts, artist payouts.
- **DGB Cloud Engine:** FastAPI/Uvicorn server on private cloud GPU for Producer Store instrument processing, audio analysis, and MIDI conversion.
- **Cloud GPU Servers:** Generic system for managing and utilizing multiple GPU servers (e.g., DigitalOcean GPU Droplet) for training, analysis, and generation.
- **Replit Auth:** User authentication.
- **Wavesurfer.js:** Frontend audio waveform visualization.
- **Kie.ai:** Third-party API for Suno V5 music generation.
