import { AuditTable } from "@/components/audit/audit-table";
import { recentAudit } from "@/lib/services/audit";
import { listPatients, parsePatientId } from "@/lib/data/cohort";

export const metadata = { title: "Audit" };
export const dynamic = "force-dynamic";

/** Who did what, when. Ids and counts only; message, note and check-in text are never stored or shown. */
export default async function AuditPage(props: PageProps<"/audit">) {
  const sp = await props.searchParams;
  const raw = typeof sp.patientId === "string" ? sp.patientId : undefined;
  const patientId = raw ? (parsePatientId(raw) ?? undefined) : undefined;
  const patients = listPatients()
    .map((p) => ({ id: p.patientId, name: p.seed.displayName }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const events = await recentAudit({ patientId, limit: 200 });
  const selected = patientId ? patients.find((p) => p.id === patientId) : undefined;
  return (
    <div className="space-y-6">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal">Audit · every decision on record</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-balance">
        Who did what, and when{" "}
        <span className="font-sans text-base font-normal text-muted-foreground tabular-nums whitespace-nowrap">
          ({events.length}
          {events.length === 200 ? " most recent" : ""}
          {selected ? ` for ${selected.name}` : ""})
        </span>
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Ids and counts only. No message or note text is ever stored here.</p>
      <AuditTable events={events} patients={patients} selectedPatientId={patientId ?? null} />
    </div>
  );
}
