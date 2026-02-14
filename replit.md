# DGB Audio - DGB Studio

## Overview
DGB Audio is developing "DGB Studio," an AI-powered SaaS platform for music generation. It utilizes a self-hosted private GPU architecture on RunPod, featuring a dual-engine system: HeartMuLa for songs with lyrics and vocals (including native Spanish support), and Stable Audio Open for instrumental-only tracks. All generation occurs on the private GPU, with OpenAI used for lyrics and prompt enrichment. A key feature is custom model fine-tuning through "Style Kits," where users can upload instruments for AI analysis and training. The platform incorporates a comprehensive subscription model via Stripe, an admin dashboard, and an AI-driven support chatbot. The business aims to empower musicians with advanced AI tools for high-quality, diverse music creation, leveraging the growing market for AI-assisted creative tools.

## User Preferences
I prefer clear and concise communication. For coding, I favor modular and maintainable solutions. I appreciate an iterative development approach with regular updates. Before implementing significant architectural changes or new external dependencies, please ask for my approval. I expect the agent to prioritize secure and scalable solutions.

## System Architecture
The "DGB Studio" music engine employs a microservices-oriented architecture.

**Frontend:**
- **Technology Stack:** React, Vite, TailwindCSS, Shadcn UI.
- **UI/UX Design:** Dark mode theme (`#121212`) with neon blue accents (`#00F3FF`) and silver highlights (`#C0C0C0`). Uses Inter and JetBrains Mono fonts. Mobile-first, responsive design with consistent bottom tab navigation.
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
    - **DGB Studio Audio Engine:** MusicGPT-based fallback.
    - **OpenAI Integration:** Used for lyrics generation (GPT-5.1), support chatbot, and instrument prompt generation.
    - **SAO Training Pipeline:** Fine-tuning pipeline for custom instrument kits using OpenAI for prompts and cloud GPU for training.
    - **Antigravity Engine:** Leverages OpenAI for lyrics, arrangement, and prompt enrichment, translating user prompts into optimized English descriptions for music generation, including genre-specific mappings.
- **Stem Separation Engine:** Multi-tier fallback system: Private Cloud GPU (Demucs), Replicate serverless GPU (Demucs), Generic API providers, MusicGPT fallback. Produces vocals, drums, bass, and melody stems.
- **Workers:** Background workers for asynchronous processing of music generation and audio sample transformations.
- **Key Features:** DGB Studio branded engine with style presets, Bachata Mode (genre-specific instrument sounds), AI Lyrics Generator, Song History tracking.

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