import type { Language, TiFinding, TiRule, TiScore, TiTarget } from "@/lib/schemas";
import { longestSentenceWords, readingGrade, splitSentences, words } from "./readability";
import { RULE_CHECKS, type RuleContext } from "./rules";

/**
 * Trauma-informed language score. Rules, not vibes.
 *
 * Deterministic: the same text and target always produce the same score.
 * No model calls. 100 points are allocated across eight rules:
 *
 *   privacy          15  All or nothing. Any restricted term for this channel
 *                        and recipient scores 0, sets `blocked: true`, and the
 *                        finding carries severity "block".
 *   stigma           25  Start at 25, subtract 8 per stigma/blame term or
 *                        profile avoid-term (floor 0). Each match has a
 *                        replacement suggestion.
 *   reading_level    20  Full points when the reading grade is within 0.5 of
 *                        the target, half when within 2 grades, else 0.
 *                        English uses Flesch-Kincaid; Spanish uses
 *                        Fernández-Huerta mapped onto the same grade scale.
 *   sentence_length   5  Longest sentence at or under the target word limit.
 *   choice           10  The text offers an option ("you can", "if you'd like",
 *                        "or", Spanish "puede", "si prefiere").
 *   predictability   10  The text gives a time or day AND says what will
 *                        happen ("takes about", "we'll", "your visit is").
 *   safety           10  A way to reach a person or pause: a phone number,
 *                        "call/text us", "if you feel", "you can stop".
 *   collaboration     5  Partnership language: "together", "with you", "we".
 *
 * Score = round(sum of points earned), clamped to 0..100. Findings are
 * returned for every rule, passed or not, in RULE_ORDER so the UI can render
 * a stable checklist. Matches carry index/length for highlighting.
 */
export const TI_WEIGHTS: Record<TiRule, number> = {
  privacy: 15,
  stigma: 25,
  reading_level: 20,
  sentence_length: 5,
  choice: 10,
  predictability: 10,
  safety: 10,
  collaboration: 5,
};

/** Stable display order for the checklist. */
export const RULE_ORDER: readonly TiRule[] = [
  "privacy",
  "stigma",
  "reading_level",
  "sentence_length",
  "choice",
  "predictability",
  "safety",
  "collaboration",
];

const DEFAULT_READING_LEVEL = 6;
const DEFAULT_SENTENCE_MAX_WORDS = 14;

/**
 * Coerce a loosely typed target into a safe one. The checker never throws on
 * odd input; it falls back to documented defaults so a scoring stage cannot
 * take down a pipeline run.
 */
export function normalizeTarget(target: Partial<TiTarget> | null | undefined): TiTarget {
  const t = target ?? {};
  const language: Language = t.language === "es" ? "es" : "en";
  const readingLevel =
    typeof t.readingLevel === "number" && Number.isFinite(t.readingLevel)
      ? Math.min(18, Math.max(0, t.readingLevel))
      : DEFAULT_READING_LEVEL;
  const sentenceMaxWords =
    typeof t.sentenceMaxWords === "number" && Number.isFinite(t.sentenceMaxWords)
      ? Math.max(1, Math.round(t.sentenceMaxWords))
      : DEFAULT_SENTENCE_MAX_WORDS;
  return {
    readingLevel,
    sentenceMaxWords,
    language,
    channel: t.channel === "portal" || t.channel === "phone" ? t.channel : "sms",
    recipient: typeof t.recipient === "string" && t.recipient ? t.recipient : "patient",
    privacyRules: Array.isArray(t.privacyRules) ? t.privacyRules : [],
    avoidTerms: Array.isArray(t.avoidTerms) ? t.avoidTerms.filter((x) => typeof x === "string") : [],
  };
}

/** Score patient-facing text against a reader profile. Pure and deterministic. */
export function scoreText(text: string, target: TiTarget): TiScore {
  const safeText = typeof text === "string" ? text : "";
  const t = normalizeTarget(target);
  const grade = readingGrade(safeText, t.language);
  const longest = longestSentenceWords(safeText);
  const wordCount = splitSentences(safeText).reduce((n, s) => n + words(s).length, 0);

  const ctx: RuleContext = {
    text: safeText,
    target: t,
    language: t.language,
    readingGrade: grade,
    longestSentenceWords: longest,
    wordCount,
  };

  const findings: TiFinding[] = RULE_ORDER.map((rule) => RULE_CHECKS[rule](ctx, TI_WEIGHTS[rule]));
  const total = findings.reduce((sum, f) => sum + f.points, 0);
  const blocked = findings.some((f) => f.severity === "block" && !f.passed);

  return {
    score: Math.max(0, Math.min(100, Math.round(total))),
    readingGrade: grade,
    longestSentenceWords: longest,
    blocked,
    findings,
  };
}
