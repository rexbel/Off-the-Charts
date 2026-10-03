import type { VideoPalette } from "../palette";
import {
  bodyStyle,
  cardStyle,
  contentArea,
  headlineStyle,
  useSceneMotion,
  useStaggeredEnter,
  type SceneProps,
} from "./shared";

const FIRST_STEP_DELAY = 14;

/** Numbered steps revealed one at a time, so "what will happen" lands in order. */
export function StepsScene({ scene, palette, durationInFrames, index }: SceneProps) {
  const { style } = useSceneMotion(durationInFrames, { fadeIn: index > 0 });
  const items = scene.items?.length ? scene.items : [scene.text];
  // Spread the reveals across the first two-thirds of the scene, between 0.5 s and 1.2 s apart.
  const stagger = Math.min(36, Math.max(15, Math.floor(((durationInFrames * 2) / 3 - FIRST_STEP_DELAY) / items.length)));
  const compact = items.length > 4;

  return (
    <div style={contentArea}>
      <div style={{ ...style, ...cardStyle(palette), gap: compact ? 14 : 20 }}>
        {scene.title ? <h2 style={headlineStyle(palette, compact ? 40 : 46)}>{scene.title}</h2> : null}
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: compact ? 12 : 18 }}>
          {items.map((item, i) => (
            <StepRow
              key={`${i}-${item}`}
              number={i + 1}
              text={item}
              palette={palette}
              delay={FIRST_STEP_DELAY + i * stagger}
              compact={compact}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

function StepRow({
  number,
  text,
  palette,
  delay,
  compact,
}: {
  number: number;
  text: string;
  palette: VideoPalette;
  delay: number;
  compact: boolean;
}) {
  const { progress, opacity } = useStaggeredEnter(delay);
  const size = compact ? 48 : 56;

  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        opacity,
        transform: `translateX(${(1 - progress) * 24}px)`,
      }}
    >
      <span
        aria-hidden
        style={{
          flex: "none",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.accent,
          color: palette.accentInk,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: compact ? 26 : 30,
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {number}
      </span>
      <p style={bodyStyle(palette, compact ? 30 : 34)}>{text}</p>
    </li>
  );
}
