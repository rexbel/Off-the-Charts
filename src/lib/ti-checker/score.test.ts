import { describe, expect, it } from "vitest";
import type { PrivacyRule, TiRule, TiTarget } from "@/lib/schemas";
import { tiScoreSchema } from "@/lib/schemas";
import { RULE_ORDER, TI_WEIGHTS, scoreText } from "./score";

const target: TiTarget = {
  readingLevel: 6,
  sentenceMaxWords: 14,
  language: "en",
  channel: "sms",
  recipient: "patient",
  privacyRules: [],
  avoidTerms: [],
};

const GENERIC =
  "Reminder: You have an appointment with Cardiology in 2 days. Patients who are non-compliant with medications must bring all prescriptions. Reply C to confirm.";

const REWRITE =
  "Hi Emily, your heart check-up is Thursday at 9:30 am with Dr. Chen. It takes about 40 minutes. You can bring your partner. If you want to talk first, text us here or call 555-0100. We'll go over your plan together.";

function finding(result: ReturnType<typeof scoreText>, rule: TiRule) {
  const f = result.findings.find((x) => x.rule === rule);
  if (!f) throw new Error(`missing finding ${rule}`);
  return f;
}

describe("TI_WEIGHTS", () => {
  it("sums to exactly 100 and covers every rule in RULE_ORDER", () => {
    const total = Object.values(TI_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
    expect([...RULE_ORDER].sort()).toEqual(Object.keys(TI_WEIGHTS).sort());
  });
});

describe("scoreText", () => {
  it("scores the generic clinic reminder roughly 30-50 and flags non-compliant (case 1)", () => {
    const result = scoreText(GENERIC, target);
    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.score).toBeLessThanOrEqual(50);
    expect(result.blocked).toBe(false);

    const stigma = finding(result, "stigma");
    expect(stigma.passed).toBe(false);
    expect(stigma.matches.map((m) => m.term)).toEqual(["non-compliant"]);
    expect(stigma.points).toBe(TI_WEIGHTS.stigma - 8);
    expect(stigma.message).toContain("'non-compliant'");
    expect(stigma.message).toContain("has not been able to");

    expect(finding(result, "choice").passed).toBe(false);
    expect(finding(result, "safety").passed).toBe(false);
    expect(finding(result, "collaboration").passed).toBe(false);
    expect(finding(result, "reading_level").passed).toBe(false);
  });

  it("scores the trauma-informed rewrite 85 or higher and passes the four principles (case 2)", () => {
    const result = scoreText(REWRITE, target);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.blocked).toBe(false);
    for (const rule of ["choice", "predictability", "safety", "collaboration"] as const) {
      expect(finding(result, rule).passed, rule).toBe(true);
    }
    expect(finding(result, "stigma").passed).toBe(true);
    expect(finding(result, "reading_level").passed).toBe(true);
    expect(finding(result, "sentence_length").passed).toBe(true);
    expect(finding(result, "choice").message).toMatch(/you can|if you want/i);
    expect(finding(result, "choice").matches.some((m) => /you can/i.test(m.term))).toBe(true);
    expect(finding(result, "safety").matches.some((m) => m.term.includes("555-0100"))).toBe(true);
    expect(finding(result, "collaboration").message).toMatch(/together/i);
  });

  it("the rewrite beats the generic by a wide margin under the same rules", () => {
    expect(scoreText(REWRITE, target).score - scoreText(GENERIC, target).score).toBeGreaterThanOrEqual(35);
  });

  it("returns a finding for every rule in stable order with a plain message", () => {
    const result = scoreText(GENERIC, target);
    expect(result.findings.map((f) => f.rule)).toEqual([...RULE_ORDER]);
    for (const f of result.findings) {
      expect(f.pointsAvailable).toBe(TI_WEIGHTS[f.rule]);
      expect(f.points).toBeGreaterThanOrEqual(0);
      expect(f.points).toBeLessThanOrEqual(f.pointsAvailable);
      expect(f.message.length).toBeGreaterThan(10);
    }
    expect(finding(result, "reading_level").message).toMatch(/^Grade \d+(\.\d)? reading level; target is 6/);
    expect(tiScoreSchema.safeParse(result).success).toBe(true);
  });

  it("is deterministic", () => {
    expect(scoreText(GENERIC, target)).toEqual(scoreText(GENERIC, target));
    expect(scoreText(REWRITE, target)).toEqual(scoreText(REWRITE, target));
  });
});

describe("privacy (case 3)", () => {
  const hivRule: PrivacyRule = {
    id: "pr-1",
    rule: "Do not name HIV in text messages.",
    restrictedTerms: ["HIV"],
    channels: ["sms"],
    recipients: [],
    kind: "fact",
    source: { factIds: ["f1"] },
  };
  const text = "Hi Sam, your HIV clinic visit is Tuesday at 10:00 am. You can call 555-0100 with questions.";

  it("blocks a restricted term on a restricted channel", () => {
    const result = scoreText(text, { ...target, privacyRules: [hivRule] });
    expect(result.blocked).toBe(true);
    const privacy = finding(result, "privacy");
    expect(privacy.passed).toBe(false);
    expect(privacy.severity).toBe("block");
    expect(privacy.points).toBe(0);
    expect(privacy.matches).toHaveLength(1);
    expect(privacy.matches[0]).toMatchObject({ term: "HIV", index: text.indexOf("HIV"), length: 3 });
    expect(privacy.message).toContain("'HIV'");
    expect(privacy.message).toContain(hivRule.rule);
  });

  it("does not block the same text on a channel the rule does not cover", () => {
    const result = scoreText(text, { ...target, channel: "portal", privacyRules: [hivRule] });
    expect(result.blocked).toBe(false);
    const privacy = finding(result, "privacy");
    expect(privacy.passed).toBe(true);
    expect(privacy.severity).toBe("info");
    expect(privacy.points).toBe(TI_WEIGHTS.privacy);
  });

  it("respects recipient scoping", () => {
    const guardianOnly: PrivacyRule = { ...hivRule, id: "pr-2", recipients: ["guardian"] };
    expect(scoreText(text, { ...target, recipient: "patient", privacyRules: [guardianOnly] }).blocked).toBe(false);
    expect(scoreText(text, { ...target, recipient: "guardian", privacyRules: [guardianOnly] }).blocked).toBe(true);
  });
});

describe("stigma and avoid terms", () => {
  it("costs 8 points per match with a floor of 0 and reports index/length (case 4)", () => {
    const text = "Denies pain. Refuses labs. Non-compliant addict with uncontrolled sugars.";
    const result = scoreText(text, target);
    const stigma = finding(result, "stigma");
    expect(stigma.matches.map((m) => m.term)).toEqual([
      "Denies",
      "Refuses",
      "Non-compliant",
      "addict",
      "uncontrolled",
    ]);
    expect(stigma.points).toBe(0);
    for (const m of stigma.matches) {
      expect(text.slice(m.index, m.index + m.length)).toBe(m.term);
    }
  });

  it("counts profile avoid-terms alongside the lexicon", () => {
    const result = scoreText("Hi Jake, your rehab visit is Monday. You can text us.", {
      ...target,
      avoidTerms: ["rehab"],
    });
    const stigma = finding(result, "stigma");
    expect(stigma.passed).toBe(false);
    expect(stigma.matches).toHaveLength(1);
    expect(stigma.matches[0]).toMatchObject({ term: "rehab", index: 14, length: 5 });
    expect(stigma.points).toBe(TI_WEIGHTS.stigma - 8);
  });
});

describe("reading level partial credit", () => {
  const longWordy =
    "Notwithstanding your previous appointments, the interdisciplinary cardiology department requires comprehensive documentation of all prescribed medications before evaluation.";

  it("gives zero for far-off text and full for simple text", () => {
    const hard = scoreText(longWordy, target);
    expect(finding(hard, "reading_level").points).toBe(0);
    expect(finding(hard, "sentence_length").passed).toBe(false);
    expect(hard.longestSentenceWords).toBeGreaterThan(14);

    const easy = scoreText("Your visit is Monday at 2 pm. It takes about an hour.", target);
    expect(finding(easy, "reading_level").points).toBe(TI_WEIGHTS.reading_level);
  });

  it("gives half credit when within two grades of the target", () => {
    const g = scoreText(GENERIC, target).readingGrade;
    const result = scoreText(GENERIC, { ...target, readingLevel: Math.max(0, g - 1.5) });
    expect(finding(result, "reading_level").points).toBe(TI_WEIGHTS.reading_level / 2);
  });
});

describe("Spanish (case 5)", () => {
  const es: TiTarget = { ...target, language: "es" };
  it("recognises Spanish choice, safety, predictability and collaboration phrases", () => {
    const text =
      "Hola María, su cita es el jueves a las 9:30 de la mañana con la Dra. Chen. Dura unos 40 minutos. Puede traer a su pareja. Si quiere hablar antes, escríbanos aquí o llame al 555-0100. Juntos revisaremos su plan.";
    const result = scoreText(text, es);
    expect(result.readingGrade).toBeGreaterThanOrEqual(2);
    expect(result.readingGrade).toBeLessThanOrEqual(14);
    expect(finding(result, "choice").passed).toBe(true);
    expect(finding(result, "choice").message).toMatch(/puede|si quiere/i);
    expect(finding(result, "safety").passed).toBe(true);
    expect(finding(result, "safety").message).toMatch(/escríbanos|llame|555-0100|si quiere hablar/i);
    expect(finding(result, "safety").matches.some((m) => /escríbanos|llame/i.test(m.term))).toBe(true);
    expect(finding(result, "predictability").passed).toBe(true);
    expect(finding(result, "collaboration").passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it("flags Spanish stigma terms and fails a template with none of the principles", () => {
    const result = scoreText("El paciente debe traer sus medicamentos. Niega consumo de alcohol.", es);
    const stigma = finding(result, "stigma");
    expect(stigma.matches.map((m) => m.term.toLowerCase())).toEqual(["el paciente debe", "niega"]);
    expect(finding(result, "choice").passed).toBe(false);
    expect(finding(result, "safety").passed).toBe(false);
  });
});

describe("SMS formatting (case 6)", () => {
  it("keeps the grade plausible with bullets, a time and a phone number", () => {
    const text = [
      "Hi Walter,",
      "Your visit is Monday at 2:00 pm with Dr. Patel.",
      "• Bring your pill list",
      "• Bring your glasses",
      "• Linda can come with you",
      "Questions? Call 555-0100 any time.",
    ].join("\n");
    const result = scoreText(text, target);
    expect(result.readingGrade).toBeLessThan(14);
    expect(result.readingGrade).toBeLessThanOrEqual(6.5);
    expect(result.longestSentenceWords).toBeLessThanOrEqual(10);
    expect(finding(result, "reading_level").passed).toBe(true);
    expect(finding(result, "safety").passed).toBe(true);
  });
});

describe("predictability needs both a time and what happens", () => {
  it("fails on a time without an explanation and vice versa", () => {
    const timeOnly = scoreText("See you Thursday at 9:30 am.", target);
    expect(finding(timeOnly, "predictability").passed).toBe(false);
    expect(finding(timeOnly, "predictability").message).toMatch(/not what to expect/);

    const eventOnly = scoreText("We'll go over your plan and answer your questions.", target);
    expect(finding(eventOnly, "predictability").passed).toBe(false);
    expect(finding(eventOnly, "predictability").message).toMatch(/not when/);

    const both = scoreText("Your visit is Thursday at 9:30 am. It takes about an hour.", target);
    expect(finding(both, "predictability").passed).toBe(true);
  });
});

describe("edge input", () => {
  it("handles empty text without throwing and never passes reading rules on nothing", () => {
    const result = scoreText("", target);
    expect(result.readingGrade).toBe(0);
    expect(result.longestSentenceWords).toBe(0);
    expect(result.blocked).toBe(false);
    expect(finding(result, "reading_level").points).toBe(0);
    expect(finding(result, "sentence_length").points).toBe(0);
    expect(result.findings).toHaveLength(RULE_ORDER.length);
    expect(tiScoreSchema.safeParse(result).success).toBe(true);
  });

  it("tolerates a malformed target by falling back to documented defaults", () => {
    const result = scoreText(REWRITE, {
      readingLevel: Number.NaN,
      sentenceMaxWords: Number.NaN,
      language: "fr" as unknown as "en",
      channel: "fax" as unknown as "sms",
      recipient: "",
      privacyRules: undefined as unknown as PrivacyRule[],
      avoidTerms: undefined as unknown as string[],
    });
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(finding(result, "reading_level").message).toContain("target is 6");
    expect(finding(result, "sentence_length").message).toContain("limit is 14");
  });
});
