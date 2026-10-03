"use client";

import { useEffect, useState } from "react";
import { ArrowRightIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScorePill, SourceBadge } from "@/components/badges";
import { api } from "@/lib/client/api";
import { MESSAGE_STAGE_LABEL, messageStageSchema, type PersonaRun } from "@/lib/schemas";

type RunRef = { id: string; createdAt: string; source: PersonaRun["source"]; approvedAt?: string | null };

function when(iso: string): string {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Side-by-side comparison of this run's messages with an earlier run for the same patient. */
export function RunCompare({ current, runs }: { current: PersonaRun; runs: RunRef[] }) {
  const others = runs.filter((r) => r.id !== current.id);
  const [otherId, setOtherId] = useState<string | null>(others[0]?.id ?? null);
  const [other, setOther] = useState<PersonaRun | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const loading = otherId !== null && other?.id !== otherId && failedId !== otherId;

  useEffect(() => {
    if (!otherId) return;
    let cancelled = false;
    api
      .run(otherId)
      .then((r) => {
        if (!cancelled) setOther(r.run);
      })
      .catch(() => {
        if (!cancelled) setFailedId(otherId);
      });
    return () => {
      cancelled = true;
    };
  }, [otherId]);

  if (others.length === 0) {
    return <p className="text-sm text-muted-foreground">Only one run so far. Build again after editing the check-in to compare.</p>;
  }

  return (
    <div className="grid gap-4" data-demo="compare">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="compare-run">Compare with</Label>
          <Select value={otherId ?? undefined} onValueChange={setOtherId}>
            <SelectTrigger id="compare-run" className="w-72">
              <SelectValue placeholder="Pick a run" />
            </SelectTrigger>
            <SelectContent>
              {others.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {when(r.createdAt)} · {r.source}
                  {r.approvedAt ? " · approved" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">Left: the earlier run. Right: this run ({when(current.createdAt)}). Scores use the same rules.</p>
      </div>

      {loading && <Skeleton className="h-48 rounded-xl" />}
      {!loading && other && other.id === otherId && (
        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <ProfileLine label="Earlier" run={other} />
            <ProfileLine label="This run" run={current} />
          </div>
          {messageStageSchema.options.map((stage) => {
            const a = other.outputs.messages.find((m) => m.stage === stage);
            const b = current.outputs.messages.find((m) => m.stage === stage);
            const sa = other.scores.messages.find((s) => s.stage === stage && s.recipient === a?.recipient);
            const sb = current.scores.messages.find((s) => s.stage === stage && s.recipient === b?.recipient);
            if (!a && !b) return null;
            return (
              <Card key={stage} className="gap-0 overflow-hidden p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2">
                  <h3 className="text-sm font-medium">{MESSAGE_STAGE_LABEL[stage]}</h3>
                  {sa && sb && (
                    <div className="flex items-center gap-2">
                      <ScorePill score={sa.persona.score} blocked={sa.persona.blocked} size="sm" />
                      <ArrowRightIcon aria-hidden className="size-4 text-muted-foreground" />
                      <ScorePill score={sb.persona.score} blocked={sb.persona.blocked} size="sm" />
                    </div>
                  )}
                </div>
                <div className="grid md:grid-cols-2">
                  <section className="border-b p-4 md:border-b-0 md:border-r voice-surface" aria-label="Earlier run">
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{a?.persona ?? "—"}</p>
                  </section>
                  <section className="p-4 voice-surface" aria-label="This run">
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{b?.persona ?? "—"}</p>
                  </section>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProfileLine({ label, run }: { label: string; run: PersonaRun }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{label}</span>
        <span>{when(run.createdAt)}</span>
        <SourceBadge source={run.source} />
      </div>
      <p className="mt-1">{run.profile.summaryLine}</p>
      <p className="text-xs text-muted-foreground">
        Grade {run.profile.communicationNeeds.readingLevel} · ≤{run.voiceGuide.sentenceMaxWords} words · {run.voiceGuide.tone.join(", ")} · check-in: &ldquo;{run.context.checkin.slice(0, 80)}
        {run.context.checkin.length > 80 ? "…" : ""}&rdquo;
      </p>
    </div>
  );
}
