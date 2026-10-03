"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheckIcon, CircleDashedIcon, CircleIcon, ClockIcon, MailCheckIcon, MailIcon, MailXIcon, SearchIcon, SendIcon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AUDIENCE_LABEL, type AgeBand, type PatientSummary } from "@/lib/schemas";
import { daysUntilLabel } from "@/lib/visit";
import { RelativeTime } from "@/components/shell/relative-time";
import { cn } from "@/lib/utils";

type Stage = "all" | "needs_persona" | "needs_review" | "ready" | "sent";

const STAGES: { key: Stage; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_persona", label: "Needs persona" },
  { key: "needs_review", label: "Needs review" },
  { key: "ready", label: "Ready to send" },
  { key: "sent", label: "Sent" },
];

const BANDS: { key: AgeBand | "all"; label: string }[] = [
  { key: "all", label: "All ages" },
  { key: "pediatric", label: "Children" },
  { key: "adolescent", label: "Teens" },
  { key: "young_adult", label: "Young adults" },
  { key: "adult", label: "Adults" },
  { key: "midlife", label: "Midlife" },
  { key: "older_adult", label: "Older adults" },
];

function stageOf(p: PatientSummary): Exclude<Stage, "all"> {
  const r = p.latestRun;
  if (!r) return "needs_persona";
  if (r.sentCount > 0 && r.pendingCount === 0) return "sent";
  if (r.pendingCount > 0) return "needs_review";
  return "ready";
}

/** Icon + word + color, never color alone. */
function PersonaMark({ p }: { p: PatientSummary }) {
  const r = p.latestRun;
  if (!r) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <CircleDashedIcon aria-hidden className="size-4 shrink-0" /> Not built
      </span>
    );
  }
  if (r.sentCount > 0 && r.pendingCount === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-teal">
        <SendIcon aria-hidden className="size-4 shrink-0" /> Sent {r.sentCount}/{r.touchpointCount}
      </span>
    );
  }
  if (r.pendingCount > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-warn">
        <CircleIcon aria-hidden className="size-4 shrink-0" /> {r.pendingCount} to review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-ok">
      <CircleCheckIcon aria-hidden className="size-4 shrink-0" /> {r.approvedCount} approved
    </span>
  );
}

function CheckinMark({ p }: { p: PatientSummary }) {
  const c = p.checkin;
  if (!c)
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <MailIcon aria-hidden className="size-4 shrink-0" /> Not sent
      </span>
    );
  if (c.status === "submitted")
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-ok">
        <MailCheckIcon aria-hidden className="size-4 shrink-0" /> Answered
      </span>
    );
  if (c.status === "expired")
    return (
      <span className="inline-flex items-center gap-1.5 text-bad">
        <MailXIcon aria-hidden className="size-4 shrink-0" /> Expired
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <ClockIcon aria-hidden className="size-4 shrink-0" /> Link sent
    </span>
  );
}

export function PatientsTable({ patients }: { patients: PatientSummary[] }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("all");
  const [band, setBand] = useState<AgeBand | "all">("all");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<Stage, number> = { all: patients.length, needs_persona: 0, needs_review: 0, ready: 0, sent: 0 };
    for (const p of patients) c[stageOf(p)] += 1;
    return c;
  }, [patients]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return patients
      .filter((p) => stage === "all" || stageOf(p) === stage)
      .filter((p) => band === "all" || p.ageBand === band)
      .filter((p) => !needle || [p.displayName, p.upcomingVisit.department, p.upcomingVisit.reason, ...p.primaryDiagnoses, p.latestRun?.summaryLine ?? ""].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => a.upcomingVisit.daysUntil - b.upcomingVisit.daysUntil || a.displayName.localeCompare(b.displayName));
  }, [patients, stage, band, q]);

  return (
    <div className="space-y-4" data-demo="patients-table">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Filter by stage" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {STAGES.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={stage === s.key}
              onClick={() => setStage(s.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                stage === s.key ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label} <span className="ml-1 text-xs text-muted-foreground tabular-nums">{counts[s.key]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="w-44">
            <Label htmlFor="band" className="sr-only">
              Age band
            </Label>
            <Select value={band} onValueChange={(v) => setBand(v as AgeBand | "all")}>
              <SelectTrigger id="band" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BANDS.map((b) => (
                  <SelectItem key={b.key} value={b.key}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative w-full md:w-64">
            <Label htmlFor="patient-search" className="sr-only">
              Search patients
            </Label>
            <SearchIcon aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="patient-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, clinic, condition" className="pl-8" />
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <UsersIcon aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold font-sans">No patients match</h2>
          <p className="mt-1 text-sm text-muted-foreground">Try another stage, age band or search term.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:block">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-11 px-3">Patient</TableHead>
                  <TableHead className="px-3">Visit</TableHead>
                  <TableHead className="px-3">When</TableHead>
                  <TableHead className="px-3">Messages to</TableHead>
                  <TableHead className="px-3">Check-in</TableHead>
                  <TableHead className="px-3">Persona</TableHead>
                  <TableHead className="px-3">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((p) => (
                  <TableRow key={p.patientId} onClick={() => router.push(`/patients/${p.patientId}`)} className="cursor-pointer">
                    <TableCell className="whitespace-normal px-3 py-3">
                      <Link href={`/patients/${p.patientId}`} onClick={(e) => e.stopPropagation()} className="font-medium rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50" data-demo={`patient-card-${p.patientId}`}>
                        {p.displayName}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {p.age} · {p.sex === "F" ? "Female" : p.sex === "M" ? "Male" : p.sex}
                        {p.language === "es" ? " · Spanish" : ""}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-normal px-3 py-3">
                      <span className="block">{p.upcomingVisit.department}</span>
                      <span className="block text-xs text-muted-foreground">{p.upcomingVisit.reason}</span>
                    </TableCell>
                    <TableCell className="px-3 py-3 whitespace-nowrap">
                      <span className={cn(p.upcomingVisit.daysUntil <= 1 && "font-medium text-warn")}>{daysUntilLabel(p.upcomingVisit.daysUntil)}</span>
                    </TableCell>
                    <TableCell className="whitespace-normal px-3 py-3">
                      <span className="block">{AUDIENCE_LABEL[p.audience]}</span>
                      {p.caregiver && <span className="block text-xs text-muted-foreground">{p.caregiver}</span>}
                    </TableCell>
                    <TableCell className="px-3 py-3 whitespace-nowrap">
                      <CheckinMark p={p} />
                    </TableCell>
                    <TableCell className="px-3 py-3 whitespace-nowrap">
                      <PersonaMark p={p} />
                      {p.latestRun && <span className="block text-xs text-muted-foreground">{p.latestRun.source === "live" ? "Live model" : p.latestRun.source === "cached" ? "Cached" : "Rules"}</span>}
                    </TableCell>
                    <TableCell className="px-3 py-3 text-muted-foreground whitespace-nowrap">{p.updatedAt ? <RelativeTime iso={p.updatedAt} /> : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 md:hidden" role="list">
            {shown.map((p) => (
              <li key={p.patientId}>
                <Link href={`/patients/${p.patientId}`} className="block space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-base font-semibold">{p.displayName}</span>
                    <Badge variant="secondary">{daysUntilLabel(p.upcomingVisit.daysUntil)}</Badge>
                  </div>
                  <p className="text-sm">
                    {p.upcomingVisit.department} · {p.upcomingVisit.reason}
                  </p>
                  <p className="text-sm text-muted-foreground">{AUDIENCE_LABEL[p.audience]}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <PersonaMark p={p} />
                    <CheckinMark p={p} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
