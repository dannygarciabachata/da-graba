# DA GRABA Studio

## Overview
DA GRABA Studio (formerly DGB Studio / DAGRABA Studio) is an AI-powered SaaS platform for music generation, specializing in "Bachata" music. The name DA GRABA stands for DA(nny) GRA(garcia) BA(chata) — with the R of Requinto woven in. Domain: dagraba.studio. It uses a dual-engine system, HeartMuLa for vocal tracks (with native Spanish support) and Stable Audio Open for instrumental tracks, leveraging RunPod Serverless GPU infrastructure. Key features include custom model fine-tuning via "Style Kits," comprehensive subscription management through Stripe, an admin dashboard, and an AI-driven support chatbot. The platform aims to be "La Pura Sangre de la Bachata con el ADN de Danny Garcia y los Grandes Musicos Dominicanos," offering advanced music creation, artist monetization, and a rich user experience.

## User Preferences
I prefer clear and concise communication. For coding, I favor modular and maintainable solutions. I appreciate an iterative development approach with regular updates. Before implementing significant architectural changes or new external dependencies, please ask for my approval. I expect the agent to prioritize secure and scalable solutions.

## System Architecture
DA GRABA Studio employs a microservices-oriented architecture with a clear separation between frontend and backend.

**Frontend:**
- **Technology Stack:** React, Vite, TailwindCSS, Shadcn UI.
- **UI/UX Design:** Dark mode with deep indigo background (#160a72), orange primary accents (#ff751f), and light gray secondary (#d9d9d9). Features orange gradients, the DA GRABA logo (orange DA + gray GRABA) on dark indigo sidebar, and uses Inter and JetBrains Mono fonts. Designed with a mobile-first, responsive approach. DA GRABACHATA uses primary orange, DA GRABOLERO uses secondary accents. Home is the default landing page after login.
- **Layout:** Utilizes a left sidebar for navigation and controls, with a dynamic full-width main content area.
- **Key UI Components:** CreatePage for music generation, LibraryPage for user song management, Studio DAW (LMMS-inspired web DAW with multi-track timeline, clip-based editing, transport bar, mixer console, right sidebar browser), Sample Lab for audio recording/upload and AI remixing, AdminPage for platform management, and Producer Store/Style Kits for instrument kit browsing/upload. Also includes Discography, Artist Dashboard, Copyright Hub, Discover pages, MyPlaylistsPage for user-created playlists, and PublicPlaylistViewPage for public playlist browsing.
- **Studio DAW Features:** Multi-track timeline with draggable clip blocks, BPM control, snap-to-grid quantization (Off/1/16/1/8/1/4/1/2/1 bar/2 bars), voice recording via MediaRecorder, track creation cards with instrument selection and prompt input, right sidebar tabbed browser (Instruments with 12 Bachata VST3 presets, Effects with Reverb/Delay/Compressor/EQ/Chorus, AI Tools with Master/Denoise/Cover/Trim/Download), mixer console with VU meters and faders, timeline ruler showing bar/beat markers. DB table: `daw_clips` for clip positioning and metadata. Hooks: `use-daw.ts` for clip CRUD + recording.
- **Audio Engine:** Custom Web Audio API mixer engine (`use-audio-engine.ts`) with per-track node chains (GainNode -> StereoPannerNode -> 3x BiquadFilterNode EQ -> DynamicsCompressorNode -> AnalyserNode), reverb send (ConvolverNode), master bus with EQ/compressor/gain/analyser, and MediaRecorder-based voice recording. Canvas-based waveform visualization from decoded AudioBuffers.
- **Streaming/Social:** Spotify-like streaming model. Songs on Discover are playable/likeable/shareable but NOT downloadable by non-owners. Artists can create public playlists. Artist profiles require registration to view and track profile views. Annual pricing discounts: Basic 20%, Pro 25%, Premium 30%.

**Backend:**
- **Technology Stack:** Express.js (TypeScript).
- **Database:** PostgreSQL on Neon.
- **Authentication:** Replit Auth (OpenID Connect).
- **Admin Role System:** Role-based access control (`super_admin`, `admin`, `moderator`, `user`).
- **Payments:** Stripe integration for subscriptions, fan gifts, and artist monetization. Stripe Connect Express for artist payouts (bank account, instant card, PayPal manual review). Payout requests tracked in `payout_requests` table with status lifecycle (pending→processing→paid/failed). Artist profiles store Connect account ID and onboarding status.
- **Generic API Provider System:** An API-agnostic engine for dynamic configuration of various API providers, including fallback mechanisms.
- **AI Engines (Music Generation Pipeline - priority order):**
    - **RunPod Serverless GPU (Priority 1):** Primary engine using SAO Instrumental Finetune (santifiorino/SAO-Instrumental-Finetune) + HeartMuLa on private GPU. Default model is `instrumental_finetune` with improved instrument control, tempo accuracy (~88%), and genre adherence over base SAO. Zero third-party API cost. Requires `RUNPOD_ENDPOINT_MUSIC` env var. Webhook-based delivery.
    - **Kie.ai (Priority 2):** Suno V5 integration for high-quality music generation with vocals. Fallback when RunPod unavailable.
    - **DGB AUDIO Audio Engine (Priority 3):** MusicGPT-based last resort fallback.
    - **Replicate/Mureka:** Deactivated. No longer part of music generation pipeline.
    - **OpenAI Integration:** Used for lyrics generation (GPT-5.1), support chatbot, instrument prompt generation, and prompt enrichment via the Antigravity Engine.
    - **SAO Training Pipeline:** Fine-tuning custom instrument kits using OpenAI and cloud GPU. Admin Training Datasets panel (`/admin` → Training Data tab) for managing MIDI dataset pipeline with 4 steps: Clean MIDI → Metadata (Spotify/LastFM) → Prompts (LLM) → Audio Rendering (FluidSynth/VST3). Supports Lakh MIDI Dataset (clean subset), Million Song Dataset (MSD - 300GB, AWS snap-5178cf30, pre-trained instrument timbre/chroma vectors, HDF5+SQLite), craffel/midi-dataset, and custom MIDI uploads. DB tables: `training_datasets` + `training_files` with pipeline status tracking. Pipeline scripts in `scripts/dataset_creator/`.
    - **Dual Instrument Engine:** Two rendering backends for MIDI-to-audio synthesis:
      - **FluidSynth + FluidR3_GM.sf2:** 128 GM melodic instruments + 47 percussion kits. SoundFont at `/runpod-volume/instruments/soundfonts/FluidR3_GM.sf2`. GPU Setup auto-installs FluidSynth, pyfluidsynth, mido, and pyloudnorm.
      - **DA GRABA Sampler VST3:** Custom C++ VST3 plugin (Steinberg VST3 SDK, MIT license) with 12 Bachata-specific instrument presets: Requinto, Segunda Guitarra, Bongo, Conga, Guira, Timbal, Campanas, Bajo, Piano, Pad, Strings (Violines), Strings (Chelos). Sample-based with ADSR envelope, 32-voice polyphony, WAV multi-velocity support. Plugin source in `vst3_plugins/dagraba_sampler/`. Built on RunPod via admin "Build VST3" button (`POST /api/admin/gpu/build-vst3`). Deployed to `/runpod-volume/vst3/DA_GRABA_Sampler.vst3`. Samples stored at `/runpod-volume/vst3/samples/<InstrumentName>/`. Hosted via pedalboard (Spotify) for rendering.
      - **Render engine selection:** `RENDER_ENGINE` env var: `fluidsynth` (default), `vst3` (DA GRABA only), or `hybrid` (VST3 for mapped instruments, FluidSynth fallback). GM-to-VST3 mapping in `instruments_map.py`.
    - Admin panel instrument status checker (`GET /api/admin/gpu/instruments`) shows both FluidSynth and VST3 status.
- **Stem Separation Engine:** Multi-tier fallback system (Private Cloud GPU, Replicate serverless, Generic API, MusicGPT) producing vocal, drum, bass, and melody stems.
- **Workers:** Background workers handle asynchronous processing for music generation and audio transformations.
- **Genre Styles (Tocadas) System:** Dynamic database-driven system for defining genre-specific playing styles (tocadas). DB table `genre_styles` with genre, name, slug, description, promptHint, baseInstruments[], extraInstruments[], styleKitId, displayOrder, isActive. Admin panel "Tocadas" tab for CRUD management. CreatePage dynamically fetches styles from `/api/genre-styles` and renders sub-style pills + orchestration panels for any genre with defined styles. Seeded with Bachata (Tradicional, Moderna, Sensual, Urbana, Rosa), Bolero (Romantico, Ranchero, Son, Moderno), Merengue (Majao, Derecho, Mambo, Tipico, De Salon), and Salsa (Dura, Romantica, Urbana). The system provides DA GRABA's unique differentiation with authentic Dominican musical styles. Component: `client/src/components/admin/GenreStylesTab.tsx`.
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
