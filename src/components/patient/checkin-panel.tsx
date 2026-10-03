"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2Icon, ClockIcon, CopyIcon, LinkIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClaimKindBadge } from "@/components/badges";
import { api, ApiRequestError } from "@/lib/client/api";
import type { BestTime, PatientCheckin, PatientContext } from "@/lib/schemas";

/**
 * Coordinator side of the patient check-in. Creates the token link, shows the
 * latest status, and while a link is outstanding polls (bounded) so a
 * submission made in another window lands in the check-in textarea without a
 * reload. The merge mirrors contextFromCheckin in the service.
 */
const POLL_MS = 10_000;
const MAX_POLLS = 90; // 15 minutes, then the manual "Check for answers" button takes over.

const BEST_TIME_LABEL: Record<BestTime, string> = { morning: "Morning", afternoon: "Afternoon", no_preference: "No preference" };

function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 3600 * 1000)));
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function CheckinPanel({ patientId, context, onChange }: { patientId: number; context: PatientContext; onChange: (c: PatientContext) => void }) {
  const [checkins, setCheckins] = useState<PatientCheckin[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const contextRef = useRef(context);
  const seenSubmitted = useRef<Set<string> | null>(null);
  const polls = useRef(0);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  const latest = checkins?.[0] ?? null;

  /** Applies a fresh list. A submission not seen before is merged into the context exactly once. */
  const applyList = useCallback(
    (list: PatientCheckin[], silent: boolean) => {
      if (seenSubmitted.current === null) {
        // First load: what is already submitted was merged server-side before this page rendered.
        seenSubmitted.current = new Set(list.filter((c) => c.status === "submitted").map((c) => c.id));
      }
      const seen = seenSubmitted.current;
      setCheckins(list);
      setLoadError(null);
      const fresh = list.find((c) => c.status === "submitted" && c.answers && !seen.has(c.id));
      if (fresh?.answers) {
        seen.add(fresh.id);
        onChange({ ...contextRef.current, checkin: fresh.answers.whatMatters, language: fresh.answers.language });
        toast.success("Patient submitted their check-in. The check-in text now uses their words.");
      } else if (!silent) {
        toast.message("No new answers yet.");
      }
    },
    [onChange],
  );

  const applyError = useCallback((err: unknown, silent: boolean) => {
    const message = err instanceof ApiRequestError ? err.message : "Could not load check-in links.";
    setLoadError(message);
    if (!silent) toast.error(message);
  }, []);

  const load = useCallback(
    (silent: boolean) =>
      api
        .checkins(patientId)
        .then((res) => applyList(res.checkins, silent))
        .catch((err: unknown) => applyError(err, silent)),
    [patientId, applyList, applyError],
  );

  // Initial load; ignore the result if the patient changed underneath us.
  useEffect(() => {
    let cancelled = false;
    api
      .checkins(patientId)
      .then((res) => {
        if (!cancelled) applyList(res.checkins, true);
      })
      .catch((err: unknown) => {
        if (!cancelled) applyError(err, true);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, applyList, applyError]);

  // Poll while the newest link is outstanding so a submission shows up without a reload.
  const latestId = latest?.id ?? null;
  const latestSent = latest?.status === "sent";
  useEffect(() => {
    if (!latestId || !latestSent) return;
    polls.current = 0;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (polls.current++ >= MAX_POLLS) return window.clearInterval(id);
      void load(true);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [latestId, latestSent, load]);

  const create = async () => {
    setCreating(true);
    try {
      const res = await api.createCheckin(patientId);
      setCheckins((prev) => [res.checkin, ...(prev ?? [])]);
      toast.success("Check-in link created. Copy it and send it to the patient.");
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Could not create a link.");
    } finally {
      setCreating(false);
    }
  };

  const check = async () => {
    setChecking(true);
    await load(false);
    setChecking(false);
  };

  const url = latest ? `${typeof window !== "undefined" ? window.location.origin : ""}/checkin/${latest.token}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy on this device. Select the link and copy it.");
    }
  };

  return (
    <section aria-label="Patient check-in link" className="mt-2 grid gap-3 rounded-lg border border-dashed p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Check-in link</span>
          {checkins === null && !loadError && <Loader2Icon aria-hidden className="size-3.5 animate-spin text-muted-foreground" />}
          {latest && <StatusBadge checkin={latest} />}
        </div>
        <div className="flex items-center gap-1.5">
          {latest?.status === "sent" && (
            <Button type="button" variant="ghost" size="sm" onClick={check} disabled={checking}>
              {checking ? <Loader2Icon aria-hidden className="animate-spin" /> : <RefreshCwIcon aria-hidden />} Check for answers
            </Button>
          )}
          <Button type="button" variant={latest ? "outline" : "default"} size="sm" onClick={create} disabled={creating || (checkins === null && !loadError)}>
            {creating ? <Loader2Icon aria-hidden className="animate-spin" /> : <LinkIcon aria-hidden />} {latest ? "Create new link" : "Create check-in link"}
          </Button>
        </div>
      </div>

      {loadError && (
        <p role="alert" className="text-xs text-bad">
          {loadError}{" "}
          <button type="button" className="underline underline-offset-2" onClick={() => void load(false)}>
            Retry
          </button>
        </p>
      )}

      {checkins !== null && !latest && !loadError && (
        <p className="text-xs text-muted-foreground">No link yet. The patient or caregiver fills a short form without signing in; their answers land here as patient-stated input.</p>
      )}

      {latest && latest.status === "sent" && (
        <div className="flex items-center gap-1.5">
          <Input readOnly value={url} aria-label="Check-in link" onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs md:text-xs" />
          <Button type="button" variant="outline" size="sm" onClick={copy} aria-label="Copy check-in link">
            <CopyIcon aria-hidden /> Copy
          </Button>
        </div>
      )}

      {latest && latest.status === "expired" && <p className="text-xs text-muted-foreground">The last link expired on {fmtDate(latest.expiresAt)}. Create a new one to send again.</p>}

      {latest && latest.status === "submitted" && latest.answers && (
        <dl className="grid gap-2 rounded-md bg-stated-soft/50 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <ClaimKindBadge kind="patient_stated" />
            <span className="text-xs text-muted-foreground">Submitted {latest.submittedAt ? fmtDate(latest.submittedAt) : ""}</span>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">What matters</dt>
            <dd className="font-voice whitespace-pre-wrap">{latest.answers.whatMatters}</dd>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Language</dt>
              <dd>{latest.answers.language === "es" ? "Spanish" : "English"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Who else</dt>
              <dd>{latest.answers.includeWho || "Just me"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Best time</dt>
              <dd>{BEST_TIME_LABEL[latest.answers.bestTime]}</dd>
            </div>
          </div>
        </dl>
      )}
    </section>
  );
}

function StatusBadge({ checkin }: { checkin: PatientCheckin }) {
  if (checkin.status === "submitted") {
    return (
      <Badge className="gap-1 border-transparent bg-ok-soft font-normal text-ok">
        <CheckCircle2Icon aria-hidden /> Patient submitted · {checkin.submittedAt ? fmtDate(checkin.submittedAt) : ""}
      </Badge>
    );
  }
  if (checkin.status === "expired") {
    return (
      <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
        <ClockIcon aria-hidden /> Expired
      </Badge>
    );
  }
  const n = daysLeft(checkin.expiresAt);
  return (
    <Badge variant="outline" className="gap-1 font-normal text-stated border-stated/40">
      <LinkIcon aria-hidden /> Link sent · expires in {n} day{n === 1 ? "" : "s"}
    </Badge>
  );
}
