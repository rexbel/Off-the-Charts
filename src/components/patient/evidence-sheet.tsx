"use client";

import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ClaimKindBadge } from "@/components/badges";
import type { Claim, PersonaRun, PrivacyRule } from "@/lib/schemas";

export type EvidenceItem = { kind: "claim"; claim: Claim } | { kind: "privacy"; rule: PrivacyRule };

export function findEvidence(run: PersonaRun, id: string): EvidenceItem | null {
  const claim = [...run.profile.emotionalContext, ...run.profile.cognitiveSupport, ...run.profile.strengths].find((c) => c.id === id);
  if (claim) return { kind: "claim", claim };
  const rule = run.profile.privacyRules.find((p) => p.id === id);
  if (rule) return { kind: "privacy", rule };
  return null;
}

/** Claim → source. The trust surface: every statement points back to a field and encounter. */
export function EvidenceSheet({ run, itemId, onOpenChange, onConfirm, confirming }: { run: PersonaRun; itemId: string | null; onOpenChange: (open: boolean) => void; onConfirm: (claimId: string) => Promise<void>; confirming: boolean }) {
  const item = itemId ? findEvidence(run, itemId) : null;
  const text = item?.kind === "claim" ? item.claim.text : item?.rule.rule;
  const kind = item?.kind === "claim" ? item.claim.kind : item?.rule.kind;
  const reason = item?.kind === "claim" ? item.claim.reason : item?.rule.reason;
  const source = item?.kind === "claim" ? item.claim.source : item?.rule.source;
  const facts = source ? run.facts.filter((f) => source.factIds.includes(f.id)) : [];
  const confirmed = itemId ? run.confirmedClaimIds.includes(itemId) : false;

  return (
    <Sheet open={itemId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">Evidence</SheetTitle>
          <SheetDescription>Where this claim comes from in the record.</SheetDescription>
        </SheetHeader>
        {item && kind && (
          <div className="grid gap-4 px-4 pb-6">
            <div className="rounded-lg border bg-card p-3">
              <ClaimKindBadge kind={kind} confirmed={confirmed} />
              <p className="mt-2 text-sm leading-snug">{text}</p>
              {reason && (
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">Why the model thinks so:</span> {reason}
                </p>
              )}
              {item.kind === "privacy" && (
                <dl className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  <div>
                    <dt className="inline font-medium text-foreground/80">Restricted terms: </dt>
                    <dd className="inline">{item.rule.restrictedTerms.join(", ")}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-foreground/80">Channels: </dt>
                    <dd className="inline">{item.rule.channels.join(", ")}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-foreground/80">Recipients: </dt>
                    <dd className="inline">{item.rule.recipients.length ? item.rule.recipients.join(", ") : "all"}</dd>
                  </div>
                </dl>
              )}
            </div>

            <div>
              <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground font-sans">Source facts</h3>
              {facts.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">{source?.note ?? "No chart fact cited. This rests on the patient's own words or the coordinator's settings."}</p>
              ) : (
                <ul className="mt-2 grid gap-2" role="list">
                  {facts.map((f) => (
                    <li key={f.id} className="rounded-md border p-2.5 text-sm">
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{f.id}</code>
                        <span>{f.field}</span>
                        {f.encounterId && (
                          <span>
                            · encounter {f.encounterId}
                            {f.date ? ` · ${f.date}` : ""}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 leading-snug">{f.value}</p>
                    </li>
                  ))}
                </ul>
              )}
              {source?.note && facts.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Also: {source.note}</p>}
            </div>

            {kind === "inferred" && (
              <div className="rounded-lg border border-inferred/30 bg-inferred-soft/50 p-3">
                <p className="text-sm">This is the model&apos;s judgment, not a documented fact. Confirm it if it matches what you know about {run.profile.preferredName}.</p>
                <Button className="mt-2" size="sm" onClick={() => itemId && onConfirm(itemId)} disabled={confirmed || confirming} data-demo="confirm-claim">
                  <CheckIcon aria-hidden /> {confirmed ? "Confirmed" : "Confirm this claim"}
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
