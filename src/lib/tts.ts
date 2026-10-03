import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Language } from "@/lib/schemas";

/**
 * Server-side text-to-speech through ElevenLabs, cached on disk by content
 * hash so the same brief or scene is synthesized once. Falls back to nothing:
 * callers use the browser voice when this is unavailable.
 */
export const AUDIO_DIR = path.join(process.cwd(), "data", "audio");
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // ElevenLabs premade "Sarah": calm, warm, clear
const MODEL_ID = "eleven_multilingual_v2";
export const TTS_MAX_CHARS = 2500;

export function ttsAvailable(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export function ttsVoiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
}

export class TtsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function cacheKey(text: string, language: Language): string {
  return createHash("sha256").update(`${MODEL_ID}|${ttsVoiceId()}|${language}|${text}`).digest("hex");
}

/** Returns MP3 bytes, from the disk cache when present. */
export async function synthesize(text: string, language: Language): Promise<{ audio: Buffer; cached: boolean }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new TtsError("Text-to-speech is not configured", 503);
  const clean = text.replace(/\s+/g, " ").trim().slice(0, TTS_MAX_CHARS);
  if (!clean) throw new TtsError("Nothing to read", 400);
  await mkdir(AUDIO_DIR, { recursive: true });
  const file = path.join(AUDIO_DIR, `${cacheKey(clean, language)}.mp3`);
  const hit = await readFile(file).catch(() => null);
  if (hit) return { audio: hit, cached: true };

  let res: Response;
  try {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ttsVoiceId()}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text: clean,
        model_id: MODEL_ID,
        language_code: language,
        voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new TtsError("Could not reach the voice service", 502);
  }
  if (res.status === 401) throw new TtsError("Voice service credentials were rejected", 503);
  if (res.status === 429) throw new TtsError("Voice service rate limit reached", 429);
  // Never log the body: it can echo the text.
  if (!res.ok) throw new TtsError(`Voice service request failed (${res.status})`, 502);
  const audio = Buffer.from(await res.arrayBuffer());
  await writeFile(file, audio).catch(() => undefined);
  return { audio, cached: false };
}
