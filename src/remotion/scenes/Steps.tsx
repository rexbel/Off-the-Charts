import { Img, interpolate, useCurrentFrame } from "remotion";
import { DiagramGround, INK, Pill, usePop } from "./comic";
import { VIDEO_FONT_FAMILY, type SceneProps } from "./shared";

const W = 1280;
const TOP = 132;
const IMG_H = 168;
const YELLOW = "#FFD84D";

/**
 * Motion-graphics flow: each step is a card with its own picture and a short
 * label, arriving left to right, joined by an arrow that draws itself.
 */
export function StepsScene({ scene, itemSpots = [] }: SceneProps) {
  const frame = useCurrentFrame();
  const items = (scene.items ?? []).slice(0, 4);
  const n = Math.max(1, items.length);
  const cardW = n <= 2 ? 360 : n === 3 ? 300 : 246;
  const gap = n <= 3 ? 76 : 58;
  const total = n * cardW + (n - 1) * gap;
  const startX = (W - total) / 2;
  const perItem = 26;

  return (
    <>
      <DiagramGround />
      {scene.title ? (
        <div style={{ position: "absolute", top: 36, left: 56 }}>
          <Pill>{scene.title}</Pill>
        </div>
      ) : null}

      {/* Arrows between cards, drawn after the card on their left has landed. */}
      <svg width={W} height={720} style={{ position: "absolute", inset: 0 }} aria-hidden>
        {items.slice(0, -1).map((_, i) => {
          const x1 = startX + (i + 1) * cardW + i * gap + 6;
          const x2 = x1 + gap - 12;
          const y = TOP + IMG_H / 2;
          const d = `M ${x1} ${y} C ${x1 + gap * 0.35} ${y - 46}, ${x2 - gap * 0.35} ${y - 46}, ${x2} ${y - 4}`;
          const len = gap * 1.6;
          const begin = 8 + i * perItem + 14;
          const p = interpolate(frame, [begin, begin + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
              <path d={d} fill="none" stroke={YELLOW} strokeWidth={7} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
              <polygon points={`${x2 - 2},${y - 18} ${x2 + 14},${y - 2} ${x2 - 8},${y + 6}`} fill={YELLOW} stroke={INK} strokeWidth={4} strokeLinejoin="round" opacity={p >= 1 ? 1 : 0} />
            </g>
          );
        })}
      </svg>

      {items.map((item, i) => (
        <StepCard key={i} index={i} x={startX + i * (cardW + gap)} width={cardW} delay={8 + i * perItem} label={item} src={itemSpots[i]} />
      ))}
    </>
  );
}

function StepCard({ index, x, width, delay, label, src }: { index: number; x: number; width: number; delay: number; label: string; src?: string }) {
  const { scale, opacity } = usePop(delay, 150);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: TOP,
        width,
        opacity,
        transform: `translateY(${(1 - scale) * 48}px) rotate(${(1 - scale) * (index % 2 ? 3 : -3)}deg)`,
        background: "#FFFFFF",
        border: `4px solid ${INK}`,
        borderRadius: 22,
        boxShadow: "9px 9px 0 rgba(27,42,47,0.32)",
      }}
    >
      <div style={{ height: IMG_H, borderBottom: `4px solid ${INK}`, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: "hidden", background: "#CFEEDC" }}>
        {src ? <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      </div>
      <div style={{ padding: "14px 18px 18px", fontFamily: VIDEO_FONT_FAMILY, fontWeight: 800, fontSize: width < 260 ? 23 : 26, lineHeight: 1.22, color: INK }}>{label}</div>
      <span
        style={{
          position: "absolute",
          top: -20,
          left: -18,
          width: 52,
          height: 52,
          borderRadius: 26,
          background: YELLOW,
          border: `4px solid ${INK}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: VIDEO_FONT_FAMILY,
          fontWeight: 900,
          fontSize: 26,
          color: INK,
          boxShadow: "4px 4px 0 rgba(27,42,47,0.3)",
        }}
      >
        {index + 1}
      </span>
    </div>
  );
}
