"use client";

import { useEffect } from "react";
import { PlayIcon, Volume2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScorePill } from "@/components/badges";
import { HighlightedText } from "@/components/patient/highlighted-text";
import type { TiScore } from "@/lib/schemas";
import { useDemo } from "./demo-provider";
import { speak, useSpeechAvailable } from "@/lib/client/speech";

export function DemoIntro({ genericText, genericScore, steps }: { genericText: string; genericScore: TiScore; steps: { id: string; title: string }[] }) {
  const demo = useDemo();
  const canSpeak = useSpeechAvailable();

  // Landing on /demo while a walkthrough is active means step 0; otherwise show the launcher.
  useEffect(() => {
    if (demo.active && demo.index !== 0) demo.goTo(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10 pb-40">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal">Guided walkthrough · about four minutes</p>
      <h1 className="mt-2 text-4xl sm:text-5xl font-semibold leading-[1.05] text-balance">What a patient hears from us today.</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Below is the reminder a clinic sends now, scored by the same rules we apply to everything else. The walkthrough then follows three patients: Emily (ideal), Walter (complex) and Jake (edge).
      </p>

      <Card className="mt-8 gap-4 p-6" data-demo="generic-reminder">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-muted-foreground font-sans">Today&apos;s automated reminder, as sent to anyone</h2>
          <ScorePill score={genericScore.score} blocked={genericScore.blocked} />
        </div>
        <p className="font-mono text-base sm:text-lg leading-relaxed">
          <HighlightedText text={genericText} findings={genericScore.findings} />
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Reading grade {genericScore.readingGrade.toFixed(1)}.</span>
          <span>{genericScore.findings.filter((f) => !f.passed).length} rules failed.</span>
          {canSpeak && (
            <Button variant="outline" size="sm" onClick={() => speak(genericText, "en")} className="ml-auto">
              <Volume2Icon aria-hidden /> Read it aloud
            </Button>
          )}
        </div>
      </Card>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-start">
        <Button size="lg" onClick={demo.active ? demo.next : () => void demo.start()} data-demo="demo-start">
          <PlayIcon aria-hidden /> {demo.active ? "Continue" : "Start the walkthrough"}
        </Button>
        <ol className="grid flex-1 grid-cols-1 gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
          {steps.map((s, i) => (
            <li key={s.id} className="flex gap-2">
              <span className="w-5 shrink-0 tabular-nums text-teal">{i + 1}.</span>
              <button type="button" className="text-left hover:text-foreground underline-offset-4 hover:underline" onClick={() => demo.goTo(i)}>
                {s.title}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        The walkthrough replays precomputed model output where a cache exists and the rules-based fallback otherwise; each stage is labeled. Live builds call the model. Use Alt+→ and Alt+← to step, Esc to exit.
      </p>
    </div>
  );
}
