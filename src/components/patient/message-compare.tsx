"use client";

import { ArrowRightIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScorePill } from "@/components/badges";
import { HighlightedText } from "./highlighted-text";
import { TiFindings } from "./ti-findings";
import { TouchpointActions, type OnTouchpointAction } from "./touchpoint-actions";
import { MESSAGE_STAGE_LABEL, type MessageStage, type PersonaRun, type TiScore, type Touchpoint } from "@/lib/schemas";
import { MESSAGE_KIND_TO_STAGE } from "@/lib/pipeline/touchpoints";

const STAGE_TO_KIND: Record<MessageStage, keyof typeof MESSAGE_KIND_TO_STAGE> = {
  before_7d: "message_before_7d",
  before_2d: "message_before_2d",
  after_24h: "message_after_24h",
};

/** Generic vs Persona, side by side, scored by the same rules. */
export function MessageCompare({ run, touchpoints, tpScores, onAction, onOpenClaim, canApprove = true }: { run: PersonaRun; touchpoints: Touchpoint[]; tpScores: Record<string, TiScore>; onAction: OnTouchpointAction; onOpenClaim: (id: string) => void; canApprove?: boolean }) {
  return (
    <div className="grid gap-4" data-demo="messages">
      {run.outputs.messages.map((m) => {
        const generic = run.generic.messages.find((g) => g.stage === m.stage);
        const score = run.scores.messages.find((s) => s.stage === m.stage);
        const tp = touchpoints.find((t) => t.kind === STAGE_TO_KIND[m.stage]);
        const personaScore = tp ? (tpScores[tp.id] ?? score?.persona ?? null) : (score?.persona ?? null);
        const recipient = run.profile.recipients.find((r) => r.role === m.recipient);
        const edited = tp && tp.text !== tp.originalText;
        return (
          <Card key={m.stage} className="gap-0 overflow-hidden p-0" data-demo={`message-${m.stage}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
              <h3 className="text-sm font-medium">
                {MESSAGE_STAGE_LABEL[m.stage]}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  to {recipient?.name ?? m.recipient}
                  {recipient?.relationship && recipient.role !== "patient" ? ` (${recipient.relationship})` : ""} · {run.profile.communicationNeeds.channel.toUpperCase()}
                </span>
              </h3>
              {score && personaScore && (
                <div className="flex items-center gap-2 text-sm">
                  <ScorePill score={score.generic.score} blocked={score.generic.blocked} size="sm" />
                  <ArrowRightIcon aria-hidden className="size-4 text-muted-foreground" />
                  <ScorePill score={personaScore.score} blocked={personaScore.blocked} size="sm" />
                </div>
              )}
            </div>
            <div className="grid md:grid-cols-2">
              <section className="border-b p-4 md:border-b-0 md:border-r" aria-label="Today's template">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground font-sans">Today&apos;s template</h4>
                  {score && <ScorePill score={score.generic.score} blocked={score.generic.blocked} size="sm" />}
                </div>
                <p className="mt-2 font-mono text-[13px] leading-relaxed text-foreground/85">{generic && score ? <HighlightedText text={generic.text} findings={score.generic.findings} /> : generic?.text}</p>
                {score && (
                  <div className="mt-3">
                    <TiFindings score={score.generic} />
                  </div>
                )}
              </section>
              <section className="p-4 voice-surface" aria-label="Persona message">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-medium uppercase tracking-[0.12em] font-sans" style={{ color: "var(--voice-muted)" }}>
                    Off the Chart · {run.profile.preferredName}&apos;s version{edited ? " (edited)" : ""}
                  </h4>
                  {personaScore && <ScorePill score={personaScore.score} blocked={personaScore.blocked} size="sm" />}
                </div>
                <p className="mt-2 text-[15px] leading-relaxed">{personaScore ? <HighlightedText text={tp?.text ?? m.persona} findings={personaScore.findings} /> : (tp?.text ?? m.persona)}</p>
                {personaScore && (
                  <div className="mt-3 font-sans">
                    <TiFindings score={personaScore} />
                  </div>
                )}
                {m.claimIds.length > 0 && (
                  <p className="mt-3 flex flex-wrap items-center gap-1 font-sans text-xs" style={{ color: "var(--voice-muted)" }}>
                    Built on:
                    {m.claimIds.slice(0, 6).map((id) => (
                      <button key={id} type="button" onClick={() => onOpenClaim(id)} className="rounded border bg-background/60 px-1.5 py-0.5 font-mono text-[11px] hover:bg-background outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Open evidence for ${id}`}>
                        {id}
                      </button>
                    ))}
                  </p>
                )}
                {tp && (
                  <div className="mt-4 font-sans">
                    <TouchpointActions tp={tp} score={personaScore} onAction={onAction} demoKey={m.stage === "before_2d" ? "approve-2d" : undefined} canApprove={canApprove} />
                  </div>
                )}
              </section>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
