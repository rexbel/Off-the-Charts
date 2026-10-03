import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-20 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal">Not found</p>
      <h1 className="mt-2 text-3xl font-semibold">That page isn&apos;t on the chart.</h1>
      <p className="mt-2 text-muted-foreground">The patient or run you asked for doesn&apos;t exist in this synthetic cohort.</p>
      <Button asChild className="mt-6">
        <Link href="/">Back to patients</Link>
      </Button>
    </div>
  );
}
