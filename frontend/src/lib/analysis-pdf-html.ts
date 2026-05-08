/**
 * Analiz sayfası “PDF” çıktısı: print ile kaydedilebilir tek HTML belgesi.
 * Grafiklerle aynı veri kaynaklarını tablo + basit SVG çubuklarla yansıtır.
 */

import {
  overallScoreFromResult,
  ratingsFromResult,
  sentimentFromResult,
  topicsFromResult,
} from "@/lib/analysis-result";
import { buildReviewTimeline, type ReviewTimeBucketMode } from "@/lib/review-time-buckets";
import type { AnalysisDto, InsightsDto } from "@/types/analysis";
import type { ReviewFetchDto, ReviewListItemDto } from "@/types/app";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type AnalysisPdfLocaleStrings = {
  docTitle: string;
  reportHeading: string;
  /** Boşsa zaman çizelgesi uyarısı gösterilmez. */
  timelineTruncatedNote: string;
  labelApp: string;
  labelImportRange: string;
  labelTotalInImport: string;
  labelPageUrl: string;
  labelGenerated: string;
  sectionTimeline: string;
  sectionHeuristic: string;
  sectionAi: string;
  sectionInsights: string;
  sectionReviewDetails: string;
  timelineBucketDay: string;
  timelineBucketWeek: string;
  timelineBucketMonth: string;
  colPeriod: string;
  colCount: string;
  colAvgRating: string;
  colStars: string;
  chartSentiment: string;
  chartRatings: string;
  chartTopics: string;
  overallScore: string;
  colSharePct: string;
  analysisPending: string;
  analysisRunning: string;
  analysisFailed: string;
  analysisEmpty: string;
  modelLabel: string;
  yes: string;
  no: string;
  insightsRelease: string;
  insightsSegments: string;
  insightsAvgRating: string;
  insightsActions: string;
  insightsAlertsTitle: string;
  totalReviews: string;
  ratingLabel: string;
  tonePositive: string;
  toneNeutral: string;
  toneNegative: string;
  platformGooglePlay: string;
  platformAppStore: string;
  insightColMetric: string;
  insightColValue: string;
  insightColDelta: string;
  insightColTitle: string;
  insightColSev: string;
  insightColOn: string;
  insightColDetail: string;
  insightColP: string;
  insightColProblem: string;
  insightColReco: string;
  insightColSegment: string;
  insightColReviews: string;
  insightBenchmarkScores: string;
};

function reviewToneLabel(rating: number, copy: AnalysisPdfLocaleStrings): string {
  if (rating >= 4) {
    return copy.tonePositive;
  }
  if (rating <= 2) {
    return copy.toneNegative;
  }
  return copy.toneNeutral;
}

function stackedBarSvg(
  segments: { label: string; value: number; fill: string }[],
  width: number,
  height: number,
): string {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) {
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="4" y="${height / 2 + 4}" font-size="11" fill="#64748b">—</text></svg>`;
  }
  let x = 0;
  const rects = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const w = Math.max(2, (s.value / total) * width);
      const el = `<rect x="${x}" y="4" width="${w.toFixed(1)}" height="${height - 8}" fill="${s.fill}" rx="2"><title>${escapeHtml(s.label)}: ${s.value}</title></rect>`;
      x += w;
      return el;
    })
    .join("");
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

function verticalBarsSvg(rows: { label: string; value: number }[], maxBar: number, w: number, h: number): string {
  if (rows.length === 0) {
    return "";
  }
  const gap = 6;
  const barW = Math.max(8, (w - gap * (rows.length + 1)) / rows.length);
  let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`;
  rows.forEach((row, i) => {
    const bh = maxBar > 0 ? Math.max(4, (row.value / maxBar) * (h - 24)) : 0;
    const bx = gap + i * (barW + gap);
    const by = h - 16 - bh;
    svg += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="#3b82f6" rx="2"><title>${escapeHtml(row.label)}: ${row.value}</title></rect>`;
    svg += `<text x="${(bx + barW / 2).toFixed(1)}" y="${h - 2}" font-size="9" text-anchor="middle" fill="#475569">${escapeHtml(row.label)}</text>`;
  });
  svg += "</svg>";
  return svg;
}

function analysisRunBlock(
  title: string,
  analysis: AnalysisDto | undefined,
  copy: AnalysisPdfLocaleStrings,
): string {
  let body: string;
  if (!analysis) {
    body = `<p style="color:#64748b;">${escapeHtml(copy.analysisEmpty)}</p>`;
  } else if (analysis.status === "failed") {
    body = `<p style="color:#b91c1c;">${escapeHtml(copy.analysisFailed)}</p>`;
    if (analysis.error_message) {
      body += `<p style="font-size:12px;color:#64748b;">${escapeHtml(analysis.error_message)}</p>`;
    }
  } else if (analysis.status === "pending") {
    body = `<p style="color:#64748b;">${escapeHtml(copy.analysisPending)}</p>`;
  } else if (analysis.status === "running") {
    body = `<p style="color:#64748b;">${escapeHtml(copy.analysisRunning)}</p>`;
  } else if (analysis.status !== "completed" || !analysis.result) {
    body = `<p style="color:#64748b;">${escapeHtml(copy.analysisEmpty)}</p>`;
  } else {
    const result = analysis.result;
    const score = overallScoreFromResult(result);
    const sentiment = sentimentFromResult(result);
    const ratings = ratingsFromResult(result);
    const topics = topicsFromResult(result, 12);
    const sTotal = sentiment.reduce((a, b) => a + b.value, 0);
    const sentPct = sentiment.map((r) => ({
      label: r.name,
      value: r.value,
      fill: r.name === "positive" ? "#16a34a" : r.name === "negative" ? "#dc2626" : "#64748b",
    }));
    const rMax = Math.max(1, ...ratings.map((r) => r.count));
    const ratingBars = ratings.map((r) => ({ label: r.rating, value: r.count }));
    const tMax = Math.max(1, ...topics.map((t) => t.count));
    const topicBars = topics.map((t) => ({ label: t.topic.slice(0, 14), value: t.count }));

    const scoreLine =
      score !== null
        ? `<p style="margin:0 0 12px;font-size:14px;"><strong>${escapeHtml(copy.overallScore)}:</strong> ${score.toFixed(1)}${
            analysis.model_used
              ? ` <span style="color:#64748b;">(${escapeHtml(copy.modelLabel)}: ${escapeHtml(analysis.model_used)})</span>`
              : ""
          }</p>`
        : "";

    const sentTable = `
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin:8px 0;">
        <thead><tr><th style="text-align:left;border-bottom:1px solid #e2e8f0;padding:6px;">${escapeHtml(copy.chartSentiment)}</th>
        <th style="text-align:right;border-bottom:1px solid #e2e8f0;padding:6px;">${escapeHtml(copy.colCount)}</th>
        <th style="text-align:right;border-bottom:1px solid #e2e8f0;padding:6px;">${escapeHtml(copy.colSharePct)}</th></tr></thead>
        <tbody>
        ${sentiment
          .map(
            (r) => `<tr><td style="padding:4px 6px;">${escapeHtml(r.name)}</td>
            <td style="text-align:right;padding:4px 6px;">${r.value}</td>
            <td style="text-align:right;padding:4px 6px;">${sTotal > 0 ? ((100 * r.value) / sTotal).toFixed(1) : "0.0"}%</td></tr>`,
          )
          .join("")}
        </tbody></table>`;

    const sentBar = stackedBarSvg(sentPct, 420, 28);

    const ratTable = `
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin:8px 0;">
        <thead><tr><th style="text-align:left;border-bottom:1px solid #e2e8f0;padding:6px;">${escapeHtml(copy.chartRatings)}</th>
        <th style="text-align:right;border-bottom:1px solid #e2e8f0;padding:6px;">${escapeHtml(copy.colCount)}</th></tr></thead>
        <tbody>
        ${ratings
          .map(
            (r) => `<tr><td style="padding:4px 6px;">${escapeHtml(r.rating)} ★</td>
            <td style="text-align:right;padding:4px 6px;">${r.count}</td></tr>`,
          )
          .join("")}
        </tbody></table>`;
    const ratSvg = verticalBarsSvg(ratingBars, rMax, 420, 100);

    const topTable =
      topics.length > 0
        ? `
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin:8px 0;">
        <thead><tr><th style="text-align:left;border-bottom:1px solid #e2e8f0;padding:6px;">${escapeHtml(copy.chartTopics)}</th>
        <th style="text-align:right;border-bottom:1px solid #e2e8f0;padding:6px;">${escapeHtml(copy.colCount)}</th></tr></thead>
        <tbody>
        ${topics.map((r) => `<tr><td style="padding:4px 6px;">${escapeHtml(r.topic)}</td><td style="text-align:right;padding:4px 6px;">${r.count}</td></tr>`).join("")}
        </tbody></table>
        ${verticalBarsSvg(topicBars, tMax, 420, 120)}`
        : `<p style="color:#64748b;font-size:12px;">—</p>`;

    body = `
      ${scoreLine}
      <h4 style="margin:16px 0 6px;font-size:13px;">${escapeHtml(copy.chartSentiment)}</h4>
      ${sentBar}
      ${sentTable}
      <h4 style="margin:16px 0 6px;font-size:13px;">${escapeHtml(copy.chartRatings)}</h4>
      ${ratSvg}
      ${ratTable}
      <h4 style="margin:16px 0 6px;font-size:13px;">${escapeHtml(copy.chartTopics)}</h4>
      ${topTable}`;
  }

  return `<section style="margin:20px 0;padding:16px;border:1px solid #e2e8f0;border-radius:12px;page-break-inside:avoid;">
    <h3 style="margin:0 0 12px;font-size:16px;">${escapeHtml(title)}</h3>
    ${body}
  </section>`;
}

function timelineSection(
  reviews: ReviewListItemDto[] | null,
  locale: string,
  copy: AnalysisPdfLocaleStrings,
): string {
  if (!reviews || reviews.length === 0) {
    return `<section style="margin:20px 0;"><h2 style="font-size:18px;">${escapeHtml(copy.sectionTimeline)}</h2>
      <p style="color:#64748b;">—</p></section>`;
  }
  const modes: { mode: ReviewTimeBucketMode; label: string }[] = [
    { mode: "day", label: copy.timelineBucketDay },
    { mode: "week", label: copy.timelineBucketWeek },
    { mode: "month", label: copy.timelineBucketMonth },
  ];
  const note = copy.timelineTruncatedNote
    ? `<p style="font-size:11px;color:#b45309;">${escapeHtml(copy.timelineTruncatedNote)}</p>`
    : "";

  const tables = modes
    .map(({ mode, label }) => {
      const rows = buildReviewTimeline(reviews, mode, locale);
      const tableBody = rows
        .map(
          (r) => `<tr>
          <td style="padding:4px 6px;border-bottom:1px solid #f1f5f9;">${escapeHtml(r.label)}</td>
          <td style="text-align:right;padding:4px 6px;border-bottom:1px solid #f1f5f9;">${r.count}</td>
          <td style="text-align:right;padding:4px 6px;border-bottom:1px solid #f1f5f9;">${r.avgRating.toFixed(2)}</td>
          <td style="font-size:10px;padding:4px 6px;border-bottom:1px solid #f1f5f9;">${r.r1}/${r.r2}/${r.r3}/${r.r4}/${r.r5}</td>
        </tr>`,
        )
        .join("");
      return `<h4 style="margin:14px 0 6px;font-size:13px;">${escapeHtml(label)}</h4>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;">
          <thead><tr>
            <th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.colPeriod)}</th>
            <th style="text-align:right;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.colCount)}</th>
            <th style="text-align:right;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.colAvgRating)}</th>
            <th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.colStars)}</th>
          </tr></thead>
          <tbody>${tableBody}</tbody>
        </table>`;
    })
    .join("");

  return `<section style="margin:20px 0;page-break-inside:avoid;">
    <h2 style="font-size:18px;margin-bottom:8px;">${escapeHtml(copy.sectionTimeline)}</h2>
    ${note}
    ${tables}
  </section>`;
}

function insightsSection(insights: InsightsDto | undefined, copy: AnalysisPdfLocaleStrings): string {
  if (!insights) {
    return `<section style="margin:20px 0;"><h2 style="font-size:18px;">${escapeHtml(copy.sectionInsights)}</h2>
      <p style="color:#64748b;">—</p></section>`;
  }
  const scoresRows = insights.benchmark.scores
    .map(
      (s) => `<tr>
      <td style="padding:6px;border-bottom:1px solid #f1f5f9;">${escapeHtml(s.label)}</td>
      <td style="text-align:right;padding:6px;border-bottom:1px solid #f1f5f9;">${s.value.toFixed(2)}</td>
      <td style="text-align:right;padding:6px;border-bottom:1px solid #f1f5f9;">${s.delta_vs_category.toFixed(2)} (${s.direction})</td>
    </tr>`,
    )
    .join("");

  const alertsRows = insights.alerts
    .map(
      (a) => `<tr>
      <td style="padding:6px;border-bottom:1px solid #f1f5f9;">${escapeHtml(a.title)}</td>
      <td style="padding:6px;border-bottom:1px solid #f1f5f9;">${escapeHtml(a.severity)}</td>
      <td style="padding:6px;border-bottom:1px solid #f1f5f9;">${a.triggered ? escapeHtml(copy.yes) : escapeHtml(copy.no)}</td>
      <td style="padding:6px;border-bottom:1px solid #f1f5f9;font-size:11px;">${escapeHtml(a.detail)}</td>
    </tr>`,
    )
    .join("");

  const actionsRows = insights.actions
    .map(
      (a) => `<tr>
      <td style="padding:6px;border-bottom:1px solid #f1f5f9;">${escapeHtml(a.priority)}</td>
      <td style="padding:6px;border-bottom:1px solid #f1f5f9;">${escapeHtml(a.problem)}</td>
      <td style="padding:6px;border-bottom:1px solid #f1f5f9;font-size:11px;">${escapeHtml(a.recommendation)}</td>
    </tr>`,
    )
    .join("");

  const segRows = insights.segments
    .map(
      (s) => `<tr>
      <td style="padding:6px;border-bottom:1px solid #f1f5f9;">${escapeHtml(s.segment)}</td>
      <td style="text-align:right;padding:6px;border-bottom:1px solid #f1f5f9;">${s.reviews}</td>
      <td style="text-align:right;padding:6px;border-bottom:1px solid #f1f5f9;">${s.avg_rating.toFixed(2)}</td>
    </tr>`,
    )
    .join("");

  const rel = insights.release_impact;

  return `<section style="margin:20px 0;page-break-inside:avoid;">
    <h2 style="font-size:18px;margin-bottom:12px;">${escapeHtml(copy.sectionInsights)}</h2>
    <p style="font-size:12px;color:#64748b;">${escapeHtml(insights.benchmark.app_name)} · ${escapeHtml(insights.benchmark.category)} (n=${insights.benchmark.category_sample_apps})</p>
    <h4 style="margin:14px 0 6px;">${escapeHtml(copy.insightBenchmarkScores)}</h4>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.insightColMetric)}</th>
      <th style="text-align:right;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.insightColValue)}</th>
      <th style="text-align:right;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.insightColDelta)}</th></tr></thead>
      <tbody>${scoresRows}</tbody>
    </table>
    <h4 style="margin:14px 0 6px;">${escapeHtml(copy.insightsAlertsTitle)}</h4>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead><tr><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.insightColTitle)}</th>
      <th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.insightColSev)}</th>
      <th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.insightColOn)}</th>
      <th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.insightColDetail)}</th></tr></thead>
      <tbody>${alertsRows}</tbody>
    </table>
    <h4 style="margin:14px 0 6px;">${escapeHtml(copy.insightsActions)}</h4>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead><tr><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.insightColP)}</th>
      <th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.insightColProblem)}</th>
      <th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.insightColReco)}</th></tr></thead>
      <tbody>${actionsRows}</tbody>
    </table>
    <h4 style="margin:14px 0 6px;">${escapeHtml(copy.insightsRelease)}</h4>
    <p style="font-size:12px;">${escapeHtml(rel.summary)}</p>
    <p style="font-size:11px;color:#64748b;">${escapeHtml(rel.current_version ?? "—")} vs ${escapeHtml(rel.previous_version ?? "—")} · Δ ${rel.rating_delta !== null ? rel.rating_delta.toFixed(2) : "—"}</p>
    <h4 style="margin:14px 0 6px;">${escapeHtml(copy.insightsSegments)}</h4>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead><tr><th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.insightColSegment)}</th>
      <th style="text-align:right;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.insightColReviews)}</th>
      <th style="text-align:right;border-bottom:1px solid #cbd5e1;padding:6px;">${escapeHtml(copy.insightsAvgRating)}</th></tr></thead>
      <tbody>${segRows}</tbody>
    </table>
  </section>`;
}

function reviewArticles(rows: ReviewListItemDto[], copy: AnalysisPdfLocaleStrings): string {
  return rows
    .map((row, idx) => {
      const platformLabel =
        row.platform === "google_play" ? copy.platformGooglePlay : copy.platformAppStore;
      const meta = `#${idx + 1} | ${escapeHtml(platformLabel)} | ${escapeHtml(copy.ratingLabel)}: ${row.rating} | ${escapeHtml(row.review_date)} | ${escapeHtml(reviewToneLabel(row.rating, copy))}`;
      return `<article style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin:10px 0;page-break-inside:avoid;">
        <p style="font-size:12px;color:#64748b;">${meta}</p>
        ${row.title ? `<h3 style="font-size:14px;margin:6px 0;">${escapeHtml(row.title)}</h3>` : ""}
        <p style="font-size:13px;white-space:pre-wrap;">${escapeHtml(row.body)}</p>
      </article>`;
    })
    .join("");
}

export type BuildFullAnalysisPdfParams = {
  copy: AnalysisPdfLocaleStrings;
  appName: string;
  fetch: ReviewFetchDto;
  pageUrl: string;
  generatedAtLabel: string;
  timelineReviews: ReviewListItemDto[] | null;
  timelineLocale: string;
  heuristic: AnalysisDto | undefined;
  ai: AnalysisDto | undefined;
  insights: InsightsDto | undefined;
  reviewRows: ReviewListItemDto[];
};

export function buildFullAnalysisPdfHtml(p: BuildFullAnalysisPdfParams): string {
  const { copy, appName, fetch, pageUrl, generatedAtLabel, timelineReviews, timelineLocale, heuristic, ai, insights, reviewRows } = p;

  const meta = `
    <div style="margin-bottom:20px;padding:14px;background:#f8fafc;border-radius:12px;font-size:12px;line-height:1.6;">
      <p style="margin:0;"><strong>${escapeHtml(copy.labelApp)}</strong> ${escapeHtml(appName)}</p>
      <p style="margin:4px 0 0;"><strong>${escapeHtml(copy.labelImportRange)}</strong> ${escapeHtml(fetch.from_date)} → ${escapeHtml(fetch.to_date)}</p>
      <p style="margin:4px 0 0;"><strong>${escapeHtml(copy.labelTotalInImport)}</strong> ${fetch.review_count}</p>
      <p style="margin:4px 0 0;"><strong>${escapeHtml(copy.labelPageUrl)}</strong> <a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a></p>
      <p style="margin:4px 0 0;"><strong>${escapeHtml(copy.labelGenerated)}</strong> ${escapeHtml(generatedAtLabel)}</p>
    </div>`;

  const timeline = timelineSection(timelineReviews, timelineLocale, copy);
  const heur = analysisRunBlock(copy.sectionHeuristic, heuristic, copy);
  const aiBlock = analysisRunBlock(copy.sectionAi, ai, copy);
  const ins = insightsSection(insights, copy);

  const listHeading = `<h2 style="font-size:18px;margin:24px 0 8px;">${escapeHtml(copy.sectionReviewDetails)}</h2>
    <p style="font-size:13px;margin-bottom:12px;">${escapeHtml(copy.totalReviews.replace("{count}", String(reviewRows.length)))}</p>`;

  const articles = reviewArticles(reviewRows, copy);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(copy.docTitle)}</title></head>
  <body style="font-family:Arial,Helvetica,sans-serif;padding:24px;color:#0f172a;max-width:900px;margin:0 auto;">
    <h1 style="font-size:22px;margin:0 0 8px;">${escapeHtml(copy.reportHeading)}</h1>
    ${meta}
    ${timeline}
    ${heur}
    ${aiBlock}
    ${ins}
    ${listHeading}
    ${articles}
  </body></html>`;
}

export function openHtmlPrintWindow(html: string): Window | null {
  const win = window.open("", "_blank");
  if (!win) {
    return null;
  }
  win.document.write(html);
  win.document.close();
  win.print();
  return win;
}
