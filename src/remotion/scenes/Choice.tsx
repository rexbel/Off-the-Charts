import type { VideoPalette } from "../palette";
import {
  bodyStyle,
  CHOICE_LEAD,
  contentArea,
  headlineStyle,
  kickerStyle,
  useSceneMotion,
  useStaggeredEnter,
  type SceneProps,
} from "./shared";

/** Two or three option chips. The whole card reads as "you can…", never "you must". */
export function ChoiceScene({ scene, palette, language, durationInFrames, index }: SceneProps) {
  const { style } = useSceneMotion(durationInFrames, { fadeIn: index > 0 });
  const options = (scene.items ?? []).slice(0, 3);
  const headline = scene.title ?? CHOICE_LEAD[language];
  const showLead = Boolean(scene.title);

  return (
    <div style={{ ...contentArea, alignItems: "stretch" }}>
      <div style={{ ...style, display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {showLead ? <p style={kickerStyle(palette)}>{CHOICE_LEAD[language]}</p> : null}
          <h2 style={headlineStyle(palette, 56)}>{headline}</h2>
          {scene.text && scene.text !== scene.title ? (
            <p style={{ ...bodyStyle(palette, 32), color: palette.inkMuted }}>{scene.text}</p>
          ) : null}
        </div>
        {options.length > 0 ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 20 }}>
            {options.map((option, i) => (
              <Chip key={`${i}-${option}`} text={option} palette={palette} delay={16 + i * 12} />
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function Chip({ text, palette, delay }: { text: string; palette: VideoPalette; delay: number }) {
  const { progress, opacity } = useStaggeredEnter(delay);
  return (
    <li
      style={{
        opacity,
        transform: `scale(${0.92 + progress * 0.08})`,
        backgroundColor: palette.chipBackground,
        color: palette.chipInk,
        border: `3px solid ${palette.chipBorder}`,
        borderRadius: 999,
        padding: "18px 34px",
        fontSize: 30,
        fontWeight: 700,
        lineHeight: 1.25,
        maxWidth: "100%",
      }}
    >
      {text}
    </li>
  );
}
