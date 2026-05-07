/**
 * Fills message files where value still equals English:
 * - Plain strings → Google Translate (gtx)
 * - ICU strings → translate only literal segments via @formatjs/icu-messageformat-parser
 *
 * Usage (from frontend/): node scripts/translate-locale-strings.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  isLiteralElement,
  isPluralElement,
  isSelectElement,
  parse,
} from "@formatjs/icu-messageformat-parser";
import { printAST } from "@formatjs/icu-messageformat-parser/printer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = join(__dirname, "../src/messages");

const TARGET_LANG = {
  de: "de",
  fr: "fr",
  es: "es",
  it: "it",
  pt: "pt",
  ja: "ja",
  zh: "zh-CN",
  ru: "ru",
  ar: "ar",
  sw: "sw",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function flatten(obj, prefix = "", out = {}) {
  for (const k of Object.keys(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

function unflatten(flat) {
  const root = {};
  for (const path of Object.keys(flat)) {
    const parts = path.split(".");
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (cur[p] === undefined) {
        cur[p] = {};
      }
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = flat[path];
  }
  return root;
}

async function translateGtx(text, tl) {
  const u = new URL("https://translate.googleapis.com/translate_a/single");
  u.searchParams.set("client", "gtx");
  u.searchParams.set("sl", "en");
  u.searchParams.set("tl", tl);
  u.searchParams.set("dt", "t");
  u.searchParams.set("q", text);

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(u);
    if (!res.ok) {
      await sleep(800 * (attempt + 1));
      continue;
    }
    const data = await res.json();
    const out = data?.[0]?.[0]?.[0];
    if (typeof out === "string" && out.length > 0) {
      return out;
    }
    await sleep(400);
  }
  throw new Error(`translate failed: ${text.slice(0, 40)}`);
}

/** Collect literal string values from ICU AST (recursive). */
function collectLiterals(elements, literals) {
  if (!Array.isArray(elements)) {
    return;
  }
  for (const el of elements) {
    if (isLiteralElement(el) && el.value.length > 0) {
      literals.add(el.value);
    } else if (isPluralElement(el)) {
      for (const k of Object.keys(el.options)) {
        collectLiterals(el.options[k].value, literals);
      }
    } else if (isSelectElement(el)) {
      for (const k of Object.keys(el.options)) {
        collectLiterals(el.options[k].value, literals);
      }
    }
  }
}

/** Replace literal values in ICU AST (in place). */
function applyLiterals(elements, map) {
  if (!Array.isArray(elements)) {
    return;
  }
  for (const el of elements) {
    if (isLiteralElement(el) && el.value.length > 0 && map.has(el.value)) {
      el.value = map.get(el.value);
    } else if (isPluralElement(el)) {
      for (const k of Object.keys(el.options)) {
        applyLiterals(el.options[k].value, map);
      }
    } else if (isSelectElement(el)) {
      for (const k of Object.keys(el.options)) {
        applyLiterals(el.options[k].value, map);
      }
    }
  }
}

async function translateIcuMessage(enMsg, tl, stringCache) {
  let ast;
  try {
    ast = parse(enMsg);
  } catch {
    return translateGtxWithCache(enMsg, tl, stringCache);
  }

  const literals = new Set();
  collectLiterals(ast, literals);

  const map = new Map();
  for (const lit of literals) {
    const cacheKey = `${tl}::${lit}`;
    if (stringCache.has(cacheKey)) {
      map.set(lit, stringCache.get(cacheKey));
      continue;
    }
    const tr = await translateGtx(lit, tl);
    stringCache.set(cacheKey, tr);
    map.set(lit, tr);
    await sleep(95);
  }

  applyLiterals(ast, map);
  try {
    return printAST(ast);
  } catch {
    return translateGtxWithCache(enMsg, tl, stringCache);
  }
}

async function translateGtxWithCache(text, tl, stringCache) {
  const cacheKey = `${tl}::${text}`;
  if (stringCache.has(cacheKey)) {
    return stringCache.get(cacheKey);
  }
  const tr = await translateGtx(text, tl);
  stringCache.set(cacheKey, tr);
  await sleep(95);
  return tr;
}

async function main() {
  const onlyLocale = process.argv[2]?.trim();
  const locales = onlyLocale
    ? Object.keys(TARGET_LANG).filter((l) => l === onlyLocale)
    : Object.keys(TARGET_LANG);
  if (onlyLocale && locales.length === 0) {
    console.error(`Unknown locale "${onlyLocale}". Use one of: ${Object.keys(TARGET_LANG).join(", ")}`);
    process.exit(1);
  }

  const en = JSON.parse(readFileSync(join(MESSAGES_DIR, "en.json"), "utf8"));
  const enFlat = flatten(en);
  const stringCache = new Map();

  for (const locale of locales) {
    const tl = TARGET_LANG[locale];
    const path = join(MESSAGES_DIR, `${locale}.json`);
    const loc = JSON.parse(readFileSync(path, "utf8"));
    const locFlat = flatten(loc);

    const todo = Object.keys(enFlat).filter(
      (k) => typeof enFlat[k] === "string" && locFlat[k] === enFlat[k],
    );

    console.error(`${locale}: translating ${todo.length} keys…`);

    let n = 0;
    for (const k of todo) {
      const src = enFlat[k];
      try {
        if (!src.includes("{")) {
          locFlat[k] = await translateGtxWithCache(src, tl, stringCache);
        } else {
          locFlat[k] = await translateIcuMessage(src, tl, stringCache);
        }
      } catch (e) {
        console.error(`  ${k}: ${e.message}`);
      }
      n++;
      if (n % 40 === 0) {
        console.error(`  ${locale}: ${n}/${todo.length}`);
      }
    }

    writeFileSync(path, `${JSON.stringify(unflatten(locFlat), null, 2)}\n`, "utf8");
    console.error(`Wrote ${path}`);
  }

  console.error("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
