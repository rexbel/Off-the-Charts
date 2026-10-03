export class ModelError extends Error {
  constructor(
    message: string,
    public readonly kind: "unavailable" | "refusal" | "truncated" | "invalid" | "transport",
  ) {
    super(message);
  }
}

export type StructuredResult<T> = { value: T; model: string; inputTokens: number; outputTokens: number };
