import type { Language, TiMatch } from "@/lib/schemas";
import { LETTER } from "./readability";

/**
 * Stigma and blame lexicon with person-first replacements.
 *
 * Sources: SAMHSA and NIDA "Words Matter" guidance, AMA Manual of Style
 * person-first language, and the Joint Commission / AHRQ plain-language
 * guidance. Every entry is a rule: a bounded, case-insensitive pattern with
 * simple plural and inflection handling and a plain-language replacement.
 *
 * Patterns are written as strings and compiled with `new RegExp` so we can use
 * Unicode-aware word boundaries (JS `\b` is ASCII-only and breaks on "está",
 * "víctima") without hitting TypeScript's ES2017 regex-literal restrictions.
 *
 * Deliberately left out as too ambiguous for an automatic flag:
 * - bare "abuse" (domestic abuse, child abuse are legitimate and necessary)
 * - "addiction" (clinical: "addiction medicine")
 * - "crazy", "loco" (colloquial, usually not about a person)
 * - "you must" / "you need to" (direct, but not stigma; tone is the voice guide's job)
 * - bare "failed" (devices fail, tests fail); only "failed treatment/therapy/to..." is flagged
 * - bare "clean"/"dirty" (wound care); only the drug-test and "stayed clean" senses are flagged
 * - "positive"/"negative" (these are the preferred replacements)
 */

export type StigmaEntry = {
  id: string;
  language: Language | "both";
  /** Human-readable term for the UI. */
  term: string;
  /** Regex source, without boundaries. Matched case-insensitively. */
  pattern: string;
  /** Replacement suggestion in plain language. */
  suggestion: string;
  /** Why this matters, one sentence. */
  why: string;
};

const B_START = `(?<![${LETTER}0-9])`;
const B_END = `(?![${LETTER}0-9])`;

/** Compile a whole-word/phrase pattern with Unicode-aware boundaries. */
export function boundedRegex(pattern: string, flags = "gi"): RegExp {
  return new RegExp(`${B_START}(?:${pattern})${B_END}`, flags);
}

/** Escape a literal phrase and let spaces or hyphens vary ("check up" / "check-up"). */
function literal(phrase: string): string {
  return phrase
    .trim()
    .split(/[\s-]+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\s-]+");
}

export const STIGMA_LEXICON: StigmaEntry[] = [
  // --- English -----------------------------------------------------------
  {
    id: "en.noncompliant",
    language: "en",
    term: "non-compliant",
    pattern: "non[\\s-]?complian(?:t|ce)|non[\\s-]?adheren(?:t|ce)",
    suggestion: "has not been able to",
    why: "Frames a barrier as disobedience.",
  },
  {
    id: "en.denies",
    language: "en",
    term: "denies",
    pattern: "den(?:y|ies|ied|ying)",
    suggestion: "says they do not have",
    why: "Implies the person is hiding something.",
  },
  {
    id: "en.refused",
    language: "en",
    term: "refused",
    pattern: "refus(?:e|es|ed|ing|al)",
    suggestion: "chose not to",
    why: "Removes the person's right to decide.",
  },
  {
    id: "en.abuser",
    language: "en",
    term: "abuser",
    pattern: "(?:substance|drug|alcohol|opioid)[\\s-]+abusers?|abusers?",
    suggestion: "person with a substance use disorder",
    why: "Defines a person by a condition.",
  },
  {
    id: "en.substance_abuse",
    language: "en",
    term: "substance abuse",
    pattern: "(?:substance|drug|alcohol|opioid|polysubstance)[\\s-]+abus(?:e|ing)",
    suggestion: "substance use",
    why: "\"Abuse\" is judgmental; \"use\" is clinical.",
  },
  {
    id: "en.drug_seeking",
    language: "en",
    term: "drug-seeking",
    pattern: "drug[\\s-]?seeking|med(?:ication)?[\\s-]?seeking",
    suggestion: "remove; describe the request and the plan instead",
    why: "A label, not an observation.",
  },
  {
    id: "en.addict",
    language: "en",
    term: "addict",
    pattern: "addicts?|junkies?|users?\\s+of\\s+drugs|drug\\s+users?",
    suggestion: "person in recovery",
    why: "Person-first language supports recovery.",
  },
  {
    id: "en.suffers_from",
    language: "en",
    term: "suffers from",
    pattern: "suffer(?:s|ed|ing)?\\s+from|afflicted\\s+(?:with|by)",
    suggestion: "has",
    why: "Assumes suffering; let the person describe their experience.",
  },
  {
    id: "en.demented",
    language: "en",
    term: "demented",
    pattern: "demented|senile",
    suggestion: "living with dementia",
    why: "Person-first language for cognitive conditions.",
  },
  {
    id: "en.failed_treatment",
    language: "en",
    term: "failed treatment",
    pattern:
      "fail(?:ed|s|ing)?\\s+(?:the\\s+|their\\s+|your\\s+|his\\s+|her\\s+|this\\s+|a\\s+)?(?:treatment|therapy|medication|meds|trial|regimen|test|screening|program)s?|treatment\\s+failure|fail(?:ed|s)?\\s+to",
    suggestion: "treatment did not work",
    why: "Puts the failure on the person instead of the treatment.",
  },
  {
    id: "en.obese",
    language: "en",
    term: "obese",
    pattern: "(?:morbidly\\s+)?obes(?:e|ity)",
    suggestion: "weight",
    why: "Talk about weight, not a label.",
  },
  {
    id: "en.poorly_controlled",
    language: "en",
    term: "poorly controlled",
    pattern: "poorly[\\s-]+controlled|uncontrolled|out\\s+of\\s+control",
    suggestion: "above goal",
    why: "\"Control\" implies personal failure; \"above goal\" is a number.",
  },
  {
    id: "en.clean_dirty_test",
    language: "en",
    term: "clean / dirty (test)",
    pattern:
      "(?:clean|dirty)\\s+(?:urine|UDS|UA|tox(?:icology)?(?:\\s+screen)?|drug\\s+(?:test|screen)|test|screen|sample)s?|(?:urine|UDS|UA|tox(?:icology)?|drug\\s+(?:test|screen)|test|screen|sample)s?\\s+(?:was|is|came\\s+back|were)\\s+(?:clean|dirty)|(?:stay|stays|stayed|staying|been|being|remain(?:s|ed)?|get|got|getting)\\s+clean",
    suggestion: "negative / positive (or \"has not returned to use\")",
    why: "\"Dirty\" labels the person, not the result.",
  },
  {
    id: "en.relapse",
    language: "en",
    term: "relapse",
    pattern: "relaps(?:e|es|ed|ing)",
    suggestion: "return to use",
    why: "\"Relapse\" reads as a moral setback.",
  },
  {
    id: "en.frequent_flyer",
    language: "en",
    term: "frequent flyer",
    pattern: "frequent[\\s-]+fl(?:y|i)ers?",
    suggestion: "remove; describe the visit pattern plainly",
    why: "Mocks a person who needs care often.",
  },
  {
    id: "en.malingering",
    language: "en",
    term: "malingering",
    pattern: "malinger(?:s|ed|ing|er|ers)?|faking",
    suggestion: "remove; describe what was observed",
    why: "Accuses the person of lying.",
  },
  {
    id: "en.difficult_patient",
    language: "en",
    term: "difficult patient",
    pattern: "difficult\\s+(?:patients?|family|families)|problem\\s+patients?|uncooperative|non[\\s-]?cooperative",
    suggestion: "remove; name the specific concern",
    why: "A label that follows the person into every visit.",
  },
  {
    id: "en.hysterical",
    language: "en",
    term: "hysterical",
    pattern: "hysterical(?:ly)?|hysteria",
    suggestion: "upset",
    why: "Dismisses distress, with a gendered history.",
  },
  {
    id: "en.manipulative",
    language: "en",
    term: "manipulative",
    pattern: "manipulative|manipulating",
    suggestion: "remove; describe the request plainly",
    why: "Assumes bad intent.",
  },
  {
    id: "en.alcoholic",
    language: "en",
    term: "alcoholic",
    pattern: "alcoholics?(?!\\s+anonymous)|drunks?",
    suggestion: "person with alcohol use disorder",
    why: "Person-first language for alcohol use.",
  },
  {
    id: "en.schizophrenic",
    language: "en",
    term: "schizophrenic",
    pattern: "schizophrenics?|psychotics?|bipolars",
    suggestion: "person living with schizophrenia",
    why: "A diagnosis is not an identity.",
  },
  {
    id: "en.diabetic_noun",
    language: "en",
    term: "diabetic (as a noun)",
    // Flag "a diabetic", "diabetics", "the diabetic", "is diabetic" but not "diabetic foot exam".
    pattern:
      "diabetics|(?:a|the|an?|is|are|was|were|being|known)\\s+diabetic(?!\\s+(?:foot|feet|eye|eyes|retinopathy|neuropathy|nephropathy|ketoacidosis|diet|supplies|medication|medicine|shoes|socks|educator|education|care|clinic|exam|test|screening|check|visit|appointment))",
    suggestion: "person with diabetes",
    why: "Person-first language for chronic conditions.",
  },
  {
    id: "en.wheelchair_bound",
    language: "en",
    term: "wheelchair-bound",
    pattern: "wheelchair[\\s-]+bound|confined\\s+to\\s+(?:a\\s+)?wheelchair|handicapped|crippled?",
    suggestion: "uses a wheelchair",
    why: "A wheelchair is a tool, not a confinement.",
  },
  {
    id: "en.victim",
    language: "en",
    term: "victim",
    pattern: "victims?",
    suggestion: "person who has experienced",
    why: "\"Survivor\" or a plain description keeps agency with the person.",
  },
  {
    id: "en.patient_must",
    language: "en",
    term: "the patient must",
    pattern:
      "(?:the\\s+)?patients?\\s+(?:must|is\\s+required\\s+to|are\\s+required\\s+to|has\\s+to|have\\s+to|should\\s+be\\s+aware)",
    suggestion: "please (and speak to the reader directly)",
    why: "Talks about the reader in the third person and gives orders.",
  },
  {
    id: "en.claims",
    language: "en",
    term: "claims",
    pattern: "(?:patient|she|he|they|mother|father|daughter|son|caregiver)\\s+claims?(?:\\s+that)?|allegedly|insists?\\s+that",
    suggestion: "says",
    why: "Implies doubt about the person's account.",
  },
  {
    id: "en.no_show",
    language: "en",
    term: "no-show",
    pattern: "no[\\s-]?show(?:ed|s|ing)?",
    suggestion: "missed the visit",
    why: "A label; \"missed\" describes what happened.",
  },
  {
    id: "en.mentally_ill",
    language: "en",
    term: "mentally ill",
    pattern: "mentally\\s+ill|the\\s+mentally\\s+ill|(?:mentally\\s+)?retarded|insane",
    suggestion: "living with a mental health condition",
    why: "Person-first language for mental health.",
  },
  {
    id: "en.homeless",
    language: "en",
    term: "homeless",
    pattern: "(?:the\\s+)?homeless|vagrant",
    suggestion: "experiencing homelessness",
    why: "Describes a situation, not a person.",
  },
  {
    id: "en.committed_suicide",
    language: "en",
    term: "committed suicide",
    pattern: "commit(?:ted|s)?\\s+suicide|successful\\s+suicide",
    suggestion: "died by suicide",
    why: "\"Committed\" implies a crime.",
  },

  // --- Spanish -----------------------------------------------------------
  {
    id: "es.incumplimiento",
    language: "es",
    term: "no cumple",
    pattern: "no\\s+cumpl(?:e|en|ió|ieron|ía)|incumpl(?:imiento|idor|idora|idores|idoras)|no\\s+cumplidor(?:a|es|as)?",
    suggestion: "no ha podido",
    why: "Presenta una barrera como desobediencia.",
  },
  {
    id: "es.niega",
    language: "es",
    term: "niega",
    pattern: "nieg(?:a|an|o)|neg(?:ó|aron|aba)",
    suggestion: "dice que no tiene",
    why: "Sugiere que la persona oculta algo.",
  },
  {
    id: "es.rechazó",
    language: "es",
    term: "rechazó",
    pattern: "rechaz(?:a|an|ó|aron|ado|ada)|rehus(?:a|ó|aron)|se\\s+neg(?:ó|aron|aba)",
    suggestion: "decidió no",
    why: "Quita a la persona su derecho a decidir.",
  },
  {
    id: "es.abuso_sustancias",
    language: "es",
    term: "abuso de sustancias",
    pattern: "abuso\\s+de\\s+(?:sustancias|drogas|alcohol|opioides)|abusador(?:a|es|as)?",
    suggestion: "uso de sustancias",
    why: "\"Abuso\" juzga; \"uso\" describe.",
  },
  {
    id: "es.adicto",
    language: "es",
    term: "adicto",
    pattern: "adict[oa]s?|drogadict[oa]s?|yonqui?s?",
    suggestion: "persona en recuperación",
    why: "El lenguaje centrado en la persona apoya la recuperación.",
  },
  {
    id: "es.sufre_de",
    language: "es",
    term: "sufre de",
    pattern: "sufr(?:e|en|ía|ió)\\s+de|padec(?:e|en|ía|ió)(?:\\s+de)?",
    suggestion: "tiene",
    why: "Asume sufrimiento; deje que la persona describa su experiencia.",
  },
  {
    id: "es.demente",
    language: "es",
    term: "demente",
    pattern: "dementes?|senil(?:es)?",
    suggestion: "vive con demencia",
    why: "Lenguaje centrado en la persona.",
  },
  {
    id: "es.fracaso_tratamiento",
    language: "es",
    term: "fracasó el tratamiento",
    pattern: "fracas(?:ó|o|a)\\s+(?:el|del|la|su|en\\s+el)\\s+tratamiento|fall(?:ó|o|a)\\s+(?:el|del|la|su)\\s+tratamiento|fracaso\\s+(?:terapéutico|del\\s+tratamiento)",
    suggestion: "el tratamiento no funcionó",
    why: "Pone el fracaso en la persona y no en el tratamiento.",
  },
  {
    id: "es.obeso",
    language: "es",
    term: "obeso",
    pattern: "obes[oa]s?|obesidad",
    suggestion: "peso",
    why: "Hable del peso, no de una etiqueta.",
  },
  {
    id: "es.mal_controlada",
    language: "es",
    term: "mal controlada",
    pattern: "mal\\s+controlad[oa]s?|descontrolad[oa]s?|no\\s+controlad[oa]s?|sin\\s+control",
    suggestion: "por encima de la meta",
    why: "\"Control\" implica una falla personal.",
  },
  {
    id: "es.limpio_sucio",
    language: "es",
    term: "limpio / sucio (prueba)",
    pattern:
      "(?:orina|prueba|examen|análisis|analisis|toxicolog[ií]a|muestra)\\s+(?:sali[oó]|est[aá]|estuvo|fue|dio|result[oó])?\\s*(?:limpi[ao]s?|suci[ao]s?)|(?:limpi[ao]|suci[ao])\\s+de\\s+drogas",
    suggestion: "negativo / positivo",
    why: "\"Sucio\" etiqueta a la persona, no el resultado.",
  },
  {
    id: "es.recaida",
    language: "es",
    term: "recaída",
    pattern: "reca[ií]das?|reca(?:yó|yeron|e|er)",
    suggestion: "volvió a consumir",
    why: "\"Recaída\" suena a fracaso moral.",
  },
  {
    id: "es.paciente_dificil",
    language: "es",
    term: "paciente difícil",
    pattern: "pacientes?\\s+dif[ií]cil(?:es)?|pacientes?\\s+problem[aá]tic[oa]s?|no\\s+cooper(?:a|ativo|ativa)",
    suggestion: "quitar; nombre la preocupación concreta",
    why: "Una etiqueta que acompaña a la persona a cada visita.",
  },
  {
    id: "es.histerico",
    language: "es",
    term: "histérico",
    pattern: "hist[eé]ric[oa]s?|histeria",
    suggestion: "angustiado/a",
    why: "Descarta el malestar.",
  },
  {
    id: "es.manipulador",
    language: "es",
    term: "manipulador",
    pattern: "manipulador(?:a|es|as)?|simulador(?:a|es|as)?|finge|fingiendo",
    suggestion: "quitar; describa la solicitud",
    why: "Asume mala intención.",
  },
  {
    id: "es.alcoholico",
    language: "es",
    term: "alcohólico",
    pattern: "alcoh[oó]lic[oa]s?(?!\\s+an[oó]nimos)|borrach[oa]s?",
    suggestion: "persona con trastorno por consumo de alcohol",
    why: "Lenguaje centrado en la persona.",
  },
  {
    id: "es.esquizofrenico",
    language: "es",
    term: "esquizofrénico",
    pattern: "esquizofr[eé]nic[oa]s?|psic[oó]tic[oa]s?",
    suggestion: "persona que vive con esquizofrenia",
    why: "Un diagnóstico no es una identidad.",
  },
  {
    id: "es.diabetico_sustantivo",
    language: "es",
    term: "diabético (como sustantivo)",
    pattern:
      "(?:un|una|el|la|los|las|es|son|era)\\s+diab[eé]tic[oa]s?(?!\\s+(?:pie|pies|retinopat[ií]a|neuropat[ií]a|dieta|educaci[oó]n|cl[ií]nica|examen|control|cuidado))|diab[eé]tic[oa]s",
    suggestion: "persona con diabetes",
    why: "Lenguaje centrado en la persona.",
  },
  {
    id: "es.silla_de_ruedas",
    language: "es",
    term: "confinado a una silla de ruedas",
    pattern: "confinad[oa]s?\\s+a\\s+(?:una\\s+|la\\s+)?silla\\s+de\\s+ruedas|postrad[oa]s?\\s+en\\s+(?:una\\s+)?silla\\s+de\\s+ruedas|minusv[aá]lid[oa]s?|discapacitad[oa]s?|lisiad[oa]s?",
    suggestion: "usa silla de ruedas / persona con discapacidad",
    why: "La silla es una herramienta, no una prisión.",
  },
  {
    id: "es.victima",
    language: "es",
    term: "víctima",
    pattern: "v[ií]ctimas?",
    suggestion: "persona que ha vivido",
    why: "\"Sobreviviente\" mantiene la agencia en la persona.",
  },
  {
    id: "es.paciente_debe",
    language: "es",
    term: "el paciente debe",
    pattern: "(?:el|la|los|las)\\s+pacientes?\\s+(?:debe|deben|tiene\\s+que|tienen\\s+que|est[aá]n?\\s+obligad[oa]s?)",
    suggestion: "por favor (y hable directamente con la persona)",
    why: "Habla del lector en tercera persona y da órdenes.",
  },
  {
    id: "es.enfermo_mental",
    language: "es",
    term: "enfermo mental",
    pattern: "enferm[oa]s?\\s+mental(?:es)?|retrasad[oa]s?\\s+mental(?:es)?|loc[oa]s?\\s+de\\s+remate",
    suggestion: "persona con una condición de salud mental",
    why: "Lenguaje centrado en la persona.",
  },
  {
    id: "es.indigente",
    language: "es",
    term: "indigente",
    pattern: "indigentes?|vagabund[oa]s?",
    suggestion: "persona sin hogar",
    why: "Describe una situación, no a la persona.",
  },
  {
    id: "es.se_suicido",
    language: "es",
    term: "cometió suicidio",
    pattern: "cometi(?:ó|eron)\\s+suicidio|suicidio\\s+exitoso",
    suggestion: "murió por suicidio",
    why: "\"Cometer\" implica un delito.",
  },
];

type CompiledEntry = { entry: StigmaEntry; regex: RegExp };

const COMPILED: CompiledEntry[] = STIGMA_LEXICON.map((entry) => ({
  entry,
  regex: boundedRegex(entry.pattern),
}));

/** Keep the earliest match; on ties keep the longest. Drop overlaps. */
export function dedupeMatches<T extends TiMatch>(matches: T[]): T[] {
  const sorted = [...matches].sort((a, b) => a.index - b.index || b.length - a.length);
  const out: T[] = [];
  let end = -1;
  for (const m of sorted) {
    if (m.index >= end) {
      out.push(m);
      end = m.index + m.length;
    }
  }
  return out;
}

function collect(regex: RegExp, text: string, suggestion?: string): TiMatch[] {
  const out: TiMatch[] = [];
  regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m[0].length === 0) {
      regex.lastIndex += 1;
      continue;
    }
    out.push({ term: m[0], suggestion, index: m.index, length: m[0].length });
  }
  return out;
}

/**
 * Stigma and blame terms in `text`, with index/length for highlighting.
 * `language` limits the lexicon to that language (plus language-neutral
 * entries); omit it to run the whole lexicon. Matches are sorted by index
 * and never overlap.
 */
export function stigmaMatches(text: string, language?: Language): TiMatch[] {
  if (typeof text !== "string" || text.length === 0) return [];
  const all: TiMatch[] = [];
  for (const { entry, regex } of COMPILED) {
    if (language && entry.language !== "both" && entry.language !== language) continue;
    all.push(...collect(regex, text, entry.suggestion));
  }
  return dedupeMatches(all);
}

/**
 * Plain whole-phrase, case-insensitive matching for a list of terms (profile
 * avoid-terms or privacy restricted terms). Spaces and hyphens in a term match
 * any whitespace or hyphen run. Returns non-overlapping matches sorted by index.
 */
export function avoidTermMatches(text: string, terms: readonly string[]): TiMatch[] {
  if (typeof text !== "string" || text.length === 0 || !Array.isArray(terms)) return [];
  const all: TiMatch[] = [];
  for (const raw of terms) {
    if (typeof raw !== "string") continue;
    const term = raw.trim();
    if (!term) continue;
    all.push(...collect(boundedRegex(literal(term)), text));
  }
  return dedupeMatches(all);
}

/** Look up the lexicon entry whose pattern produced a match, for UI tooltips. */
export function lexiconEntryFor(matchText: string, language?: Language): StigmaEntry | undefined {
  for (const { entry, regex } of COMPILED) {
    if (language && entry.language !== "both" && entry.language !== language) continue;
    regex.lastIndex = 0;
    const m = regex.exec(matchText);
    if (m && m[0].length === matchText.length) return entry;
  }
  return undefined;
}
