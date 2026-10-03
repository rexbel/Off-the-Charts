import { describe, expect, it } from "vitest";
import {
  countSyllables,
  longestSentenceWords,
  readingGrade,
  splitSentences,
  syllablesEn,
  syllablesEs,
} from "./readability";

describe("splitSentences", () => {
  it("does not split on honorifics, a.m./p.m., times or phone numbers", () => {
    const text =
      "Hi Emily, your heart check-up is Thursday at 9:30 a.m. with Dr. Chen. It takes about 40 minutes. Call 555-0100 with questions.";
    const sentences = splitSentences(text);
    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toContain("Dr. Chen");
    expect(sentences[0]).toContain("9:30 a.m.");
  });

  it("treats a.m. followed by a capitalised word as a sentence end", () => {
    expect(splitSentences("Arrive at 9:30 a.m. Please bring your card.")).toHaveLength(2);
  });

  it("treats lines, bullets and numbered steps as sentence boundaries", () => {
    const text = [
      "Hi Walter,",
      "Your visit is Monday at 2:00 pm.",
      "• Bring your pill list",
      "• Bring your glasses",
      "1. Check in at the front desk",
      "2) Linda can come with you",
      "Questions? Call 555-0100.",
    ].join("\n");
    const sentences = splitSentences(text);
    expect(sentences).toEqual([
      "Hi Walter,",
      "Your visit is Monday at 2:00 pm.",
      "Bring your pill list",
      "Bring your glasses",
      "Check in at the front desk",
      "Linda can come with you",
      "Questions?",
      "Call 555-0100.",
    ]);
  });

  it("keeps decimals together and ignores empty input", () => {
    expect(splitSentences("Take 2.5 mg each morning. Then rest.")).toHaveLength(2);
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   \n ")).toEqual([]);
  });

  it("handles Spanish punctuation and honorifics", () => {
    const sentences = splitSentences("¿Tiene preguntas? Llame a la Dra. Chen al 555-0100. ¡Gracias!");
    expect(sentences).toHaveLength(3);
    expect(sentences[1]).toContain("Dra. Chen");
  });
});

describe("longestSentenceWords", () => {
  it("counts words in the longest sentence and ignores bullet glyphs", () => {
    expect(longestSentenceWords("Hi there.\n• Bring your pill list and your glasses")).toBe(7);
    expect(longestSentenceWords("")).toBe(0);
  });
});

describe("syllables", () => {
  it("counts common English words", () => {
    const cases: Array<[string, number]> = [
      ["the", 1],
      ["have", 1],
      ["here", 1],
      ["takes", 1],
      ["minutes", 2],
      ["Emily", 3],
      ["Thursday", 2],
      ["together", 3],
      ["appointment", 3],
      ["medications", 4],
      ["cardiology", 5],
      ["non-compliant", 4],
      ["needed", 2],
      ["called", 1],
      ["little", 2],
      ["9:30", 1],
      ["555-0100", 1],
      ["We'll", 1],
    ];
    for (const [word, n] of cases) expect(syllablesEn(word), word).toBe(n);
  });

  it("counts common Spanish words with diphthongs and hiatus", () => {
    const cases: Array<[string, number]> = [
      ["María", 3],
      ["mañana", 3],
      ["jueves", 2],
      ["quiere", 2],
      ["aquí", 2],
      ["escríbanos", 4],
      ["puede", 2],
      ["traer", 2],
      ["revisaremos", 5],
      ["y", 1],
      ["guía", 2],
      ["9:30", 1],
    ];
    for (const [word, n] of cases) expect(syllablesEs(word), word).toBe(n);
    expect(countSyllables("María", "es")).toBe(3);
    expect(countSyllables("Emily", "en")).toBe(3);
  });
});

describe("readingGrade", () => {
  it("returns 0 for empty text and clamps to 0..18", () => {
    expect(readingGrade("", "en")).toBe(0);
    const dense =
      "Notwithstanding aforementioned pharmacotherapeutic considerations, interdisciplinary coordination necessitates comprehensive multidimensional reassessment of cardiovascular comorbidities and psychosocial determinants influencing adherence trajectories across longitudinal encounters.";
    const g = readingGrade(dense, "en");
    expect(g).toBeLessThanOrEqual(18);
    expect(g).toBeGreaterThan(14);
  });

  it("scores a simple trauma-informed SMS at or below grade 6", () => {
    const text =
      "Hi Emily, your heart check-up is Thursday at 9:30 am with Dr. Chen. It takes about 40 minutes. You can bring your partner. If you want to talk first, text us here or call 555-0100. We'll go over your plan together.";
    const g = readingGrade(text, "en");
    expect(g).toBeGreaterThan(0);
    expect(g).toBeLessThanOrEqual(6);
  });

  it("scores clinical template text clearly higher than the SMS rewrite", () => {
    const generic =
      "Reminder: You have an appointment with Cardiology in 2 days. Patients who are non-compliant with medications must bring all prescriptions. Reply C to confirm.";
    const rewrite = "Hi Emily, your heart visit is Thursday at 9:30 am. It takes about 40 minutes.";
    expect(readingGrade(generic, "en")).toBeGreaterThan(readingGrade(rewrite, "en"));
    expect(readingGrade(generic, "en")).toBeGreaterThan(6.5);
  });

  it("keeps an SMS with bullets, a time and a phone number plausible (case 6)", () => {
    const text = [
      "Hi Walter,",
      "Your visit is Monday at 2:00 pm with Dr. Patel.",
      "• Bring your pill list",
      "• Bring your glasses",
      "• Linda can come with you",
      "Questions? Call 555-0100 any time.",
    ].join("\n");
    const g = readingGrade(text, "en");
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThan(7);
    expect(g).toBeLessThan(14);
  });

  it("gives Spanish text a sane grade (case 5)", () => {
    const simple =
      "Hola María, su cita es el jueves a las 9:30 de la mañana con la Dra. Chen. Dura unos 40 minutos. Puede traer a su pareja. Si quiere hablar antes, escríbanos aquí o llame al 555-0100. Juntos revisaremos su plan.";
    const g = readingGrade(simple, "es");
    expect(g).toBeGreaterThanOrEqual(2);
    expect(g).toBeLessThanOrEqual(14);
    expect(g).toBeLessThanOrEqual(7);

    const clinical =
      "Recordatorio: el paciente debe presentarse con toda la documentación farmacológica correspondiente para la evaluación cardiológica interdisciplinaria programada, considerando las comorbilidades previamente identificadas.";
    const gc = readingGrade(clinical, "es");
    expect(gc).toBeGreaterThan(g);
    expect(gc).toBeLessThanOrEqual(18);
  });
});
