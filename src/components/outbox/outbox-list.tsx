"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TouchpointStatusBadge } from "@/components/patient/touchpoint-actions";
import { api } from "@/lib/client/api";
import { TOUCHPOINT_LABEL, type Touchpoint } from "@/lib/schemas";

export function OutboxList({ approved, names }: { approved: Touchpoint[]; names: Record<string, string> }) {
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
    } catch {
      toast.error("Could not update.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-4 grid gap-4">
      {[...byPatient.entries()].map(([pid, tps]) => (
        <Card key={pid} className="gap-3 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-heading text-xl">
              <Link href={`/patients/${pid}`} className="hover:underline underline-offset-4">
                {names[String(pid)] ?? `Patient ${pid}`}
              </Link>
            </h3>
            <span className="text-xs text-muted-foreground tabular-nums">{tps.length} approved</span>
          </div>
          <ul className="grid gap-2" role="list">
            {tps.map((t) => (
              <li key={t.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{TOUCHPOINT_LABEL[t.kind]}</span>
                    <span>to {t.recipient}</span>
                    <TouchpointStatusBadge status={t.status} />
                    {t.decidedAt && <span>{new Date(t.decidedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap font-voice text-sm leading-relaxed line-clamp-4">{t.text}</p>
                </div>
                <div className="flex items-start">
                  <Button variant="ghost" size="sm" onClick={() => unapprove(t.id)} disabled={busy === t.id}>
                    <RotateCcwIcon aria-hidden /> Pull back
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
