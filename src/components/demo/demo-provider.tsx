"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import { DEMO_STEPS, type DemoStep } from "./steps";

type DemoState = { active: boolean; index: number };

type DemoContextValue = {
  enabled: boolean;
  active: boolean;
  index: number;
  step: DemoStep | null;
  total: number;
  start: () => Promise<void>;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  exit: () => Promise<void>;
  reset: () => Promise<void>;
};

const DemoContext = createContext<DemoContextValue | null>(null);
const KEY = "otc-demo";
const INACTIVE: DemoState = { active: false, index: 0 };

/**
 * Tiny external store backed by sessionStorage, so the walkthrough survives
 * navigation and reloads within a tab without a hydration mismatch (the
 * server snapshot is always "inactive"). Starting the demo also switches the
 * server-side namespace cookie so demo data stays isolated.
 */
let current: DemoState | null = null;
const listeners = new Set<() => void>();

function readStorage(): DemoState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return INACTIVE;
    const parsed = JSON.parse(raw) as Partial<DemoState>;
    return { active: Boolean(parsed.active), index: Math.min(Math.max(0, Number(parsed.index) | 0), DEMO_STEPS.length - 1) };
  } catch {
    return INACTIVE;
  }
}

function getSnapshot(): DemoState {
  if (current === null) current = readStorage();
  return current;
}

function getServerSnapshot(): DemoState {
  return INACTIVE;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(next: DemoState): void {
  current = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the walkthrough still works for this page */
  }
  listeners.forEach((l) => l());
}

export function DemoProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const router = useRouter();
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const goTo = useCallback(
    (index: number) => {
      const i = Math.min(Math.max(0, index), DEMO_STEPS.length - 1);
      setState({ active: true, index: i });
      router.push(DEMO_STEPS[i].route);
    },
    [router],
  );

  const start = useCallback(async () => {
    try {
      await api.demoStart();
    } catch {
      toast.error("Could not switch to the demo workspace.");
      return;
    }
    goTo(0);
    router.refresh();
  }, [goTo, router]);

  const exit = useCallback(async () => {
    setState(INACTIVE);
    try {
      await api.demoExit();
    } catch {
      /* cookie may already be gone */
    }
    router.refresh();
  }, [router]);

  const reset = useCallback(async () => {
    const r = await api.resetDemo();
    toast.success(`Demo reset. Cleared ${r.runs} runs and ${r.touchpoints} touchpoints.`);
    goTo(0);
    router.refresh();
  }, [goTo, router]);

  const value = useMemo<DemoContextValue>(
    () => ({
      enabled,
      active: enabled && state.active,
      index: state.index,
      step: enabled && state.active ? DEMO_STEPS[state.index] : null,
      total: DEMO_STEPS.length,
      start,
      next: () => goTo(state.index + 1),
      prev: () => goTo(state.index - 1),
      goTo,
      exit,
      reset,
    }),
    [enabled, state, goTo, start, exit, reset],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside DemoProvider");
  return ctx;
}
