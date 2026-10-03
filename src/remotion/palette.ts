/**
 * Colors for the patient-facing visit video.
 *
 * Plain hex strings on purpose: Remotion renders inline styles, so CSS
 * variables from the staff console are not available inside the composition.
 * Every text/background pair below meets WCAG AA (4.5:1) for body text.
 */
export type VideoPalette = {
  /** Full-frame background behind every scene. */
  background: string;
  /** Raised card surface used by card, steps and choice scenes. */
  surface: string;
  /** Card edge; "transparent" when the surface color alone separates the card. */
  surfaceBorder: string;
  /** Primary text. */
  ink: string;
  /** Secondary text (kickers, supporting lines). Still AA on background and surface. */
  inkMuted: string;
  /** Single accent: deep teal. Used for numbers, rules, chips and the closing pill. */
  accent: string;
  /** Text placed on top of the accent. */
  accentInk: string;
  /** Burned-in caption strip. */
  captionBackground: string;
  captionInk: string;
  /** Choice chips. */
  chipBackground: string;
  chipBorder: string;
  chipInk: string;
};

/** Warm off-white, soft sand cards, deep teal accent, near-black ink. */
export const patientPalette: VideoPalette = {
  background: "#FBF7F0",
  surface: "#F2E8D8",
  surfaceBorder: "transparent",
  ink: "#1F2421",
  inkMuted: "#4A5551",
  accent: "#0F5F63",
  accentInk: "#FFFFFF",
  captionBackground: "#1F2421",
  captionInk: "#FBF7F0",
  chipBackground: "#FFFFFF",
  chipBorder: "#0F5F63",
  chipInk: "#0F5F63",
};

/** Black on white with a near-black teal; for low-vision viewers and bright rooms. */
export const highContrastPalette: VideoPalette = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceBorder: "#000000",
  ink: "#000000",
  inkMuted: "#1A1A1A",
  accent: "#003B3F",
  accentInk: "#FFFFFF",
  captionBackground: "#000000",
  captionInk: "#FFFFFF",
  chipBackground: "#FFFFFF",
  chipBorder: "#000000",
  chipInk: "#000000",
};

export const VIDEO_PALETTES = {
  patient: patientPalette,
  highContrast: highContrastPalette,
} as const;

export type VideoPaletteName = keyof typeof VIDEO_PALETTES;
