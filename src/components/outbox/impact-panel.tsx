import { ArrowDownIcon, ArrowUpIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { OutboxMetrics } from "@/lib/schemas";

export function ImpactPanel({ metrics }: { metrics: OutboxMetrics }) {
  const empty = metrics.patientsWithRuns === 0;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-demo="impact">
      <Card className="gap-1 p-4">
        <p className="text-xs text-muted-foreground">Reading grade · 2-day messages</p>
        <p className="font-heading text-3xl tabular-nums leading-none">
          {empty ? "—" : (
            <>
              <span className="text-muted-foreground/70">{metrics.avgReadingGradeGeneric}</span>
              <ArrowDownIcon aria-label="down to" className="mx-1 inline size-5 text-teal" />
              <span className="text-teal">{metrics.avgReadingGradePersona}</span>
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground">Flesch-Kincaid, synthetic composite template vs Persona</p>
      </Card>
      <Card className="gap-1 p-4">
        <p className="text-xs text-muted-foreground">Trauma-informed score</p>
        <p className="font-heading text-3xl tabular-nums leading-none">
          {empty ? "—" : (
            <>
              <span className="text-muted-foreground/70">{metrics.avgTiScoreGeneric}</span>
              <ArrowUpIcon aria-label="up to" className="mx-1 inline size-5 text-teal" />
              <span className="text-teal">{metrics.avgTiScorePersona}</span>
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground">Same eight rules on both versions</p>
      </Card>
      <Card className="gap-1 p-4">
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <SparklesIcon aria-hidden className="size-3.5" /> Stigma terms removed
        </p>
        <p className="font-heading text-3xl tabular-nums leading-none">{empty ? "—" : metrics.stigmaTermsRemoved}</p>
        <p className="text-xs text-muted-foreground">Flagged in the template, absent in the rewrite</p>
      </Card>
      <Card className="gap-1 p-4">
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheckIcon aria-hidden className="size-3.5" /> Privacy rules enforced
        </p>
        <p className="font-heading text-3xl tabular-nums leading-none">{empty ? "—" : metrics.privacyRulesEnforced}</p>
        <p className="text-xs text-muted-foreground">
          {metrics.patientsWithRuns} patient{metrics.patientsWithRuns === 1 ? "" : "s"} with runs · {metrics.touchpointsApproved}/{metrics.touchpointsTotal} approved
        </p>
      </Card>
    </div>
  );
}
