import type { Metadata } from "next";
import { VideoPreview } from "./video-preview";

export const metadata: Metadata = {
  title: "Visit video preview · Off the Chart",
  robots: { index: false },
};

/** Dev-only preview of the patient visit video. No auth, synthetic people only. */
export default function VideoPreviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dev preview</p>
        <h1 className="text-2xl font-semibold tracking-tight">Visit video</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Animated, captioned cards rendered in the browser from a video script. Switch between the two sample
          scripts, try the high-contrast palette, and use the scene strip to jump around.
        </p>
      </header>
      <VideoPreview />
    </main>
  );
}
