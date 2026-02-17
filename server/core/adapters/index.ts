import { registerAdapter } from "../provider_pipeline";
import { kieMusicAdapter, kieStemAdapter } from "./kie_adapter";
import { replicateStemAdapter } from "./replicate_adapter";
import { runpodMusicAdapter } from "./runpod_music_adapter";

export function initializeAdapters(): void {
  registerAdapter("runpod_music", runpodMusicAdapter);
  registerAdapter("kie_music", kieMusicAdapter);
  registerAdapter("kie_stems", kieStemAdapter);
  registerAdapter("replicate_stems", replicateStemAdapter);
  console.log("[Pipeline] All provider adapters initialized");
}
