import { AbsoluteFill, Sequence } from "remotion";
import type { Language, Scene, VideoScript } from "@/lib/schemas";
import type { VideoPalette } from "./palette";
import { sceneDurationsInFrames, sceneStartFrames, VIDEO_FPS } from "./durations";
import { Caption } from "./scenes/Caption";
import { CardScene } from "./scenes/Card";
import { ChoiceScene } from "./scenes/Choice";
import { ClosingScene } from "./scenes/Closing";
import { StepsScene } from "./scenes/Steps";
import { TitleScene } from "./scenes/Title";
import { FRAME_MARGIN, VIDEO_FONT_FAMILY, type SceneProps } from "./scenes/shared";

export type VisitVideoProps = {
  script: VideoScript;
  palette: VideoPalette;
  preferredName: string;
  language: Language;
};

const SCENE_COMPONENT: Record<Scene["kind"], (props: SceneProps) => React.JSX.Element> = {
  title: TitleScene,
  card: CardScene,
  steps: StepsScene,
  choice: ChoiceScene,
  closing: ClosingScene,
};

/**
 * The patient-facing visit video: one Sequence per scene, each with its own
 * burned-in caption. 1280x720 at 30 fps; durations come from `durations.ts`.
 */
export function VisitVideo({ script, palette, preferredName, language }: VisitVideoProps) {
  const durations = sceneDurationsInFrames(script, VIDEO_FPS);
  const starts = sceneStartFrames(script, VIDEO_FPS);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.background,
        color: palette.ink,
        fontFamily: VIDEO_FONT_FAMILY,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {script.scenes.map((scene, index) => {
        const start = starts[index];
        const durationInFrames = durations[index];
        const SceneComponent = SCENE_COMPONENT[scene.kind] ?? CardScene;

        return (
          <Sequence
            key={`${index}-${scene.kind}`}
            from={start}
            durationInFrames={durationInFrames}
            name={`${index + 1}. ${scene.kind}`}
          >
            <SceneComponent
              scene={scene}
              script={script}
              palette={palette}
              preferredName={preferredName}
              language={language}
              durationInFrames={durationInFrames}
              index={index}
            />
            <SceneDots count={script.scenes.length} current={index} palette={palette} />
            <Caption
              text={scene.voiceover}
              palette={palette}
              durationInFrames={durationInFrames}
              fadeIn={index > 0}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

/** Small progress dots so the viewer always knows how many cards remain. */
function SceneDots({ count, current, palette }: { count: number; current: number; palette: VideoPalette }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 40,
        right: FRAME_MARGIN,
        display: "flex",
        gap: 10,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={{
            width: i === current ? 28 : 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: palette.accent,
            opacity: i <= current ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}
