"use client";

import { CheckIcon, CircleDashedIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react";
import { SourceBadge } from "@/components/badges";
import { STAGE_LABEL, type Fact, type PersonaProfile, type RenderedOutputs, type RunSource, type Scores, type StageName, type VoiceGuide } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export type StageState = { status: "idle" | "running" | "done"; source?: RunSource; durationMs?: number; warning?: string; data?: unknown };
export type StagesState = Record<StageName, StageState>;

export const STAGE_ORDER: StageName[] = ["extract", "profile", "voice", "render", "score"];

export const idleStages = (): StagesState => ({
  extract: { status: "idle" },
  profile: { status: "idle" },
  voice: { status: "idle" },
  render: { status: "idle" },
  score: { status: "idle" },
});

const STAGE_HELP: Record<StageName, string> = {
  extract: "Rules pull cited facts from the record: diagnoses, medications, encounters, chief complaints, and chart contradictions.",
  profile: "The model turns facts plus the check-in into audience, reading level, emotional context, privacy rules and avoid-terms. Every claim cites fact ids.",
  voice: "Tone, do-say and don't-say, sentence limit, greeting and sign-off, choice and safety phrases.",
  render: "Three messages, the clinician brief, the visit summary and two video scripts, all from the profile and voice guide. Never from the raw note.",
  score: "Deterministic checker scores generic and Persona versions with the same rules.",
};

function preview(stage: StageName, data: unknown): string | null {
  if (!data) return null;
  switch (stage) {
    case "extract": {
      const facts = data as Fact[];
      const enc = new Set(facts.filter((f) => f.encounterId).map((f) => f.encounterId)).size;
      return `${facts.length} facts from ${enc} encounters`;
    }
    case "profile": {
      const p = data as PersonaProfile;
      return p.summaryLine;
    }
    case "voice": {
      const v = data as VoiceGuide;
      return `${v.tone.join(", ")} · ≤${v.sentenceMaxWords} words per sentence · "${v.greeting}"`;
    }
    case "render": {
      const o = data as RenderedOutputs;
      return `${o.messages.length} messages · brief · summary · ${o.videoScripts.length} videos`;
    }
    case "score": {
      const s = data as Scores;
      const m = s.messages[1] ?? s.messages[0];
      return m ? `2-day message: ${m.generic.score} → ${m.persona.score}` : null;
    }
  }
}

export function PipelineSteps({ stages, compact = false }: { stages: StagesState; compact?: boolean }) {
  return (
    <ol className={cn("grid gap-2", compact ? "sm:grid-cols-5" : "")} aria-label="Pipeline stages" data-demo="pipeline">
      {STAGE_ORDER.map((name, i) => {
        const s = stages[name];
        return (
          <li
            key={name}
            className={cn(
              "flex gap-3 rounded-lg border p-3 transition-colors",
              s.status === "running" && "border-teal/50 bg-accent/40",
              s.status === "done" && "bg-card",
              s.status === "idle" && "opacity-70",
              compact && "flex-col gap-1.5 p-2.5",
            )}
            aria-current={s.status === "running" ? "step" : undefined}
          >
            <div className="flex items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs tabular-nums">
                {s.status === "running" ? <Loader2Icon aria-hidden className="size-3.5 animate-spin text-teal" /> : s.status === "done" ? <CheckIcon aria-hidden className="size-3.5 text-ok" /> : <CircleDashedIcon aria-hidden className="size-3.5 text-muted-foreground" />}
                <span className="sr-only">{s.status === "running" ? "Running" : s.status === "done" ? "Done" : "Waiting"}</span>
              </span>
              {compact && (
                <span className="text-xs font-medium">
                  {i + 1}. {STAGE_LABEL[name]}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              {!compact && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {i + 1}. {STAGE_LABEL[name]}
                  </span>
                  {s.source && name !== "extract" && name !== "score" && <SourceBadge source={s.source} />}
                  {s.durationMs !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{(s.durationMs / 1000).toFixed(1)} s</span>}
                </div>
              )}
              {compact && s.source && name !== "extract" && name !== "score" && <SourceBadge source={s.source} className="mt-1" />}
              <p className={cn("text-xs text-muted-foreground", compact ? "mt-1 line-clamp-2" : "mt-0.5")}>{s.status === "done" ? (preview(name, s.data) ?? STAGE_HELP[name]) : STAGE_HELP[name]}</p>
              {s.warning && (
                <p className="mt-1 flex items-start gap-1 text-xs text-warn">
                  <TriangleAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" /> {s.warning}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
