import { useSyncExternalStore } from "react";
import type { Language } from "@/lib/schemas";

/** Browser speech synthesis. No API keys; quality varies by device. */
export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function stopSpeaking(): void {
  if (speechAvailable()) window.speechSynthesis.cancel();
}

export function speak(text: string, language: Language, onEnd?: () => void): SpeechSynthesisUtterance | null {
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
  return u;
}

const noopSubscribe = () => () => {};
/** True once hydrated in a browser that supports speech synthesis; false on the server. */
export function useSpeechAvailable(): boolean {
  return useSyncExternalStore(noopSubscribe, speechAvailable, () => false);
}
