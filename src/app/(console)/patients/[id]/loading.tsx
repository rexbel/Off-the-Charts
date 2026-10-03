import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8" aria-busy="true" aria-live="polite">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-10 w-80" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Skeleton className="h-[480px] rounded-xl" />
        <Skeleton className="h-[480px] rounded-xl" />
      </div>
      <span className="sr-only">Loading patient</span>
    </div>
  );
}
