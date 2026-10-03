import { QueueList } from "@/components/queue/queue-list";
import { approvalQueue } from "@/lib/services/queue";
import { currentNamespace } from "@/lib/namespace";
import { canApprove, currentUser } from "@/lib/auth";

export const metadata = { title: "Queue" };
export const dynamic = "force-dynamic";

/** Every pending touchpoint across patients, grouped by patient, ready for a decision. */
export default async function QueuePage() {
  const [ns, user] = await Promise.all([currentNamespace(), currentUser()]);
  const items = await approvalQueue(ns);
  const patients = new Set(items.map((i) => i.touchpoint.patientId)).size;
  const blocked = items.filter((i) => i.blocked).length;
  const approver = canApprove(user);
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 sm:py-10 pb-24">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal">Approval queue · human review</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-balance">
        Waiting for a decision{" "}
        <span className="font-sans text-base font-normal text-muted-foreground tabular-nums whitespace-nowrap">
          {items.length === 0 ? "(nothing waiting)" : `(${items.length} across ${patients} ${patients === 1 ? "patient" : "patients"}${blocked ? `, ${blocked} blocked` : ""})`}
        </span>
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        {approver
          ? "Approve what you would send, edit what needs a lighter touch, reject the rest. Approved items go to the simulated outbox. A privacy block has to be edited away before approval."
          : "Prepare and edit here. Approval needs a clinician; anything you edit is re-scored and stays in the queue for them."}
      </p>
      <QueueList items={items} canApprove={approver} />
    </div>
  );
}
