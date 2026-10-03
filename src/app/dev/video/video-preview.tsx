"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video-player";
import { videoFixtures } from "@/remotion/fixtures";
import { VIDEO_PALETTES, type VideoPaletteName } from "@/remotion";

const PALETTE_LABEL: Record<VideoPaletteName, string> = {
  patient: "Patient palette",
  highContrast: "High contrast",
};

export function VideoPreview() {
  const [fixtureId, setFixtureId] = useState(videoFixtures[0].id);
  const [paletteName, setPaletteName] = useState<VideoPaletteName>("patient");
  const [lastScene, setLastScene] = useState<string | null>(null);

  const fixture = videoFixtures.find((f) => f.id === fixtureId) ?? videoFixtures[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Sample script" className="flex flex-wrap gap-2">
          {videoFixtures.map((f) => (
            <Button
              key={f.id}
              type="button"
              size="sm"
              variant={f.id === fixture.id ? "default" : "outline"}
              aria-pressed={f.id === fixture.id}
              onClick={() => {
                setFixtureId(f.id);
                setLastScene(null);
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div role="group" aria-label="Palette" className="flex flex-wrap gap-2">
          {(Object.keys(VIDEO_PALETTES) as VideoPaletteName[]).map((name) => (
            <Button
              key={name}
              type="button"
              size="sm"
              variant={name === paletteName ? "secondary" : "ghost"}
              aria-pressed={name === paletteName}
              onClick={() => setPaletteName(name)}
            >
              {PALETTE_LABEL[name]}
            </Button>
          ))}
        </div>
      </div>

      <VideoPlayer
        key={`${fixture.id}-${paletteName}`}
        script={fixture.script}
        preferredName={fixture.preferredName}
        language={fixture.language}
        palette={VIDEO_PALETTES[paletteName]}
        onSceneChange={(index, scene) => setLastScene(`${index + 1} · ${scene.kind}`)}
      />

      <p className="text-xs text-muted-foreground" data-testid="scene-readout">
        {lastScene ? `onSceneChange: ${lastScene}` : "onSceneChange: not fired yet"}
      </p>
    </div>
  );
}
