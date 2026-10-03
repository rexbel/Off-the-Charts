import { z } from "zod";
import { ModelError, type StructuredResult } from "./errors";

/**
 * OpenAI adapter over plain fetch (no extra dependency). Used when
 * OPENAI_API_KEY is set and no Anthropic credential is. Same contract as the
 * Claude adapter: one call, one schema, one retry on a schema miss.
 */

export const DEFAULT_OPENAI_MODEL = "gpt-4.1";

export function openaiModelId(): string {
  return process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
}

export function openaiAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

type ChatResponse = {
  model?: string;
  choices?: Array<{ message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

async function chat(body: Record<string, unknown>, timeoutMs: number, signal?: AbortSignal): Promise<ChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new ModelError("No OpenAI credentials configured", "unavailable");
  const signals = [AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])];
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.any(signals),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) throw new ModelError("OpenAI timed out", "transport");
    throw new ModelError("Could not reach OpenAI", "transport");
  }
  if (res.status === 401) throw new ModelError("OpenAI credentials were rejected", "unavailable");
  if (res.status === 429) throw new ModelError("OpenAI rate limit reached", "transport");
  // Never log the body: it can echo request content.
  if (!res.ok) throw new ModelError(`OpenAI request failed (${res.status})`, "transport");
  return (await res.json()) as ChatResponse;
}

function contentOf(data: ChatResponse): string {
  const choice = data.choices?.[0];
  if (choice?.message?.refusal) throw new ModelError("The model declined this request", "refusal");
  if (choice?.finish_reason === "length") throw new ModelError("The model output was cut off", "truncated");
  const raw = choice?.message?.content;
  if (!raw) throw new ModelError("The model returned no content", "invalid");
  return raw;
}

export async function openaiStructured<S extends z.ZodType>(
  args: { system: string; user: string; schema: S; maxTokens?: number; timeoutMs: number },
  signal?: AbortSignal,
): Promise<StructuredResult<z.infer<S>>> {
  const jsonSchema = z.toJSONSchema(args.schema, { target: "draft-7", unrepresentable: "any" });
  const attempt = async (extraUser?: string) => {
    const data = await chat(
      {
        model: openaiModelId(),
        temperature: 0.3,
        max_tokens: args.maxTokens ?? 12_000,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: extraUser ? `${args.user}\n\n${extraUser}` : args.user },
        ],
        response_format: { type: "json_schema", json_schema: { name: "output", schema: jsonSchema, strict: false } },
      },
      args.timeoutMs,
      signal,
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(contentOf(data));
    } catch (err) {
      if (err instanceof ModelError) throw err;
      throw new ModelError("The model output was not valid JSON", "invalid");
    }
    const result = args.schema.safeParse(parsed);
    if (!result.success) {
      throw new ModelError(`The model output did not match the schema: ${result.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, "invalid");
    }
    return {
      value: result.data as z.infer<S>,
      model: data.model ?? openaiModelId(),
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  };
  try {
    return await attempt();
  } catch (err) {
    if (err instanceof ModelError && err.kind === "invalid") {
      return attempt(`Your previous answer did not match the schema (${err.message}). Return a complete object that matches it exactly.`);
    }
    throw err;
  }
}

export async function openaiCompleteText(args: { system: string; user: string; maxTokens?: number; timeoutMs: number }, signal?: AbortSignal): Promise<{ text: string; model: string }> {
  const data = await chat(
    {
      model: openaiModelId(),
      temperature: 0.4,
      max_tokens: args.maxTokens ?? 2_000,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    },
    args.timeoutMs,
    signal,
  );
  return { text: contentOf(data).trim(), model: data.model ?? openaiModelId() };
}
