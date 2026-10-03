import { PatientsTable } from "@/components/patients/patients-table";
import { patientSummaries } from "@/lib/services/patients";
import { currentNamespace } from "@/lib/namespace";

export const metadata = { title: "Patients" };
export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  const ns = await currentNamespace();
  const patients = await patientSummaries(ns);
  const soon = patients.filter((p) => p.upcomingVisit.daysUntil <= 2).length;
  const needs = patients.filter((p) => !p.latestRun).length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Patients</h1>
          <p className="mt-1 text-base text-muted-foreground">
            {patients.length} upcoming visits, soonest first. {soon} within two days, {needs} without a persona yet.
          </p>
        </div>
      </div>
      <PatientsTable patients={patients} />
    </div>
  );
}
