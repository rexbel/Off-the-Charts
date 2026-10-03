"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlertIcon } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] route error", error.digest ?? error.message);
  }, [error]);
  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-16">
      <Alert variant="destructive">
        <TriangleAlertIcon aria-hidden />
        <AlertTitle>Something went wrong loading this page</AlertTitle>
        <AlertDescription>
          Nothing was sent to a patient. You can try again, or go back to the patient list.
        </AlertDescription>
      </Alert>
      <div className="mt-4 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to patients</Link>
        </Button>
      </div>
    </div>
  );
}
