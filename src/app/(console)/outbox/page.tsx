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
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 sm:py-10 pb-32">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal">Outbox · simulated sending</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-semibold">What&apos;s approved, and what changed</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Nothing here is actually sent. Approved touchpoints queue in the outbox exactly as a reminder vendor or portal would receive them. The numbers are measured on stored runs by the same deterministic checker.
      </p>

      <section className="mt-8" aria-labelledby="impact-heading">
        <h2 id="impact-heading" className="sr-only">
          Impact
        </h2>
        <ImpactPanel metrics={metrics} />
      </section>

      <section className="mt-8" aria-labelledby="approved-heading">
        <div className="flex items-end justify-between gap-2">
          <h2 id="approved-heading" className="text-2xl font-semibold">
            Approved touchpoints <span className="font-sans text-base font-normal text-muted-foreground tabular-nums">({approved.length})</span>
          </h2>
        </div>
        {approved.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed p-10 text-center">
            <InboxIcon aria-hidden className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 font-medium">Nothing approved yet</p>
            <p className="text-sm text-muted-foreground">Build a persona, review the messages, and approve the ones you&apos;d send.</p>
            <Button asChild className="mt-4">
              <Link href="/patients/1672">Start with Emily</Link>
            </Button>
          </div>
        ) : (
          <OutboxList approved={approved} names={Object.fromEntries(names)} deliveries={Object.fromEntries(deliveries)} canSend={canApprove(user)} />
        )}
      </section>
    </div>
  );
}
