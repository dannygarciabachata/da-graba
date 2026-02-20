import { createContext, useContext, useCallback, useRef, useState, useEffect } from "react";

export interface PlayerSong {
  id: number;
  title: string;
  audioUrl: string;
  imageUrl?: string | null;
  genre?: string | null;
  artistName?: string | null;
  prompt?: string | null;
  variationLabel?: string | null;
  lyricsText?: string | null;
  copyrightHolder?: string | null;
  isPublic?: boolean;
  duration?: number | null;
}

interface PlayerQueue {
  songs: PlayerSong[];
  currentIndex: number;
}

interface PlayerState {
  currentSong: PlayerSong | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isReady: boolean;
  isShuffled: boolean;
  isRepeating: boolean;
}

export interface HistoryEntry {
  song: PlayerSong;
  playedAt: number;
}

interface PlayerContextValue {
  state: PlayerState;
  analyserNode: AnalyserNode | null;
  history: HistoryEntry[];
  play: (song: PlayerSong, queue?: PlayerSong[]) => void;
  togglePlayPause: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  seek: (fraction: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  clearHistory: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

export function usePlayerOptional() {
  return useContext(PlayerContext);
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const queueRef = useRef<PlayerQueue>({ songs: [], currentIndex: -1 });
  const savedVolumeRef = useRef(1);
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem("dagraba_history");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const addToHistory = useCallback((song: PlayerSong) => {
    setHistory(prev => {
      const filtered = prev.filter(h => h.song.id !== song.id);
      const next = [{ song, playedAt: Date.now() }, ...filtered].slice(0, 50);
      try { localStorage.setItem("dagraba_history", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try { localStorage.removeItem("dagraba_history"); } catch {}
  }, []);

  const [state, setState] = useState<PlayerState>({
    currentSong: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isReady: false,
    isShuffled: false,
    isRepeating: false,
  });

  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      setAnalyserNode(analyser);
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return { ctx: audioCtxRef.current, analyser: analyserRef.current! };
  }, []);

  const connectSource = useCallback((audio: HTMLAudioElement) => {
    const { ctx, analyser } = ensureAudioContext();
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch {}
    }
    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    sourceRef.current = source;
  }, [ensureAudioContext]);

  const loadAndPlay = useCallback((song: PlayerSong) => {
    window.dispatchEvent(new CustomEvent("dagraba:audio-exclusive", { detail: { source: "global-player" } }));

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.volume = state.volume;

    setState(prev => ({
      ...prev,
      currentSong: song,
      isReady: false,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    }));

    const onCanPlay = () => {
      setState(prev => ({ ...prev, isReady: true }));
      connectSource(audio);
      audio.play().catch(console.error);
    };
    const onLoadedMetadata = () => {
      setState(prev => ({ ...prev, duration: audio.duration || 0 }));
    };
    const onTimeUpdate = () => {
      setState(prev => ({ ...prev, currentTime: audio.currentTime || 0 }));
    };
    const onPlay = () => setState(prev => ({ ...prev, isPlaying: true }));
    const onPause = () => setState(prev => ({ ...prev, isPlaying: false }));
    const onEnded = () => {
      setState(prev => {
        if (prev.isRepeating) {
          audio.currentTime = 0;
          audio.play().catch(console.error);
          return prev;
        }
        return { ...prev, isPlaying: false };
      });
      const q = queueRef.current;
      if (q.songs.length > 1) {
        const nextIdx = (q.currentIndex + 1) % q.songs.length;
        if (nextIdx !== 0 || q.songs.length > 1) {
          queueRef.current.currentIndex = nextIdx;
          loadAndPlay(q.songs[nextIdx]);
        }
      }
    };

    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    audioRef.current = audio;
    audio.src = song.audioUrl;
    audio.load();

    addToHistory(song);
    fetch(`/api/songs/${song.id}/play`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
  }, [connectSource, state.volume, addToHistory]);

  const play = useCallback((song: PlayerSong, queue?: PlayerSong[]) => {
    if (queue && queue.length > 0) {
      const idx = queue.findIndex(s => s.id === song.id);
      queueRef.current = { songs: queue, currentIndex: idx >= 0 ? idx : 0 };
    } else {
      queueRef.current = { songs: [song], currentIndex: 0 };
    }
    loadAndPlay(song);
  }, [loadAndPlay]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      window.dispatchEvent(new CustomEvent("dagraba:audio-exclusive", { detail: { source: "global-player" } }));
      ensureAudioContext();
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [ensureAudioContext]);

  const pause = useCallback(() => { audioRef.current?.pause(); }, []);
  const resume = useCallback(() => {
    window.dispatchEvent(new CustomEvent("dagraba:audio-exclusive", { detail: { source: "global-player" } }));
    ensureAudioContext();
    audioRef.current?.play().catch(console.error);
  }, [ensureAudioContext]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
  }, []);

  const next = useCallback(() => {
    const q = queueRef.current;
    if (q.songs.length <= 1) return;
    const nextIdx = (q.currentIndex + 1) % q.songs.length;
    q.currentIndex = nextIdx;
    loadAndPlay(q.songs[nextIdx]);
  }, [loadAndPlay]);

  const prev = useCallback(() => {
    const q = queueRef.current;
    if (q.songs.length <= 1) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }
    const prevIdx = (q.currentIndex - 1 + q.songs.length) % q.songs.length;
    q.currentIndex = prevIdx;
    loadAndPlay(q.songs[prevIdx]);
  }, [loadAndPlay]);

  const seek = useCallback((fraction: number) => {
    const audio = audioRef.current;
    if (!audio || !state.duration) return;
    audio.currentTime = fraction * state.duration;
  }, [state.duration]);

  const setVolume = useCallback((v: number) => {
    setState(prev => ({ ...prev, volume: v }));
    if (audioRef.current) audioRef.current.volume = v;
    if (v > 0) savedVolumeRef.current = v;
  }, []);

  const toggleMute = useCallback(() => {
    if (state.volume > 0) {
      savedVolumeRef.current = state.volume;
      setVolume(0);
    } else {
      setVolume(savedVolumeRef.current || 1);
    }
  }, [state.volume, setVolume]);

  const toggleShuffle = useCallback(() => {
    setState(prev => ({ ...prev, isShuffled: !prev.isShuffled }));
  }, []);

  const toggleRepeat = useCallback(() => {
    setState(prev => ({ ...prev, isRepeating: !prev.isRepeating }));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.source !== "global-player") {
        audioRef.current?.pause();
      }
    };
    window.addEventListener("dagraba:audio-exclusive", handler);
    return () => window.removeEventListener("dagraba:audio-exclusive", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch {}
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        state,
        analyserNode,
        history,
        play,
        togglePlayPause,
        pause,
        resume,
        stop,
        next,
        prev,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        toggleRepeat,
        clearHistory,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}
