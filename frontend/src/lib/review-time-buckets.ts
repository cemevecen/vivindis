/** İçe aktarılan yorumları günlük / haftalık / aylık dilimlere ayırır (grafikler için). */

import type { ReviewListItemDto } from "@/types/app";

export type ReviewTimeBucketMode = "day" | "week" | "month" | "year";

export type ReviewTimelineRow = {
  /** Sıralama için ham anahtar */
  sortKey: string;
  /** Eksen etiketi */
  label: string;
  count: number;
  avgRating: number;
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  r5: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseReviewDateUtc(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Hafta Pazartesi başlar; hafta anahtarı o Pazartesinin UTC tarihidir. */
function mondayOfWeekUtc(d: Date): Date {
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  m.setUTCDate(m.getUTCDate() + mondayOffset);
  return m;
}

function bucketSortKey(d: Date, mode: ReviewTimeBucketMode): string {
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (mode === "day") {
    return `${y}-${pad2(mo)}-${pad2(day)}`;
  }
  if (mode === "month") {
    return `${y}-${pad2(mo)}`;
  }
  if (mode === "year") {
    return `${y}`;
  }
  const mon = mondayOfWeekUtc(d);
  return `w:${mon.getUTCFullYear()}-${pad2(mon.getUTCMonth() + 1)}-${pad2(mon.getUTCDate())}`;
}

function formatBucketLabel(d: Date, mode: ReviewTimeBucketMode, locale: string): string {
  if (mode === "day") {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(d);
  }
  if (mode === "month") {
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", timeZone: "UTC" }).format(d);
  }
  if (mode === "year") {
    return new Intl.DateTimeFormat(locale, { year: "numeric", timeZone: "UTC" }).format(d);
  }
  const mon = mondayOfWeekUtc(d);
  const sun = new Date(mon);
  sun.setUTCDate(sun.getUTCDate() + 6);
  const fmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt.format(mon)} – ${fmt.format(sun)}`;
}

function anchorDateForSortKey(sortKey: string, mode: ReviewTimeBucketMode): Date {
  if (mode === "year") {
    const y = Number(sortKey);
    const yy = Number.isFinite(y) ? y : 1970;
    return new Date(Date.UTC(yy, 0, 1));
  }
  if (mode === "month") {
    const parts = sortKey.split("-").map(Number);
    const y = parts[0] ?? 1970;
    const m = parts[1] ?? 1;
    const yy = Number.isFinite(y) ? y : 1970;
    const mm = Number.isFinite(m) ? m : 1;
    return new Date(Date.UTC(yy, mm - 1, 1));
  }
  if (mode === "day") {
    const parts = sortKey.split("-").map(Number);
    const y = parts[0] ?? 1970;
    const m = parts[1] ?? 1;
    const d = parts[2] ?? 1;
    const yy = Number.isFinite(y) ? y : 1970;
    const mm = Number.isFinite(m) ? m : 1;
    const dd = Number.isFinite(d) ? d : 1;
    return new Date(Date.UTC(yy, mm - 1, dd));
  }
  const raw = sortKey.replace(/^w:/, "");
  const parts = raw.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const yy = Number.isFinite(y) ? y : 1970;
  const mm = Number.isFinite(m) ? m : 1;
  const dd = Number.isFinite(d) ? d : 1;
  return new Date(Date.UTC(yy, mm - 1, dd));
}

export function buildReviewTimeline(
  reviews: ReviewListItemDto[],
  mode: ReviewTimeBucketMode,
  locale: string,
): ReviewTimelineRow[] {
  type Agg = {
    count: number;
    ratingSum: number;
    r1: number;
    r2: number;
    r3: number;
    r4: number;
    r5: number;
  };
  const map = new Map<string, Agg>();

  for (const rev of reviews) {
    const d = parseReviewDateUtc(rev.review_date);
    if (!d) {
      continue;
    }
    const key = bucketSortKey(d, mode);
    const rk = Math.max(1, Math.min(5, Math.round(Number(rev.rating) || 0)));
    let row = map.get(key);
    if (!row) {
      row = { count: 0, ratingSum: 0, r1: 0, r2: 0, r3: 0, r4: 0, r5: 0 };
      map.set(key, row);
    }
    row.count += 1;
    row.ratingSum += rk;
    if (rk === 1) {
      row.r1 += 1;
    } else if (rk === 2) {
      row.r2 += 1;
    } else if (rk === 3) {
      row.r3 += 1;
    } else if (rk === 4) {
      row.r4 += 1;
    } else {
      row.r5 += 1;
    }
  }

  const rows: ReviewTimelineRow[] = [];
  for (const [sortKey, agg] of Array.from(map.entries())) {
    const anchor = anchorDateForSortKey(sortKey, mode);
    rows.push({
      sortKey,
      label: formatBucketLabel(anchor, mode, locale),
      count: agg.count,
      avgRating: agg.count > 0 ? agg.ratingSum / agg.count : 0,
      r1: agg.r1,
      r2: agg.r2,
      r3: agg.r3,
      r4: agg.r4,
      r5: agg.r5,
    });
  }

  rows.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  return rows;
}

/** Ham yorumlarda kaç farklı yuvarlanmış yıldız (1–5) var. */
function distinctRatingCount(reviews: ReviewListItemDto[]): number {
  const s = new Set<number>();
  for (const rev of reviews) {
    s.add(Math.max(1, Math.min(5, Math.round(Number(rev.rating) || 0))));
  }
  return s.size;
}

/** Zaman / yıldız grafiklerinin anlamlı olup olmayacağı (tek çubuk, tek renk vb. gizlenir). */
export type TimelineChartsDisplayFlags = {
  showVolume: boolean;
  showStarsStack: boolean;
  showAvgRating: boolean;
};

export function buildReviewTimelineWithFlags(
  reviews: ReviewListItemDto[],
  mode: ReviewTimeBucketMode,
  locale: string,
): { rows: ReviewTimelineRow[]; flags: TimelineChartsDisplayFlags } {
  const rows = buildReviewTimeline(reviews, mode, locale);
  const hasRatingSpread = distinctRatingCount(reviews) >= 2;
  const showVolume = rows.length >= 2;
  const showStarsStack = rows.length >= 1 && hasRatingSpread;
  const showAvgRating = rows.length >= 2 && hasRatingSpread;
  return { rows, flags: { showVolume, showStarsStack, showAvgRating } };
}

export function hasAnyTimelineChart(flags: TimelineChartsDisplayFlags): boolean {
  return flags.showVolume || flags.showStarsStack || flags.showAvgRating;
}
