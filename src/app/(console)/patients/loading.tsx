import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-2 h-5 w-96" />
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="h-[480px] w-full rounded-xl" />
      <span className="sr-only">Loading patients</span>
    </div>
  );
}
