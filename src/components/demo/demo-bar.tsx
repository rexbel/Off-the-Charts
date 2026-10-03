"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";
import { useDemo } from "./demo-provider";
import { cn } from "@/lib/utils";

/**
 * Bottom coach-mark for the guided walkthrough. Spotlights the step's
 * data-demo element once it appears in the DOM (pages load async).
 */
export function DemoBar() {
  const demo = useDemo();
  const pathname = usePathname();
  const [resetting, setResetting] = useState(false);
  const step = demo.step;

  useEffect(() => {
    if (!step?.spotlight) return;
    let el: HTMLElement | null = null;
    let tries = 0;
    const timer = setInterval(() => {
      el = document.querySelector<HTMLElement>(`[data-demo="${step.spotlight}"]`);
      tries += 1;
      if (el) {
        el.classList.add("demo-spotlight");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        clearInterval(timer);
      } else if (tries > 60) {
        clearInterval(timer);
      }
    }, 100);
    return () => {
      clearInterval(timer);
      el?.classList.remove("demo-spotlight");
    };
  }, [step, pathname]);

  useEffect(() => {
    if (!demo.active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.key === "ArrowRight" && e.altKey) demo.next();
      if (e.key === "ArrowLeft" && e.altKey) demo.prev();
      if (e.key === "Escape") demo.exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demo]);

  if (!demo.active || !step) return null;
  const isLast = demo.index === demo.total - 1;

  const reset = async () => {
    setResetting(true);
    try {
      const r = await api.resetDemo();
      toast.success(`Demo reset. Cleared ${r.runs} runs and ${r.touchpoints} touchpoints.`);
      demo.goTo(0);
    } catch {
      toast.error("Could not reset. Try again.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div role="region" aria-label="Guided walkthrough" className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-teal/30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:gap-6">
        <div className="flex items-center gap-3 md:w-44 shrink-0">
          <span className="font-heading text-lg leading-none text-teal tabular-nums">
            {demo.index + 1}
            <span className="text-muted-foreground text-sm">/{demo.total}</span>
          </span>
          <div className="flex gap-0.5" aria-hidden>
            {Array.from({ length: demo.total }).map((_, i) => (
              <span key={i} className={cn("h-1 w-2 rounded-full", i <= demo.index ? "bg-teal" : "bg-border")} />
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-teal">{step.title}</p>
          <p className="text-sm leading-snug">{step.narration}</p>
          {(step.why || step.tryIt) && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {step.why}
              {step.tryIt && <span className="ml-1 text-foreground/80">Try it: {step.tryIt}</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="sm" onClick={reset} disabled={resetting} aria-label="Reset demo data">
            <RotateCcwIcon aria-hidden /> Reset
          </Button>
          <Button variant="outline" size="sm" onClick={demo.prev} disabled={demo.index === 0} aria-label="Previous step">
            <ChevronLeftIcon aria-hidden /> Back
          </Button>
          <Button size="sm" onClick={isLast ? demo.exit : demo.next} aria-label={isLast ? "Finish walkthrough" : "Next step"}>
            {isLast ? "Finish" : "Next"} {!isLast && <ChevronRightIcon aria-hidden />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={demo.exit} aria-label="Exit walkthrough">
            <XIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
