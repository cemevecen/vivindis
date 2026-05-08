/**
 * Tüm `src/messages/*.json` dosyalarında aynı düzleştirilmiş anahtar kümesinin
 * bulunduğunu doğrular. Eksik veya fazla anahtar varsa çıkış kodu 1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..", "src", "messages");

/** @param {Record<string, unknown>} obj */
function flatten(obj, prefix = "") {
  /** @type {Record<string, string>} */
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(/** @type {Record<string, unknown>} */ (v), p));
    } else {
      out[p] = String(v);
    }
  }
  return out;
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.error("check-i18n-parity: no JSON files in", dir);
  process.exit(1);
}

/** @type {Record<string, Record<string, string>>} */
const perFile = {};
const allKeys = new Set();

for (const f of files) {
  const raw = fs.readFileSync(path.join(dir, f), "utf8");
  const flat = flatten(JSON.parse(raw));
  perFile[f] = flat;
  for (const k of Object.keys(flat)) {
    allKeys.add(k);
  }
}

const sortedKeys = [...allKeys].sort();
let ok = true;

for (const f of [...files].sort()) {
  const have = new Set(Object.keys(perFile[f]));
  const missing = sortedKeys.filter((k) => !have.has(k));
  const extra = [...have].filter((k) => !allKeys.has(k)).sort();
  if (missing.length > 0 || extra.length > 0) {
    ok = false;
    console.error(`\n${f}:`);
    if (missing.length > 0) {
      console.error(`  missing (${missing.length}):`, missing.join(", "));
    }
    if (extra.length > 0) {
      console.error(`  extra (${extra.length}):`, extra.join(", "));
    }
  }
}

if (!ok) {
  console.error(`\ncheck-i18n-parity: expected ${sortedKeys.length} keys in every locale (union).`);
  process.exit(1);
}

console.log(`check-i18n-parity: OK — ${files.length} locales, ${sortedKeys.length} keys each.`);
