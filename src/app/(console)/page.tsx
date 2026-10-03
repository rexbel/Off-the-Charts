import Link from "next/link";
import { ArrowRightIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CohortBoard } from "@/components/cohort/cohort-board";
import { patientSummaries } from "@/lib/services/patients";
import { outboxMetrics } from "@/lib/services/outbox";
import { DEMO_PATIENT_IDS } from "@/lib/data/cohort";
import { currentNamespace } from "@/lib/namespace";

export const dynamic = "force-dynamic";

export default async function CohortPage() {
  const ns = await currentNamespace();
  const [patients, metrics] = await Promise.all([patientSummaries(ns), outboxMetrics(ns)]);
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal">Persona engine · care team console</p>
          <h1 className="mt-2 text-4xl sm:text-5xl font-semibold leading-[1.05] text-balance">
            Your chart says what&apos;s wrong. <span className="text-teal">Off the Chart</span> says how to talk to you.
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg text-muted-foreground">
            Pick a patient. The engine turns their EHR and their own words into a Persona Profile and Voice Guide, then renders every touchpoint: reminders, a visit summary, a prep video and a 30-second clinician brief. You approve before anything goes out.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild size="lg" data-demo="start-with-emily">
              <Link href={`/patients/${DEMO_PATIENT_IDS.ideal}`}>
                Start with Emily <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">
                <PlayIcon aria-hidden /> Guided walkthrough
              </Link>
            </Button>
          </div>
        </div>
        <MetricStrip metrics={metrics} />
      </section>

      <CohortBoard patients={patients} />
    </div>
  );
}

function MetricStrip({ metrics }: { metrics: Awaited<ReturnType<typeof outboxMetrics>> }) {
  const has = metrics.patientsWithRuns > 0;
  return (
    <aside aria-label="Impact so far" className="rounded-xl border bg-card p-4 sm:p-5" data-demo="metric-strip">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground font-sans">Measured on stored runs</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {metrics.patientsWithRuns} of 20 patients · {metrics.touchpointsApproved}/{metrics.touchpointsTotal} approved
        </span>
      </div>
      {has ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:grid-cols-2">
          <Metric label="Reading grade" from={metrics.avgReadingGradeGeneric} to={metrics.avgReadingGradePersona} lowerIsBetter />
          <Metric label="Trauma-informed score" from={metrics.avgTiScoreGeneric} to={metrics.avgTiScorePersona} />
          <Metric label="Stigma terms removed" value={metrics.stigmaTermsRemoved} />
          <Metric label="Privacy rules enforced" value={metrics.privacyRulesEnforced} />
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No runs yet. Build a persona and the before/after numbers appear here.</p>
      )}
    </aside>
  );
}

function Metric({ label, from, to, value, lowerIsBetter }: { label: string; from?: number; to?: number; value?: number; lowerIsBetter?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-heading text-2xl tabular-nums leading-none">
        {value !== undefined ? (
          value
        ) : (
          <>
            <span className="text-muted-foreground/70">{from}</span>
            <span className="mx-1.5 text-muted-foreground/60 font-sans text-base">→</span>
            <span className={lowerIsBetter ? "text-teal" : "text-teal"}>{to}</span>
          </>
        )}
      </dd>
    </div>
  );
}
