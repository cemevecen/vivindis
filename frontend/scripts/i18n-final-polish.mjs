/**
 * Son cilalar: bozuk ICU placeholder’ları, EN kalıntıları, eksik çeviriler.
 * frontend/ içinde: node scripts/i18n-final-polish.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..", "src", "messages");

function deepMerge(target, patch) {
  const out = { ...target };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const tv = target[k];
    if (pv !== null && typeof pv === "object" && !Array.isArray(pv) && tv !== null && typeof tv === "object" && !Array.isArray(tv)) {
      out[k] = deepMerge(tv, pv);
    } else {
      out[k] = pv;
    }
  }
  return out;
}

/** @type {Record<string, Record<string, unknown>>} */
const PATCHES = {
  de: {
    apps: {
      pairBannerIntro:
        "Sie haben diese App zusammen mit {name} erstellt. Öffnen Sie die Partner-App oder vergleichen Sie beide.",
      deleteConfirm: "„{name}“ löschen? Dadurch werden auch zugehörige Bewertungen und Analysen entfernt.",
    },
    analysis: {
      timelineTruncatedHint:
        "Diagramme nutzen höchstens {loaded} von {total} Bewertungen (Leistungsgrenze).",
    },
    dashboard: {
      loadError: "Apps konnten nicht geladen werden.",
    },
    compare: {
      emptyDescription:
        "Wählen Sie zwei Apps unter Analyse → Apps vergleichen, oder öffnen Sie diese Seite mit ?app_a=UUID&app_b=UUID. PDF- und Seitenansichten werden hier weiter ausgebaut; Kurzlinks und Importstatus sind schon verfügbar.",
      splitViewOff: "Übersichtskarten",
    },
    analyzeHub: {
      appsLoadError: "Apps konnten nicht geladen werden.",
      compareMixedCreatedOne: "„{created}“ hinzugefügt. Vergleich wird mit „{existing}“ geöffnet.",
      sessionAppLinkedHint:
        "Im Store-Tab angeheftete App „{name}“ ist als Ziel ausgewählt.",
      openStoreLink: "Im Store öffnen",
    },
    about: {
      p2: "Der Analyse-Hub bildet einen vertrauten Ein-Screen-Ablauf ab: Store-Suche, Datei- und Einfüge-Import sowie ein Schritt mit zwei Apps für den Vergleich — auf Basis von FastAPI, Celery und Next.js statt Streamlit.",
      p3: "Exporte: Die Analyseseite bietet JSON, CSV, Excel und einen druckbaren Gesamtbericht (PDF über den Druckdialog des Browsers) mit Diagrammen, Insights und Review-Texten.",
      p4: "Geheimnisse und API-Schlüssel liegen nur in Umgebungsvariablen auf Railway und Vercel; niemals ins Git committen.",
    },
  },
  fr: {
    analysis: {
      sentiment: "Sentiments",
      csvHeaderSentiment: "sentiment",
    },
    analyzeHub: {
      reviewScopeLocal: "local",
    },
  },
  it: {
    navigation: {
      dashboard: "Pannello",
    },
    apps: {
      detailTitle: "Applicazione",
    },
    compare: {
      slotA: "App A",
      slotB: "App B",
    },
    errors: {
      boundaryHome: "Inizio",
    },
    analysis: {
      sentiment: "Sentiment",
      csvHeaderSentiment: "sentimento",
      pdfLabelApp: "App:",
      pdfNo: "No",
    },
    analyzeHub: {
      tabFile: "file",
      platformIos: "iOS",
    },
  },
  es: {
    dashboard: {
      appsCount: "{count, plural, =0 {Sin aplicaciones} one {# aplicación} other {# aplicaciones}}",
    },
    apps: {
      detailTitle: "Aplicación",
      title: "Aplicaciones",
      fetchError: "Error",
      status: "Estado",
    },
    compare: {
      slotA: "App A",
      slotB: "App B",
    },
    navigation: {
      apps: "Aplicaciones",
    },
    analysis: {
      filterNeutral: "Neutro",
      toneNeutral: "neutro",
      pdfLabelApp: "App:",
      pdfNo: "No",
      pdfReviewMeta: "#{index} | {platform} | {ratingLabel}: {rating} | {date} | {tone}",
    },
    analyzeHub: {
      platformIos: "iOS",
      reviewScopeGlobal: "global",
      reviewScopeLocal: "local",
    },
  },
  pt: {
    dashboard: {
      appsCount: "{count, plural, =0 {Sem aplicativos} one {# aplicativo} other {# aplicativos}}",
    },
    apps: {
      detailTitle: "Aplicativo",
      title: "Aplicativos",
      platformGooglePlay: "Google Play",
    },
    compare: {
      slotA: "App A",
      slotB: "App B",
    },
    navigation: {
      apps: "Aplicativos",
    },
    analysis: {
      pdfLabelApp: "App:",
      pdfReviewMeta: "#{index} | {platform} | {ratingLabel}: {rating} | {date} | {tone}",
    },
    analyzeHub: {
      platformAndroid: "Android",
      platformIos: "iOS",
      reviewScopeGlobal: "global",
      reviewScopeLocal: "local",
    },
  },
  ru: {
    analysis: {
      pdfReviewMeta: "#{index} | {platform} | {ratingLabel}: {rating} | {date} | {tone}",
    },
    analyzeHub: {
      platformIos: "iOS",
      ratingShort: "{score} / 5",
      progressPlaceholderUnknown: "—",
    },
  },
  ja: {
    analysis: {
      csvHeaderPlatform: "プラットフォーム",
      csvHeaderReviewDate: "レビュー日",
      csvHeaderSentiment: "センチメント",
      exportCsvAi: "AI — CSV",
      exportJsonAi: "AI — JSON",
      pdfReviewMeta: "#{index} | {platform} | {ratingLabel}: {rating} | {date} | {tone}",
    },
    analyzeHub: {
      csvHeaderPlatform: "プラットフォーム",
      csvHeaderReviewDate: "レビュー日",
      platformIos: "iOS",
      ratingShort: "{score} / 5",
      progressPlaceholderUnknown: "—",
    },
  },
  zh: {
    analysis: {
      csvHeaderPlatform: "平台",
      csvHeaderReviewDate: "评论日期",
      csvHeaderSentiment: "情感倾向",
      exportCsvAi: "AI — CSV",
      exportJsonAi: "AI — JSON",
      pdfReviewMeta: "#{index} | {platform} | {ratingLabel}: {rating} | {date} | {tone}",
    },
    analyzeHub: {
      csvHeaderPlatform: "平台",
      csvHeaderReviewDate: "评论日期",
      ratingShort: "{score} / 5",
      progressPlaceholderUnknown: "—",
    },
  },
  ar: {
    analysis: {
      pdfReviewMeta: "#{index} | {platform} | {ratingLabel}: {rating} | {date} | {tone}",
    },
    analyzeHub: {
      ratingShort: "{score} / 5",
      progressPlaceholderUnknown: "—",
    },
  },
  sw: {
    analysis: {
      ai: "Akili bandia (Gemini)",
      exportCsvAi: "Akili bandia — CSV",
      exportJsonAi: "Akili bandia — JSON",
      pdfReviewMeta: "#{index} | {platform} | {ratingLabel}: {rating} | {date} | {tone}",
    },
    analyzeHub: {
      platformAndroid: "Android",
      platformIos: "iOS",
      ratingShort: "{score} / 5",
      progressPlaceholderUnknown: "—",
    },
    apps: {
      platformGooglePlay: "Google Play",
    },
  },
  tr: {
    analysis: {
      csvHeaderPlatform: "platform",
      csvHeaderReviewDate: "review_date",
      csvHeaderSentiment: "duygu",
      pdfInsightColSegment: "Kullanıcı segmenti",
      pdfReviewMeta: "#{index} | {platform} | {ratingLabel}: {rating} | {date} | {tone}",
    },
    analyzeHub: {
      csvHeaderPlatform: "platform",
      csvHeaderReviewDate: "review_date",
      platformAndroid: "Android",
      platformIos: "iOS",
      platformRowLabel: "Platform",
      ratingShort: "{score} / 5",
      progressPlaceholderUnknown: "—",
      reviewScopeGlobal: "küresel",
    },
    apps: {
      platform: "Platform",
      platformAppStore: "App Store",
      platformGooglePlay: "Google Play",
    },
  },
};

for (const [locale, patch] of Object.entries(PATCHES)) {
  const fp = path.join(dir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(fp, "utf8"));
  const merged = deepMerge(data, patch);
  fs.writeFileSync(fp, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  console.log("polished", locale);
}
