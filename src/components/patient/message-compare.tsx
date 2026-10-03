"use client";

import { ArrowRightIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScorePill } from "@/components/badges";
import { HighlightedText } from "./highlighted-text";
import { TiFindings } from "./ti-findings";
import { TouchpointActions, type OnTouchpointAction } from "./touchpoint-actions";
import { MESSAGE_STAGE_LABEL, messageStageSchema, type MessageStage, type PersonaRun, type TiScore, type Touchpoint } from "@/lib/schemas";
import { MESSAGE_KIND_TO_STAGE } from "@/lib/pipeline/touchpoints";
import { cn } from "@/lib/utils";

const STAGE_TO_KIND: Record<MessageStage, keyof typeof MESSAGE_KIND_TO_STAGE> = {
  before_7d: "message_before_7d",
  before_2d: "message_before_2d",
  after_24h: "message_after_24h",
};

/**
 * Generic vs Persona, side by side, scored by the same rules. One card per
 * stage; a teen/guardian split shows a column per recipient.
 */
export function MessageCompare({ run, touchpoints, tpScores, onAction, onOpenClaim, canApprove = true }: { run: PersonaRun; touchpoints: Touchpoint[]; tpScores: Record<string, TiScore>; onAction: OnTouchpointAction; onOpenClaim: (id: string) => void; canApprove?: boolean }) {
  return (
    <div className="grid gap-4" data-demo="messages">
      {messageStageSchema.options.map((stage) => {
        const versions = run.outputs.messages.filter((m) => m.stage === stage);
        if (versions.length === 0) return null;
        const generic = run.generic.messages.find((g) => g.stage === stage);
        const primaryScore = run.scores.messages.find((s) => s.stage === stage && s.recipient === versions[0].recipient) ?? run.scores.messages.find((s) => s.stage === stage);
        const split = versions.length > 1;
        return (
          <Card key={stage} className="gap-0 overflow-hidden p-0" data-demo={`message-${stage}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
              <h3 className="text-sm font-medium">
                {MESSAGE_STAGE_LABEL[stage]}
                <span className="ml-2 text-xs font-normal text-muted-foreground">{run.profile.communicationNeeds.channel.toUpperCase()}{split ? " · two recipients" : ""}</span>
              </h3>
              {primaryScore && (
                <div className="flex items-center gap-2 text-sm">
                  <ScorePill score={primaryScore.generic.score} blocked={primaryScore.generic.blocked} size="sm" />
                  <ArrowRightIcon aria-hidden className="size-4 text-muted-foreground" />
                  <ScorePill score={(versions[0] && tpScoreFor(versions[0].recipient))?.score ?? primaryScore.persona.score} blocked={(versions[0] && tpScoreFor(versions[0].recipient))?.blocked ?? primaryScore.persona.blocked} size="sm" />
                </div>
              )}
            </div>
            <div className={cn("grid", split ? "lg:grid-cols-3" : "md:grid-cols-2")}>
              <section className={cn("border-b p-4", split ? "lg:border-b-0 lg:border-r" : "md:border-b-0 md:border-r")} aria-label="Today's template">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground font-sans">Today&apos;s template</h4>
                  {primaryScore && <ScorePill score={primaryScore.generic.score} blocked={primaryScore.generic.blocked} size="sm" />}
                </div>
                <p className="mt-2 font-mono text-[13px] leading-relaxed text-foreground/85">{generic && primaryScore ? <HighlightedText text={generic.text} findings={primaryScore.generic.findings} /> : generic?.text}</p>
                {primaryScore && (
                  <div className="mt-3">
                    <TiFindings score={primaryScore.generic} />
                  </div>
                )}
              </section>
              {versions.map((m, i) => {
                const tp = touchpoints.find((t) => t.kind === STAGE_TO_KIND[stage] && t.recipient === m.recipient);
                const stored = run.scores.messages.find((s) => s.stage === stage && s.recipient === m.recipient);
                const personaScore = tp ? (tpScores[tp.id] ?? stored?.persona ?? null) : (stored?.persona ?? null);
                const recipient = run.profile.recipients.find((r) => r.role === m.recipient);
                const edited = tp && tp.text !== tp.originalText;
                return (
                  <section key={m.recipient} className={cn("p-4 voice-surface", split && i === 0 && "border-b lg:border-b-0 lg:border-r")} aria-label={`Persona message to ${m.recipient}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-medium uppercase tracking-[0.12em] font-sans" style={{ color: "var(--voice-muted)" }}>
                        To {recipient?.name ?? m.recipient}
                        {recipient?.relationship && recipient.role !== "patient" ? ` (${recipient.relationship})` : ""}
                        {edited ? " · edited" : ""}
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
                        {[...new Set(m.claimIds)].slice(0, 6).map((id) => (
                          <button key={id} type="button" onClick={() => onOpenClaim(id)} className="rounded border bg-background/60 px-1.5 py-0.5 font-mono text-[11px] hover:bg-background outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Open evidence for ${id}`}>
                            {id}
                          </button>
                        ))}
                      </p>
                    )}
                    {tp && (
                      <div className="mt-4 font-sans">
                        <TouchpointActions tp={tp} score={personaScore} onAction={onAction} demoKey={stage === "before_2d" && i === 0 ? "approve-2d" : undefined} canApprove={canApprove} />
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </Card>
        );

        function tpScoreFor(recipient: string): TiScore | undefined {
          const tp = touchpoints.find((t) => t.kind === STAGE_TO_KIND[stage] && t.recipient === recipient);
          return tp ? tpScores[tp.id] : undefined;
        }
      })}
    </div>
  );
}
