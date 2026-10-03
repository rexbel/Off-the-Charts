import { describe, expect, it } from "vitest";
import { STIGMA_LEXICON, avoidTermMatches, stigmaMatches } from "./lexicon";

function terms(text: string, lang: "en" | "es" = "en") {
  return stigmaMatches(text, lang).map((m) => m.term.toLowerCase());
}

describe("stigmaMatches (English)", () => {
  it("reports exact index and length for highlighting (case 4)", () => {
    const text = "Patients who are non-compliant with medications must bring all prescriptions.";
    const matches = stigmaMatches(text, "en");
    expect(matches).toHaveLength(1);
    const m = matches[0];
    expect(m.term).toBe("non-compliant");
    expect(m.index).toBe(text.indexOf("non-compliant"));
    expect(m.length).toBe("non-compliant".length);
    expect(text.slice(m.index, m.index + m.length)).toBe("non-compliant");
    expect(m.suggestion).toBe("has not been able to");
  });

  it("matches case and inflection variants (case 4)", () => {
    expect(terms("Denies chest pain. Refuses labs. She refused the flu shot.")).toEqual([
      "denies",
      "refuses",
      "refused",
    ]);
    expect(terms("Noncompliant with meds; history of noncompliance.")).toEqual([
      "noncompliant",
      "noncompliance",
    ]);
    expect(terms("Two addicts and one alcoholic relapsed.")).toEqual(["addicts", "alcoholic", "relapsed"]);
  });

  it("covers the required lexicon with the required suggestions", () => {
    const expectations: Array<[string, string, string]> = [
      ["He denies alcohol use.", "denies", "says they do not have"],
      ["Patient refused the vaccine.", "refused", "chose not to"],
      ["History of substance abuse.", "substance abuse", "substance use"],
      ["Known drug abuse.", "drug abuse", "substance use"],
      ["Patient is a known abuser.", "abuser", "person with a substance use disorder"],
      ["Appears drug-seeking.", "drug-seeking", "remove; describe the request and the plan instead"],
      ["Recovering addict.", "addict", "person in recovery"],
      ["She suffers from asthma.", "suffers from", "has"],
      ["Demented and lives alone.", "demented", "living with dementia"],
      ["Failed treatment with metformin.", "failed treatment", "treatment did not work"],
      ["Patient is obese.", "obese", "weight"],
      ["Poorly controlled diabetes.", "poorly controlled", "above goal"],
      ["Uncontrolled hypertension.", "uncontrolled", "above goal"],
      ["Urine was dirty last month.", "urine was dirty", "negative / positive (or \"has not returned to use\")"],
      ["Clean urine today.", "clean urine", "negative / positive (or \"has not returned to use\")"],
      ["She had a relapse.", "relapse", "return to use"],
      ["A frequent flyer in the ED.", "frequent flyer", "remove; describe the visit pattern plainly"],
      ["Likely malingering.", "malingering", "remove; describe what was observed"],
      ["A difficult patient.", "difficult patient", "remove; name the specific concern"],
      ["She was hysterical.", "hysterical", "upset"],
      ["He is manipulative.", "manipulative", "remove; describe the request plainly"],
      ["Longtime alcoholic.", "alcoholic", "person with alcohol use disorder"],
      ["Known schizophrenic.", "schizophrenic", "person living with schizophrenia"],
      ["He is a diabetic.", "a diabetic", "person with diabetes"],
      ["Wheelchair-bound since 2019.", "wheelchair-bound", "uses a wheelchair"],
      ["A victim of a fall.", "victim", "person who has experienced"],
      ["The patient must fast.", "the patient must", "please (and speak to the reader directly)"],
    ];
    for (const [text, expectedTerm, suggestion] of expectations) {
      const matches = stigmaMatches(text, "en");
      expect(matches.length, text).toBeGreaterThan(0);
      expect(matches[0].term.toLowerCase(), text).toBe(expectedTerm);
      expect(matches[0].suggestion, text).toBe(suggestion);
    }
  });

  it("does not flag neutral language or adjectival clinical phrases", () => {
    expect(terms("You need to bring your card. You can text us. Keep the wound clean.")).toEqual([]);
    expect(terms("Your diabetic foot exam is Tuesday. Alcoholics Anonymous meets at 7.")).toEqual([]);
    expect(terms("Please fast after midnight. The link was invalid.")).toEqual([]);
    expect(terms("Your test was negative.")).toEqual([]);
  });

  it("returns non-overlapping matches sorted by index", () => {
    const text = "Non-compliant, denies use, refused labs, substance abuse history.";
    const matches = stigmaMatches(text, "en");
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].index).toBeGreaterThanOrEqual(matches[i - 1].index + matches[i - 1].length);
    }
  });
});

describe("stigmaMatches (Spanish)", () => {
  it("matches Spanish stigma terms with accents and gender/number variants", () => {
    expect(terms("El paciente niega consumo. Rechazó la vacuna.", "es")).toEqual(["niega", "rechazó"]);
    expect(terms("Es una adicta con antecedentes de abuso de sustancias.", "es")).toEqual([
      "adicta",
      "abuso de sustancias",
    ]);
    expect(terms("Sufre de asma. Víctima de una caída. Está demente.", "es")).toEqual([
      "sufre de",
      "víctima",
      "demente",
    ]);
    expect(terms("Diabetes mal controlada; es un diabético obeso.", "es")).toEqual([
      "mal controlada",
      "un diabético",
      "obeso",
    ]);
  });

  it("does not flag neutral Spanish or proper names", () => {
    expect(terms("Su cita está retrasada. Alcohólicos Anónimos se reúne hoy. Mantenga la herida limpia.", "es")).toEqual(
      [],
    );
    expect(terms("Su examen del pie diabético es el martes.", "es")).toEqual([]);
  });
});

describe("avoidTermMatches", () => {
  it("matches whole phrases case-insensitively with indexes", () => {
    const text = "Your HIV clinic visit is Tuesday. hiv results are ready.";
    const matches = avoidTermMatches(text, ["HIV"]);
    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ term: "HIV", index: 5, length: 3 });
    expect(matches[1].term).toBe("hiv");
  });

  it("does not match inside other words and tolerates hyphen/space variants", () => {
    expect(avoidTermMatches("archive the shiver", ["hiv"])).toEqual([]);
    expect(avoidTermMatches("Your check up is soon.", ["check-up"])).toHaveLength(1);
    expect(avoidTermMatches("text", [])).toEqual([]);
    expect(avoidTermMatches("text", ["", "   "])).toEqual([]);
  });
});

describe("lexicon integrity", () => {
  it("has unique ids and compiles every pattern", () => {
    const ids = new Set(STIGMA_LEXICON.map((e) => e.id));
    expect(ids.size).toBe(STIGMA_LEXICON.length);
    for (const e of STIGMA_LEXICON) {
      expect(() => new RegExp(e.pattern, "gi"), e.id).not.toThrow();
      expect(e.suggestion.length, e.id).toBeGreaterThan(0);
    }
  });
});
