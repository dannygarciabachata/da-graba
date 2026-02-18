import { useRef, useState, useCallback, useEffect } from "react";

export interface EQSettings {
  low: number;
  mid: number;
  high: number;
}

export interface CompressorSettings {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  enabled: boolean;
}

export interface ReverbSettings {
  mix: number;
  enabled: boolean;
}

export interface EngineTrack {
  id: number;
  url: string;
  name: string;
  type: string;
  buffer: AudioBuffer | null;
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode;
  panNode: StereoPannerNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  analyser: AnalyserNode;
  reverbGain: GainNode;
  dryGain: GainNode;
  volume: number;
  pan: number;
  eq: EQSettings;
  compressorSettings: CompressorSettings;
  reverbSettings: ReverbSettings;
  isMuted: boolean;
  isSolo: boolean;
  loaded: boolean;
}

export interface TransportState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loopStart: number;
  loopEnd: number;
  loopEnabled: boolean;
}

export interface MasterSettings {
  volume: number;
  eq: EQSettings;
  compressorSettings: CompressorSettings;
}

const DEFAULT_EQ: EQSettings = { low: 0, mid: 0, high: 0 };
const DEFAULT_COMPRESSOR: CompressorSettings = {
  threshold: -24,
  ratio: 4,
  attack: 0.003,
  release: 0.25,
  enabled: false,
};
const DEFAULT_REVERB: ReverbSettings = { mix: 0, enabled: false };

function createImpulseResponse(ctx: AudioContext, duration = 2, decay = 2): AudioBuffer {
  const length = ctx.sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const tracksRef = useRef<Map<number, EngineTrack>>(new Map());
  const masterGainRef = useRef<GainNode | null>(null);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  const masterEqLowRef = useRef<BiquadFilterNode | null>(null);
  const masterEqMidRef = useRef<BiquadFilterNode | null>(null);
  const masterEqHighRef = useRef<BiquadFilterNode | null>(null);
  const masterCompressorRef = useRef<DynamicsCompressorNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);
  const reverbReturnRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef<number>(0);
  const loopRef = useRef({ enabled: false, start: 0, end: 0 });
  const durationRef = useRef(0);

  const [tracks, setTracks] = useState<Map<number, EngineTrack>>(new Map());
  const [transport, setTransport] = useState<TransportState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    loopStart: 0,
    loopEnd: 0,
    loopEnabled: false,
  });
  const [masterSettings, setMasterSettings] = useState<MasterSettings>({
    volume: 1,
    eq: { ...DEFAULT_EQ },
    compressorSettings: { ...DEFAULT_COMPRESSOR },
  });

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      const ctx = new AudioContext();
      ctxRef.current = ctx;

      const masterEqLow = ctx.createBiquadFilter();
      masterEqLow.type = "lowshelf";
      masterEqLow.frequency.value = 250;
      masterEqLow.gain.value = 0;
      masterEqLowRef.current = masterEqLow;

      const masterEqMid = ctx.createBiquadFilter();
      masterEqMid.type = "peaking";
      masterEqMid.frequency.value = 1000;
      masterEqMid.Q.value = 1;
      masterEqMid.gain.value = 0;
      masterEqMidRef.current = masterEqMid;

      const masterEqHigh = ctx.createBiquadFilter();
      masterEqHigh.type = "highshelf";
      masterEqHigh.frequency.value = 4000;
      masterEqHigh.gain.value = 0;
      masterEqHighRef.current = masterEqHigh;

      const masterComp = ctx.createDynamicsCompressor();
      masterComp.threshold.value = -24;
      masterComp.ratio.value = 4;
      masterComp.attack.value = 0.003;
      masterComp.release.value = 0.25;
      masterCompressorRef.current = masterComp;

      const masterGain = ctx.createGain();
      masterGain.gain.value = 1;
      masterGainRef.current = masterGain;

      const masterAnalyser = ctx.createAnalyser();
      masterAnalyser.fftSize = 256;
      masterAnalyserRef.current = masterAnalyser;

      const convolver = ctx.createConvolver();
      convolver.buffer = createImpulseResponse(ctx, 2.5, 2.5);
      convolverRef.current = convolver;

      const reverbReturn = ctx.createGain();
      reverbReturn.gain.value = 0.3;
      reverbReturnRef.current = reverbReturn;

      convolver.connect(reverbReturn);
      reverbReturn.connect(masterEqLow);

      masterEqLow.connect(masterEqMid);
      masterEqMid.connect(masterEqHigh);
      masterEqHigh.connect(masterComp);
      masterComp.connect(masterGain);
      masterGain.connect(masterAnalyser);
      masterAnalyser.connect(ctx.destination);
    }
    return ctxRef.current;
  }, []);

  const loadTrack = useCallback(async (id: number, url: string, name: string, type: string) => {
    const ctx = getContext();
    if (ctx.state === "suspended") await ctx.resume();

    const existing = tracksRef.current.get(id);
    if (existing?.url === url && existing.loaded) return;

    const gainNode = ctx.createGain();
    const panNode = ctx.createStereoPanner();
    const eqLow = ctx.createBiquadFilter();
    eqLow.type = "lowshelf";
    eqLow.frequency.value = 250;
    eqLow.gain.value = 0;

    const eqMid = ctx.createBiquadFilter();
    eqMid.type = "peaking";
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1;
    eqMid.gain.value = 0;

    const eqHigh = ctx.createBiquadFilter();
    eqHigh.type = "highshelf";
    eqHigh.frequency.value = 4000;
    eqHigh.gain.value = 0;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1;

    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0;

    gainNode.connect(panNode);
    panNode.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(compressor);
    compressor.connect(analyser);

    analyser.connect(dryGain);
    const masterInput = masterEqLowRef.current!;
    dryGain.connect(masterInput);

    analyser.connect(reverbGain);
    reverbGain.connect(convolverRef.current!);

    let buffer: AudioBuffer | null = null;
    try {
      const response = await fetch(url);
      const arrayBuf = await response.arrayBuffer();
      buffer = await ctx.decodeAudioData(arrayBuf);
    } catch (err) {
      console.error(`[AudioEngine] Failed to load track ${id}:`, err);
    }

    const engineTrack: EngineTrack = {
      id,
      url,
      name,
      type,
      buffer,
      sourceNode: null,
      gainNode,
      panNode,
      eqLow,
      eqMid,
      eqHigh,
      compressor,
      analyser,
      reverbGain,
      dryGain,
      volume: 1,
      pan: 0,
      eq: { ...DEFAULT_EQ },
      compressorSettings: { ...DEFAULT_COMPRESSOR },
      reverbSettings: { ...DEFAULT_REVERB },
      isMuted: false,
      isSolo: false,
      loaded: !!buffer,
    };

    tracksRef.current.set(id, engineTrack);
    setTracks(new Map(tracksRef.current));

    const maxDur = Math.max(
      ...Array.from(tracksRef.current.values())
        .map((t) => t.buffer?.duration ?? 0),
      0
    );
    durationRef.current = maxDur;
    setTransport((prev) => ({ ...prev, duration: maxDur }));
  }, [getContext]);

  const removeTrack = useCallback((id: number) => {
    const track = tracksRef.current.get(id);
    if (track) {
      if (track.sourceNode) {
        try { track.sourceNode.stop(); } catch {}
        track.sourceNode.disconnect();
      }
      track.gainNode.disconnect();
      track.panNode.disconnect();
      track.eqLow.disconnect();
      track.eqMid.disconnect();
      track.eqHigh.disconnect();
      track.compressor.disconnect();
      track.analyser.disconnect();
      track.dryGain.disconnect();
      track.reverbGain.disconnect();
    }
    tracksRef.current.delete(id);
    setTracks(new Map(tracksRef.current));
  }, []);

  const applyMuteSolo = useCallback(() => {
    const allTracks = Array.from(tracksRef.current.values());
    const anySoloed = allTracks.some((t) => t.isSolo);
    allTracks.forEach((track) => {
      const muted = track.isMuted || (anySoloed && !track.isSolo);
      track.gainNode.gain.value = muted ? 0 : track.volume;
    });
  }, []);

  const startPlayback = useCallback((fromTime?: number) => {
    const ctx = getContext();
    if (ctx.state === "suspended") ctx.resume();

    const offset = fromTime ?? offsetRef.current;

    Array.from(tracksRef.current.values()).forEach((track) => {
      if (track.sourceNode) {
        try { track.sourceNode.stop(); } catch {}
        track.sourceNode.disconnect();
      }

      if (!track.buffer) return;

      const source = ctx.createBufferSource();
      source.buffer = track.buffer;
      source.connect(track.gainNode);
      track.sourceNode = source;

      const clampedOffset = Math.min(offset, track.buffer.duration);
      source.start(0, clampedOffset);
    });

    applyMuteSolo();
    startTimeRef.current = ctx.currentTime - offset;
    offsetRef.current = offset;

    setTransport((prev) => ({ ...prev, isPlaying: true }));

    const tick = () => {
      if (!ctxRef.current) return;
      const elapsed = ctxRef.current.currentTime - startTimeRef.current;
      const dur = durationRef.current || Math.max(
        ...Array.from(tracksRef.current.values()).map((t) => t.buffer?.duration ?? 0),
        0
      );

      if (loopRef.current.enabled && elapsed >= loopRef.current.end && loopRef.current.end > loopRef.current.start) {
        stopPlayback(false);
        startPlayback(loopRef.current.start);
        return;
      }

      if (elapsed >= dur) {
        stopPlayback();
        return;
      }

      setTransport((prev) => ({ ...prev, currentTime: elapsed }));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [getContext, applyMuteSolo]);

  const stopPlayback = useCallback((resetOffset = true) => {
    cancelAnimationFrame(rafRef.current);
    Array.from(tracksRef.current.values()).forEach((track) => {
      if (track.sourceNode) {
        try { track.sourceNode.stop(); } catch {}
        track.sourceNode.disconnect();
        track.sourceNode = null;
      }
    });
    if (ctxRef.current) {
      const elapsed = ctxRef.current.currentTime - startTimeRef.current;
      if (!resetOffset) {
        offsetRef.current = elapsed;
      } else {
        offsetRef.current = 0;
      }
    }
    setTransport((prev) => ({
      ...prev,
      isPlaying: false,
      currentTime: resetOffset ? 0 : prev.currentTime,
    }));
  }, []);

  const pausePlayback = useCallback(() => {
    if (!ctxRef.current) return;
    cancelAnimationFrame(rafRef.current);
    const elapsed = ctxRef.current.currentTime - startTimeRef.current;
    offsetRef.current = elapsed;

    Array.from(tracksRef.current.values()).forEach((track) => {
      if (track.sourceNode) {
        try { track.sourceNode.stop(); } catch {}
        track.sourceNode.disconnect();
        track.sourceNode = null;
      }
    });

    setTransport((prev) => ({
      ...prev,
      isPlaying: false,
      currentTime: elapsed,
    }));
  }, []);

  const seekTo = useCallback((time: number) => {
    offsetRef.current = time;
    setTransport((prev) => ({ ...prev, currentTime: time }));
    if (transport.isPlaying) {
      stopPlayback(false);
      startPlayback(time);
    }
  }, [transport.isPlaying, stopPlayback, startPlayback]);

  const togglePlayPause = useCallback(() => {
    if (transport.isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }, [transport.isPlaying, pausePlayback, startPlayback]);

  const setTrackVolume = useCallback((id: number, vol: number) => {
    const track = tracksRef.current.get(id);
    if (!track) return;
    track.volume = vol;
    applyMuteSolo();
    setTracks(new Map(tracksRef.current));
  }, [applyMuteSolo]);

  const setTrackPan = useCallback((id: number, pan: number) => {
    const track = tracksRef.current.get(id);
    if (!track) return;
    track.pan = pan;
    track.panNode.pan.value = pan;
    setTracks(new Map(tracksRef.current));
  }, []);

  const setTrackMute = useCallback((id: number, muted: boolean) => {
    const track = tracksRef.current.get(id);
    if (!track) return;
    track.isMuted = muted;
    applyMuteSolo();
    setTracks(new Map(tracksRef.current));
  }, [applyMuteSolo]);

  const setTrackSolo = useCallback((id: number, solo: boolean) => {
    const track = tracksRef.current.get(id);
    if (!track) return;
    track.isSolo = solo;
    applyMuteSolo();
    setTracks(new Map(tracksRef.current));
  }, [applyMuteSolo]);

  const setTrackEQ = useCallback((id: number, band: keyof EQSettings, value: number) => {
    const track = tracksRef.current.get(id);
    if (!track) return;
    track.eq[band] = value;
    if (band === "low") track.eqLow.gain.value = value;
    if (band === "mid") track.eqMid.gain.value = value;
    if (band === "high") track.eqHigh.gain.value = value;
    setTracks(new Map(tracksRef.current));
  }, []);

  const setTrackCompressor = useCallback((id: number, settings: Partial<CompressorSettings>) => {
    const track = tracksRef.current.get(id);
    if (!track) return;
    Object.assign(track.compressorSettings, settings);
    const isEnabled = settings.enabled !== undefined ? settings.enabled : track.compressorSettings.enabled;
    if (isEnabled) {
      track.compressor.threshold.value = track.compressorSettings.threshold;
      track.compressor.ratio.value = track.compressorSettings.ratio;
      track.compressor.attack.value = track.compressorSettings.attack;
      track.compressor.release.value = track.compressorSettings.release;
    } else {
      track.compressor.threshold.value = 0;
      track.compressor.ratio.value = 1;
      track.compressor.attack.value = 0.003;
      track.compressor.release.value = 0.25;
    }
    if (settings.threshold !== undefined && isEnabled) track.compressor.threshold.value = settings.threshold;
    if (settings.ratio !== undefined && isEnabled) track.compressor.ratio.value = settings.ratio;
    if (settings.attack !== undefined && isEnabled) track.compressor.attack.value = settings.attack;
    if (settings.release !== undefined && isEnabled) track.compressor.release.value = settings.release;
    setTracks(new Map(tracksRef.current));
  }, []);

  const setTrackReverb = useCallback((id: number, settings: Partial<ReverbSettings>) => {
    const track = tracksRef.current.get(id);
    if (!track) return;
    Object.assign(track.reverbSettings, settings);
    if (settings.mix !== undefined) {
      track.reverbGain.gain.value = settings.mix;
      track.dryGain.gain.value = 1 - settings.mix * 0.5;
    }
    if (settings.enabled !== undefined && !settings.enabled) {
      track.reverbGain.gain.value = 0;
      track.dryGain.gain.value = 1;
    }
    setTracks(new Map(tracksRef.current));
  }, []);

  const setMasterVolume = useCallback((vol: number) => {
    if (masterGainRef.current) masterGainRef.current.gain.value = vol;
    setMasterSettings((prev) => ({ ...prev, volume: vol }));
  }, []);

  const setMasterEQ = useCallback((band: keyof EQSettings, value: number) => {
    if (band === "low" && masterEqLowRef.current) masterEqLowRef.current.gain.value = value;
    if (band === "mid" && masterEqMidRef.current) masterEqMidRef.current.gain.value = value;
    if (band === "high" && masterEqHighRef.current) masterEqHighRef.current.gain.value = value;
    setMasterSettings((prev) => ({ ...prev, eq: { ...prev.eq, [band]: value } }));
  }, []);

  const setLoop = useCallback((enabled: boolean, start?: number, end?: number) => {
    loopRef.current = {
      enabled,
      start: start ?? loopRef.current.start,
      end: end ?? loopRef.current.end,
    };
    setTransport((prev) => ({
      ...prev,
      loopEnabled: enabled,
      loopStart: loopRef.current.start,
      loopEnd: loopRef.current.end,
    }));
  }, []);

  const getMeterLevel = useCallback((analyser: AnalyserNode): number => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    return sum / data.length / 255;
  }, []);

  const getTrackMeter = useCallback((id: number): number => {
    const track = tracksRef.current.get(id);
    if (!track) return 0;
    return getMeterLevel(track.analyser);
  }, [getMeterLevel]);

  const getMasterMeter = useCallback((): number => {
    if (!masterAnalyserRef.current) return 0;
    return getMeterLevel(masterAnalyserRef.current);
  }, [getMeterLevel]);

  const getTrackBuffer = useCallback((id: number): AudioBuffer | null => {
    return tracksRef.current.get(id)?.buffer ?? null;
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      Array.from(tracksRef.current.values()).forEach((track) => {
        if (track.sourceNode) {
          try { track.sourceNode.stop(); } catch {}
          try { track.sourceNode.disconnect(); } catch {}
        }
        try { track.gainNode.disconnect(); } catch {}
        try { track.panNode.disconnect(); } catch {}
        try { track.eqLow.disconnect(); } catch {}
        try { track.eqMid.disconnect(); } catch {}
        try { track.eqHigh.disconnect(); } catch {}
        try { track.compressor.disconnect(); } catch {}
        try { track.analyser.disconnect(); } catch {}
        try { track.dryGain.disconnect(); } catch {}
        try { track.reverbGain.disconnect(); } catch {}
      });
      try { masterGainRef.current?.disconnect(); } catch {}
      try { masterAnalyserRef.current?.disconnect(); } catch {}
      try { masterEqLowRef.current?.disconnect(); } catch {}
      try { masterEqMidRef.current?.disconnect(); } catch {}
      try { masterEqHighRef.current?.disconnect(); } catch {}
      try { masterCompressorRef.current?.disconnect(); } catch {}
      try { convolverRef.current?.disconnect(); } catch {}
      try { reverbReturnRef.current?.disconnect(); } catch {}
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    tracks,
    transport,
    masterSettings,
    loadTrack,
    removeTrack,
    togglePlayPause,
    startPlayback,
    pausePlayback,
    stopPlayback,
    seekTo,
    setTrackVolume,
    setTrackPan,
    setTrackMute,
    setTrackSolo,
    setTrackEQ,
    setTrackCompressor,
    setTrackReverb,
    setMasterVolume,
    setMasterEQ,
    setLoop,
    getTrackMeter,
    getMasterMeter,
    getTrackBuffer,
    getContext,
  };
}
