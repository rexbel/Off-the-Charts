"use client";

import { useEffect, useState } from "react";
import { SquareIcon, Volume2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TiFindings } from "./ti-findings";
import { TouchpointActions, type OnTouchpointAction } from "./touchpoint-actions";
import type { PersonaRun, TiScore, Touchpoint } from "@/lib/schemas";
import { speak, stopSpeaking, useSpeechAvailable } from "@/lib/client/speech";

/** The 30-second read before the clinician walks in. */
export function ClinicianBrief({ run, tp, score, onAction, canApprove = true }: { run: PersonaRun; tp: Touchpoint | undefined; score: TiScore | null; onAction: OnTouchpointAction; canApprove?: boolean }) {
  const [speaking, setSpeaking] = useState(false);
  const canSpeak = useSpeechAvailable();
  useEffect(() => () => stopSpeaking(), []);
  const lines = tp ? tp.text.split("\n").filter(Boolean) : run.outputs.clinicianBrief.lines;
  const words = lines.join(" ").split(/\s+/).length;
  const seconds = Math.round(words / 2.6);

  const toggle = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(lines.join(". "), "en", () => setSpeaking(false));
  };

  return (
    <Card className="gap-4 p-5 sm:p-6" data-demo="brief">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-teal">Clinician brief</p>
          <h2 className="mt-1 text-2xl font-semibold">Before you walk in: {run.profile.preferredName}</h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {words} words · about {seconds} seconds read aloud · staff-facing, clinical register is fine
          </p>
        </div>
        {canSpeak && (
          <Button variant={speaking ? "secondary" : "outline"} onClick={toggle} aria-pressed={speaking} data-demo="read-aloud">
            {speaking ? <SquareIcon aria-hidden /> : <Volume2Icon aria-hidden />} {speaking ? "Stop" : "Read aloud"}
          </Button>
        )}
      </div>
      <ol className="grid gap-2.5 text-base sm:text-lg leading-snug" aria-label="Brief lines">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-1 font-heading text-sm tabular-nums text-teal">{i + 1}</span>
            <span className={line.startsWith("Chart check:") ? "text-warn" : ""}>{line}</span>
          </li>
        ))}
      </ol>
      {score && <TiFindings score={score} label="Language check (staff target)" />}
      {tp && <TouchpointActions tp={tp} score={score} onAction={onAction} canApprove={canApprove} />}
    </Card>
  );
}
