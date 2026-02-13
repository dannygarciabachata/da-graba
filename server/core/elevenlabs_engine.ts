const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error("ELEVENLABS_AUTH_ERROR: ELEVENLABS_API_KEY not set");
  }
  return key;
}

export function buildElevenLabsPrompt(userPrompt: string, style: string, lyrics?: string): string {
  const stylePrompts: Record<string, string> = {
    "heart-mula":
      "Traditional Dominican Bachata, passionate, nylon guitar, bongo drums, guira, emotional male vocals in Spanish, Latin dance rhythm, 130 BPM, D minor",
    "bachata-romantic":
      "Romantic Dominican Bachata ballad, tender, nylon guitar, bongo, guira, emotional male vocals in Spanish, intimate Latin dance, 128 BPM, A minor",
    "bachata-dance":
      "Upbeat Dominican Bachata, energetic, driving nylon guitar, fast bongo, guira, congas, male vocals in Spanish, Latin dance party, 140 BPM, C major",
    "bachata-bolero":
      "Slow Bachata Bolero, melancholic, arpeggiated nylon guitar, piano, soft bongo, emotional male vocals in Spanish, nostalgic Latin, 108 BPM, D minor",
    "trio-serenade":
      "Latin Bolero Trio Serenade, romantic, requinto guitar, two nylon guitars, three-part male vocal harmony in Spanish, acoustic, intimate, 105 BPM, E minor",
    "bachata-urbana":
      "Modern Urban Bachata, sensual, electric guitar with reverb, bongo, trap hi-hats, 808 bass, R&B male vocals in Spanish, contemporary Latin, 138 BPM, G minor",
  };

  const base = stylePrompts[style] || stylePrompts["heart-mula"];

  let prompt = `${userPrompt}. ${base}`;

  if (lyrics) {
    prompt += `\n\nLyrics:\n${lyrics}`;
  }

  return prompt;
}

export function buildBachataLyricsForElevenLabs(userPrompt: string, style: string): string {
  const styleTemplates: Record<string, string> = {
    "heart-mula": `[Verse]
Bajo la luna de Santo Domingo
Tu mirada me tiene cautivo
Cada latido es un ritmo que sigo
DGB Studio suena, el amor es mi abrigo

[Chorus]
Bailamos bachata, corazon a corazon
Tu cuerpo y el mio, una sola cancion
DGB Studio late, con toda la pasion
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

export async function generateWithElevenLabs(
  userPrompt: string,
  style: string,
  options: {
    lyrics?: string;
    durationMs?: number;
  } = {}
): Promise<{ audioBuffer: Buffer; provider: "elevenlabs" }> {
  const apiKey = getApiKey();

  const lyrics = options.lyrics || buildBachataLyricsForElevenLabs(userPrompt, style);
  const prompt = buildElevenLabsPrompt(userPrompt, style, lyrics);
  const durationMs = options.durationMs || 60000;

  console.log(`[ElevenLabs] Generating music, duration: ${durationMs}ms`);
  console.log(`[ElevenLabs] Prompt: ${prompt.substring(0, 200)}...`);

  const response = await fetch(`${ELEVENLABS_API_BASE}/music`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      music_length_ms: durationMs,
      output_format: "mp3_44100_128",
    }),
  });

  if (!response.ok) {
    let errorMsg = `ElevenLabs API error: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMsg = errorData?.detail?.message || errorData?.detail || errorData?.error || JSON.stringify(errorData);
    } catch {
      const text = await response.text().catch(() => "");
      if (text) errorMsg = text.substring(0, 300);
    }
    console.error(`[ElevenLabs] Error ${response.status}: ${errorMsg}`);

    if (response.status === 401) {
      throw new Error("ELEVENLABS_AUTH_ERROR: Invalid API key. Check your key at elevenlabs.io/settings");
    }
    if (response.status === 429 || response.status === 402 || String(errorMsg).includes("quota") || String(errorMsg).includes("credits")) {
      throw new Error("ELEVENLABS_QUOTA_EXCEEDED: Add credits at elevenlabs.io/pricing");
    }
    throw new Error(`ELEVENLABS_ERROR: ${errorMsg}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  if (audioBuffer.length < 1000) {
    throw new Error("ELEVENLABS_ERROR: Received empty or invalid audio response");
  }

  console.log(`[ElevenLabs] Generated ${audioBuffer.length} bytes of audio`);

  return { audioBuffer, provider: "elevenlabs" };
}
