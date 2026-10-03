import type { Language, UpcomingVisit } from "@/lib/schemas";

/**
 * The upcoming visit is a synthetic seed (daysUntil). We anchor it to the
 * current date so messages always read naturally, and pick a deterministic
 * time slot per patient so repeated builds agree.
 */
export type VisitSlot = {
  date: Date;
  /** "Thursday, October 9" */
  longDate: string;
  /** "Thursday" */
  weekday: string;
  /** "9:30 am" */
  time: string;
  /** "9:30 am" slot is morning when bestTime is morning. */
  isMorning: boolean;
};

export function visitSlot(
  visit: UpcomingVisit,
  patientId: number,
  language: Language,
  preferMorning: boolean,
  now = new Date(),
): VisitSlot {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + visit.daysUntil);
  const morningSlots = ["9:00", "9:30", "10:15", "8:45"];
  const afternoonSlots = ["1:30", "2:15", "3:00", "1:00"];
  const idx = patientId % 4;
  const isMorning = preferMorning || patientId % 3 === 0;
  const hhmm = isMorning ? morningSlots[idx] : afternoonSlots[idx];
  const locale = language === "es" ? "es-ES" : "en-US";
  const longDate = date.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });
  const weekday = date.toLocaleDateString(locale, { weekday: "long" });
  const time =
    language === "es"
      ? isMorning
        ? `${hhmm} de la mañana`
        : `${hhmm} de la tarde`
      : `${hhmm} ${isMorning ? "am" : "pm"}`;
  return { date, longDate, weekday, time, isMorning };
}

export function shortDate(date: Date, language: Language): string {
  return date.toLocaleDateString(language === "es" ? "es-ES" : "en-US", { month: "short", day: "numeric" });
}

export function daysUntilLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}
