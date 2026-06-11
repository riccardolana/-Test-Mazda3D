/* Agent voice: Gemini TTS (warm prebuilt voice) with Web Speech fallback. */
/* Browser-only, no backend. Falls back to speechSynthesis when the API   */
/* key is absent or any fetch/decode fails — the demo still talks offline. */

const VOICE_NAME = "Sulafat";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const SAMPLE_RATE = 24000; // Gemini TTS returns PCM16 mono @ 24 kHz

let muted = false;

/** Monotonic counter: a slow TTS response must never play over a newer line. */
let generation = 0;

let ctx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;

/** Stage prompts repeat on nudges/replays — cache decoded buffers by text. */
const cache = new Map<string, AudioBuffer>();

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  // First speak() happens after the Start click, so the user-gesture
  // requirement is met; resume defensively anyway.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function stopPlayback() {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch {
      /* already stopped */
    }
    currentSource = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function speakFallback(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[“”]/g, '"'));
  u.rate = 1.05;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

function pcm16ToAudioBuffer(base64: string): AudioBuffer {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const pcm = new Int16Array(bytes.buffer, 0, bytes.byteLength >> 1);
  const floats = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) floats[i] = pcm[i] / 32768;
  const buffer = new AudioBuffer({
    numberOfChannels: 1,
    length: floats.length,
    sampleRate: SAMPLE_RATE,
  });
  buffer.copyToChannel(floats, 0);
  return buffer;
}

async function fetchTts(text: string, apiKey: string): Promise<AudioBuffer> {
  const cached = cache.get(text);
  if (cached) return cached;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
          },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
  const json = await res.json();
  const data: string | undefined =
    json?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!data) throw new Error("TTS: no audio in response");
  const buffer = pcm16ToAudioBuffer(data);
  cache.set(text, buffer);
  return buffer;
}

export function speak(text: string) {
  if (muted || typeof window === "undefined") return;
  stopPlayback();

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) {
    speakFallback(text);
    return;
  }

  const gen = ++generation;
  fetchTts(text, apiKey)
    .then((buffer) => {
      if (gen !== generation || muted) return; // superseded or muted meanwhile
      const audioCtx = getContext();
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        if (currentSource === source) currentSource = null;
      };
      currentSource = source;
      source.start();
    })
    .catch(() => {
      if (gen !== generation || muted) return;
      speakFallback(text); // offline / API error → demo still talks
    });
}

export function setVoiceMuted(v: boolean) {
  muted = v;
  if (v) {
    generation++; // invalidate in-flight requests
    stopPlayback();
  }
}

export function isVoiceMuted() {
  return muted;
}
