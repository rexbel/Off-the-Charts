import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 sm:py-10" aria-busy="true" aria-live="polite">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-3 h-10 w-full max-w-md" />
      <Skeleton className="mt-3 h-5 w-full max-w-lg" />
      <div className="mt-8 flex items-center gap-2">
        <Skeleton className="h-8 w-56 rounded-lg" />
      </div>
      <div className="mt-4 rounded-xl border bg-card">
        <Skeleton className="h-10 rounded-b-none rounded-t-xl" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[7rem_8rem_1fr] gap-4 border-t px-3 py-3 sm:grid-cols-[8rem_9rem_12rem_9rem_1fr]">
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4 hidden sm:block" />
            <Skeleton className="h-4 hidden sm:block" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading the audit log</span>
    </div>
  );
}
