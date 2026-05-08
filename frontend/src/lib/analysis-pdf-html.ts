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
import { defaultTimelineBucket } from "@/lib/timeline-bucket-defaults";
import {
  buildReviewTimeline,
  buildReviewTimelineWithFlags,
  hasAnyTimelineChart,
  type ReviewTimeBucketMode,
  type ReviewTimelineRow,
} from "@/lib/review-time-buckets";
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
  timelineBucketYear: string;
  timelineVolumeTitle: string;
  timelineStarsStackTitle: string;
  timelineAvgRatingTitle: string;
  pdfChartsDeckTitle: string;
  pdfAppendixDetails: string;
  pdfTableSubtitle: string;
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

const PDF_TIMELINE_STAR_FILLS = ["#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#2563eb"] as const;

function samplePdfTimelineRows<T>(rows: T[], max: number): T[] {
  if (rows.length <= max) {
    return rows;
  }
  const out: T[] = [];
  const step = (rows.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    out.push(rows[Math.min(rows.length - 1, Math.round(i * step))]!);
  }
  return out;
}

function bucketPdfLabel(mode: ReviewTimeBucketMode, copy: AnalysisPdfLocaleStrings): string {
  if (mode === "day") {
    return copy.timelineBucketDay;
  }
  if (mode === "week") {
    return copy.timelineBucketWeek;
  }
  if (mode === "month") {
    return copy.timelineBucketMonth;
  }
  return copy.timelineBucketYear;
}

function pdfTimelineVolumeBarsSvg(rows: ReviewTimelineRow[], w: number, h: number): string {
  const n = rows.length;
  if (n === 0) {
    return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><text x="4" y="${h / 2}" font-size="11" fill="#64748b">—</text></svg>`;
  }
  const maxC = Math.max(1, ...rows.map((r) => r.count));
  const bottom = h - 18;
  const gap = 4;
  const barW = Math.max(5, (w - gap * (n + 1)) / n);
  let s = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`;
  rows.forEach((row, i) => {
    const bh = (row.count / maxC) * (bottom - 8);
    const bx = gap + i * (barW + gap);
    const by = bottom - bh;
    s += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="#3b82f6" rx="2"><title>${escapeHtml(row.label)}: ${row.count}</title></rect>`;
  });
  s += "</svg>";
  return s;
}

function pdfTimelineStackedStarsSvg(rows: ReviewTimelineRow[], w: number, h: number): string {
  const n = rows.length;
  if (n === 0) {
    return "";
  }
  const maxC = Math.max(1, ...rows.map((r) => r.count));
  const bottom = h - 14;
  const topPad = 6;
  const stackMaxH = bottom - topPad;
  const gap = 4;
  const barW = Math.max(5, (w - gap * (n + 1)) / n);
  let s = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`;
  rows.forEach((row, i) => {
    const bx = gap + i * (barW + gap);
    const stackH = row.count > 0 ? (row.count / maxC) * stackMaxH : 0;
    let y = bottom;
    const parts: [number, string][] = [
      [row.r5, PDF_TIMELINE_STAR_FILLS[4]],
      [row.r4, PDF_TIMELINE_STAR_FILLS[3]],
      [row.r3, PDF_TIMELINE_STAR_FILLS[2]],
      [row.r2, PDF_TIMELINE_STAR_FILLS[1]],
      [row.r1, PDF_TIMELINE_STAR_FILLS[0]],
    ];
    for (const [cnt, fill] of parts) {
      if (cnt <= 0 || row.count <= 0) {
        continue;
      }
      const segH = (cnt / row.count) * stackH;
      y -= segH;
      s += `<rect x="${bx.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${segH.toFixed(1)}" fill="${fill}"/>`;
    }
  });
  s += "</svg>";
  return s;
}

function pdfTimelineAvgLineSvg(rows: ReviewTimelineRow[], w: number, h: number): string {
  if (rows.length === 0) {
    return "";
  }
  const padT = 12;
  const padB = 10;
  const innerH = h - padT - padB;
  const pts = rows.map((r, i) => {
    const x = rows.length === 1 ? w / 2 : 6 + (i / (rows.length - 1)) * (w - 12);
    const y = padT + innerH * (1 - r.avgRating / 5);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const dots = rows
    .map((r, i) => {
      const x = rows.length === 1 ? w / 2 : 6 + (i / (rows.length - 1)) * (w - 12);
      const y = padT + innerH * (1 - r.avgRating / 5);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#2563eb"><title>${r.avgRating.toFixed(2)}</title></circle>`;
    })
    .join("");
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#2563eb" stroke-width="2" points="${pts.join(
    " ",
  )}"/>${dots}</svg>`;
}

function timelineChartsSection(
  reviews: ReviewListItemDto[] | null,
  locale: string,
  copy: AnalysisPdfLocaleStrings,
  fetchFromDate: string,
  fetchToDate: string,
): string {
  if (!reviews || reviews.length === 0) {
    return "";
  }
  const { defaultMode } = defaultTimelineBucket(fetchFromDate, fetchToDate);
  const { rows: rawRows, flags } = buildReviewTimelineWithFlags(reviews, defaultMode, locale);
  if (!hasAnyTimelineChart(flags)) {
    return "";
  }
  const bucketTitle = bucketPdfLabel(defaultMode, copy);
  const rows = samplePdfTimelineRows(rawRows, 52);
  const chartW = 760;
  const note = copy.timelineTruncatedNote
    ? `<p style="font-size:11px;color:#b45309;margin:0 0 10px;">${escapeHtml(copy.timelineTruncatedNote)}</p>`
    : "";
  const chunks: string[] = [
    `<section style="margin:12px 0;padding:12px;border:1px solid #e2e8f0;border-radius:12px;page-break-inside:avoid;">
    <h3 style="margin:0 0 6px;font-size:16px;">${escapeHtml(copy.sectionTimeline)} <span style="color:#64748b;font-weight:600;">(${escapeHtml(bucketTitle)})</span></h3>
    ${note}`,
  ];
  if (flags.showVolume) {
    chunks.push(
      `<h4 style="margin:12px 0 6px;font-size:13px;">${escapeHtml(copy.timelineVolumeTitle)}</h4>
    ${pdfTimelineVolumeBarsSvg(rows, chartW, 130)}`,
    );
  }
  if (flags.showStarsStack) {
    chunks.push(
      `<h4 style="margin:12px 0 6px;font-size:13px;">${escapeHtml(copy.timelineStarsStackTitle)}</h4>
    ${pdfTimelineStackedStarsSvg(rows, chartW, 150)}`,
    );
  }
  if (flags.showAvgRating) {
    chunks.push(
      `<h4 style="margin:12px 0 6px;font-size:13px;">${escapeHtml(copy.timelineAvgRatingTitle)}</h4>
    ${pdfTimelineAvgLineSvg(rows, chartW, 110)}`,
    );
  }
  chunks.push(`</section>`);
  return chunks.join("");
}

function splitAnalysisRun(
  title: string,
  analysis: AnalysisDto | undefined,
  copy: AnalysisPdfLocaleStrings,
): { chartsSection: string; tablesSection: string } {
  const wrapCharts = (inner: string) =>
    `<section style="margin:12px 0;padding:12px;border:1px solid #e2e8f0;border-radius:12px;page-break-inside:avoid;">
    <h3 style="margin:0 0 10px;font-size:16px;">${escapeHtml(title)}</h3>
    ${inner}
  </section>`;

  if (!analysis) {
    return { chartsSection: wrapCharts(`<p style="color:#64748b;">${escapeHtml(copy.analysisEmpty)}</p>`), tablesSection: "" };
  }
  if (analysis.status === "failed") {
    let body = `<p style="color:#b91c1c;">${escapeHtml(copy.analysisFailed)}</p>`;
    if (analysis.error_message) {
      body += `<p style="font-size:12px;color:#64748b;">${escapeHtml(analysis.error_message)}</p>`;
    }
    return { chartsSection: wrapCharts(body), tablesSection: "" };
  }
  if (analysis.status === "pending") {
    return {
      chartsSection: wrapCharts(`<p style="color:#64748b;">${escapeHtml(copy.analysisPending)}</p>`),
      tablesSection: "",
    };
  }
  if (analysis.status === "running") {
    return {
      chartsSection: wrapCharts(`<p style="color:#64748b;">${escapeHtml(copy.analysisRunning)}</p>`),
      tablesSection: "",
    };
  }
  if (analysis.status !== "completed" || !analysis.result) {
    return { chartsSection: wrapCharts(`<p style="color:#64748b;">${escapeHtml(copy.analysisEmpty)}</p>`), tablesSection: "" };
  }

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

  const topicTableOnly =
    topics.length > 0
      ? `
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin:8px 0;">
        <thead><tr><th style="text-align:left;border-bottom:1px solid #e2e8f0;padding:6px;">${escapeHtml(copy.chartTopics)}</th>
        <th style="text-align:right;border-bottom:1px solid #e2e8f0;padding:6px;">${escapeHtml(copy.colCount)}</th></tr></thead>
        <tbody>
        ${topics.map((r) => `<tr><td style="padding:4px 6px;">${escapeHtml(r.topic)}</td><td style="text-align:right;padding:4px 6px;">${r.count}</td></tr>`).join("")}
        </tbody></table>`
      : `<p style="color:#64748b;font-size:12px;">—</p>`;

  const topicSvg = topics.length > 0 ? verticalBarsSvg(topicBars, tMax, 420, 120) : "";

  const chartsInner = `
      ${scoreLine}
      <h4 style="margin:16px 0 6px;font-size:13px;">${escapeHtml(copy.chartSentiment)}</h4>
      ${sentBar}
      <h4 style="margin:16px 0 6px;font-size:13px;">${escapeHtml(copy.chartRatings)}</h4>
      ${ratSvg}
      <h4 style="margin:16px 0 6px;font-size:13px;">${escapeHtml(copy.chartTopics)}</h4>
      ${topicSvg || `<p style="color:#64748b;font-size:12px;">—</p>`}`;

  const tablesInner = `${sentTable}${ratTable}${topicTableOnly}`;

  const tablesSection = `<section style="margin:12px 0;padding:12px;border:1px solid #e5e7eb;border-radius:12px;page-break-inside:avoid;">
    <h4 style="margin:0 0 8px;font-size:14px;color:#334155;">${escapeHtml(title)} — ${escapeHtml(copy.pdfTableSubtitle)}</h4>
    ${tablesInner}
  </section>`;

  return { chartsSection: wrapCharts(chartsInner), tablesSection };
}

/** Tüm zaman dilimlerinde tablolar (PDF ek bölümü). */
function timelineTablesAppendix(
  reviews: ReviewListItemDto[] | null,
  locale: string,
  copy: AnalysisPdfLocaleStrings,
  fetchFromDate: string,
  fetchToDate: string,
): string {
  if (!reviews || reviews.length === 0) {
    return "";
  }
  const { defaultMode } = defaultTimelineBucket(fetchFromDate, fetchToDate);
  const { flags: defaultFlags } = buildReviewTimelineWithFlags(reviews, defaultMode, locale);
  if (!hasAnyTimelineChart(defaultFlags)) {
    return "";
  }
  const modes: { mode: ReviewTimeBucketMode; label: string }[] = [
    { mode: "day", label: copy.timelineBucketDay },
    { mode: "week", label: copy.timelineBucketWeek },
    { mode: "month", label: copy.timelineBucketMonth },
  ];
  if (fetchFromDate === "2000-01-01") {
    modes.push({ mode: "year", label: copy.timelineBucketYear });
  }
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

  return `<section style="margin:12px 0;page-break-inside:avoid;">
    <h3 style="font-size:17px;margin:0 0 8px;">${escapeHtml(copy.sectionTimeline)}</h3>
    ${note}
    ${tables}
  </section>`;
}

function insightsSection(insights: InsightsDto | undefined, copy: AnalysisPdfLocaleStrings): string {
  if (!insights) {
    return "";
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

  return `<section style="margin:12px 0;page-break-inside:avoid;">
    <h3 style="font-size:17px;margin:0 0 10px;">${escapeHtml(copy.sectionInsights)}</h3>
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
      return `<article style="border:1px solid #e5e7eb;border-radius:12px;padding:10px;margin:8px 0;page-break-inside:avoid;">
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
    <div style="margin:14px 0;padding:12px;background:#f8fafc;border-radius:12px;font-size:12px;line-height:1.55;">
      <p style="margin:0;"><strong>${escapeHtml(copy.labelApp)}</strong> ${escapeHtml(appName)}</p>
      <p style="margin:3px 0 0;"><strong>${escapeHtml(copy.labelImportRange)}</strong> ${escapeHtml(fetch.from_date)} → ${escapeHtml(fetch.to_date)}</p>
      <p style="margin:3px 0 0;"><strong>${escapeHtml(copy.labelTotalInImport)}</strong> ${fetch.review_count}</p>
      <p style="margin:3px 0 0;"><strong>${escapeHtml(copy.labelPageUrl)}</strong> <a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a></p>
      <p style="margin:3px 0 0;"><strong>${escapeHtml(copy.labelGenerated)}</strong> ${escapeHtml(generatedAtLabel)}</p>
    </div>`;

  const timelineCharts = timelineChartsSection(timelineReviews, timelineLocale, copy, fetch.from_date, fetch.to_date);
  const heurParts = splitAnalysisRun(copy.sectionHeuristic, heuristic, copy);
  const aiHasResult = Boolean(ai?.status === "completed" && ai.result);
  const aiParts = aiHasResult ? splitAnalysisRun(copy.sectionAi, ai, copy) : { chartsSection: "", tablesSection: "" };
  const timelineTables = timelineTablesAppendix(
    timelineReviews,
    timelineLocale,
    copy,
    fetch.from_date,
    fetch.to_date,
  );
  const ins = insightsSection(insights, copy);

  const listHeading = `<h2 style="font-size:18px;margin:18px 0 6px;">${escapeHtml(copy.sectionReviewDetails)}</h2>
    <p style="font-size:13px;margin:0 0 10px;">${escapeHtml(copy.totalReviews.replace("{count}", String(reviewRows.length)))}</p>`;

  const articles = reviewArticles(reviewRows, copy);

  const chartPieces = [timelineCharts, heurParts.chartsSection, aiParts.chartsSection].filter((s) => s.length > 0);
  const chartsDeck =
    chartPieces.length > 0
      ? `<section style="margin:4px 0 16px;">
    <h2 style="font-size:18px;margin:0 0 10px;">${escapeHtml(copy.pdfChartsDeckTitle)}</h2>
    ${chartPieces.join("")}
  </section>`
      : "";

  const appendixPieces = [timelineTables, heurParts.tablesSection, aiParts.tablesSection, ins].filter((s) => s.length > 0);
  const appendix =
    appendixPieces.length > 0
      ? `<section style="margin:16px 0 8px;">
    <h2 style="font-size:18px;margin:0 0 10px;">${escapeHtml(copy.pdfAppendixDetails)}</h2>
    ${appendixPieces.join("")}
  </section>`
      : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(copy.docTitle)}</title></head>
  <body style="font-family:Arial,Helvetica,sans-serif;padding:16px 20px;color:#0f172a;max-width:900px;margin:0 auto;">
    <h1 style="font-size:22px;margin:0 0 12px;">${escapeHtml(copy.reportHeading)}</h1>
    ${chartsDeck}
    ${listHeading}
    ${articles}
    ${meta}
    ${appendix}
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
