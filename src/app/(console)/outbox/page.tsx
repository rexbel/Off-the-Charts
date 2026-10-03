import Link from "next/link";
import { InboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OutboxList } from "@/components/outbox/outbox-list";
import { outbox } from "@/lib/services/outbox";
import { listPatients } from "@/lib/data/cohort";
import { ImpactPanel } from "@/components/outbox/impact-panel";
import { currentNamespace } from "@/lib/namespace";
import { currentUser, canApprove } from "@/lib/auth";
import { deliveriesForTouchpoints } from "@/lib/services/deliveries";

export const metadata = { title: "Outbox" };
export const dynamic = "force-dynamic";

export default async function OutboxPage() {
  const [ns, user] = await Promise.all([currentNamespace(), currentUser()]);
  const { approved, metrics } = await outbox(ns);
  const deliveries = await deliveriesForTouchpoints(approved.map((t) => t.id));
  const names = new Map(listPatients().map((p) => [p.patientId, p.seed.displayName]));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Outbox</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Approved touchpoints, grouped by patient. Sending is simulated: a delivery record is written and privacy is re-checked, nothing leaves the building.
        </p>
      </div>

      <section aria-labelledby="approved-heading">
        <div className="flex items-end justify-between gap-2">
          <h2 id="approved-heading" className="text-2xl font-semibold">
            Approved <span className="font-sans text-base font-normal text-muted-foreground tabular-nums">({approved.length})</span>
          </h2>
        </div>
        {approved.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed p-10 text-center">
            <InboxIcon aria-hidden className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 font-medium">Nothing approved yet</p>
            <p className="text-sm text-muted-foreground">Build a persona, review the messages, and approve the ones you&apos;d send.</p>
            <Button asChild className="mt-4">
              <Link href="/patients">Go to patients</Link>
            </Button>
          </div>
        ) : (
          <OutboxList approved={approved} names={Object.fromEntries(names)} deliveries={Object.fromEntries(deliveries)} canSend={canApprove(user)} />
        )}
      </section>

      <section aria-labelledby="impact-heading" className="space-y-3 border-t pt-6">
        <div>
          <h2 id="impact-heading" className="text-xl font-semibold">
            Before and after
          </h2>
          <p className="text-sm text-muted-foreground">Measured on the latest run per patient by the same deterministic checker, against a synthetic composite of common clinic templates.</p>
        </div>
        <ImpactPanel metrics={metrics} />
      </section>
    </div>
  );
}
