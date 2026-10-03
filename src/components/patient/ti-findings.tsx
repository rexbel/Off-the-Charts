"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon, ShieldAlertIcon, XIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { TiRule, TiScore } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export const RULE_LABEL: Record<TiRule, string> = {
  reading_level: "Reading level",
  sentence_length: "Sentence length",
  stigma: "Stigma and blame",
  privacy: "Privacy rules",
  choice: "Offers a choice",
  predictability: "Says what will happen",
  safety: "Gives a way to reach us",
  collaboration: "Collaborative voice",
};

/** The checker's reasons, as a checklist. Rules, not vibes. */
export function TiFindings({ score, defaultOpen = false, label = "Why this score" }: { score: TiScore; defaultOpen?: boolean; label?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const failed = score.findings.filter((f) => !f.passed).length;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-sm">
        <ChevronDownIcon aria-hidden className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
        {label} · grade {score.readingGrade.toFixed(1)} · {failed === 0 ? "all rules pass" : `${failed} ${failed === 1 ? "rule" : "rules"} failed`}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 space-y-1 text-xs" role="list">
          {score.findings.map((f) => (
            <li key={f.rule} className={cn("flex items-start gap-2 rounded-md px-2 py-1", !f.passed && f.severity === "block" ? "bg-inferred-soft" : !f.passed ? "bg-bad-soft/60" : "")}>
              {f.passed ? (
                <CheckIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ok" />
              ) : f.severity === "block" ? (
                <ShieldAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-inferred" />
              ) : (
                <XIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-bad" />
              )}
              <span className="min-w-0">
                <span className="font-medium">{RULE_LABEL[f.rule]}</span>
                <span className="text-muted-foreground tabular-nums"> · {f.points}/{f.pointsAvailable}</span>
                <span className="block text-muted-foreground">{f.message}</span>
                {f.matches.length > 0 && f.rule === "stigma" && (
                  <span className="mt-0.5 block text-muted-foreground">
                    {f.matches
                      .slice(0, 4)
                      .map((m) => (m.suggestion ? `"${m.term}" → ${m.suggestion}` : `"${m.term}"`))
                      .join(" · ")}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
