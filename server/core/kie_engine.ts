const KIE_API_BASE = "https://api.kie.ai/api/v1";

export interface KieGenerateRequest {
  prompt: string;
  model?: "V5" | "V4_5PLUS" | "V4_5" | "V4_5ALL" | "V4";
  customMode?: boolean;
  instrumental?: boolean;
  style?: string;
  title?: string;
  negativeTags?: string;
  vocalGender?: "m" | "f";
  callBackUrl?: string;
}

export interface KieTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    [key: string]: any;
  };
}

export interface KieTaskResult {
  code: number;
  msg: string;
  data: {
    taskId: string;
    status: string;
    param?: any;
    response?: {
      data?: Array<{
        audioUrl?: string;
        imageUrl?: string;
        title?: string;
        duration?: number;
        id?: string;
      }>;
      sunoData?: Array<{
        audio_url?: string;
        image_url?: string;
        title?: string;
        duration?: number;
        id?: string;
      }>;
    };
    [key: string]: any;
  };
}

export interface KieStemResult {
  code: number;
  msg: string;
  data: {
    taskId: string;
    status: string;
    response?: {
      data?: Array<{
        vocalsUrl?: string;
        instrumentalUrl?: string;
        stemsUrl?: Record<string, string>;
        [key: string]: any;
      }>;
    };
    [key: string]: any;
  };
}

function getApiKey(): string {
  const key = process.env.KIE_API_KEY;
  if (!key) {
    throw new Error("KIE_API_KEY not set. Get your API key from kie.ai/api-key");
  }
  return key;
}

async function kieFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const apiKey = getApiKey();
  const url = `${KIE_API_BASE}${endpoint}`;

  console.log(`[Kie.ai] Request: ${options.method || "GET"} ${url}`);

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
      console.error(`[Kie.ai] Non-JSON error ${response.status}: ${responseText.substring(0, 300)}`);
      if (response.status === 429 || response.status === 402) {
        throw new Error("KIE_QUOTA_EXCEEDED: Add credits at kie.ai/billing");
      }
      if (response.status === 401) {
        throw new Error("KIE_AUTH_ERROR: Invalid API key. Check your key at kie.ai/api-key");
      }
      throw new Error(`Kie.ai API error: ${response.status}`);
    }
    throw new Error(`Kie.ai returned invalid response: ${responseText.substring(0, 200)}`);
  }

  if (!response.ok) {
    const errorMsg = data?.msg || data?.message || `Kie.ai API error: ${response.status}`;
    console.error(`[Kie.ai] API error ${response.status}:`, errorMsg);

    if (response.status === 429 || response.status === 402 || response.status === 403) {
      throw new Error("KIE_QUOTA_EXCEEDED: Add credits at kie.ai/billing");
    }
    if (response.status === 401) {
      throw new Error("KIE_AUTH_ERROR: Invalid API key. Check your key at kie.ai/api-key");
    }
    throw new Error(errorMsg);
  }

  return data;
}

export function canUseKie(): boolean {
  return !!process.env.KIE_API_KEY;
}

export async function boostMusicStyle(content: string): Promise<string> {
  console.log(`[Kie.ai] Boosting style: "${content.substring(0, 80)}..."`);

  const result = await kieFetch("/style/generate", {
    method: "POST",
    body: JSON.stringify({ content }),
  });

  if (result?.code !== 200 || result?.data?.successFlag === "2") {
    const errMsg = result?.data?.errorMessage || result?.msg || "Style boost failed";
    console.warn(`[Kie.ai] Style boost failed: ${errMsg}, using original style`);
    return content;
  }

  const boosted = result?.data?.result;
  if (!boosted) {
    console.warn(`[Kie.ai] Style boost returned no result, using original`);
    return content;
  }

  console.log(`[Kie.ai] Boosted style: "${boosted.substring(0, 120)}..."`);
  return boosted;
}

export async function submitKieMusicGeneration(
  prompt: string,
  style: string,
  options: {
    title?: string;
    lyrics?: string;
    instrumental?: boolean;
    vocalGender?: "m" | "f";
    callbackUrl?: string;
  } = {}
): Promise<{ taskId: string }> {
  console.log(`[Kie.ai] Submitting music generation`);
  console.log(`[Kie.ai] Style: ${style}, Instrumental: ${options.instrumental || false}`);

  let boostedStyle = style;
  if (style) {
    try {
      boostedStyle = await boostMusicStyle(style);
    } catch (err: any) {
      console.warn(`[Kie.ai] Style boost error, using original: ${err.message}`);
      boostedStyle = style;
    }
  }

  const body: Record<string, any> = {
    model: "V5",
    callBackUrl: options.callbackUrl || undefined,
  };

  if (options.lyrics || boostedStyle) {
    body.customMode = true;
    body.style = boostedStyle || "Pop";
    body.title = options.title || "DGB Studio Track";
    body.prompt = options.lyrics || prompt;
  } else {
    body.prompt = prompt;
  }

  if (options.instrumental) {
    body.instrumental = true;
  }

  if (options.vocalGender) {
    body.vocalGender = options.vocalGender;
  }

  const result = await kieFetch("/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const taskId = result?.data?.taskId || result?.taskId;
  if (!taskId) {
    console.error(`[Kie.ai] No taskId in response:`, JSON.stringify(result).substring(0, 300));
    throw new Error("Kie.ai returned no task ID");
  }

  console.log(`[Kie.ai] Task created: ${taskId}`);
  return { taskId };
}

export async function pollKieTask(
  taskId: string,
  maxWaitMs: number = 300000,
  pollIntervalMs: number = 10000
): Promise<{ audioUrl: string; imageUrl?: string; title?: string }> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const result = await kieFetch(`/task/${taskId}`);
    const status = result?.data?.status?.toLowerCase() || "";

    console.log(`[Kie.ai] Task ${taskId} status: ${status}`);

    if (status === "complete" || status === "completed" || status === "success") {
      const responseData = result?.data?.response?.data || result?.data?.response?.sunoData || [];
      if (responseData.length > 0) {
        const track = responseData[0];
        const audioUrl = track.audioUrl || track.audio_url;
        if (!audioUrl) {
          throw new Error("Kie.ai task completed but no audio URL found");
        }
        return {
          audioUrl,
          imageUrl: track.imageUrl || track.image_url,
          title: track.title,
        };
      }
      throw new Error("Kie.ai task completed but no audio data returned");
    }

    if (status === "failed" || status === "error") {
      const errorMsg = result?.data?.failReason || result?.data?.error || "Unknown error";
      throw new Error(`Kie.ai generation failed: ${errorMsg}`);
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error("Kie.ai generation timed out after 5 minutes");
}

export async function submitKieStemSeparation(
  taskId: string,
  audioId: string,
  type: "separate_vocal" | "split_stem" = "separate_vocal"
): Promise<{ taskId: string }> {
  console.log(`[Kie.ai] Submitting stem separation for task ${taskId}, audio ${audioId}`);

  const result = await kieFetch("/vocal-removal/generate", {
    method: "POST",
    body: JSON.stringify({
      taskId,
      audioId,
      type,
    }),
  });

  const newTaskId = result?.data?.taskId || result?.taskId;
  if (!newTaskId) {
    throw new Error("Kie.ai stem separation returned no task ID");
  }

  console.log(`[Kie.ai] Stem separation task created: ${newTaskId}`);
  return { taskId: newTaskId };
}

export async function pollKieStemTask(
  taskId: string,
  maxWaitMs: number = 300000,
  pollIntervalMs: number = 10000
): Promise<{ vocalsUrl?: string; instrumentalUrl?: string; stems: Record<string, string> }> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const result = await kieFetch(`/task/${taskId}`);
    const status = result?.data?.status?.toLowerCase() || "";

    console.log(`[Kie.ai] Stem task ${taskId} status: ${status}`);

    if (status === "complete" || status === "completed" || status === "success") {
      const responseData = result?.data?.response?.data || [];
      const stems: Record<string, string> = {};

      for (const item of responseData) {
        if (item.vocalsUrl) stems.vocals = item.vocalsUrl;
        if (item.instrumentalUrl) stems.instrumental = item.instrumentalUrl;
        if (item.stemsUrl) {
          Object.assign(stems, item.stemsUrl);
        }
        if (item.audioUrl || item.audio_url) {
          const url = item.audioUrl || item.audio_url;
          const type = item.type || item.name || "vocals";
          stems[type.toLowerCase()] = url;
        }
      }

      return {
        vocalsUrl: stems.vocals,
        instrumentalUrl: stems.instrumental,
        stems,
      };
    }

    if (status === "failed" || status === "error") {
      const errorMsg = result?.data?.failReason || result?.data?.error || "Unknown error";
      throw new Error(`Kie.ai stem separation failed: ${errorMsg}`);
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error("Kie.ai stem separation timed out");
}

export async function submitKieExtend(
  audioUrl: string,
  prompt: string,
  options: {
    model?: string;
    callbackUrl?: string;
  } = {}
): Promise<{ taskId: string }> {
  console.log(`[Kie.ai] Submitting extend music`);

  const result = await kieFetch("/upload-extend", {
    method: "POST",
    body: JSON.stringify({
      uploadUrl: audioUrl,
      prompt,
      model: options.model || "V5",
      callBackUrl: options.callbackUrl,
    }),
  });

  const taskId = result?.data?.taskId || result?.taskId;
  if (!taskId) {
    throw new Error("Kie.ai extend returned no task ID");
  }

  console.log(`[Kie.ai] Extend task created: ${taskId}`);
  return { taskId };
}

export async function submitKieCover(
  audioUrl: string,
  style: string,
  options: {
    model?: string;
    callbackUrl?: string;
  } = {}
): Promise<{ taskId: string }> {
  console.log(`[Kie.ai] Submitting cover generation`);

  const result = await kieFetch("/cover", {
    method: "POST",
    body: JSON.stringify({
      uploadUrl: audioUrl,
      style,
      model: options.model || "V5",
      callBackUrl: options.callbackUrl,
    }),
  });

  const taskId = result?.data?.taskId || result?.taskId;
  if (!taskId) {
    throw new Error("Kie.ai cover returned no task ID");
  }

  console.log(`[Kie.ai] Cover task created: ${taskId}`);
  return { taskId };
}
