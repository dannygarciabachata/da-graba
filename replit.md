# DGB Studio

## Overview
DGB Studio is an AI-powered SaaS platform for music generation, specializing in "Bachata" music. It uses a dual-engine system, HeartMuLa for vocal tracks (with native Spanish support) and Stable Audio Open for instrumental tracks, leveraging RunPod Serverless GPU infrastructure. Key features include custom model fine-tuning via "Style Kits," comprehensive subscription management through Stripe, an admin dashboard, and an AI-driven support chatbot. The platform aims to be "La Pura Sangre de la Bachata con el ADN de Danny Garcia y los Grandes Musicos Dominicanos," offering advanced music creation, artist monetization, and a rich user experience.

## User Preferences
I prefer clear and concise communication. For coding, I favor modular and maintainable solutions. I appreciate an iterative development approach with regular updates. Before implementing significant architectural changes or new external dependencies, please ask for my approval. I expect the agent to prioritize secure and scalable solutions.

## System Architecture
DGB Studio employs a microservices-oriented architecture with a clear separation between frontend and backend.

**Frontend:**
- **Technology Stack:** React, Vite, TailwindCSS, Shadcn UI.
- **UI/UX Design:** Dark mode with deep purple background, neon cyan primary accents, and magenta/pink secondary accents. Features cyan-to-magenta gradients, a transparent DGB Studio 2 logo with glow effects, and uses Inter and JetBrains Mono fonts. Designed with a mobile-first, responsive approach.
- **Layout:** Utilizes a left sidebar for navigation and controls, with a dynamic full-width main content area.
- **Key UI Components:** CreatePage for music generation, LibraryPage for user song management, Studio for multitrack editing and AI tools (stem separation, controls), Sample Lab for audio recording/upload and AI remixing, AdminPage for platform management, and Producer Store/Style Kits for instrument kit browsing/upload. Also includes Discography, Artist Dashboard, Copyright Hub, and Discover pages.

**Backend:**
- **Technology Stack:** Express.js (TypeScript).
- **Database:** PostgreSQL on Neon.
- **Authentication:** Replit Auth (OpenID Connect).
- **Admin Role System:** Role-based access control (`super_admin`, `admin`, `moderator`, `user`).
- **Payments:** Stripe integration for subscriptions, fan gifts, and artist monetization.
- **Generic API Provider System:** An API-agnostic engine for dynamic configuration of various API providers, including fallback mechanisms.
- **AI Engines:**
    - **HeartMuLa (Primary):** 3B parameter model for full songs with vocals/lyrics (Spanish support), running on private RunPod GPU.
    - **Stable Audio Open (Instrumental):** For instrumental generation and fine-tuned models from Style Kits, running on private RunPod GPU.
    - **Kie.ai:** Suno V5 integration for high-quality music generation with vocals, serving as a Priority 3 fallback.
    - **DGB AUDIO Audio Engine:** MusicGPT-based fallback.
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