import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { ModelError, type StructuredResult } from "./errors";
import { openaiAvailable, openaiCompleteText, openaiModelId, openaiStructured } from "./openai";

export { ModelError, type StructuredResult };

/**
 * Model adapter. Claude is the primary provider; OpenAI is used when only
 * OPENAI_API_KEY is configured. One call, one schema, one timeout. Callers
 * decide what to do on failure (the pipeline falls back to cached or rules).
 */

export const DEFAULT_MODEL = "claude-opus-5-5";
export type ProviderName = "anthropic" | "openai" | "none";

function anthropicAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function providerName(): ProviderName {
  const forced = process.env.OFF_THE_CHART_PROVIDER;
  if (forced === "anthropic" && anthropicAvailable()) return "anthropic";
  if (forced === "openai" && openaiAvailable()) return "openai";
  if (anthropicAvailable()) return "anthropic";
  if (openaiAvailable()) return "openai";
  return "none";
}

export function modelId(): string {
  const p = providerName();
  if (p === "openai") return openaiModelId();
  return process.env.OFF_THE_CHART_MODEL || DEFAULT_MODEL;
}

export function stageTimeoutMs(): number {
  const n = Number(process.env.OFF_THE_CHART_STAGE_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 90_000;
}

export function modelAvailable(): boolean {
  return providerName() !== "none";
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ timeout: stageTimeoutMs(), maxRetries: 1 });
  return client;
}

function wrapAnthropicError(err: unknown): ModelError {
  if (err instanceof ModelError) return err;
  if (err instanceof Anthropic.AuthenticationError) return new ModelError("Claude credentials were rejected", "unavailable");
  if (err instanceof Anthropic.RateLimitError) return new ModelError("Claude rate limit reached", "transport");
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new ModelError("Claude timed out", "transport");
  if (err instanceof Anthropic.APIError) return new ModelError(`Claude request failed (${err.status ?? "network"})`, "transport");
  if (err instanceof Error && err.name === "AbortError") return new ModelError("Claude request was cancelled", "transport");
  return new ModelError(err instanceof Error ? err.message : "Unknown model error", "transport");
}

/**
 * Calls the model with a Zod-constrained output format and returns the parsed
 * value. Throws ModelError on refusal, truncation or schema failure. Retries
 * once on a schema failure.
 */
export async function structured<S extends z.ZodType>(
  args: { system: string; user: string; schema: S; maxTokens?: number; effort?: "low" | "medium" | "high" },
  signal?: AbortSignal,
): Promise<StructuredResult<z.infer<S>>> {
  const provider = providerName();
  if (provider === "none") throw new ModelError("No model credentials configured", "unavailable");
  if (provider === "openai") return openaiStructured({ ...args, timeoutMs: stageTimeoutMs() }, signal);

  const anthropic = getClient();
  const model = modelId();
  const attempt = async (extraUser?: string) => {
    const response = await anthropic.messages.parse(
      {
        model,
        max_tokens: args.maxTokens ?? 12_000,
        system: [{ type: "text", text: args.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: extraUser ? `${args.user}\n\n${extraUser}` : args.user }],
        output_config: { format: zodOutputFormat(args.schema), effort: args.effort ?? "medium" },
      },
      { signal },
    );
    if (response.stop_reason === "refusal") throw new ModelError("The model declined this request", "refusal");
    if (response.stop_reason === "max_tokens") throw new ModelError("The model output was cut off", "truncated");
    if (response.parsed_output == null) throw new ModelError("The model output did not match the schema", "invalid");
    return {
      value: response.parsed_output as z.infer<S>,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  };

  try {
    try {
      return await attempt();
    } catch (err) {
      if (err instanceof ModelError && err.kind === "invalid") {
        return await attempt("Your previous answer did not match the schema. Return a complete object that matches it exactly.");
      }
      throw err;
    }
  } catch (err) {
    throw wrapAnthropicError(err);
  }
}

/** Plain-text completion for the rewrite tool. */
export async function completeText(args: { system: string; user: string; maxTokens?: number }, signal?: AbortSignal): Promise<{ text: string; model: string }> {
  const provider = providerName();
  if (provider === "none") throw new ModelError("No model credentials configured", "unavailable");
  if (provider === "openai") return openaiCompleteText({ ...args, timeoutMs: stageTimeoutMs() }, signal);

  const anthropic = getClient();
  try {
    const response = await anthropic.messages.create(
      {
        model: modelId(),
        max_tokens: args.maxTokens ?? 2_000,
        system: [{ type: "text", text: args.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: args.user }],
        output_config: { effort: "low" },
      },
      { signal },
    );
    if (response.stop_reason === "refusal") throw new ModelError("The model declined this request", "refusal");
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) throw new ModelError("The model returned no text", "invalid");
    return { text, model: response.model };
  } catch (err) {
    throw wrapAnthropicError(err);
  }
}
