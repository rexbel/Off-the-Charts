import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 sm:py-10" aria-busy="true" aria-live="polite">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-3 h-10 w-full max-w-md" />
      <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="ml-auto h-6 w-28" />
      </div>
      <div className="mt-5 grid gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <div className="mt-3 grid gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-24 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading the approval queue</span>
    </div>
  );
}
