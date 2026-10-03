import { RewriteTool } from "@/components/rewrite/rewrite-tool";
import { listPatients } from "@/lib/data/cohort";
import { genericBaseline } from "@/lib/pipeline/generic-baseline";

export const metadata = { title: "Rewrite a message" };
export const dynamic = "force-dynamic";

export default function RewritePage() {
  const patients = listPatients().map((p) => ({ patientId: p.patientId, label: `${p.seed.displayName} · ${p.ehr.age} · ${p.seed.personaArchetype}`, sample: genericBaseline(p).messages[1].text }));
  return (
    <div className="space-y-6">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal">Middleware · paste your clinic&apos;s message</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-semibold">Rewrite any message for one person</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        This is what Off the Chart does in front of an existing reminder vendor: the vendor&apos;s text goes in, the person&apos;s version comes out, and both are scored by the same rules. Uses the patient&apos;s latest Persona Profile, or the rules-based profile if none has been built.
      </p>
      <RewriteTool patients={patients} />
    </div>
  );
}
