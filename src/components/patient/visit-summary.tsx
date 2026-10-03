"use client";

import { useState } from "react";
import { CopyIcon, PrinterIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScorePill } from "@/components/badges";
import { HighlightedText } from "./highlighted-text";
import { TiFindings } from "./ti-findings";
import { TouchpointActions, type OnTouchpointAction } from "./touchpoint-actions";
import type { PersonaRun, TiScore, Touchpoint } from "@/lib/schemas";

/** Patient-facing after-visit summary in the "voice" palette. Printable. */
export function VisitSummaryView({ run, tp, score, onAction, onOpenClaim }: { run: PersonaRun; tp: Touchpoint | undefined; score: TiScore | null; onAction: OnTouchpointAction; onOpenClaim: (id: string) => void }) {
  const [showGeneric, setShowGeneric] = useState(false);
  const s = run.outputs.visitSummary;
  const es = run.profile.communicationNeeds.language === "es";
  const edited = tp && tp.text !== tp.originalText;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tp?.text ?? "");
      toast.success("Summary copied");
    } catch {
      toast.error("Could not copy on this device");
    }
  };

  return (
    <div className="grid gap-4" data-demo="summary">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Switch id="show-generic" checked={showGeneric} onCheckedChange={setShowGeneric} />
          <Label htmlFor="show-generic">Compare with today&apos;s summary</Label>
        </div>
        <div className="flex items-center gap-2">
          {score && <ScorePill score={score.score} blocked={score.blocked} size="sm" />}
          <Button variant="outline" size="sm" onClick={copy}>
            <CopyIcon aria-hidden /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <PrinterIcon aria-hidden /> Print
          </Button>
        </div>
      </div>

      <div className={showGeneric ? "grid gap-4 lg:grid-cols-2" : ""}>
        {showGeneric && (
          <Card className="no-print gap-3 p-5" aria-label="Today's after-visit summary">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground font-sans">Today: pasted from the note</h3>
              <ScorePill score={run.scores.summary.generic.score} blocked={run.scores.summary.generic.blocked} size="sm" />
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/85">
              <HighlightedText text={run.generic.summary} findings={run.scores.summary.generic.findings} />
            </pre>
            <TiFindings score={run.scores.summary.generic} />
          </Card>
        )}

        <Card className="voice-surface gap-5 p-6 sm:p-8 print:shadow-none print:border-0" aria-label="Visit summary for the patient">
          {edited && tp ? (
            <pre className="whitespace-pre-wrap font-voice text-base leading-relaxed">{tp.text}</pre>
          ) : (
            <>
              <header>
                <p className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: "var(--voice-accent)" }}>
                  {es ? "Resumen de su visita" : "Your visit summary"}
                </p>
                <h2 className="mt-1 font-heading text-3xl leading-tight">{s.headline}</h2>
              </header>
              <Section title={es ? "De qué hablamos" : "What we talked about"}>
                <ul className="grid gap-1.5">
                  {s.whatWeTalkedAbout.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden style={{ color: "var(--voice-accent)" }}>
                        •
                      </span>
                      <span>
                        {item.text}
                        {item.claimIds.length > 0 && (
                          <span className="no-print ml-1 inline-flex gap-1 align-middle">
                            {item.claimIds.slice(0, 3).map((id) => (
                              <button key={id} type="button" onClick={() => onOpenClaim(id)} className="rounded border px-1 font-mono text-[10px] opacity-70 hover:opacity-100" aria-label={`Open evidence for ${id}`}>
                                {id}
                              </button>
                            ))}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title={es ? "Sus próximos pasos" : "Your next steps"}>
                <ol className="grid gap-1.5">
                  {s.yourNextSteps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="font-heading tabular-nums" style={{ color: "var(--voice-accent)" }}>
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </Section>
              <Section title={es ? "Cuándo llamar" : "When to call"}>
                <ul className="grid gap-1.5">
                  {s.whenToCall.map((w, i) => (
                    <li key={i} className="rounded-md px-3 py-2" style={{ background: "var(--voice-card)" }}>
                      {w}
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title={es ? "Preguntas para la próxima vez" : "Questions for next time"}>
                <ul className="grid gap-1">
                  {s.questionsForNextTime.map((q, i) => (
                    <li key={i} className="italic" style={{ color: "var(--voice-muted)" }}>
                      {q}
                    </li>
                  ))}
                </ul>
              </Section>
              <footer className="text-sm" style={{ color: "var(--voice-muted)" }}>
                {run.voiceGuide.signoff} · {run.voiceGuide.safetyPhrases[0]}
              </footer>
            </>
          )}
        </Card>
      </div>

      {score && (
        <div className="no-print">
          <TiFindings score={score} />
        </div>
      )}
      {tp && (
        <div className="no-print">
          <TouchpointActions tp={tp} score={score} onAction={onAction} />
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: "var(--voice-muted)" }}>
        {title}
      </h3>
      <div className="mt-2 text-lg leading-relaxed">{children}</div>
    </section>
  );
}
