"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcwIcon, SendIcon, ShieldAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TouchpointStatusBadge } from "@/components/patient/touchpoint-actions";
import { api, ApiRequestError } from "@/lib/client/api";
import { TOUCHPOINT_LABEL, type OutboxDelivery, type Touchpoint } from "@/lib/schemas";

/**
 * Approved touchpoints grouped by patient. "Send" is simulated: it writes a
 * delivery record after re-checking privacy. Clinicians can send; anyone can
 * pull an unsent item back to review.
 */
export function OutboxList({ approved, names, deliveries, canSend }: { approved: Touchpoint[]; names: Record<string, string>; deliveries: Record<string, OutboxDelivery>; canSend: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const byPatient = new Map<number, Touchpoint[]>();
  for (const t of approved) byPatient.set(t.patientId, [...(byPatient.get(t.patientId) ?? []), t]);

  const unapprove = async (id: string) => {
    setBusy(id);
    try {
      await api.touchpoint(id, { action: "reset" });
      toast.success("Pulled back to review.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Could not update.");
    } finally {
      setBusy(null);
    }
  };

  const send = async (ids: string[]) => {
    setBusy(ids[0]);
    try {
      const r = await api.send({ touchpointIds: ids });
      const sent = r.deliveries.filter((d) => d.status === "sent_simulated").length;
      const blocked = r.deliveries.filter((d) => d.status === "blocked");
      if (sent) toast.success(`Sent ${sent} (simulated). Nothing left the building.`);
      for (const b of blocked) toast.error(b.reason ?? "Blocked");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Could not send.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-4 grid gap-4" data-demo="outbox-list">
      {[...byPatient.entries()].map(([pid, tps]) => {
        const unsent = tps.filter((t) => !t.sentAt).map((t) => t.id);
        return (
          <Card key={pid} className="gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-heading text-xl">
                <Link href={`/patients/${pid}`} className="hover:underline underline-offset-4">
                  {names[String(pid)] ?? `Patient ${pid}`}
                </Link>
                <span className="ml-2 font-sans text-xs text-muted-foreground tabular-nums">{tps.length} approved</span>
              </h3>
              {canSend && unsent.length > 0 && (
                <Button size="sm" onClick={() => send(unsent)} disabled={busy !== null}>
                  <SendIcon aria-hidden /> Send {unsent.length} (simulated)
                </Button>
              )}
            </div>
            <ul className="grid gap-2" role="list">
              {tps.map((t) => {
                const d = deliveries[t.id];
                return (
                  <li key={t.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{TOUCHPOINT_LABEL[t.kind]}</span>
                        <span>to {t.recipient}</span>
                        <TouchpointStatusBadge status={t.status} />
                        {t.sentAt && (
                          <Badge className="border-transparent bg-teal-soft text-teal font-normal">
                            Sent (simulated) · {d?.vendorRef ?? ""}
                          </Badge>
                        )}
                        {d?.status === "blocked" && (
                          <Badge className="border-transparent bg-inferred-soft text-inferred font-normal gap-1">
                            <ShieldAlertIcon aria-hidden /> Blocked at send: {d.reason}
                          </Badge>
                        )}
                        {t.decidedAt && <span>{new Date(t.decidedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap font-voice text-sm leading-relaxed line-clamp-4">{t.text}</p>
                    </div>
                    <div className="flex items-start gap-1">
                      {!t.sentAt && (
                        <Button variant="ghost" size="sm" onClick={() => unapprove(t.id)} disabled={busy !== null}>
                          <RotateCcwIcon aria-hidden /> Pull back
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
