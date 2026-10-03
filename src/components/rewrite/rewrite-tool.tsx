"use client";

import { useEffect, useState } from "react";
import { ArrowRightIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScorePill, SourceBadge } from "@/components/badges";
import { HighlightedText } from "@/components/patient/highlighted-text";
import { TiFindings } from "@/components/patient/ti-findings";
import { api, ApiRequestError } from "@/lib/client/api";
import type { RewriteRecord, RewriteResponse } from "@/lib/schemas";

type Option = { patientId: number; label: string; sample: string };

export function RewriteTool({ patients }: { patients: Option[] }) {
  const [patientId, setPatientId] = useState(patients.find((p) => p.patientId === 2544)?.patientId ?? patients[0].patientId);
  const [text, setText] = useState(patients.find((p) => p.patientId === patientId)?.sample ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RewriteResponse | null>(null);
  const [history, setHistory] = useState<RewriteRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .rewrites(patientId)
      .then((r) => {
        if (!cancelled) setHistory(r.rewrites);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, result?.recordId]);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      setResult(await api.rewrite({ patientId, text, stage: "before_2d" }));
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Could not rewrite. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 grid gap-6">
      <Card className="gap-4 p-5">
        <div className="grid gap-1.5">
          <Label htmlFor="rw-patient">Who is this for?</Label>
          <Select
            value={String(patientId)}
            onValueChange={(v) => {
              const id = Number(v);
              setPatientId(id);
              const sample = patients.find((p) => p.patientId === id)?.sample;
              if (sample && (!text.trim() || patients.some((p) => p.sample === text))) setText(sample);
              setResult(null);
            }}
          >
            <SelectTrigger id="rw-patient" className="w-full sm:w-[28rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.patientId} value={String(p.patientId)}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rw-text">The message your clinic sends today</Label>
          <Textarea id="rw-text" value={text} onChange={(e) => setText(e.target.value)} rows={5} className="font-mono text-sm" />
          <p className="text-xs text-muted-foreground">Prefilled with the generic template for this patient. Paste anything from your reminder vendor or portal.</p>
        </div>
        <div>
          <Button onClick={submit} disabled={busy || !text.trim()} size="lg">
            {busy ? <Loader2Icon aria-hidden className="animate-spin" /> : <SparklesIcon aria-hidden />} Rewrite for this person
          </Button>
        </div>
      </Card>

      {busy && (
        <Card className="p-5 text-sm text-muted-foreground" aria-live="polite">
          Rewriting with the Persona Profile and Voice Guide…
        </Card>
      )}

      {history && history.length > 0 && !result && (
        <section aria-label="Recent rewrites" className="grid gap-2">
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground font-sans">Recent rewrites for this patient</h2>
          <ul className="grid gap-2" role="list">
            {history.slice(0, 5).map((h) => (
              <li key={h.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{new Date(h.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  <span className="tabular-nums">{h.beforeScore} → {h.afterScore}</span>
                  <SourceBadge source={h.source} />
                  <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setText(h.original)}>
                    Use original again
                  </Button>
                </div>
                <p className="mt-1 line-clamp-2 font-voice">{h.rewritten}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result && (
        <Card className="gap-0 overflow-hidden p-0" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <ScorePill score={result.before.score} blocked={result.before.blocked} size="sm" />
              <ArrowRightIcon aria-hidden className="size-4 text-muted-foreground" />
              <ScorePill score={result.after.score} blocked={result.after.blocked} size="sm" />
            </div>
            <SourceBadge source={result.source} />
          </div>
          <div className="grid md:grid-cols-2">
            <section className="border-b p-4 md:border-b-0 md:border-r">
              <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground font-sans">Before</h3>
              <p className="mt-2 font-mono text-[13px] leading-relaxed text-foreground/85">
                <HighlightedText text={result.original} findings={result.before.findings} />
              </p>
              <div className="mt-3">
                <TiFindings score={result.before} />
              </div>
            </section>
            <section className="voice-surface p-4">
              <h3 className="text-xs font-medium uppercase tracking-[0.12em] font-sans" style={{ color: "var(--voice-muted)" }}>
                After
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed">
                <HighlightedText text={result.rewritten} findings={result.after.findings} />
              </p>
              <div className="mt-3 font-sans">
                <TiFindings score={result.after} />
              </div>
            </section>
          </div>
        </Card>
      )}
    </div>
  );
}
