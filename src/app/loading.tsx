import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-10" aria-busy="true" aria-live="polite">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-3 h-12 w-3/4" />
      <Skeleton className="mt-2 h-6 w-1/2" />
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
