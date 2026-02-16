# DGB Studio - Documento Completo del Proyecto

**"La Pura Sangre de la Bachata con el ADN de Danny Garcia y los Grandes Musicos Dominicanos"**

**Fecha:** Febrero 2026  
**Version:** 2.0

---

## 1. Vision General

DGB Studio es una plataforma SaaS de inteligencia artificial para la creacion de musica, especializada en Bachata y Boleros. La plataforma permite a musicos y productores generar musica de alta calidad utilizando modelos de IA entrenados con el ADN sonoro de instrumentos reales dominicanos.

### Propuesta de Valor
- Generacion de musica con IA usando modelos propios entrenados con instrumentos reales
- Separacion de stems por IA (vocales, bateria, bajo, melodia)
- Studio de audio multitrack con herramientas de IA
- Entrenamiento de modelos personalizados con Style Kits
- Descubrimiento publico de musica
- Soporte completo en Espanol e Ingles

---

## 2. Arquitectura del Sistema

### Frontend
- **Stack:** React + Vite + TailwindCSS + Shadcn UI
- **Tema:** Modo oscuro con fondo purpura profundo (`hsl 270 30% 7%`), cyan primario (`#00C8FF`), acentos magenta (`#D946EF`)
- **Fuentes:** Inter (texto), JetBrains Mono (codigo)
- **Logo:** DGB Studio 2 transparente con efectos glow cyan/magenta
- **i18n:** Espanol (por defecto) e Ingles con react-i18next

### Backend
- **Stack:** Express.js (TypeScript)
- **Base de Datos:** PostgreSQL (Neon)
- **Autenticacion:** Replit Auth (OpenID Connect)
- **Pagos:** Stripe (suscripciones mensuales/anuales)
- **ORM:** Drizzle ORM

### Infraestructura GPU
- **RunPod Serverless** para generacion de musica y entrenamiento de modelos
- **RunPod Dedicado** como respaldo (JupyterLab WebSocket)
- **Replicate** para separacion de stems (Demucs serverless)
- Auto-escalado a cero cuando esta inactivo (pago por segundo)

---

## 3. Motores de IA

### 3.1 HeartMuLa (Motor Principal)
- **Modelo:** 3B parametros (variante RL - Reinforcement Learning)
- **Capacidad:** Canciones completas con vocales y letras
- **Soporte nativo de Espanol**
- **Corriendo en:** RunPod Serverless GPU
- **Pipeline:** heartlib -> HeartMuLaGenPipeline
- **Checkpoints:** HeartMuLa-RL-oss-3B, HeartCodec-oss

### 3.2 Stable Audio Open (Motor Instrumental)
- **Modelo:** Diffusion condicionada por texto
- **Capacidad:** Generacion instrumental (hasta 47s por segmento)
- **Soporte de modelos fine-tuned** desde Style Kits
- **Sample Rate:** 44100 Hz, Stereo
- **Fallback:** Pipeline de Diffusers si stable-audio-tools no esta disponible

### 3.3 Kie.ai (API Cloud - Prioridad 3)
- **Modelo:** Suno V5
- **Costo:** ~$0.06 por cancion
- **Capacidades:** Generacion, extension, covers, separacion de stems
- **Fallback** despues de HeartMuLa y SAO

### 3.4 Motor Antigravedad (Enriquecimiento de Prompts)
- **Usa OpenAI** para letras, arreglos y enriquecimiento de prompts
- **Mapeo de generos** con instrumentos especificos por genero
- **Traduccion automatica** de prompts en espanol a descripciones optimizadas en ingles

### 3.5 Cadena de Fallback
```
HeartMuLa (GPU Privado) -> SAO (GPU Privado) -> Kie.ai (Cloud API) -> Generic API -> MusicGPT
```

---

## 4. Generacion de Musica con ADN Propio

### 4.1 Flujo de Creacion
1. Usuario selecciona genero (Bachata, Bolero, Salsa, etc.)
2. Escribe prompt o usa presets de estilo DGB
3. Opcionalmente genera letras con IA (GPT-5.1)
4. Motor Antigravedad enriquece el prompt con tags de genero
5. HeartMuLa genera la cancion en RunPod Serverless
6. Audio se procesa y entrega al usuario

### 4.2 Configuracion del Prompt
- **Tags de genero:** BPM, compas, instrumentos especificos
- **Presets DGB:** Bachata romantica, Bolero clasico, Salsa dura
- **Duracion:** 1:00 a 5:00 minutos (selector Pro Controls)
- **Modo Bachata:** Sonidos de instrumentos especificos del genero

### 4.3 RunPod Serverless para Generacion
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

## 5. Style Kits y Entrenamiento de Modelos

### 5.1 Que son los Style Kits
Los Style Kits son colecciones de instrumentos reales que se usan para entrenar modelos de IA personalizados. Cada kit captura el "ADN sonoro" de un estilo musical.

### 5.2 Kits Existentes

#### DGB Bachata (ID: 3)
- **Genero:** Bachata
- **Instrumentos:** 7 planificados
- **Estado:** En proceso de subida

#### DGB Bolero (ID: 11)
- **Genero:** Bolero
- **Instrumentos:** 17/17 completos
  - 12 instrumentos grabados realmente
  - 5 instrumentos generados por IA (via Kie.ai)
- **Instrumentos incluidos:**
  - Guitarra acustica (nylon), Requinto, Bongo
  - Piano, Contrabajo, Violin, Viola, Cello
  - Flauta, Clarinete, Trompeta con sordina
  - Guiro suave, Maracas, Conga, Timbales suaves
  - Coro vocal, Cuerdas orquestales

### 5.3 Pipeline de Entrenamiento (5 Pasos)

```
Subir -> Analizar -> Generar Prompts -> Entrenar -> Listo
 0-20%    20-40%      40-60%          60-80%      100%
```

1. **Subir Instrumentos** - Cargar audio WAV/MP3 de cada instrumento
2. **Analizar Audio** - Librosa detecta BPM, tonalidad, energia, acusticidad
3. **Generar Prompts IA** - OpenAI crea prompts de entrenamiento por instrumento
4. **Entrenar Modelo** - Fine-tuning de Stable Audio Open en RunPod Serverless
5. **Modelo Listo** - Modelo entrenado disponible para generacion

### 5.4 RunPod Serverless para Entrenamiento
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

### 5.5 Configuracion de Entrenamiento
- **Learning Rate:** 5e-5
- **Batch Size:** 1
- **Epochs:** 100
- **EMA:** Activado
- **Sample Rate:** 44100 Hz
- **Canales:** 2 (Stereo)
- **Tipo de Modelo:** diffusion_cond

### 5.6 Generos Soportados
| Genero | Hint de Estilo |
|--------|---------------|
| Bachata | Requinto, bongo, guira, feel romantico |
| Bolero | Guitarra nylon, percusion suave, atmosfera intima |
| Salsa | Piano montuno, timbales, congas, metales |
| Merengue | Acordeon, tambora, guira, ritmo energetico |
| Cumbia | Acordeon, guacharaca, ritmos tropicales |
| Reggaeton | Dembow beat, 808 bass, produccion urbana |
| Son | Tres, bongo, claves, feel caribeno |
| Latin Pop | Piano, guitarra acustica, produccion moderna |
| Vallenato | Acordeon paseos, caja, sonido colombiano |
| Tropical | Percusion calida, metales, influencias caribenas |

---

## 6. Separacion de Stems

### 6.1 Motor Multi-tier
1. **RunPod Serverless** (Demucs) - Primera opcion
2. **Replicate** (Demucs serverless) - Fallback
3. **Generic API Providers** - Configurables
4. **MusicGPT** - Ultimo recurso

### 6.2 Stems Producidos
- Vocales
- Bateria
- Bajo
- Melodia

---

## 7. Paginas y Funcionalidades

### 7.1 Crear Musica (`/create`)
- Interfaz estilo Suno con selector de genero
- Generador de letras con IA
- Controles Pro: duracion, engine, semilla
- Presets de estilo DGB
- Vista de historial de canciones

### 7.2 Biblioteca (`/library`)
- Canciones del usuario
- Reproductor de audio integrado
- Descarga en MP3
- Separacion de stems por cancion

### 7.3 Studio (`/studio`)
- Editor multitrack
- Separacion de stems por IA
- Controles de pista (volumen, pan, mute, solo)
- Herramientas de IA para mezcla

### 7.4 Sample Lab (`/sample-lab`)
- Grabacion de audio
- Carga de archivos
- AI Remix
- Deteccion de tonalidad y BPM

### 7.5 Descubrir (`/discover`)
- Carousel de playlists por genero
- Grid de canciones trending
- Tarjetas estilo MusicGPT con plays, likes, duracion
- Top 100 general y Top 20 por genero
- Accesible sin autenticacion

### 7.6 Style Kits (`/style-kits`)
- Gestion de kits de instrumentos
- Pipeline de entrenamiento visual (5 pasos)
- Barra de progreso en tiempo real
- Estado de conexion GPU
- Subida de instrumentos individuales

### 7.7 Blog (`/blog`)
- Sistema completo estilo WordPress
- Comentarios, likes, estrellas (1-5), compartir
- Editor admin con subida de imagenes
- Filtros por categoria y busqueda

### 7.8 Admin (`/admin`)
- Panel de administracion (solo owner)
- Gestion de proveedores API
- Configuracion de servidores GPU
- Gestion de usuarios y roles
- Planes de precios y Stripe
- Configuracion de plataforma

### 7.9 Landing Page (`/`)
- Pagina de presentacion con branding DGB Studio
- Selector de idioma
- Links a registro y login

---

## 8. Sistema de Suscripciones

### Planes Disponibles
| Plan | Precio | Creditos | Caracteristicas |
|------|--------|----------|-----------------|
| Free | $0/mes | Limitados | Generacion basica |
| Pro | Variable | Mas creditos | Funciones avanzadas |
| Producer | Variable | Aun mas | Studio completo |
| Premium | Variable | Ilimitados | Todo incluido |

### Integracion Stripe
- Checkout embebido
- Suscripciones mensuales y anuales
- Webhooks para actualizacion de estado
- Gestion de planes desde panel admin

---

## 9. Roles de Usuario

| Rol | Permisos |
|-----|----------|
| `super_admin` | Acceso total, gestion de plataforma |
| `admin` | Panel admin, gestion de contenido |
| `moderator` | Moderacion de contenido |
| `user` | Funcionalidades estandar |

---

## 10. APIs y Webhooks

### Endpoints Principales
| Ruta | Metodo | Descripcion |
|------|--------|-------------|
| `/api/songs` | POST | Crear cancion |
| `/api/songs` | GET | Listar canciones del usuario |
| `/api/songs/:id/stems` | POST | Separar stems |
| `/api/style-kits` | GET/POST | Gestionar Style Kits |
| `/api/style-kits/:id/instruments` | GET/POST | Instrumentos del kit |
| `/api/style-kits/:id/analyze` | POST | Analizar instrumentos |
| `/api/style-kits/:id/train` | POST | Iniciar entrenamiento |
| `/api/style-kits/:id/training-status` | GET | Estado del entrenamiento |
| `/api/serverless/health` | GET | Estado de RunPod Serverless |
| `/api/public/charts` | GET | Charts publicos |
| `/api/public/charts/:genre` | GET | Charts por genero |
| `/api/pricing/plans` | GET | Planes de precios |

### Webhooks
| Ruta | Origen | Descripcion |
|------|--------|-------------|
| `/api/webhooks/runpod-serverless` | RunPod Serverless | Resultados de generacion y entrenamiento |
| `/api/webhooks/runpod-music` | RunPod Dedicado | Resultados de generacion (legacy) |
| `/api/webhooks/runpod-stems` | RunPod | Resultados de separacion de stems |
| `/api/training/webhook` | GPU Cloud | Actualizaciones de entrenamiento |

---

## 11. Variables de Entorno Requeridas

### Secretos (Sensibles)
| Variable | Descripcion |
|----------|-------------|
| `RUNPOD_API_KEY` | API Key de RunPod |
| `RUNPOD_JUPYTER_TOKEN` | Token JupyterLab (legacy) |
| `SESSION_SECRET` | Secreto de sesion |
| `DGB_API_KEY` | API Key interna DGB |
| `TRAINING_WEBHOOK_SECRET` | Secreto para webhooks de entrenamiento |
| `HF_TOKEN` | Token de Hugging Face |
| `ELEVENLABS_API_KEY` | API Key de ElevenLabs |
| `KIE_API_KEY` | API Key de Kie.ai |
| `MUREKA_API_KEY` | API Key de Mureka |
| `MUSICGPT_API_KEY` | API Key de MusicGPT |
| `REPLICATE_API_TOKEN` | Token de Replicate |

### Variables de Entorno
| Variable | Descripcion |
|----------|-------------|
| `RUNPOD_BASE_URL` | URL base del pod RunPod |
| `RUNPOD_ENDPOINT_MUSIC` | ID del endpoint serverless para musica |
| `RUNPOD_ENDPOINT_TRAINING` | ID del endpoint serverless para entrenamiento |
| `RUNPOD_ENDPOINT_STEMS` | ID del endpoint serverless para stems |
| `DATABASE_URL` | URL de conexion PostgreSQL |

---

## 12. Configuracion de RunPod Serverless

### Paso 1: Crear Endpoints en RunPod
1. Ir a [RunPod Console](https://www.runpod.io/console/serverless)
2. Crear endpoint para musica (con handler de HeartMuLa/SAO)
3. Crear endpoint para entrenamiento (con handler de SAO training)
4. Crear endpoint para stems (con handler de Demucs)

### Paso 2: Configurar Variables de Entorno
```
RUNPOD_API_KEY=rpa_xxxxx
RUNPOD_ENDPOINT_MUSIC=endpoint_id_musica
RUNPOD_ENDPOINT_TRAINING=endpoint_id_entrenamiento
RUNPOD_ENDPOINT_STEMS=endpoint_id_stems
```

### Paso 3: Verificar Conexion
```
GET /api/serverless/health
```

### Estructura del Worker (Handler)
Cada endpoint serverless necesita un handler que procese las acciones:
- `generate_music` - Genera audio con HeartMuLa o SAO
- `train_model` - Fine-tune de SAO con dataset de instrumentos
- `separate_stems` - Separa stems con Demucs

---

## 13. Stack Tecnologico Completo

### Frontend
- React 18+
- Vite (bundler)
- TailwindCSS
- Shadcn UI
- Wouter (routing)
- TanStack Query v5
- react-i18next
- Wavesurfer.js
- Lucide React (iconos)

### Backend
- Node.js
- Express.js (TypeScript)
- Drizzle ORM
- PostgreSQL (Neon)
- Multer (file uploads)
- WebSocket (ws)

### Servicios Externos
- RunPod (GPU Serverless)
- OpenAI (GPT-5.1, GPT-4.1-mini)
- Replicate (Demucs)
- Stripe (pagos)
- Kie.ai (Suno V5)
- ElevenLabs (voz)
- Hugging Face (modelos)
- Replit Auth (autenticacion)

---

## 14. Internacionalizacion (i18n)

### Idiomas Soportados
- **Espanol** (por defecto) - `client/src/i18n/es.json`
- **Ingles** (secundario) - `client/src/i18n/en.json`

### Caracteristicas
- Selector de idioma en sidebar y landing
- Persistencia en localStorage (`dgb-lang`)
- Todas las paginas y componentes traducidos
- Incluye interfaz de entrenamiento

---

## 15. Notas de GPU y Troubleshooting

### Device Mapping
- RunPod puede asignar GPU como `/dev/nvidia4` en vez de `/dev/nvidia0`
- Scripts crean symlink automaticamente al inicio

### HeartMuse Integration
- Instalado en `/workspace/HeartMuse` con venv dedicado
- PyTorch 2.6.0+cu124
- venv path agregado a sys.path en todos los scripts

### Modelo Variante
- Usa HeartMuLa 3B-RL (reinforcement learning) cuando esta disponible
- Fallback a base 3B si RL no esta presente

### Checkpoint Directories
- `/workspace/HeartMuse/ckpt` (primario)
- `/workspace/heartmula_ckpt` (fallback)

---

*DGB Studio - Potenciando la musica dominicana con inteligencia artificial*
