"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDaysIcon, CheckCircle2Icon, SearchIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudienceBadge, DementiaBadge, DemoRoleBadge, LanguageBadge, SourceBadge } from "@/components/badges";
import type { AgeBand, PatientSummary } from "@/lib/schemas";
import { daysUntilLabel } from "@/lib/visit";
import { cn } from "@/lib/utils";

const BANDS: { key: AgeBand | "all"; label: string }[] = [
  { key: "all", label: "All ages" },
  { key: "pediatric", label: "Children" },
  { key: "adolescent", label: "Teens" },
  { key: "young_adult", label: "Young adults" },
  { key: "adult", label: "Adults" },
  { key: "midlife", label: "Midlife" },
  { key: "older_adult", label: "Older adults" },
];

export function CohortBoard({ patients }: { patients: PatientSummary[] }) {
  const [band, setBand] = useState<AgeBand | "all">("all");
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return patients
      .filter((p) => band === "all" || p.ageBand === band)
      .filter((p) => !needle || [p.displayName, p.personaArchetype, p.upcomingVisit.department, p.upcomingVisit.reason, ...p.primaryDiagnoses].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => a.upcomingVisit.daysUntil - b.upcomingVisit.daysUntil || a.age - b.age);
  }, [patients, band, q]);

  return (
    <section className="mt-10" aria-labelledby="cohort-heading" data-demo="cohort-board">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="cohort-heading" className="text-2xl font-semibold">
            Upcoming visits
          </h2>
          <p className="text-sm text-muted-foreground">{patients.length} synthetic patients, ages 3 to 75. Sorted by how soon they&apos;re coming in.</p>
        </div>
        <div className="w-full sm:w-72">
          <Label htmlFor="cohort-search" className="sr-only">
            Search patients
          </Label>
          <div className="relative">
            <SearchIcon aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="cohort-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, condition, clinic…" className="pl-8" />
          </div>
        </div>
      </div>

      <Tabs value={band} onValueChange={(v) => setBand(v as AgeBand | "all")} className="mt-4">
        <TabsList aria-label="Filter by age band" className="flex-wrap h-auto">
          {BANDS.map((b) => (
            <TabsTrigger key={b.key} value={b.key}>
              {b.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {shown.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No patients match. Try a different age band or clear the search.</div>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list">
          {shown.map((p) => (
            <li key={p.patientId}>
              <PatientCard p={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PatientCard({ p }: { p: PatientSummary }) {
  const approved = p.latestRun ? `${p.latestRun.approvedCount}/${p.latestRun.touchpointCount} approved` : null;
  return (
    <Link
      href={`/patients/${p.patientId}`}
      data-demo={`patient-card-${p.patientId}`}
      className={cn("group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50", p.demoRole && "")}
    >
      <Card className={cn("h-full gap-3 p-4 transition-colors group-hover:border-teal/50 group-hover:bg-accent/30", p.demoRole === "ideal" && "border-teal/40")}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-heading text-lg font-semibold leading-tight">{p.displayName}</h3>
            <p className="text-xs text-muted-foreground">
              {p.age} · {p.sex === "F" ? "Female" : p.sex === "M" ? "Male" : p.sex} · {p.encounterCount} encounters
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
            <CalendarDaysIcon aria-hidden className="size-3.5" /> {daysUntilLabel(p.upcomingVisit.daysUntil)}
          </span>
        </div>
        <p className="text-sm leading-snug">
          <span className="font-medium">{p.upcomingVisit.department}.</span> <span className="text-muted-foreground">{p.upcomingVisit.reason}</span>
        </p>
        <p className="text-xs text-teal">{p.personaArchetype}</p>
        <div className="mt-auto flex flex-wrap gap-1.5">
          <AudienceBadge audience={p.audience} />
          {p.dementia && <DementiaBadge />}
          <LanguageBadge language={p.language} />
          <DemoRoleBadge role={p.demoRole} />
        </div>
        {p.latestRun && (
          <div className="flex flex-wrap items-center gap-1.5 border-t pt-2 text-xs text-muted-foreground">
            <CheckCircle2Icon aria-hidden className="size-3.5 text-ok" /> {approved}
            <SourceBadge source={p.latestRun.source} className="ml-auto" />
          </div>
        )}
      </Card>
    </Link>
  );
}
