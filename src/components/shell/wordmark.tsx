import Link from "next/link";
import { cn } from "@/lib/utils";

export function Wordmark({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <Link href="/patients" className={cn("group inline-flex items-baseline gap-1.5 whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-sm", className)} aria-label="Off the Chart home">
      <span aria-hidden className={cn("inline-block rounded-full bg-teal", size === "lg" ? "size-3 translate-y-[-2px]" : "size-2 translate-y-[-1px]")} />
      <span className={cn("font-heading font-semibold tracking-tight text-foreground", size === "lg" ? "text-3xl" : "text-lg")}>
        Off the <em className="not-italic text-teal">Chart</em>
      </span>
    </Link>
  );
}
