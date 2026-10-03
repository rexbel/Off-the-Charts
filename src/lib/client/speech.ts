import { useSyncExternalStore } from "react";
import type { Language } from "@/lib/schemas";

/**
 * Read-aloud for staff and patient-facing text. Prefers the server voice
 * (ElevenLabs via /api/tts, cached) and falls back to the browser's own
 * speech synthesis when the server voice is unavailable. One thing speaks at
 * a time.
 */
export type VoiceSource = "elevenlabs" | "browser" | "none";

export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

// ---- which voice will be used (learned from the first /api/tts answer) ----
let serverVoice: boolean | null = null;
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function sourceSnapshot(): VoiceSource {
  if (serverVoice === true) return "elevenlabs";
  if (serverVoice === null) return speechAvailable() ? "browser" : "none";
  return speechAvailable() ? "browser" : "none";
}

/** Probes the server voice once per page so the UI can say which voice it will use. */
export function probeServerVoice(): void {
  if (serverVoice !== null || typeof window === "undefined") return;
  fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "Hi.", language: "en" }) })
    .then((r) => {
      serverVoice = r.ok;
      notify();
    })
    .catch(() => {
      serverVoice = false;
      notify();
    });
}

/** The voice that read-aloud will use on this device, or "none". */
export function useVoiceSource(): VoiceSource {
  return useSyncExternalStore(subscribe, sourceSnapshot, () => "none");
}

/** True once hydrated when any voice is available. */
export function useSpeechAvailable(): boolean {
  const source = useVoiceSource();
  return source !== "none";
}

// ---- playback ----
const audioCache = new Map<string, string>(); // text|lang → object URL
let current: { stop: () => void } | null = null;

export function stopSpeaking(): void {
  current?.stop();
  current = null;
  if (speechAvailable()) window.speechSynthesis.cancel();
}

async function serverAudioUrl(text: string, language: Language): Promise<string | null> {
  if (serverVoice === false) return null;
  const key = `${language}|${text}`;
  const hit = audioCache.get(key);
  if (hit) return hit;
  try {
    const res = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, language }) });
    if (!res.ok) {
      if (res.status === 503) {
        serverVoice = false;
        notify();
      }
      return null;
    }
    serverVoice = true;
    notify();
    const url = URL.createObjectURL(await res.blob());
    audioCache.set(key, url);
    return url;
  } catch {
    return null;
  }
}

/** Warms the server cache for several texts (e.g. every video scene) without playing them. */
export function prefetchSpeech(texts: string[], language: Language): void {
  for (const t of texts) void serverAudioUrl(t, language);
}

function browserSpeak(text: string, language: Language, onEnd?: () => void): { stop: () => void } | null {
  if (!speechAvailable()) return null;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = language === "es" ? "es-ES" : "en-US";
  u.rate = 0.96;
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find((v) => v.lang.toLowerCase().startsWith(language === "es" ? "es" : "en-us")) ?? voices.find((v) => v.lang.toLowerCase().startsWith(language));
  if (match) u.voice = match;
  if (onEnd) {
    u.onend = onEnd;
    u.onerror = onEnd;
  }
  window.speechSynthesis.speak(u);
  return { stop: () => window.speechSynthesis.cancel() };
}

/**
 * Speaks text. Resolves once playback has started (or immediately when no
 * voice is available). The returned handle stops playback; onEnd fires when
 * it finishes or is stopped.
 */
export async function readAloud(text: string, language: Language, onEnd?: () => void): Promise<{ stop: () => void; source: VoiceSource }> {
  stopSpeaking();
  const url = await serverAudioUrl(text, language);
  if (url) {
    const audio = new Audio(url);
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      onEnd?.();
    };
    audio.onended = finish;
    audio.onerror = finish;
    const handle = {
      stop: () => {
        audio.pause();
        audio.currentTime = 0;
        finish();
      },
      source: "elevenlabs" as const,
    };
    current = handle;
    try {
      await audio.play();
    } catch {
      finish();
    }
    return handle;
  }
  const b = browserSpeak(text, language, onEnd);
  if (b) {
    const handle = { stop: b.stop, source: "browser" as const };
    current = handle;
    return handle;
  }
  onEnd?.();
  return { stop: () => undefined, source: "none" };
}

/** Compatibility wrapper for callers that want fire-and-forget. */
export function speak(text: string, language: Language, onEnd?: () => void): void {
  void readAloud(text, language, onEnd);
}
