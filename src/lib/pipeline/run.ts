import {
  personaProfileSchema,
  renderedOutputsSchema,
  voiceGuideSchema,
  type BuildEvent,
  type BuildMode,
  type Fact,
  type GenericBaseline,
  type PatientContext,
  type PatientRecord,
  type PersonaProfile,
  type PersonaRun,
  type RenderedOutputs,
  type RunSource,
  type Scores,
  type StageName,
  type TiTarget,
  type VoiceGuide,
} from "@/lib/schemas";
import { scoreText } from "@/lib/ti-checker";
import { ModelError, structured } from "@/lib/ai/provider";
import { PROFILE_SYSTEM, RENDER_SYSTEM, VOICE_SYSTEM, profileUserPrompt, renderUserPrompt, voiceUserPrompt } from "@/lib/ai/prompts";
import { newId, nowIso } from "@/lib/ids";
import { visitSlot, type VisitSlot } from "@/lib/visit";
import { extractFacts } from "./extract-facts";
import { genericBaseline } from "./generic-baseline";
import { fallbackProfile, fallbackRender, fallbackVoiceGuide, primaryRecipient, recipientsFor } from "./fallback";
import { loadCachedRun, type CachedRun } from "./cached";

/**
 * The Persona pipeline:
 *   extract (rules) → profile (model) → voice guide (model) → render (model) → score (rules)
 *
 * Fallback chain for each model stage: live → cached output → deterministic
 * rules. Never throws for a model problem; the stage carries its source and a
 * warning instead so the UI can label it.
 */

export type Emit = (event: BuildEvent) => void | Promise<void>;

export type RunOptions = {
  mode: BuildMode;
  signal?: AbortSignal;
  /** Simulated latency for cached stages so the UI can show stages filling in. 0 in tests. */
  cachedStageDelayMs?: number;
  now?: Date;
  /** Leave {{date}} / {{weekday}} / {{time}} tokens in place (precompute writes cache files this way). */
  keepDateTokens?: boolean;
};

type StageOutcome<T> = { value: T; source: RunSource; model?: string; warning?: string };

const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

export function fillDateTokens<T>(value: T, slot: VisitSlot): T {
  const replace = (s: string) => s.replace(/\{\{date\}\}/g, slot.longDate).replace(/\{\{weekday\}\}/g, slot.weekday).replace(/\{\{time\}\}/g, slot.time);
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return replace(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

export function targetFor(profile: PersonaProfile, guide: VoiceGuide, recipient: string, channel: PatientContext["channel"]): TiTarget {
  return {
    readingLevel: profile.communicationNeeds.readingLevel,
    sentenceMaxWords: guide.sentenceMaxWords,
    language: profile.communicationNeeds.language,
    channel,
    recipient,
    privacyRules: profile.privacyRules,
    avoidTerms: profile.avoidTerms,
  };
}

/** Staff-facing target: clinical register is fine, stigma and privacy still count. */
export function staffTarget(profile: PersonaProfile): TiTarget {
  return {
    readingLevel: 12,
    sentenceMaxWords: 28,
    language: "en",
    channel: "portal",
    recipient: "clinician",
    privacyRules: [],
    avoidTerms: profile.avoidTerms,
  };
}

export function scoreRun(profile: PersonaProfile, guide: VoiceGuide, outputs: RenderedOutputs, generic: GenericBaseline): Scores {
  const channel = profile.communicationNeeds.channel;
  const primary = primaryRecipient(profile.recipients).role;
  const messages = outputs.messages.map((m) => {
    const target = targetFor(profile, guide, m.recipient, channel);
    const g = generic.messages.find((x) => x.stage === m.stage)?.text ?? "";
    return { stage: m.stage, generic: scoreText(g, target), persona: scoreText(m.persona, target) };
  });
  const summaryTarget = targetFor(profile, guide, primary, "portal");
  const summaryText = [
    outputs.visitSummary.headline,
    ...outputs.visitSummary.whatWeTalkedAbout.map((i) => i.text),
    ...outputs.visitSummary.yourNextSteps,
    ...outputs.visitSummary.whenToCall,
    ...outputs.visitSummary.questionsForNextTime,
  ].join(" ");
  return {
    messages,
    brief: scoreText(outputs.clinicianBrief.lines.join(" "), staffTarget(profile)),
    summary: { generic: scoreText(generic.summary, summaryTarget), persona: scoreText(summaryText, summaryTarget) },
  };
}

async function modelStage<T>(
  args: {
    name: Exclude<StageName, "extract" | "score">;
    live: () => Promise<{ value: T; model: string }>;
    cached: () => T | null;
    fallback: () => T;
    mode: BuildMode;
    delayMs: number;
  },
): Promise<StageOutcome<T>> {
  if (args.mode === "cached") {
    await sleep(args.delayMs);
    const c = args.cached();
    if (c) return { value: c, source: "cached" };
    return { value: args.fallback(), source: "fallback", warning: "No cached output for this patient; used the rules-based fallback." };
  }
  try {
    const r = await args.live();
    return { value: r.value, source: "live", model: r.model };
  } catch (err) {
    const reason = err instanceof ModelError ? err.message : "Model stage failed";
    const c = args.cached();
    if (c) return { value: c, source: "cached", warning: `${reason}. Showing cached output.` };
    return { value: args.fallback(), source: "fallback", warning: `${reason}. Used the rules-based fallback.` };
  }
}

export async function runPipeline(record: PatientRecord, context: PatientContext, emit: Emit, opts: RunOptions): Promise<PersonaRun> {
  const now = opts.now ?? new Date();
  const delay = opts.cachedStageDelayMs ?? 700;
  const stages: PersonaRun["stages"] = [];
  const cached: CachedRun | null = await loadCachedRun(record.patientId);
  // Cached output only applies when the coordinator did not change the audience or language.
  const cacheMatches = cached && cached.context.audience === context.audience && cached.context.language === context.language ? cached : null;

  const timed = async <T,>(stage: StageName, fn: () => Promise<StageOutcome<T>>): Promise<T> => {
    await emit({ type: "stage", stage, status: "start" });
    const t0 = Date.now();
    const out = await fn();
    const durationMs = Date.now() - t0;
    stages.push({ stage, source: out.source, durationMs, model: out.model, warning: out.warning });
    await emit({ type: "stage", stage, status: "done", source: out.source, durationMs, data: out.value, warning: out.warning });
    return out.value;
  };

  const facts = await timed<Fact[]>("extract", async () => ({ value: extractFacts(record), source: "live" }));
  const generic = genericBaseline(record, now);
  const recipients = recipientsFor(record, context);

  const profile = await timed<PersonaProfile>("profile", () =>
    modelStage({
      name: "profile",
      mode: opts.mode,
      delayMs: delay,
      live: async () => {
        const r = await structured({ system: PROFILE_SYSTEM, user: profileUserPrompt(record, facts, context, recipients), schema: personaProfileSchema, effort: "medium" }, opts.signal);
        // Keep ids stable even if the model renumbered them oddly.
        return { value: { ...r.value, patientId: record.patientId, dataQualityWarnings: dedupe([...r.value.dataQualityWarnings, ...fallbackProfile(record, facts, context).dataQualityWarnings]) }, model: r.model };
      },
      cached: () => cacheMatches?.profile ?? null,
      fallback: () => fallbackProfile(record, facts, context),
    }),
  );

  const guide = await timed<VoiceGuide>("voice", () =>
    modelStage({
      name: "voice",
      mode: opts.mode,
      delayMs: delay,
      live: async () => {
        const r = await structured({ system: VOICE_SYSTEM, user: voiceUserPrompt(profile), schema: voiceGuideSchema, effort: "low" }, opts.signal);
        return { value: r.value, model: r.model };
      },
      cached: () => cacheMatches?.voiceGuide ?? null,
      fallback: () => fallbackVoiceGuide(profile, record),
    }),
  );

  const slot = visitSlot(record.seed.upcomingVisit, record.patientId, profile.communicationNeeds.language, profile.communicationNeeds.bestTimeOfDay === "morning", now);

  const outputs = await timed<RenderedOutputs>("render", async () => {
    const out = await modelStage<RenderedOutputs>({
      name: "render",
      mode: opts.mode,
      delayMs: delay * 1.6,
      live: async () => {
        const r = await structured(
          { system: RENDER_SYSTEM, user: renderUserPrompt({ profile, guide, facts, visit: record.seed.upcomingVisit, generic }), schema: renderedOutputsSchema, effort: "medium", maxTokens: 16_000 },
          opts.signal,
        );
        return { value: r.value, model: r.model };
      },
      cached: () => cacheMatches?.outputs ?? null,
      fallback: () => fallbackRender(record, profile, guide, facts, context),
    });
    return { ...out, value: opts.keepDateTokens ? out.value : fillDateTokens(out.value, slot) };
  });

  const scores = await timed<Scores>("score", async () => ({ value: scoreRun(profile, guide, outputs, generic), source: "live" }));

  const modelSources = stages.filter((s) => s.stage !== "extract" && s.stage !== "score").map((s) => s.source);
  const source: RunSource = modelSources.every((s) => s === "live") ? "live" : modelSources.every((s) => s === "fallback") ? "fallback" : modelSources.includes("cached") ? "cached" : "fallback";

  return {
    id: newId("run"),
    patientId: record.patientId,
    createdAt: nowIso(),
    source,
    context,
    facts,
    profile,
    voiceGuide: guide,
    outputs,
    generic,
    scores,
    stages,
    confirmedClaimIds: [],
  };
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}
