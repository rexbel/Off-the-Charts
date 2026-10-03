"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon, ChevronLeftIcon, TriangleAlertIcon, HistoryIcon, CheckCircle2Icon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudienceBadge, DementiaBadge, DemoRoleBadge, LanguageBadge, SourceBadge } from "@/components/badges";
import { api, streamBuild, ApiRequestError, type PatientBundle } from "@/lib/client/api";
import type { BuildMode, PatientContext, PersonaRun, TiScore, Touchpoint, TouchpointAction, User } from "@/lib/schemas";
import { ContextPanel } from "./context-panel";
import { PipelineSteps, idleStages, type StagesState } from "./pipeline-steps";
import { PersonaCard } from "./persona-card";
import { EvidenceSheet } from "./evidence-sheet";
import { MessageCompare } from "./message-compare";
import { ClinicianBrief } from "./clinician-brief";
import { VisitSummaryView } from "./visit-summary";
import { VideoTab } from "./video-tab";
import { RunCompare } from "./run-compare";
import { daysUntilLabel } from "@/lib/visit";

type BuildStatus = "idle" | "running" | "done" | "error";

function stagesFromRun(r: PersonaRun): StagesState {
  const s = idleStages();
  for (const st of r.stages) {
    s[st.stage] = {
      status: "done",
      source: st.source,
      durationMs: st.durationMs,
      warning: st.warning,
      data: st.stage === "extract" ? r.facts : st.stage === "profile" ? r.profile : st.stage === "voice" ? r.voiceGuide : st.stage === "render" ? r.outputs : r.scores,
    };
  }
  return s;
}

/** The claim ?evidence=1 opens: the first inferred one, else the first in the patient's own words. */
function firstEvidenceId(r: PersonaRun): string | null {
  const claims = [...r.profile.emotionalContext, ...r.profile.cognitiveSupport, ...r.profile.privacyRules];
  return (claims.find((c) => c.kind === "inferred") ?? claims.find((c) => c.kind === "patient_stated"))?.id ?? null;
}
const TABS = ["messages", "brief", "summary", "video", "compare"] as const;
type Tab = (typeof TABS)[number];

export function PatientWorkspace({ bundle, user, initialTab, autoBuild, openEvidence }: { bundle: PatientBundle; user: User | null; initialTab?: string; autoBuild?: BuildMode; openEvidence?: boolean }) {
  const canApprove = user?.role === "clinician" || user?.role === "admin";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { patient } = bundle;

  const [context, setContext] = useState<PatientContext>(bundle.context);
  const [contextEdited, setContextEdited] = useState(bundle.contextEdited);
  const [run, setRun] = useState<PersonaRun | null>(bundle.latest?.run ?? null);
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>(bundle.latest?.touchpoints ?? []);
  const [tpScores, setTpScores] = useState<Record<string, TiScore>>({});
  const [runs, setRuns] = useState(bundle.runs);
  const [status, setStatus] = useState<BuildStatus>("idle");
  const [stages, setStages] = useState<StagesState>(() => (bundle.latest ? stagesFromRun(bundle.latest.run) : idleStages()));
  const [buildError, setBuildError] = useState<string | null>(null);
  // The active tab lives in the URL (?tab=) so walkthrough steps and back/forward both work.
  const urlTab = searchParams.get("tab") ?? initialTab;
  const tab: Tab = TABS.includes(urlTab as Tab) ? (urlTab as Tab) : "messages";
  const videoStage = searchParams.get("stage") === "after" ? "after" : "before";
  // Evidence sheet: user choice wins; otherwise ?evidence=1 opens the first inferred (else patient-stated) claim of the current run once.
  const [evidenceChoice, setEvidenceChoice] = useState<{ id: string | null } | null>(null);
  const evidenceId = evidenceChoice ? evidenceChoice.id : openEvidence && run ? firstEvidenceId(run) : null;
  const setEvidenceId = (id: string | null) => setEvidenceChoice({ id });
  const [confirming, setConfirming] = useState(false);
  const [contextOpen, setContextOpen] = useState(!bundle.latest);
  const abortRef = useRef<AbortController | null>(null);
  const autoBuildFired = useRef(false);

  const build = useCallback(
    async (mode: BuildMode) => {
      if (status === "running") return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("running");
      setBuildError(null);
      setStages(idleStages());
      setContextOpen(false);
      try {
        await streamBuild(
          patient.patientId,
          { mode, context },
          (event) => {
            if (event.type === "stage") {
              setStages((prev) => ({
                ...prev,
                [event.stage]: event.status === "start" ? { status: "running" } : { status: "done", source: event.source, durationMs: event.durationMs, warning: event.warning, data: event.data },
              }));
              // In cached (walkthrough) mode the stage row already labels the source; no toast per stage.
              if (event.status === "done" && event.warning && mode !== "cached") toast.warning(event.warning, { duration: 6000 });
            } else if (event.type === "complete") {
              setRun(event.run);
              setTouchpoints(event.touchpoints);
              setTpScores({});
              setRuns((prev) => [{ id: event.run.id, createdAt: event.run.createdAt, source: event.run.source, approvedAt: null }, ...prev]);
              if (bundle.namespace === "live" && JSON.stringify(context) !== JSON.stringify(bundle.context)) setContextEdited(true);
              setStatus("done");
              setEvidenceChoice(null);
              toast.success(`Persona built for ${event.run.profile.preferredName}. ${event.touchpoints.length} touchpoints ready to review.`);
            } else if (event.type === "error") {
              setBuildError(event.message);
              setStatus("error");
            }
          },
          controller.signal,
        );
        setStatus((s) => (s === "running" ? "done" : s));
      } catch (err) {
        if (controller.signal.aborted) {
          // Cancelled: go back to the last saved run (or the empty state) so a new build can start.
          setStatus("idle");
          setStages(run ? stagesFromRun(run) : idleStages());
          return;
        }
        setBuildError(err instanceof ApiRequestError ? err.message : "The build could not reach the server. Nothing was sent.");
        setStatus("error");
      }
    },
    [patient.patientId, context, status, bundle.namespace, bundle.context, run],
  );

  // Demo: ?build=cached triggers one build on arrival, then strips the param.
  // - Started a tick later, so a mount that is torn down at once (dev Strict Mode) never sends
  //   a build that the unmount cleanup below would abort.
  // - The native history API updates the URL without a navigation: router.replace could swap
  //   in a preserved copy of this page at that URL and hide this one, aborting the build.
  useEffect(() => {
    if (!autoBuild || autoBuildFired.current) return;
    const timer = window.setTimeout(() => {
      autoBuildFired.current = true;
      const params = new URLSearchParams(searchParams.toString());
      params.delete("build");
      window.history.replaceState(null, "", `${pathname}${params.size ? `?${params}` : ""}`);
      void build(autoBuild);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBuild]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const selectTab = (t: string) => {
    const next = TABS.includes(t as Tab) ? (t as Tab) : "messages";
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  const onAction = useCallback(
    async (tpId: string, action: TouchpointAction) => {
      try {
        const res = await api.touchpoint(tpId, action);
        setTouchpoints((prev) => prev.map((t) => (t.id === tpId ? res.touchpoint : t)));
        setTpScores((prev) => ({ ...prev, [tpId]: res.score }));
        const verb = { approve: "Approved", reject: "Rejected", edit: "Edited and re-scored", reset: "Reset" }[action.action];
        toast.success(`${verb}. ${action.action === "approve" ? "Sending is simulated; it's in the outbox." : ""}`.trim());
      } catch (err) {
        if (err instanceof ApiRequestError && (err.status === 409 || err.status === 403)) {
          toast.error(err.message);
        } else {
          toast.error(err instanceof Error ? err.message : "That didn't save. Try again.");
        }
      }
    },
    [],
  );

  const onConfirm = useCallback(
    async (claimId: string) => {
      if (!run) return;
      setConfirming(true);
      try {
        const res = await api.confirmClaim(run.id, claimId);
        setRun({ ...run, confirmedClaimIds: res.confirmedClaimIds });
        toast.success("Claim confirmed.");
      } catch {
        toast.error("Could not confirm. Try again.");
      } finally {
        setConfirming(false);
      }
    },
    [run],
  );

  const loadRun = async (runId: string) => {
    try {
      const r = await api.run(runId);
      setRun(r.run);
      setTouchpoints(r.touchpoints);
      setTpScores({});
      setStages(stagesFromRun(r.run));
      setStatus("idle");
    } catch {
      toast.error("Could not load that run.");
    }
  };

  const saveContext = async (c: PatientContext) => {
    setContext(c);
  };
  const resetContext = async () => {
    try {
      const r = await api.resetContext(patient.patientId);
      setContext(r.context);
      setContextEdited(false);
      toast.success("Check-in reset to the seeded version.");
    } catch {
      toast.error("Could not reset.");
    }
  };

  const approvedCount = useMemo(() => touchpoints.filter((t) => t.status === "approved" || t.status === "edited").length, [touchpoints]);
  const briefTp = touchpoints.find((t) => t.kind === "brief");
  const summaryTp = touchpoints.find((t) => t.kind === "summary");
  const briefScore = briefTp ? (tpScores[briefTp.id] ?? run?.scores.brief ?? null) : (run?.scores.brief ?? null);
  const summaryScore = summaryTp ? (tpScores[summaryTp.id] ?? run?.scores.summary.persona ?? null) : (run?.scores.summary.persona ?? null);
  const building = status === "running";

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/patients" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon aria-hidden className="size-4" /> Patients
        </Link>
      </nav>
      <header className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
            {patient.seed.displayName}
            <span className="ml-3 font-sans text-base font-normal text-muted-foreground">
              {patient.ehr.age} · {patient.ehr.sex === "F" ? "Female" : patient.ehr.sex === "M" ? "Male" : patient.ehr.sex}
            </span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            {patient.seed.upcomingVisit.department} visit {daysUntilLabel(patient.seed.upcomingVisit.daysUntil)}: {patient.seed.upcomingVisit.reason.toLowerCase()}.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <AudienceBadge audience={context.audience} />
            {patient.seed.dementia && <DementiaBadge />}
            <LanguageBadge language={context.language} />
            {bundle.namespace === "demo" && <DemoRoleBadge role={patient.seed.demoRole} />}
          </div>
        </div>
        {run && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
              <CheckCircle2Icon aria-hidden className="size-4 text-ok" /> {approvedCount}/{touchpoints.length} approved
            </span>
            <SourceBadge source={run.source} />
            {runs.length > 1 && (
              <Select value={run.id} onValueChange={loadRun}>
                <SelectTrigger size="sm" aria-label="Run history" className="w-52">
                  <HistoryIcon aria-hidden />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {new Date(r.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {r.source}
                      {r.approvedAt ? " · approved" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </header>

      <section className="mt-6" aria-label="Patient context">
        {run || building ? (
          <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="h-auto w-full justify-between whitespace-normal py-2 text-left" aria-expanded={contextOpen}>
                <span>
                  Context: EHR snapshot and check-in{contextEdited ? " (edited)" : ""} · {contextOpen ? "hide" : "edit and rebuild"}
                </span>
                <ChevronDownIcon aria-hidden className={contextOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <ContextPanel patient={patient} context={context} edited={contextEdited} onChange={saveContext} onReset={resetContext} onBuild={build} building={building} hasRun={run !== null} cachedAvailable={bundle.cachedAvailable} modelAvailable={bundle.modelAvailable} checkinExtraQuestions={bundle.checkinExtraQuestions} />
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <ContextPanel patient={patient} context={context} edited={contextEdited} onChange={saveContext} onReset={resetContext} onBuild={build} building={false} hasRun={false} cachedAvailable={bundle.cachedAvailable} modelAvailable={bundle.modelAvailable} checkinExtraQuestions={bundle.checkinExtraQuestions} />
        )}
      </section>

      {(building || status === "error") && (
        <section className="mt-6" aria-live="polite" aria-label="Build progress">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{building ? "Building the Persona" : "Build stopped"}</h2>
            {building && (
              <Button variant="ghost" size="sm" onClick={() => abortRef.current?.abort()} aria-label="Cancel this build">
                Cancel
              </Button>
            )}
          </div>
          <PipelineSteps stages={stages} />
          {status === "error" && buildError && (
            <Alert variant="destructive" className="mt-3">
              <TriangleAlertIcon aria-hidden />
              <AlertTitle>The build didn&apos;t finish</AlertTitle>
              <AlertDescription>
                {buildError}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => build("live")}>
                    Try again
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => build("cached")}>
                    Use cached or rules-based output
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </section>
      )}

      {run && !building && (
        <>
          <section className="mt-6">
            <PersonaCard run={run} stages={stages} onOpenClaim={setEvidenceId} />
          </section>
          <section className="mt-6">
            <Tabs activationMode="manual" value={tab} onValueChange={selectTab}>
              <TabsList aria-label="Touchpoints" className="flex-wrap h-auto">
                <TabsTrigger value="messages">Messages</TabsTrigger>
                <TabsTrigger value="brief">Clinician brief</TabsTrigger>
                <TabsTrigger value="summary">Visit summary</TabsTrigger>
                <TabsTrigger value="video">Video</TabsTrigger>
                {runs.length > 1 && <TabsTrigger value="compare">Compare runs</TabsTrigger>}
              </TabsList>
              <TabsContent value="messages" className="mt-4">
                <MessageCompare run={run} touchpoints={touchpoints} tpScores={tpScores} onAction={onAction} onOpenClaim={setEvidenceId} canApprove={canApprove} />
              </TabsContent>
              <TabsContent value="brief" className="mt-4">
                <ClinicianBrief run={run} tp={briefTp} score={briefScore} onAction={onAction} canApprove={canApprove} />
              </TabsContent>
              <TabsContent value="summary" className="mt-4">
                <VisitSummaryView run={run} tp={summaryTp} score={summaryScore} onAction={onAction} onOpenClaim={setEvidenceId} canApprove={canApprove} />
              </TabsContent>
              <TabsContent value="video" className="mt-4">
                <VideoTab key={videoStage} initialStage={videoStage} run={run} touchpoints={touchpoints} tpScores={tpScores} onAction={onAction} canApprove={canApprove} ageBand={patient.seed.ageBand} />
              </TabsContent>
              <TabsContent value="compare" className="mt-4">
                <RunCompare current={run} runs={runs} />
              </TabsContent>
            </Tabs>
          </section>
          <EvidenceSheet run={run} itemId={evidenceId} onOpenChange={(o) => !o && setEvidenceChoice({ id: null })} onConfirm={onConfirm} confirming={confirming} />
        </>
      )}

      {!run && !building && status !== "error" && (
        <p className="mt-6 text-sm text-muted-foreground">No persona yet for {patient.seed.preferredName}. Review the check-in and audience, then build.</p>
      )}
    </div>
  );
}
