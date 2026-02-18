# DAGRABA Studio

## Overview
DAGRABA Studio (formerly DGB Studio) is an AI-powered SaaS platform for music generation, specializing in "Bachata" music. The name DAGRABA stands for DA(nny) GRA(garcia) BA(chata) — with the R of Requinto woven in. Domain: dagraba.studio. It uses a dual-engine system, HeartMuLa for vocal tracks (with native Spanish support) and Stable Audio Open for instrumental tracks, leveraging RunPod Serverless GPU infrastructure. Key features include custom model fine-tuning via "Style Kits," comprehensive subscription management through Stripe, an admin dashboard, and an AI-driven support chatbot. The platform aims to be "La Pura Sangre de la Bachata con el ADN de Danny Garcia y los Grandes Musicos Dominicanos," offering advanced music creation, artist monetization, and a rich user experience.

## User Preferences
I prefer clear and concise communication. For coding, I favor modular and maintainable solutions. I appreciate an iterative development approach with regular updates. Before implementing significant architectural changes or new external dependencies, please ask for my approval. I expect the agent to prioritize secure and scalable solutions.

## System Architecture
DAGRABA Studio employs a microservices-oriented architecture with a clear separation between frontend and backend.

**Frontend:**
- **Technology Stack:** React, Vite, TailwindCSS, Shadcn UI.
- **UI/UX Design:** Dark mode with dark background, neon pink primary accents (#FF1493), and orange secondary accents (#FF8C00). Features pink-to-orange gradients, the DAGRABA neon pink waveform logo on solid black sidebar, and uses Inter and JetBrains Mono fonts. Designed with a mobile-first, responsive approach. DAGRABACHATA uses primary pink, DAGRABOLERO uses orange accents. Home is the default landing page after login.
- **Layout:** Utilizes a left sidebar for navigation and controls, with a dynamic full-width main content area.
- **Key UI Components:** CreatePage for music generation, LibraryPage for user song management, Studio DAW (professional digital mixer with Web Audio API: timeline waveforms, channel strip mixer with VU meters/faders/pan/3-band EQ/compressor/reverb, master bus, AI tools panel), Sample Lab for audio recording/upload and AI remixing, AdminPage for platform management, and Producer Store/Style Kits for instrument kit browsing/upload. Also includes Discography, Artist Dashboard, Copyright Hub, Discover pages, MyPlaylistsPage for user-created playlists, and PublicPlaylistViewPage for public playlist browsing.
- **Audio Engine:** Custom Web Audio API mixer engine (`use-audio-engine.ts`) with per-track node chains (GainNode -> StereoPannerNode -> 3x BiquadFilterNode EQ -> DynamicsCompressorNode -> AnalyserNode), reverb send (ConvolverNode), and master bus with EQ/compressor/gain/analyser. Canvas-based waveform visualization from decoded AudioBuffers.
- **Streaming/Social:** Spotify-like streaming model. Songs on Discover are playable/likeable/shareable but NOT downloadable by non-owners. Artists can create public playlists. Artist profiles require registration to view and track profile views. Annual pricing discounts: Basic 20%, Pro 25%, Premium 30%.

**Backend:**
- **Technology Stack:** Express.js (TypeScript).
- **Database:** PostgreSQL on Neon.
- **Authentication:** Replit Auth (OpenID Connect).
- **Admin Role System:** Role-based access control (`super_admin`, `admin`, `moderator`, `user`).
- **Payments:** Stripe integration for subscriptions, fan gifts, and artist monetization.
- **Generic API Provider System:** An API-agnostic engine for dynamic configuration of various API providers, including fallback mechanisms.
- **AI Engines (Music Generation Pipeline - priority order):**
    - **RunPod Serverless GPU (Priority 1):** Primary engine using SAO Instrumental Finetune (santifiorino/SAO-Instrumental-Finetune) + HeartMuLa on private GPU. Default model is `instrumental_finetune` with improved instrument control, tempo accuracy (~88%), and genre adherence over base SAO. Zero third-party API cost. Requires `RUNPOD_ENDPOINT_MUSIC` env var. Webhook-based delivery.
    - **Kie.ai (Priority 2):** Suno V5 integration for high-quality music generation with vocals. Fallback when RunPod unavailable.
    - **DGB AUDIO Audio Engine (Priority 3):** MusicGPT-based last resort fallback.
    - **Replicate/Mureka:** Deactivated. No longer part of music generation pipeline.
    - **OpenAI Integration:** Used for lyrics generation (GPT-5.1), support chatbot, instrument prompt generation, and prompt enrichment via the Antigravity Engine.
    - **SAO Training Pipeline:** Fine-tuning custom instrument kits using OpenAI and cloud GPU.
- **Stem Separation Engine:** Multi-tier fallback system (Private Cloud GPU, Replicate serverless, Generic API, MusicGPT) producing vocal, drum, bass, and melody stems.
- **Workers:** Background workers handle asynchronous processing for music generation and audio transformations.
- **Key Features:** DGB AUDIO branded engine with style presets, Bachata Mode, AI Lyrics Generator, Song History tracking, Artist Monetization Ecosystem (PRO registrations, earnings, fan gifts, wallets), Discography management (with Spotify import), Copyright & Publishing Hub, and AI Mashup (Kie.ai Mashup API blending 2 existing tracks into new compositions).
- **Internationalization:** Full i18n support with `react-i18next`, defaulting to Spanish.
- **RunPod Serverless Integration:** Manages music generation, model training, and stem separation endpoints with webhook callbacks.

## External Dependencies
- **HeartMuLa:** Self-hosted on private RunPod GPU.
- **SAO Instrumental Finetune:** Fine-tuned Stable Audio Open from santifiorino/SAO-Instrumental-Finetune, self-hosted on RunPod GPU. 88% tempo accuracy, improved instrument control.
- **Replicate:** Used for serverless stem separation (Demucs model).
- **OpenAI:** AI lyrics generation, support chatbot, prompt enrichment.
- **Neon (PostgreSQL):** Database hosting.
- **Stripe:** Payment gateway for subscriptions, fan gifts, artist payouts.
- **DGB Cloud Engine:** FastAPI/Uvicorn server on private cloud GPU for Producer Store instrument processing, audio analysis, and MIDI conversion.
- **Cloud GPU Servers:** Generic system for managing and utilizing multiple GPU servers (e.g., DigitalOcean GPU Droplet) for training, analysis, and generation.
- **Replit Auth:** User authentication.
- **Wavesurfer.js:** Frontend audio waveform visualization.
- **Kie.ai:** Third-party API for Suno V5 music generation.
