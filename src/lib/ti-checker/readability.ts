import type { Language } from "@/lib/schemas";

/**
 * Readability for short patient-facing text (SMS, portal notes, summaries).
 *
 * English: Flesch-Kincaid grade level.
 * Spanish: Fernández-Huerta index (with Law's 2011 correction, words per
 * sentence) mapped onto a US-grade-like scale so both languages produce one
 * comparable `readingGrade` number.
 *
 * Tuned for SMS-style text: line breaks and bullets end sentences, honorifics
 * ("Dr.", "Dra."), "a.m./p.m.", decimals, times ("9:30") and phone numbers
 * ("555-0100") do not create extra sentences, and numeric tokens count as one
 * syllable so a phone number cannot inflate the grade.
 *
 * Regexes that need lookbehind are built with `new RegExp` because the
 * project targets ES2017 and TypeScript rejects lookbehind in regex literals.
 */

/** Latin letters including Latin-1 accented characters (á, é, ñ, ü ...). */
export const LETTER = "A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u00FF";
const WORD_CHAR = new RegExp(`[${LETTER}0-9]`);

/** Placeholder for a protected period that must not end a sentence. */
const DOT = "․";

/** Honorifics and abbreviations that never end a sentence. */
const HONORIFICS = [
  "dr", "dra", "mr", "mrs", "ms", "mx", "jr", "sr", "sra", "srta", "st", "mt",
  "lic", "ud", "uds", "rm", "apt", "ste", "tel", "ext", "no", "núm", "num", "pág", "pag",
];

/** Abbreviations that end a sentence only when followed by a capital letter. */
const SOFT_ABBREV = ["etc", "vs", "approx", "aprox", "e\\.g", "i\\.e", "min", "hr", "hrs"];

/**
 * Make a pattern case-insensitive by expanding letters into [xX] classes. We
 * cannot use the `i` flag here because the uppercase lookaheads below must
 * stay case-sensitive ("a.m. with" is not a sentence end; "a.m. Please" is).
 */
function ci(pattern: string): string {
  return pattern.replace(/[a-záéíóúñü]/g, (c) => `[${c}${c.toUpperCase()}]`);
}

const UPPER = "A-Z\\u00C0-\\u00DD¿¡";
const HONORIFIC_RE = new RegExp(`(?<![${LETTER}])(${ci(HONORIFICS.join("|"))})\\.`, "g");
const SOFT_ABBREV_RE = new RegExp(
  `(?<![${LETTER}])(${ci(SOFT_ABBREV.join("|"))})\\.(?!\\s+[${UPPER}])`,
  "g",
);
/** a.m. / p.m. (both dots), unless followed by a capital that starts a new sentence. */
const AMPM_RE = new RegExp(`(?<![A-Za-z])([apAP])\\.\\s?[mM]\\.(?!\\s+[${UPPER}])`, "g");
const DECIMAL_RE = /(\d)\.(\d)/g;
/** Leading list markers: bullets, dashes, "1.", "1)", "a)", "Step 1:". */
const LIST_MARKER_RE = new RegExp(
  `^\\s*(?:[•·▪◦‣○●■□✓✔☐☑\\-–—*]+|\\d{1,2}[.)]|\\(\\d{1,2}\\)|[a-zA-Z][.)]|(?:step|paso)\\s*\\d+\\s*[:.)]?)\\s+`,
  "i",
);
/** Sentence boundary: terminal punctuation (plus optional closing quote) then whitespace. */
const SENTENCE_BREAK_RE = new RegExp(`(?<=[.!?…]+["”’')]?)\\s+`);

function protectPeriods(text: string): string {
  return text
    .replace(DECIMAL_RE, `$1${DOT}$2`)
    .replace(HONORIFIC_RE, `$1${DOT}`)
    .replace(SOFT_ABBREV_RE, (m) => m.split(".").join(DOT))
    .replace(AMPM_RE, (m) => m.split(".").join(DOT));
}

function restorePeriods(text: string): string {
  return text.split(DOT).join(".");
}

/** Tokens that contain at least one letter or digit. */
export function words(text: string): string[] {
  return text.split(/\s+/).filter((t) => WORD_CHAR.test(t));
}

/**
 * Split text into sentences. Line breaks and list items are boundaries;
 * ".", "!", "?", "…" end a sentence except inside protected abbreviations,
 * decimals and times. Returns trimmed sentences that contain at least one word.
 */
export function splitSentences(text: string): string[] {
  if (typeof text !== "string" || text.trim().length === 0) return [];
  const out: string[] = [];
  for (const rawLine of text.split(/\r?\n|\r/)) {
    const line = protectPeriods(rawLine).replace(LIST_MARKER_RE, "");
    if (!line.trim()) continue;
    for (const piece of line.split(SENTENCE_BREAK_RE)) {
      const sentence = restorePeriods(piece).trim();
      if (sentence && words(sentence).length > 0) out.push(sentence);
    }
  }
  return out;
}

/** Word count of the longest sentence. 0 for empty text. */
export function longestSentenceWords(text: string): number {
  return splitSentences(text).reduce((max, s) => Math.max(max, words(s).length), 0);
}

// ---------------------------------------------------------------------------
// Syllables
// ---------------------------------------------------------------------------

const HAS_DIGIT = /\d/;

/** English heuristic: vowel groups, silent -e / -es / -ed, "ia"/"io" hiatus. */
export function syllablesEn(token: string): number {
  if (HAS_DIGIT.test(token)) return 1;
  const w = token.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  let count = (w.match(/[aeiouy]+/g) ?? []).length;
  // Hiatus that vowel-group counting misses: "compliant", "cardiology", "diabetes".
  count += (w.match(/[^tcsxg]i[aou]/g) ?? []).length;
  // Silent endings.
  if (/[^aeiou]e$/.test(w) && !/[^aeiou]le$/.test(w)) count -= 1;
  if (/[^aeiousxz]es$/.test(w) && !/(?:ch|sh)es$/.test(w)) count -= 1;
  if (/[^aeiou]ed$/.test(w) && !/[td]ed$/.test(w)) count -= 1;
  return Math.max(1, count);
}

const ES_STRONG = new Set(["a", "e", "o", "á", "é", "ó"]);
const ES_ACCENTED_WEAK = new Set(["í", "ú"]);
const ES_VOWEL = new Set([...ES_STRONG, ...ES_ACCENTED_WEAK, "i", "u", "ü"]);
const ES_NON_LETTER_RE = new RegExp(`[^${LETTER}]`, "g");

/** Spanish: vowel nuclei, splitting hiatus (two strong vowels or accented í/ú). */
export function syllablesEs(token: string): number {
  if (HAS_DIGIT.test(token)) return 1;
  let w = token
    .toLowerCase()
    .replace(ES_NON_LETTER_RE, "")
    // Silent "u" in que/qui/gue/gui.
    .replace(/qu([eiéí])/g, "q$1")
    .replace(/gu([eiéí])/g, "g$1");
  if (w.length === 0) return 1;
  // "y" is a vowel at the end of a word or on its own ("y", "muy").
  w = w.replace(/y$/, "i");
  let count = 0;
  let prev: string | null = null;
  for (const ch of w) {
    if (ES_VOWEL.has(ch)) {
      if (prev === null) {
        count += 1;
      } else {
        const hiatus =
          (ES_STRONG.has(prev) && ES_STRONG.has(ch)) ||
          ES_ACCENTED_WEAK.has(prev) ||
          ES_ACCENTED_WEAK.has(ch);
        if (hiatus) count += 1;
      }
      prev = ch;
    } else {
      prev = null;
    }
  }
  return Math.max(1, count);
}

export function countSyllables(token: string, language: Language): number {
  return language === "es" ? syllablesEs(token) : syllablesEn(token);
}

// ---------------------------------------------------------------------------
// Grade
// ---------------------------------------------------------------------------

/**
 * Map a Flesch-style 0-100 ease score onto a US grade. Anchors follow the
 * published Flesch Reading Ease bands (90-100 → 5th grade, 60-70 → 8th/9th,
 * 30-50 → college). Linear between anchors.
 */
const EASE_TO_GRADE: Array<[number, number]> = [
  [100, 4],
  [90, 5],
  [80, 6],
  [70, 7],
  [60, 8.5],
  [50, 11],
  [30, 14.5],
  [0, 18],
];

export function easeToGrade(ease: number): number {
  if (ease >= 100) return EASE_TO_GRADE[0][1];
  if (ease <= 0) return EASE_TO_GRADE[EASE_TO_GRADE.length - 1][1];
  for (let i = 0; i < EASE_TO_GRADE.length - 1; i++) {
    const [hiEase, hiGrade] = EASE_TO_GRADE[i];
    const [loEase, loGrade] = EASE_TO_GRADE[i + 1];
    if (ease <= hiEase && ease > loEase) {
      const t = (hiEase - ease) / (hiEase - loEase);
      return hiGrade + t * (loGrade - hiGrade);
    }
  }
  return 18;
}

export const MIN_GRADE = 0;
export const MAX_GRADE = 18;

function clampGrade(g: number): number {
  if (!Number.isFinite(g)) return MIN_GRADE;
  return Math.round(Math.min(MAX_GRADE, Math.max(MIN_GRADE, g)) * 10) / 10;
}

/**
 * Reading grade for the text, 0..18 with one decimal. Empty text returns 0.
 * - en: Flesch-Kincaid grade = 0.39 * words/sentence + 11.8 * syllables/word - 15.59
 * - es: Fernández-Huerta = 206.84 - 0.60 * syllables per 100 words - 1.02 * words/sentence,
 *       mapped to a grade with the Flesch ease bands.
 */
export function readingGrade(text: string, language: Language = "en"): number {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return 0;
  let wordCount = 0;
  let syllableCount = 0;
  for (const s of sentences) {
    for (const w of words(s)) {
      wordCount += 1;
      syllableCount += countSyllables(w, language);
    }
  }
  if (wordCount === 0) return 0;
  const wordsPerSentence = wordCount / sentences.length;
  const syllablesPerWord = syllableCount / wordCount;
  if (language === "es") {
    const ease = 206.84 - 0.6 * (syllablesPerWord * 100) - 1.02 * wordsPerSentence;
    return clampGrade(easeToGrade(ease));
  }
  return clampGrade(0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59);
}
