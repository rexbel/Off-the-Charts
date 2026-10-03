"use client";

import { ClockIcon, LanguagesIcon, MessageSquareIcon, TriangleAlertIcon, UsersIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { SourceBadge, CLAIM_KIND } from "@/components/badges";
import { PipelineSteps, type StagesState } from "./pipeline-steps";
import type { Claim, PersonaRun, PrivacyRule } from "@/lib/schemas";
import { AUDIENCE_LABEL } from "@/lib/schemas";
import { cn } from "@/lib/utils";

function ClaimChip({ claim, confirmed, onOpen }: { claim: Claim | PrivacyRule; confirmed: boolean; onOpen: (id: string) => void }) {
  const k = CLAIM_KIND[claim.kind];
  const Icon = k.icon;
  const text = "text" in claim ? claim.text : claim.rule;
  return (
    <button
      type="button"
      onClick={() => onOpen(claim.id)}
      className={cn(
        "group inline-flex max-w-full items-start gap-1.5 rounded-md border px-2 py-1 text-left text-xs leading-snug transition-colors hover:bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        claim.kind === "inferred" && !confirmed && "border-inferred/40",
      )}
      aria-label={`${k.label}: ${text}. Open evidence.`}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-3.5 shrink-0", claim.kind === "fact" ? "text-teal" : claim.kind === "inferred" ? (confirmed ? "text-ok" : "text-inferred") : "text-stated")} />
      <span className="min-w-0">
        <span>{text}</span>
        {claim.kind === "inferred" && <span className={cn("ml-1 font-medium", confirmed ? "text-ok" : "text-inferred")}>{confirmed ? "· confirmed" : "· inferred, confirm"}</span>}
      </span>
    </button>
  );
}

export function PersonaCard({ run, stages, onOpenClaim }: { run: PersonaRun; stages: StagesState | null; onOpenClaim: (id: string) => void }) {
  const p = run.profile;
  const v = run.voiceGuide;
  const confirmed = (id: string) => run.confirmedClaimIds.includes(id);
  const primary = p.recipients.find((r) => r.primary) ?? p.recipients[0];
  const inferredCount = [...p.emotionalContext, ...p.cognitiveSupport, ...p.strengths, ...p.privacyRules].filter((c) => c.kind === "inferred").length;
  const confirmedCount = run.confirmedClaimIds.length;

  return (
    <Card className="gap-4 p-4 sm:p-5" data-demo="persona-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-teal">Persona Profile</p>
          <h2 className="mt-1 font-heading text-xl sm:text-2xl leading-tight text-balance">{p.summaryLine}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <SourceBadge source={run.source} />
          {inferredCount > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {confirmedCount}/{inferredCount} inferred confirmed
            </span>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="flex items-start gap-2">
          <UsersIcon aria-hidden className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <dt className="text-xs text-muted-foreground">Speak to</dt>
            <dd className="font-medium leading-snug">
              {primary.name ?? primary.role}
              {primary.relationship && primary.role !== "patient" ? ` (${primary.relationship})` : ""}
              <span className="block text-xs font-normal text-muted-foreground">{AUDIENCE_LABEL[p.audience]}</span>
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <MessageSquareIcon aria-hidden className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <dt className="text-xs text-muted-foreground">Reading level</dt>
            <dd className="font-medium">
              Grade {p.communicationNeeds.readingLevel} · {p.communicationNeeds.detailPreference}
              <span className="block text-xs font-normal text-muted-foreground">≤ {v.sentenceMaxWords} words a sentence</span>
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <LanguagesIcon aria-hidden className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <dt className="text-xs text-muted-foreground">Language · channel</dt>
            <dd className="font-medium">
              {p.communicationNeeds.language === "es" ? "Spanish" : "English"} · {p.communicationNeeds.channel.toUpperCase()}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <ClockIcon aria-hidden className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <dt className="text-xs text-muted-foreground">Best time</dt>
            <dd className="font-medium">{p.communicationNeeds.bestTimeOfDay ?? "Not stated"}</dd>
          </div>
        </div>
      </dl>

      {p.dataQualityWarnings.length > 0 && (
        <Alert className="border-warn/40 bg-warn-soft/50" data-demo="data-quality">
          <TriangleAlertIcon aria-hidden className="text-warn" />
          <AlertTitle>Chart check</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {p.dataQualityWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs">Shown to staff only. Never repeated to the patient.</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <ClaimGroup title="Emotional context" items={p.emotionalContext} confirmed={confirmed} onOpen={onOpenClaim} />
        <ClaimGroup title="Privacy rules" items={p.privacyRules} confirmed={confirmed} onOpen={onOpenClaim} empty="No restricted terms for this person." />
        <ClaimGroup title="Cognitive support" items={p.cognitiveSupport} confirmed={confirmed} onOpen={onOpenClaim} empty="None needed." />
        <ClaimGroup title="Strengths" items={p.strengths} confirmed={confirmed} onOpen={onOpenClaim} empty="None recorded." />
      </div>

      <Accordion type="multiple" className="rounded-lg border px-3">
        <AccordionItem value="voice">
          <AccordionTrigger className="text-sm">Voice Guide · {v.tone.join(", ")}</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground font-sans">Addressing</p>
                <p className="mt-1">{v.addressing}</p>
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground font-sans">Opens · closes</p>
                <p className="mt-1 font-voice">
                  “{v.greeting}” · “{v.signoff}”
                </p>
              </div>
              <div className="grid gap-2">
                <List label="Do say" items={v.doSay} tone="ok" />
                <List label="Don't say" items={v.dontSay} tone="bad" />
                <List label="Choice phrases" items={v.choicePhrases} />
                <List label="Safety phrases" items={v.safetyPhrases} />
              </div>
            </div>
            {p.avoidTerms.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">Avoid terms: </span>
                {p.avoidTerms.join(", ")}
              </p>
            )}
          </AccordionContent>
        </AccordionItem>
        {stages && (
          <AccordionItem value="pipeline">
            <AccordionTrigger className="text-sm">Pipeline · {run.stages.map((s) => `${s.stage}: ${s.source}`).join(" · ")}</AccordionTrigger>
            <AccordionContent>
              <PipelineSteps stages={stages} compact />
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </Card>
  );
}

function ClaimGroup({ title, items, confirmed, onOpen, empty }: { title: string; items: (Claim | PrivacyRule)[]; confirmed: (id: string) => boolean; onOpen: (id: string) => void; empty?: string }) {
  return (
    <section aria-label={title}>
      <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground font-sans">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{empty ?? "None."}</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {items.map((c) => (
            <ClaimChip key={c.id} claim={c} confirmed={confirmed(c.id)} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

function List({ label, items, tone }: { label: string; items: string[]; tone?: "ok" | "bad" }) {
  if (!items.length) return null;
  return (
    <div>
      <p className={cn("text-xs font-medium uppercase tracking-[0.12em] font-sans", tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "text-muted-foreground")}>{label}</p>
      <p className="mt-0.5 text-sm leading-snug">{items.join(" · ")}</p>
    </div>
  );
}
