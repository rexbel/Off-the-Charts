/**
 * Trauma-informed language checker. Deterministic, rule-based, no model calls.
 *
 *   scoreText(text, target) → TiScore   // 0-100 with per-rule findings
 */
export { scoreText, TI_WEIGHTS, RULE_ORDER, normalizeTarget } from "./score";
export {
  readingGrade,
  splitSentences,
  longestSentenceWords,
  countSyllables,
  words,
} from "./readability";
export {
  STIGMA_LEXICON,
  stigmaMatches,
  avoidTermMatches,
  lexiconEntryFor,
  type StigmaEntry,
} from "./lexicon";
export {
  applicablePrivacyRules,
  STIGMA_PENALTY_PER_MATCH,
  READING_TOLERANCE,
  READING_HALF_CREDIT_RANGE,
  type RuleContext,
} from "./rules";
