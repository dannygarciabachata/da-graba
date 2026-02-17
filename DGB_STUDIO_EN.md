# DGB Studio - Complete Project Document

**"The Pure Blood of Bachata with the DNA of Danny Garcia and the Great Dominican Musicians"**

**Date:** February 2026  
**Version:** 2.0

---

## 1. Overview

DGB Studio is an AI-powered SaaS platform for music creation, specializing in Bachata and Boleros. The platform enables musicians and producers to generate high-quality music using AI models trained with the sonic DNA of real Dominican instruments.

### Value Proposition
- AI music generation using custom models trained with real instruments
- AI-powered stem separation (vocals, drums, bass, melody)
- Multitrack audio studio with AI tools
- Custom model training with Style Kits
- Public music discovery
- Full support in Spanish and English

---

## 2. System Architecture

### Frontend
- **Stack:** React + Vite + TailwindCSS + Shadcn UI
- **Theme:** Dark mode with dark navy background (`hsl 230 30% 6%`), cyan primary (`#00C8FF`), royal blue accents (`#3366FF`)
- **Fonts:** Inter (text), JetBrains Mono (code)
- **Logo:** DAGRABA transparent logo with cyan/blue glow effects
- **i18n:** Spanish (default) and English with react-i18next

### Backend
- **Stack:** Express.js (TypeScript)
- **Database:** PostgreSQL (Neon)
- **Authentication:** Replit Auth (OpenID Connect)
- **Payments:** Stripe (monthly/annual subscriptions)
- **ORM:** Drizzle ORM

### GPU Infrastructure
- **RunPod Serverless** for music generation and model training
- **RunPod Dedicated** as fallback (JupyterLab WebSocket)
- **Replicate** for stem separation (Demucs serverless)
- Auto-scales to zero when idle (pay per second)

---

## 3. AI Engines

### 3.1 HeartMuLa (Primary Engine)
- **Model:** 3B parameters (RL variant - Reinforcement Learning)
- **Capability:** Full songs with vocals and lyrics
- **Native Spanish support**
- **Running on:** RunPod Serverless GPU
- **Pipeline:** heartlib -> HeartMuLaGenPipeline
- **Checkpoints:** HeartMuLa-RL-oss-3B, HeartCodec-oss

### 3.2 Stable Audio Open (Instrumental Engine)
- **Model:** Text-conditioned diffusion
- **Capability:** Instrumental generation (up to 47s per segment)
- **Fine-tuned model support** from Style Kits
- **Sample Rate:** 44100 Hz, Stereo
- **Fallback:** Diffusers pipeline if stable-audio-tools unavailable

### 3.3 Kie.ai (Cloud API - Priority 3)
- **Model:** Suno V5
- **Cost:** ~$0.06 per song
- **Capabilities:** Generation, extend, covers, stem separation
- **Fallback** after HeartMuLa and SAO

### 3.4 Antigravity Engine (Prompt Enrichment)
- **Uses OpenAI** for lyrics, arrangements, and prompt enrichment
- **Genre mapping** with genre-specific instruments
- **Automatic translation** from Spanish prompts to optimized English descriptions

### 3.5 Fallback Chain
```
HeartMuLa (Private GPU) -> SAO (Private GPU) -> Kie.ai (Cloud API) -> Generic API -> MusicGPT
```

---

## 4. Music Generation with Custom DNA

### 4.1 Creation Flow
1. User selects genre (Bachata, Bolero, Salsa, etc.)
2. Writes prompt or uses DGB style presets
3. Optionally generates lyrics with AI (GPT-5.1)
4. Antigravity Engine enriches prompt with genre tags
5. HeartMuLa generates the song on RunPod Serverless
6. Audio is processed and delivered to user

### 4.2 Prompt Configuration
- **Genre tags:** BPM, time signature, specific instruments
- **DGB Presets:** Romantic Bachata, Classic Bolero, Salsa Dura
- **Duration:** 1:00 to 5:00 minutes (Pro Controls selector)
- **Bachata Mode:** Genre-specific instrument sounds

### 4.3 RunPod Serverless for Generation
```
POST https://api.runpod.ai/v2/{ENDPOINT_ID}/run
{
  "input": {
    "action": "generate_music",
    "engine": "heartmula" | "sao",
    "song_id": 123,
    "prompt": "...",
    "duration_seconds": 180,
    "lyrics": "...",
    "tags": "...",
    "style_kit_id": 11,
    "webhook_url": "https://app.replit.app/api/webhooks/runpod-serverless"
  }
}
```

---

## 5. Style Kits and Model Training

### 5.1 What are Style Kits
Style Kits are collections of real instruments used to train custom AI models. Each kit captures the "sonic DNA" of a musical style.

### 5.2 Existing Kits

#### DGB Bachata (ID: 3)
- **Genre:** Bachata
- **Instruments:** 7 planned
- **Status:** Upload in progress

#### DGB Bolero (ID: 11)
- **Genre:** Bolero
- **Instruments:** 17/17 complete
  - 12 real recorded instruments
  - 5 AI-generated instruments (via Kie.ai)
- **Instruments included:**
  - Acoustic guitar (nylon), Requinto, Bongo
  - Piano, Upright bass, Violin, Viola, Cello
  - Flute, Clarinet, Muted trumpet
  - Soft guiro, Maracas, Conga, Soft timbales
  - Vocal chorus, Orchestral strings

### 5.3 Training Pipeline (5 Steps)

```
Upload -> Analyze -> Generate Prompts -> Train -> Ready
  0-20%    20-40%      40-60%          60-80%    100%
```

1. **Upload Instruments** - Upload WAV/MP3 audio of each instrument
2. **Analyze Audio** - Librosa detects BPM, key, energy, acousticness
3. **Generate AI Prompts** - OpenAI creates training prompts per instrument
4. **Train Model** - Fine-tune Stable Audio Open on RunPod Serverless
5. **Model Ready** - Trained model available for generation

### 5.4 RunPod Serverless for Training
```
POST https://api.runpod.ai/v2/{ENDPOINT_ID}/run
{
  "input": {
    "action": "train_model",
    "kit_id": 11,
    "kit_name": "DGB Bolero",
    "genre": "bolero",
    "instruments": [...],
    "training_config": {
      "learning_rate": 5e-5,
      "batch_size": 1,
      "epochs": 100,
      "use_ema": true
    },
    "webhook_url": "..."
  }
}
```

### 5.5 Training Configuration
- **Learning Rate:** 5e-5
- **Batch Size:** 1
- **Epochs:** 100
- **EMA:** Enabled
- **Sample Rate:** 44100 Hz
- **Channels:** 2 (Stereo)
- **Model Type:** diffusion_cond

### 5.6 Supported Genres
| Genre | Style Hint |
|-------|-----------|
| Bachata | Requinto guitar, bongo, guira, romantic feel |
| Bolero | Nylon guitar arpeggios, soft percussion, intimate atmosphere |
| Salsa | Piano montuno, timbales, congas, brass sections |
| Merengue | Accordion, tambora, guira, energetic rhythm |
| Cumbia | Accordion, guacharaca, tropical rhythms |
| Reggaeton | Dembow beat, 808 bass, urban production |
| Son | Tres, bongo, claves, Caribbean feel |
| Latin Pop | Piano, acoustic guitar, modern production |
| Vallenato | Accordion paseos, caja, Colombian sound |
| Tropical | Warm percussion, brass, Caribbean influences |

---

## 6. Stem Separation

### 6.1 Multi-tier Engine
1. **RunPod Serverless** (Demucs) - First choice
2. **Replicate** (Demucs serverless) - Fallback
3. **Generic API Providers** - Configurable
4. **MusicGPT** - Last resort

### 6.2 Produced Stems
- Vocals
- Drums
- Bass
- Melody

---

## 7. Pages and Features

### 7.1 Create Music (`/create`)
- Suno-style interface with genre selector
- AI lyrics generator
- Pro Controls: duration, engine, seed
- DGB style presets
- Song history view

### 7.2 Library (`/library`)
- User's songs
- Integrated audio player
- MP3 download
- Per-song stem separation

### 7.3 Studio (`/studio`)
- Multitrack editor
- AI stem separation
- Track controls (volume, pan, mute, solo)
- AI mixing tools

### 7.4 Sample Lab (`/sample-lab`)
- Audio recording
- File upload
- AI Remix
- Key and BPM detection

### 7.5 Discover (`/discover`)
- Genre playlist carousel
- Trending songs grid
- MusicGPT-style song cards with plays, likes, duration
- Top 100 overall and Top 20 per genre
- Accessible without authentication

### 7.6 Style Kits (`/style-kits`)
- Instrument kit management
- Visual training pipeline (5 steps)
- Real-time progress bar
- GPU connection status
- Individual instrument upload

### 7.7 Blog (`/blog`)
- Full WordPress-like system
- Comments, likes, stars (1-5), share
- Admin editor with image upload
- Category filters and search

### 7.8 Admin (`/admin`)
- Administration panel (owner only)
- API provider management
- GPU server configuration
- User and role management
- Pricing plans and Stripe
- Platform settings

### 7.9 Landing Page (`/`)
- Presentation page with DGB Studio branding
- Language selector
- Registration and login links

---

## 8. Subscription System

### Available Plans
| Plan | Price | Credits | Features |
|------|-------|---------|----------|
| Free | $0/mo | Limited | Basic generation |
| Pro | Variable | More credits | Advanced features |
| Producer | Variable | Even more | Full studio |
| Premium | Variable | Unlimited | Everything included |

### Stripe Integration
- Embedded checkout
- Monthly and annual subscriptions
- Webhooks for status updates
- Plan management from admin panel

---

## 9. User Roles

| Role | Permissions |
|------|------------|
| `super_admin` | Full access, platform management |
| `admin` | Admin panel, content management |
| `moderator` | Content moderation |
| `user` | Standard features |

---

## 10. APIs and Webhooks

### Main Endpoints
| Route | Method | Description |
|-------|--------|-------------|
| `/api/songs` | POST | Create song |
| `/api/songs` | GET | List user songs |
| `/api/songs/:id/stems` | POST | Separate stems |
| `/api/style-kits` | GET/POST | Manage Style Kits |
| `/api/style-kits/:id/instruments` | GET/POST | Kit instruments |
| `/api/style-kits/:id/analyze` | POST | Analyze instruments |
| `/api/style-kits/:id/train` | POST | Start training |
| `/api/style-kits/:id/training-status` | GET | Training status |
| `/api/serverless/health` | GET | RunPod Serverless status |
| `/api/public/charts` | GET | Public charts |
| `/api/public/charts/:genre` | GET | Charts by genre |
| `/api/pricing/plans` | GET | Pricing plans |

### Webhooks
| Route | Source | Description |
|-------|--------|-------------|
| `/api/webhooks/runpod-serverless` | RunPod Serverless | Generation and training results |
| `/api/webhooks/runpod-music` | RunPod Dedicated | Generation results (legacy) |
| `/api/webhooks/runpod-stems` | RunPod | Stem separation results |
| `/api/training/webhook` | GPU Cloud | Training updates |

---

## 11. Required Environment Variables

### Secrets (Sensitive)
| Variable | Description |
|----------|-------------|
| `RUNPOD_API_KEY` | RunPod API Key |
| `RUNPOD_JUPYTER_TOKEN` | JupyterLab Token (legacy) |
| `SESSION_SECRET` | Session secret |
| `DGB_API_KEY` | Internal DGB API Key |
| `TRAINING_WEBHOOK_SECRET` | Training webhook secret |
| `HF_TOKEN` | Hugging Face Token |
| `ELEVENLABS_API_KEY` | ElevenLabs API Key |
| `KIE_API_KEY` | Kie.ai API Key |
| `MUREKA_API_KEY` | Mureka API Key |
| `MUSICGPT_API_KEY` | MusicGPT API Key |
| `REPLICATE_API_TOKEN` | Replicate Token |

### Environment Variables
| Variable | Description |
|----------|-------------|
| `RUNPOD_BASE_URL` | RunPod pod base URL |
| `RUNPOD_ENDPOINT_MUSIC` | Serverless endpoint ID for music |
| `RUNPOD_ENDPOINT_TRAINING` | Serverless endpoint ID for training |
| `RUNPOD_ENDPOINT_STEMS` | Serverless endpoint ID for stems |
| `DATABASE_URL` | PostgreSQL connection URL |

---

## 12. RunPod Serverless Configuration

### Step 1: Create Endpoints on RunPod
1. Go to [RunPod Console](https://www.runpod.io/console/serverless)
2. Create endpoint for music (with HeartMuLa/SAO handler)
3. Create endpoint for training (with SAO training handler)
4. Create endpoint for stems (with Demucs handler)

### Step 2: Configure Environment Variables
```
RUNPOD_API_KEY=rpa_xxxxx
RUNPOD_ENDPOINT_MUSIC=music_endpoint_id
RUNPOD_ENDPOINT_TRAINING=training_endpoint_id
RUNPOD_ENDPOINT_STEMS=stems_endpoint_id
```

### Step 3: Verify Connection
```
GET /api/serverless/health
```

### Worker Structure (Handler)
Each serverless endpoint needs a handler that processes actions:
- `generate_music` - Generates audio with HeartMuLa or SAO
- `train_model` - Fine-tunes SAO with instrument dataset
- `separate_stems` - Separates stems with Demucs

---

## 13. Complete Technology Stack

### Frontend
- React 18+
- Vite (bundler)
- TailwindCSS
- Shadcn UI
- Wouter (routing)
- TanStack Query v5
- react-i18next
- Wavesurfer.js
- Lucide React (icons)

### Backend
- Node.js
- Express.js (TypeScript)
- Drizzle ORM
- PostgreSQL (Neon)
- Multer (file uploads)
- WebSocket (ws)

### External Services
- RunPod (Serverless GPU)
- OpenAI (GPT-5.1, GPT-4.1-mini)
- Replicate (Demucs)
- Stripe (payments)
- Kie.ai (Suno V5)
- ElevenLabs (voice)
- Hugging Face (models)
- Replit Auth (authentication)

---

## 14. Internationalization (i18n)

### Supported Languages
- **Spanish** (default) - `client/src/i18n/es.json`
- **English** (secondary) - `client/src/i18n/en.json`

### Features
- Language selector in sidebar and landing page
- Persistence via localStorage (`dgb-lang`)
- All pages and components translated
- Includes training interface

---

## 15. GPU Notes and Troubleshooting

### Device Mapping
- RunPod may assign GPU as `/dev/nvidia4` instead of `/dev/nvidia0`
- Scripts automatically create symlink at startup

### HeartMuse Integration
- Installed at `/workspace/HeartMuse` with dedicated venv
- PyTorch 2.6.0+cu124
- venv path added to sys.path in all scripts

### Model Variant
- Uses HeartMuLa 3B-RL (reinforcement learning) when available
- Falls back to base 3B if RL not present

### Checkpoint Directories
- `/workspace/HeartMuse/ckpt` (primary)
- `/workspace/heartmula_ckpt` (fallback)

---

*DGB Studio - Empowering Dominican music with artificial intelligence*
