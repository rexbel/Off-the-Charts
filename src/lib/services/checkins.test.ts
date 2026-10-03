import { describe, expect, it, vi } from "vitest";
import type { CheckinAnswers, PatientContext } from "@/lib/schemas";

// The pure helpers are tested without a database: the db module is stubbed so
// importing the service never connects to MongoDB.
vi.mock("@/db", () => ({ ready: async () => ({}), noId: {} }));

import { contextFromCheckin, daysUntilExpiry, newCheckinToken } from "./checkins";

const existing: PatientContext = { checkin: "Seeded check-in text", audience: "self_plus_caregiver", language: "en", channel: "portal" };
const answers: CheckinAnswers = { whatMatters: "I want my daughter to hear the plan too.", language: "es", includeWho: "My daughter Rosa", bestTime: "morning" };

describe("contextFromCheckin", () => {
  it("replaces the check-in text and language with the patient's answers, appending who-else and best-time as their words", () => {
    const merged = contextFromCheckin(existing, answers);
    expect(merged.checkin.startsWith(answers.whatMatters)).toBe(true);
    expect(merged.checkin).toContain("Please also include: My daughter Rosa.");
    expect(merged.checkin).toContain("Best time to reach me: morning.");
    expect(merged.language).toBe("es");
  });

  it("keeps the coordinator's audience and channel", () => {
    const merged = contextFromCheckin(existing, answers);
    expect(merged.audience).toBe("self_plus_caregiver");
    expect(merged.channel).toBe("portal");
  });

  it("adds no extra context fields and does not mutate its inputs", () => {
    const before = structuredClone(existing);
    const merged = contextFromCheckin(existing, answers);
    expect(Object.keys(merged).sort()).toEqual(["audience", "channel", "checkin", "language"]);
    expect(existing).toEqual(before);
  });
});

describe("newCheckinToken", () => {
  it("is 32 bytes of base64url, unique per call", () => {
    const a = newCheckinToken();
    const b = newCheckinToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});

describe("daysUntilExpiry", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  it("rounds partial days up and never goes negative", () => {
    expect(daysUntilExpiry("2026-10-17T12:00:00Z", now)).toBe(14);
    expect(daysUntilExpiry("2026-10-04T00:00:00Z", now)).toBe(1);
    expect(daysUntilExpiry("2026-10-01T00:00:00Z", now)).toBe(0);
  });
});
