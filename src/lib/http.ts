import { ZodError } from "zod";
import type { ApiError } from "@/lib/schemas";

export function json<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function errorResponse(status: number, error: string, details?: unknown): Response {
  const body: ApiError = details === undefined ? { error } : { error, details };
  return Response.json(body, { status });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Wraps a route handler so thrown HttpError/ZodError become JSON responses. Never leaks stack traces. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((err: unknown) => {
    if (err instanceof HttpError) return errorResponse(err.status, err.message, err.details);
    if (err instanceof ZodError) return errorResponse(400, "Invalid request", err.issues);
    console.error("[api] unhandled error", err instanceof Error ? err.message : err);
    return errorResponse(500, "Something went wrong on our side. Nothing was sent.");
  });
}

export async function readJson<T>(req: Request, parse: (raw: unknown) => T): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON");
  }
  return parse(raw);
}
