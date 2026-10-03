import type { Language, PrivacyRule, TiFinding, TiMatch, TiRule, TiTarget } from "@/lib/schemas";
import { avoidTermMatches, boundedRegex, dedupeMatches, stigmaMatches } from "./lexicon";
import { LETTER } from "./readability";

/**
 * SAMHSA-style trauma-informed principle checks. Each check is a pure
 * function from (text, target, precomputed stats) to one TiFinding with a
 * plain-language message a care coordinator can act on, and the matched
 * phrases (index/length) so the UI can highlight them.
 */

export type RuleContext = {
  text: string;
  target: TiTarget;
  language: Language;
  readingGrade: number;
  longestSentenceWords: number;
  wordCount: number;
};

export type RuleCheck = (ctx: RuleContext, pointsAvailable: number) => TiFinding;

/** Points subtracted per stigma or avoid-term match. */
export const STIGMA_PENALTY_PER_MATCH = 8;
/** Grades above target still treated as a pass. */
export const READING_TOLERANCE = 0.5;
/** Grades above target that still earn half credit. */
export const READING_HALF_CREDIT_RANGE = 2;

type PhraseSet = Record<Language, string[]>;

const PHONE = "\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]\\d{4}|\\d{3}[\\s.-]\\d{4}";

/** Stronger, more specific phrases first so the message quotes the best evidence. */
const CHOICE: PhraseSet = {
  en: [
    "if you(?:'d| would) like",
    "if you (?:like|want|prefer|wish)",
    "(?:it's|it is) up to you",
    "up to you",
    "your choice",
    "your call",
    "let us know (?:which|what works|if|whether)",
    "you (?:can|could|may|might|are welcome to|don't have to|do not have to)",
    "whichever",
    "either",
    "options?",
    "pick",
    "choose",
  ],
  es: [
    "si (?:quiere|desea|prefiere|gusta|lo prefiere|usted quiere|usted prefiere)",
    "usted (?:decide|elige|escoge)",
    "(?:es )?su (?:decisi[oó]n|elecci[oó]n)",
    "(?:d[ií]ganos|av[ií]senos|cu[eé]ntenos) (?:cu[aá]l|qu[eé]|si)",
    "(?:usted )?(?:puede|pueden|podr[ií]a|podr[ií]an|no tiene que|no tienen que)",
    "cualquiera",
    "opci[oó]n(?:es)?",
    "elegir",
    "escoger",
    "o bien",
  ],
};

const TIME: PhraseSet = {
  en: [
    "\\d{1,2}(?::\\d{2})?\\s*(?:a\\.?\\s?m\\.?|p\\.?\\s?m\\.?)",
    "\\d{1,2}:\\d{2}",
    "(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?",
    "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+\\d{1,2}",
    "\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?",
    "today|tomorrow|tonight",
    "this (?:morning|afternoon|evening|week|weekend)",
    "next (?:week|month|visit)",
    "in (?:\\d+|a|an|one|two|three|four|five|six|seven) (?:minutes?|mins?|hours?|days?|weeks?)",
    "(?:\\d+|a|an|one|two|three|four|five|six|seven) (?:minutes?|mins?|hours?|days?|weeks?)",
    "(?:before|after|during) (?:your|the) (?:visit|appointment|check-?up|test|scan|procedure)",
    "(?:morning|afternoon|evening) of",
  ],
  es: [
    "\\d{1,2}(?::\\d{2})?\\s*(?:de la (?:ma[nñ]ana|tarde|noche)|a\\.?\\s?m\\.?|p\\.?\\s?m\\.?|hrs?|h)",
    "\\d{1,2}:\\d{2}",
    "a las? \\d{1,2}(?::\\d{2})?(?:\\s*(?:de la (?:ma[nñ]ana|tarde|noche)|a\\.?\\s?m\\.?|p\\.?\\s?m\\.?|hrs?|h))?",
    "lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo",
    "\\d{1,2} de (?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)",
    "\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?",
    "hoy|ma[nñ]ana|esta noche|pasado ma[nñ]ana",
    "esta (?:ma[nñ]ana|tarde|semana)",
    "(?:la )?(?:pr[oó]xima|siguiente) (?:semana|cita|visita)",
    "la semana que viene",
    "en (?:\\d+|un|una|dos|tres|cuatro|cinco|seis|siete) (?:minutos?|horas?|d[ií]as?|semanas?)",
    "(?:\\d+|un|una|unos|unas|dos|tres|cuatro|cinco|seis|siete) (?:minutos?|horas?|d[ií]as?|semanas?)",
    "(?:antes|despu[eé]s|durante) de (?:su|la) (?:cita|visita|consulta|chequeo|prueba|examen)",
  ],
};

const EVENT: PhraseSet = {
  en: [
    "takes? (?:about|around|roughly|up to)",
    "(?:will|should) take (?:about|around|roughly|up to)?",
    "lasts?",
    "what to expect",
    "(?:you|we)(?:'ll| will) (?:see|meet|go over|talk|check|review|start|begin|do|look at|listen|ask|measure|take|call|text|send)",
    "we(?:'ll| will)",
    "you(?:'ll| will)",
    "expect",
    "here(?:'s| is) what",
    "(?:visit|check-?up|appointment|test|scan|procedure|call) (?:is|will be|takes|lasts|starts|begins)",
    "(?:then|after that|at the end)",
  ],
  es: [
    "dura(?:r[aá])? (?:unos|unas|aproximadamente|cerca de|alrededor de|m[aá]s o menos)?",
    "(?:toma|tomar[aá]|tarda|tardar[aá]) (?:unos|unas|aproximadamente|cerca de)?",
    "qu[eé] esperar",
    "lo que (?:va a pasar|pasar[aá]|haremos|vamos a hacer)",
    "vamos a",
    "(?:haremos|revisaremos|hablaremos|veremos|escucharemos|mediremos|tomaremos|le (?:llamaremos|enviaremos|explicaremos))",
    "le (?:atender[aá]|ver[aá]|llamar[aá]|explicar[aá]|revisar[aá])",
    "(?:su|la) (?:cita|visita|consulta|chequeo|examen|prueba) (?:es|ser[aá]|empieza|comienza|dura)",
    "(?:luego|despu[eé]s de eso|al final)",
  ],
};

const SAFETY: PhraseSet = {
  en: [
    PHONE,
    "(?:you can|please|feel free to|just|always|or) (?:call|text|reply|message|write|email|reach)(?: us| me| back| here)?",
    "call (?:us|me|the (?:clinic|office|nurse|front desk)|this number|any ?time|\\(?\\d)",
    "text (?:us|me|here|back|this number|any ?time)",
    "reply (?:with|if|any ?time|to this|here|and|stop|help)",
    "(?:questions|worried|not sure|unsure)\\??,? (?:just )?(?:call|text|reply|message)",
    "if you (?:feel|need|have (?:any )?questions|want to talk|are worried|aren't sure|are not sure|would rather|change your mind|can't make it|cannot make it)",
    "you can (?:stop|pause|skip|take a break|change|cancel|reschedule|say no|ask (?:us )?to stop)",
    "take a break",
    "stop (?:at )?any ?time",
    "(?:we're|we are) here",
    "reach (?:us|out)",
    "message us",
    "(?:nurse|help|crisis) ?line",
    "911|988",
  ],
  es: [
    PHONE,
    "(?:puede|pueden|por favor|siempre puede) (?:llamar|escribir|responder|mandar|enviar|avisar)(?:nos|me)?",
    "ll[aá]me(?:nos|me)?(?: al| a)?",
    "escr[ií]ba(?:nos|me)?",
    "(?:env[ií]e|mande|m[aá]nde)(?:nos|me)? un (?:mensaje|texto)",
    "responda (?:con|si|a este|aqu[ií])",
    "si (?:se siente|tiene (?:alguna )?(?:pregunta|preguntas|dudas?)|necesita|quiere hablar|le preocupa|no est[aá] segur[oa]|prefiere|cambia de opini[oó]n|no puede venir)",
    "puede (?:parar|pausar|detenerse|cancelar|cambiar|tomar un descanso|decir que no)",
    "tomar un descanso",
    "(?:estamos|aqu[ií] estamos) (?:aqu[ií] )?para (?:ayudar|usted)",
    "estamos aqu[ií]",
    "l[ií]nea de (?:enfermer[ií]a|ayuda|crisis)",
    "911|988",
  ],
};

const COLLABORATION: PhraseSet = {
  en: [
    "together",
    "we(?:'ll| will) (?:decide|figure (?:it|this) out|work (?:it|this) out|plan|go over|review|talk|listen)",
    "with you",
    "your questions",
    "your (?:goals|input|ideas|thoughts)",
    "what matters to you",
    "let's",
    "ask (?:us )?anything",
    "we(?:'re|'ll|'ve| are| will| have)?",
  ],
  es: [
    "juntos|juntas",
    "con usted|contigo",
    "decidir(?:emos)? juntos",
    "sus preguntas",
    "lo que (?:le|te) importa",
    "nosotros|nosotras",
    `[${LETTER}]{3,}(?:a|e|i)(?:re|ra|ría|ba|ndo)?mos`,
  ],
};

function compile(set: PhraseSet): Record<Language, RegExp[]> {
  return {
    en: set.en.map((p) => boundedRegex(p)),
    es: set.es.map((p) => boundedRegex(p)),
  };
}

const CHOICE_RE = compile(CHOICE);
const TIME_RE = compile(TIME);
const EVENT_RE = compile(EVENT);
const SAFETY_RE = compile(SAFETY);
const COLLABORATION_RE = compile(COLLABORATION);

/** A match tagged with the position of its pattern in the list (lower = stronger evidence). */
type RankedMatch = TiMatch & { rank: number };

function findPhrases(text: string, regexes: RegExp[]): RankedMatch[] {
  const all: RankedMatch[] = [];
  regexes.forEach((re, rank) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      all.push({ term: m[0], index: m.index, length: m[0].length, rank });
    }
  });
  return dedupeMatches(all);
}

/** Strip the internal rank so findings carry plain TiMatch objects. */
function plain(matches: RankedMatch[]): TiMatch[] {
  return matches.map(({ term, index, length }) => ({ term, index, length }));
}

/** Headline evidence: the strongest-ranked phrase, then the earliest. */
function headline(matches: RankedMatch[]): string {
  const best = [...matches].sort((a, b) => a.rank - b.rank || a.index - b.index)[0];
  return best ? best.term.trim() : "";
}

function quote(s: string): string {
  return `'${s.replace(/\s+/g, " ")}'`;
}

function finding(
  rule: TiRule,
  passed: boolean,
  points: number,
  pointsAvailable: number,
  message: string,
  matches: TiMatch[] = [],
  severity?: TiFinding["severity"],
): TiFinding {
  return {
    rule,
    passed,
    severity: severity ?? (passed ? "info" : "warn"),
    message,
    points: Math.max(0, Math.min(pointsAvailable, points)),
    pointsAvailable,
    matches,
  };
}

function fmtGrade(g: number): string {
  return Number.isInteger(g) ? String(g) : g.toFixed(1);
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export const checkReadingLevel: RuleCheck = (ctx, avail) => {
  if (ctx.wordCount === 0) {
    return finding("reading_level", false, 0, avail, "No text to check for reading level.");
  }
  const target = ctx.target.readingLevel;
  const grade = ctx.readingGrade;
  const over = grade - target;
  if (over <= READING_TOLERANCE) {
    return finding(
      "reading_level",
      true,
      avail,
      avail,
      `Grade ${fmtGrade(grade)} reading level; target is ${fmtGrade(target)}.`,
    );
  }
  if (over <= READING_HALF_CREDIT_RANGE) {
    return finding(
      "reading_level",
      false,
      avail / 2,
      avail,
      `Grade ${fmtGrade(grade)} reading level; target is ${fmtGrade(target)} (close, within 2 grades). Shorter words and sentences will get it there.`,
    );
  }
  return finding(
    "reading_level",
    false,
    0,
    avail,
    `Grade ${fmtGrade(grade)} reading level; target is ${fmtGrade(target)} (about ${fmtGrade(Math.round(over * 10) / 10)} grades too high).`,
  );
};

export const checkSentenceLength: RuleCheck = (ctx, avail) => {
  if (ctx.wordCount === 0) {
    return finding("sentence_length", false, 0, avail, "No text to check for sentence length.");
  }
  const max = ctx.target.sentenceMaxWords;
  const longest = ctx.longestSentenceWords;
  if (longest <= max) {
    return finding(
      "sentence_length",
      true,
      avail,
      avail,
      `Longest sentence is ${longest} words; limit is ${max}.`,
    );
  }
  return finding(
    "sentence_length",
    false,
    0,
    avail,
    `Longest sentence is ${longest} words; limit is ${max}. Split it in two.`,
  );
};

export const checkStigma: RuleCheck = (ctx, avail) => {
  const lexicon = stigmaMatches(ctx.text, ctx.language);
  const avoid = avoidTermMatches(ctx.text, ctx.target.avoidTerms).map((m) => ({
    ...m,
    suggestion: m.suggestion ?? "avoid for this reader (from the profile)",
  }));
  // Lexicon matches win ties because they carry a replacement.
  const matches = dedupeMatches([...lexicon, ...avoid]);
  if (matches.length === 0) {
    return finding("stigma", true, avail, avail, "No stigma or blame terms found.", []);
  }
  const points = Math.max(0, avail - STIGMA_PENALTY_PER_MATCH * matches.length);
  const shown = matches
    .slice(0, 4)
    .map((m) => `${quote(m.term)} → ${m.suggestion ?? "remove"}`)
    .join("; ");
  const more = matches.length > 4 ? `; and ${matches.length - 4} more` : "";
  const noun = matches.length === 1 ? "term" : "terms";
  return finding(
    "stigma",
    false,
    points,
    avail,
    `${matches.length} ${noun} to replace: ${shown}${more}.`,
    matches,
  );
};

export function applicablePrivacyRules(target: TiTarget): PrivacyRule[] {
  return target.privacyRules.filter(
    (rule) =>
      rule.channels.includes(target.channel) &&
      (rule.recipients.length === 0 || rule.recipients.includes(target.recipient)),
  );
}

export const checkPrivacy: RuleCheck = (ctx, avail) => {
  const rules = applicablePrivacyRules(ctx.target);
  const { channel, recipient } = ctx.target;
  if (rules.length === 0) {
    return finding(
      "privacy",
      true,
      avail,
      avail,
      `No privacy rules apply to ${channel} messages for ${recipient}.`,
    );
  }
  const matches: TiMatch[] = [];
  const violated: PrivacyRule[] = [];
  for (const rule of rules) {
    const found = avoidTermMatches(ctx.text, rule.restrictedTerms);
    if (found.length > 0) {
      violated.push(rule);
      matches.push(...found.map((m) => ({ ...m, suggestion: `Restricted: ${rule.rule}` })));
    }
  }
  const deduped = dedupeMatches(matches);
  if (deduped.length === 0) {
    const n = rules.length === 1 ? "1 rule" : `${rules.length} rules`;
    return finding(
      "privacy",
      true,
      avail,
      avail,
      `No restricted terms for ${channel} to ${recipient} (${n} checked).`,
    );
  }
  const terms = Array.from(new Set(deduped.map((m) => quote(m.term)))).join(", ");
  const reasons = violated.map((r) => r.rule).join(" ");
  return finding(
    "privacy",
    false,
    0,
    avail,
    `Mentions ${terms} on ${channel} to ${recipient}. ${reasons} Remove before sending.`,
    deduped,
    "block",
  );
};

export const checkChoice: RuleCheck = (ctx, avail) => {
  const matches = findPhrases(ctx.text, CHOICE_RE[ctx.language]);
  if (matches.length > 0) {
    return finding("choice", true, avail, avail, `Offers a choice (${quote(headline(matches))}).`, plain(matches));
  }
  const hint = ctx.language === "es" ? "'puede…' or 'si prefiere…'" : "'you can…' or 'if you'd like…'";
  return finding("choice", false, 0, avail, `Does not offer a choice. Try ${hint}.`);
};

export const checkPredictability: RuleCheck = (ctx, avail) => {
  const times = findPhrases(ctx.text, TIME_RE[ctx.language]);
  const events = findPhrases(ctx.text, EVENT_RE[ctx.language]);
  if (times.length > 0 && events.length > 0) {
    return finding(
      "predictability",
      true,
      avail,
      avail,
      `Says what will happen and when (${quote(headline(times))}, ${quote(headline(events))}).`,
      plain(dedupeMatches([...times, ...events])),
    );
  }
  if (times.length > 0) {
    return finding(
      "predictability",
      false,
      0,
      avail,
      `Gives a time (${quote(headline(times))}) but not what to expect. Add how long it takes or what will happen.`,
      plain(times),
    );
  }
  if (events.length > 0) {
    return finding(
      "predictability",
      false,
      0,
      avail,
      `Describes what will happen (${quote(headline(events))}) but not when. Add a day or time.`,
      plain(events),
    );
  }
  return finding("predictability", false, 0, avail, "Does not say when or what will happen.");
};

export const checkSafety: RuleCheck = (ctx, avail) => {
  const matches = findPhrases(ctx.text, SAFETY_RE[ctx.language]);
  if (matches.length > 0) {
    return finding(
      "safety",
      true,
      avail,
      avail,
      `Gives a way to reach a person or pause (${quote(headline(matches))}).`,
      plain(matches),
    );
  }
  const hint = ctx.language === "es" ? "'llámenos al…' or 'escríbanos'" : "a phone number or 'text us'";
  return finding("safety", false, 0, avail, `No way to reach a person or pause. Add ${hint}.`);
};

export const checkCollaboration: RuleCheck = (ctx, avail) => {
  const matches = findPhrases(ctx.text, COLLABORATION_RE[ctx.language]);
  if (matches.length > 0) {
    return finding(
      "collaboration",
      true,
      avail,
      avail,
      `Uses partnership language (${quote(headline(matches))}).`,
      plain(matches),
    );
  }
  const hint = ctx.language === "es" ? "'juntos' or 'con usted'" : "'together' or 'with you'";
  return finding("collaboration", false, 0, avail, `No partnership language. Try ${hint}.`);
};

export const RULE_CHECKS: Record<TiRule, RuleCheck> = {
  privacy: checkPrivacy,
  stigma: checkStigma,
  reading_level: checkReadingLevel,
  sentence_length: checkSentenceLength,
  choice: checkChoice,
  predictability: checkPredictability,
  safety: checkSafety,
  collaboration: checkCollaboration,
};
