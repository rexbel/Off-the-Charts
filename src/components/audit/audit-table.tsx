"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScrollTextIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TOUCHPOINT_LABEL, type AuditEvent, type TouchpointKind } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Record<string, string> = {
  "touchpoint.approve": "Approved touchpoint",
  "touchpoint.reject": "Rejected touchpoint",
  "touchpoint.edit": "Edited touchpoint",
  "touchpoint.reset": "Reset touchpoint",
  "build.started": "Started a build",
  "run.saved": "Saved a run",
  "auth.login": "Signed in",
  "auth.login_failed": "Sign-in failed",
  "auth.logout": "Signed out",
  "outbox.send": "Sent (simulated)",
  "demo.reset": "Reset demo data",
  "context.saved": "Saved check-in",
  "claim.confirmed": "Confirmed a claim",
  rewrite: "Rewrote a message",
};

/** Keys that could ever carry free text. The service never writes them, and this table never renders them. */
const NEVER_RENDER = /text|checkin|note/i;

const META_LABEL: Record<string, string> = { kind: "touchpoint", edited: "edited", status: "status", namespace: "workspace", source: "source", role: "role", runs: "runs", touchpoints: "touchpoints", deliveries: "deliveries", channel: "channel", before: "before", after: "after", claimId: "claim", stages: "stages" };

function metaValue(key: string, value: string | number | boolean | null): string {
  if (value === null) return "none";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (key === "kind" && typeof value === "string" && value in TOUCHPOINT_LABEL) return TOUCHPOINT_LABEL[value as TouchpointKind];
  if (key === "stages" && typeof value === "string") return value.split(",").length + " stages";
  return String(value);
}

const cellStack = "block sm:table-cell whitespace-normal align-top sm:py-2.5 before:mb-0.5 before:block before:text-[11px] before:uppercase before:tracking-[0.12em] before:text-muted-foreground before:content-[attr(data-label)] sm:before:hidden";

export function AuditTable({ events, patients, selectedPatientId }: { events: AuditEvent[]; patients: { id: number; name: string }[]; selectedPatientId: number | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const names = new Map(patients.map((p) => [p.id, p.name]));

  const select = (value: string) => {
    startTransition(() => {
      router.push(value === "all" ? "/audit" : `/audit?patientId=${value}`);
    });
  };

  return (
    <section className="mt-8" aria-labelledby="audit-heading">
      <h2 id="audit-heading" className="sr-only">
        Audit events
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="audit-patient">Patient</Label>
        <Select value={selectedPatientId ? String(selectedPatientId) : "all"} onValueChange={select}>
          <SelectTrigger id="audit-patient" className="w-full sm:w-64" aria-label="Filter by patient">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            <SelectItem value="all">All patients</SelectItem>
            {patients.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pending && (
          <span role="status" className="text-xs text-muted-foreground">
            Loading…
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed p-10 text-center">
          <ScrollTextIcon aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 font-medium">{selectedPatientId ? "No events for this patient yet" : "No events yet"}</p>
          <p className="text-sm text-muted-foreground">{selectedPatientId ? "Builds, edits, approvals and sends for them will show up here." : "Sign-ins, builds, approvals and sends are recorded as they happen."}</p>
        </div>
      ) : (
        <div className={cn("mt-4 rounded-xl border bg-card transition-opacity", pending && "opacity-60")} aria-busy={pending}>
          <Table className="text-sm">
            <TableHeader className="hidden sm:table-header-group">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="pl-3">
                  Time
                </TableHead>
                <TableHead scope="col">Who</TableHead>
                <TableHead scope="col">Action</TableHead>
                <TableHead scope="col">Patient</TableHead>
                <TableHead scope="col" className="pr-3">
                  Details
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => {
                const when = new Date(e.at);
                const metaEntries = Object.entries(e.meta).filter(([k]) => !NEVER_RENDER.test(k));
                return (
                  <TableRow key={e.id} className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-3 sm:table-row sm:px-0 sm:py-0">
                    <TableCell data-label="Time" className={cn(cellStack, "sm:pl-3 tabular-nums text-muted-foreground")}>
                      <time dateTime={e.at} suppressHydrationWarning title={when.toISOString()}>
                        {when.toLocaleDateString([], { month: "short", day: "numeric" })} {when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </time>
                    </TableCell>
                    <TableCell data-label="Who" className={cn(cellStack, "font-medium")}>
                      {e.actorName ?? <span className="font-normal text-muted-foreground">system</span>}
                    </TableCell>
                    <TableCell data-label="Action" className={cn(cellStack, "col-span-2")}>
                      {ACTION_LABEL[e.action] ?? <code className="font-mono text-xs">{e.action}</code>}
                    </TableCell>
                    <TableCell data-label="Patient" className={cn(cellStack, !e.patientId && "hidden sm:table-cell")}>
                      {e.patientId ? (
                        <Link href={`/patients/${e.patientId}`} className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                          {names.get(e.patientId) ?? `Patient ${e.patientId}`}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell data-label="Details" className={cn(cellStack, "sm:pr-3 col-span-2", metaEntries.length === 0 && "hidden sm:table-cell")}>
                      {metaEntries.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <ul className="flex flex-wrap gap-1" aria-label="Details">
                          {metaEntries.map(([k, v]) => (
                            <li key={k} className="inline-flex max-w-full items-baseline gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
                              <span className="text-muted-foreground">{META_LABEL[k] ?? k}:</span>
                              <span className="truncate">{metaValue(k, v)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
