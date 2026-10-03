"use client";

import { useSyncExternalStore } from "react";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

let tick = 0;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  setInterval(() => {
    tick = Date.now();
    listeners.forEach((l) => l());
  }, 60_000);
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** Current time once mounted (0 on the server) so relative labels do not mismatch on hydration. */
function useNow(): number {
  return useSyncExternalStore(subscribe, () => tick || Date.now(), () => 0);
}

export function relativeTime(iso: string, now: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (!now) return dateFmt.format(d);
  const min = Math.round((now - d.getTime()) / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} d ago`;
  return dateFmt.format(d);
}

export function RelativeTime({ iso }: { iso: string }) {
  const now = useNow();
  return (
    <time dateTime={iso} title={dateTimeFmt.format(new Date(iso))} suppressHydrationWarning>
      {relativeTime(iso, now)}
    </time>
  );
}
