# DAGRABA Studio

**La Pura Sangre de la Bachata con el ADN de Danny Garcia y los Grandes Musicos Dominicanos**

DAGRABA Studio es una plataforma SaaS de generacion de musica impulsada por inteligencia artificial, especializada en Bachata y generos latinos. El nombre DAGRABA significa **DA**(nny) **GRA**(garcia) **BA**(chata), con la **R** de Requinto entrelazada.

Dominio: [dagraba.studio](https://dagraba.studio)

---

## Tabla de Contenidos

- [Arquitectura del Sistema](#arquitectura-del-sistema)
- [Stack Tecnologico](#stack-tecnologico)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Base de Datos](#base-de-datos)
- [Motores de IA](#motores-de-ia)
- [Sistema de Pagos](#sistema-de-pagos)
- [Autenticacion y Roles](#autenticacion-y-roles)
- [Funcionalidades Principales](#funcionalidades-principales)
- [Sistema de Generos y Tocadas](#sistema-de-generos-y-tocadas)
- [Pipeline de Entrenamiento](#pipeline-de-entrenamiento)
- [DAGRABA Sampler VST3](#dagraba-sampler-vst3)
- [Internacionalizacion](#internacionalizacion)
- [Variables de Entorno](#variables-de-entorno)
- [Scripts y Comandos](#scripts-y-comandos)
- [Dependencias Externas](#dependencias-externas)

---

## Arquitectura del Sistema

DAGRABA Studio emplea una arquitectura orientada a microservicios con separacion clara entre frontend y backend, sirviendo ambos desde un unico servidor Express + Vite.

```
Cliente (React + Vite)
    |
    v
Servidor Express (TypeScript)
    |
    +-- PostgreSQL (Neon) via Drizzle ORM
    +-- Stripe (Pagos, Suscripciones, Connect)
    +-- RunPod Serverless GPU (Generacion Musical)
    +-- OpenAI (Letras, Chatbot, Enriquecimiento de Prompts)
    +-- Kie.ai (Suno V5 Fallback)
    +-- Replicate (Separacion de Stems)
    +-- Replit Auth (Autenticacion OIDC)
```

---

## Stack Tecnologico

### Frontend
| Tecnologia | Uso |
|---|---|
| React 18 | Framework UI |
| Vite | Bundler y servidor de desarrollo |
| TailwindCSS | Estilos utilitarios |
| Shadcn UI / Radix UI | Componentes de interfaz |
| Wouter | Enrutamiento SPA |
| TanStack React Query v5 | Manejo de estado del servidor |
| React Hook Form + Zod | Formularios con validacion |
| Framer Motion | Animaciones |
| Wavesurfer.js | Visualizacion de formas de onda |
| Web Audio API | Motor de audio personalizado (mixer DAW) |
| react-i18next | Internacionalizacion |
| Recharts | Graficos y analiticas |
| Lucide React / React Icons | Iconografia |

### Backend
| Tecnologia | Uso |
|---|---|
| Express.js (TypeScript) | Servidor API REST |
| Drizzle ORM | ORM para PostgreSQL |
| PostgreSQL (Neon) | Base de datos principal |
| Passport + OpenID Connect | Autenticacion via Replit Auth |
| Stripe SDK | Pagos, suscripciones, Connect |
| OpenAI SDK | Generacion de letras y chatbot |
| Multer | Subida de archivos |
| TSX | Ejecucion de TypeScript |

### Infraestructura
| Servicio | Uso |
|---|---|
| Replit | Hosting y despliegue |
| RunPod Serverless | GPU para generacion musical |
| Neon | PostgreSQL gestionado |
| Stripe | Procesamiento de pagos |
| Replicate | Separacion de stems (Demucs) |

---

## Estructura del Proyecto

```
dagraba-studio/
|
+-- client/                          # Frontend React
|   +-- src/
|       +-- components/
|       |   +-- ui/                  # Componentes Shadcn UI (50+)
|       |   +-- admin/               # Tabs del panel de administracion
|       |   |   +-- GenreStylesTab.tsx
|       |   |   +-- TrainingDatasetsTab.tsx
|       |   +-- app-sidebar.tsx      # Sidebar principal de navegacion
|       |   +-- AudioPlayer.tsx      # Reproductor de audio
|       |   +-- AudioSpectrum.tsx    # Espectro de audio
|       |   +-- CoverArtDesigner.tsx # Disenador de portadas
|       |   +-- FooterPlayerBar.tsx  # Barra de reproduccion fija
|       |   +-- LyricsGenerator.tsx  # Generador de letras IA
|       |   +-- MashupDialog.tsx     # Dialog de AI Mashup
|       |   +-- MusicGenerator.tsx   # Componente de generacion musical
|       |   +-- NowPlayingBanner.tsx # Banner de cancion actual
|       |   +-- SongActionMenu.tsx   # Menu de acciones por cancion
|       |   +-- SongHistory.tsx      # Historial de canciones
|       |   +-- SupportChat.tsx      # Chatbot de soporte IA
|       |
|       +-- contexts/
|       |   +-- PlayerContext.tsx     # Contexto global del reproductor
|       |
|       +-- hooks/                   # Custom hooks
|       |   +-- use-admin.ts         # Hooks del panel admin
|       |   +-- use-audio-engine.ts  # Motor de audio Web Audio API
|       |   +-- use-auth.ts          # Autenticacion
|       |   +-- use-credits.ts       # Sistema de creditos
|       |   +-- use-lyrics.ts        # Generacion de letras
|       |   +-- use-samples.ts       # Gestion de samples
|       |   +-- use-songs.ts         # CRUD de canciones
|       |   +-- use-stripe.ts        # Integracion Stripe
|       |   +-- use-style-kits.ts    # Style Kits
|       |   +-- use-tracks.ts        # Pistas de audio
|       |   +-- use-voice-models.ts  # Modelos de voz
|       |
|       +-- i18n/                    # Archivos de traduccion
|       |   +-- es.json              # Espanol (predeterminado)
|       |   +-- en.json              # Ingles
|       |
|       +-- lib/                     # Utilidades
|       |   +-- auth-utils.ts
|       |   +-- queryClient.ts       # Configuracion TanStack Query
|       |   +-- utils.ts
|       |
|       +-- pages/                   # Paginas de la aplicacion
|       |   +-- AdminPage.tsx        # Panel de administracion (16+ tabs)
|       |   +-- ArtistDashboardPage.tsx  # Dashboard del artista
|       |   +-- ArtistOnboardingPage.tsx # Registro de artista PRO
|       |   +-- ArtistProfilePage.tsx    # Perfil publico del artista
|       |   +-- AudioToolsPage.tsx   # Herramientas de audio
|       |   +-- BlogPage.tsx         # Blog de la plataforma
|       |   +-- CopyrightHubPage.tsx # Hub de derechos de autor
|       |   +-- CoverDesignerPage.tsx # Disenador de portadas
|       |   +-- CreatePage.tsx       # Pagina de creacion musical
|       |   +-- Dashboard.tsx        # Dashboard principal
|       |   +-- DiscographyPage.tsx  # Discografia del artista
|       |   +-- DiscoverPage.tsx     # Descubrir musica
|       |   +-- HomePage.tsx         # Pagina de inicio
|       |   +-- Landing.tsx          # Landing page
|       |   +-- LegalPage.tsx        # Pagina legal
|       |   +-- LibraryPage.tsx      # Biblioteca musical
|       |   +-- LyricsPage.tsx       # Pagina de letras
|       |   +-- MyPlaylistsPage.tsx  # Playlists del usuario
|       |   +-- MyPlaylistDetailPage.tsx
|       |   +-- PlaylistPage.tsx     # Playlist individual
|       |   +-- PricingPage.tsx      # Planes y precios
|       |   +-- ProducerStorePage.tsx # Tienda de productores
|       |   +-- PublicPlaylistViewPage.tsx
|       |   +-- QuizPage.tsx         # Quiz de Bachata
|       |   +-- SampleLab.tsx        # Laboratorio de samples
|       |   +-- Studio.tsx           # DAW Studio profesional
|       |   +-- StyleKitsPage.tsx    # Kits de estilo
|       |   +-- VoiceLab.tsx         # Laboratorio de voz
|       |
|       +-- App.tsx                  # Componente raiz y enrutamiento
|       +-- main.tsx                 # Punto de entrada
|       +-- index.css                # Estilos globales y variables CSS
|
+-- server/                          # Backend Express
|   +-- core/                        # Motores y logica de negocio
|   |   +-- adapters/               # Adaptadores de proveedores de IA
|   |   |   +-- index.ts
|   |   |   +-- kie_adapter.ts      # Adaptador Kie.ai (Suno V5)
|   |   |   +-- replicate_adapter.ts
|   |   |   +-- runpod_music_adapter.ts
|   |   +-- antigravity_engine.ts   # Motor de enriquecimiento de prompts
|   |   +-- dgb_runpod_api.ts       # API RunPod para DGB Cloud
|   |   +-- elevenlabs_engine.ts    # Motor ElevenLabs (voz)
|   |   +-- generic_api_engine.ts   # Motor API generico
|   |   +-- kie_engine.ts           # Motor Kie.ai
|   |   +-- music_engine.ts         # Orquestador principal de generacion
|   |   +-- musicgpt_engine.ts      # Motor MusicGPT (fallback)
|   |   +-- prompt_engine.ts        # Motor de prompts musicales
|   |   +-- provider_pipeline.ts    # Pipeline de proveedores con fallback
|   |   +-- quiz_engine.ts          # Motor del quiz
|   |   +-- replicate_stems_engine.ts
|   |   +-- runpod_client.ts        # Cliente RunPod
|   |   +-- runpod_music_engine.ts  # Motor RunPod para musica
|   |   +-- runpod_serverless.ts    # Gestion RunPod Serverless
|   |   +-- runpod_stems_engine.ts  # Stems via RunPod
|   |   +-- sao_training_engine.ts  # Entrenamiento SAO
|   |   +-- seed_providers.ts       # Seed de proveedores
|   |   +-- spotify_client.ts       # Cliente API Spotify
|   |   +-- stems_engine.ts         # Motor de separacion de stems
|   |   +-- voice_training_engine.ts
|   |
|   +-- replit_integrations/        # Integraciones Replit
|   |   +-- auth/                   # Autenticacion OIDC
|   |   +-- audio/                  # Audio IA
|   |   +-- batch/                  # Procesamiento batch
|   |   +-- chat/                   # Chat IA
|   |   +-- image/                  # Generacion de imagenes
|   |
|   +-- workers/                    # Workers asincrono
|   |   +-- music_tasks.ts          # Tareas de generacion musical
|   |   +-- sample_tasks.ts         # Tareas de procesamiento de samples
|   |
|   +-- runpod_handler/             # Handler Docker para RunPod
|   |   +-- Dockerfile
|   |   +-- handler.py
|   |
|   +-- training_server/            # Servidor de entrenamiento GPU
|   |   +-- main.py
|   |   +-- setup.sh
|   |   +-- do_setup.sh
|   |
|   +-- scripts/
|   |   +-- dgb_api_receptor.py     # Receptor API DGB
|   |
|   +-- index.ts                    # Punto de entrada del servidor
|   +-- routes.ts                   # Todas las rutas API (~7000 lineas)
|   +-- storage.ts                  # Interfaz y implementacion de storage (~2000 lineas)
|   +-- db.ts                       # Conexion a base de datos
|   +-- stripeClient.ts             # Cliente Stripe configurado
|   +-- webhookHandlers.ts          # Handlers de webhooks (Stripe, RunPod)
|   +-- vite.ts                     # Configuracion Vite SSR
|   +-- static.ts                   # Archivos estaticos
|
+-- shared/                          # Codigo compartido frontend/backend
|   +-- schema.ts                    # Esquema DB Drizzle + tipos Zod (1600+ lineas)
|   +-- routes.ts                    # Definicion de rutas compartidas
|   +-- models/
|       +-- auth.ts                  # Modelos de autenticacion
|       +-- chat.ts                  # Modelos de chat
|
+-- scripts/                         # Scripts de utilidad
|   +-- dataset_creator/             # Pipeline de creacion de datasets
|   |   +-- clean_lakh_dataset.py    # Limpieza de MIDI (Lakh Dataset)
|   |   +-- create_json_metadata.py  # Metadata via Spotify/LastFM
|   |   +-- create_prompts.py        # Generacion de prompts via LLM
|   |   +-- render_songs.py          # Renderizado de audio
|   |   +-- instruments_map.py       # Mapeo GM a VST3
|   |   +-- setup_runpod_instruments.sh
|   |
|   +-- runpod_serverless/           # Despliegue RunPod Serverless
|   |   +-- Dockerfile
|   |   +-- handler.py
|   |   +-- DEPLOY.md
|   |
|   +-- seed-products.ts            # Seed de productos Stripe
|   +-- dgb_training_server.py      # Servidor de entrenamiento
|   +-- gpu_droplet_setup.sh        # Setup GPU DigitalOcean
|
+-- vst3_plugins/                    # Plugin VST3 personalizado
|   +-- build_runpod.sh             # Script de compilacion en RunPod
|   +-- dagraba_sampler/            # DAGRABA Sampler
|       +-- CMakeLists.txt
|       +-- source/
|           +-- dag_controller.cpp/h
|           +-- dag_processor.cpp/h
|           +-- dag_sampler_engine.h
|           +-- dag_factory.cpp
|           +-- dag_ids.h
|           +-- version.h
|
+-- package.json                     # Dependencias npm
+-- tsconfig.json                    # Configuracion TypeScript
+-- tailwind.config.ts               # Configuracion Tailwind
+-- vite.config.ts                   # Configuracion Vite
+-- drizzle.config.ts                # Configuracion Drizzle
+-- replit.md                        # Documentacion interna del agente
+-- README.md                        # Este archivo
```

---

## Base de Datos

PostgreSQL alojado en Neon, gestionado con Drizzle ORM. El esquema contiene **48 tablas**:

### Tablas Principales

| Tabla | Descripcion |
|---|---|
| `songs` | Canciones generadas (titulo, prompt, URL de audio, estado, genero) |
| `lyrics` | Letras generadas por IA |
| `tracks` | Pistas individuales (stems) de canciones |
| `samples` | Samples de audio subidos/grabados por usuarios |
| `cover_designs` | Disenos de portada generados |

### Artistas y Monetizacion

| Tabla | Descripcion |
|---|---|
| `artist_profiles` | Perfiles de artista (nombre, bio, generos, redes sociales, Stripe Connect) |
| `artist_wallets` | Billeteras de artistas (balance en centavos) |
| `wallet_transactions` | Historial de transacciones de billetera |
| `payout_requests` | Solicitudes de pago (estado: pending/processing/paid/failed) |
| `artist_gifts` | Regalos de fans a artistas |
| `song_earnings` | Ganancias por cancion |
| `pro_registrations` | Registros de artista PRO |
| `artist_followers` | Seguidores de artistas |
| `artist_subscriptions` | Suscripciones a artistas |
| `artist_profile_likes/comments/shares` | Interacciones sociales |

### Contenido y Comunidad

| Tabla | Descripcion |
|---|---|
| `user_playlists` | Playlists de usuario |
| `user_playlist_songs` | Canciones en playlists |
| `song_likes` | Likes de canciones |
| `discography_albums` | Albums de discografia |
| `discography_tracks` | Tracks de discografia |
| `blog_posts/comments/likes/shares/stars/categories` | Sistema de blog |

### Plataforma y Configuracion

| Tabla | Descripcion |
|---|---|
| `platform_settings` | Configuracion de la plataforma |
| `pricing_plans` | Planes de suscripcion |
| `api_providers` | Proveedores de API configurados |
| `api_endpoints` | Endpoints de API |
| `cloud_servers` | Servidores GPU en la nube |
| `genre_styles` | Estilos de genero (Tocadas) |
| `style_kits` | Kits de estilo de instrumentos |
| `style_kit_instruments` | Instrumentos dentro de Style Kits |
| `training_datasets` | Datasets de entrenamiento |
| `training_files` | Archivos de datasets |

### Propiedad Intelectual

| Tabla | Descripcion |
|---|---|
| `copyright_works` | Obras registradas |
| `copyright_contributors` | Contribuidores de obras |
| `publisher_entities` | Entidades editoriales |

### Soporte

| Tabla | Descripcion |
|---|---|
| `support_tickets` | Tickets de soporte |
| `support_messages` | Mensajes de soporte |

### Voz y Modelos

| Tabla | Descripcion |
|---|---|
| `voice_models` | Modelos de voz entrenados |
| `voice_samples` | Muestras de voz para entrenamiento |
| `quiz_results` | Resultados del quiz de Bachata |

---

## Motores de IA

### Pipeline de Generacion Musical (Orden de Prioridad)

1. **RunPod Serverless GPU (Prioridad 1)** - Motor principal
   - SAO Instrumental Finetune (`santifiorino/SAO-Instrumental-Finetune`)
   - HeartMuLa para pistas vocales (soporte nativo en espanol)
   - GPU privada, cero costo de API de terceros
   - Precision de tempo: ~88%
   - Entrega basada en webhooks

2. **Kie.ai (Prioridad 2)** - Fallback
   - Integracion Suno V5 para generacion de alta calidad con vocales
   - Incluye API de AI Mashup (mezcla de 2 tracks existentes)

3. **DGB AUDIO Engine (Prioridad 3)** - Ultimo recurso
   - Basado en MusicGPT
   - FastAPI/Uvicorn en GPU privada

### Motor de Enriquecimiento de Prompts (Antigravity Engine)
- Transforma prompts simples del usuario en instrucciones detalladas para los motores de generacion
- Utiliza OpenAI GPT para analisis y expansion de prompts

### Generacion de Letras
- OpenAI GPT-5.1 para letras en espanol
- Estilos: Bachata, Bolero, Merengue, Salsa, Reggaeton

### Separacion de Stems
- Sistema multi-tier de fallback:
  1. GPU Privada (Cloud)
  2. Replicate Serverless (Demucs)
  3. API Generica
  4. MusicGPT
- Produce 4 stems: vocal, bateria, bajo, melodia

### Dual Instrument Engine (Renderizado MIDI-a-Audio)

| Motor | Instrumentos | Uso |
|---|---|---|
| **FluidSynth + FluidR3_GM.sf2** | 128 melodicos GM + 47 percusion | Motor predeterminado |
| **DAGRABA Sampler VST3** | 12 instrumentos Bachata especificos | Motor especializado |

Variable `RENDER_ENGINE`: `fluidsynth` (default), `vst3`, `hybrid`

---

## Sistema de Pagos

### Suscripciones (Stripe)
- Planes: Basic, Pro, Premium
- Facturacion: Mensual y anual
- Descuentos anuales: Basic 20%, Pro 25%, Premium 30%

### Ecosistema de Monetizacion de Artistas
- **Regalos de Fans**: Los fans pueden enviar regalos monetarios a artistas
- **Billetera del Artista**: Balance en centavos con historial de transacciones
- **Ganancias por Cancion**: Tracking de revenue por cada cancion

### Metodos de Pago para Artistas
| Metodo | Procesamiento |
|---|---|
| Stripe Connect Express | Automatico (transferencias directas) |
| Cuenta Bancaria | Via Stripe Connect |
| Tarjeta Instantanea | Via Stripe Connect |
| PayPal | Revision manual por admin |

### Flujo de Payouts
```
Artista solicita pago (pending)
    |
    +-- [Stripe Connect] --> Transferencia automatica --> paid
    |
    +-- [PayPal] --> Admin revisa --> approve --> processing --> mark-paid --> paid
    |                              --> reject --> failed
```

### Panel Admin de Pagos
- Tab "Pagos Artistas" en `/admin`
- Tarjetas resumen: pendientes, procesando, total pagado
- Filtros por estado
- Acciones: Aprobar, Rechazar (con razon), Marcar como Pagado

---

## Autenticacion y Roles

### Autenticacion
- Replit Auth (OpenID Connect)
- Sesiones con `express-session` + `connect-pg-simple`

### Sistema de Roles
| Rol | Nivel | Acceso |
|---|---|---|
| `super_admin` | 3 | Acceso total (configuracion, proveedores, servidores, facturacion) |
| `admin` | 2 | Dashboard, usuarios, suscripciones, pagos, soporte, estilos, GPU |
| `moderator` | 1 | Soporte unicamente |
| `user` | 0 | Funcionalidades de usuario normal |

El acceso es jerarquico: cada rol incluye los permisos de los roles inferiores.

---

## Funcionalidades Principales

### Creacion Musical
- **CreatePage**: Interfaz principal para generar musica con IA
- Seleccion de genero, sub-estilo (Tocada), instrumentos
- Panel de orquestacion dinamico
- Modo Bachata con instrumentos especializados

### Studio DAW
- Mixer digital profesional con Web Audio API
- Timeline con formas de onda
- Channel strip por pista: VU meters, faders, pan, EQ de 3 bandas, compresor, reverb
- Master bus con EQ, compresor, ganancia, analizador
- Herramientas de IA integradas

### Sample Lab
- Grabacion de audio directa
- Subida de archivos de audio
- AI Remixing de samples

### Biblioteca Musical
- Gestion de canciones generadas
- Reproduccion, descarga, compartir
- Historial de generacion

### Discover (Streaming Social)
- Modelo tipo Spotify
- Canciones publicas reproducibles, con like y compartir
- NO descargables por no-propietarios
- Playlists publicas de artistas

### Perfil de Artista
- Registro PRO requerido
- Banner y avatar personalizados (subida de imagenes)
- Bio, generos (hasta 5), redes sociales
- Handle auto-generado
- Tracking de vistas de perfil

### Discografia
- Gestion de albums y tracks
- Importacion desde Spotify

### Copyright Hub
- Registro de obras
- Gestion de contribuidores
- Entidades editoriales

### AI Mashup
- Mezcla de 2 tracks existentes via Kie.ai Mashup API

### Blog
- Sistema completo de blog con categorias
- Comentarios, likes, shares, valoraciones

### Soporte
- Chatbot IA integrado (OpenAI)
- Sistema de tickets con estados
- Respuestas de administradores

---

## Sistema de Generos y Tocadas

Sistema dinamico basado en base de datos para definir estilos de interpretacion (tocadas) especificos por genero.

### Generos y Sub-estilos Disponibles

| Genero | Tocadas |
|---|---|
| **Bachata** | Tradicional, Moderna, Sensual, Urbana, Rosa |
| **Bolero** | Romantico, Ranchero, Son, Moderno |
| **Merengue** | Majao, Derecho, Mambo, Tipico, De Salon |
| **Salsa** | Dura, Romantica, Urbana |

Cada tocada define:
- Instrumentos base y extra
- Prompt hint para el motor de IA
- Asociacion con Style Kit
- Orden de presentacion

Gestion via tab "Tocadas" en el panel de administracion.

---

## Pipeline de Entrenamiento

### Dataset Creator (`scripts/dataset_creator/`)

Pipeline de 4 pasos para crear datasets de entrenamiento:

1. **Clean MIDI** (`clean_lakh_dataset.py`) - Limpieza del Lakh MIDI Dataset
2. **Metadata** (`create_json_metadata.py`) - Enriquecimiento con Spotify/LastFM
3. **Prompts** (`create_prompts.py`) - Generacion de prompts via LLM
4. **Audio Rendering** (`render_songs.py`) - Renderizado con FluidSynth/VST3

### Fuentes de Datos
- Lakh MIDI Dataset (subconjunto limpio)
- Million Song Dataset (MSD - 300GB)
- craffel/midi-dataset
- Subidas MIDI personalizadas

### Gestion
- Tab "Training Data" en panel admin
- Tablas: `training_datasets` + `training_files`
- Tracking de estado del pipeline

---

## DAGRABA Sampler VST3

Plugin VST3 personalizado en C++ (Steinberg VST3 SDK, licencia MIT).

### 12 Presets de Instrumentos Bachata

| Instrumento | Descripcion |
|---|---|
| Requinto | Guitarra lider de Bachata |
| Segunda Guitarra | Guitarra ritmica |
| Bongo | Percusion de bongo |
| Conga | Percusion de conga |
| Guira | Raspador metalico |
| Timbal | Timbales |
| Campanas | Campanas/cencerros |
| Bajo | Bajo electrico |
| Piano | Piano |
| Pad | Sintetizador pad |
| Strings (Violines) | Seccion de violines |
| Strings (Chelos) | Seccion de chelos |

### Especificaciones
- Sample-based con envolvente ADSR
- 32 voces de polifonia
- Soporte WAV multi-velocidad
- Compilacion en RunPod via boton admin "Build VST3"
- Renderizado via pedalboard (Spotify)

### Archivos
- Codigo fuente: `vst3_plugins/dagraba_sampler/`
- Plugin compilado: `/runpod-volume/vst3/DAGRABA_Sampler.vst3`
- Samples: `/runpod-volume/vst3/samples/<InstrumentName>/`

---

## Internacionalizacion

- Framework: `react-i18next`
- Idioma predeterminado: Espanol (`es`)
- Idiomas soportados: Espanol, Ingles
- Archivos: `client/src/i18n/es.json`, `client/src/i18n/en.json`

---

## Variables de Entorno

### Requeridas
| Variable | Descripcion |
|---|---|
| `DATABASE_URL` | URL de conexion PostgreSQL (Neon) |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe |
| `STRIPE_PUBLISHABLE_KEY` | Clave publica de Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secreto del webhook de Stripe |
| `OPENAI_API_KEY` | Clave API de OpenAI |
| `REPLIT_DOMAINS` | Dominio para Replit Auth |
| `SESSION_SECRET` | Secreto de sesiones Express |

### Opcionales / Servicios Externos
| Variable | Descripcion |
|---|---|
| `RUNPOD_API_KEY` | Clave API de RunPod |
| `RUNPOD_ENDPOINT_MUSIC` | Endpoint de RunPod para musica |
| `RUNPOD_ENDPOINT_STEMS` | Endpoint de RunPod para stems |
| `REPLICATE_API_TOKEN` | Token API de Replicate |
| `KIE_API_KEY` | Clave API de Kie.ai |
| `SPOTIFY_CLIENT_ID` | ID de cliente Spotify |
| `SPOTIFY_CLIENT_SECRET` | Secreto de cliente Spotify |
| `RENDER_ENGINE` | Motor de renderizado: `fluidsynth`, `vst3`, `hybrid` |
| `DGB_CLOUD_URL` | URL del servidor DGB Cloud GPU |

---

## Scripts y Comandos

```bash
# Desarrollo
npm run dev              # Inicia servidor de desarrollo (Express + Vite)

# Produccion
npm run build            # Construye la aplicacion
npm run start            # Inicia en produccion

# Base de datos
npm run db:push          # Sincroniza esquema con la base de datos

# Verificacion
npm run check            # Verifica tipos TypeScript
```

---

## Dependencias Externas

| Servicio | Rol | Estado |
|---|---|---|
| HeartMuLa | Generacion vocal con soporte nativo en espanol | Self-hosted (RunPod) |
| SAO Instrumental Finetune | Modelo de generacion instrumental fine-tuned | Self-hosted (RunPod) |
| OpenAI | Letras, chatbot, enriquecimiento de prompts | API externa |
| Stripe | Pagos, suscripciones, Connect para artistas | API externa |
| Neon | PostgreSQL gestionado | Servicio cloud |
| Replicate | Separacion de stems (Demucs) | API serverless |
| Kie.ai | Suno V5 + Mashup (fallback de generacion) | API externa |
| Spotify API | Importacion de discografia, metadata | API externa |
| Replit Auth | Autenticacion OIDC | Integracion nativa |
| Wavesurfer.js | Visualizacion de formas de onda | Libreria frontend |

---

## Diseno Visual

- **Modo**: Dark mode con fondo oscuro
- **Color primario**: Neon Pink (#FF1493)
- **Color secundario**: Orange (#FF8C00)
- **Gradientes**: Pink-to-orange
- **Logo**: Forma de onda neon pink sobre fondo negro
- **Tipografias**: Inter (texto), JetBrains Mono (codigo)
- **Enfoque**: Mobile-first, responsive
- **Sub-marcas**:
  - DAGRABACHATA: Usa pink primario
  - DAGRABOLERO: Usa acentos naranja

---

*DAGRABA Studio - Donde la tecnologia se encuentra con la tradicion musical dominicana.*
