/**
 * Fills untranslated strings in locale JSON (where value still equals English)
 * using MyMemory public API. Preserves `{name}` and `{count, plural, ...}` blocks.
 *
 * Usage (from frontend/):
 *   node scripts/fill-locales-from-en.mjs de fr es
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = join(__dirname, "../src/messages");

const MYMEMORY_LANG = {
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

function shieldIcu(s) {
  const holders = [];
  const safe = String(s).replace(/\{[^{}]+\}/g, (m) => {
    holders.push(m);
    return `___VIVINDIS_ICU_${holders.length - 1}___`;
  });
  return { safe, holders };
}

/** Simple `{varName}` placeholders only (not nested ICU plural/select). */
function shieldSimplePlaceholders(s) {
  const holders = [];
  const safe = String(s).replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (m) => {
    holders.push(m);
    return `___VIVINDIS_ICU_${holders.length - 1}___`;
  });
  return { safe, holders };
}

function isComplexIcuMessage(s) {
  return /,\s*plural\s*,|, plural,|, select,|=0\s*\{/.test(String(s));
}

function unshield(s, holders) {
  return String(s).replace(/___VIVINDIS_ICU_(\d+)___/g, (_, i) => holders[Number(i)] ?? "");
}

async function translateLine(text, langpair) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`;
  let attempt = 0;
  for (;;) {
    const res = await fetch(url, { headers: { "User-Agent": "Vivindis-locale-fill/1.0" } });
    if (res.status === 429 && attempt < 8) {
      await sleep(2500 * 2 ** attempt);
      attempt += 1;
      continue;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const out = data?.responseData?.translatedText;
    if (typeof out !== "string" || !out.length) {
      throw new Error("Bad response");
    }
    return out;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const targets = process.argv.slice(2).filter(Boolean);
  if (!targets.length) {
    console.error("Usage: node scripts/fill-locales-from-en.mjs <locale> [...]");
    process.exit(1);
  }

  const en = JSON.parse(readFileSync(join(MESSAGES_DIR, "en.json"), "utf8"));
  const enFlat = flatten(en);

  for (const locale of targets) {
    const my = MYMEMORY_LANG[locale];
    if (!my) {
      console.error(`Unknown locale: ${locale}`);
      process.exit(1);
    }
    const langpair = `en|${my}`;

    const locPath = join(MESSAGES_DIR, `${locale}.json`);
    const loc = JSON.parse(readFileSync(locPath, "utf8"));
    const locFlat = flatten(loc);

    const todo = Object.keys(enFlat).filter((k) => {
      if (locFlat[k] !== enFlat[k] || typeof enFlat[k] !== "string") {
        return false;
      }
      const raw = String(enFlat[k]);
      if (raw.includes("{") && isComplexIcuMessage(raw)) {
        return false;
      }
      return true;
    });
    console.error(`${locale}: translating ${todo.length} keys (of ${Object.keys(enFlat).length})`);

    let n = 0;
    for (const key of todo) {
      const src = enFlat[key];
      const { safe, holders } = String(src).includes("{")
        ? shieldSimplePlaceholders(src)
        : shieldIcu(src);
      let next = src;
      if (safe.trim()) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            let translated = await translateLine(safe, langpair);
            translated = unshield(translated, holders);
            next = translated;
            break;
          } catch (e) {
            if (attempt === 2) {
              console.warn(`${locale} ${key}: ${e.message}`);
            }
            await sleep(1200 * (attempt + 1));
          }
        }
      }
      locFlat[key] = next;
      n++;
      if (n % 25 === 0) {
        console.error(`${locale}: ${n}/${todo.length}`);
      }
      await sleep(950);
    }

    writeFileSync(locPath, `${JSON.stringify(unflatten(locFlat), null, 2)}\n`, "utf8");
    console.error(`Wrote ${locPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
