/** Backend en fazla 24 dil kabul eder (ReviewFetchCreate). */
export const MAX_GLOBAL_FETCH_LANGS = 24;

/** Derin / global tarama için önerilen dil kodları (ISO 639-1). */
export const GLOBAL_SCAN_LANG_CODES = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "it",
  "tr",
  "ru",
  "ar",
  "ja",
  "ko",
  "zh",
  "nl",
  "pl",
  "hi",
  "id",
  "th",
  "vi",
  "ms",
  "ro",
  "cs",
  "sv",
  "da",
  "no",
  "fi",
  "el",
  "he",
  "hu",
  "uk",
  "bn",
] as const;

export type GlobalScanLangCode = (typeof GLOBAL_SCAN_LANG_CODES)[number];
