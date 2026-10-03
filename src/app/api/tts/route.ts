import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { languageSchema } from "@/lib/schemas";
import { synthesize, TtsError, TTS_MAX_CHARS, ttsAvailable } from "@/lib/tts";
import { audit } from "@/lib/services/audit";

const bodySchema = z.object({ text: z.string().min(1).max(TTS_MAX_CHARS), language: languageSchema.default("en") });

/**
 * POST /api/tts { text, language } → audio/mpeg. Signed-in staff only; cached
 * on disk by content hash. 503 when no voice key is configured so the client
 * falls back to the browser voice.
 */
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return errorResponse(401, "Sign in to continue");
  }
  if (!ttsAvailable()) return errorResponse(503, "Text-to-speech is not configured");
  const limit = rateLimit(`tts:${user.id}`, 120, 10 * 60_000);
  if (!limit.ok) return errorResponse(429, `Too many voice requests. Try again in ${limit.retryAfterSeconds} seconds.`);
  let body;
  try {
    body = await readJson(req, (raw) => bodySchema.parse(raw));
  } catch (err) {
    return errorResponse(400, err instanceof Error ? err.message : "Invalid request");
  }
  try {
    const { audio, cached } = await synthesize(body.text, body.language);
    if (!cached) await audit("tts.synthesized", { actorId: user.id }, { chars: body.text.length, language: body.language });
    return new Response(new Uint8Array(audio), {
      headers: { "content-type": "audio/mpeg", "content-length": String(audio.length), "cache-control": "private, max-age=86400", "x-tts-cache": cached ? "hit" : "miss" },
    });
  } catch (err) {
    if (err instanceof TtsError) return errorResponse(err.status, err.message);
    console.error("[tts] failed", err instanceof Error ? err.message : err);
    return errorResponse(502, "The voice service did not respond");
  }
}
