import { Bubble, ClinicAvatar, INK, Pill, SpotPanel, usePop } from "./comic";
import { CHOICE_LEAD, VIDEO_FONT_FAMILY, type SceneProps } from "./shared";

function Chip({ label, delay }: { label: string; delay: number }) {
  const { scale, opacity } = usePop(delay, 200);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        background: "#FFFFFF",
        border: `4px solid ${INK}`,
        borderRadius: 999,
        padding: "10px 22px",
        fontFamily: VIDEO_FONT_FAMILY,
        fontWeight: 800,
        fontSize: 26,
        color: INK,
        boxShadow: `5px 5px 0 rgba(27,42,47,0.28)`,
        transform: `scale(${0.8 + 0.2 * scale})`,
        opacity,
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden style={{ width: 22, height: 22, borderRadius: 11, border: `3px solid ${INK}`, background: "#CFEEDC", display: "inline-block" }} />
      {label}
    </span>
  );
}

/** A real choice: the clinic offers options as tappable chips over the moment they describe. */
export function ChoiceScene({ scene, language, spot, durationInFrames, index }: SceneProps) {
  const items = (scene.items ?? []).slice(0, 3);
  return (
    <>
      {spot ? <SpotPanel src={spot} durationInFrames={durationInFrames} fadeIn={index > 0} /> : null}
      {scene.title ? (
        <div style={{ position: "absolute", top: 36, left: 40 }}>
          <Pill color="#C6CBF7">{scene.title}</Pill>
        </div>
      ) : null}
      <Bubble x={40} y={112} width={390} delay={8} avatar={<ClinicAvatar size={52} />} fontSize={30}>
        {scene.text || CHOICE_LEAD[language]}
      </Bubble>
      <div style={{ position: "absolute", left: 44, top: 262, width: 400, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
        {items.map((item, i) => (
          <Chip key={i} label={item} delay={28 + i * 14} />
        ))}
      </div>
    </>
  );
}
