"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoPlayer } from "@/components/video-player";
import { TouchpointActions, type OnTouchpointAction } from "./touchpoint-actions";
import type { PersonaRun, TiScore, Touchpoint } from "@/lib/schemas";
import { backdropFor, backdropSrc } from "@/remotion/backdrops";
import type { AgeBand } from "@/lib/schemas";

/** Before/after visit videos rendered in the browser from the video scripts. */
export function VideoTab({ run, touchpoints, tpScores, onAction, canApprove = true, ageBand = "adult", initialStage = "before" }: { run: PersonaRun; touchpoints: Touchpoint[]; tpScores: Record<string, TiScore>; onAction: OnTouchpointAction; canApprove?: boolean; ageBand?: AgeBand; initialStage?: "before" | "after" }) {
  const backdrop = backdropSrc(backdropFor(ageBand, run.profile.audience));
  const [stage, setStage] = useState<"before" | "after">(initialStage);
  const script = run.outputs.videoScripts.find((v) => v.stage === stage) ?? run.outputs.videoScripts[0];
  const tp = touchpoints.find((t) => t.kind === (stage === "before" ? "video_before" : "video_after"));
  return (
    <div className="grid gap-4" data-demo="video">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs activationMode="manual" value={stage} onValueChange={(v) => setStage(v === "after" ? "after" : "before")}>
          <TabsList aria-label="Which video">
            <TabsTrigger value="before">Before your visit</TabsTrigger>
            <TabsTrigger value="after">After your visit</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">Rendered in the browser with Remotion. Illustrations follow each scene&apos;s words; the opening scene matches the patient&apos;s age band. Captions burned in.</p>
      </div>
      <Card className="voice-surface gap-4 p-3 sm:p-4">
        <VideoPlayer key={`${run.id}-${stage}`} script={script} preferredName={run.profile.preferredName} language={run.profile.communicationNeeds.language} backdrop={backdrop} />
      </Card>
      <details className="rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Script · {script.scenes.length} scenes</summary>
        <ol className="mt-2 grid gap-2">
          {script.scenes.map((s, i) => (
            <li key={i} className="grid gap-0.5">
              <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {i + 1}. {s.kind}
                {s.title ? ` · ${s.title}` : ""}
              </span>
              <span className="font-voice">{s.voiceover}</span>
              {s.items && <span className="text-xs text-muted-foreground">{s.items.join(" · ")}</span>}
            </li>
          ))}
        </ol>
      </details>
      {tp && <TouchpointActions tp={tp} score={tpScores[tp.id] ?? null} onAction={onAction} editLabel="Edit script text" canApprove={canApprove} />}
    </div>
  );
}
