const MUREKA_API_BASE = "https://api.mureka.ai/v1";

export interface MurekaGenerateRequest {
  lyrics: string;
  prompt: string;
  model?: string;
  n?: number;
  stream?: boolean;
}

export interface MurekaTaskResponse {
  id: string;
  created_at: number;
  finished_at: number;
  model: string;
  status: "preparing" | "queued" | "running" | "streaming" | "succeeded" | "failed" | "timeouted" | "cancelled";
  failed_reason?: string;
  choices?: MurekaChoice[];
}

export interface MurekaChoice {
  id: string;
  url: string;
  duration: number;
  title?: string;
  stream_url?: string;
}

function getApiKey(): string {
  const key = process.env.MUREKA_API_KEY;
  if (!key) {
    throw new Error("MUREKA_API_KEY not set. Get your API key from platform.mureka.ai");
  }
  return key;
}

async function murekaFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const apiKey = getApiKey();
  const url = `${MUREKA_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const responseText = await response.text();
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    if (!response.ok) {
      console.error(`[Mureka] Non-JSON error ${response.status}: ${responseText.substring(0, 300)}`);
      if (response.status === 429 || response.status === 402) {
        throw new Error("MUREKA_QUOTA_EXCEEDED: Add credits at platform.mureka.ai");
      }
      if (response.status === 401) {
        throw new Error("MUREKA_AUTH_ERROR: Invalid API key. Check your key at platform.mureka.ai");
      }
      throw new Error(`Mureka API error: ${response.status}`);
    }
    throw new Error(`Mureka returned invalid response: ${responseText.substring(0, 200)}`);
  }

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Mureka API error: ${response.status}`;
    console.error(`[Mureka] API error ${response.status}:`, errorMsg);

    if (response.status === 429 || response.status === 402 || errorMsg.includes("quota")) {
      throw new Error("MUREKA_QUOTA_EXCEEDED: Add credits at platform.mureka.ai");
    }
    if (response.status === 401) {
      throw new Error("MUREKA_AUTH_ERROR: Invalid API key. Check your key at platform.mureka.ai");
    }
    throw new Error(errorMsg);
  }

  return data;
}

export async function startSongGeneration(
  lyrics: string,
  prompt: string,
  model: string = "auto"
): Promise<MurekaTaskResponse> {
  console.log(`[Mureka] Starting song generation`);
  console.log(`[Mureka] Prompt: ${prompt}`);
  console.log(`[Mureka] Lyrics: ${lyrics.substring(0, 100)}...`);

  const body: MurekaGenerateRequest = {
    lyrics,
    prompt,
    model,
    n: 1,
  };

  const result = await murekaFetch("/song/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });

  console.log(`[Mureka] Task created: ${result.id}, status: ${result.status}`);
  return result;
}

export async function querySongTask(taskId: string): Promise<MurekaTaskResponse> {
  const result = await murekaFetch(`/song/query/${taskId}`);
  return result;
}

export async function pollSongUntilDone(
  taskId: string,
  maxWaitMs: number = 300000,
  pollIntervalMs: number = 5000
): Promise<MurekaTaskResponse> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const task = await querySongTask(taskId);
    console.log(`[Mureka] Task ${taskId} status: ${task.status}`);

    if (task.status === "succeeded") {
      return task;
    }

    if (task.status === "failed" || task.status === "timeouted" || task.status === "cancelled") {
      throw new Error(`Mureka generation ${task.status}: ${task.failed_reason || "unknown error"}`);
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error("Mureka generation timed out after 5 minutes");
}

export function buildBachataLyrics(userPrompt: string, style: string): string {
  const styleTemplates: Record<string, string> = {
    "heart-mula": `[Verse]
Bajo la luna de Santo Domingo
Tu mirada me tiene cautivo
Cada latido es un ritmo que sigo
DGB AUDIO suena, el amor es mi abrigo

[Chorus]
Bailamos bachata, corazon a corazon
Tu cuerpo y el mio, una sola cancion
DGB AUDIO late, con toda la pasion
Eres mi reina, mi unica razon`,

    "bachata-romantic": `[Verse]
En la noche callada te pienso
Tu recuerdo me abraza tan intenso
Las guitarras me cuentan tu historia
Y en cada nota vive tu memoria

[Chorus]
Ven a bailar conmigo esta noche
Que la bachata nos une sin reproche
Tu mano en mi mano, tu piel en mi piel
Este amor sabe a miel`,

    "bachata-dance": `[Verse]
Suena la guira, suena el bongo
La pista se enciende, el ritmo es nuestro
Mueve la cintura, siente la clave
Esta noche nadie nos para

[Chorus]
Dale pa'lante, bachata en la sangre
Que la noche es joven y el ritmo no pare
Bongo y guitarra, fuego en el aire
Esta fiesta es pa' gozarla a lo grande`,

    "bachata-bolero": `[Verse]
En el silencio de esta noche triste
Recuerdo el dia que te fuiste
Las guitarras lloran tu ausencia
Y mi corazon busca tu presencia

[Chorus]
Vuelve a mi, mi amor perdido
Que sin ti me siento herido
El bolero canta nuestro dolor
Trae de vuelta nuestro amor`,

    "trio-serenade": `[Verse]
Bajo tu ventana vengo a cantar
Con mi requinto y mi guitarra
Las estrellas brillan sobre el mar
Y este trio te entrega su serenata

[Chorus]
Escucha mi serenata, mi amor
Cada nota lleva mi corazon
Tres voces cantan con fervor
Esta cancion llena de pasion`,

    "bachata-urbana": `[Verse]
En la ciudad las luces brillan
Tu y yo en la calle, nadie nos vigila
El beat urbano con guitarra real
Bachata nueva, pero original

[Chorus]
Somos fuego, somos flow
Bachata urbana, nuevo sabor
En cada paso siento tu calor
Baby tu eres mi mayor`,
  };

  return styleTemplates[style] || styleTemplates["heart-mula"];
}

export function buildMurekaPrompt(userPrompt: string, style: string): string {
  const stylePrompts: Record<string, string> = {
    "heart-mula": "Dominican Bachata, nylon guitar, bongo, guira, emotional male vocal in Spanish, Latin dance, 130 BPM",
    "bachata-romantic": "romantic Bachata, nylon guitar, bongo, guira, emotional male vocal in Spanish, Latin dance, 128 BPM",
    "bachata-dance": "upbeat Bachata, driving nylon guitar, fast bongo, guira, energetic male vocal in Spanish, Latin dance party, 140 BPM",
    "bachata-bolero": "slow Bachata Bolero, arpeggiated nylon guitar, piano, soft bongo, emotional male vocal in Spanish, 108 BPM",
    "trio-serenade": "Latin Bolero Trio, requinto guitar, nylon guitars, male vocal harmony in Spanish, acoustic, 105 BPM",
    "bachata-urbana": "modern Urban Bachata, electric guitar, bongo, trap hi-hats, 808 bass, R&B male vocal in Spanish, 138 BPM",
  };

  const basePrompt = stylePrompts[style] || stylePrompts["heart-mula"];
  return `${userPrompt}, ${basePrompt}`;
}
